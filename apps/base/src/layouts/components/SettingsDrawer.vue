<script setup lang="ts">
import { useAppStore, THEME_PRESETS, type NavLayout, type ThemeMode } from '@/stores/app'
import AppIcon from '@/components/AppIcon.vue'

const appStore = useAppStore()

const MODES: { key: ThemeMode; label: string }[] = [
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '暗色' },
  { key: 'auto', label: '跟随系统' },
]

const LAYOUTS: { key: NavLayout; label: string }[] = [
  { key: 'side', label: '侧边菜单' },
  { key: 'top', label: '顶部菜单' },
  { key: 'mixed', label: '混合菜单' },
]

function onMode(m: ThemeMode): void {
  appStore.prefs.mode = m
}
function onColor(key: string): void {
  appStore.prefs.color = key
}
function onLayout(l: NavLayout): void {
  appStore.prefs.layout = l
}
function resetAll(): void {
  appStore.resetPrefs()
  appStore.pushToast('已恢复默认配置', 'info')
}
</script>

<template>
  <transition name="drawer-fade">
    <div v-if="appStore.settingsOpen" class="mask" @click.self="appStore.settingsOpen = false">
      <aside class="drawer">
        <header class="drawer__head">
          <b>项目配置</b>
          <button class="icon-btn" @click="appStore.settingsOpen = false"><AppIcon name="close" :size="16" /></button>
        </header>

        <div class="drawer__body">
          <!-- 主题模式 -->
          <section class="sec">
            <h3>主题模式</h3>
            <div class="segmented">
              <button
                v-for="m in MODES"
                :key="m.key"
                class="seg"
                :class="{ active: appStore.prefs.mode === m.key }"
                @click="onMode(m.key)"
              >
                {{ m.label }}
              </button>
            </div>
          </section>

          <!-- 主题色 -->
          <section class="sec">
            <h3>主题色</h3>
            <div class="swatches">
              <button
                v-for="p in THEME_PRESETS"
                :key="p.key"
                class="swatch"
                :class="{ active: appStore.prefs.color === p.key }"
                :title="p.label"
                :style="{ background: `linear-gradient(135deg, ${p.gradFrom}, ${p.gradTo})` }"
                @click="onColor(p.key)"
              >
                <AppIcon v-if="appStore.prefs.color === p.key" name="check" :size="12" />
              </button>
            </div>
            <p class="sec__hint">当前：{{ appStore.preset.label }}（按钮、菜单、高亮全局生效）</p>
          </section>

          <!-- 导航布局 -->
          <section class="sec">
            <h3>导航布局</h3>
            <div class="layout-cards">
              <button
                v-for="l in LAYOUTS"
                :key="l.key"
                class="layout-card"
                :class="{ active: appStore.prefs.layout === l.key }"
                @click="onLayout(l.key)"
              >
                <!-- 纯 CSS 缩略图：示意三种布局的色块结构 -->
                <span class="thumb" :class="`thumb--${l.key}`">
                  <i /><i /><i />
                </span>
                <span>{{ l.label }}</span>
              </button>
            </div>
          </section>

          <!-- 功能开关 -->
          <section class="sec">
            <h3>功能</h3>
            <div class="switch-row">
              <div class="info"><b>多标签页</b><span>关闭后隐藏顶部标签栏</span></div>
              <label class="switch">
                <input v-model="appStore.prefs.showTabs" type="checkbox" />
                <span class="track" /><span class="thumb" />
              </label>
            </div>
            <div class="switch-row">
              <div class="info"><b>色弱模式</b><span>反相 + 色相旋转，辅助色弱识别</span></div>
              <label class="switch">
                <input v-model="appStore.prefs.colorWeak" type="checkbox" />
                <span class="track" /><span class="thumb" />
              </label>
            </div>
            <div class="switch-row">
              <div class="info"><b>灰色模式</b><span>页面去色，专注信息结构</span></div>
              <label class="switch">
                <input v-model="appStore.prefs.gray" type="checkbox" />
                <span class="track" /><span class="thumb" />
              </label>
            </div>
          </section>
        </div>

        <footer class="drawer__foot">
          <button class="btn btn-block" @click="resetAll">恢复默认</button>
        </footer>
      </aside>
    </div>
  </transition>
</template>

<style scoped>
.mask {
  position: fixed; inset: 0; z-index: 88;
  background: rgba(24, 24, 27, 0.35);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}
.drawer {
  position: absolute; top: 0; right: 0; bottom: 0;
  width: min(320px, 92vw);
  display: flex; flex-direction: column;
  background: var(--bg-drawer);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-left: 1px solid color-mix(in srgb, var(--primary) 18%, transparent);
  box-shadow: -20px 0 60px rgba(16, 16, 20, 0.12);
}
/* 入场：遮罩淡入 + 抽屉右滑 */
.drawer-fade-enter-active, .drawer-fade-leave-active { transition: opacity var(--ease); }
.drawer-fade-enter-active .drawer, .drawer-fade-leave-active .drawer { transition: transform var(--ease); }
.drawer-fade-enter-from, .drawer-fade-leave-to { opacity: 0; }
.drawer-fade-enter-from .drawer, .drawer-fade-leave-to .drawer { transform: translateX(100%); }

.drawer__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.drawer__head b { font-size: 14px; }
.drawer__body { flex: 1; overflow-y: auto; padding: 6px 16px; }
.drawer__foot { padding: 14px 16px; border-top: 1px solid var(--border); }

.sec { padding: 14px 0; border-bottom: 1px dashed var(--border); }
.sec:last-child { border-bottom: none; }
.sec h3 { font-size: 12px; color: var(--fg-muted); margin-bottom: 10px; letter-spacing: 0.5px; }
.sec__hint { margin-top: 9px; font-size: 11px; color: var(--fg-muted); }

.swatches { display: flex; flex-wrap: wrap; gap: 10px; }
.swatch {
  width: 30px; height: 30px; border-radius: 50%;
  border: 2px solid transparent; color: #fff;
  display: grid; place-items: center;
  cursor: pointer;
  transition: transform var(--ease), border-color var(--ease);
}
.swatch:hover { transform: scale(1.1); }
.swatch.active { border-color: var(--fg); }

.layout-cards { display: flex; gap: 10px; }
.layout-card {
  flex: 1; padding: 9px 4px 7px;
  display: flex; flex-direction: column; align-items: center; gap: 7px;
  background: var(--bg-input);
  border: 1.5px solid transparent; border-radius: var(--radius-ctl);
  color: var(--fg-muted); font-size: 11.5px;
  cursor: pointer; font-family: inherit;
  transition: all var(--ease);
}
.layout-card:hover { color: var(--fg-sub); }
.layout-card.active {
  border-color: color-mix(in srgb, var(--primary) 55%, transparent);
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 7%, transparent);
}
/* 布局缩略图：i 色块网格示意 */
.thumb {
  width: 46px; height: 32px; border-radius: 5px;
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  display: grid; gap: 2px; padding: 3px;
}
.thumb i { background: color-mix(in srgb, currentColor 45%, transparent); border-radius: 2px; }
.thumb--side { grid-template-columns: 12px 1fr; grid-template-rows: 1fr 1fr; }
.thumb--side i:first-child { grid-row: 1 / 3; background: color-mix(in srgb, var(--primary) 55%, transparent); }
.thumb--top { grid-template-columns: 1fr 1fr; grid-template-rows: 9px 1fr; }
.thumb--top i:first-child { grid-column: 1 / 3; background: color-mix(in srgb, var(--primary) 55%, transparent); }
.thumb--mixed { grid-template-columns: 1fr 1fr 10px; grid-template-rows: 9px 1fr; }
.thumb--mixed i:first-child { grid-column: 1 / 4; background: color-mix(in srgb, var(--primary) 55%, transparent); }
.thumb--mixed i:nth-child(3) { grid-row: 2; background: color-mix(in srgb, var(--primary) 35%, transparent); }
</style>
