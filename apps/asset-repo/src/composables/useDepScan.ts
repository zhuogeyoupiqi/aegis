import type { AssetDep, AssetFile } from '@/api/types'
// 预打包产物清单（src/api 副本）：脚本生成的唯一真源——实际装到什么版本（catalog 解析
// 结果会漂移，如 ^3.5.13 装出 3.5.42），代码一律以清单为准，杜绝声明与产物的版本错位
import manifest from '@/api/repl-manifest.json'

/**
 * 依赖扫描（表单抽屉用）：从文件代码里提取裸导入，生成 import map 声明。
 *
 * 口径与后端/预打包脚本三方对齐：
 * - 版本号来自产物清单 manifest.json（pnpm prebundle 生成），锁版本绝不 latest——
 *   今天能预览的资产不能因为上游发版明天坏掉
 * - 预置表分两档：BUNDLED 走平台预打包产物（内网可用），
 *   CDN_KNOWN 走 esm.sh 锁版本（需出网）；表外的包扫出来留给用户手填版本
 * - 相对导入（./ ../）是资产内部引用，不算外部依赖，但要校验指向存在的文件
 */

interface ManifestEntry {
  version: string
  file: string
}

/** 平台预打包的依赖（name → 实际产物版本；es-module-shims 不是业务依赖，剔除） */
const BUNDLED: Record<string, string> = Object.fromEntries(
  Object.entries(manifest as Record<string, ManifestEntry>)
    .filter(([name]) => name !== 'es-module-shims')
    .map(([name, m]) => [name, m.version]),
)

/** 预打包产物文件名（无产物返回 null，调用方走 CDN 回退） */
export function bundledFile(name: string): string | null {
  const m = (manifest as Record<string, ManifestEntry>)[name]
  return m?.file ?? null
}

/** 走 esm.sh 的常用依赖（锁版本；ant-design-vue 的 external 参数在预览层拼，这里只存名字） */
const CDN_KNOWN: Record<string, string> = {
  'lodash-es': '4.17.21',
  axios: '1.7.9',
  'vue-router': '4.5.0',
  pinia: '2.3.0',
}

/** 相对导入解析：把 from 文件里的 ./x、../x 解析成资产内路径；解析不了（越界）返回 null */
export function resolveImport(fromPath: string, spec: string): string | null {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return null
  const base = fromPath.split('/').slice(0, -1) // from 所在目录
  const parts = [...base, ...spec.split('/')]
  const out: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop() // 越界（弹出根之上）时 out 为空，最终拼出的路径依然在根内，可接受
    else out.push(part)
  }
  return out.join('/')
}

/** 从代码文本里提取 import/export 的说明符（含动态 import() 与副作用导入） */
function* importSpecs(code: string): Generator<string> {
  // 静态：import ... from 'x' / export ... from 'x'
  const fromRe = /(?:^|[\s;}])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g
  // 副作用/动态：import 'x' / import('x')（前者的 (?!\s) 排除 import xxx 形式）
  const sideRe = /(?:^|[\s;}])(?:import|export)\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[\s;}])import\s+['"]([^'"]+)['"]/g
  for (const re of [fromRe, sideRe]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(code))) yield m[1] ?? m[2]
  }
}

/**
 * 扫描文件清单 → 依赖声明（按名字去重保序）。
 * 相对导入不产生依赖，但指向不存在的文件时返回 broken 提示（表单里给黄条警告）。
 */
export function scanDeps(files: AssetFile[]): { deps: AssetDep[]; broken: string[] } {
  const pathSet = new Set(files.map((f) => f.path))
  // 允许省略扩展名的内部引用（./Foo → ./Foo.vue/.ts）：预览改写层同样要补全
  const resolvable = (p: string) =>
    pathSet.has(p) || pathSet.has(`${p}.ts`) || pathSet.has(`${p}.vue`) || pathSet.has(`${p}.js`) || pathSet.has(`${p}.tsx`) || pathSet.has(`${p}.jsx`) || pathSet.has(`${p}/index.ts`) || pathSet.has(`${p}/index.vue`)

  const names: string[] = []
  const broken: string[] = []
  for (const f of files) {
    for (const spec of importSpecs(f.code)) {
      if (spec.startsWith('./') || spec.startsWith('../')) {
        const resolved = resolveImport(f.path, spec)
        if (resolved && !resolvable(resolved)) broken.push(`${f.path} → ${spec}`)
        continue
      }
      // 裸导入：@scope/pkg 取前两段，普通包取第一段
      const segs = spec.split('/')
      const name = spec.startsWith('@') ? segs.slice(0, 2).join('/') : segs[0]
      if (name && !names.includes(name)) names.push(name)
    }
  }

  const deps: AssetDep[] = names.map((name) => {
    if (name in BUNDLED) return { name, version: BUNDLED[name], source: 'bundled' as const }
    if (name in CDN_KNOWN) return { name, version: CDN_KNOWN[name], source: 'cdn' as const }
    // 表外包：版本留空让用户在表单里补（版本是预览可用性的硬前提，不给假默认值）
    return { name, version: '', source: 'cdn' as const }
  })
  return { deps, broken }
}

/** 预打包产物清单（预览层探测 / 隐式依赖补全用，与 manifest 同源不重复维护） */
export function knownBundled(): Record<string, string> {
  return { ...BUNDLED }
}
