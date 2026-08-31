<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore, type TagItem } from '@/stores/app'
import { normalizeTabPath } from '@/router'
import AppIcon from '@/components/AppIcon.vue'

const appStore = useAppStore()
const route = useRoute()
const router = useRouter()

/** 子应用识别色（与原型一致：base 蓝 / soc 青 / asset 蓝 / ai 粉紫 / system 琥珀） */
const APP_COLORS: Record<string, string> = {
  base: '#3b82f6',
  'soc-tools': '#06b6d4',
  'asset-repo': '#2563eb',
  'ai-studio': '#d946ef',
  'system-admin': '#f59e0b',
}

function tabColor(tab: TagItem): string {
  return APP_COLORS[tab.appCode] || '#3b82f6'
}

function isActive(tab: TagItem): boolean {
  // 两边都走规范化：标签身份只认 path + 我们自己的语义 query，URL 上的外部杂质不参与比较
  return tab.path === normalizeTabPath(route.fullPath)
}

/** 关闭标签：若关的是当前页，跳到相邻标签 */
function closeTab(tab: TagItem): void {
  if (tab.affix) return
  const idx = appStore.tabs.findIndex((t) => t.path === tab.path)
  appStore.removeTab(tab.path)
  if (isActive(tab)) {
    const next = appStore.tabs[Math.min(idx, appStore.tabs.length - 1)]
    if (next) router.push(next.path)
  }
}

function clickTab(tab: TagItem): void {
  router.push(tab.path)
}

/* ---------- 右键菜单 ---------- */
const ctx = reactive({ visible: false, x: 0, y: 0, target: null as TagItem | null })

function openCtx(e: MouseEvent, tab: TagItem): void {
  e.preventDefault()
  ctx.target = tab
  ctx.x = Math.min(e.clientX, window.innerWidth - 190)
  ctx.y = Math.min(e.clientY, window.innerHeight - 200)
  ctx.visible = true
}
function closeCtx(): void {
  ctx.visible = false
}
function onDocClick(): void {
  closeCtx()
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

function ctxRefresh(): void {
  if (ctx.target) appStore.pushToast(`已刷新「${ctx.target.title}」`)
  appStore.refresh()
  closeCtx()
}
function ctxPin(): void {
  // 固定 = 把该标签标记为 affix：不可关闭、常驻最前语义
  const tab = appStore.tabs.find((t) => t.path === ctx.target?.path)
  if (tab) {
    tab.affix = !tab.affix
    appStore.pushToast(tab.affix ? `已固定「${tab.title}」` : `已取消固定「${tab.title}」`, 'info')
  }
  closeCtx()
}
function ctxClose(): void {
  if (ctx.target) closeTab(ctx.target)
  closeCtx()
}
function ctxCloseOthers(): void {
  if (!ctx.target) return
  appStore.closeOthers(ctx.target.path)
  if (!isActive(ctx.target)) router.push(ctx.target.path)
  appStore.pushToast('已关闭其他标签页', 'info')
  closeCtx()
}
</script>

<template>
  <nav class="tagsview">
    <div class="tabs">
      <div
        v-for="tab in appStore.tabs"
        :key="tab.path"
        class="tab"
        :class="{ active: isActive(tab) }"
        :style="{ '--tab-color': tabColor(tab) }"
        @click="clickTab(tab)"
        @contextmenu="openCtx($event, tab)"
      >
        <span class="tab__strip" />
        <span class="tab__title">{{ tab.title }}</span>
        <span v-if="tab.affix" class="tab__pin" title="已固定"><AppIcon name="lock" :size="10" /></span>
        <span v-else class="tab__close" title="关闭" @click.stop="closeTab(tab)">
          <AppIcon name="close" :size="10" />
        </span>
      </div>
    </div>
    <div class="tag-actions">
      <button class="icon-btn" title="刷新当前页" @click="appStore.refresh(); appStore.pushToast('已刷新当前页面')">
        <AppIcon name="refresh" :size="14" />
      </button>
    </div>

    <!--
      右键菜单必须 Teleport 到 body：标签栏有 backdrop-filter，会让它成为
      fixed 后代的包含块，position:fixed 的菜单实际相对标签栏定位（位置错乱）
    -->
    <Teleport to="body">
      <div v-if="ctx.visible" class="ctx-menu" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }">
        <div class="ctx-item" @click="ctxRefresh"><AppIcon name="refresh" :size="13" /> 刷新</div>
        <div class="ctx-item" @click="ctxPin"><AppIcon name="lock" :size="13" /> 固定/取消固定</div>
        <div class="ctx-item" :class="{ disabled: ctx.target?.affix }" @click="ctxClose">
          <AppIcon name="close" :size="13" /> 关闭标签页
        </div>
        <div class="ctx-item" @click="ctxCloseOthers"><AppIcon name="chevronRight" :size="13" /> 关闭其他</div>
      </div>
    </Teleport>
  </nav>
</template>

<style scoped>
.tagsview {
  height: 40px;
  flex: none;
  display: flex;
  align-items: stretch;
  background: var(--bg-glass);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
  padding: 0 6px;
  position: relative;
  z-index: 20;
}
.tabs {
  display: flex; align-items: stretch;
  overflow-x: auto; scrollbar-width: none;
}
.tabs::-webkit-scrollbar { display: none; }
.tab {
  position: relative;
  display: flex; align-items: center; gap: 7px;
  padding: 0 14px; max-width: 190px;
  color: var(--fg-muted); cursor: pointer; user-select: none;
  font-size: 12.5px; white-space: nowrap;
  transition: color var(--ease), background var(--ease);
}
.tab:hover { color: var(--fg-sub); background: var(--bg-input); }
.tab.active { color: var(--fg); background: var(--bg-card); font-weight: 600; }
/* 子应用识别色条 */
.tab__strip {
  position: absolute; top: 0; left: 10px; right: 10px; height: 2.5px;
  border-radius: 0 0 3px 3px;
  background: transparent;
  transition: background var(--ease);
}
.tab.active .tab__strip { background: var(--tab-color); }
.tab__title { overflow: hidden; text-overflow: ellipsis; }
.tab__pin { color: var(--tab-color); display: grid; place-items: center; }
.tab__close {
  width: 16px; height: 16px; border-radius: 4px;
  display: grid; place-items: center;
  color: var(--fg-muted); opacity: 0;
  transition: all var(--ease);
}
.tab:hover .tab__close { opacity: 1; }
.tab__close:hover {
  background: color-mix(in srgb, var(--sev-critical) 10%, transparent);
  color: var(--sev-critical);
}
.tag-actions { margin-left: auto; display: flex; align-items: center; }

.ctx-menu {
  position: fixed;
  min-width: 160px; padding: 5px;
  background: var(--bg-float);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-float);
  z-index: 95;
}
.ctx-item {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 11px; border-radius: 8px;
  color: var(--fg-sub); font-size: 12.5px; cursor: pointer;
  transition: all var(--ease);
}
.ctx-item:hover {
  background: color-mix(in srgb, var(--primary) 7%, transparent);
  color: var(--fg);
}
.ctx-item.disabled { opacity: 0.4; pointer-events: none; }
</style>
