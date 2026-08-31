import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { UserSnapshot } from '@aegis/contract'
import { loginApi, type LoginResult } from '@/api/auth'

const TOKEN_KEY = 'aegis:token'
const USER_KEY = 'aegis:user'

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
  const loading = ref(false)

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

  function logout(): void {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return { token, userInfo, loading, login, logout }
})
