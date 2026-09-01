<script setup lang="ts">
/**
 * 子应用本地图标组件（feather/lucide 风格）。
 * 没有复用基座的图标库：跨应用 import 基座源码会引入不必要的耦合，
 * 子应用只带走自己需要的图标。
 */
const ICON: Record<string, string> = {
  send: '<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7z"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 7v5l3 3"/>',
  sparkles: '<path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-5"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  refresh: '<path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  terminal: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
}

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
