<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

/**
 * 标题与分组都从 query 里的菜单 key 解析词条（而不是显示字符串）：
 * 语言切换后无需改 URL，标题自动跟随新语言。
 */
const title = computed(() => {
  const itemKey = route.query.item as string | undefined
  return itemKey ? t(`menu.items.${itemKey}`) : t('stub.title')
})
const group = computed(() => {
  const groupKey = route.query.group as string | undefined
  return groupKey ? t(`menu.groups.${groupKey}`) : ''
})

/** 正文按「有无分组」用两条词条，分组名进插值，语序由各语言包自己控制 */
const text = computed(() => (group.value ? t('stub.text', { group: group.value }) : t('stub.textNoGroup')))
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
        <p class="stub__text">{{ text }}</p>
        <p class="stub__sub">{{ t('stub.sub') }}</p>
      </template>
      <template #extra>
        <a-button type="primary" @click="router.push('/workbench')">
          <template #icon><AppIcon name="chevronRight" :size="13" /></template>
          {{ t('stub.back') }}
        </a-button>
      </template>
    </a-result>
  </div>
</template>

<style scoped lang="less">
.stub {
  min-height: calc(100vh - 158px);
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: 40px 20px;

  &__icon {
    width: 64px; height: 64px; border-radius: 20px;
    display: flex; align-items: center; justify-content: center;
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 9%, transparent);
  }

  h1 { font-size: 17px; }

  &__text { font-size: 12.5px; color: var(--fg-sub); line-height: 1.7; }
  &__sub { color: var(--fg-muted); font-size: 11.5px; }
}
</style>
