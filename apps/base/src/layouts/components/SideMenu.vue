<script setup lang="ts">
import { computed } from 'vue'
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

/**
 * mixed 布局只显示当前顶部分组的子项；side 布局显示全部分组。
 * 顶部分组的激活由 MainLayout 的 syncTopGroup 维护。
 */
const visibleGroups = computed<MenuGroup[]>(() => {
  if (appStore.prefs.layout !== 'mixed') return menuStore.groups
  return menuStore.groups.filter((g) => g.key === appStore.activeTopGroup)
})

/**
 * 激活判定：普通页按 path；stub 重定向到 /coming-soon 后按 query.item（菜单 key）对回。
 * 参数用结构化类型（只依赖 path/key），分组里的 MenuItem 与拍平的 FlatMenuItem 都能传。
 */
function isActive(item: { path: string; key: string }): boolean {
  if (route.path === item.path) return true
  return route.path === '/coming-soon' && route.query.item === item.key
}

/** 分组标题：按分组 key 查词条，数据里的中文 title 作兜底 */
function groupTitle(g: MenuGroup): string {
  return t(`menu.groups.${g.key}`) || g.title
}

function go(item: { path: string }): void {
  router.push(item.path)
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: appStore.sidebarCollapsed }">
    <div class="brand">
      <span class="brand__logo">A</span>
      <span class="brand__name">Aegis</span>
    </div>

    <nav class="menu">
      <template v-for="g in visibleGroups" :key="g.key">
        <div class="menu-group-title">{{ groupTitle(g) }}</div>
        <div
          v-for="item in g.children"
          :key="item.key"
          class="menu-item"
          :class="{ active: isActive(item) }"
          :title="t(`menu.items.${item.key}`)"
          @click="go(item)"
        >
          <AppIcon :name="item.icon || 'apps'" :size="16" />
          <span class="label">{{ t(`menu.items.${item.key}`) }}</span>
        </div>
      </template>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 208px;
  flex: none;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  transition: width var(--ease);
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 25;
}

.brand {
  display: flex; align-items: center; gap: 9px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.brand__logo {
  width: 28px; height: 28px; flex: none; border-radius: 9px;
  display: grid; place-items: center;
  background: var(--grad-brand);
  color: #fff; font-weight: 800; font-size: 14px;
  box-shadow: 0 3px 10px color-mix(in srgb, var(--primary) 35%, transparent);
}
.brand__name { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }

.menu { padding: 8px; flex: 1; }
.menu-group-title {
  padding: 14px 12px 6px;
  font-size: 11px; color: var(--fg-muted); letter-spacing: 1px;
  white-space: nowrap;
  transition: opacity var(--ease);
}
.menu-item {
  position: relative;
  display: flex; align-items: center; gap: 10px;
  height: 36px; padding: 0 12px; margin-bottom: 2px;
  border-radius: var(--radius-ctl);
  color: var(--fg-sub); cursor: pointer;
  white-space: nowrap; user-select: none;
  transition: all var(--ease);
}
.menu-item:hover { background: var(--bg-input); color: var(--fg); }
.menu-item.active {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--primary) 12%, transparent),
    color-mix(in srgb, var(--grad-2) 5%, transparent)
  );
  color: var(--primary); font-weight: 600;
}
/* 激活态左侧主题色指示条 */
.menu-item.active::before {
  content: '';
  position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px;
  border-radius: 2px;
  background: var(--grad-btn);
  box-shadow: 0 0 8px color-mix(in srgb, var(--primary) 50%, transparent);
}

/* 折叠态：只留图标，文字与分组标题隐藏（title 属性兜底） */
.sidebar.collapsed { width: 64px; }
.sidebar.collapsed .brand { justify-content: center; padding-inline: 0; }
.sidebar.collapsed .brand__name,
.sidebar.collapsed .menu-item .label,
.sidebar.collapsed .menu-group-title {
  opacity: 0; width: 0; overflow: hidden; padding-inline: 0;
}
.sidebar.collapsed .menu-item { justify-content: center; padding: 0; }
.sidebar.collapsed .menu-group-title { height: 10px; padding-block: 0; }
</style>
