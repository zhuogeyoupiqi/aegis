<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import {
  fmtDuration,
  fmtTime,
  presetSummary,
  statusColor,
  statusLabel,
} from '@/composables/useSyslogHistory'
import type { SendPreset, TaskHistoryItem } from '@/api'

const props = defineProps<{
  open: boolean
  tab: string
  historyList: TaskHistoryItem[]
  presetList: SendPreset[]
  historyLoading: boolean
  presetLoading: boolean
  sending: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:tab': [value: string]
  'apply-history': [item: TaskHistoryItem]
  'apply-preset': [preset: SendPreset]
  'delete-history': [item: TaskHistoryItem]
  'clear-history': []
  'delete-preset': [preset: SendPreset]
}>()

const { t } = useI18n()

const histColumns = computed(() => [
  { title: t('syslog.colTime'), key: 'createTime', width: 140 },
  { title: t('syslog.colTarget'), key: 'target', width: 150 },
  { title: t('syslog.colTpl'), dataIndex: 'templateKey', width: 70 },
  { title: t('syslog.colCount'), key: 'count', width: 110 },
  { title: t('syslog.colStatus'), key: 'status', width: 86 },
  { title: t('syslog.colDuration'), key: 'duration', width: 76 },
  { title: t('syslog.colAction'), key: 'action', width: 110 },
])

const presetColumns = computed(() => [
  { title: t('syslog.colName'), dataIndex: 'name', key: 'name', width: 180 },
  { title: t('syslog.colSummary'), key: 'summary' },
  { title: t('syslog.colAction'), key: 'action', width: 116 },
])

function onClose(): void {
  emit('update:open', false)
}

function onTabChange(key: string): void {
  emit('update:tab', key)
}
</script>

<template>
  <a-drawer :open="open" :title="t('syslog.histTitle')" width="780" @close="onClose">
    <a-tabs :active-key="tab" @change="onTabChange">
      <template #rightExtra>
        <a-button
          v-if="tab === 'history'"
          size="small"
          danger
          :disabled="historyList.length === 0 || historyLoading"
          @click="$emit('clear-history')"
        >
          {{ t('syslog.clearFinished') }}
        </a-button>
      </template>

      <a-tab-pane key="history" :tab="t('syslog.tabHistory')">
        <a-table
          :columns="histColumns"
          :data-source="historyList"
          :loading="historyLoading"
          :pagination="false"
          :scroll="{ y: 420 }"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'createTime'">
              <span class="cell-mono">{{ fmtTime(record.createTime) }}</span>
            </template>
            <template v-else-if="column.key === 'target'">
              <span class="cell-mono">{{ record.targetIp }}:{{ record.targetPort }}</span>
            </template>
            <template v-else-if="column.key === 'count'">
              <span class="cell-mono">{{ record.sentCount }}/{{ record.totalCount }}</span>
              <span v-if="record.failedCount > 0" class="cell-fail"> ✕{{ record.failedCount }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status, t) }}</a-tag>
            </template>
            <template v-else-if="column.key === 'duration'">
              <span class="cell-mono">{{ fmtDuration(record.durationMs) }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" :disabled="sending" @click="$emit('apply-history', record)">
                {{ t('syslog.actionReplay') }}
              </a-button>
              <a-button
                type="link"
                size="small"
                danger
                :disabled="record.status === 'RUNNING'"
                @click="$emit('delete-history', record)"
              >
                {{ t('syslog.actionDelete') }}
              </a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="presets" :tab="t('syslog.tabPresets')">
        <a-table
          :columns="presetColumns"
          :data-source="presetList"
          :loading="presetLoading"
          :pagination="false"
          :scroll="{ y: 420 }"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'summary'">
              <span class="cell-mono">{{ presetSummary(record) }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" :disabled="sending" @click="$emit('apply-preset', record)">
                {{ t('syslog.actionLoad') }}
              </a-button>
              <a-button type="link" size="small" danger @click="$emit('delete-preset', record)">
                {{ t('syslog.actionDelete') }}
              </a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>
  </a-drawer>
</template>
