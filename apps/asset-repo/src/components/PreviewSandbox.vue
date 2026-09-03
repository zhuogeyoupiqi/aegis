<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStore, type ImportMap, type ReplStore } from '@vue/repl'
import type { SFCScriptCompileOptions } from 'vue/compiler-sfc'
import { lastThemeSnapshot, toast } from '@aegis/shared'
import type { AssetDep, AssetFile, AssetItem } from '@/api/types'
import { resolveImport, knownBundled, bundledFile, bundledSubpaths } from '@/composables/useDepScan'

/**
 * 在线预览沙箱（@vue/repl 只读模式：Sandbox 面板，不拉编辑器 chunk）。
 *
 * 三个关键决策（来源：npm 包源码级核实，见方案文档"预览集成"一节）：
 * 1. 相对导入改写：repl 虚拟文件系统把 './x' 解析到虚拟根（src/）而不是按目录，
 *    所以喂给 store 前把所有相对导入改写成根相对 './<根起路径>' 并补全扩展名；
 *    存储保持作者原始代码（复制到真实项目时导入语义必须正确）。
 * 2. 单 Vue 实例：vue/antd/icons/dayjs 全部走 import map 的裸导入映射；
 *    预打包产物构建时保持共享依赖 external，esm.sh 侧用 ?external=vue 强制裸导入。
 * 3. 内网可用性：bundled 依赖优先同源 /repl-deps/*（HEAD 探测存在性），
 *    探测不到回退 esm.sh 锁版本并 toast 明示；es-module-shims 必须自托管
 *    （repl 默认指 jsdelivr，内网必挂）。
 */

const props = defineProps<{ item: AssetItem }>()
const { t } = useI18n()

// 预览沙箱主题跟随基座：lastThemeSnapshot.mode 已是解析后的 light/dark
const previewTheme = computed(() => (lastThemeSnapshot.value?.mode === 'dark' ? 'dark' : 'light'))

// repl 核心 ~450KB，动态 import 懒加载（style.css 一起下沉，主包零增量）
const Sandbox = defineAsyncComponent(async () => {
  await import('@vue/repl/style.css')
  return (await import('@vue/repl')).Sandbox
})

/**
 * 预打包产物根（必须绝对 URL，且必须锚定【子应用真实源】）：
 * - 取 origin 用 import.meta.url 而不是 window.location.origin——micro-app iframe 沙箱里
 *   location.origin 仍返回基座源（iframe.src=基座地址），拼出的产物 URL 会在预览 iframe
 *   里 404 白屏；而子应用模块永远从子应用源加载（micro-app 从 8001 拉 JS 进沙箱执行），
 *   import.meta.url 是 JS 引擎层面的真实模块 URL，任何沙箱代理都改不了
 * - 注意 HEAD 探测的假阳性坑：micro-app 会拦截沙箱内 fetch 重写到子应用源，所以
 *   探测"成功"不代表 iframe 的原生模块加载器也能命中——URL 本身对才是根治
 * - dev 直连子应用与 prod（BASE_URL=/child/asset-repo/）下两者等价，统一走此式
 */
const DEPS_BASE = new URL(import.meta.url).origin + import.meta.env.BASE_URL + 'repl-deps/'

/** HEAD 探测缓存：每个 PreviewSandbox 实例独立一份，避免多实例互相污染 */
const probeCache = new Map<string, boolean>()

async function probe(url: string): Promise<boolean> {
  if (probeCache.has(url)) return probeCache.get(url)!
  let ok = false
  try {
    const res = await fetch(url, { method: 'HEAD' })
    ok = res.ok
  } catch {
    ok = false
  }
  probeCache.set(url, ok)
  return ok
}

/** esm.sh 锁版本 URL；ant-design-vue 必须 ?external=vue（默认构建含 656 处根相对
 *  /vue@>=3.2.0 导入会绕过 import map 造成双 Vue 实例，已实测） */
function cdnUrl(dep: AssetDep): string {
  const base = `https://esm.sh/${dep.name}@${dep.version}`
  if (dep.name === 'ant-design-vue') return `${base}?external=vue&deps=dayjs@1.11.13`
  if (dep.name === '@ant-design/icons-vue') return `${base}?external=vue`
  return base
}

/** bundled 产物 URL 以清单文件名为准：种子声明的版本可能落后于实际产物
 *  （如声明 vue 3.5.13 / 产物 3.5.42），按 dep.version 拼 URL 会 404 白白回退 CDN */
function bundledUrl(dep: AssetDep): string | null {
  const file = bundledFile(dep.name)
  return file ? `${DEPS_BASE}${file}` : null
}

/** 单个依赖的最终 URL：bundled 先探测（清单无此包或产物缺失都回退），404 回退 CDN（并汇总提示） */
async function resolveDepUrl(dep: AssetDep, fallbacks: string[]): Promise<string> {
  if (dep.source === 'bundled') {
    const url = bundledUrl(dep)
    if (url && (await probe(url))) return url
    fallbacks.push(dep.name)
  }
  return cdnUrl(dep)
}

/** 全部依赖 → import map（含 dayjs 前缀映射：插件/语言包走 esm.sh 子路径构建） */
async function buildImportMap(declared: AssetDep[]): Promise<ImportMap> {
  const imports: Record<string, string> = {}
  const fallbacks: string[] = []

  const deps = [...declared]
  if (deps.some((d) => d.name === 'ant-design-vue')) {
    // 预打包的 antd 产物对 dayjs 与 icons 保持 external 裸导入，但作者声明里常常只有
    // antd（只声明自己 import 的包）——不补这两个映射，预览加载 antd 时直接模块解析失败
    for (const name of ['dayjs', '@ant-design/icons-vue']) {
      if (!deps.some((d) => d.name === name)) {
        deps.push({ name, version: knownBundled()[name] ?? '', source: 'bundled' })
      }
    }
  }

  for (const dep of deps) {
    imports[dep.name] = await resolveDepUrl(dep, fallbacks)
  }
  // antd 产物对 icons 子路径与 dayjs 插件保持 external（esbuild 裸包名 external 连子路径放行），
  // 预打包脚本已生成 shim/插件产物并按精确键登记——精确键优先于前缀映射，长尾子路径仍走 esm.sh
  for (const [key, file] of Object.entries(bundledSubpaths())) {
    imports[key] = DEPS_BASE + file
  }
  const dayjs = deps.find((d) => d.name === 'dayjs')
  // dayjs 插件/语言包是子路径导入（dayjs/plugin/x）：前缀映射兜底走 esm.sh（在线可用；
  // 离线内网下带插件的 antd 预览会缺件，属已知边界，README 注明）
  if (dayjs) imports['dayjs/'] = `https://esm.sh/dayjs@${dayjs.version}/`
  if (fallbacks.length) {
    toast(t('repo.previewFallback', { names: fallbacks.join('、') }), 'info')
  }
  return { imports, scopes: {} }
}

/* ---------- 相对导入改写（喂 store 前的最后一道变换） ---------- */

// 三种形态各自捕获前缀与引号，改写时原样拼回；多行 import 不匹配就保留原样，
// 预览报错恰好把问题文件指出来，不做过度智能的猜测
const FROM_RE = /(\bfrom\s*)(['"])(\.\.?\/[^'"]+)\2/g
const DYNAMIC_RE = /(\bimport\s*\(\s*)(['"])(\.\.?\/[^'"]+)\2/g
const SIDE_RE = /(\bimport\s+)(['"])(\.\.?\/[^'"]+)\2/g

/** 相对导入 → 根相对（可解析到清单内文件时改写，否则保留原文） */
function rewriteImports(code: string, fromPath: string, files: AssetFile[]): string {
  const known = new Set(files.map((f) => f.path))
  const toRootRelative = (spec: string): string | null => {
    const resolved = resolveImport(fromPath, spec)
    if (!resolved) return null
    // 补全省略的扩展名/索引文件（作者习惯省 .vue/.ts；repl 需要精确命中虚拟文件名）
    const candidates = [
      resolved,
      `${resolved}.ts`, `${resolved}.tsx`, `${resolved}.js`, `${resolved}.jsx`, `${resolved}.vue`,
      `${resolved}/index.ts`, `${resolved}/index.vue`,
    ]
    for (const c of candidates) {
      if (known.has(c)) return './' + c
    }
    return null
  }
  const apply = (m: string, pre: string, q: string, spec: string): string => {
    const to = toRootRelative(spec)
    return to ? `${pre}${q}${to}${q}` : m
  }
  return code
    .replace(FROM_RE, (m, pre: string, q: string, spec: string) => apply(m, pre, q, spec))
    .replace(DYNAMIC_RE, (m, pre: string, q: string, spec: string) => apply(m, pre, q, spec))
    .replace(SIDE_RE, (m, pre: string, q: string, spec: string) => apply(m, pre, q, spec))
}

/** git 模型文件清单 → repl 虚拟文件系统（键必须带 src/ 前缀，虚拟根是 src/） */
function toReplFiles(files: AssetFile[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of files) {
    out['src/' + f.path] = rewriteImports(f.code, f.path, files)
  }
  return out
}

/* ---------- store 装配 ---------- */

const ready = ref(false)
const loadError = ref<string | null>(null)
const compileErrors = computed(() => store.errors.map((e) => String(e)).filter(Boolean))

// builtinImportMap 先给空表（vue 映射在异步探测后 merge 进来）：默认表指 jsdelivr，
// 内网首帧就会报加载失败。resourceLinks 把 es-module-shims 换成自托管产物。
// 注意选项形参是 ToRefs 形状（Ref 包裹），与直觉不符——以类型为准
const store: ReplStore = useStore({
  builtinImportMap: ref<ImportMap>({ imports: {}, scopes: {} }),
  // es-module-shims 同样以清单为准（兜底串只在清单异常缺失时兜住，避免回落 jsdelivr）
  resourceLinks: ref({
    esModuleShims: `${DEPS_BASE}${bundledFile('es-module-shims') ?? 'es-module-shims@2.8.4.js'}`,
  }),
})

// 沙箱版 compiler-sfc 不带 fs：defineProps<T>() 引用跨文件类型（真实组件的常态，
// 如 import type { Props } from './types'）会抛 "No fs option provided"。
// repl 的 doCompileScript 会把 store.sfcOptions.script 展平进 compileScript 选项，
// 在此注入一个指向虚拟文件系统的 fs；路径归一兼容 repl 键名的两种形态（src/ 前缀 / 绝对路径）
// 关键实现细节：setFiles 的编译发生在 store.files 整体替换【之前】（先编译局部集再赋值），
// 查找必须优先命中"即将灌入"的 pendingFiles，否则首轮编译一律找不到被引用的类型文件
// 每个 PreviewSandbox 实例独立一份，避免多实例同时编译时互相覆盖
let pendingFiles: Record<string, string> = {}
const virtualRead = (file: string): string | undefined => {
  const key = file.replace(/^\/+/, '')
  const alt = key.replace(/^src\//, '')
  return pendingFiles[key] ?? pendingFiles[alt] ?? store.files[key]?.code ?? store.files[alt]?.code
}
store.sfcOptions = {
  ...store.sfcOptions,
  script: {
    ...store.sfcOptions.script,
    fs: {
      fileExists: (file) => virtualRead(file) !== undefined,
      readFile: (file) => virtualRead(file) ?? '',
      realpath: (file) => file,
    },
  },
}

async function loadItem(item: AssetItem): Promise<void> {
  ready.value = false
  loadError.value = null
  store.errors = []
  try {
    // import-map.json 必须随文件集一起喂给 setFiles（repl 4.7 源码级结论）：
    // setFiles 会整体替换 store.files，之后再设映射、或映射先设都会让它内部
    // applyBuiltinImportMap 读到不存在的文件 → getImportMap 的 undefined.code
    // 被吞成 "Syntax error in import-map.json"，且该错误无人清理会常驻面板
    const map = await buildImportMap(item.deps)
    const files: Record<string, string> = {
      ...toReplFiles(item.files),
      'import-map.json': JSON.stringify(map, null, 2),
    }
    pendingFiles = files
    await store.setFiles(files, 'src/' + item.entry)
    ready.value = true
  } catch (e) {
    // 依赖探测失败、import map 构建失败、setFiles 编译失败都走这里，避免 spinner 永久挂死
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(() => void loadItem(props.item))
// 切换资产或同资产内容变化（文件/依赖/入口）都重载预览
watch(
  () => props.item,
  (cur, prev) => {
    if (!cur.id) return
    if (
      cur.id !== prev?.id ||
      cur.files !== prev.files ||
      cur.deps !== prev.deps ||
      cur.entry !== prev.entry
    ) {
      void loadItem(cur)
    }
  },
  { deep: true },
)
</script>

<template>
  <div class="sandbox">
    <!-- 假浏览器外壳：交通灯 + 沙箱地址栏 + 运行中徽标（与原型一致的视觉锚点） -->
    <div class="sandbox__chrome">
      <span class="dots"><i class="dot red" /><i class="dot yellow" /><i class="dot green" /></span>
      <span class="addr">sandbox://{{ item.entry }}</span>
      <span class="running"><i />{{ t('repo.previewRunning') }}</span>
    </div>

    <div class="sandbox__stage">
      <a-spin v-if="!ready && !loadError" class="sandbox__spin" :tip="t('repo.previewLoading')" />
      <!-- 加载期异常（依赖探测、import map、setFiles 失败）：给出可读错误而不是 spinner 挂死 -->
      <pre v-else-if="loadError" class="sandbox__errors">{{ loadError }}</pre>
      <!-- 编译错误面板：Sandbox 只显示运行时错误，编译错误在 store.errors -->
      <pre v-else-if="compileErrors.length" class="sandbox__errors">{{ compileErrors.join('\n\n') }}</pre>
      <Sandbox v-else :store="store" :theme="previewTheme" />
    </div>
  </div>
</template>

<style scoped lang="less">
.sandbox {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.sandbox__chrome {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-deep, var(--bg-input));

  .dots {
    display: inline-flex;
    gap: 6px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    &.red { background: #fd5257; }
    &.yellow { background: #f7ba1e; }
    &.green { background: #55c51e; }
  }

  .addr {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--fg-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 2px 12px;
  }

  .running {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #389e0d;

    i {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #55c51e;
      // 呼吸点：静态绿色圆点不够"活着"
      animation: pulse 1.6s ease-in-out infinite;
    }
  }
}

.sandbox__stage {
  flex: 1;
  min-height: 420px;
  position: relative;

  // repl 预览是普通文档流 iframe，占满舞台。不能走百分比高度链：
  // stage 的高度来自 flex:1 + min-height（height 属性是 auto），规范上子元素
  // height:100% 参照 auto 父级会失效 → container/iframe 双双回落默认 150px。
  // 改绝对定位铺满（stage 已 position:relative，spin 同款手法），一劳永逸
  :deep(.iframe-container) {
    position: absolute;
    inset: 0;
  }

  :deep(iframe) {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }
}

.sandbox__spin {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sandbox__errors {
  margin: 0;
  padding: 16px;
  max-height: 420px;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: #d5445c;
  background: #fff5f6;
  white-space: pre-wrap;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
</style>
