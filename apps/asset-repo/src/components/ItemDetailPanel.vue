<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import FileTree from '@/components/FileTree.vue'
import PreviewSandbox from '@/components/PreviewSandbox.vue'
import { useAssetRepo } from '@/composables/useAssetRepo'
import { useShiki } from '@/composables/useShiki'
import { isPreviewable } from '@/api/types'
import type { AssetType } from '@/api/types'

/**
 * 右栏详情面板（双栏检索台的常驻区）。
 * 状态与动作直接取 useAssetRepo 单例——本组件是页面私有部件，
 * 不值得为它走一遍 props/emits 的中转 plumbing。
 */
const { t } = useI18n()
const { selected, copyAll, copyFile, downloadZip, openEdit, remove, tagFilter } = useAssetRepo()
const { highlight } = useShiki()

/** 类型 → 图标（与左列共用同一张映射表，视觉语言一致） */
const TYPE_ICON: Record<AssetType, string> = {
  snippet: 'code',
  component: 'box',
  function: 'terminal',
  doc: 'fileText',
  link: 'link',
}

/* ---------- 当前查看的文件（文件树选中态，随资产切换复位到入口文件） ---------- */

const activePath = ref<string | null>(null)

watch(
  () => selected.value?.id,
  () => {
    const item = selected.value
    // 优先落在预览入口（作者心里的"主文件"），否则第一个文件
    activePath.value = item ? (item.entry ?? item.files[0]?.path ?? null) : null
  },
  { immediate: true },
)

const activeFile = computed(() => selected.value?.files.find((f) => f.path === activePath.value) ?? null)

/** 代码/预览二态；无预览能力（非 .vue 入口/缺 vue 依赖）的资产不显示切换 */
const previewable = computed(() => (selected.value ? isPreviewable(selected.value) : false))
const mode = ref<'code' | 'preview'>('code')
watch(previewable, (ok) => {
  if (!ok) mode.value = 'code'
})

/** code/doc 走 Shiki 高亮；link 不走（展示为链接卡片）。doc 固定 md 语法 */
const codeHtml = computed(() => {
  const f = activeFile.value
  if (!selected.value || selected.value.type === 'link' || !f) return ''
  return highlight(f.code, selected.value.type === 'doc' ? 'md' : f.lang)
})

const lineCount = computed(() => activeFile.value?.code.split('\n').length ?? 0)

/** 时间显示到分钟：后端是 LocalDateTime 的 toString，mock 是 ISO 串，slice 通吃两种 */
const timeLabel = computed(() => selected.value?.updateTime?.slice(0, 16).replace('T', ' ') ?? '')

/** 点标签 = 把它设为列表筛选条件（顺着标签找同类资产是最常见的动线） */
function onTagClick(tag: string): void {
  tagFilter.value = tag
}

/** 复制下拉组的分发：单文件资产直接复制，多文件才有分节/zip 的分化 */
function onCopyMenu({ key }: { key: string | number }): void {
  const item = selected.value
  if (!item) return
  if (key === 'file' && activeFile.value) void copyFile(item, activeFile.value)
  if (key === 'all') void copyAll(item)
  if (key === 'zip') void downloadZip(item)
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
        <span v-if="previewable" class="preview-chip">
          <AppIcon name="play" :size="10" />
          {{ t('repo.previewable') }}
        </span>
      </div>
      <div class="panel__actions">
        <!-- 复制动作组：多文件分化（此文件/全部/zip），单文件与 link 保持一颗按钮 -->
        <a-dropdown v-if="selected.files.length > 1">
          <a-button size="small" type="primary" ghost>
            <template #icon><AppIcon name="copy" :size="13" /></template>
            {{ t('repo.copy') }}
            <AppIcon name="chevronDown" :size="11" style="margin-left: 2px" />
          </a-button>
          <template #overlay>
            <a-menu @click="onCopyMenu">
              <a-menu-item key="file" :disabled="!activeFile">
                {{ t('repo.copyThisFile') }}<span class="menu-path">{{ activeFile?.path }}</span>
              </a-menu-item>
              <a-menu-item key="all">{{ t('repo.copyAllFiles') }}</a-menu-item>
              <a-menu-divider />
              <a-menu-item key="zip">
                <AppIcon name="download" :size="12" style="margin-right: 4px" />
                {{ t('repo.downloadZip') }}
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <a-button v-else size="small" type="primary" ghost @click="copyAll(selected)">
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
      :href="selected.url ?? '#'"
      target="_blank"
      rel="noopener noreferrer"
      class="link-card"
    >
      <AppIcon name="externalLink" :size="16" />
      <span class="link-card__url">{{ selected.url }}</span>
      <span class="link-card__hint">{{ t('repo.openLink') }}</span>
    </a>

    <template v-else>
      <!-- 代码 / 预览切换：有预览能力的资产才出现 -->
      <div v-if="previewable" class="panel__mode">
        <a-segmented
          v-model:value="mode"
          size="small"
          :options="[
            { label: t('repo.tabCode'), value: 'code' },
            { label: t('repo.tabPreview'), value: 'preview' },
          ]"
        />
      </div>

      <!-- 预览沙箱：整卡替换代码区（两者并列只会互相挤压） -->
      <PreviewSandbox v-if="mode === 'preview' && previewable" :item="selected" />

      <!-- 代码模式：左文件树卡 + 右代码块 -->
      <div v-else class="code-layout">
        <aside class="files-card">
          <div class="files-card__head">
            <AppIcon name="folder" :size="12" />
            <span>{{ t('repo.filesLabel') }} · {{ selected.files.length }}</span>
          </div>
          <div class="files-card__body">
            <FileTree
              :files="selected.files"
              :active-path="activePath"
              :entry="selected.entry"
              @select="(p) => (activePath = p)"
            />
          </div>
          <div class="files-card__foot">
            <span class="foot-path">{{ activeFile?.path ?? '—' }}</span>
            <span class="foot-lines">{{ t('repo.linesShort', { n: lineCount }) }}</span>
          </div>
        </aside>

        <!-- Shiki 高亮块（v-html 的内容是本地高亮产物，无用户可控标记注入面） -->
        <div class="code-col">
          <div class="code-block" v-html="codeHtml" />
        </div>
      </div>

      <!-- 依赖面板：预览可用性的透明度——每个依赖从哪来（预打包/CDN）一目了然 -->
      <a-collapse v-if="selected.deps.length" ghost class="deps-collapse">
        <a-collapse-panel :header="t('repo.depsLabel') + ' · ' + selected.deps.length">
          <div class="dep-row" v-for="dep in selected.deps" :key="dep.name">
            <AppIcon name="pkg" :size="12" />
            <span class="dep-name">{{ dep.name }}</span>
            <span class="dep-version">{{ dep.version }}</span>
            <span class="dep-source" :class="dep.source">{{ t(dep.source === 'bundled' ? 'repo.depBundled' : 'repo.depCdn') }}</span>
          </div>
        </a-collapse-panel>
      </a-collapse>
    </template>

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
    flex-wrap: wrap;

    h2 {
      font-size: 15px;
      font-weight: 600;
      // 长资产名折行而不是把徽标挤走
      overflow-wrap: anywhere;
    }

    svg {
      color: var(--fg-muted);
    }
  }

  .panel__actions {
    display: flex;
    align-items: center;
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
  line-height: 1.5;
}

.preview-chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #389e0d;
  background: rgba(56, 158, 13, 0.08);
  border: 1px solid rgba(56, 158, 13, 0.28);
  border-radius: 999px;
  padding: 0 8px;
  line-height: 1.5;
}

.menu-path {
  margin-left: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-muted);
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
    line-height: 1.5;
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
    min-width: 0;
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

.panel__mode {
  display: flex;
  justify-content: center;
}

.code-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 12px;
  align-items: start;

  // 窄屏（含子应用 iframe 被压窄的场景）：文件树压成横向限高的条，代码块下移
  @media (max-width: 900px) {
    grid-template-columns: 1fr;

    .files-card {
      max-height: 200px;
    }
  }
}

.files-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-card);
  overflow: hidden;

  &__head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 10px;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--fg-sub);
    border-bottom: 1px solid var(--border);
    background: var(--bg-deep, var(--bg-input));
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 6px 4px;
  }

  &__foot {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 28px;
    padding: 0 10px;
    border-top: 1px solid var(--border);
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--fg-muted);

    .foot-path {
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .foot-lines {
      flex: none;
    }
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

// 依赖面板：去掉 antd collapse 默认的背景与内边距噪点
.deps-collapse {
  :deep(.ant-collapse-item) {
    border-top: 1px dashed var(--border);
  }

  :deep(.ant-collapse-header) {
    padding: 8px 0 !important;
    font-size: 12px;
    color: var(--fg-sub);
  }

  :deep(.ant-collapse-content-box) {
    padding: 4px 0 8px !important;
  }
}

.dep-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  font-size: 12px;
  color: var(--fg-sub);

  svg {
    color: var(--fg-muted);
    flex: none;
  }

  .dep-name {
    font-family: var(--font-mono);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dep-version {
    flex: none;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-muted);
  }

  .dep-source {
    flex: none;
    margin-left: auto;
    font-size: 10.5px;
    border-radius: 4px;
    padding: 0 5px;
    line-height: 1.5;

    &.bundled {
      color: #1668dc;
      background: rgba(22, 104, 220, 0.09);
      border: 1px solid rgba(22, 104, 220, 0.25);
    }

    &.cdn {
      color: #d46b08;
      background: rgba(212, 107, 8, 0.09);
      border: 1px solid rgba(212, 107, 8, 0.25);
    }
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
