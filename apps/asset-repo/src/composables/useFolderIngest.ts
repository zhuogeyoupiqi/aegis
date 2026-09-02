import type { AssetFile } from '@/api/types'

/**
 * 文件夹导入（表单抽屉用）：把磁盘上的目录整棵收进资产。
 *
 * 两个来源统一到 PickedFile{path, file} 再走同一条清洗管道：
 * - <input webkitdirectory>：FileList 项带 webkitRelativePath（"外层目录/内/文件"）
 * - 拖放 DataTransfer：webkitGetAsEntry 递归展开（readEntries 每次最多吐 100 条，
 *   必须循环读到空数组，Chrome 的目录条目分批吐是历史坑）
 *
 * 清洗规则：剥最外层目录（拖整个组件文件夹时"组件名/"是无意义前缀）、
 * 跳过 node_modules/dist/.git 等噪声路径、只收白名单文本扩展名、
 * 超 100KB 的文件跳过（源码不至于，命中说明拖错了文件）。
 */

/** 拖进来的"还没读内容"的文件：path 是剥壳后的资产内路径 */
export interface PickedFile {
  path: string
  file: File
}

/** 跳过的路径片段（两侧加 / 比较，子串会误伤 "my-node_modules_backup" 这类名字） */
const SKIP_SEGMENTS = new Set(['node_modules', 'dist', 'build', '.git', '.svn', 'coverage', '.idea', '.vscode'])

/** 文本扩展名白名单：二进制文件读成文本只会存进乱码，宁可明确跳过 */
const TEXT_EXT: Record<string, string> = {
  ts: 'ts', tsx: 'ts', mts: 'ts',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript',
  vue: 'vue', java: 'java', py: 'python', go: 'go', rs: 'rust',
  sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash',
  json: 'json', jsonc: 'json', yaml: 'yaml', yml: 'yaml', toml: 'yaml',
  md: 'md', markdown: 'md', txt: 'text',
  css: 'css', less: 'less', scss: 'css', html: 'html', xml: 'xml',
  env: 'bash', gitignore: 'bash', editorconfig: 'text',
}

/** 单文件上限：与后端 @Size(max=200000) 对齐取保守值，导入侧先拦 */
const MAX_FILE_BYTES = 100 * 1024

/** 扩展名 → 语言标识（与 useShiki 的 LANGS/ALIAS 口径一致） */
export function langFromPath(path: string): string | null {
  const ext = path.includes('.') ? path.split('.').pop()!.toLowerCase() : ''
  return TEXT_EXT[ext] ?? null
}

/** 逐条判定：路径干净（不在噪声目录下）且是白名单文本扩展 */
function isAcceptable(path: string): boolean {
  const segs = path.toLowerCase().split('/')
  if (segs.some((s) => !s || SKIP_SEGMENTS.has(s))) return false
  const name = segs[segs.length - 1]
  if (!name.includes('.')) return false // 无扩展名（Makefile、LICENSE 等）先不收，避免歧义
  const ext = name.split('.').pop()!
  return ext in TEXT_EXT
}

/** FileList（input 选中）→ PickedFile：剥 webkitRelativePath 的最外层目录 */
export function pickedFromFileList(list: FileList | File[]): PickedFile[] {
  const out: PickedFile[] = []
  for (const file of Array.from(list)) {
    // webkitRelativePath 只在 webkitdirectory input 上有值；普通多选 input 退化为 file.name
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    out.push({ path: stripRoot(rel), file })
  }
  return out
}

/** DataTransfer → PickedFile：webkitGetAsEntry 递归展开目录树 */
export async function pickedFromDataTransfer(dt: DataTransfer): Promise<PickedFile[]> {
  const out: PickedFile[] = []

  interface FsEntry {
    name: string
    isFile: boolean
    isDirectory: boolean
    file: (cb: (f: File) => void, err: (e: unknown) => void) => void
    createReader: () => { readEntries: (cb: (entries: FsEntry[]) => void, err: (e: unknown) => void) => void }
  }

  async function walk(entry: FsEntry, prefix: string): Promise<void> {
    if (entry.isFile) {
      // entry.file() 是回调风格，包成 promise；拿不到（权限/瞬态错误）就跳过这一条
      const file = await new Promise<File | null>((resolve) => entry.file((f) => resolve(f), () => resolve(null)))
      if (file) out.push({ path: prefix + entry.name, file })
      return
    }
    if (entry.isDirectory) {
      const reader = entry.createReader()
      // readEntries 单次最多返回 100 条：循环读到空数组才算目录读完（Chrome 历史行为）
      for (;;) {
        const batch = await new Promise<FsEntry[]>((resolve) => reader.readEntries((es) => resolve(es), () => resolve([])))
        if (batch.length === 0) break
        for (const child of batch) await walk(child, `${prefix}${entry.name}/`)
      }
    }
  }

  const entries: FsEntry[] = []
  for (const item of Array.from(dt.items)) {
    // lib.dom 把 webkitGetAsEntry 的返回收窄成 FileSystemEntry（没带 file/createReader 签名），
    // 实际运行时就是带这些方法的 entry，双重断言过类型关
    const e = item.webkitGetAsEntry?.() as unknown as FsEntry | null
    if (e) entries.push(e)
  }
  for (const entry of entries) await walk(entry, '')
  // 拖的是"一个目录"（单一目录入口）时剥掉最外层；拖多个条目时保留各自名字
  const dirCount = entries.filter((e) => e.isDirectory).length
  const fileCount = entries.filter((e) => e.isFile).length
  if (dirCount === 1 && fileCount === 0) {
    for (const p of out) p.path = stripRoot(p.path)
  }
  return out
}

/** "外层目录/a/b.ts" → "a/b.ts"；没有目录段时原样返回 */
function stripRoot(path: string): string {
  const idx = path.indexOf('/')
  return idx === -1 ? path : path.slice(idx + 1)
}

export interface IngestResult {
  /** 成功读入的文件 */
  files: AssetFile[]
  /** 跳过的条目（路径 + 原因），toast 里给用户看得见的交代 */
  skipped: { path: string; reason: string }[]
}

/** 读取并清洗：读文本 + 语言探测 + 过滤；同名后到覆盖（与后端去重语义一致） */
export async function ingestPicked(picked: PickedFile[]): Promise<IngestResult> {
  const byPath = new Map<string, AssetFile>()
  const skipped: { path: string; reason: string }[] = []

  for (const { path, file } of picked) {
    const clean = path.replace(/^\/+/, '')
    if (!clean) continue
    if (!isAcceptable(clean)) {
      skipped.push({ path: clean, reason: 'skip' })
      continue
    }
    if (file.size > MAX_FILE_BYTES) {
      skipped.push({ path: clean, reason: 'tooLarge' })
      continue
    }
    try {
      byPath.set(clean, { path: clean, lang: langFromPath(clean), code: await file.text() })
    } catch {
      skipped.push({ path: clean, reason: 'skip' })
    }
  }
  return { files: [...byPath.values()], skipped }
}
