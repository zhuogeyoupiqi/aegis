import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { UserSnapshot } from '@aegis/contract'
import { loginApi, type LoginResult } from '@/api/auth'

// 会话持久化键：刷新页面后免二次登录（mock 阶段足够；接真实后端时换 cookie/token 刷新机制）
const TOKEN_KEY = 'aegis:token'
const USER_KEY = 'aegis:user'

/** 从 localStorage 恢复用户信息；存档损坏返回 null 走未登录分支 */
function loadUser(): UserSnapshot | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as UserSnapshot) : null
  } catch {
    return null
  }
}

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) || '')
  const userInfo = ref<UserSnapshot | null>(loadUser())
  /** 登录请求进行中：登录按钮的 loading 态直接消费它 */
  const loading = ref(false)

  /**
   * 登录并落盘会话（token + 用户信息）。
   * 失败直接向上抛：由登录页决定展示形态（字段错误 vs 服务端错误横幅）。
   */
  async function login(account: string, password: string): Promise<LoginResult> {
    loading.value = true
    try {
      const res = await loginApi(account, password)
      token.value = res.token
      userInfo.value = res.user
      localStorage.setItem(TOKEN_KEY, res.token)
      localStorage.setItem(USER_KEY, JSON.stringify(res.user))
      return res
    } finally {
      loading.value = false
    }
  }

  /** 退出登录：清内存态与持久化会话（页面跳转由调用方负责） */
  function logout(): void {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return { token, userInfo, loading, login, logout }
})
