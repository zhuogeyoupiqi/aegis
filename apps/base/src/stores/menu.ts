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
  const groups = ref<MenuGroup[]>([])
  const registry = ref<Partial<Record<AppCode, AppRegistration>>>({})
  const loaded = ref(false)

  async function ensureLoaded(): Promise<void> {
    if (loaded.value) return
    const data = await fetchMenu()
    groups.value = data.groups
    registry.value = data.registry
    loaded.value = true
  }

  const flatItems = computed<FlatMenuItem[]>(() =>
    groups.value.flatMap((g) =>
      g.children.map((item) => ({ ...item, groupKey: g.key, groupTitle: g.title })),
    ),
  )

  function findItem(path: string): FlatMenuItem | undefined {
    return flatItems.value.find((i) => i.path === path)
  }

  return { groups, registry, loaded, ensureLoaded, flatItems, findItem }
})
