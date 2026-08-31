import { message as staticMessage } from 'ant-design-vue'
import type { MessageInstance } from 'ant-design-vue/es/message/interface'

/**
 * 全局轻提示的统一出口。
 *
 * 为什么不直接在业务代码里 import { message }：
 * antd 的静态 message 拿不到 ConfigProvider 的主题上下文（暗色模式下会渲染成白底），
 * 必须用 <a-app> 里 App.useApp() 拿到的实例。但该实例只能在组件 setup 里获取，
 * store / 工具函数拿不到——所以用「绑定」模式：App.vue 树内组件启动时把
 * 上下文实例接进来，这里统一转发；绑定完成前退回静态实例兜底。
 */
let instance: MessageInstance = staticMessage as unknown as MessageInstance

/** 在 <a-app> 内的组件 setup 里调用，接入带主题上下文的 message 实例 */
export function bindFeedback(m: MessageInstance): void {
  instance = m
}

/** 全局 toast：ok=成功 / bad=错误 / info=中性提示，语义沿用自研版 */
export function toast(text: string, type: 'ok' | 'bad' | 'info' = 'ok'): void {
  if (type === 'bad') instance.error(text)
  else if (type === 'info') instance.info(text)
  else instance.success(text)
}
