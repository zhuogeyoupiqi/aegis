<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore, type TagItem } from '@/stores/app'
import { normalizeTabPath } from '@/router'
import AppIcon from '@/components/AppIcon.vue'

const appStore = useAppStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

/** 子应用识别色（与原型一致：base 蓝 / soc 青 / asset 蓝 / ai 粉紫 / system 琥珀） */
const APP_COLORS: Record<string, string> = {
  base: '#3b82f6',
  'soc-tools': '#06b6d4',
  'asset-repo': '#2563eb',
  'ai-studio': '#d946ef',
  'system-admin': '#f59e0b',
}

/** 标签识别色：按 appCode 取子应用专属色，未登记的用 base 蓝 */
function tabColor(tab: TagItem): string {
  return APP_COLORS[tab.appCode] || '#3b82f6'
}

function isActive(tab: TagItem): boolean {
  // 两边都走规范化：标签身份只认 path + 我们自己的语义 query，URL 上的外部杂质不参与比较
  return tab.path === normalizeTabPath(route.fullPath)
}

/** 关闭标签：若关的是当前页，跳到相邻标签（优先右侧，越界回左侧） */
function closeTab(tab: TagItem): void {
  if (tab.affix) return
  const idx = appStore.tabs.findIndex((t) => t.path === tab.path)
  appStore.removeTab(tab.path)
  if (isActive(tab)) {
    const next = appStore.tabs[Math.min(idx, appStore.tabs.length - 1)]
    if (next) router.push(next.path)
  }
}

/** 点击标签切换页面 */
function clickTab(tab: TagItem): void {
  router.push(tab.path)
}

/* ---------- 右键菜单 ---------- */
const ctx = reactive({ visible: false, x: 0, y: 0, target: null as TagItem | null })

/** 打开右键菜单：坐标夹在视口内，避免在屏幕边缘弹出后被裁掉 */
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
/** 点击任意处收起右键菜单（document 级监听，随组件卸载摘除） */
function onDocClick(): void {
  closeCtx()
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

/** 右键「刷新」：refreshKey 递增触发当前页整体重建 */
function ctxRefresh(): void {
  if (ctx.target) appStore.pushToast(t('tags.refreshToast', { title: t(ctx.target.title) }))
  appStore.refresh()
  closeCtx()
}
/** 右键「固定」：affix 标记取反，固定后不可关闭 */
function ctxPin(): void {
  // 固定 = 把该标签标记为 affix：不可关闭、常驻最前语义
  const tab = appStore.tabs.find((t) => t.path === ctx.target?.path)
  if (tab) {
    tab.affix = !tab.affix
    appStore.pushToast(
      tab.affix
        ? t('tags.pinnedToast', { title: t(tab.title) })
        : t('tags.unpinnedToast', { title: t(tab.title) }),
      'info',
    )
  }
  closeCtx()
}
/** 右键「关闭」：复用标签关闭逻辑 */
function ctxClose(): void {
  if (ctx.target) closeTab(ctx.target)
  closeCtx()
}
/** 右键「关闭其他」：保留 affix 与目标标签，被关掉的是当前页时跳到目标 */
function ctxCloseOthers(): void {
  if (!ctx.target) return
  appStore.closeOthers(ctx.target.path)
  if (!isActive(ctx.target)) router.push(ctx.target.path)
  appStore.pushToast(t('tags.closeOthersToast'), 'info')
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
        <!-- 标签标题存的是词条 key，这里解析渲染（语言切换响应式跟随） -->
        <span class="tab__title">{{ t(tab.title) }}</span>
        <span v-if="tab.affix" class="tab__pin" :title="t('tags.pinned')"><AppIcon name="lock" :size="10" /></span>
        <span v-else class="tab__close" :title="t('tags.close')" @click.stop="closeTab(tab)">
          <AppIcon name="close" :size="10" />
        </span>
      </div>
    </div>
    <div class="tag-actions">
      <button
        class="icon-btn"
        :title="t('tags.refreshPage')"
        @click="appStore.refresh(); appStore.pushToast(t('tags.refreshPageToast'))"
      >
        <AppIcon name="refresh" :size="14" />
      </button>
    </div>

    <!--
      右键菜单必须 Teleport 到 body：标签栏有 backdrop-filter，会让它成为
      fixed 后代的包含块，position:fixed 的菜单实际相对标签栏定位（位置错乱）
    -->
    <Teleport to="body">
      <div v-if="ctx.visible" class="ctx-menu" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }">
        <div class="ctx-item" @click="ctxRefresh"><AppIcon name="refresh" :size="13" /> {{ t('tags.refresh') }}</div>
        <div class="ctx-item" @click="ctxPin"><AppIcon name="lock" :size="13" /> {{ t('tags.pin') }}</div>
        <div class="ctx-item" :class="{ disabled: ctx.target?.affix }" @click="ctxClose">
          <AppIcon name="close" :size="13" /> {{ t('tags.close') }}
        </div>
        <div class="ctx-item" @click="ctxCloseOthers"><AppIcon name="chevronRight" :size="13" /> {{ t('tags.closeOthers') }}</div>
      </div>
    </Teleport>
  </nav>
</template>

<style scoped lang="less">
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

  &::-webkit-scrollbar { display: none; }
}

.tab {
  position: relative;
  display: flex; align-items: center; gap: 7px;
  padding: 0 14px; max-width: 190px;
  color: var(--fg-muted); cursor: pointer; user-select: none;
  font-size: 12.5px; white-space: nowrap;
  transition: color var(--ease), background var(--ease);

  &:hover { color: var(--fg-sub); background: var(--bg-input); }
  &.active {
    color: var(--fg); background: var(--bg-card); font-weight: 600;

    /* 子应用识别色条 */
    .tab__strip { background: var(--tab-color); }
  }

  &__strip {
    position: absolute; top: 0; left: 10px; right: 10px; height: 2.5px;
    border-radius: 0 0 3px 3px;
    background: transparent;
    transition: background var(--ease);
  }

  &__title { overflow: hidden; text-overflow: ellipsis; }
  &__pin { color: var(--tab-color); display: flex; align-items: center; justify-content: center; }

  &__close {
    width: 16px; height: 16px; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    color: var(--fg-muted); opacity: 0;
    transition: all var(--ease);

    .tab:hover & { opacity: 1; }

    &:hover {
      background: color-mix(in srgb, var(--sev-critical) 10%, transparent);
      color: var(--sev-critical);
    }
  }
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

  &:hover {
    background: color-mix(in srgb, var(--primary) 7%, transparent);
    color: var(--fg);
  }

  &.disabled { opacity: 0.4; pointer-events: none; }
}
</style>
