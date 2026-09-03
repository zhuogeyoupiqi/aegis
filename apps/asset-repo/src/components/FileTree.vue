<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { buildTree, useTreeCollapse, type TreeNode } from '@/composables/useFileTree'
import type { AssetFile } from '@/api/types'

/**
 * 文件树（详情面板 / 表单抽屉共用）。
 *
 * 渲染策略是把嵌套树"压平成行"而不是递归组件：目录折叠只影响子树显隐，
 * 压平后一个 v-for 就能画完整棵树——递归组件要处理自引用、层间状态传递，
 * 对这种纯展示结构是杀鸡用牛刀。行高统一 26px，缩进按深度每级 14px。
 */
const props = withDefaults(
  defineProps<{
    files: AssetFile[]
    /** 当前选中文件（高亮行） */
    activePath?: string | null
    /** 预览入口文件（行尾 demo 徽标） */
    entry?: string | null
    /** 表单模式：行尾显示移除按钮 */
    removable?: boolean
  }>(),
  { activePath: null, entry: null, removable: false },
)
const emit = defineEmits<{ select: [path: string]; remove: [path: string] }>()

const { t } = useI18n()
const { collapsed, toggle } = useTreeCollapse()

interface Row {
  node: TreeNode
  depth: number
}

/** 展开态下的可见行序列：目录折叠时整棵子树跳过 */
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  const walk = (nodes: TreeNode[], depth: number) => {
    for (const n of nodes) {
      out.push({ node: n, depth })
      if (n.type === 'dir' && !collapsed.value.has(n.path)) walk(n.children, depth + 1)
    }
  }
  walk(buildTree(props.files), 0)
  return out
})

const entryHint = t('repo.form.entryHint')
const removeHint = t('repo.form.removeFile')
</script>

<template>
  <div class="ftree">
    <div
      v-for="row in rows"
      :key="row.node.path"
      class="ftree__row"
      :class="{ 'is-collapsed': row.node.type === 'dir' && collapsed.has(row.node.path) }"
    >
      <!--
        目录行与文件行统一用 div[role="button"] 承载，避免原生 <button> 内再嵌套
        可交互元素（如文件行的移除按钮）导致 HTML 无效与辅助技术混乱。
      -->
      <div
        v-if="row.node.type === 'dir'"
        class="row-main"
        role="button"
        tabindex="0"
        :style="{ paddingLeft: 4 + row.depth * 14 + 'px' }"
        @click="toggle(row.node.path)"
        @keydown.enter.space.prevent="toggle(row.node.path)"
      >
        <AppIcon :name="collapsed.has(row.node.path) ? 'chevronRight' : 'chevronDown'" :size="12" class="row-caret" />
        <AppIcon name="folder" :size="13" class="row-icon dir" />
        <span class="row-name">{{ row.node.name }}</span>
      </div>

      <!-- 文件行：与目录行共享同一套左槽占位（caret 槽 + 图标槽），图标文字严格对齐 -->
      <div
        v-else
        class="row-main file"
        role="button"
        tabindex="0"
        :class="{ active: row.node.path === activePath }"
        :style="{ paddingLeft: 4 + row.depth * 14 + 'px' }"
        :title="row.node.path"
        @click="emit('select', row.node.path)"
        @keydown.enter.space.prevent="emit('select', row.node.path)"
      >
        <span class="row-caret" />
        <AppIcon name="fileText" :size="13" class="row-icon" />
        <span class="row-name">{{ row.node.name }}</span>
        <span v-if="row.node.path === entry" class="row-entry" :title="entryHint">
          <AppIcon name="play" :size="10" />
        </span>
        <button
          v-if="removable"
          class="row-remove"
          type="button"
          :title="removeHint"
          @click.stop="emit('remove', row.node.path)"
        >
          <AppIcon name="x" :size="11" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.ftree {
  font-size: 12.5px;
}

.ftree__row {
  // 行高 26px 统一：行内所有槽（caret/图标/徽标）都按它做垂直居中
  height: 26px;

  &.is-collapsed {
    opacity: 0.75;
  }
}

.row-main {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  height: 100%;
  padding-right: 6px;
  font-family: inherit;
  font-size: inherit;
  color: var(--fg-sub);
  background: transparent;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background var(--ease);
  outline: none;

  &:hover,
  &:focus-visible {
    background: color-mix(in srgb, var(--fg) 3%, transparent);

    .row-remove {
      opacity: 1;
    }
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 30%, transparent);
  }

  &.file.active {
    background: color-mix(in srgb, var(--primary) 9%, transparent);
    color: var(--primary);
  }
}

// caret 槽：目录放折叠箭头，文件放等宽占位——两态图标与文字零偏移
.row-caret {
  flex: none;
  width: 12px;
  display: inline-flex;
  justify-content: center;
  color: var(--fg-muted);
}

.row-icon {
  flex: none;
  color: var(--fg-muted);

  &.dir {
    color: var(--primary);
  }
}

.row-name {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.row-entry {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--type-function);
  background: var(--type-function-bg);
  border: 1px solid var(--type-function-border);
  border-radius: 4px;
}

.row-remove {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 4px;
  color: var(--fg-muted);
  background: transparent;
  opacity: 0;
  cursor: pointer;
  transition: all var(--ease);

  &:hover {
    color: var(--sev-critical);
    background: color-mix(in srgb, var(--sev-critical) 10%, transparent);
  }
}
</style>
