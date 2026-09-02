/**
 * Syslog 发送控制逻辑。
 *
 * 职责：管理发送表单状态、启动/停止发送、实时终端日志、发送统计。
 * 模板渲染由 useSyslogTemplate 提供，本 composable 只消费 renderForDriver 回调与 templateKey。
 */

import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { lastThemeSnapshot, toast } from '@aegis/shared'
import {
  startSendTask,
  type RenderedMessage,
  type SendDriverEvent,
  type SendHandle,
} from '@/api'
import { sevLevel } from './useSyslogTemplate'

/** 前端白名单预检正则（与后端默认白名单同口径） */
export const WHITELIST_RE = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

/** 传输协议选项：UDP 可用，TCP/TLS 二期开放 */
export const PROTOCOL_OPTIONS = [{ label: 'UDP', value: 'UDP' }]

export interface LogLine {
  seq: number
  ts: string
  fail: boolean
  sevCls: string
  sevKey: 'critical' | 'high' | 'medium' | 'low'
  sevNum: number
  html: string
}

export function useSyslogSender(
  templateKey: { value: string },
  renderForDriver: (seq: number) => RenderedMessage,
) {
  const { t } = useI18n()
  // toast 实例由 SyslogSender.vue 统一绑定（bindFeedback 只应调用一次）

  /* ---------- 表单状态 ---------- */
  const targetIp = ref('10.12.33.45')
  const targetPort = ref(514)
  const sendCount = ref(50)
  const sendInterval = ref(200)

  const whitelistOk = computed(() => WHITELIST_RE.test(targetIp.value.trim()))

  /* ---------- 发送状态 ---------- */
  const sending = ref(false)
  const sent = ref(0)
  const failed = ref(0)
  const total = ref(0)
  const elapsed = ref(0)
  const rate = ref(0)
  const autoScroll = ref(true)
  let sendHandle: SendHandle | null = null

  const logs = ref<LogLine[]>([])

  const progressPct = computed(() =>
    total.value ? Math.min(((sent.value + failed.value) / total.value) * 100, 100) : 0,
  )

  /** 进度条渐变跟随基座下发的主题快照（未收到数据前用品牌紫兜底） */
  const gradColors = computed(() => ({
    from: lastThemeSnapshot.value?.gradFrom ?? '#7c3aed',
    to: lastThemeSnapshot.value?.gradTo ?? '#c026d3',
  }))

  /* ---------- 终端日志 ---------- */
  function appendLine(r: RenderedMessage, seq: number, isFail: boolean, ts: number): void {
    const lv = sevLevel(r.severity)
    const html = escapeHtml(r.text).replace(
      r.srcIp,
      `<span class="ip-${r.srcExt ? 'ext' : 'int'}">${r.srcIp}</span>`,
    )
    logs.value.push({
      seq,
      ts: formatTime(new Date(ts)),
      fail: isFail,
      sevCls: lv.cls,
      sevKey: lv.key,
      sevNum: r.severity,
      html,
    })
    // 行数上限 600：长任务防内存膨胀
    if (logs.value.length > 600) logs.value.splice(0, logs.value.length - 600)
  }

  function formatTime(d: Date): string {
    const pad2 = (n: number) => (n < 10 ? '0' + n : '' + n)
    const ms = ('00' + d.getMilliseconds()).slice(-3)
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${ms}`
  }

  function clearLogs(): void {
    logs.value = []
  }

  /* ---------- 驱动事件处理 ---------- */
  function onDriverEvent(ev: SendDriverEvent): void {
    switch (ev.kind) {
      case 'line':
        if (ev.ok) sent.value++
        else failed.value++
        appendLine(ev.rendered, ev.seq, !ev.ok, ev.ts)
        break
      case 'stats':
        // stats 携带绝对值直接覆盖，与 line 分支的自增不会叠加出偏差
        sent.value = ev.sent
        failed.value = ev.failed
        rate.value = ev.rate
        elapsed.value = ev.elapsedMs / 1000
        break
      case 'done':
        sendHandle = null
        sending.value = false
        if (ev.status === 'DONE') {
          toast(
            t('syslog.doneToast', {
              total: ev.sent + ev.failed,
              failed: ev.failed,
              rate: rate.value.toFixed(1),
            }),
          )
        } else if (ev.status === 'FAILED') {
          toast(ev.error ?? t('syslog.taskFailed'), 'bad')
        }
        break
      case 'fatal':
        sendHandle = null
        sending.value = false
        toast(ev.message, 'bad')
        break
    }
  }

  /* ---------- 启停发送 ---------- */
  async function toggleSend(): Promise<void> {
    if (sending.value) {
      sendHandle?.cancel()
      toast(t('syslog.stopped'), 'info')
      return
    }
    if (!whitelistOk.value) {
      toast(t('syslog.wlBlocked'), 'bad')
      return
    }
    // 2000 是后端单任务上限（DTO @Size 校验），前端先收紧避免白跑一趟
    total.value = Math.min(2000, Math.max(1, Math.floor(sendCount.value) || 50))
    const interval = Math.max(50, Math.floor(sendInterval.value) || 200)
    sent.value = 0
    failed.value = 0
    elapsed.value = 0
    rate.value = 0
    sending.value = true
    try {
      sendHandle = await startSendTask(
        {
          targetIp: targetIp.value.trim(),
          targetPort: targetPort.value,
          templateKey: templateKey.value,
          intervalMs: interval,
          count: total.value,
          render: renderForDriver,
        },
        onDriverEvent,
      )
    } catch (err) {
      sending.value = false
      toast(err instanceof Error ? err.message : String(err), 'bad')
    }
  }

  // 组件卸载必须停会话：微前端下子应用会被频繁销毁重建
  onUnmounted(() => {
    sendHandle?.dispose()
    sendHandle = null
  })

  return {
    targetIp,
    targetPort,
    sendCount,
    sendInterval,
    whitelistOk,
    sending,
    sent,
    failed,
    total,
    elapsed,
    rate,
    autoScroll,
    logs,
    progressPct,
    gradColors,
    clearLogs,
    toggleSend,
  }
}

/** HTML 转义（避免直接 import @aegis/shared 循环依赖，这里内联一份） */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
