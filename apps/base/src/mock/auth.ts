import { delay } from '@aegis/shared'
import type { UserSnapshot } from '@aegis/contract'

/**
 * 登录 mock：模拟 350ms 网络开销，仅接受 admin / 123456。
 * 真实接口就绪后删除本文件，api 层改调 axios 即可，组件零改动。
 */
export function authMock(account: string, password: string): Promise<{ token: string; user: UserSnapshot }> {
  if (account.trim() === 'admin' && password === '123456') {
    return delay({
      token: `mock-token-${Date.now()}`,
      user: { account: 'admin', nickname: '崔卓', roles: ['ADMIN'] },
    }, 350)
  }
  // 失败路径：延迟后 reject，与真实接口的失败时延一致
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('账号或密码不正确（演示账号 admin / 123456）')), 350),
  )
}
