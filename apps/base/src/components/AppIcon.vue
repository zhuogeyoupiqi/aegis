<script setup lang="ts">
import { ICON } from './icons'

// 统一图标组件：所有图标走同一套描边参数，保证视觉一致
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 16 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    v-html="ICON[name] || ''"
  />
</template>

<style scoped>
/*
  行内基线处理（与 antd 图标同配方）：svg 默认按文本基线对齐，会在文字行里
  抬高 2~3px；inline-flex + -0.125em 让图标与文字视觉居中，且不影响
  grid/flex 容器内的居中（容器内会被块化，长写法居中仍然生效）。
*/
svg {
  display: inline-flex;
  vertical-align: -0.125em;
  flex: none;
}
</style>
