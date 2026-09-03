<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { App } from 'ant-design-vue'
import { bindFeedback } from '@aegis/shared'
import AppIcon from '@/components/AppIcon.vue'
import ItemDetailPanel from '@/components/ItemDetailPanel.vue'
import ItemFormDrawer from '@/components/ItemFormDrawer.vue'

import { useAssetRepo } from '@/composables/useAssetRepo'
import { useShiki } from '@/composables/useShiki'
import { getApiMode } from '@/api/mode'
import { ASSET_TYPE_ICON, type AssetType } from '@/api/types'

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

// 类型 → 图标从契约层统一导入，新增类型时只改一处

onMounted(() => {
  void reload()
  preload()
})

onUnmounted(() => {
  // 子应用被 micro-app 销毁时，取消未触发的搜索防抖定时器，避免内存泄漏与幽灵请求
  cleanup()
})

// 基座设置抽屉切换 mock/real 后，数据源模式变化，列表应自动重查
watch(getApiMode, () => {
  void reload()
})
</script>

<template>
  <div class="repo">
    <!-- 页头：标题 + 描述 + 只读数据源徽标 + 动作 -->
    <header class="repo__head">
      <div class="head-text">
        <h1>
          {{ t('repo.title') }}
          <span class="mode-badge">{{ t('repo.sourceLabel') }} · {{ apiModeLabel }}</span>
        </h1>
        <p>{{ t('repo.desc') }}</p>
      </div>
      <div class="head-actions">
        <a-button @click="reload">
          <template #icon><AppIcon name="refresh" :size="13" /></template>
          {{ t('repo.refresh') }}
        </a-button>
        <a-button type="primary" @click="openCreate">
          <template #icon><AppIcon name="plus" :size="13" /></template>
          {{ t('repo.create') }}
        </a-button>
      </div>
    </header>

    <!-- 检索栏：关键字（防抖）+ 类型分段 + 标签下拉 -->
    <div class="repo__toolbar">
      <a-input v-model:value="kw" class="kw-input" :placeholder="t('repo.searchPlaceholder')" allow-clear>
        <template #prefix><AppIcon name="search" :size="13" /></template>
      </a-input>
      <a-segmented v-model:value="typeFilter" :options="typeOptions" size="small" />
      <a-select
        v-model:value="tagFilter"
        class="tag-select"
        :options="tagSelectOptions"
        :placeholder="t('repo.tagPlaceholder')"
        allow-clear
      />
    </div>

    <!-- 主体双栏：左列表（使用频率排序） / 右详情常驻 -->
    <div class="repo__body">
      <aside class="repo__list">
        <a-spin :spinning="loading" wrapper-class-name="list-spin">
          <div v-if="!loading && items.length === 0" class="list-empty">
            <a-empty :description="t('repo.listEmpty')" />
            <p class="list-empty__hint">{{ t('repo.listEmptyHint') }}</p>
          </div>
          <button
            v-for="item in items"
            :key="item.id"
            class="item"
            :class="{ active: item.id === selectedId }"
            @click="selectedId = item.id"
          >
            <div class="item__top">
              <AppIcon :name="ASSET_TYPE_ICON[item.type]" :size="13" />
              <span class="item__name">{{ item.name }}</span>
              <span class="item__count" :title="t('repo.copyCount', { n: item.copyCount })">
                <AppIcon name="copy" :size="10" />
                {{ item.copyCount }}
              </span>
            </div>
            <div v-if="item.tags.length || item.lang" class="item__meta">
              <span v-if="item.lang && item.type !== 'doc' && item.type !== 'link'" class="item__lang">{{ item.lang }}</span>
              <span v-for="tag in item.tags" :key="tag" class="item__tag">#{{ tag }}</span>
            </div>
          </button>
        </a-spin>
      </aside>

      <section class="repo__detail">
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
  gap: 14px;
  padding: 18px 20px;
}

.repo__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  .head-text {
    min-width: 0;

    h1 {
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    p {
      margin-top: 5px;
      font-size: 12px;
      color: var(--fg-muted);
      max-width: 76ch;
    }
  }

  .head-actions {
    display: flex;
    gap: 8px;
    flex: none;
  }
}

// 数据源只读徽标：等宽小字，与发包器页的形态一致
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

.repo__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;

  .kw-input {
    flex: 1;
    min-width: 220px;
    max-width: 380px;
  }

  .tag-select {
    min-width: 150px;
    max-width: 220px;
  }
}

.repo__body {
  flex: 1;
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  gap: 14px;
  min-height: 0;
}

// 平台既有断点口径（soc-tools 同款 1200px）：双栏检索台折单栏，
// 列表压成限高横条区保住"检索+详情"的上下动线；720px 再收工具条
@media (max-width: 1200px) {
  .repo__body {
    grid-template-columns: 1fr;
  }

  .repo__list {
    max-height: 264px;
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
      justify-content: flex-end;
    }
  }

  .repo__toolbar {
    align-items: stretch;
    flex-direction: column;

    .kw-input,
    .tag-select {
      max-width: none;
      min-width: 0;
      width: 100%;
    }
  }
}

.repo__list {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  overflow-y: auto;
  padding: 8px;

  .list-spin {
    display: block;
    min-height: 220px;
  }
}

.list-empty {
  padding: 40px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  &__hint {
    font-size: 11.5px;
    color: var(--fg-muted);
    margin-top: -8px;
  }
}

.item {
  display: block;
  width: 100%;
  text-align: left;
  font-family: inherit;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 9px 11px;
  cursor: pointer;
  transition: all var(--ease);

  &:hover {
    border-color: color-mix(in srgb, var(--primary) 30%, transparent);
  }

  &.active {
    border-color: color-mix(in srgb, var(--primary) 50%, transparent);
    background: color-mix(in srgb, var(--primary) 6%, transparent);
  }

  & + .item {
    margin-top: 5px;
  }

  &__top {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--fg-sub);

    svg {
      color: var(--fg-muted);
    }
  }

  &__name {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__count {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10.5px;
    font-family: var(--font-mono);
    color: var(--fg-muted);
  }

  &__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 6px;
    padding-left: 20px;
    font-size: 11px;
    color: var(--fg-muted);
  }

  &__lang {
    font-family: var(--font-mono);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0 5px;
    line-height: 1.5;
  }

  &__tag {
    color: var(--primary);
  }
}

.repo__detail {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  overflow-y: auto;
  padding: 16px 18px;
  min-height: 320px;
}
</style>
