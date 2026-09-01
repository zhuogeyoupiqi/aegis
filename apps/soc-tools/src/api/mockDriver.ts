import { randomInt } from '@aegis/shared'
import type { SendDriver, SendEventListener, SendHandle, SendTaskConfig } from './types'
import { recordMockHistory } from './history'

/**
 * mock 驱动：纯前端定时器模拟发送（需求约定：mock 保留不删）。
 *
 * 逻辑与改造前的 SyslogSender 内联实现一致——
 * 每 interval 发一条、数量 ≥ 20 随机失败一条、300ms 定时器推进统计，
 * 只是搬进了驱动层，视图不再持有任何定时器。
 */
export const mockSendDriver: SendDriver = (cfg: SendTaskConfig, onEvent: SendEventListener) => {
  return new Promise<SendHandle>((resolve) => {
    let seq = 0
    let sent = 0
    let failed = 0
    const start = Date.now()
    let timer: ReturnType<typeof setInterval> | null = null
    let statsTimer: ReturnType<typeof setInterval> | null = null
    let finished = false
    // 演示失败路径：数量 ≥ 20 时随机失败一条，让失败统计与红色行真实可见
    const failAt = cfg.count >= 20 ? randomInt(5, cfg.count - 1) : -1

    /**
     * 统一出口：停定时器后发终态事件，保证 done 最多触发一次。
     * notify=false 是 dispose 场景（视图已卸载），事件无人消费，静默收尾即可。
     * 历史留痕不受 notify 影响：对齐后端行为（真实任务不管前端在不在线都会落库）。
     */
    const finish = (status: 'DONE' | 'CANCELLED', notify: boolean) => {
      if (finished) return
      finished = true
      if (timer) clearInterval(timer)
      if (statsTimer) clearInterval(statsTimer)
      timer = null
      statsTimer = null
      recordMockHistory(cfg, status, sent, failed, Date.now() - start)
      if (!notify) return
      pushStats()
      onEvent({ kind: 'done', status, sent, failed, durationMs: Date.now() - start })
    }

    const pushStats = () => {
      const elapsedMs = Date.now() - start
      const elapsedSec = Math.max(elapsedMs / 1000, 0.001)
      onEvent({
        kind: 'stats',
        sent,
        failed,
        rate: Math.round((sent / elapsedSec) * 10) / 10,
        elapsedMs,
      })
    }

    const tick = () => {
      if (seq >= cfg.count) {
        finish('DONE', true)
        return
      }
      seq++
      const rendered = cfg.render(seq)
      const ok = seq !== failAt
      if (ok) sent++
      else failed++
      onEvent({ kind: 'line', seq, ts: Date.now(), ok, rendered })
      pushStats()
    }

    timer = setInterval(tick, cfg.intervalMs)
    statsTimer = setInterval(pushStats, 300)

    resolve({
      cancel: () => finish('CANCELLED', true),
      dispose: () => finish('CANCELLED', false),
    })
  })
}
