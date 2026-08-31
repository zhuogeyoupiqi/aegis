/**
 * 通用工具函数（纯函数，无副作用）
 */

/** HTML 转义：把用户输入/模拟数据拼进 innerHTML 前必须先转义，防注入 */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 两位补零（时间格式化用） */
export function pad(n: number): string {
  return n < 10 ? '0' + n : '' + n
}

/** 当前时刻 HH:mm:ss.SSS（日志行时间戳用） */
export function nowTime(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${('00' + d.getMilliseconds()).slice(-3)}`
}

/** 数组随机取一 */
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** [min, max] 闭区间随机整数 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** 模拟网络延迟：mock 数据统一走它，让交互手感接近真实接口 */
export function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
