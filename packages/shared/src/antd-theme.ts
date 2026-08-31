import { ref } from 'vue'
import { theme } from 'ant-design-vue'
import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import type { ThemeSnapshot } from '@aegis/contract'

/**
 * 子应用最近一次收到的主题快照（模块级响应式状态）。
 *
 * 为什么放 shared：子应用的 antd 主题必须从「数据」派生（快照是基座异步下发的），
 * 而不是从 DOM 反推。放在这里让子应用 App.vue 可以直接 computed 出 ConfigProvider 主题，
 * 主题桥（useBaseThemeBridge）负责写入，UI 层只读。
 */
export const lastThemeSnapshot = ref<ThemeSnapshot | null>(null)

/** 未收到基座数据前的兜底主题：与 tokens.css 的默认值保持一致（violet / 浅色） */
const FALLBACK_SNAPSHOT: ThemeSnapshot = {
  mode: 'light',
  primary: '#7c3aed',
  gradFrom: '#7c3aed',
  gradTo: '#c026d3',
}

/**
 * 由主题快照派生 antd ConfigProvider 的 theme 配置。
 *
 * 桥接原则：壳层（布局/标签栏）用我们自己的 CSS 变量着色，页面里的 antd 组件
 * 用 token 着色——两者从同一份偏好状态派生，保证品牌色与明暗永远一致。
 * 圆角对齐 V2 规范（控件 10px / 容器 16px），字体继承 tokens.css 的字体栈。
 */
export function buildAntdTheme(snapshot: ThemeSnapshot | null): ThemeConfig {
  const s = snapshot ?? FALLBACK_SNAPSHOT
  return {
    token: {
      colorPrimary: s.primary,
      colorInfo: s.primary,
      colorLink: s.primary,
      borderRadius: 10,
      borderRadiusLG: 16,
      // 与 tokens.css 的 --font-body 一致，避免 antd 组件字体和壳层打架
      fontFamily:
        "'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', 'Segoe UI', Arial, sans-serif",
    },
    algorithm: s.mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
  }
}
