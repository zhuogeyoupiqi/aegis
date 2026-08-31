import type { AppCode, AppRegistration, MenuGroup } from '@aegis/contract'
import { menuMock } from '@/mock/menu'

/**
 * 菜单接口（薄封装层）：登录后拉取菜单 + 子应用注册表。
 * 后端就绪后替换为 axios GET /api/menu。
 */
export function fetchMenu(): Promise<{
  groups: MenuGroup[]
  registry: Partial<Record<AppCode, AppRegistration>>
}> {
  return menuMock()
}
