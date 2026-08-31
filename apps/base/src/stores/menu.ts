import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AppCode, AppRegistration, MenuGroup, MenuItem } from '@aegis/contract'
import { fetchMenu } from '@/api/menu'

/** 菜单项 + 所属分组（拍平后便于按 path 查找） */
export interface FlatMenuItem extends MenuItem {
  groupKey: string
  groupTitle: string
}

export const useMenuStore = defineStore('menu', () => {
  /** 分组化菜单树（侧栏/顶栏按结构渲染） */
  const groups = ref<MenuGroup[]>([])
  /** 子应用注册表：appCode → dev/prod 入口，ChildAppView 装载时查这里 */
  const registry = ref<Partial<Record<AppCode, AppRegistration>>>({})
  /** 首次 ensureLoaded 完成后置位，避免重复请求 */
  const loaded = ref(false)

  /**
   * 按需加载菜单（幂等）：进入主布局或路由守卫需要菜单数据时调用。
   * 不在 store 构造时拉取——登录页用不到，没必要提前发请求。
   */
  async function ensureLoaded(): Promise<void> {
    if (loaded.value) return
    const data = await fetchMenu()
    groups.value = data.groups
    registry.value = data.registry
    loaded.value = true
  }

  /** 拍平的菜单项（带所属分组 key）：工作台快捷入口、按 path 反查等都用它 */
  const flatItems = computed<FlatMenuItem[]>(() =>
    groups.value.flatMap((g) =>
      g.children.map((item) => ({ ...item, groupKey: g.key, groupTitle: g.title })),
    ),
  )

  /** 按基座路由 path 反查菜单项（面包屑、mixed 布局高亮、stub 判定） */
  function findItem(path: string): FlatMenuItem | undefined {
    return flatItems.value.find((i) => i.path === path)
  }

  return { groups, registry, loaded, ensureLoaded, flatItems, findItem }
})
