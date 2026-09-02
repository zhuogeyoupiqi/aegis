import type { UserSnapshot } from '@aegis/contract'
import { authMock } from '@/mock/auth'
import { getApiMode } from '@/api/mode'
import { request } from '@/api/http'

/**
 * 登录接口（薄封装层）。
 * 组件只认这里导出的函数，不直接 import mock —— 后端就绪后
 * 把实现换成 axios 调 /api/auth/login，上层调用方零改动。
 */
export interface LoginResult {
  token: string
  user: UserSnapshot
}

/** 登录请求体：注意字段名是 username（对齐后端 LoginDTO），不是表单里的 account */
interface LoginBody {
  username: string
  password: string
}

/**
 * 登录：按数据源模式分发。
 * - mock：本地模拟（不依赖后端，平台默认形态）
 * - real：调后端 /api/auth/login（经 vite 代理到 8090）
 * 两边返回结构同构（LoginResult），调用方无感知。
 */
export function loginApi(account: string, password: string): Promise<LoginResult> {
  if (getApiMode() === 'real') {
    const body: LoginBody = { username: account, password }
    return request<LoginResult>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
  return authMock(account, password)
}

/** 注销：real 模式调后端销毁会话；mock 模式无事可做直接成功 */
export async function logoutApi(): Promise<void> {
  if (getApiMode() === 'real') {
    await request<void>('/api/auth/logout', { method: 'POST' })
  }
}
