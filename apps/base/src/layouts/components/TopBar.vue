<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useMenuStore } from '@/stores/menu'
import { useUserStore } from '@/stores/user'
import AppIcon from '@/components/AppIcon.vue'

const appStore = useAppStore()
const menuStore = useMenuStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const layout = computed(() => appStore.prefs.layout)

/* ---------- 面包屑：分组来自菜单数据，标题优先取 stub 重定向带的语义标题 ---------- */
const groupTitle = computed(() => {
  const fromQuery = route.query.group as string | undefined
  if (fromQuery) return fromQuery
  return menuStore.findItem(route.path)?.groupTitle ?? ''
})
const pageTitle = computed(() => (route.query.title as string) || (route.meta.title as string) || '')

/* ---------- 主题快捷切换：只在明/暗之间切，auto 是设置抽屉里的精细选项 ---------- */
function toggleTheme(): void {
  appStore.prefs.mode = appStore.resolvedMode === 'dark' ? 'light' : 'dark'
}

function logout(): void {
  userStore.logout()
  appStore.pushToast('已退出登录', 'info')
  router.push('/login')
}

const initial = computed(() => (userStore.userInfo?.nickname || 'A').slice(0, 1).toUpperCase())
</script>

<template>
  <header class="topbar">
    <!-- top 布局没有侧栏，logo 移到顶栏 -->
    <a-tooltip v-if="layout !== 'top'" :title="appStore.sidebarCollapsed ? '展开菜单' : '折叠菜单'">
      <button class="icon-btn" @click="appStore.sidebarCollapsed = !appStore.sidebarCollapsed">
        <AppIcon name="panelLeft" :size="17" />
      </button>
    </a-tooltip>
    <div v-else class="brand-mini">
      <span class="brand-mini__logo">A</span>
      <b>Aegis</b>
    </div>

    <nav class="breadcrumb">
      <span class="crumb crumb--root">Aegis</span>
      <span class="sep">/</span>
      <span v-if="groupTitle && groupTitle !== '常用'" class="app-chip">{{ groupTitle }}</span>
      <span v-if="groupTitle && groupTitle !== '常用'" class="sep">/</span>
      <b>{{ pageTitle }}</b>
    </nav>

    <div class="spacer" />

    <a-tooltip :title="appStore.resolvedMode === 'dark' ? '切换到浅色' : '切换到暗色'">
      <button class="icon-btn" @click="toggleTheme">
        <AppIcon :name="appStore.resolvedMode === 'dark' ? 'sun' : 'moon'" :size="17" />
      </button>
    </a-tooltip>
    <a-tooltip title="项目配置">
      <button class="icon-btn" @click="appStore.settingsOpen = true">
        <AppIcon name="sliders" :size="17" />
      </button>
    </a-tooltip>

    <!-- 头像下拉：交互交给 a-dropdown（点击外部关闭、定位、动画都是内建） -->
    <a-dropdown placement="bottomRight" :trigger="['click']">
      <div class="avatar">{{ initial }}</div>
      <template #overlay>
        <div class="avatar-menu">
          <div class="avatar-menu__head">
            <b>{{ userStore.userInfo?.nickname }}</b>
            <span>{{ (userStore.userInfo?.roles || []).join(' · ') || '普通用户' }}</span>
          </div>
          <a-menu :selectable="false">
            <a-menu-item key="logout" danger @click="logout">
              <AppIcon name="logout" :size="14" />
              退出登录
            </a-menu-item>
          </a-menu>
        </div>
      </template>
    </a-dropdown>
  </header>
</template>

<style scoped>
.topbar {
  height: 48px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  background: var(--bg-glass);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
  z-index: 30;
}
.brand-mini { display: flex; align-items: center; gap: 8px; }
.brand-mini__logo {
  width: 26px; height: 26px; border-radius: 8px;
  display: grid; place-items: center;
  background: var(--grad-brand);
  color: #fff; font-weight: 800; font-size: 13px;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--primary) 35%, transparent);
}
.brand-mini b { font-size: 14px; letter-spacing: 0.4px; }

.breadcrumb {
  display: flex; align-items: center; gap: 7px;
  color: var(--fg-muted); font-size: 13px; user-select: none;
  min-width: 0;
}
.breadcrumb b { color: var(--fg); font-weight: 600; white-space: nowrap; }
.crumb--root { white-space: nowrap; }
.sep { opacity: 0.5; }
.app-chip {
  display: inline-flex; align-items: center;
  padding: 1px 8px; border-radius: 10px; font-size: 11px;
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 22%, transparent);
  white-space: nowrap;
}
.spacer { flex: 1; }

.avatar {
  width: 30px; height: 30px; border-radius: 50%;
  display: grid; place-items: center; cursor: pointer;
  background: var(--grad-brand);
  color: #fff; font-size: 12px; font-weight: 700;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--primary) 35%, transparent);
}
/* overlay 虽被传送至 body 渲染，但 scoped data 属性仍挂在这些元素上，样式正常生效 */
.avatar-menu {
  min-width: 180px; padding: 6px;
  background: var(--bg-float);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-float);
}
.avatar-menu__head {
  padding: 8px 10px 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 5px;
}
.avatar-menu__head b { display: block; font-size: 13px; }
.avatar-menu__head span { font-size: 11px; color: var(--fg-muted); }
</style>
