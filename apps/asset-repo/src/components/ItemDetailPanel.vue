<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import FileTree from '@/components/FileTree.vue'
import PreviewSandbox from '@/components/PreviewSandbox.vue'
import { useAssetRepo } from '@/composables/useAssetRepo'
import { useShiki } from '@/composables/useShiki'
import { ASSET_TYPE_META, isPreviewable } from '@/api/types'

/**
 * 右栏详情面板（双栏检索台的常驻区）。
 * 状态与动作直接取 useAssetRepo 单例——本组件是页面私有部件，
 * 不值得为它走一遍 props/emits 的中转 plumbing。
 */
const { t } = useI18n()
const { selected, copyAll, copyFile, downloadZip, openEdit, remove, tagFilter } = useAssetRepo()
const { highlight } = useShiki()

/* ---------- 当前查看的文件（文件树选中态，随资产切换复位到入口文件） ---------- */

const activePath = ref<string | null>(null)

/** 代码/预览二态；无预览能力（非 .vue 入口/缺 vue 依赖）的资产不显示切换 */
const previewable = computed(() => (selected.value ? isPreviewable(selected.value) : false))
const mode = ref<'code' | 'preview'>('code')

watch(
  () => selected.value?.id,
  () => {
    const item = selected.value
    // 优先落在预览入口（作者心里的"主文件"），否则第一个文件
    activePath.value = item ? (item.entry ?? item.files[0]?.path ?? null) : null
    // 切换资产后回到代码视图：preview 是二次操作，不默认保留
    mode.value = 'code'
  },
  { immediate: true },
)

const activeFile = computed(() => selected.value?.files.find((f) => f.path === activePath.value) ?? null)

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
    <AppIcon name="box" :size="44" />
    <p class="panel-empty__title">{{ t('repo.detailEmptyTitle') }}</p>
    <p class="panel-empty__sub">{{ t('repo.detailEmptySub') }}</p>
  </div>

  <div v-else class="panel">
    <!-- 头部：只保留资产名与主操作，视觉重心更清晰 -->
    <header class="panel__head">
      <div class="panel__title">
        <AppIcon :name="ASSET_TYPE_META[selected.type].icon" :size="16" />
        <h2>{{ selected.name }}</h2>
      </div>

      <div class="panel__actions">
        <!-- 多文件资产：复制动作以下拉方式聚合，避免工具条过长 -->
        <a-dropdown v-if="selected.files.length > 1">
          <button class="btn btn-ghost btn-sm" :title="t('repo.copy')">
            <AppIcon name="copy" :size="13" />
            {{ t('repo.copy') }}
            <AppIcon name="chevronDown" :size="11" />
          </button>
          <template #overlay>
            <a-menu @click="onCopyMenu">
              <a-menu-item key="file" :disabled="!activeFile">
                {{ t('repo.copyThisFile') }}<span class="menu-path">{{ activeFile?.path }}</span>
              </a-menu-item>
              <a-menu-item key="all">{{ t('repo.copyAllFiles') }}</a-menu-item>
              <a-menu-divider />
              <a-menu-item key="zip">
                <AppIcon name="download" :size="12" />
                {{ t('repo.downloadZip') }}
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>

        <a-tooltip v-else :title="t('repo.copy')">
          <button class="btn btn-ghost btn-icon" @click="copyAll(selected)">
            <AppIcon name="copy" :size="14" />
          </button>
        </a-tooltip>

        <a-tooltip :title="t('repo.edit')">
          <button class="btn btn-default btn-icon" @click="openEdit(selected)">
            <AppIcon name="edit" :size="14" />
          </button>
        </a-tooltip>

        <a-popconfirm
          :title="t('repo.deleteConfirm')"
          :ok-text="t('repo.delete')"
          :cancel-text="t('repo.form.cancel')"
          @confirm="remove(selected)"
        >
          <a-tooltip :title="t('repo.delete')">
            <button class="btn btn-danger-outline btn-icon">
              <AppIcon name="trash" :size="14" />
            </button>
          </a-tooltip>
        </a-popconfirm>
      </div>
    </header>

    <!-- 元信息行：类型、语言、标签、统计全部收敛到这里 -->
    <div class="panel__meta">
      <span class="meta-type" :class="`type-${selected.type}`">
        {{ t(`repo.types.${selected.type}`) }}
      </span>
      <span v-if="selected.type !== 'doc' && selected.type !== 'link' && selected.lang" class="meta-lang">
        {{ selected.lang }}
      </span>
      <button v-for="tag in selected.tags" :key="tag" class="meta-tag" @click="onTagClick(tag)">
        #{{ tag }}
      </button>
      <span class="meta-stat">{{ t('repo.copyCount', { n: selected.copyCount }) }}</span>
      <span class="meta-stat">{{ t('repo.updated', { time: timeLabel }) }}</span>
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
      <!-- 代码 / 预览区：文件树头部集成 Tab 切换，成为内容 chrome -->
      <div class="code-stage">
        <div class="code-stage__chrome">
          <FileTree
            class="code-stage__tree"
            :files="selected.files"
            :active-path="activePath"
            :entry="selected.entry"
            @select="(p) => (activePath = p)"
          />

          <div v-if="previewable" class="tabs">
            <button class="tab" :class="{ active: mode === 'code' }" @click="mode = 'code'">
              <AppIcon name="code" :size="11" />
              {{ t('repo.tabCode') }}
            </button>
            <button class="tab" :class="{ active: mode === 'preview' }" @click="mode = 'preview'">
              <AppIcon name="play" :size="11" />
              {{ t('repo.tabPreview') }}
            </button>
          </div>
        </div>

        <div class="code-stage__body">
          <PreviewSandbox v-if="mode === 'preview' && previewable" :item="selected" />

          <div v-else class="code-block">
            <div class="code-block__head">
              <span class="code-block__path">{{ activeFile?.path ?? '—' }}</span>
              <span class="code-block__lines">{{ t('repo.linesShort', { n: lineCount }) }}</span>
            </div>
            <!-- Shiki 高亮块（v-html 的内容是本地高亮产物，无用户可控标记注入面） -->
            <div class="code-block__content" v-html="codeHtml" />
          </div>
        </div>
      </div>

      <!-- 依赖面板：从折叠改为精致清单卡片 -->
      <div v-if="selected.deps.length" class="deps-card">
        <div class="deps-card__head">
          <AppIcon name="pkg" :size="13" />
          <span>{{ t('repo.depsLabel') }} · {{ selected.deps.length }}</span>
        </div>
        <div class="deps-card__body">
          <div v-for="dep in selected.deps" :key="dep.name" class="dep-row">
            <span class="dep-name">{{ dep.name }}</span>
            <span class="dep-version">{{ dep.version }}</span>
            <span class="dep-source" :class="dep.source">
              {{ t(dep.source === 'bundled' ? 'repo.depBundled' : 'repo.depCdn') }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- 描述：独立小卡片，避免底部突兀 -->
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
  gap: 10px;
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

  &__sub {
    font-size: 12px;
    color: var(--fg-muted);
    margin-top: -4px;
  }
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  height: 100%;
}

.panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  .panel__title {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;

    h2 {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
      color: var(--fg);
      overflow-wrap: anywhere;
    }

    :deep(svg) {
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

.panel__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;

  .meta-type {
    flex: none;
    padding: 1px 9px;
    border-radius: 999px;
    line-height: 1.5;

    &.type-snippet { color: var(--type-snippet); background: var(--type-snippet-bg); }
    &.type-component { color: var(--type-component); background: var(--type-component-bg); }
    &.type-function { color: var(--type-function); background: var(--type-function-bg); }
    &.type-doc { color: var(--type-doc); background: var(--type-doc-bg); }
    &.type-link { color: var(--type-link); background: var(--type-link-bg); }
  }

  .meta-lang {
    flex: none;
    font-family: var(--font-mono);
    color: var(--fg-muted);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0 6px;
    line-height: 1.5;
  }

  .meta-tag {
    font-family: inherit;
    font-size: 12px;
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 7%, transparent);
    border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent);
    border-radius: 999px;
    padding: 1px 9px;
    line-height: 1.5;
    cursor: pointer;
    transition: all var(--ease);

    &:hover {
      background: color-mix(in srgb, var(--primary) 14%, transparent);
    }
  }

  .meta-stat {
    color: var(--fg-muted);
    margin-left: 4px;
  }
}

.link-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--primary);
  text-decoration: none;
  transition: all var(--ease);

  &:hover {
    border-color: color-mix(in srgb, var(--primary) 45%, transparent);
    background: color-mix(in srgb, var(--primary) 4%, transparent);
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

.code-stage {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-card);
  flex: 1;
  min-height: 360px;

  &__chrome {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-input);
  }

  &__tree {
    flex: 1;
    min-width: 0;
  }

  &__tabs {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  &__body {
    flex: 1;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
  }
}

.tabs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 12px;
  color: var(--fg-muted);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--ease);

  &:hover { color: var(--fg-sub); }

  &.active {
    color: var(--fg);
    background: var(--bg-card);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }
}

.code-block {
  display: flex;
  flex-direction: column;
  height: 100%;

  &__head {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-input);
    font-size: 11.5px;
  }

  &__path {
    font-family: var(--font-mono);
    color: var(--fg-sub);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__lines {
    flex: none;
    color: var(--fg-muted);
  }

  &__content {
    flex: 1;
    overflow: auto;
    background: var(--bg-input);

    :deep(pre.shiki),
    :deep(pre.shiki-plain) {
      margin: 0;
      padding: 14px 16px;
      min-height: 100%;
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
}

.deps-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-card);

  &__head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 9px 12px;
    font-size: 12px;
    font-weight: 500;
    color: var(--fg-sub);
    border-bottom: 1px solid var(--border);
    background: var(--bg-input);

    :deep(svg) {
      color: var(--fg-muted);
    }
  }

  &__body {
    padding: 6px 12px;
  }
}

.dep-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  font-size: 12px;
  color: var(--fg-sub);

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
    padding: 0 6px;
    line-height: 1.5;

    &.bundled {
      color: var(--type-snippet);
      background: var(--type-snippet-bg);
      border: 1px solid var(--type-snippet-border);
    }

    &.cdn {
      color: var(--type-doc);
      background: var(--type-doc-bg);
      border: 1px solid var(--type-doc-border);
    }
  }
}

.panel__desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--fg-sub);
  background: var(--bg-input);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  padding: 10px 12px;

  b {
    color: var(--fg-muted);
    font-weight: 500;
  }
}

.menu-path {
  margin-left: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-muted);
}

// 窄屏：代码舞台上下堆叠，Tab 放在文件树下方
@media (max-width: 900px) {
  .code-stage__chrome {
    flex-direction: column;
    align-items: stretch;
  }

  .code-stage__tabs,
  .tabs {
    align-self: flex-start;
  }
}
</style>
