<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useMenuStore } from '@/stores/menu'
import AppIcon from '@/components/AppIcon.vue'
import type { MenuGroup } from '@aegis/contract'

const appStore = useAppStore()
const menuStore = useMenuStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

/** top 布局当前展开下拉的分组 key（点击外部关闭） */
const openGroup = ref('')
const navEl = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent): void {
  if (navEl.value && !navEl.value.contains(e.target as Node)) openGroup.value = ''
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

/** 分组是否高亮：mixed 看激活分组，top 看当前路由归属（stub 页按 query.item 对回） */
function isGroupActive(g: MenuGroup): boolean {
  if (appStore.prefs.layout === 'mixed') return appStore.activeTopGroup === g.key
  const item =
    menuStore.findItem(route.path) ??
    menuStore.flatItems.find((i) => route.path === '/coming-soon' && i.key === route.query.item)
  return item?.groupKey === g.key
}

function groupClick(g: MenuGroup): void {
  if (appStore.prefs.layout === 'mixed') {
    // mixed：切换侧栏展示的分组，并跳到该组第一项
    appStore.activeTopGroup = g.key
    const first = g.children[0]
    if (first) router.push(first.path)
  } else {
    // top：展开/收起下拉
    openGroup.value = openGroup.value === g.key ? '' : g.key
  }
}

function itemClick(path: string): void {
  openGroup.value = ''
  router.push(path)
}
</script>

<template>
  <nav ref="navEl" class="topnav">
    <div
      v-for="g in menuStore.groups"
      :key="g.key"
      class="topnav__group"
      :class="{ active: isGroupActive(g) }"
      @click="groupClick(g)"
    >
      <span>{{ t(`menu.groups.${g.key}`) }}</span>
      <AppIcon v-if="appStore.prefs.layout === 'top'" name="chevronDown" :size="12" />

      <!-- top 布局的二级菜单下拉 -->
      <div v-if="appStore.prefs.layout === 'top' && openGroup === g.key" class="topnav__dropdown">
        <div
          v-for="item in g.children"
          :key="item.key"
          class="topnav__item"
          @click.stop="itemClick(item.path)"
        >
          <AppIcon :name="item.icon || 'apps'" :size="14" />
          <span>{{ t(`menu.items.${item.key}`) }}</span>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.topnav {
  height: 42px;
  flex: none;
  display: flex;
  align-items: stretch;
  gap: 4px;
  padding: 0 14px;
  background: var(--bg-glass);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
  z-index: 28;
}
.topnav__group {
  position: relative;
  display: flex; align-items: center; gap: 4px;
  padding: 0 13px; margin: 4px 0;
  border-radius: var(--radius-ctl);
  color: var(--fg-sub); font-size: 13px;
  cursor: pointer; user-select: none;
  transition: all var(--ease);
}
.topnav__group:hover { background: var(--bg-input); color: var(--fg); }
.topnav__group.active {
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--primary); font-weight: 600;
}
.topnav__dropdown {
  position: absolute; top: calc(100% + 6px); left: 0;
  min-width: 176px; padding: 6px;
  background: var(--bg-float);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-float);
  z-index: 40;
}
.topnav__item {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 10px; border-radius: 8px;
  color: var(--fg-sub); font-size: 12.5px;
  cursor: pointer;
  transition: all var(--ease);
}
.topnav__item:hover {
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  color: var(--fg);
}
</style>
