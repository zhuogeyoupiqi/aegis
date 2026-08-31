<script setup lang="ts">
import { computed } from 'vue'
import { buildAntdTheme, lastThemeSnapshot, useBaseThemeBridge } from '@aegis/shared'

// 一行完成「跟随基座主题」：监听基座下发的数据并应用到根节点
useBaseThemeBridge()

// antd 组件主题从主题桥写入的快照派生；未收到基座数据前用 shared 里的兜底主题
const antdTheme = computed(() => buildAntdTheme(lastThemeSnapshot.value))
</script>

<template>
  <a-config-provider :theme="antdTheme">
    <!-- a-app 提供带主题上下文的 message 实例，子应用内经由 shared 的 toast 通道使用 -->
    <a-app>
      <div class="app">
        <router-view />
      </div>
    </a-app>
  </a-config-provider>
</template>

<style scoped>
.app {
  min-height: 100vh;
}
</style>
