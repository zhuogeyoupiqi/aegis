/**
 * syslog 发送任务的统一类型定义。
 *
 * 设计原则：视图只认识这里的事件形状，不关心背后是 mock 定时器还是真实接口——
 * mock/real 两种驱动实现同一套协议，SyslogSender 里没有任何 if (mode) 分支。
 * 类比后端的 record SyslogEvents：type 字段是判别联合的 tag。
 */

// 数据源模式统一用契约包定义（基座偏好、数据通道、子应用读取三处一个真源）
export type { ApiMode } from '@aegis/contract'

/**
 * 模板渲染产物。
 * text 是要上线（进 UDP 包）的最终报文；其余字段仅供终端展示
 * （severity 定徽标配色、srcIp 做内外网高亮）。
 * 渲染逻辑留在视图层（方案文档 §2.2.3：渲染在前端），驱动只消费结果。
 */
export interface RenderedMessage {
  text: string
  /** 事件严重度 0-10 */
  severity: number
  /** 源 IP（用于内外网着色） */
  srcIp: string
  /** true = 外网源（橙色），false = 内网源（青色） */
  srcExt: boolean
}

/** 一次发送任务的启动参数 */
export interface SendTaskConfig {
  targetIp: string
  targetPort: number
  /** 模板 key（留痕用，标记这批报文是什么格式） */
  templateKey: string
  /** 发送间隔毫秒 */
  intervalMs: number
  /** 发送条数 */
  count: number
  /** 渲染第 seq 条报文（seq 从 1 起） */
  render: (seq: number) => RenderedMessage
}

/**
 * 驱动 → 视图的四种事件（与后端 SyslogEvents 的 line/stats/done 一一对应，
 * fatal 是纯前端语义：任务创建失败或连接断开，会话终止）。
 */
export type SendDriverEvent =
  | {
      kind: 'line'
      seq: number
      /** 发送时刻的时间戳（毫秒） */
      ts: number
      ok: boolean
      error?: string
      rendered: RenderedMessage
    }
  | { kind: 'stats'; sent: number; failed: number; rate: number; elapsedMs: number }
  | {
      kind: 'done'
      status: 'DONE' | 'CANCELLED' | 'FAILED'
      sent: number
      failed: number
      durationMs: number
      error?: string
    }
  | { kind: 'fatal'; message: string }

/** 发送会话句柄：视图持有它来控制进行中的任务 */
export interface SendHandle {
  /** 请求停止（保留事件流等终态：正常点停止按钮用这个） */
  cancel: () => void
  /** 彻底关闭会话（含事件流，组件卸载时用；也会顺带取消任务） */
  dispose: () => void
}

export type SendEventListener = (ev: SendDriverEvent) => void

/** 两种驱动共同的入口签名 */
export type SendDriver = (cfg: SendTaskConfig, onEvent: SendEventListener) => Promise<SendHandle>
