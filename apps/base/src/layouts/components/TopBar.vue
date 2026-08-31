<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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

/* ---------- 头像下拉 ---------- */
const menuOpen = ref(false)
const avatarWrap = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent): void {
  if (avatarWrap.value && !avatarWrap.value.contains(e.target as Node)) menuOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

function logout(): void {
  menuOpen.value = false
  userStore.logout()
  appStore.pushToast('已退出登录', 'info')
  router.push('/login')
}

const initial = computed(() => (userStore.userInfo?.nickname || 'A').slice(0, 1).toUpperCase())
</script>

<template>
  <header class="topbar">
    <!-- top 布局没有侧栏，logo 移到顶栏 -->
    <button
      v-if="layout !== 'top'"
      class="icon-btn"
      :title="appStore.sidebarCollapsed ? '展开菜单' : '折叠菜单'"
      @click="appStore.sidebarCollapsed = !appStore.sidebarCollapsed"
    >
      <AppIcon name="panelLeft" :size="17" />
    </button>
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

    <button
      class="icon-btn"
      :title="appStore.resolvedMode === 'dark' ? '切换到浅色' : '切换到暗色'"
      @click="toggleTheme"
    >
      <AppIcon :name="appStore.resolvedMode === 'dark' ? 'sun' : 'moon'" :size="17" />
    </button>
    <button class="icon-btn" title="项目配置" @click="appStore.settingsOpen = true">
      <AppIcon name="sliders" :size="17" />
    </button>

    <div ref="avatarWrap" class="avatar-wrap">
      <div class="avatar" :title="userStore.userInfo?.nickname" @click="menuOpen = !menuOpen">
        {{ initial }}
      </div>
      <div v-if="menuOpen" class="avatar-menu">
        <div class="avatar-menu__head">
          <b>{{ userStore.userInfo?.nickname }}</b>
          <span>{{ (userStore.userInfo?.roles || []).join(' · ') || '普通用户' }}</span>
        </div>
        <button class="avatar-menu__item danger" @click="logout">
          <AppIcon name="logout" :size="14" />
          退出登录
        </button>
      </div>
    </div>
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

.avatar-wrap { position: relative; }
.avatar {
  width: 30px; height: 30px; border-radius: 50%;
  display: grid; place-items: center; cursor: pointer;
  background: var(--grad-brand);
  color: #fff; font-size: 12px; font-weight: 700;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--primary) 35%, transparent);
}
.avatar-menu {
  position: absolute; top: 40px; right: 0;
  min-width: 180px; padding: 6px;
  background: var(--bg-float);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-float);
  z-index: 50;
}
.avatar-menu__head {
  padding: 8px 10px 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 5px;
}
.avatar-menu__head b { display: block; font-size: 13px; }
.avatar-menu__head span { font-size: 11px; color: var(--fg-muted); }
.avatar-menu__item {
  width: 100%;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border: none; border-radius: 8px;
  background: transparent; color: var(--fg-sub);
  font-size: 12.5px; cursor: pointer; font-family: inherit;
  transition: all var(--ease);
}
.avatar-menu__item:hover { background: var(--bg-input); color: var(--fg); }
.avatar-menu__item.danger { color: var(--sev-critical); }
.avatar-menu__item.danger:hover {
  background: color-mix(in srgb, var(--sev-critical) 8%, transparent);
}
</style>
