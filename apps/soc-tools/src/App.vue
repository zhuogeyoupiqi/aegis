<script setup lang="ts">
import { useBaseThemeBridge } from '@aegis/shared'

// 一行完成「跟随基座主题」：mounted 时拉取初始快照并监听后续变更
useBaseThemeBridge()
</script>

<template>
  <div class="app">
    <router-view />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
}
</style>
