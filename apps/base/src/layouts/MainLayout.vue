<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { App } from 'ant-design-vue'
import { bindFeedback } from '@aegis/shared'
import { useAppStore } from '@/stores/app'
import { useMenuStore } from '@/stores/menu'
import SideMenu from './components/SideMenu.vue'
import TopBar from './components/TopBar.vue'
import TopNavMenu from './components/TopNavMenu.vue'
import TagsView from './components/TagsView.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'

const appStore = useAppStore()
const menuStore = useMenuStore()
const route = useRoute()

// 本组件渲染在 <a-app> 内：把带主题上下文的 message 实例接入 shared 的 toast 通道
bindFeedback(App.useApp().message)

onMounted(() => {
  menuStore.ensureLoaded()
})

/**
 * mixed 布局下顶部分组要跟随当前页面。
 * coming-soon 页拿不到 path 对应项，退化用 query.title 匹配菜单标题。
 */
function syncTopGroup(): void {
  if (appStore.prefs.layout !== 'mixed') return
  const item =
    menuStore.findItem(route.path) ??
    menuStore.flatItems.find((i) => route.path === '/coming-soon' && i.title === route.query.title)
  if (item) appStore.activeTopGroup = item.groupKey
}

watch(() => route.fullPath, syncTopGroup)
watch(() => menuStore.loaded, syncTopGroup)
watch(() => appStore.prefs.layout, syncTopGroup)
</script>

<template>
  <!-- 布局模式由 prefs.layout 决定：side（默认）/ top / mixed -->
  <div class="shell" :class="`shell--${appStore.prefs.layout}`">
    <SideMenu v-if="appStore.prefs.layout !== 'top'" />

    <div class="shell__main">
      <TopBar />
      <!-- top/mixed 模式的顶部菜单条：top 弹下拉，mixed 驱动侧栏 -->
      <TopNavMenu v-if="appStore.prefs.layout !== 'side'" />
      <TagsView v-if="appStore.prefs.showTabs" />

      <main class="shell__content">
        <!-- refreshKey 变化 = 整页重建（含子应用 micro-app 销毁重载） -->
        <router-view :key="appStore.refreshKey" />
      </main>
    </div>

    <SettingsDrawer />
  </div>
</template>

<style scoped>
.shell {
  height: 100vh;
  display: flex;
  overflow: hidden;
}
.shell__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.shell__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 20px 28px;
}
</style>
