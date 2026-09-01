import type { ApiMode } from './types'

/**
 * 数据源模式的唯一控制点（需求约定：一个地方控制走真实接口还是 mock）。
 *
 * 优先级：localStorage 覆盖 > 构建期 VITE_API_MODE > 默认 mock。
 * localStorage 存在的意义：不改代码就能在页面上切换并保持（改 .env 要重启 dev server）。
 */
const LS_KEY = 'aegis:api-mode'

/** 读取当前生效的模式 */
export function getApiMode(): ApiMode {
  const saved = localStorage.getItem(LS_KEY)
  if (saved === 'mock' || saved === 'real') return saved
  // import.meta.env 上不存在的 key 是 undefined，兜底 'mock'（没起后端也能演示）
  return import.meta.env.VITE_API_MODE === 'real' ? 'real' : 'mock'
}

/** 切换并持久化模式（只影响下一次启动的发送任务，进行中的任务不打断） */
export function setApiMode(mode: ApiMode): void {
  localStorage.setItem(LS_KEY, mode)
}
