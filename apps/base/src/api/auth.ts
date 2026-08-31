import type { UserSnapshot } from '@aegis/contract'
import { authMock } from '@/mock/auth'

/**
 * 登录接口（薄封装层）。
 * 组件只认这里导出的函数，不直接 import mock —— 后端就绪后
 * 把实现换成 axios 调 /api/auth/login，上层调用方零改动。
 */
export interface LoginResult {
  token: string
  user: UserSnapshot
}

export function loginApi(account: string, password: string): Promise<LoginResult> {
  return authMock(account, password)
}
