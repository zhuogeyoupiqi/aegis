/**
 * 统一请求封装（规范：组件里不裸写 fetch）。
 * 走相对路径 /api，开发期由 vite proxy 转发到 localhost:8090（aegis-server），
 * 注意端口是 8090 不是 8080（8080 被 miku/soc-web 的 dev server 长期占用）。
 * 微前端 iframe 里 fetch 的 origin 是子应用自身（8002），所以代理配置在子应用。
 */
export interface ApiResult<T> {
  code: string
  message: string
  data: T
}

/**
 * 发 JSON 请求并解包 Result<T>：code !== '0' 一律抛错，
 * 调用方（驱动层）catch 后转 fatal 事件，视图只管 toast。
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    // 网络层失败（后端没起 / 代理没通）：fetch 本身 reject，转成可读文案
    throw new Error('无法连接后端服务，请确认 aegis-server 已启动（localhost:8090）')
  }
  // 网关错误（404/500）可能返回非 JSON，先安全解析
  const body = (await res.json().catch(() => null)) as ApiResult<T> | null
  if (!res.ok || !body || body.code !== '0') {
    throw new Error(body?.message ?? `请求失败（HTTP ${res.status}）`)
  }
  return body.data
}
