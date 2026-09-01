<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { insertAtCursor, TPL_OPTIONS, VAR_CHIPS } from '@/composables/useSyslogTemplate'

const props = defineProps<{
  tplText: string
  currentTpl: string
  previewHtml: string
}>()

const emit = defineEmits<{
  'update:tplText': [value: string]
  'update:currentTpl': [value: string]
}>()

const { t } = useI18n()

const tplArea = ref<HTMLTextAreaElement | null>(null)

function onTplChange(v: string | number): void {
  emit('update:currentTpl', String(v))
}

function insertVar(v: string): void {
  const area = tplArea.value
  if (!area) return
  insertAtCursor(area, v)
  emit('update:tplText', area.value)
}

function onInput(e: Event): void {
  emit('update:tplText', (e.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <section class="panel panel--template">
    <div class="panel-head">
      <AppIcon name="terminal" :size="15" />
      <h2>{{ t('syslog.tplTitle') }}</h2>
      <span class="sub">{{ t('syslog.tplSub') }}</span>
    </div>
    <div class="panel-body">
      <div class="field">
        <a-segmented :value="currentTpl" :options="TPL_OPTIONS" @change="onTplChange" />
      </div>

      <!--
        模板编辑用原生 textarea：等宽字体 / 行高 / 焦点环是强定制需求，
        antd 的 CSS-in-JS 样式优先级高于打包样式，覆盖麻烦；光标插入也依赖原生 selection API。
      -->
      <textarea
        ref="tplArea"
        :value="tplText"
        class="code-area"
        spellcheck="false"
        @input="onInput"
      />

      <div class="var-section">
        <p class="var-title">{{ t('syslog.varHint') }}</p>
        <div class="var-chips">
          <button
            v-for="v in VAR_CHIPS"
            :key="v"
            class="var-chip"
            @click="insertVar(v)"
          >
            {{ v }}
          </button>
        </div>
      </div>

      <div class="render-preview" v-html="previewHtml" />
    </div>
  </section>
</template>
