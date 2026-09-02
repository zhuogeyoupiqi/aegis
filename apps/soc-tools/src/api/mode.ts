import { lastApiMode } from '@aegis/shared'
import type { ApiMode } from '@aegis/contract'

/**
 * 子应用的数据源模式读取。
 *
 * 唯一控制点在基座设置抽屉（appStore.prefs.apiMode），经 micro-app 数据通道
 * 下发到 lastApiMode——子应用页面上不允许再有模式开关（两处状态会打架）。
 *
 * 优先级：通道值（基座下发）> localStorage（独立运行调试兜底）> VITE_API_MODE > mock。
 * 后三级只在"直开子应用 dev 端口调试、收不到通道值"时生效，正常嵌入运行永远走第一级。
 */
const LS_KEY = 'aegis:api-mode'

/** 读取当前生效的模式 */
export function getApiMode(): ApiMode {
  if (lastApiMode.value) return lastApiMode.value
  const saved = localStorage.getItem(LS_KEY)
  if (saved === 'mock' || saved === 'real') return saved
  // import.meta.env 上不存在的 key 是 undefined，兜底 'mock'（没起后端也能演示）
  return import.meta.env.VITE_API_MODE === 'real' ? 'real' : 'mock'
}

/**
 * 覆盖本地模式（写 localStorage）。仅限独立调试时在 console 里调，无 UI 调用方——
 * 嵌入基座运行时通道值永远压过它，设了也不生效，避免误以为改了全局开关。
 */
export function setApiMode(mode: ApiMode): void {
  localStorage.setItem(LS_KEY, mode)
}
