<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { useAssetRepo } from '@/composables/useAssetRepo'
import { useShiki } from '@/composables/useShiki'
import type { AssetItem, AssetType } from '@/api/types'

/**
 * 右栏详情面板（双栏检索台的常驻区）。
 * 状态与动作直接取 useAssetRepo 单例——本组件是页面私有部件，
 * 不值得为它走一遍 props/emits 的中转 plumbing。
 */
const { t } = useI18n()
const { selected, copy, openEdit, remove, tagFilter } = useAssetRepo()
const { highlight } = useShiki()

/** 类型 → 图标（与左列共用同一张映射表，视觉语言一致） */
const TYPE_ICON: Record<AssetType, string> = {
  snippet: 'code',
  component: 'box',
  function: 'terminal',
  doc: 'fileText',
  link: 'link',
}

/**
 * code/doc 走 Shiki 高亮；link 不走（展示为链接卡片）。
 * doc 固定按 markdown 高亮——存的就是 md 正文，lang 字段对它无意义。
 */
const codeHtml = computed(() => {
  const item = selected.value
  if (!item || item.type === 'link') return ''
  return highlight(item.content, item.type === 'doc' ? 'md' : item.lang)
})

/** 时间显示到分钟：后端是 LocalDateTime 的 toString，mock 是 ISO 串，slice 通吃两种 */
const timeLabel = computed(() => selected.value?.updateTime?.slice(0, 16).replace('T', ' ') ?? '')

/** 点标签 = 把它设为列表筛选条件（顺着标签找同类资产是最常见的动线） */
function onTagClick(tag: string): void {
  tagFilter.value = tag
}
</script>

<template>
  <!-- 未选中：引导态（列表为空 / 过滤后无匹配时出现） -->
  <div v-if="!selected" class="panel-empty">
    <a-empty :description="t('repo.detailEmptyTitle')" />
    <p class="panel-empty__sub">{{ t('repo.detailEmptySub') }}</p>
  </div>

  <div v-else class="panel">
    <header class="panel__head">
      <div class="panel__title">
        <AppIcon :name="TYPE_ICON[selected.type]" :size="15" />
        <h2>{{ selected.name }}</h2>
        <span class="type-badge" :class="`type-${selected.type}`">{{ t(`repo.types.${selected.type}`) }}</span>
        <span v-if="selected.type !== 'doc' && selected.type !== 'link' && selected.lang" class="lang-chip">{{
          selected.lang
        }}</span>
      </div>
      <div class="panel__actions">
        <a-button size="small" type="primary" ghost @click="copy(selected)">
          <template #icon><AppIcon name="copy" :size="13" /></template>
          {{ t('repo.copy') }}
        </a-button>
        <a-button size="small" @click="openEdit(selected)">
          <template #icon><AppIcon name="edit" :size="13" /></template>
          {{ t('repo.edit') }}
        </a-button>
        <a-popconfirm :title="t('repo.deleteConfirm')" :ok-text="t('repo.delete')" :cancel-text="t('repo.form.cancel')" @confirm="remove(selected)">
          <a-button size="small" danger>
            <template #icon><AppIcon name="trash" :size="13" /></template>
            {{ t('repo.delete') }}
          </a-button>
        </a-popconfirm>
      </div>
    </header>

    <div class="panel__meta">
      <button v-for="tag in selected.tags" :key="tag" class="meta-tag" @click="onTagClick(tag)">#{{ tag }}</button>
      <span class="meta-item">{{ t('repo.copyCount', { n: selected.copyCount }) }}</span>
      <span class="meta-item">{{ t('repo.updated', { time: timeLabel }) }}</span>
    </div>

    <!-- 链接剪藏：卡片化展示，点击新窗口打开（noopener 防反向 tab 劫持） -->
    <a
      v-if="selected.type === 'link'"
      :href="selected.content"
      target="_blank"
      rel="noopener noreferrer"
      class="link-card"
    >
      <AppIcon name="externalLink" :size="16" />
      <span class="link-card__url">{{ selected.content }}</span>
      <span class="link-card__hint">{{ t('repo.openLink') }}</span>
    </a>

    <!-- 代码 / 文档：Shiki 高亮块（v-html 的内容是本地高亮产物，无用户可控标记注入面） -->
    <div v-else class="code-block" v-html="codeHtml" />

    <p v-if="selected.description" class="panel__desc">
      <b>{{ t('repo.descriptionLabel') }}：</b>{{ selected.description }}
    </p>
  </div>
</template>

<style scoped lang="less">
.panel-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--fg-muted);

  &__sub {
    font-size: 12px;
    color: var(--fg-muted);
    margin-top: -12px;
  }
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  .panel__title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;

    h2 {
      font-size: 15px;
      font-weight: 600;
      // 长资产名折行而不是把操作按钮挤走
      overflow-wrap: anywhere;
    }

    svg {
      color: var(--fg-muted);
    }
  }

  .panel__actions {
    display: flex;
    gap: 6px;
    flex: none;
  }
}

.type-badge {
  flex: none;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid transparent;

  // 五类各给一个稳定的色相锚点：辅助扫视定位，不是状态语义（不占用红黄绿）
  .type-snippet & { color: #1668dc; background: rgba(22, 104, 220, 0.09); border-color: rgba(22, 104, 220, 0.25); }
  .type-component & { color: #722ed1; background: rgba(114, 46, 209, 0.09); border-color: rgba(114, 46, 209, 0.25); }
  .type-function & { color: #0e9488; background: rgba(14, 148, 136, 0.1); border-color: rgba(14, 148, 136, 0.28); }
  .type-doc & { color: #d46b08; background: rgba(212, 107, 8, 0.09); border-color: rgba(212, 107, 8, 0.25); }
  .type-link & { color: #389e0d; background: rgba(56, 158, 13, 0.1); border-color: rgba(56, 158, 13, 0.28); }
}

.lang-chip {
  flex: none;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--fg-muted);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0 6px;
}

.panel__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11.5px;
  color: var(--fg-muted);

  .meta-tag {
    font-family: inherit;
    font-size: 11.5px;
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 7%, transparent);
    border: 1px solid color-mix(in srgb, var(--primary) 22%, transparent);
    border-radius: 999px;
    padding: 0 8px;
    cursor: pointer;
    transition: all var(--ease);

    &:hover {
      background: color-mix(in srgb, var(--primary) 14%, transparent);
    }
  }

  .meta-item {
    // 两个统计项与前排标签拉开一点节奏
    margin-left: 4px;
  }
}

.link-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--primary);
  transition: border-color var(--ease);

  &:hover {
    border-color: color-mix(in srgb, var(--primary) 45%, transparent);
  }

  &__url {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 12.5px;
    overflow-wrap: anywhere;
  }

  &__hint {
    flex: none;
    font-size: 11.5px;
    color: var(--fg-muted);
  }
}

.code-block {
  border-radius: 8px;
  overflow: hidden;

  /* Shiki 产物自带内联背景/配色（github-light/dark），这里只管版式 */
  :deep(pre.shiki),
  :deep(pre.shiki-plain) {
    margin: 0;
    padding: 14px 16px;
    overflow: auto;
    max-height: 540px;
    font-size: 12.5px;
    line-height: 1.65;
    font-family: var(--font-mono);
  }

  :deep(pre.shiki-plain) {
    background: var(--bg-input);
    color: var(--fg-sub);
  }

  :deep(code) {
    font-family: inherit;
  }
}

.panel__desc {
  font-size: 12.5px;
  color: var(--fg-sub);
  background: var(--bg-deep, var(--bg-input));
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 10px 12px;

  b {
    color: var(--fg-muted);
    font-weight: 500;
  }
}
</style>
