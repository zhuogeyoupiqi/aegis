/**
 * 基座 fetch 封装：统一带 token、解包 Result、处理会话失效。
 *
 * 与 soc-tools 的 http.ts 同构但分层处理不同：
 * 基座拥有路由权，A0401 时清会话并跳登录页；
 * 子应用在 iframe 里没有基座路由权，只能 toast（那边各自的实现里有说明）。
 */

/** 会话持久化键：与 user store 的约定保持一致（token 由 store 写入，这里只读/清） */
const TOKEN_KEY = 'aegis:token'
const USER_KEY = 'aegis:user'

/** 后端统一返回结构（与 aegis-common Result 对应） */
interface ApiResult<T> {
  code: string
  message: string
  data: T
}

/**
 * 请求真实接口并解包 Result。
 * code !== '0' 一律 reject（message 带后端文案，调用方 toast 或字段级展示）。
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let resp: Response
  try {
    // headers 用 Headers 实例合并而不是 ...init.headers 展开：
    // init.headers 可能是数组/对象/Headers 多种形态，展开写法对数组会直接崩
    const headers = new Headers(init?.headers)
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    resp = await fetch(path, { ...init, headers })
  } catch {
    // 网络层失败（后端没起/断网）：给用户能看懂的原因，不抛 fetch 的原始 TypeError
    throw new Error('无法连接服务器，请确认后端已启动（或切换为模拟数据源）')
  }

  const body = (await resp.json()) as ApiResult<T>
  if (body.code === 'A0401') {
    // 会话失效：清本地会话回登录页。用 location 而不是 router——
    // http 模块被 store 引用，再引 router 会形成模块级循环依赖
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    window.location.href = '/login'
    throw new Error(body.message)
  }
  if (body.code !== '0') {
    throw new Error(body.message)
  }
  return body.data
}
