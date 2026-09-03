<script setup lang="ts">
import { computed, ref } from 'vue'
import { useShiki } from '@/composables/useShiki'

/**
 * 轻量代码编辑器：textarea 负责输入，上层 pre（Shiki 高亮）负责视觉。
 *
 * 不引入 Monaco/CodeMirror，减少包体积与复杂度；满足 MVP 阶段的语法高亮、
 * 行号、等宽字体、tab 缩进需求。后续若需要智能提示再升级到真正的编辑器。
 */
const props = defineProps<{
  modelValue: string
  lang: string | null
  placeholder?: string
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()

const { highlight } = useShiki()

// 文本同步：textarea 输入后通过事件回传父组件
function onInput(ev: Event): void {
  emit('update:modelValue', (ev.target as HTMLTextAreaElement).value)
}

// 同步滚动：视觉层跟随输入层滚动
const textareaRef = ref<HTMLTextAreaElement>()
const preRef = ref<HTMLPreElement>()
function onScroll(): void {
  if (preRef.value && textareaRef.value) {
    preRef.value.scrollTop = textareaRef.value.scrollTop
    preRef.value.scrollLeft = textareaRef.value.scrollLeft
  }
}

// Tab 键缩进：阻止默认跳焦点，改为插入两个空格
function onKeyDown(ev: KeyboardEvent): void {
  if (ev.key !== 'Tab') return
  ev.preventDefault()
  const ta = textareaRef.value
  if (!ta) return
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const spaces = '  '
  const next = props.modelValue.slice(0, start) + spaces + props.modelValue.slice(end)
  emit('update:modelValue', next)
  // 光标放到插入空格之后
  requestAnimationFrame(() => {
    ta.selectionStart = ta.selectionEnd = start + spaces.length
  })
}

const lines = computed(() => props.modelValue.split('\n'))
const highlightedHtml = computed(() => highlight(props.modelValue, props.lang))

// 行号宽度根据行数动态计算，避免 100+ 行时错位
const lineNoWidth = computed(() => {
  const digits = String(lines.value.length).length
  return `${Math.max(2, digits) * 10 + 8}px`
})
</script>

<template>
  <div class="code-editor">
    <!-- 行号条：固定宽度，与代码等 line-height -->
    <div class="line-numbers" :style="{ width: lineNoWidth }">
      <div v-for="n in lines.length" :key="n" class="line-no">{{ n }}</div>
    </div>

    <div class="editor-layer">
      <!-- 视觉层：Shiki 高亮产物，只读，透明接收点击/滚动由 textarea 处理 -->
      <pre ref="preRef" class="highlight-layer" aria-hidden="true"><code v-html="highlightedHtml" /></pre>

      <!-- 输入层：原生 textarea，真正接收键盘输入 -->
      <textarea
        ref="textareaRef"
        :value="modelValue"
        class="input-layer"
        :placeholder="placeholder"
        spellcheck="false"
        @input="onInput"
        @scroll="onScroll"
        @keydown="onKeyDown"
      />
    </div>
  </div>
</template>

<style scoped lang="less">
.code-editor {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: var(--bg-input);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.65;
}

.line-numbers {
  flex: none;
  padding: 12px 8px 12px 0;
  text-align: right;
  background: color-mix(in srgb, var(--fg) 2.5%, transparent);
  border-right: 1px solid var(--border);
  color: var(--fg-muted);
  user-select: none;
  overflow: hidden;
}

.line-no {
  height: calc(12.5px * 1.65);
}

.editor-layer {
  flex: 1;
  position: relative;
  min-width: 0;
}

.highlight-layer,
.input-layer {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 12px 14px;
  border: none;
  font: inherit;
  line-height: inherit;
  white-space: pre;
  word-wrap: normal;
  overflow: auto;
  tab-size: 2;
}

.highlight-layer {
  pointer-events: none;
  color: var(--fg);
  background: transparent;

  :deep(code) {
    font-family: inherit;
  }

  :deep(pre) {
    margin: 0;
    padding: 0;
    background: transparent !important;
  }
}

.input-layer {
  color: transparent;
  background: transparent;
  caret-color: var(--primary);
  resize: none;
  outline: none;

  &::placeholder {
    color: var(--fg-muted);
  }
}
</style>
