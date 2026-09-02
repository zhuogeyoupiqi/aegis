import { lastAuth, toast } from '@aegis/shared'

/**
 * 统一请求封装（规范：组件里不裸写 fetch）。
 * 走相对路径 /api，开发期由 vite proxy 转发到 localhost:8090（aegis-server），
 * 注意端口是 8090 不是 8080（8080 被 miku/soc-web 的 dev server 长期占用）。
 * 微前端 iframe 里 fetch 的 origin 是子应用自身（8001），所以代理配置在子应用。
 */
export interface ApiResult<T> {
  code: string
  message: string
  data: T
}

/**
 * 发 JSON 请求并解包 Result<T>：code !== '0' 一律抛错，调用方 catch 后转 toast。
 *
 * 登录态：token 来自基座经数据通道下发的 lastAuth（iframe 跨源拿不到 cookie）。
 * 会话失效（A0401）只 toast 不跳转：路由权在基座，iframe 里跳基座路由
 * 会破坏 URL 映射——用户按提示回基座重新登录后，token 随通道自动更新。
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    // headers 用 Headers 实例合并而不是 ...init.headers 展开：
    // init.headers 可能是数组/对象/Headers 多种形态，展开写法对数组会直接崩
    const headers = new Headers(init?.headers)
    headers.set('Content-Type', 'application/json')
    const token = lastAuth.value?.token
    if (token) headers.set('Authorization', `Bearer ${token}`)
    res = await fetch(`/api${path}`, { ...init, headers })
  } catch {
    // 网络层失败（后端没起 / 代理没通）：fetch 本身 reject，转成可读文案
    throw new Error('无法连接后端服务，请确认 aegis-server 已启动（localhost:8090）')
  }
  // 网关错误（404/500）可能返回非 JSON，先安全解析
  const body = (await res.json().catch(() => null)) as ApiResult<T> | null
  if (body?.code === 'A0401') {
    toast('登录已失效，请回到基座重新登录', 'bad')
    throw new Error(body.message)
  }
  if (!res.ok || !body || body.code !== '0') {
    throw new Error(body?.message ?? `请求失败（HTTP ${res.status}）`)
  }
  return body.data
}
