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
