/**
 * syslog 发送 API 层的唯一出口。
 * 视图只 import 这一个模块：startSendTask 内部按当前模式分发到 mock/real 驱动，
 * 模式切换的持久化逻辑也在这一层收口（mode.ts）。
 */
import { getApiMode } from './mode'
import { mockSendDriver } from './mockDriver'
import { realSendDriver } from './realDriver'
import type { SendEventListener, SendHandle, SendTaskConfig } from './types'

export * from './types'
export { getApiMode, setApiMode } from './mode'
export {
  listHistory,
  deleteHistoryTask,
  clearHistoryTasks,
  listPresets,
  savePreset,
  deletePreset,
  type TaskHistoryItem,
  type SendPreset,
} from './history'

/** 按当前数据源模式启动发送任务（进行中的任务不受后续模式切换影响） */
export async function startSendTask(
  cfg: SendTaskConfig,
  onEvent: SendEventListener,
): Promise<SendHandle> {
  const driver = getApiMode() === 'real' ? realSendDriver : mockSendDriver
  return driver(cfg, onEvent)
}
