/**
 * 发送历史 + 配置预设的读写层。
 * 与发送驱动同构：mock 走 localStorage、real 走后端接口，视图不感知差异。
 * real 模式历史来自 soc_send_task 留痕表（后端写）；mock 模式由 mockDriver 落 localStorage。
 */
import { getApiMode } from './mode'
import { request } from './http'
import type { SendTaskConfig } from './types'

/** 一条历史任务记录（real=soc_send_task 行投影；mock=本地记录，字段同构） */
export interface TaskHistoryItem {
  id: string
  targetIp: string
  targetPort: number
  templateKey: string
  totalCount: number
  sentCount: number
  failedCount: number
  durationMs: number | null
  status: 'DONE' | 'CANCELLED' | 'FAILED' | 'RUNNING'
  errorMsg?: string | null
  startTime?: string | null
  createTime: string
  /** 发送间隔（复现历史要还原发送节奏） */
  intervalMs: number
}

/** 一条配置预设（"保存任务"的产物） */
export interface SendPreset {
  id: string
  name: string
  targetIp: string
  targetPort: number
  templateKey: string
  templateContent: string
  count: number
  intervalMs: number
  randomize: boolean
  createTime: string
}

/* ---------- mock 实现：localStorage 两张"表" ---------- */
const LS_HISTORY = 'aegis:syslog-history'
const LS_PRESETS = 'aegis:syslog-presets'
/** 本地历史上限：个人演示够用，超出裁最旧的 */
const HISTORY_CAP = 100

/** 生成不依赖雪花 ID 的本地主键（mock 模式不会发给后端，无精度问题） */
function localId(): string {
  return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function readLS<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}

function writeLS<T>(key: string, list: T[]): void {
  localStorage.setItem(key, JSON.stringify(list))
}

/* ---------- 对外 API（按当前模式分发） ---------- */

/** 查询历史任务（新的在前） */
export async function listHistory(): Promise<TaskHistoryItem[]> {
  if (getApiMode() === 'real') {
    const page = await request<{ total: number; items: TaskHistoryItem[] }>('/syslog/tasks?current=1&size=50')
    return page.items
  }
  return readLS<TaskHistoryItem>(LS_HISTORY)
}

/** 删除单条历史（real=逻辑删除底账保留；RUNNING 会被后端 B0002 拒绝；mock=本地直接移除） */
export async function deleteHistoryTask(id: string): Promise<void> {
  if (getApiMode() === 'real') {
    await request<void>('/syslog/tasks/' + id, { method: 'DELETE' })
    return
  }
  writeLS(LS_HISTORY, readLS<TaskHistoryItem>(LS_HISTORY).filter((h) => h.id !== id))
}

/** 一键清空已结束的历史，返回清理条数（toast 用）；RUNNING 任务不动 */
export async function clearHistoryTasks(): Promise<number> {
  if (getApiMode() === 'real') {
    return request<number>('/syslog/tasks', { method: 'DELETE' })
  }
  const list = readLS<TaskHistoryItem>(LS_HISTORY)
  const remain = list.filter((h) => h.status === 'RUNNING')
  writeLS(LS_HISTORY, remain)
  return list.length - remain.length
}

/**
 * 记录一条 mock 历史（供 mockDriver 在任务终态时调用；real 模式由后端落库，不走这里）。
 * 参数从驱动上下文取，保证和真实留痕字段同构。
 */
export function recordMockHistory(
  cfg: SendTaskConfig,
  status: TaskHistoryItem['status'],
  sent: number,
  failed: number,
  durationMs: number,
): void {
  const list = readLS<TaskHistoryItem>(LS_HISTORY)
  list.unshift({
    id: localId(),
    targetIp: cfg.targetIp,
    targetPort: cfg.targetPort,
    templateKey: cfg.templateKey,
    totalCount: cfg.count,
    sentCount: sent,
    failedCount: failed,
    durationMs,
    status,
    intervalMs: cfg.intervalMs,
    createTime: new Date().toISOString(),
  })
  writeLS(LS_HISTORY, list.slice(0, HISTORY_CAP))
}

/** 保存当前表单为预设 */
export async function savePreset(preset: Omit<SendPreset, 'id' | 'createTime'>): Promise<void> {
  if (getApiMode() === 'real') {
    await request<void>('/syslog/presets', { method: 'POST', body: JSON.stringify(preset) })
    return
  }
  const list = readLS<SendPreset>(LS_PRESETS)
  list.unshift({ ...preset, id: localId(), createTime: new Date().toISOString() })
  writeLS(LS_PRESETS, list)
}

/** 预设列表（新存的前面） */
export async function listPresets(): Promise<SendPreset[]> {
  if (getApiMode() === 'real') {
    return request<SendPreset[]>('/syslog/presets')
  }
  return readLS<SendPreset>(LS_PRESETS)
}

/** 删除预设 */
export async function deletePreset(id: string): Promise<void> {
  if (getApiMode() === 'real') {
    await request<void>('/syslog/presets/' + id, { method: 'DELETE' })
    return
  }
  writeLS(LS_PRESETS, readLS<SendPreset>(LS_PRESETS).filter((p) => p.id !== id))
}
