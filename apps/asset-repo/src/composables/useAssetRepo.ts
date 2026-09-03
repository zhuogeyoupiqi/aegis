import { computed, ref, watch } from 'vue'
import { toast } from '@aegis/shared'
import { i18n } from '@/locales'
import { deleteItem, incrementCopy, listItems, saveItem, updateItem } from '@/api/items'
import type { AssetFile, AssetItem, AssetType, ItemSavePayload } from '@/api/types'

/**
 * 资产仓库的业务状态机（检索 / 选中 / 表单 / 增删改 / 复制计数 / 复制动作组）。
 *
 * 子应用没有 pinia，跨组件共享用「模块级单例」：状态创建在模块作用域，
 * useAssetRepo() 只是取同一份引用——视图、详情面板、表单抽屉看到的是同一份数据。
 */

/* ---------- 列表与筛选 ---------- */

const items = ref<AssetItem[]>([])
const loading = ref(false)
/** 检索关键字（名称/说明/正文三列模糊，输入防抖 300ms 后触发重查） */
const kw = ref('')
/** 类型过滤（空串 = 全部） */
const typeFilter = ref<AssetType | ''>('')
/** 标签过滤（undefined = 不过滤；选项由现有资产的标签聚合而来） */
const tagFilter = ref<string | undefined>(undefined)
const selectedId = ref<string | null>(null)

const selected = computed(() => items.value.find((i) => i.id === selectedId.value) ?? null)

/** 标签下拉选项：从列表聚合去重，选了标签后可顺藤摸到同类资产 */
const tagOptions = computed(() => {
  const set = new Set<string>()
  for (const item of items.value) for (const tag of item.tags) set.add(tag)
  return [...set].sort()
})

/**
 * 重查列表。
 * @param opts.autoSelectFirst 是否在没有选中项时自动落到首条。
 *        卡片网格首页/搜索/筛选都不应打扰用户当前选中态；
 *        只有列表分栏模式的视图层在初始化/切换时主动要求才自动选中。
 */
async function reload(opts?: { autoSelectFirst?: boolean }): Promise<void> {
  loading.value = true
  try {
    items.value = await listItems({
      kw: kw.value.trim() || undefined,
      type: typeFilter.value || undefined,
      tag: tagFilter.value,
    })
    if (opts?.autoSelectFirst && !items.value.some((i) => i.id === selectedId.value)) {
      selectedId.value = items.value[0]?.id ?? null
    }
  } catch (e) {
    // 检索失败给可读文案（网络不通 / 会话失效已在 http 层 toast 过，这里兜住其余）
    toast(e instanceof Error ? e.message : String(e), 'bad')
    items.value = []
    selectedId.value = null
  } finally {
    loading.value = false
  }
}

// 关键字防抖：输入停顿后再查，避免每敲一个字符打一次后端
let kwTimer: ReturnType<typeof setTimeout> | null = null
watch(kw, () => {
  if (kwTimer) clearTimeout(kwTimer)
  kwTimer = setTimeout(reload, 300)
})
// 类型/标签是离散选择，变更即查；reload 现在带可选参数，包一层避免 watch 类型不匹配
watch([typeFilter, tagFilter], () => reload())

/** 清理副作用：组件卸载时取消未触发的防抖定时器，防止子应用销毁后仍发起请求 */
function cleanup(): void {
  if (kwTimer) {
    clearTimeout(kwTimer)
    kwTimer = null
  }
}

/* ---------- 新建 / 编辑抽屉 ---------- */

const drawerOpen = ref(false)
/** 当前编辑的资产（null = 新建模式） */
const editing = ref<AssetItem | null>(null)
const saving = ref(false)

function openCreate(): void {
  editing.value = null
  drawerOpen.value = true
}

function openEdit(item: AssetItem): void {
  editing.value = item
  drawerOpen.value = true
}

function closeDrawer(): void {
  drawerOpen.value = false
  editing.value = null
}

/** 提交表单（新建/编辑共用）：成功后重查列表并关抽屉；失败保持抽屉开着让用户改 */
async function submit(payload: ItemSavePayload): Promise<boolean> {
  saving.value = true
  try {
    if (editing.value) {
      await updateItem(editing.value.id, payload)
    } else {
      await saveItem(payload)
    }
    toast(i18n.global.t('repo.saved'))
    drawerOpen.value = false
    editing.value = null
    await reload()
    return true
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), 'bad')
    return false
  } finally {
    saving.value = false
  }
}

/* ---------- 删除 / 复制动作组 ---------- */

async function remove(item: AssetItem): Promise<void> {
  try {
    await deleteItem(item.id)
    toast(i18n.global.t('repo.deleted'))
    await reload()
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), 'bad')
  }
}

/**
 * 复制成功后打计数：刻意"先反馈成功再打点"——计数接口失败不应让用户以为复制没成功；
 * 本地先把次数 +1（不立即重排——刚点完复制的条目突然跳位会很懵，下次重查自然归位）。
 */
async function bumpCount(item: AssetItem): Promise<void> {
  await incrementCopy(item.id).catch(() => {})
  const local = items.value.find((i) => i.id === item.id)
  if (local) local.copyCount++
}

/** 按语言选注释语法给"复制全部"拼分节头：粘贴进编辑器后头本身就是注释，不污染代码 */
function banner(lang: string | null): (path: string) => string {
  const l = (lang ?? '').toLowerCase()
  if (l === 'vue' || l === 'md' || l === 'markdown' || l === 'html' || l === 'xml') return (p: string) => `<!-- ${p} -->`
  if (l === 'css' || l === 'less' || l === 'scss') return (p: string) => `/* ${p} */`
  if (l === 'python' || l === 'bash' || l === 'sh' || l === 'shell' || l === 'yaml' || l === 'toml' || l === 'env') return (p: string) => `# ${p}`
  return (p: string) => `// ${p}`
}

/** 单文件复制（文件树/详情的"复制此文件"） */
async function copyFile(item: AssetItem, file: AssetFile): Promise<void> {
  if (!(await copyText(file.code))) {
    toast(i18n.global.t('repo.copyFailed'), 'bad')
    return
  }
  toast(i18n.global.t('repo.copiedFile', { path: file.path }))
  await bumpCount(item)
}

/** 复制全部：按路径分节拼接（单文件资产的普通复制也走这里，无分节头） */
async function copyAll(item: AssetItem): Promise<void> {
  const text = concatFiles(item)
  if (!(await copyText(text))) {
    toast(i18n.global.t('repo.copyFailed'), 'bad')
    return
  }
  toast(i18n.global.t('repo.copied'))
  await bumpCount(item)
}

/** link 复制 URL；其余按"多文件拼分节、单文件裸正文"的口径产出文本 */
function concatFiles(item: AssetItem): string {
  if (item.type === 'link') return item.url ?? ''
  if (item.files.length <= 1) return item.files[0]?.code ?? ''
  return item.files.map((f) => `${banner(f.lang)(f.path)}\n${f.code}`).join('\n\n')
}

/** 下载 zip：jszip 动态 import（不进主 bundle），失败退化成复制拼接文本 */
async function downloadZip(item: AssetItem): Promise<void> {
  try {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (const f of item.files) zip.file(f.path, f.code)
    const blob = await zip.generateAsync({ type: 'blob' })
    // 资产名里的路径分隔符换成全角斜杠，防止被当目录写入
    const name = item.name.replace(/[\\/:*?"<>|]/g, '_')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.zip`
    a.click()
    URL.revokeObjectURL(url)
    toast(i18n.global.t('repo.zipDone'))
    await bumpCount(item)
  } catch {
    // jszip 加载失败（离线首访等）：退化为复制拼接文本，动作不落空
    toast(i18n.global.t('repo.zipFallback'), 'info')
    await copyAll(item)
  }
}

/* ---------- 剪贴板工具 ---------- */

/**
 * 写剪贴板，带 iframe 沙箱兜底。
 * Clipboard API 在跨源 iframe / 非安全上下文里可能被拒，
 * 退化到隐藏 textarea + execCommand（老但哪里都能用）。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

/** 导出同一份单例状态与动作 */
export function useAssetRepo() {
  return {
    // 列表与筛选
    items,
    loading,
    kw,
    typeFilter,
    tagFilter,
    tagOptions,
    selectedId,
    selected,
    reload,
    cleanup,
    // 表单抽屉
    drawerOpen,
    editing,
    saving,
    openCreate,
    openEdit,
    closeDrawer,
    submit,
    // 动作
    remove,
    copyAll,
    copyFile,
    downloadZip,
    concatFiles,
  }
}
