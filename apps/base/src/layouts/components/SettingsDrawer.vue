<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore, THEME_PRESETS, type ApiMode, type NavLayout, type ThemeMode } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { LANG_OPTIONS, type Lang } from '@/locales'
import AppIcon from '@/components/AppIcon.vue'

const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const { t } = useI18n()

/** 选项数组用 computed 生成：label 走词条，切语言时选项文案跟着变 */
const MODES = computed(() => [
  { value: 'light' as ThemeMode, label: t('settings.light') },
  { value: 'dark' as ThemeMode, label: t('settings.dark') },
  { value: 'auto' as ThemeMode, label: t('settings.auto') },
])

/** 数据源选项：全平台唯一的 mock/real 控制点，切换后经数据通道下发子应用 */
const API_MODES = computed(() => [
  { value: 'mock' as ApiMode, label: t('settings.dataSourceMock') },
  { value: 'real' as ApiMode, label: t('settings.dataSourceReal') },
])

const LAYOUTS = computed(() => [
  { key: 'side' as NavLayout, label: t('settings.layoutSide') },
  { key: 'top' as NavLayout, label: t('settings.layoutTop') },
  { key: 'mixed' as NavLayout, label: t('settings.layoutMixed') },
])

function onLangChange(v: string | number): void {
  appStore.prefs.lang = v as Lang
}

/**
 * 切换数据源：已登录时当前会话属于旧模式（mock 会话是假 token、real 会话
 * 配 mock 数据都是脏状态），直接作废回登录页重新登录——换来一条强不变量：
 * "会话永远属于当前数据源"。logout 顺手销毁后端会话，失败不阻塞本地登出
 * （旧 token 若已无效，A0401 也会被 http.ts 处理成跳登录，殊途同归）。
 */
async function onApiModeChange(v: string | number): Promise<void> {
  appStore.prefs.apiMode = v as ApiMode
  if (userStore.token) {
    // 等待本地 token / userInfo 清理完成后再跳转，否则路由守卫可能把登录页弹回工作台
    await userStore.logout()
    appStore.pushToast(t('settings.apiModeResetToast'), 'info')
    router.push('/login')
  }
}

/** 主题色名称展示：预设 label 是数据文案，暂不进词条（后续做多语言预设名再收编） */
const presetLabel = computed(() => appStore.preset.label)

function resetAll(): void {
  appStore.resetPrefs()
  appStore.pushToast(t('settings.resetToast'), 'info')
}
</script>

<template>
  <a-drawer
    :open="appStore.settingsOpen"
    :title="t('settings.title')"
    placement="right"
    :width="320"
    class="settings-drawer"
    @close="appStore.settingsOpen = false"
  >
    <div class="drawer-body">
      <!-- 主题模式 -->
      <section class="sec">
        <h3>{{ t('settings.mode') }}</h3>
        <a-segmented v-model:value="appStore.prefs.mode" :options="MODES" block />
      </section>

      <!-- 主题色 -->
      <section class="sec">
        <h3>{{ t('settings.color') }}</h3>
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
        <p class="sec__hint">{{ t('settings.colorHint', { name: presetLabel }) }}</p>
      </section>

      <!-- 导航布局：缩略图是自研示意，antd 无对应形态 -->
      <section class="sec">
        <h3>{{ t('settings.layout') }}</h3>
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

      <!-- 界面语言：切换后基座立即生效，并随数据通道下发子应用 -->
      <section class="sec">
        <h3>{{ t('settings.lang') }}</h3>
        <a-segmented
          :value="appStore.prefs.lang"
          :options="LANG_OPTIONS"
          block
          @change="onLangChange"
        />
      </section>

      <!--
        数据源：与登录页同一真源（prefs.apiMode）的两个入口之一。
        真源必须唯一且在基座——子应用页面上不允许出现开关（历史教训：
        发包器页头曾放过一个模式按钮，已移除）。已登录时切换会重置会话回登录页。
      -->
      <section class="sec">
        <h3>{{ t('settings.dataSource') }}</h3>
        <a-segmented
          :value="appStore.prefs.apiMode"
          :options="API_MODES"
          block
          @change="onApiModeChange"
        />
        <p class="sec__hint">{{ t('settings.dataSourceHint') }}</p>
      </section>

      <!-- 功能开关 -->
      <section class="sec">
        <h3>{{ t('settings.features') }}</h3>
        <div class="switch-row">
          <div class="info"><b>{{ t('settings.showTabs') }}</b><span>{{ t('settings.showTabsHint') }}</span></div>
          <a-switch v-model:checked="appStore.prefs.showTabs" size="small" />
        </div>
        <div class="switch-row">
          <div class="info"><b>{{ t('settings.colorWeak') }}</b><span>{{ t('settings.colorWeakHint') }}</span></div>
          <a-switch v-model:checked="appStore.prefs.colorWeak" size="small" />
        </div>
        <div class="switch-row">
          <div class="info"><b>{{ t('settings.gray') }}</b><span>{{ t('settings.grayHint') }}</span></div>
          <a-switch v-model:checked="appStore.prefs.gray" size="small" />
        </div>
      </section>
    </div>

    <template #footer>
      <a-button block @click="resetAll">{{ t('settings.reset') }}</a-button>
    </template>
  </a-drawer>
</template>

<style scoped lang="less">
.drawer-body {
  /* a-drawer 内容区自带 padding，这里只管分区节奏 */
  display: flex; flex-direction: column;
}

.sec {
  padding: 14px 0; border-bottom: 1px dashed var(--border);

  &:first-child { padding-top: 0; }
  &:last-child { border-bottom: none; }

  h3 { font-size: 12px; color: var(--fg-muted); margin-bottom: 10px; letter-spacing: 0.5px; }

  &__hint { margin-top: 9px; font-size: 11px; color: var(--fg-muted); }
}

.swatches { display: flex; flex-wrap: wrap; gap: 10px; }
.swatch {
  width: 30px; height: 30px; border-radius: 50%;
  border: 2px solid transparent; color: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: transform var(--ease), border-color var(--ease);

  &:hover { transform: scale(1.1); }
  &.active { border-color: var(--fg); }
}

.switch-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 0;

  .info {
    b { display: block; font-size: 12.5px; }
    span { font-size: 11px; color: var(--fg-muted); }
  }
}

.layout-cards { display: flex; gap: 10px; }
.layout-card {
  flex: 1; padding: 9px 4px 7px;
  display: flex; flex-direction: column; align-items: center; gap: 7px;
  background: var(--bg-input);
  border: 1.5px solid transparent; border-radius: var(--radius-ctl);
  color: var(--fg-muted); font-size: 11.5px;
  cursor: pointer; font-family: inherit;
  transition: all var(--ease);

  &:hover { color: var(--fg-sub); }
  &.active {
    border-color: color-mix(in srgb, var(--primary) 55%, transparent);
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 7%, transparent);
  }
}

/* 布局缩略图：i 色块网格示意 */
.thumb {
  width: 46px; height: 32px; border-radius: 5px;
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  display: grid; gap: 2px; padding: 3px;

  i { background: color-mix(in srgb, currentColor 45%, transparent); border-radius: 2px; }

  &--side {
    grid-template-columns: 12px 1fr; grid-template-rows: 1fr 1fr;
    i:first-child { grid-row: 1 / 3; background: color-mix(in srgb, var(--primary) 55%, transparent); }
  }

  &--top {
    grid-template-columns: 1fr 1fr; grid-template-rows: 9px 1fr;
    i:first-child { grid-column: 1 / 3; background: color-mix(in srgb, var(--primary) 55%, transparent); }
  }

  &--mixed {
    grid-template-columns: 1fr 1fr 10px; grid-template-rows: 9px 1fr;
    i:first-child { grid-column: 1 / 4; background: color-mix(in srgb, var(--primary) 55%, transparent); }
    i:nth-child(3) { grid-row: 2; background: color-mix(in srgb, var(--primary) 35%, transparent); }
  }
}
</style>
