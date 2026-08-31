<script setup lang="ts">
import { computed } from 'vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import enUS from 'ant-design-vue/es/locale/en_US'
import { useAppStore } from '@/stores/app'
import { buildAntdTheme } from '@aegis/shared'

const appStore = useAppStore()

// antd 组件主题从同一份偏好状态派生：壳层用 CSS 变量、antd 用 token，两路同源不会漂移
const antdTheme = computed(() => buildAntdTheme(appStore.themeSnapshot))

// antd 内置文案（分页、弹窗按钮等）跟随界面语言
const antdLocale = computed(() => (appStore.prefs.lang === 'en-US' ? enUS : zhCN))
</script>

<template>
  <a-config-provider :theme="antdTheme" :locale="antdLocale">
    <!-- a-app 提供带主题上下文的 message/Modal 实例（App.useApp 获取），供 shared 的 toast 使用 -->
    <a-app>
      <router-view />
    </a-app>
  </a-config-provider>
</template>
