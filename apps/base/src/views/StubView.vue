<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const router = useRouter()

// stub 重定向会带上原始菜单语义：query.title / query.group
const title = computed(() => (route.query.title as string) || '该模块')
const group = computed(() => (route.query.group as string) || '')
</script>

<template>
  <div class="stub">
    <!-- 占位页走 antd 的 a-result：图标区保留品牌化的紫色底座 -->
    <a-result class="stub__result">
      <template #icon>
        <span class="stub__icon"><AppIcon name="cube" :size="30" /></span>
      </template>
      <template #title>
        <h1>{{ title }}</h1>
      </template>
      <template #subTitle>
        <p class="stub__text">
          {{ group ? `「${group}」下的 ` : '' }}该模块在后续迭代开放，
          当前入口为 MVP 第 1 周验证范围外的占位。
        </p>
        <p class="stub__sub">菜单结构已按方案文档 §6 预置，接口与页面将按迭代计划逐步补齐。</p>
      </template>
      <template #extra>
        <a-button type="primary" @click="router.push('/workbench')">
          <template #icon><AppIcon name="chevronRight" :size="13" /></template>
          返回工作台
        </a-button>
      </template>
    </a-result>
  </div>
</template>

<style scoped>
.stub {
  min-height: calc(100vh - 158px);
  display: grid;
  place-items: center;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: 40px 20px;
}
.stub__icon {
  width: 64px; height: 64px; border-radius: 20px;
  display: grid; place-items: center;
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 9%, transparent);
}
.stub h1 { font-size: 17px; }
.stub__text { font-size: 12.5px; color: var(--fg-sub); line-height: 1.7; }
.stub__sub { color: var(--fg-muted); font-size: 11.5px; }
</style>
