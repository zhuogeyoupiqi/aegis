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
    <div class="stub__icon"><AppIcon name="cube" :size="30" /></div>
    <h1>{{ title }}</h1>
    <p>
      {{ group ? `「${group}」下的 ` : '' }}该模块在后续迭代开放，
      当前入口为 MVP 第 1 周验证范围外的占位。
    </p>
    <p class="stub__sub">菜单结构已按方案文档 §6 预置，接口与页面将按迭代计划逐步补齐。</p>
    <button class="btn" @click="router.push('/workbench')">
      <AppIcon name="chevronRight" :size="13" />
      返回工作台
    </button>
  </div>
</template>

<style scoped>
.stub {
  min-height: calc(100vh - 158px);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px;
  text-align: center;
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
  margin-bottom: 6px;
}
.stub h1 { font-size: 17px; }
.stub p { font-size: 12.5px; color: var(--fg-sub); max-width: 420px; line-height: 1.7; }
.stub__sub { color: var(--fg-muted) !important; font-size: 11.5px !important; }
.stub .btn { margin-top: 12px; }
</style>
