<script setup lang="ts">
import { computed } from 'vue'
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
</script>

<template>
  <div class="ftree">
    <div
      v-for="row in rows"
      :key="row.node.path"
      class="ftree__row"
      :class="{ 'is-collapsed': row.node.type === 'dir' && collapsed.has(row.node.path) }"
    >
      <!-- 目录行：点击整行折叠/展开 -->
      <button
        v-if="row.node.type === 'dir'"
        class="row-main"
        :style="{ paddingLeft: 4 + row.depth * 14 + 'px' }"
        type="button"
        @click="toggle(row.node.path)"
      >
        <AppIcon :name="collapsed.has(row.node.path) ? 'chevronRight' : 'chevronDown'" :size="12" class="row-caret" />
        <AppIcon name="folder" :size="13" class="row-icon dir" />
        <span class="row-name">{{ row.node.name }}</span>
      </button>

      <!-- 文件行：与目录行共享同一套左槽占位（caret 槽 + 图标槽），图标文字严格对齐 -->
      <button
        v-else
        class="row-main file"
        :class="{ active: row.node.path === activePath }"
        :style="{ paddingLeft: 4 + row.depth * 14 + 'px' }"
        type="button"
        :title="row.node.path"
        @click="emit('select', row.node.path)"
      >
        <span class="row-caret" />
        <AppIcon name="fileText" :size="13" class="row-icon" />
        <span class="row-name">{{ row.node.name }}</span>
        <span v-if="row.node.path === entry" class="row-entry">demo</span>
        <span
          v-if="removable"
          class="row-remove"
          role="button"
          :title="$t('repo.form.removeFile')"
          @click.stop="emit('remove', row.node.path)"
        >
          <AppIcon name="x" :size="11" />
        </span>
      </button>
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

  &:hover {
    background: var(--bg-input);

    .row-remove {
      opacity: 1;
    }
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
  font-size: 10px;
  font-family: var(--font-mono);
  color: #0e9488;
  background: rgba(14, 148, 136, 0.1);
  border: 1px solid rgba(14, 148, 136, 0.28);
  border-radius: 4px;
  padding: 0 4px;
  line-height: 1.4;
}

.row-remove {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  color: var(--fg-muted);
  opacity: 0;
  transition: all var(--ease);

  &:hover {
    color: #fd5257;
    background: rgba(253, 82, 87, 0.1);
  }
}
</style>
