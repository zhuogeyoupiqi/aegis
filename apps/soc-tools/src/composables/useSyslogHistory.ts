/**
 * Syslog 发送历史与配置预设逻辑。
 *
 * 职责：拉取/保存/删除历史任务和配置预设，提供复现/载入表单的回调。
 * 表单状态本身由父组件（或 useSyslogSender）持有，本 composable 通过回调更新。
 */

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { App } from 'ant-design-vue'
import { toast } from '@aegis/shared'
import {
  clearHistoryTasks,
  deleteHistoryTask,
  deletePreset,
  listHistory,
  listPresets,
  savePreset,
  type SendPreset,
  type TaskHistoryItem,
} from '@/api'
import { TEMPLATES } from './useSyslogTemplate'

export interface LoadableConfig {
  targetIp: string
  targetPort: number
  count: number
  intervalMs: number
  randomize: boolean
  templateKey: string
  templateContent: string
}

export function useSyslogHistory(
  sending: { value: boolean },
  getCurrentConfig: () => LoadableConfig,
  applyConfig: (cfg: LoadableConfig) => void,
) {
  const { t } = useI18n()
  const { modal } = App.useApp()

  /* ---------- 抽屉与加载态 ---------- */
  const histOpen = ref(false)
  const histTab = ref('history')
  const historyLoading = ref(false)
  const presetLoading = ref(false)
  const historyList = ref<TaskHistoryItem[]>([])
  const presetList = ref<SendPreset[]>([])

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

  /** 发送进行中禁止回填 */
  function guardLoading(): boolean {
    if (!sending.value) return false
    toast(t('syslog.loadBlockedSending'), 'bad')
    return true
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

  /** 打开抽屉即拉两份数据：历史和预设一起加载，切 tab 不再等待 */
  async function openHistory(): Promise<void> {
    histOpen.value = true
    await Promise.all([loadHistory(), loadPresets()])
  }

  /* ---------- 保存预设 ---------- */
  const saveOpen = ref(false)
  const presetName = ref('')
  const savingPreset = ref(false)

  /** 默认名概括核心参数，多数场景不用改直接存 */
  function openSaveModal(): void {
    const cfg = getCurrentConfig()
    presetName.value = `${cfg.templateKey} → ${cfg.targetIp}:${cfg.targetPort} × ${cfg.count}`
    saveOpen.value = true
  }

  async function confirmSavePreset(): Promise<void> {
    const name = presetName.value.trim()
    if (!name) return
    savingPreset.value = true
    try {
      await savePreset({ ...getCurrentConfig(), name })
      toast(t('syslog.presetSaved', { name }))
      saveOpen.value = false
      await loadPresets()
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'bad')
    } finally {
      savingPreset.value = false
    }
  }

  /* ---------- 历史任务操作 ---------- */
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
    applyConfig({
      targetIp: item.targetIp,
      targetPort: item.targetPort,
      count: item.totalCount,
      intervalMs: item.intervalMs,
      randomize: true, // 历史未存 randomize，默认随机更接近真实复现
      templateKey: TEMPLATES[item.templateKey] ? item.templateKey : 'CEF',
      templateContent: TEMPLATES[item.templateKey] ?? TEMPLATES.CEF,
    })
    histOpen.value = false
    toast(t('syslog.configLoaded'))
  }

  /* ---------- 预设操作 ---------- */
  function applyPreset(p: SendPreset): void {
    if (guardLoading()) return
    applyConfig({
      targetIp: p.targetIp,
      targetPort: p.targetPort,
      count: p.count,
      intervalMs: p.intervalMs,
      randomize: p.randomize,
      templateKey: p.templateKey,
      templateContent: p.templateContent,
    })
    histOpen.value = false
    toast(t('syslog.configLoaded'))
  }

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
          toast(err instanceof Error ? err.message : String(err), 'bad')
        }
      },
    })
  }

  return {
    histOpen,
    histTab,
    historyLoading,
    presetLoading,
    historyList,
    presetList,
    histColumns,
    presetColumns,
    openHistory,
    loadHistory,
    loadPresets,
    saveOpen,
    presetName,
    savingPreset,
    openSaveModal,
    confirmSavePreset,
    applyHistory,
    applyPreset,
    removeHistoryTask,
    clearFinishedHistory,
    removePreset,
  }
}

/** 状态 → a-tag 颜色 */
export function statusColor(s: string): string {
  return (
    {
      DONE: 'success',
      FAILED: 'error',
      CANCELLED: 'default',
      RUNNING: 'processing',
    } as Record<string, string>
  )[s] ?? 'default'
}

/** 状态 → 词条 key */
export function statusLabel(s: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    DONE: 'stDone',
    FAILED: 'stFailed',
    CANCELLED: 'stCancelled',
    RUNNING: 'stRunning',
  }
  return t(`syslog.${map[s] ?? 'stRunning'}`)
}

/** ISO 时间转可读格式 */
export function fmtTime(iso?: string | null): string {
  return iso ? iso.replace('T', ' ').slice(0, 19) : '—'
}

/** 毫秒时长自适应单位 */
export function fmtDuration(ms?: number | null): string {
  if (ms == null) return '—'
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

/** 预设摘要 */
export function presetSummary(p: SendPreset): string {
  return `${p.targetIp}:${p.targetPort} · ${p.templateKey} · ×${p.count} · ${p.intervalMs}ms`
}
