<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { App } from 'ant-design-vue'
import { bindFeedback, escapeHtml, lastThemeSnapshot, nowTime, pad, pick, randomInt, toast } from '@aegis/shared'
import {
  clearHistoryTasks,
  deleteHistoryTask,
  deletePreset,
  getApiMode,
  listHistory,
  listPresets,
  savePreset,
  setApiMode,
  startSendTask,
  type ApiMode,
  type RenderedMessage,
  type SendDriverEvent,
  type SendHandle,
  type SendPreset,
  type TaskHistoryItem,
} from '@/api'
import AppIcon from '@/components/AppIcon.vue'

/* ============================================================
   Syslog 发包器 —— SOC 工具集第 1 个真实工具
   传输已抽到 @/api（mock / real 双驱动，页头开关一键切换）：
   - mock：前端定时器模拟发送（保留，不依赖后端）
   - real：POST 建任务 → 后端 DatagramSocket 直发 → SSE 实时回传
   本页只负责：表单、模板渲染（渲染在前端）、终端展示与统计。
   ============================================================ */

const { t } = useI18n()

// 接入 <a-app> 上下文：toast 与确认弹窗（modal.confirm）都要吃当前主题（暗色不闪白底）
const { message: antdMessage, modal } = App.useApp()
bindFeedback(antdMessage)

/* ---------- 数据源模式（mock / real 一处切换，localStorage 持久化） ---------- */
const apiMode = ref<ApiMode>(getApiMode())
/** 开关选项用 computed：语言切换时标签跟着变 */
const MODE_OPTIONS = computed(() => [
  { label: t('syslog.sourceMock'), value: 'mock' },
  { label: t('syslog.sourceReal'), value: 'real' },
])
/** 切模式只持久化，不打断进行中的任务（下一次「开始发送」才生效） */
function onModeChange(v: string | number): void {
  apiMode.value = v as ApiMode
  setApiMode(v as ApiMode)
}

/* ---------- 模板与样本数据（贴近真实 SOC 场景） ---------- */
const TEMPLATES: Record<string, string> = {
  CEF: 'CEF:0|Security|Aegis-Test|1.0|${event_id}|${event_name}|${severity}|src=${random_ip} dst=192.168.1.20 suser=${user} dhost=WEB-01 msg=Triggered by Aegis sender seq=${seq}',
  LEEF: 'LEEF:1.0|Aegis|ThreatSensor|2.1|${event_id}|src=${random_ip} dst=192.168.1.20 sev=${severity} usrName=${user} msg=${event_name}',
  JSON: '{"facility":"auth","severity":${severity},"event_id":"${event_id}","name":"${event_name}","src":"${random_ip}","dst":"192.168.1.20","user":"${user}","ts":"${timestamp}"}',
  KV: 'time=${timestamp} event_id=${event_id} name=${event_name} sev=${severity} src=${random_ip} dst=192.168.1.20 user=${user} action=deny',
}
/** 模板选择器的选项（KV 对外展示为 Key-Value） */
const TPL_OPTIONS = [
  { label: 'CEF', value: 'CEF' },
  { label: 'LEEF', value: 'LEEF' },
  { label: 'JSON', value: 'JSON' },
  { label: 'Key-Value', value: 'KV' },
]

/** 事件池：模拟 SIEM 常见告警类型（名称 + severity 0-10） */
const EVENT_POOL = [
  { id: '1001', name: 'Brute Force Login Attempt', sev: 8 },
  { id: '1002', name: 'Port Scan Detected', sev: 6 },
  { id: '1003', name: 'Malware Hash Match', sev: 9 },
  { id: '1004', name: 'Privilege Escalation Attempt', sev: 9 },
  { id: '1005', name: 'Data Exfiltration Suspected', sev: 8 },
  { id: '1006', name: 'Suspicious DNS Query', sev: 5 },
  { id: '1007', name: 'Login Outside Business Hours', sev: 4 },
  { id: '1008', name: 'Webshell Upload Detected', sev: 9 },
] as const

const USER_POOL = ['admin', 'root', 'svc_backup', 'zhang.wei', 'oracle', 'gitlab-runner', 'jenkins'] as const
/** 内外网源 IP 池：内网青色、外网橙色（终端内视觉区分） */
const IP_INT_POOL = ['10.12.33.', '10.20.8.', '172.16.4.', '192.168.10.'] as const
const IP_EXT_POOL = ['45.132.88.', '103.44.7.', '185.220.101.', '91.240.118.'] as const

const VAR_CHIPS = ['${timestamp}', '${seq}', '${random_ip}', '${user}', '${event_id}', '${event_name}', '${severity}']

/* ---------- 表单状态 ---------- */
const targetIp = ref('10.12.33.45')
const targetPort = ref(514) // 协议固定 UDP（TCP/TLS 二期支持）
const sendCount = ref(50)
const sendInterval = ref(200)
const loopback = ref(true) // 预留后端参数：本地 5140 收自己发的包自证格式
const randomize = ref(true) // 关闭后使用固定样本，便于复现问题
const currentTpl = ref('CEF')
const tplText = ref(TEMPLATES.CEF)

/**
 * 白名单前端预检：与后端默认白名单（sys_config 的 syslog.whitelist）保持同口径——
 * RFC1918 三个私有段 + 回环段。前端拦的是体验（立即红字），真正的强制约束在后端；
 * 两边口径不一致会造成"前端放行后端拦"或反之的困惑。
 */
const WHITELIST_RE = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/
const whitelistOk = computed(() => WHITELIST_RE.test(targetIp.value.trim()))

/** 传输协议选项：UDP 可用，TCP/TLS 二期开放（a-segmented 的 disabled 项） */
const PROTOCOL_OPTIONS = [
  { label: 'UDP', value: 'UDP' },
  { label: 'TCP', value: 'TCP', disabled: true },
  { label: 'TLS', value: 'TLS', disabled: true },
]

/* ---------- 发送状态 ---------- */
const sending = ref(false)
const sent = ref(0)
const failed = ref(0)
const total = ref(0)
const elapsed = ref(0)
const rate = ref(0)
const autoScroll = ref(true)
/** 进行中任务的句柄（驱动层提供 cancel/dispose，本页不碰定时器） */
let sendHandle: SendHandle | null = null

/** 单条终端日志（msg 为转义 + IP 高亮后的 HTML 片段） */
interface LogLine {
  seq: number
  ts: string
  fail: boolean
  /** 徽标配色类名（lv-critical 等）与词条 key 同源，语言切换后文案在模板里现查 */
  sevCls: string
  sevKey: 'critical' | 'high' | 'medium' | 'low'
  sevNum: number
  html: string
}
const logs = ref<LogLine[]>([])
const termBody = ref<HTMLElement | null>(null)

/**
 * a-textarea 换回原生 textarea 后这里就是原生元素类型：
 * 插入变量需要读写光标位置（selectionStart/End/setSelectionRange），
 * antd 组件实例没有直接暴露这些，原生元素最直接。
 */
const tplArea = ref<HTMLTextAreaElement | null>(null)

const progressPct = computed(() =>
  total.value ? Math.min(((sent.value + failed.value) / total.value) * 100, 100) : 0,
)

/** 进度条渐变跟随基座下发的主题快照（未收到数据前用品牌紫兜底） */
const gradColors = computed(() => ({
  from: lastThemeSnapshot.value?.gradFrom ?? '#7c3aed',
  to: lastThemeSnapshot.value?.gradTo ?? '#c026d3',
}))

/* ---------- 渲染逻辑 ---------- */
/** 随机生成源 IP：三成概率外网，贴近真实攻击来源分布 */
function randomIp(): { ip: string; ext: boolean } {
  // 三成概率外网源，贴近真实攻击来源分布
  const ext = Math.random() < 0.3
  const base = ext ? pick(IP_EXT_POOL) : pick(IP_INT_POOL)
  return { ip: base + randomInt(2, 254), ext }
}

/**
 * severity(0-10) → 语义等级。
 * 只返回配色类名与词条 key，中/英等级名由语言包提供（模板里现查），
 * 切语言时历史日志行的徽标文案也能跟着变。
 */
function sevLevel(s: number): { cls: string; key: LogLine['sevKey'] } {
  if (s >= 9) return { cls: 'lv-critical', key: 'critical' }
  if (s >= 7) return { cls: 'lv-high', key: 'high' }
  if (s >= 4) return { cls: 'lv-medium', key: 'medium' }
  return { cls: 'lv-low', key: 'low' }
}

interface RenderResult {
  text: string
  evt: (typeof EVENT_POOL)[number]
  src: { ip: string; ext: boolean }
  user: string
}

/** 渲染模板：把 ${var} 占位符替换为样本值；随机化关闭时用固定样本 */
function renderTemplate(tpl: string, seq: number): RenderResult {
  const evt = randomize.value ? pick(EVENT_POOL) : EVENT_POOL[0]
  const src = randomize.value ? randomIp() : { ip: '10.12.33.45', ext: false }
  const user = randomize.value ? pick(USER_POOL) : 'admin'
  const d = new Date()
  const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${nowTime()}+08:00`
  const text = tpl
    .replace(/\$\{timestamp\}/g, ts)
    .replace(/\$\{seq\}/g, String(seq))
    .replace(/\$\{random_ip\}/g, src.ip)
    .replace(/\$\{user\}/g, user)
    .replace(/\$\{event_id\}/g, evt.id)
    .replace(/\$\{event_name\}/g, evt.name)
    .replace(/\$\{severity\}/g, String(evt.sev))
  return { text, evt, src, user }
}

/** 渲染预览：变量值高亮（紫 = 普通变量，橙 = IP）。依赖 tplText 变化时重算一次 */
const previewHtml = computed(() => {
  const r = renderTemplate(tplText.value, 1)
  const html = escapeHtml(r.text)
    .replace(r.src.ip, `<span class="hl-ip">${r.src.ip}</span>`)
    .replace(r.evt.name, `<span class="hl">${r.evt.name}</span>`)
    .replace(r.user, `<span class="hl">${r.user}</span>`)
  return `<span class="pv-label">${t('syslog.previewLabel')}</span><br>${html}`
})

/** 切换预设模板：把选中模板的原始文本灌进编辑框（用户可再改） */
function onTplChange(key: string | number): void {
  currentTpl.value = String(key)
  tplText.value = TEMPLATES[currentTpl.value] ?? tplText.value
}

/** 点击变量 chip 插入到模板光标处 */
function insertVar(v: string): void {
  const area = tplArea.value
  if (!area) return
  const pos = area.selectionStart ?? area.value.length
  area.value = area.value.slice(0, pos) + v + area.value.slice(area.selectionEnd ?? pos)
  tplText.value = area.value
  area.focus()
  area.setSelectionRange(pos + v.length, pos + v.length)
  toast(t('syslog.insertedVar', { var: v }), 'info')
}

/* ---------- 发送（mock / real 双模式，逻辑在 @/api 驱动层） ---------- */
/** 把一次发送结果追加进终端：转义 + IP 高亮 + 行数上限 + 自动滚动 */
function appendLine(r: RenderedMessage, seq: number, isFail: boolean, ts: number): void {
  const lv = sevLevel(r.severity)
  const html = escapeHtml(r.text).replace(
    r.srcIp,
    `<span class="ip-${r.srcExt ? 'ext' : 'int'}">${r.srcIp}</span>`,
  )
  logs.value.push({
    seq,
    ts: nowTime(new Date(ts)),
    fail: isFail,
    sevCls: lv.cls,
    sevKey: lv.key,
    sevNum: r.severity,
    html,
  })
  // 行数上限 600：长任务防内存膨胀（mock/real 同一上限）
  if (logs.value.length > 600) logs.value.splice(0, logs.value.length - 600)
  if (autoScroll.value) {
    nextTick(() => {
      if (termBody.value) termBody.value.scrollTop = termBody.value.scrollHeight
    })
  }
}

/** 驱动事件的统一分发：视图对 mock/real 的全部差异都被这一层抹平 */
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
        // CANCELLED 的提示在点击停止按钮时已发过，这里不重复
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

/** 驱动层的渲染回调：模板渲染在本页（渲染在前端），映射成驱动约定的形状 */
function renderForDriver(seq: number): RenderedMessage {
  const r = renderTemplate(tplText.value, seq)
  return { text: r.text, severity: r.evt.sev, srcIp: r.src.ip, srcExt: r.src.ext }
}

/** 启停发送的总入口：停止 / 白名单拦截 / 组装参数交给驱动层 */
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
        templateKey: currentTpl.value,
        intervalMs: interval,
        count: total.value,
        render: renderForDriver,
      },
      onDriverEvent,
    )
  } catch (err) {
    // 创建失败（白名单被后端拦 / 后端未启动）：恢复空闲态并给出可读原因
    sending.value = false
    toast(err instanceof Error ? err.message : String(err), 'bad')
  }
}

/** 清空终端日志（不影响统计数字） */
function clearLogs(): void {
  logs.value = []
}

// 组件卸载必须停会话：微前端下子应用会被频繁销毁重建
// dispose 连事件流一起关（cancel 还会等 done 事件，卸载后没人消费）
onUnmounted(() => {
  sendHandle?.dispose()
  sendHandle = null
})

/* ============================================================
   保存任务（配置预设）+ 发送历史
   两个入口共用 @/api/history 的读写层：
   - 保存：当前表单整体存一条预设（real=soc_send_preset 表，mock=localStorage）
   - 历史：real 读后端留痕表（soc_send_task），mock 读本地记录
   载入/复现只是把字段回填进表单，不直接触发发送——回填后人工点「开始发送」，
   与"保存的是配置不是任务"的语义一致。
   ============================================================ */

/* ---------- 保存预设弹窗 ---------- */
const saveOpen = ref(false)
const presetName = ref('')
const savingPreset = ref(false)

/** 弹窗里实时预览将要保存的配置摘要，让用户在点确定前就能核对内容 */
const presetSummaryPreview = computed(
  () =>
    `${targetIp.value.trim()}:${targetPort.value} · ${currentTpl.value} · ×${sendCount.value} · ${sendInterval.value}ms · ${randomize.value ? 'rand' : 'fixed'}`,
)

/** 打开保存弹窗：默认名概括核心参数，多数场景不用改直接存 */
function openSaveModal(): void {
  presetName.value = `${currentTpl.value} → ${targetIp.value}:${targetPort.value} × ${sendCount.value}`
  saveOpen.value = true
}

/** 确认保存：空名由确定按钮禁用兜底，这里只做提交与异常提示 */
async function confirmSavePreset(): Promise<void> {
  const name = presetName.value.trim()
  if (!name) return
  savingPreset.value = true
  try {
    await savePreset({
      name,
      targetIp: targetIp.value.trim(),
      targetPort: targetPort.value,
      templateKey: currentTpl.value,
      templateContent: tplText.value,
      count: Math.max(1, Math.floor(sendCount.value) || 50),
      intervalMs: Math.max(50, Math.floor(sendInterval.value) || 200),
      randomize: randomize.value,
    })
    toast(t('syslog.presetSaved', { name }))
    saveOpen.value = false
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), 'bad')
  } finally {
    savingPreset.value = false
  }
}

/* ---------- 历史抽屉 ---------- */
const histOpen = ref(false)
const histTab = ref('history')
const historyLoading = ref(false)
const presetLoading = ref(false)
const historyList = ref<TaskHistoryItem[]>([])
const presetList = ref<SendPreset[]>([])

/** 历史表列定义用 computed：语言切换时表头文案跟着变 */
const histColumns = computed(() => [
  { title: t('syslog.colTime'), key: 'createTime', width: 140 },
  { title: t('syslog.colTarget'), key: 'target', width: 150 },
  { title: t('syslog.colTpl'), dataIndex: 'templateKey', width: 70 },
  { title: t('syslog.colCount'), key: 'count', width: 110 },
  { title: t('syslog.colStatus'), key: 'status', width: 86 },
  { title: t('syslog.colDuration'), key: 'duration', width: 76 },
  { title: t('syslog.colAction'), key: 'action', width: 110 },
])
const presetColumns = computed(() => [
  { title: t('syslog.colName'), dataIndex: 'name', key: 'name', width: 180 },
  { title: t('syslog.colSummary'), key: 'summary' },
  { title: t('syslog.colAction'), key: 'action', width: 116 },
])

/** 状态 → a-tag 颜色（未知值兜底 default，后端加新状态也不至于渲染崩） */
function statusColor(s: string): string {
  return (
    {
      DONE: 'success',
      FAILED: 'error',
      CANCELLED: 'default',
      RUNNING: 'processing',
    } as Record<string, string>
  )[s] ?? 'default'
}

/** 状态 → 词条 key（动态 key 与终端 sev 徽标同一套路） */
function statusLabel(s: string): string {
  const map: Record<string, string> = {
    DONE: 'stDone',
    FAILED: 'stFailed',
    CANCELLED: 'stCancelled',
    RUNNING: 'stRunning',
  }
  return t(`syslog.${map[s] ?? 'stRunning'}`)
}

/** ISO 时间转可读格式（2026-09-01T10:20:30 → 2026-09-01 10:20:30） */
function fmtTime(iso?: string | null): string {
  return iso ? iso.replace('T', ' ').slice(0, 19) : '—'
}

/** 毫秒时长自适应单位：短任务看 ms 更直观，长任务看秒 */
function fmtDuration(ms?: number | null): string {
  if (ms == null) return '—'
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

/** 预设摘要：一行说清"发到哪、什么格式、多少条、什么节奏" */
function presetSummary(p: SendPreset): string {
  return `${p.targetIp}:${p.targetPort} · ${p.templateKey} · ×${p.count} · ${p.intervalMs}ms`
}

/** 打开抽屉即拉两份数据：历史和预设一起加载，切 tab 不再等待 */
async function openHistory(): Promise<void> {
  histOpen.value = true
  await Promise.all([loadHistory(), loadPresets()])
}

async function loadHistory(): Promise<void> {
  historyLoading.value = true
  try {
    historyList.value = await listHistory()
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), 'bad')
  } finally {
    historyLoading.value = false
  }
}

async function loadPresets(): Promise<void> {
  presetLoading.value = true
  try {
    presetList.value = await listPresets()
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), 'bad')
  } finally {
    presetLoading.value = false
  }
}

/** 发送进行中禁止回填：改表单会影响当前任务的渲染上下文，先停再载入 */
function guardLoading(): boolean {
  if (!sending.value) return false
  toast(t('syslog.loadBlockedSending'), 'bad')
  return true
}

/** 删除单条历史：后端逻辑删除（列表消失、底账保留），确认文案里把这点说清楚 */
function removeHistoryTask(item: TaskHistoryItem): void {
  modal.confirm({
    title: t('syslog.confirmDeleteTask'),
    content: `${item.targetIp}:${item.targetPort} · ×${item.totalCount} · ${fmtTime(item.createTime)}`,
    okText: t('syslog.actionDelete'),
    okButtonProps: { danger: true },
    cancelText: t('syslog.actionCancel'),
    onOk: async () => {
      try {
        await deleteHistoryTask(item.id)
        await loadHistory()
        toast(t('syslog.taskDeleted'))
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err), 'bad')
      }
    },
  })
}

/** 一键清空终态任务：影响面大（全量），确认文案比单条删除更重 */
function clearFinishedHistory(): void {
  modal.confirm({
    title: t('syslog.confirmClearHistory'),
    okText: t('syslog.actionDelete'),
    okButtonProps: { danger: true },
    cancelText: t('syslog.actionCancel'),
    onOk: async () => {
      try {
        const n = await clearHistoryTasks()
        await loadHistory()
        toast(t('syslog.historyCleared', { n }))
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err), 'bad')
      }
    },
  })
}

/** 复现历史任务：把当时的目标/数量/间隔回填表单（模板只留了 key，回退到内置骨架） */
function applyHistory(item: TaskHistoryItem): void {
  if (guardLoading()) return
  targetIp.value = item.targetIp
  targetPort.value = item.targetPort
  sendCount.value = item.totalCount
  sendInterval.value = item.intervalMs
  if (TEMPLATES[item.templateKey]) {
    currentTpl.value = item.templateKey
    tplText.value = TEMPLATES[item.templateKey]
  }
  histOpen.value = false
  toast(t('syslog.configLoaded'))
}

/** 载入预设：字段齐全（含模板全文与随机化开关），比历史复现保真 */
function applyPreset(p: SendPreset): void {
  if (guardLoading()) return
  targetIp.value = p.targetIp
  targetPort.value = p.targetPort
  sendCount.value = p.count
  sendInterval.value = p.intervalMs
  randomize.value = p.randomize
  currentTpl.value = p.templateKey
  tplText.value = p.templateContent
  histOpen.value = false
  toast(t('syslog.configLoaded'))
}

/** 删除预设：二次确认（不可恢复的操作，危险按钮样式） */
function removePreset(p: SendPreset): void {
  modal.confirm({
    title: t('syslog.confirmDeletePreset', { name: p.name }),
    okText: t('syslog.actionDelete'),
    okButtonProps: { danger: true },
    cancelText: t('syslog.actionCancel'),
    onOk: async () => {
      try {
        await deletePreset(p.id)
        await loadPresets()
        toast(t('syslog.presetDeleted'))
      } catch (err) {
        // 不向上抛：确认框正常关闭，错误用 toast 呈现，用户可直接重试
        toast(err instanceof Error ? err.message : String(err), 'bad')
      }
    },
  })
}
</script>

<template>
  <div class="page">
    <!-- 页头 -->
    <div class="page-header">
      <div>
        <h1>
          {{ t('syslog.title') }}
          <span class="pbadge pbadge--ok"><span class="dot" />{{ t('syslog.mvpBadge') }}</span>
        </h1>
        <p class="desc">{{ t('syslog.desc') }}</p>
        <div class="page-badges">
          <span class="pbadge pbadge--ok"><span class="dot" />{{ t('syslog.wlBadge') }}</span>
          <span class="pbadge">{{ t('syslog.auditBadge') }}</span>
        </div>
      </div>
      <div class="page-header-actions">
        <!-- 数据源开关：mock/real 的唯一控制点，选择持久化在 localStorage -->
        <a-segmented
          :value="apiMode"
          :options="MODE_OPTIONS"
          size="small"
          @change="onModeChange"
        />
        <a-button @click="openSaveModal">
          <template #icon><AppIcon name="save" :size="13" /></template>
          {{ t('syslog.saveTask') }}
        </a-button>
        <a-button @click="openHistory">
          <template #icon><AppIcon name="clock" :size="13" /></template>
          {{ t('syslog.history') }}
        </a-button>
      </div>
    </div>

    <div class="content-grid">
      <!-- ===== 发送配置 ===== -->
      <section class="panel panel--config">
        <div class="panel-head">
          <AppIcon name="sliders" :size="15" />
          <h2>{{ t('syslog.configTitle') }}</h2>
          <span class="sub">{{ t('syslog.configSub') }}</span>
        </div>
        <div class="panel-body">
          <div class="field">
            <label>{{ t('syslog.targetLabel') }}</label>
            <div class="ip-row">
              <a-input v-model:value="targetIp" class="ip-row__ip" spellcheck="false" />
              <a-input-number
                v-model:value="targetPort"
                class="ip-row__port"
                :min="1"
                :max="65535"
                :controls="false"
              />
            </div>
            <p class="field-hint" :class="whitelistOk ? 'ok' : 'bad'">
              <template v-if="whitelistOk">
                <AppIcon name="check" :size="11" /> {{ t('syslog.wlOk') }}
              </template>
              <template v-else>
                <AppIcon name="xCircle" :size="11" /> {{ t('syslog.wlBad') }}
              </template>
            </p>
          </div>

          <div class="field">
            <label>{{ t('syslog.protocolLabel') }}</label>
            <a-segmented :value="'UDP'" :options="PROTOCOL_OPTIONS" />
            <p class="field-hint">{{ t('syslog.protocolHint') }}</p>
          </div>

          <div class="field">
            <label>{{ t('syslog.countLabel') }}</label>
            <div class="ip-row">
              <a-input-number v-model:value="sendCount" class="ip-row__num" :min="1" :max="2000" />
              <a-input-number
                v-model:value="sendInterval"
                class="ip-row__num"
                :min="50"
                :step="50"
                addon-after="ms"
              />
            </div>
            <p class="field-hint">{{ t('syslog.countHint') }}</p>
          </div>

          <div class="switch-row">
            <div class="info">
              <b>{{ t('syslog.loopbackTitle') }}</b>
              <span>{{ t('syslog.loopbackHint') }}</span>
            </div>
            <a-switch v-model:checked="loopback" size="small" />
          </div>
          <div class="switch-row">
            <div class="info">
              <b>{{ t('syslog.randomizeTitle') }}</b>
              <span>{{ t('syslog.randomizeHint') }}</span>
            </div>
            <a-switch v-model:checked="randomize" size="small" />
          </div>

          <div class="send-area">
            <a-button
              block
              :type="sending ? 'default' : 'primary'"
              :danger="sending"
              @click="toggleSend"
            >
              <template #icon><AppIcon name="send" :size="14" /></template>
              {{ sending ? t('syslog.stop') : t('syslog.start') }}
            </a-button>
            <a-progress
              class="send-progress"
              :percent="progressPct"
              :show-info="false"
              :stroke-color="gradColors"
              size="small"
            />
          </div>
        </div>
      </section>

      <!-- ===== 消息模板 ===== -->
      <section class="panel panel--template">
        <div class="panel-head">
          <AppIcon name="terminal" :size="15" />
          <h2>{{ t('syslog.tplTitle') }}</h2>
          <span class="sub">{{ t('syslog.tplSub') }}</span>
          <div class="right">
            <a-button size="small" @click="toast(t('syslog.aiToast'), 'info')">
              <template #icon><AppIcon name="sparkles" :size="12" /></template>
              {{ t('syslog.aiGen') }}
            </a-button>
          </div>
        </div>
        <div class="panel-body">
          <div class="field">
            <a-segmented v-model:value="currentTpl" :options="TPL_OPTIONS" @change="onTplChange" />
          </div>

          <!--
            模板编辑用原生 textarea 而非 a-textarea：
            等宽字体 / 行高 / 焦点环是强定制需求，antd 的 CSS-in-JS 样式在运行时
            注入头部、优先级高于打包样式，覆盖要处处提权，不如原生元素干净。
            光标插入逻辑也直接依赖原生 selectionStart/End。
          -->
          <textarea ref="tplArea" v-model="tplText" class="code-area" spellcheck="false" />

          <div class="var-section">
            <p class="var-title">{{ t('syslog.varHint') }}</p>
            <div class="var-chips">
              <button v-for="v in VAR_CHIPS" :key="v" class="var-chip" @click="insertVar(v)">{{ v }}</button>
            </div>
          </div>

          <div class="render-preview" v-html="previewHtml" />
        </div>
      </section>

      <!-- ===== 实时日志终端（恒定深色，不随主题切换） ===== -->
      <section class="panel panel--terminal">
        <div class="panel-head">
          <span class="term-status" :class="{ running: sending }">
            <span class="dot" />{{ sending ? t('syslog.stSending') : t('syslog.stIdle') }}
          </span>
          <h2>{{ t('syslog.termTitle') }}</h2>
          <div class="right">
            <div class="term-stats">
              <span class="stat">{{ t('syslog.statSent') }} <b>{{ sent }}</b></span>
              <span class="stat stat--err">{{ t('syslog.statFailed') }} <b>{{ failed }}</b></span>
              <span class="stat">{{ t('syslog.statRate') }} <b>{{ rate.toFixed(1) }}</b> {{ t('syslog.perSec') }}</span>
              <span class="stat">{{ t('syslog.statElapsed') }} <b>{{ elapsed.toFixed(1) }}</b>s</span>
            </div>
            <a-button size="small" @click="autoScroll = !autoScroll">
              {{ t('syslog.autoScroll') }}：{{ autoScroll ? t('syslog.on') : t('syslog.off') }}
            </a-button>
            <a-button size="small" :disabled="logs.length === 0" @click="clearLogs">
              {{ t('syslog.clear') }}
            </a-button>
          </div>
        </div>
        <div ref="termBody" class="term-body">
          <div v-if="logs.length === 0" class="term-empty">
            <div>
              <AppIcon name="terminal" :size="30" />
              <br />{{ t('syslog.termEmpty') }}
            </div>
          </div>
          <div v-for="line in logs" :key="line.seq" class="term-line">
            <span class="ts">{{ line.ts }}</span>
            <span class="no">#{{ line.seq }}</span>
            <span class="res" :class="line.fail ? 'fail' : 'ok'">{{ line.fail ? '✕' : '✓' }}</span>
            <span class="sev-badge" :class="line.sevCls">{{ t(`syslog.sev.${line.sevKey}`) }} {{ line.sevNum }}</span>
            <!-- msg 为组件内构建的 HTML（已 escapeHtml 转义后拼接高亮 span） -->
            <span class="msg" v-html="line.html" />
          </div>
        </div>
      </section>
    </div>

    <!-- 保存配置预设弹窗：确定按钮随名称非空解锁，摘要实时预览将存下的内容 -->
    <a-modal
      v-model:open="saveOpen"
      :title="t('syslog.savePresetTitle')"
      :ok-text="t('syslog.actionSave')"
      :cancel-text="t('syslog.actionCancel')"
      :confirm-loading="savingPreset"
      :ok-button-props="{ disabled: !presetName.trim() }"
      @ok="confirmSavePreset"
    >
      <div class="preset-form">
        <label>{{ t('syslog.presetNameLabel') }}</label>
        <a-input
          v-model:value="presetName"
          :maxlength="64"
          :placeholder="t('syslog.presetNamePh')"
          @press-enter="confirmSavePreset"
        />
        <p class="preset-summary">{{ presetSummaryPreview }}</p>
      </div>
    </a-modal>

    <!-- 发送历史抽屉：历史任务（留痕）与保存的配置（预设）两个页签 -->
    <a-drawer v-model:open="histOpen" :title="t('syslog.histTitle')" width="780">
      <a-tabs v-model:active-key="histTab">
        <!-- 清空按钮只挂在历史页签：预设是用户主动存的，不参与批量清理 -->
        <template #rightExtra>
          <a-button
            v-if="histTab === 'history'"
            size="small"
            danger
            :disabled="historyList.length === 0 || historyLoading"
            @click="clearFinishedHistory"
          >
            {{ t('syslog.clearFinished') }}
          </a-button>
        </template>
        <a-tab-pane key="history" :tab="t('syslog.tabHistory')">
          <a-table
            :columns="histColumns"
            :data-source="historyList"
            :loading="historyLoading"
            :pagination="false"
            :scroll="{ y: 420 }"
            row-key="id"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'createTime'">
                <span class="cell-mono">{{ fmtTime(record.createTime) }}</span>
              </template>
              <template v-else-if="column.key === 'target'">
                <span class="cell-mono">{{ record.targetIp }}:{{ record.targetPort }}</span>
              </template>
              <template v-else-if="column.key === 'count'">
                <span class="cell-mono">{{ record.sentCount }}/{{ record.totalCount }}</span>
                <span v-if="record.failedCount > 0" class="cell-fail"> ✕{{ record.failedCount }}</span>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
              </template>
              <template v-else-if="column.key === 'duration'">
                <span class="cell-mono">{{ fmtDuration(record.durationMs) }}</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button
                  type="link"
                  size="small"
                  :disabled="sending"
                  @click="applyHistory(record)"
                >
                  {{ t('syslog.actionReplay') }}
                </a-button>
                <!-- RUNNING 行删除禁用：后端也会拦（B0002），前端先给视觉反馈 -->
                <a-button
                  type="link"
                  size="small"
                  danger
                  :disabled="record.status === 'RUNNING'"
                  @click="removeHistoryTask(record)"
                >
                  {{ t('syslog.actionDelete') }}
                </a-button>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="presets" :tab="t('syslog.tabPresets')">
          <a-table
            :columns="presetColumns"
            :data-source="presetList"
            :loading="presetLoading"
            :pagination="false"
            :scroll="{ y: 420 }"
            row-key="id"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'summary'">
                <span class="cell-mono">{{ presetSummary(record) }}</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button type="link" size="small" :disabled="sending" @click="applyPreset(record)">
                  {{ t('syslog.actionLoad') }}
                </a-button>
                <a-button type="link" size="small" danger @click="removePreset(record)">
                  {{ t('syslog.actionDelete') }}
                </a-button>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-drawer>
  </div>
</template>

<style scoped>
.page {
  padding: 18px 20px 28px;
  min-height: 100vh;
}

/* ---------- 页头 ---------- */
.page-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px; }
.page-header h1 {
  font-size: 17px; font-weight: 700;
  display: flex; align-items: center; gap: 10px;
}
.page-header .desc { color: var(--fg-muted); font-size: 12.5px; margin-top: 5px; line-height: 1.6; }
.page-badges { display: flex; gap: 8px; margin-top: 9px; }
.pbadge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 10px; border-radius: 10px; font-size: 11.5px;
  border: 1px solid var(--border); color: var(--fg-sub);
  background: var(--bg-card);
}
.pbadge .dot { width: 6px; height: 6px; border-radius: 50%; }
.pbadge--ok { color: var(--sev-low); border-color: color-mix(in srgb, var(--sev-low) 30%, transparent); background: color-mix(in srgb, var(--sev-low) 6%, transparent); }
.pbadge--ok .dot { background: var(--sev-low); box-shadow: 0 0 6px color-mix(in srgb, var(--sev-low) 60%, transparent); }
.page-header-actions { margin-left: auto; display: flex; gap: 10px; flex: none; }

/* ---------- 布局网格 ---------- */
.content-grid {
  display: grid; gap: 14px;
  grid-template-columns: 355px 1fr;
  grid-template-areas: 'config template' 'terminal terminal';
}
.panel--config { grid-area: config; }
.panel--template { grid-area: template; }
.panel--terminal { grid-area: terminal; display: flex; flex-direction: column; }

/* 地址/数字行：antd 控件组合布局 */
.ip-row { display: flex; gap: 8px; }
.ip-row__port { width: 88px; flex: none; }
.ip-row__num { flex: 1; min-width: 0; }
/* IP 与端口是技术值，统一等宽字体 */
.ip-row :deep(input) { font-family: var(--font-mono); }

.send-area { margin-top: 14px; }
.send-progress { margin-top: 10px; }

/* ---------- 模板区 ---------- */
.code-area {
  width: 100%; min-height: 118px; resize: vertical;
  padding: 11px 13px;
  background: var(--bg-input);
  border: 1px solid transparent; border-radius: var(--radius-ctl);
  color: var(--fg); font-family: var(--font-mono); font-size: 12px; line-height: 1.7;
  transition: border-color var(--ease), box-shadow var(--ease), background var(--ease);
}
.code-area:focus {
  outline: none; background: var(--input-focus-bg);
  border-color: color-mix(in srgb, var(--primary) 50%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent);
}

.var-section { margin-top: 13px; }
.var-title { font-size: 11.5px; color: var(--fg-muted); margin-bottom: 8px; }
.var-chips { display: flex; flex-wrap: wrap; gap: 7px; }
/* 变量 chip 是品牌化的等宽代码片段按钮，antd 无对应形态，保持自研 */
.var-chip {
  padding: 3px 10px; border-radius: 7px;
  background: color-mix(in srgb, var(--primary) 7%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 22%, transparent);
  color: var(--primary); font-family: var(--font-mono); font-size: 11.5px;
  cursor: pointer; transition: all var(--ease);
}
.var-chip:hover { background: color-mix(in srgb, var(--primary) 14%, transparent); transform: translateY(-1px); }

.render-preview {
  margin-top: 13px; padding: 11px 13px;
  background: var(--bg-input);
  border: 1px dashed color-mix(in srgb, var(--primary) 30%, transparent);
  border-radius: var(--radius-ctl);
  font-family: var(--font-mono); font-size: 11.5px; line-height: 1.7;
  color: var(--fg-sub); word-break: break-all;
}
/* v-html 内部节点不吃 scoped，需要 :deep 穿透 */
.render-preview :deep(.pv-label) { color: var(--fg-muted); }
.render-preview :deep(.hl) { color: var(--primary); font-weight: 600; }
.render-preview :deep(.hl-ip) { color: var(--sev-high); font-weight: 600; }

/* ---------- 终端 ---------- */
.term-stats { display: flex; gap: 16px; align-items: center; font-size: 12px; color: var(--fg-muted); }
.stat b { color: var(--fg); font-family: var(--font-mono); font-weight: 600; }
.stat--err b { color: var(--sev-critical); }
.term-status {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 10px; border-radius: 10px; font-size: 11.5px;
  color: var(--fg-muted);
}
.term-status .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--fg-muted); }
.term-status.running {
  color: var(--sev-low);
  background: color-mix(in srgb, var(--sev-low) 7%, transparent);
  border: 1px solid color-mix(in srgb, var(--sev-low) 30%, transparent);
}
.term-status.running .dot {
  background: var(--sev-low);
  box-shadow: 0 0 8px color-mix(in srgb, var(--sev-low) 70%, transparent);
  animation: blink 1.2s ease-in-out infinite;
}
@keyframes blink { 50% { opacity: 0.35; } }

.term-body {
  flex: 1; height: 320px; overflow-y: auto;
  padding: 12px 14px;
  background: var(--bg-terminal);
  border-radius: 0 0 var(--radius) var(--radius);
  font-family: var(--font-mono); font-size: 12px; line-height: 1.85;
}
.term-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); }
.term-line { display: flex; gap: 10px; align-items: baseline; padding: 1px 0; animation: line-in 0.25s ease-out; }
@keyframes line-in { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
.term-line .ts { color: #6b7688; flex: none; }
.term-line .no { color: #6b7688; flex: none; min-width: 38px; text-align: right; }
.term-line .res { flex: none; width: 14px; text-align: center; color: var(--sev-low-v); }
.term-line .res.fail { color: var(--sev-critical-v); font-weight: 700; }
.term-line .msg { word-break: break-all; color: #aeb9cc; min-width: 0; }
/* 内外网 IP 视觉区分（终端内亮色档） */
.term-line :deep(.ip-int) { color: #22d3ee; }
.term-line :deep(.ip-ext) { color: var(--sev-high-v); }

/* 语义等级徽标：色 + 文字缺一不可，终端内用 vivid 档 */
.sev-badge {
  flex: none; display: inline-block;
  padding: 0 7px; margin-right: 6px; border-radius: 4px;
  font-size: 10.5px; line-height: 17px; font-weight: 700;
}
.sev-badge.lv-critical { color: var(--sev-critical-v); background: rgba(248, 113, 113, 0.12); box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.4); }
.sev-badge.lv-high { color: var(--sev-high-v); background: rgba(251, 146, 60, 0.12); box-shadow: inset 0 0 0 1px rgba(251, 146, 60, 0.4); }
.sev-badge.lv-medium { color: var(--sev-medium-v); background: rgba(250, 204, 21, 0.1); box-shadow: inset 0 0 0 1px rgba(250, 204, 21, 0.4); }
.sev-badge.lv-low { color: var(--sev-low-v); background: rgba(74, 222, 128, 0.1); box-shadow: inset 0 0 0 1px rgba(74, 222, 128, 0.4); }

.term-empty {
  height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: #6b7688; font-size: 12px; text-align: center; line-height: 2;
}
.term-empty :deep(svg) { opacity: 0.4; }

/* ---------- 保存预设弹窗 / 历史抽屉 ---------- */
.preset-form { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
.preset-form label { font-size: 12.5px; font-weight: 600; }
/* 摘要是技术值串（IP/模板/数量），等宽展示便于扫读 */
.preset-summary {
  font-size: 11.5px; color: var(--fg-muted);
  font-family: var(--font-mono); word-break: break-all;
  padding: 8px 10px; border-radius: var(--radius-ctl);
  background: var(--bg-input);
}
.cell-mono { font-family: var(--font-mono); font-size: 11.5px; }
.cell-fail { color: var(--sev-critical); font-family: var(--font-mono); font-size: 11.5px; }

/* ---------- 响应式 ---------- */
@media (max-width: 1200px) {
  .content-grid {
    grid-template-columns: 1fr;
    grid-template-areas: 'config' 'template' 'terminal';
  }
}
</style>
