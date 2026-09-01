import { request } from './http'
import type { RenderedMessage, SendDriver, SendEventListener, SendHandle, SendTaskConfig } from './types'

/**
 * real 驱动：POST 创建任务 → EventSource 订阅 SSE 事件流。
 *
 * 协议对应后端 SyslogTaskController：
 * - POST /api/syslog/tasks           → Result<{ taskId }>
 * - GET  /api/syslog/tasks/{id}/events → SSE（line / stats / done 三种事件，data 为 JSON）
 * - POST /api/syslog/tasks/{id}/cancel
 *
 * 渲染在前端完成后整批上送（方案文档 §2.2.3：后端不做模板渲染），
 * 后端是纯字节泵：收到的 payloads 原样进 UDP 包，终端展示 = 线上内容。
 */
export const realSendDriver: SendDriver = async (cfg: SendTaskConfig, onEvent: SendEventListener) => {
  // 先整批渲染：seq 与数组下标一一对应（rendered[i] 即第 i+1 条），line 事件按 seq 回查
  const rendered: RenderedMessage[] = []
  for (let seq = 1; seq <= cfg.count; seq++) {
    rendered.push(cfg.render(seq))
  }

  // 创建任务。失败（白名单拦截/参数校验/后端未启动）直接抛给视图转 toast。
  // taskId 后端已序列化为字符串：19 位雪花 ID 超过 JS 安全整数（2^53-1），
  // 若按 number 解析会静默丢精度，拿错值订阅 SSE 必然断流——只能当 string 用
  const { taskId } = await request<{ taskId: string }>('/syslog/tasks', {
    method: 'POST',
    body: JSON.stringify({
      targetIp: cfg.targetIp,
      targetPort: cfg.targetPort,
      templateKey: cfg.templateKey,
      intervalMs: cfg.intervalMs,
      payloads: rendered.map((r) => r.text),
    }),
  })

  // 订阅事件流。EventSource 只支持 GET（够用：订阅就是 GET），
  // 经 vite proxy 转发，SSE 分块响应在 http-proxy 下正常透传
  const es = new EventSource(`/api/syslog/tasks/${taskId}/events`)
  let closed = false

  const close = () => {
    if (closed) return
    closed = true
    es.close()
  }

  es.onmessage = (e) => {
    // 后端 SseEmitter.send(对象) 序列化为 JSON，type 字段做判别（line/stats/done）
    const ev = JSON.parse(e.data) as
      | { type: 'line'; seq: number; ok: boolean; error?: string; ts: number }
      | { type: 'stats'; sent: number; failed: number; rate: number; elapsedMs: number }
      | { type: 'done'; status: string; sent: number; failed: number; durationMs: number; error?: string }

    switch (ev.type) {
      case 'line':
        onEvent({
          kind: 'line',
          seq: ev.seq,
          ts: ev.ts,
          ok: ev.ok,
          error: ev.error ?? undefined,
          rendered: rendered[(ev.seq - 1) % rendered.length],
        })
        break
      case 'stats':
        onEvent({ kind: 'stats', sent: ev.sent, failed: ev.failed, rate: ev.rate, elapsedMs: ev.elapsedMs })
        break
      case 'done':
        close()
        onEvent({
          kind: 'done',
          status: ev.status as 'DONE' | 'CANCELLED' | 'FAILED',
          sent: ev.sent,
          failed: ev.failed,
          durationMs: ev.durationMs,
          error: ev.error ?? undefined,
        })
        break
    }
  }

  // 连接层异常（代理断开/后端重启）：done 尚未到达就是意外终止
  es.onerror = () => {
    if (!closed) {
      close()
      onEvent({ kind: 'fatal', message: '事件流连接中断，任务结果请稍后在历史记录中查看' })
    }
  }

  return {
    cancel: () => {
      // 只打取消标记，不关流：终态仍由 done 事件带回（含最终统计）
      request('/syslog/tasks/' + taskId + '/cancel', { method: 'POST' }).catch(() => {
        // 取消请求失败不致命：任务本身会发完自然结束，留痕不受影响
      })
    },
    dispose: () => {
      close()
      request('/syslog/tasks/' + taskId + '/cancel', { method: 'POST' }).catch(() => {})
    },
  }
}
