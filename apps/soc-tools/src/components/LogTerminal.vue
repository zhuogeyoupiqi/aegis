<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import type { LogLine } from '@/composables/useSyslogSender'

const props = defineProps<{
  logs: LogLine[]
  sending: boolean
  sent: number
  failed: number
  total: number
  elapsed: number
  rate: number
  autoScroll: boolean
}>()

const emit = defineEmits<{
  'update:autoScroll': [value: boolean]
  clear: []
}>()

const { t } = useI18n()

const termBody = ref<HTMLElement | null>(null)

// 日志新增或自动滚动开关打开时，滚动到底部
watch(
  () => props.logs.length,
  async () => {
    if (!props.autoScroll) return
    await nextTick()
    if (termBody.value) termBody.value.scrollTop = termBody.value.scrollHeight
  },
)
watch(
  () => props.autoScroll,
  async (enabled) => {
    if (!enabled) return
    await nextTick()
    if (termBody.value) termBody.value.scrollTop = termBody.value.scrollHeight
  },
)
</script>

<template>
  <section class="panel panel--terminal">
    <div class="panel-head">
      <span class="term-status" :class="{ running: sending }">
        <span class="dot" />{{ sending ? t('syslog.stSending') : t('syslog.stIdle') }}
      </span>
      <h2>{{ t('syslog.termTitle') }}</h2>
      <div class="right">
        <div class="term-stats">
          <span class="stat">{{ t('syslog.statSent') }} <b>{{ sent }}</b></span>
          <span class="stat stat--err">{{ t('syslog.statFailed') }} <b>{{ failed }}</b></span>
          <span class="stat">{{ t('syslog.statRate') }} <b>{{ rate.toFixed(1) }}</b> {{ t('syslog.perSec') }}</span>
          <span class="stat">{{ t('syslog.statElapsed') }} <b>{{ elapsed.toFixed(1) }}</b>s</span>
        </div>
        <a-button size="small" @click="$emit('update:autoScroll', !autoScroll)">
          {{ t('syslog.autoScroll') }}：{{ autoScroll ? t('syslog.on') : t('syslog.off') }}
        </a-button>
        <a-button size="small" :disabled="logs.length === 0" @click="$emit('clear')">
          {{ t('syslog.clear') }}
        </a-button>
      </div>
    </div>

    <div ref="termBody" class="term-body">
      <div v-if="logs.length === 0" class="term-empty">
        <div>
          <AppIcon name="terminal" :size="30" />
          <br />{{ t('syslog.termEmpty') }}
        </div>
      </div>
      <div v-for="line in logs" :key="line.seq" class="term-line">
        <span class="ts">{{ line.ts }}</span>
        <span class="no">#{{ line.seq }}</span>
        <span class="res" :class="line.fail ? 'fail' : 'ok'">{{ line.fail ? '✕' : '✓' }}</span>
        <span class="sev-badge" :class="line.sevCls">{{ t(`syslog.sev.${line.sevKey}`) }} {{ line.sevNum }}</span>
        <span class="msg" v-html="line.html" />
      </div>
    </div>
  </section>
</template>
