<script setup lang="ts">
import { useAppStore, THEME_PRESETS, type NavLayout, type ThemeMode } from '@/stores/app'
import AppIcon from '@/components/AppIcon.vue'

const appStore = useAppStore()

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '暗色' },
  { value: 'auto', label: '跟随系统' },
]

const LAYOUTS: { key: NavLayout; label: string }[] = [
  { key: 'side', label: '侧边菜单' },
  { key: 'top', label: '顶部菜单' },
  { key: 'mixed', label: '混合菜单' },
]

function resetAll(): void {
  appStore.resetPrefs()
  appStore.pushToast('已恢复默认配置', 'info')
}
</script>

<template>
  <a-drawer
    :open="appStore.settingsOpen"
    title="项目配置"
    placement="right"
    :width="320"
    class="settings-drawer"
    @close="appStore.settingsOpen = false"
  >
    <div class="drawer-body">
      <!-- 主题模式 -->
      <section class="sec">
        <h3>主题模式</h3>
        <a-segmented v-model:value="appStore.prefs.mode" :options="MODES" block />
      </section>

      <!-- 主题色 -->
      <section class="sec">
        <h3>主题色</h3>
        <!-- 色板是品牌表达，antd 无对应形态，保持自研 -->
        <div class="swatches">
          <button
            v-for="p in THEME_PRESETS"
            :key="p.key"
            class="swatch"
            :class="{ active: appStore.prefs.color === p.key }"
            :title="p.label"
            :style="{ background: `linear-gradient(135deg, ${p.gradFrom}, ${p.gradTo})` }"
            @click="appStore.prefs.color = p.key"
          >
            <AppIcon v-if="appStore.prefs.color === p.key" name="check" :size="12" />
          </button>
        </div>
        <p class="sec__hint">当前：{{ appStore.preset.label }}（按钮、菜单、高亮全局生效）</p>
      </section>

      <!-- 导航布局：缩略图是自研示意，antd 无对应形态 -->
      <section class="sec">
        <h3>导航布局</h3>
        <div class="layout-cards">
          <button
            v-for="l in LAYOUTS"
            :key="l.key"
            class="layout-card"
            :class="{ active: appStore.prefs.layout === l.key }"
            @click="appStore.prefs.layout = l.key"
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
          <a-switch v-model:checked="appStore.prefs.showTabs" size="small" />
        </div>
        <div class="switch-row">
          <div class="info"><b>色弱模式</b><span>反相 + 色相旋转，辅助色弱识别</span></div>
          <a-switch v-model:checked="appStore.prefs.colorWeak" size="small" />
        </div>
        <div class="switch-row">
          <div class="info"><b>灰色模式</b><span>页面去色，专注信息结构</span></div>
          <a-switch v-model:checked="appStore.prefs.gray" size="small" />
        </div>
      </section>
    </div>

    <template #footer>
      <a-button block @click="resetAll">恢复默认</a-button>
    </template>
  </a-drawer>
</template>

<style scoped>
.drawer-body {
  /* a-drawer 内容区自带 padding，这里只管分区节奏 */
  display: flex; flex-direction: column;
}
.sec { padding: 14px 0; border-bottom: 1px dashed var(--border); }
.sec:first-child { padding-top: 0; }
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

.switch-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 0;
}
.switch-row .info b { display: block; font-size: 12.5px; }
.switch-row .info span { font-size: 11px; color: var(--fg-muted); }

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
