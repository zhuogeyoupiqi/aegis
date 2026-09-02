<script setup lang="ts">
import { computed, watch } from 'vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import enUS from 'ant-design-vue/es/locale/en_US'
import { buildAntdTheme, lastLang, lastThemeSnapshot, useBaseThemeBridge } from '@aegis/shared'
import { setI18nLocale } from '@/locales'

// 一行完成「跟随基座主题」：监听基座下发的数据并应用到根节点
useBaseThemeBridge()

// antd 组件主题从主题桥写入的快照派生；未收到基座数据前用 shared 里的兜底主题
const antdTheme = computed(() => buildAntdTheme(lastThemeSnapshot.value))

/**
 * 界面语言同样由基座下发（主题桥的 lastLang）：
 * watch immediate 先用本地默认初始化，基座数据一到达即覆盖，
 * 之后基座切语言这里实时跟随，无需重新装载。
 */
watch(
  lastLang,
  (lang) => setI18nLocale(lang),
  { immediate: true },
)

// antd 内置文案（分页、弹窗按钮等）跟随同一来源
const antdLocale = computed(() => (lastLang.value === 'en-US' ? enUS : zhCN))
</script>

<template>
  <a-config-provider :theme="antdTheme" :locale="antdLocale">
    <!-- a-app 提供带主题上下文的 message 实例，子应用内经由 shared 的 toast 通道使用 -->
    <a-app>
      <div class="app">
        <router-view />
      </div>
    </a-app>
  </a-config-provider>
</template>

<style scoped lang="less">
.app {
  min-height: 100vh;
}
</style>
