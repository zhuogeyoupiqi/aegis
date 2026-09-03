<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { App } from 'ant-design-vue'
import { applyThemeSnapshot, bindFeedback, lastThemeSnapshot } from '@aegis/shared'
import AppIcon from '@/components/AppIcon.vue'
import ItemDetailPanel from '@/components/ItemDetailPanel.vue'
import ItemFormDrawer from '@/components/ItemFormDrawer.vue'

import { useAssetRepo } from '@/composables/useAssetRepo'
import { useShiki } from '@/composables/useShiki'
import { getApiMode } from '@/api/mode'
import { ASSET_TYPE_META, type AssetType } from '@/api/types'

const { t } = useI18n()

// 接入 <a-app> 上下文：toast 与确认弹窗要吃当前主题（暗色不闪白底）
const { message: antdMessage } = App.useApp()
bindFeedback(antdMessage)

const {
  items,
  loading,
  kw,
  typeFilter,
  tagFilter,
  tagOptions,
  selectedId,
  reload,
  openCreate,
  cleanup,
} = useAssetRepo()

// Shiki 语法预加载藏进首屏：右栏第一次渲染代码时大概率已就绪
const { preload } = useShiki()

/** 数据源只读徽标：模式控制点在基座（登录页/设置抽屉），子应用页面禁止出现开关 */
const apiModeLabel = computed(() => (getApiMode() === 'real' ? t('repo.sourceReal') : t('repo.sourceMock')))

const ASSET_TYPES: AssetType[] = ['snippet', 'component', 'function', 'doc', 'link']
const typeOptions = computed(() => [
  { label: t('repo.typeAll'), value: '' },
  ...ASSET_TYPES.map((v) => ({ label: t(`repo.types.${v}`), value: v })),
])
const tagSelectOptions = computed(() => tagOptions.value.map((v) => ({ label: `#${v}`, value: v })))

// 两种主视图模式：卡片网格（默认，更像资产仓库首页）/ 列表分栏（传统 Gist 式）
const layoutMode = ref<'grid' | 'list'>('grid')

onMounted(async () => {
  await reload()
  // 列表分栏模式初始化时落到首条，让右栏有内容；卡片网格保持未选中。
  if (layoutMode.value === 'list' && !selectedId.value && items.value.length) {
    selectedId.value = items.value[0].id
  }
  preload()
})

onUnmounted(() => {
  // 子应用被 micro-app 销毁时，取消未触发的搜索防抖定时器，避免内存泄漏与幽灵请求
  cleanup()
})

// 基座设置抽屉切换 mock/real 后，数据源模式变化，列表应自动重查
watch(
  () => getApiMode(),
  () => {
    void reload()
  },
)

// 列表数据变化时（搜索/筛选/保存后重查），卡片网格模式保持首页态，
// 避免关键字一敲完就自动跳转到第一条详情。
watch(items, () => {
  if (layoutMode.value === 'grid') {
    selectedId.value = null
  }
})

// 切换视图模式时同步选中态：
// - 切到卡片网格：清空选中，回到网格首页；
// - 切到列表分栏：如果没有选中，自动落到首条（保持右栏有内容）。
watch(layoutMode, (mode) => {
  if (mode === 'grid') {
    selectedId.value = null
  } else if (!selectedId.value && items.value.length) {
    selectedId.value = items.value[0].id
  }
})

// 独立运行（直接访问子应用 dev 端口）时显示主题切换按钮；被基座装载后主题由基座统一控制
const isStandalone = ref(typeof window !== 'undefined' && !(window as unknown as { microApp?: unknown }).microApp)
const isDark = computed(() => lastThemeSnapshot.value?.mode === 'dark')
function toggleTheme(): void {
  const next = isDark.value ? 'light' : 'dark'
  applyThemeSnapshot({
    mode: next,
    primary: lastThemeSnapshot.value?.primary ?? '#7c3aed',
    gradFrom: lastThemeSnapshot.value?.gradFrom ?? '#7c3aed',
    gradTo: lastThemeSnapshot.value?.gradTo ?? '#c026d3',
  })
}
</script>

<template>
  <div class="repo">
    <!-- 顶部页头：标题 + 视图切换 + 新建 -->
    <header class="repo__head">
      <div class="head-text">
        <h1>
          {{ t('repo.title') }}
          <span class="mode-badge">{{ apiModeLabel }}</span>
        </h1>
        <p>{{ t('repo.desc') }}</p>
      </div>
      <div class="head-actions">
        <!-- 视图切换：卡片网格 vs 列表分栏 -->
        <div class="view-toggle">
          <button
            class="view-toggle__btn"
            :class="{ active: layoutMode === 'grid' }"
            :title="t('repo.viewGrid')"
            @click="layoutMode = 'grid'"
          >
            <AppIcon name="grid" :size="14" />
          </button>
          <button
            class="view-toggle__btn"
            :class="{ active: layoutMode === 'list' }"
            :title="t('repo.viewList')"
            @click="layoutMode = 'list'"
          >
            <AppIcon name="list" :size="14" />
          </button>
        </div>

        <button v-if="isStandalone" class="theme-toggle" :title="t(isDark ? 'repo.themeLight' : 'repo.themeDark')" @click="toggleTheme">
          <AppIcon :name="isDark ? 'sun' : 'moon'" :size="15" />
        </button>
        <button class="btn btn-primary create-btn" @click="openCreate">
          <AppIcon name="plus" :size="13" />
          {{ t('repo.create') }}
        </button>
      </div>
    </header>

    <!-- 模式 A：卡片网格（默认） -->
    <template v-if="layoutMode === 'grid' && !selectedId">
      <!-- 网格顶部工具条：搜索 + 类型 + 标签 -->
      <div class="repo__toolbar panel">
        <div class="search-wrap">
          <AppIcon name="search" :size="13" class="search-icon" />
          <a-input v-model:value="kw" class="kw-input" :placeholder="t('repo.searchPlaceholder')" />
        </div>

        <div class="segmented type-seg">
          <button
            v-for="opt in typeOptions"
            :key="opt.value"
            class="seg"
            :class="{ active: typeFilter === opt.value }"
            @click="typeFilter = opt.value as AssetType | ''"
          >
            {{ opt.label }}
          </button>
        </div>

        <a-select
          v-model:value="tagFilter"
          class="tag-select"
          :options="tagSelectOptions"
          :placeholder="t('repo.tagPlaceholder')"
          allow-clear
        />
      </div>

      <!-- 卡片网格主体 -->
      <div class="repo__grid-wrap">
        <a-spin :spinning="loading" wrapper-class-name="grid-spin" size="small">
          <div v-if="!loading && items.length === 0" class="grid-empty">
            <AppIcon name="box" :size="56" />
            <p class="grid-empty__title">{{ t('repo.listEmpty') }}</p>
            <p class="grid-empty__hint">{{ t('repo.listEmptyHint') }}</p>
            <button class="btn btn-primary" @click="openCreate">
              <AppIcon name="plus" :size="13" />
              {{ t('repo.create') }}
            </button>
          </div>

          <div v-else class="grid">
            <button
              v-for="item in items"
              :key="item.id"
              class="card"
              :class="`card--${item.type}`"
              @click="selectedId = item.id"
            >
              <span class="card__bar" :style="{ background: `var(--type-${ASSET_TYPE_META[item.type].color})` }" />
              <div class="card__content">
                <div class="card__top">
                  <AppIcon :name="ASSET_TYPE_META[item.type].icon" :size="15" />
                  <span class="card__name">{{ item.name }}</span>
                </div>

                <p v-if="item.description" class="card__desc">{{ item.description }}</p>

                <div class="card__meta">
                  <span class="card__type" :class="`type-${item.type}`">{{ t(`repo.types.${item.type}`) }}</span>
                  <span v-if="item.lang && item.type !== 'doc' && item.type !== 'link'" class="card__lang">{{ item.lang }}</span>
                  <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="card__tag">#{{ tag }}</span>
                  <span v-if="item.tags.length > 3" class="card__tag-more">+{{ item.tags.length - 3 }}</span>
                </div>

                <div class="card__foot">
                  <span class="card__count" :title="t('repo.copyCount', { n: item.copyCount })">
                    <AppIcon name="copy" :size="11" />
                    {{ item.copyCount }}
                  </span>
                  <span class="card__time">{{ item.updateTime?.slice(0, 10) ?? '' }}</span>
                </div>
              </div>
            </button>
          </div>
        </a-spin>
      </div>
    </template>

    <!-- 模式 A-详情：从卡片点进来的单资产详情 -->
    <div v-else-if="layoutMode === 'grid' && selectedId" class="repo__detail-full panel">
      <div class="detail-back">
        <button class="btn btn-ghost btn-sm" @click="selectedId = null">
          <AppIcon name="arrowLeft" :size="13" />
          {{ t('repo.backToGrid') }}
        </button>
      </div>
      <ItemDetailPanel />
      <ItemFormDrawer />
    </div>

    <!-- 模式 B：列表分栏（原有布局） -->
    <div v-else class="repo__body">
      <aside class="repo__list panel">
        <div class="list-toolbar">
          <div class="search-wrap">
            <AppIcon name="search" :size="13" class="search-icon" />
            <a-input v-model:value="kw" class="kw-input" :placeholder="t('repo.searchPlaceholder')" />
          </div>

          <div class="segmented type-seg">
            <button
              v-for="opt in typeOptions"
              :key="opt.value"
              class="seg"
              :class="{ active: typeFilter === opt.value }"
              @click="typeFilter = opt.value as AssetType | ''"
            >
              {{ opt.label }}
            </button>
          </div>

          <a-select
            v-model:value="tagFilter"
            class="tag-select"
            :options="tagSelectOptions"
            :placeholder="t('repo.tagPlaceholder')"
            allow-clear
          />
        </div>

        <a-spin :spinning="loading" wrapper-class-name="list-spin" size="small">
          <div v-if="!loading && items.length === 0" class="list-empty">
            <AppIcon name="box" :size="44" />
            <p class="list-empty__title">{{ t('repo.listEmpty') }}</p>
            <p class="list-empty__hint">{{ t('repo.listEmptyHint') }}</p>
            <button class="btn btn-primary btn-sm" @click="openCreate">
              <AppIcon name="plus" :size="12" />
              {{ t('repo.create') }}
            </button>
          </div>

          <button
            v-for="item in items"
            :key="item.id"
            class="item"
            :class="{ active: item.id === selectedId }"
            @click="selectedId = item.id"
          >
            <span class="item__bar" :style="{ background: `var(--type-${ASSET_TYPE_META[item.type].color})` }" />
            <div class="item__content">
              <div class="item__top">
                <AppIcon :name="ASSET_TYPE_META[item.type].icon" :size="13" />
                <span class="item__name">{{ item.name }}</span>
                <span class="item__count" :title="t('repo.copyCount', { n: item.copyCount })">
                  <AppIcon name="copy" :size="10" />
                  {{ item.copyCount }}
                </span>
              </div>
              <div class="item__meta">
                <span class="item__type" :class="`type-${item.type}`">{{ t(`repo.types.${item.type}`) }}</span>
                <span v-if="item.lang && item.type !== 'doc' && item.type !== 'link'" class="item__lang">{{ item.lang }}</span>
                <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="item__tag">#{{ tag }}</span>
                <span v-if="item.tags.length > 3" class="item__tag-more">+{{ item.tags.length - 3 }}</span>
              </div>
            </div>
          </button>
        </a-spin>
      </aside>

      <section class="repo__detail panel">
        <ItemDetailPanel />
        <ItemFormDrawer />
      </section>
    </div>
  </div>
</template>

<style scoped lang="less">
.repo {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 20px 20px;
}

// 视图切换按钮组：位于页头右侧，网格 / 列表两种布局
.view-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-ctl);

  &__btn {
    width: 30px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--fg-muted);
    cursor: pointer;
    transition: all var(--ease);

    &:hover { color: var(--fg-sub); }

    &.active {
      background: var(--bg-card);
      color: var(--primary);
      box-shadow: 0 1px 3px rgba(16, 16, 20, 0.1);
    }
  }
}

.repo__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  .head-text {
    min-width: 0;

    h1 {
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0;
    }

    p {
      margin: 6px 0 0;
      font-size: 12.5px;
      color: var(--fg-muted);
      max-width: 76ch;
      line-height: 1.5;
    }
  }

  .head-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
}

// 数据源只读徽标：等宽小字，与主标题拉开层次
.mode-badge {
  font-size: 11px;
  font-weight: 400;
  font-family: var(--font-mono);
  color: var(--fg-muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 1px 9px;
  white-space: nowrap;
}

.theme-toggle {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-ctl);
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--fg-sub);
  cursor: pointer;
  transition: all var(--ease);

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
  }
}

.repo__body {
  flex: 1;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  min-height: 0;
}

.repo__list {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.list-toolbar {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-bottom: 1px solid var(--border);

  .search-wrap {
    position: relative;

    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--fg-muted);
      pointer-events: none;
    }
  }

.kw-input {
    width: 100%;
    padding-left: 30px;
    background: var(--bg-input);
    border: 1px solid transparent;
    border-radius: var(--radius-ctl);
    color: var(--fg);
    transition: all var(--ease);

    &::placeholder {
      color: var(--fg-muted);
    }

    &:focus {
      background: var(--input-focus-bg);
    }
  }

  .type-seg {
    width: 100%;
  }

  .tag-select {
    width: 100%;

    :deep(.ant-select-selector) {
      background: var(--bg-input) !important;
      border-color: transparent !important;
      color: var(--fg) !important;
    }

    :deep(.ant-select-selection-placeholder) {
      color: var(--fg-muted);
    }
  }
}

.list-spin {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: block;
}

.list-empty {
  padding: 48px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--fg-muted);
  text-align: center;

  :deep(svg) {
    color: var(--border-strong);
  }

  &__title {
    margin: 0;
    font-size: 13px;
    color: var(--fg-sub);
    font-weight: 500;
  }

  &__hint {
    margin: -4px 0 0;
    font-size: 11.5px;
    color: var(--fg-muted);
  }
}

.item {
  display: flex;
  width: 100%;
  text-align: left;
  font-family: inherit;
  background: transparent;
  border: none;
  border-radius: 12px;
  padding: 0;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all var(--ease);
  overflow: hidden;

  &:hover {
    background: color-mix(in srgb, var(--fg) 2.5%, transparent);
  }

  &.active {
    background: color-mix(in srgb, var(--primary) 6%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 18%, transparent);

    .item__bar {
      width: 6px;
    }
  }
}

.item__bar {
  flex: none;
  width: 4px;
  transition: width var(--ease);
}

.item__content {
  flex: 1;
  min-width: 0;
  padding: 12px;
}

.item__top {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--fg-sub);

  :deep(svg) {
    color: var(--fg-muted);
  }
}

.item__name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item__count {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10.5px;
  font-family: var(--font-mono);
  color: var(--fg-muted);
}

.item__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  padding-left: 20px;
  font-size: 11px;
}

.item__type {
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  line-height: 1.5;

  &.type-snippet { color: var(--type-snippet); background: var(--type-snippet-bg); }
  &.type-component { color: var(--type-component); background: var(--type-component-bg); }
  &.type-function { color: var(--type-function); background: var(--type-function-bg); }
  &.type-doc { color: var(--type-doc); background: var(--type-doc-bg); }
  &.type-link { color: var(--type-link); background: var(--type-link-bg); }
}

.item__lang {
  flex: none;
  font-family: var(--font-mono);
  color: var(--fg-muted);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0 5px;
  line-height: 1.5;
}

.item__tag {
  flex: none;
  color: var(--primary);
}

.item__tag-more {
  flex: none;
  color: var(--fg-muted);
}

.repo__detail {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

// ---------- 卡片网格模式 ----------

.repo__toolbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;

  .search-wrap {
    position: relative;
    flex: 1;
    min-width: 220px;
    max-width: 360px;

    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--fg-muted);
      pointer-events: none;
    }
  }

  .kw-input {
    width: 100%;
    padding-left: 30px;
    background: var(--bg-input);
    border: 1px solid transparent;
    border-radius: var(--radius-ctl);
    color: var(--fg);
    transition: all var(--ease);

    &::placeholder {
      color: var(--fg-muted);
    }

    &:focus {
      background: var(--input-focus-bg);
    }
  }

  .type-seg {
    flex: none;
    width: 360px;
  }

  .tag-select {
    flex: none;
    width: 180px;

    :deep(.ant-select-selector) {
      background: var(--bg-input) !important;
      border-color: transparent !important;
      color: var(--fg) !important;
    }

    :deep(.ant-select-selection-placeholder) {
      color: var(--fg-muted);
    }
  }
}

.repo__grid-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.grid-spin {
  min-height: 100%;
}

.grid-empty {
  height: 100%;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--fg-muted);
  text-align: center;

  :deep(svg) {
    color: var(--border-strong);
  }

  &__title {
    margin: 0;
    font-size: 14px;
    color: var(--fg-sub);
    font-weight: 500;
  }

  &__hint {
    margin: -6px 0 0;
    font-size: 12px;
    color: var(--fg-muted);
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding-bottom: 4px;
}

.card {
  position: relative;
  display: flex;
  width: 100%;
  text-align: left;
  font-family: inherit;
  background: var(--bg-card);
  border: 1px solid rgba(16, 16, 20, 0.04);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: 0;
  cursor: pointer;
  transition: all var(--ease);
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-card-hover);
  }

  html[data-theme='dark'] & {
    border-color: rgba(255, 255, 255, 0.05);
  }
}

.card__bar {
  flex: none;
  width: 4px;
  transition: width var(--ease);

  .card:hover & {
    width: 6px;
  }
}

.card__content {
  flex: 1;
  min-width: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card__top {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-sub);

  :deep(svg) {
    color: var(--fg-muted);
  }
}

.card__name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card__desc {
  margin: 0;
  font-size: 12px;
  color: var(--fg-muted);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 36px;
}

.card__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
}

.card__type {
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  line-height: 1.5;

  &.type-snippet { color: var(--type-snippet); background: var(--type-snippet-bg); }
  &.type-component { color: var(--type-component); background: var(--type-component-bg); }
  &.type-function { color: var(--type-function); background: var(--type-function-bg); }
  &.type-doc { color: var(--type-doc); background: var(--type-doc-bg); }
  &.type-link { color: var(--type-link); background: var(--type-link-bg); }
}

.card__lang {
  flex: none;
  font-family: var(--font-mono);
  color: var(--fg-muted);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0 5px;
  line-height: 1.5;
}

.card__tag {
  flex: none;
  color: var(--primary);
}

.card__tag-more {
  flex: none;
  color: var(--fg-muted);
}

.card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--fg-muted);
}

.card__count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.card__time {
  font-family: var(--font-mono);
}

// ---------- 卡片详情全宽模式 ----------

.repo__detail-full {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;

  .detail-back {
    flex: none;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-input);
  }

  // 让详情面板占满剩余宽度，代码舞台随页面高度拉伸。
  // 注意：子组件 .panel 本身写了 height:100%，在 flex item 里会参照父级 height 而不是
  // flex 分配的高度，导致代码舞台被压扁、预览 iframe 高度为 0；这里用 auto 覆盖掉。
  :deep(.panel) {
    flex: 1;
    min-height: 0;
    height: auto;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }
}

// 平台既有断点口径：1200px 双栏折单栏，列表限高保住上下动线
@media (max-width: 1200px) {
  .repo__body {
    grid-template-columns: 1fr;
  }

  .repo__list {
    max-height: 320px;
  }

  .repo__toolbar {
    flex-wrap: wrap;

    .type-seg {
      flex: 1;
      width: auto;
      min-width: 260px;
    }

    .tag-select {
      flex: 1;
      width: auto;
      min-width: 140px;
    }
  }
}

@media (max-width: 720px) {
  .repo {
    padding: 14px 12px;
  }

  .repo__head {
    flex-direction: column;
    align-items: stretch;

    .head-actions {
      align-self: flex-end;
    }
  }

  .repo__toolbar {
    .search-wrap,
    .type-seg,
    .tag-select {
      flex: none;
      width: 100%;
      max-width: none;
    }
  }

  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
