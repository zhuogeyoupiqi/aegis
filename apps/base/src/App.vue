<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { buildAntdTheme } from '@aegis/shared'

const appStore = useAppStore()

// antd 组件主题从同一份偏好状态派生：壳层用 CSS 变量、antd 用 token，两路同源不会漂移
const antdTheme = computed(() => buildAntdTheme(appStore.themeSnapshot))
</script>

<template>
  <a-config-provider :theme="antdTheme">
    <!-- a-app 提供带主题上下文的 message/Modal 实例（App.useApp 获取），供 shared 的 toast 使用 -->
    <a-app>
      <router-view />
    </a-app>
  </a-config-provider>
</template>
