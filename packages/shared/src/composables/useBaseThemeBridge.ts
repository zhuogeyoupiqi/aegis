import { onMounted, ref } from 'vue'
import { CHILD_DATA_KEYS, type ThemeSnapshot } from '@aegis/contract'
import { lastThemeSnapshot } from '../antd-theme'

/**
 * 子应用最近收到的语言（模块级响应式状态）。
 * 与 lastThemeSnapshot 同理：子应用的 i18n / antd locale 从数据派生，
 * App.vue watch 它来切换语言。
 */
export const lastLang = ref<'zh-CN' | 'en-US'>('zh-CN')

/**
 * 把主题快照应用到当前应用根节点。
 * 子应用与基座共用同一份 tokens.less（monorepo L1 源码共享），
 * 所以同步主题 = 同步几个 CSS 变量，天然无版本漂移。
 * 同时写入 lastThemeSnapshot：antd 组件的主题从这份响应式数据派生（见 antd-theme.ts）。
 */
export function applyThemeSnapshot(t: ThemeSnapshot): void {
  const root = document.documentElement
  root.dataset.theme = t.mode
  root.style.setProperty('--primary', t.primary)
  root.style.setProperty('--grad-1', t.gradFrom)
  root.style.setProperty('--grad-2', t.gradTo)
  lastThemeSnapshot.value = t
}

/** 应用基座下发的一包数据（主题 + 语言） */
function applyBaseData(data: Record<string, unknown>): void {
  const t = data?.[CHILD_DATA_KEYS.THEME]
  if (t) applyThemeSnapshot(t as ThemeSnapshot)
  const lang = data?.[CHILD_DATA_KEYS.LANG]
  // 只认契约内的语言值，脏数据直接忽略
  if (lang === 'zh-CN' || lang === 'en-US') lastLang.value = lang
}

/**
 * 子应用侧主题桥：监听基座下发的数据并跟随主题/语言。
 *
 * 为什么放 shared：这是所有子应用接入微前端的标准动作，
 * 集中维护后新子应用一行 useBaseThemeBridge() 即完成主题跟随。
 *
 * 独立运行（直接访问子应用 dev 端口调试）时 window.microApp 不存在，
 * 走默认主题，不影响单独开发——这是微前端子应用可独立调试的关键。
 */
export function useBaseThemeBridge(): void {
  onMounted(() => {
    // micro-app 注入的全局对象，类型无法静态声明，按 any 处理并收敛在这一处
    const micro = (window as unknown as { microApp?: any }).microApp
    if (!micro) return

    // 后续变更：基座切主题/语言时实时跟随。
    // 第二个参数 autoTrigger = true：注册时若基座已推送过数据，立即补一次回调。
    // 基座在 micro-app 的 mounted 事件就 setData，而子应用 Vue 挂载（含路由初始
    // 导航）可能晚于该事件——没有这个参数就会错过首次主题，表现为子应用恒为浅色。
    micro.addDataListener(applyBaseData, true)

    // 再显式取一次当前数据：autoTrigger 在部分时机下不会重放（例如基座赋值发生在
    // 事件中心初始化之前），getData 作为兜底，保证首屏主题/语言不错过。
    const initial = micro.getData?.() as Record<string, unknown> | undefined
    if (initial) applyBaseData(initial)
  })
}
