<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance } from 'ant-design-vue'
import AppIcon from '@/components/AppIcon.vue'
import { useAssetRepo } from '@/composables/useAssetRepo'
import type { AssetType, ItemSavePayload } from '@/api/types'

/**
 * 新建 / 编辑资产的表单抽屉。
 * 开关与编辑目标直接读写 useAssetRepo 单例（drawerOpen / editing），
 * 提交走 composable 的 submit：失败时抽屉保持打开，用户改完再交。
 */
const { t } = useI18n()
const { drawerOpen, editing, saving, closeDrawer, submit } = useAssetRepo()

const formRef = ref<FormInstance>()

/** 语言选项 = Shiki 已装载的语法集（见 useShiki 的 LANGS），选了就一定有高亮 */
const LANG_OPTIONS = ['ts', 'javascript', 'vue', 'java', 'python', 'go', 'sql', 'bash', 'json', 'yaml', 'md', 'text']

const ASSET_TYPES: AssetType[] = ['snippet', 'component', 'function', 'doc', 'link']
const typeOptions = computed(() => ASSET_TYPES.map((v) => ({ label: t(`repo.types.${v}`), value: v })))

const formState = reactive({
  name: '',
  type: 'snippet' as AssetType,
  lang: 'ts',
  description: '',
  tags: [] as string[],
  content: '',
})

const rules = computed(() => ({
  name: [{ required: true, message: t('repo.form.nameRequired'), trigger: 'blur' }],
  content: [{ required: true, message: t('repo.form.contentRequired'), trigger: 'blur' }],
}))

/** 代码类资产才显示语言选择；doc 固定 md、link 无语言——语义在类型上，不重复让用户选 */
const isCodeType = computed(() => ['snippet', 'component', 'function'].includes(formState.type))

// 每次打开重置表单：编辑态回填原值，新建态回默认值
watch(drawerOpen, (open) => {
  if (!open) return
  formRef.value?.resetFields()
  const src = editing.value
  Object.assign(formState, {
    name: src?.name ?? '',
    type: src?.type ?? 'snippet',
    lang: src?.lang ?? 'ts',
    description: src?.description ?? '',
    tags: src ? [...src.tags] : [],
    content: src?.content ?? '',
  })
})

/** 类型切换时把语言带到位：doc → md、link → text（提交时会被置空），代码类保持用户所选 */
watch(
  () => formState.type,
  (type) => {
    if (type === 'doc') formState.lang = 'md'
    if (type === 'link') formState.lang = 'text'
  },
)

async function onSubmit(): Promise<void> {
  await formRef.value?.validate()
  const payload: ItemSavePayload = {
    name: formState.name.trim(),
    type: formState.type,
    // doc/link 的语言是类型推导值，不提交用户无意义的输入
    lang: isCodeType.value ? formState.lang : formState.type === 'doc' ? 'md' : undefined,
    description: formState.description.trim() || undefined,
    content: formState.content,
    tags: formState.tags,
  }
  await submit(payload)
}
</script>

<template>
  <a-drawer
    :open="drawerOpen"
    :title="editing ? t('repo.form.editTitle') : t('repo.form.createTitle')"
    :width="520"
    destroy-on-close
    @close="closeDrawer"
  >
    <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical" class="item-form">
      <a-form-item :label="t('repo.form.name')" name="name">
        <a-input v-model:value="formState.name" :placeholder="t('repo.form.namePlaceholder')" allow-clear />
      </a-form-item>

      <a-form-item :label="t('repo.form.type')" name="type">
        <a-select v-model:value="formState.type" :options="typeOptions" />
      </a-form-item>

      <a-form-item v-if="isCodeType" :label="t('repo.form.lang')" name="lang">
        <a-select v-model:value="formState.lang" :options="LANG_OPTIONS.map((v) => ({ value: v }))" />
      </a-form-item>

      <a-form-item :label="t('repo.form.tags')" name="tags" :extra="t('repo.form.tagsHint')">
        <a-select
          v-model:value="formState.tags"
          mode="tags"
          :placeholder="t('repo.form.tagsPlaceholder')"
          :open="false"
          :token-separators="[',', ' ']"
        />
      </a-form-item>

      <a-form-item :label="t('repo.form.description')" name="description">
        <a-textarea v-model:value="formState.description" :rows="2" :placeholder="t('repo.form.descriptionPlaceholder')" />
      </a-form-item>

      <a-form-item :label="t('repo.form.content')" name="content" :extra="t('repo.form.contentHint')">
        <a-textarea
          v-model:value="formState.content"
          :rows="14"
          :placeholder="t('repo.form.contentPlaceholder')"
          class="mono-input"
        />
      </a-form-item>
    </a-form>

    <template #footer>
      <div class="drawer-footer">
        <a-button @click="closeDrawer">{{ t('repo.form.cancel') }}</a-button>
        <a-button type="primary" :loading="saving" @click="onSubmit">
          <template #icon><AppIcon name="save" :size="13" /></template>
          {{ t('repo.form.submit') }}
        </a-button>
      </div>
    </template>
  </a-drawer>
</template>

<style scoped lang="less">
.mono-input :deep(textarea) {
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.6;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
