/**
 * 预览依赖预打包脚本（pnpm prebundle）。
 *
 * 目标：把在线预览的常用依赖构建成同源单文件 ESM，产到 public/repl-deps/——
 * dev 由 Vite 直出（/repl-deps/*），prod 随 dist 一起走 /child/asset-repo/repl-deps/*。
 * 内网无公网时预览依然可用（esm.sh 回退路径仅覆盖长尾依赖）。
 *
 * 单实例红线：vue / dayjs / @ant-design/icons-vue 在所有产物里保持 external 裸导入，
 * import map 只有一个入口 URL → 浏览器按 URL 去重 → 整个沙箱单 Vue/单 dayjs 实例
 * （双实例会毁掉响应式，这是 repl 方案最大的坑，见方案文档"预览集成"）。
 */
import { build } from 'esbuild'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 包目录：不走 require.resolve（es-module-shims 等包的 exports 不含 ./package.json 会抛错），
 *  目标包全部是本应用直接依赖，node_modules/<name> 符号链接必然存在，直连即可 */
function pkgDir(name) {
  const dir = resolve(appRoot, 'node_modules', ...name.split('/'))
  if (!existsSync(join(dir, 'package.json'))) throw new Error(`包未安装为直接依赖: ${name}（pnpm add -D 它）`)
  return dir
}

function pkgVersion(name) {
  return JSON.parse(readFileSync(join(pkgDir(name), 'package.json'), 'utf8')).version
}

const outDir = join(appRoot, 'public', 'repl-deps')
mkdirSync(outDir, { recursive: true })

/** vue 的特性旗标必须 define：漏了任意一个，iframe 一加载就 ReferenceError */
const VUE_DEFINES = {
  'process.env.NODE_ENV': '"production"',
  __VUE_OPTIONS_API__: 'true',
  __VUE_PROD_DEVTOOLS__: 'false',
  __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
}

/**
 * 打包清单。entry 用包内具体文件（如 vue 的完整版 esm-bundler，含模板编译器——
 * 预览代码里 template: 选项字符串也能跑），external 是"保持裸导入"的共享依赖。
 */
const TARGETS = [
  // 完整版（runtime + compiler）：SFC 由主线程 compiler-sfc 编译，运行时兜底模板编译
  { name: 'vue', entry: 'vue/dist/vue.esm-bundler.js', external: [], defines: VUE_DEFINES },
  { name: 'dayjs', entry: 'dayjs', external: [] },
  { name: '@ant-design/icons-vue', entry: '@ant-design/icons-vue', external: ['vue'] },
  {
    name: 'ant-design-vue',
    entry: 'ant-design-vue',
    // dayjs/* 通配：antd 引用的 dayjs 插件子路径也保持裸导入，走 import map 前缀映射
    external: ['vue', 'dayjs', 'dayjs/*', '@ant-design/icons-vue'],
  },
]

const manifest = {}

/** 包名 → 入口文件绝对路径：entry 是"裸包名"时按 package.json 的 module/main 解析 */
function resolveEntry(name, entry) {
  if (entry === name || (entry.startsWith('@') && !entry.slice(1).includes('/'))) {
    const pkg = JSON.parse(readFileSync(join(pkgDir(name), 'package.json'), 'utf8'))
    return join(pkgDir(name), pkg.module ?? pkg.main ?? 'es/index.js')
  }
  // 子路径形态（vue/dist/vue.esm-bundler.js）：剥掉包名段，拼包内真实路径
  const sub = entry === name ? '' : entry.slice(name.length + 1)
  return join(pkgDir(name), sub)
}

for (const { name, entry, external, defines } of TARGETS) {
  const version = pkgVersion(name)
  const outfile = join(outDir, `${name}@${version}.esm.js`)

  await build({
    entryPoints: [resolveEntry(name, entry)],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    legalComments: 'none',
    external,
    define: defines,
    outfile,
    logLevel: 'info',
  })
  manifest[name] = { version, file: `${name}@${version}.esm.js` }
  console.log(`✔ ${name}@${version} → ${outfile.replace(appRoot, '.')}`)
}

// es-module-shims 自托管：repl 默认指 jsdelivr，内网必挂（Chrome 89+ 原生 import map 下它是 no-op）
const shimsVersion = pkgVersion('es-module-shims')
cpSync(
  join(pkgDir('es-module-shims'), 'dist', 'es-module-shims.js'),
  join(outDir, `es-module-shims@${shimsVersion}.js`),
)
manifest['es-module-shims'] = { version: shimsVersion, file: `es-module-shims@${shimsVersion}.js` }
console.log(`✔ es-module-shims@${shimsVersion}（直接拷贝 dist）`)

/* ---------- antd 产物的 external 子路径补齐 ----------
 * esbuild 的裸包名 external 会连子路径一起放行（与直觉相反）：antd 产物里因此残留
 * @ant-design/icons-vue/es/icons/* 与 dayjs/plugin/* 的导入——不补齐 import map，
 * 预览加载 antd 时模块解析直接失败。两类产物都经 import map 裸名引用根产物，单实例红线不破：
 * - icons shim：从 icons 根产物 re-export（export { X, X as default }）
 * - dayjs 插件：逐个 esbuild（external dayjs），插件内部的 require('dayjs') 走 import map
 */
const antdCode = readFileSync(join(outDir, manifest['ant-design-vue'].file), 'utf8')
const subpaths = {}

const iconNames = [...new Set([...antdCode.matchAll(/from"@ant-design\/icons-vue\/es\/icons\/([A-Za-z0-9_]+)"/g)].map((m) => m[1]))]
const iconsDir = join(outDir, 'icons-vue', 'es', 'icons')
mkdirSync(iconsDir, { recursive: true })
for (const name of iconNames) {
  writeFileSync(join(iconsDir, `${name}.js`), `export { ${name}, ${name} as default } from '@ant-design/icons-vue';\n`)
  subpaths[`@ant-design/icons-vue/es/icons/${name}`] = `icons-vue/es/icons/${name}.js`
}
console.log(`✔ icons 子路径 shim ×${iconNames.length}`)

const dayjsPlugins = [...new Set([...antdCode.matchAll(/from"dayjs\/plugin\/([a-zA-Z]+)"/g)].map((m) => m[1]))]
for (const plugin of dayjsPlugins) {
  const outfile = join(outDir, 'dayjs', 'plugin', `${plugin}.esm.js`)
  mkdirSync(dirname(outfile), { recursive: true })
  await build({
    entryPoints: [resolveEntry('dayjs', `dayjs/plugin/${plugin}`)],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    legalComments: 'none',
    external: ['dayjs'],
    outfile,
    logLevel: 'silent',
  })
  subpaths[`dayjs/plugin/${plugin}`] = `dayjs/plugin/${plugin}.esm.js`
}
console.log(`✔ dayjs 插件产物 ×${dayjsPlugins.length}`)
manifest.subpaths = subpaths

// 产物清单落盘两份：public/repl-deps/（运维可 curl 查看）+ src/api/（代码 import 的真源）。
// Vite 不建议从 public/ import 文件，src 副本规避限制；两份由同一次调用写出，不会漂移
const manifestJson = JSON.stringify(manifest, null, 2)
writeFileSync(join(outDir, 'manifest.json'), manifestJson)
writeFileSync(join(appRoot, 'src', 'api', 'repl-manifest.json'), manifestJson)
console.log('✔ manifest.json（public/repl-deps/ 与 src/api/ 各一份）')

/* ---------- 自检：external 是否真的保持裸导入（单实例红线的回归闸门） ---------- */
let failed = false
for (const { name } of TARGETS) {
  if (name === 'vue') continue
  const file = join(outDir, manifest[name].file)
  const code = readFileSync(file, 'utf8')
  // 根相对的 esm.sh 式导入（/vue@>=3.2.0）会绕过 import map，一旦出现就是双实例事故
  const bad = code.match(/from\s*["'](\/(?:vue|dayjs)@[^"']+)["']/)
  if (bad) {
    console.error(`✘ ${name} 产物出现根相对导入 ${bad[1]}（esm.sh 默认构建的特征，会绕过 import map）`)
    failed = true
  }
  const bareVue = /from\s*["']vue["']/.test(code)
  const bareDayjs = /from\s*["']dayjs["']/.test(code)
  console.log(`  ${name}: bare vue=${bareVue} bare dayjs=${bareDayjs}`)
}
// antd 产物里每个 external 子路径都必须有对应产物登记，漏一个预览就断一件组件
const subRefRe = /from"(@ant-design\/icons-vue\/es\/icons\/[A-Za-z0-9_]+|dayjs\/plugin\/[a-zA-Z]+)"/g
for (const m of antdCode.matchAll(subRefRe)) {
  if (!manifest.subpaths[m[1]]) {
    console.error(`✘ antd 产物引用的子路径未登记产物: ${m[1]}`)
    failed = true
  }
}
if (failed) process.exit(1)
console.log('\n全部产物自检通过；已存在的 public/repl-deps 目录内容：', readdirSync(outDir).join('、'))
