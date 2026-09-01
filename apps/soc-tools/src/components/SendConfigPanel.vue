<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { PROTOCOL_OPTIONS } from '@/composables/useSyslogSender'

const props = defineProps<{
  targetIp: string
  targetPort: number
  sendCount: number
  sendInterval: number
  randomize: boolean
  sending: boolean
  whitelistOk: boolean
}>()

const emit = defineEmits<{
  'update:targetIp': [value: string]
  'update:targetPort': [value: number]
  'update:sendCount': [value: number]
  'update:sendInterval': [value: number]
  'update:randomize': [value: boolean]
  send: []
}>()

const { t } = useI18n()
</script>

<template>
  <section class="panel panel--config">
    <div class="panel-head">
      <AppIcon name="sliders" :size="15" />
      <h2>{{ t('syslog.configTitle') }}</h2>
      <span class="sub">{{ t('syslog.configSub') }}</span>
    </div>
    <div class="panel-body">
      <!-- 目标地址 -->
      <div class="field">
        <label>{{ t('syslog.targetLabel') }}</label>
        <div class="ip-row">
          <a-input
            :value="targetIp"
            class="ip-row__ip"
            spellcheck="false"
            @update:value="$emit('update:targetIp', $event)"
          />
          <a-input-number
            :value="targetPort"
            class="ip-row__port"
            :min="1"
            :max="65535"
            :controls="false"
            @update:value="$emit('update:targetPort', $event)"
          />
        </div>
        <p class="field-hint" :class="whitelistOk ? 'ok' : 'bad'">
          <template v-if="whitelistOk">
            <AppIcon name="check" :size="11" /> {{ t('syslog.wlOk') }}
          </template>
          <template v-else>
            <AppIcon name="xCircle" :size="11" /> {{ t('syslog.wlBad') }}
          </template>
        </p>
      </div>

      <!-- 传输协议 -->
      <div class="field">
        <label>{{ t('syslog.protocolLabel') }}</label>
        <a-segmented value="UDP" :options="PROTOCOL_OPTIONS" />
        <p class="field-hint">{{ t('syslog.protocolHint') }}</p>
      </div>

      <!-- 数量 / 间隔 -->
      <div class="field">
        <label>{{ t('syslog.countLabel') }}</label>
        <div class="ip-row">
          <a-input-number
            :value="sendCount"
            class="ip-row__num"
            :min="1"
            :max="2000"
            @update:value="$emit('update:sendCount', $event)"
          />
          <a-input-number
            :value="sendInterval"
            class="ip-row__num"
            :min="50"
            :step="50"
            addon-after="ms"
            @update:value="$emit('update:sendInterval', $event)"
          />
        </div>
        <p class="field-hint">{{ t('syslog.countHint') }}</p>
      </div>

      <!-- 变量随机化 -->
      <div class="switch-row">
        <div class="info">
          <b>{{ t('syslog.randomizeTitle') }}</b>
          <span>{{ t('syslog.randomizeHint') }}</span>
        </div>
        <a-switch :checked="randomize" size="small" @update:checked="$emit('update:randomize', $event)" />
      </div>

      <!-- 发送按钮 -->
      <div class="send-area">
        <a-button
          block
          :type="sending ? 'default' : 'primary'"
          :danger="sending"
          @click="$emit('send')"
        >
          <template #icon><AppIcon name="send" :size="14" /></template>
          {{ sending ? t('syslog.stop') : t('syslog.start') }}
        </a-button>
        <slot name="progress" />
      </div>
    </div>
  </section>
</template>
