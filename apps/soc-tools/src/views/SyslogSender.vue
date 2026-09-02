<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { App } from 'ant-design-vue'
import { bindFeedback } from '@aegis/shared'
import AppIcon from '@/components/AppIcon.vue'
import SendConfigPanel from '@/components/SendConfigPanel.vue'
import TemplatePanel from '@/components/TemplatePanel.vue'
import LogTerminal from '@/components/LogTerminal.vue'
import HistoryDrawer from '@/components/HistoryDrawer.vue'
import { useSyslogTemplate } from '@/composables/useSyslogTemplate'
import { useSyslogSender } from '@/composables/useSyslogSender'
import { useSyslogHistory } from '@/composables/useSyslogHistory'
import { getApiMode } from '@/api'

const { t } = useI18n()

// 接入 <a-app> 上下文：toast 与确认弹窗要吃当前主题（暗色不闪白底）
const { message: antdMessage } = App.useApp()
bindFeedback(antdMessage)

/**
 * 当前数据源模式的只读展示。控制点在基座设置抽屉（经数据通道下发），
 * 子应用页面上只显示不切换——两处开关会造成状态打架。
 * computed 内读 getApiMode() 会跟踪 lastApiMode ref，基座切换后徽标实时跟随。
 */
const apiModeLabel = computed(() =>
  getApiMode() === 'real' ? t('syslog.sourceReal') : t('syslog.sourceMock'),
)

/* ---------- 模板能力 ---------- */
// randomize 由父级持有：同时影响模板渲染与发送配置表单
const randomize = ref(true)
const { currentTpl, tplText, previewHtml, onTplChange, renderForDriver } = useSyslogTemplate(randomize)

/* ---------- 发送能力 ---------- */
const sender = useSyslogSender(currentTpl, renderForDriver)
const {
  targetIp,
  targetPort,
  sendCount,
  sendInterval,
  whitelistOk,
  sending,
  sent,
  failed,
  total,
  elapsed,
  rate,
  autoScroll,
  logs,
  progressPct,
  gradColors,
  clearLogs,
  toggleSend,
} = sender

/* ---------- 历史与预设 ---------- */
const history = useSyslogHistory(
  sending,
  () => ({
    targetIp: targetIp.value,
    targetPort: targetPort.value,
    templateKey: currentTpl.value,
    templateContent: tplText.value,
    count: sendCount.value,
    intervalMs: sendInterval.value,
    randomize: randomize.value,
  }),
  (cfg) => {
    targetIp.value = cfg.targetIp
    targetPort.value = cfg.targetPort
    sendCount.value = cfg.count
    sendInterval.value = cfg.intervalMs
    randomize.value = cfg.randomize
    currentTpl.value = cfg.templateKey
    tplText.value = cfg.templateContent
  },
)
const {
  histOpen,
  histTab,
  historyLoading,
  presetLoading,
  historyList,
  presetList,
  openHistory,
  saveOpen,
  presetName,
  savingPreset,
  openSaveModal,
  confirmSavePreset,
  applyHistory,
  applyPreset,
  removeHistoryTask,
  clearFinishedHistory,
  removePreset,
} = history

/** 弹窗里实时预览将要保存的配置摘要 */
const presetSummaryPreview = computed(
  () =>
    `${targetIp.value.trim()}:${targetPort.value} · ${currentTpl.value} · ×${sendCount.value} · ${sendInterval.value}ms · ${randomize.value ? 'rand' : 'fixed'}`,
)
</script>

<template>
  <div class="syslog-page">
    <!-- 页头 -->
    <div class="page-header">
      <div>
        <h1>{{ t('syslog.title') }}</h1>
        <p class="desc">{{ t('syslog.desc') }}</p>
        <div class="page-badges">
          <span class="pbadge pbadge--ok"><span class="dot" />{{ t('syslog.wlBadge') }}</span>
          <span class="pbadge">{{ t('syslog.auditBadge') }}</span>
        </div>
      </div>
      <div class="page-header-actions">
        <!-- 数据源只读徽标：控制点在基座设置抽屉，这里仅展示当前模式 -->
        <span class="pbadge" :title="t('syslog.sourceLabel')">
          {{ t('syslog.sourceLabel') }} · {{ apiModeLabel }}
        </span>
        <a-button @click="openSaveModal">
          <template #icon><AppIcon name="save" :size="13" /></template>
          {{ t('syslog.saveTask') }}
        </a-button>
        <a-button @click="openHistory">
          <template #icon><AppIcon name="clock" :size="13" /></template>
          {{ t('syslog.history') }}
        </a-button>
      </div>
    </div>

    <div class="content-grid">
      <!-- ===== 发送配置 ===== -->
      <SendConfigPanel
        v-model:target-ip="targetIp"
        v-model:target-port="targetPort"
        v-model:send-count="sendCount"
        v-model:send-interval="sendInterval"
        v-model:randomize="randomize"
        :sending="sending"
        :whitelist-ok="whitelistOk"
        @send="toggleSend"
      >
        <template #progress>
          <a-progress
            class="send-progress"
            :percent="progressPct"
            :show-info="false"
            :stroke-color="gradColors"
            size="small"
          />
        </template>
      </SendConfigPanel>

      <!-- ===== 消息模板 ===== -->
      <TemplatePanel
        :tpl-text="tplText"
        :current-tpl="currentTpl"
        :preview-html="previewHtml"
        @update:tpl-text="tplText = $event"
        @update:current-tpl="onTplChange"
      />

      <!-- ===== 实时日志终端（恒定深色，不随主题切换） ===== -->
      <LogTerminal
        :logs="logs"
        :sending="sending"
        :sent="sent"
        :failed="failed"
        :total="total"
        :elapsed="elapsed"
        :rate="rate"
        v-model:auto-scroll="autoScroll"
        @clear="clearLogs"
      />
    </div>

    <!-- 保存配置预设弹窗：确定按钮随名称非空解锁，摘要实时预览将存下的内容 -->
    <a-modal
      v-model:open="saveOpen"
      :title="t('syslog.savePresetTitle')"
      :ok-text="t('syslog.actionSave')"
      :cancel-text="t('syslog.actionCancel')"
      :confirm-loading="savingPreset"
      :ok-button-props="{ disabled: !presetName.trim() }"
      @ok="confirmSavePreset"
    >
      <div class="preset-form">
        <label>{{ t('syslog.presetNameLabel') }}</label>
        <a-input
          v-model:value="presetName"
          :maxlength="64"
          :placeholder="t('syslog.presetNamePh')"
          @press-enter="confirmSavePreset"
        />
        <p class="preset-summary">{{ presetSummaryPreview }}</p>
      </div>
    </a-modal>

    <!-- 发送历史抽屉：历史任务（留痕）与保存的配置（预设）两个页签 -->
    <HistoryDrawer
      v-model:open="histOpen"
      v-model:tab="histTab"
      :history-list="historyList"
      :preset-list="presetList"
      :history-loading="historyLoading"
      :preset-loading="presetLoading"
      :sending="sending"
      @apply-history="applyHistory"
      @apply-preset="applyPreset"
      @delete-history="removeHistoryTask"
      @clear-history="clearFinishedHistory"
      @delete-preset="removePreset"
    />
  </div>
</template>

<style lang="less">
/* 注意：本页样式使用非 scoped，因为子组件（SendConfigPanel/TemplatePanel/LogTerminal）
   需要共享这些样式；iframe 沙箱会在切走时销毁，因此不会影响基座其他页面。 */
.syslog-page {
  padding: 18px 20px 28px;
  min-height: 100vh;
}

/* ---------- 页头 ---------- */
.page-header {
  display: flex; align-items: flex-start; gap: 14px;
  margin-bottom: 16px;

  h1 {
    font-size: 17px; font-weight: 700;
    display: flex; align-items: center; gap: 10px;
  }

  .desc { color: var(--fg-muted); font-size: 12.5px; margin-top: 5px; line-height: 1.6; }
}

.page-badges { display: flex; gap: 8px; margin-top: 9px; }
.pbadge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 10px; border-radius: 10px; font-size: 11.5px;
  border: 1px solid var(--border); color: var(--fg-sub);
  background: var(--bg-card);

  .dot { width: 6px; height: 6px; border-radius: 50%; }

  &--ok {
    color: var(--sev-low);
    border-color: color-mix(in srgb, var(--sev-low) 30%, transparent);
    background: color-mix(in srgb, var(--sev-low) 6%, transparent);

    .dot {
      background: var(--sev-low);
      box-shadow: 0 0 6px color-mix(in srgb, var(--sev-low) 60%, transparent);
    }
  }
}

.page-header-actions { margin-left: auto; display: flex; gap: 10px; flex: none; }

/* ---------- 布局网格 ---------- */
.content-grid {
  display: grid; gap: 14px;
  grid-template-columns: 355px 1fr;
  grid-template-areas: 'config template' 'terminal terminal';
}
.panel--config { grid-area: config; }
.panel--template { grid-area: template; }
.panel--terminal { grid-area: terminal; display: flex; flex-direction: column; }

/* 地址/数字行：antd 控件组合布局 */
.ip-row {
  display: flex; gap: 8px;

  &__port { width: 88px; flex: none; }
  &__num { flex: 1; min-width: 0; }

  /* IP 与端口是技术值，统一等宽字体 */
  input { font-family: var(--font-mono); }
}

.send-area { margin-top: 14px; }
.send-progress { margin-top: 10px; }

/* ---------- 模板区 ---------- */
.code-area {
  width: 100%; min-height: 118px; resize: vertical;
  padding: 11px 13px;
  background: var(--bg-input);
  border: 1px solid transparent; border-radius: var(--radius-ctl);
  color: var(--fg); font-family: var(--font-mono); font-size: 12px; line-height: 1.7;
  transition: border-color var(--ease), box-shadow var(--ease), background var(--ease);

  &:focus {
    outline: none; background: var(--input-focus-bg);
    border-color: color-mix(in srgb, var(--primary) 50%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent);
  }
}

.var-section { margin-top: 13px; }
.var-title { font-size: 11.5px; color: var(--fg-muted); margin-bottom: 8px; }
.var-chips { display: flex; flex-wrap: wrap; gap: 7px; }
/* 变量 chip 是品牌化的等宽代码片段按钮，antd 无对应形态，保持自研 */
.var-chip {
  padding: 3px 10px; border-radius: 7px;
  background: color-mix(in srgb, var(--primary) 7%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 22%, transparent);
  color: var(--primary); font-family: var(--font-mono); font-size: 11.5px;
  cursor: pointer; transition: all var(--ease);

  &:hover { background: color-mix(in srgb, var(--primary) 14%, transparent); transform: translateY(-1px); }
}

.render-preview {
  margin-top: 13px; padding: 11px 13px;
  background: var(--bg-input);
  border: 1px dashed color-mix(in srgb, var(--primary) 30%, transparent);
  border-radius: var(--radius-ctl);
  font-family: var(--font-mono); font-size: 11.5px; line-height: 1.7;
  color: var(--fg-sub); word-break: break-all;

  .pv-label { color: var(--fg-muted); }
  .hl { color: var(--primary); font-weight: 600; }
  .hl-ip { color: var(--sev-high); font-weight: 600; }
}

/* ---------- 终端 ---------- */
.term-stats { display: flex; gap: 16px; align-items: center; font-size: 12px; color: var(--fg-muted); }
.stat b { color: var(--fg); font-family: var(--font-mono); font-weight: 600; }
.stat--err b { color: var(--sev-critical); }

.term-status {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 10px; border-radius: 10px; font-size: 11.5px;
  color: var(--fg-muted);

  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--fg-muted); }

  &.running {
    color: var(--sev-low);
    background: color-mix(in srgb, var(--sev-low) 7%, transparent);
    border: 1px solid color-mix(in srgb, var(--sev-low) 30%, transparent);

    .dot {
      background: var(--sev-low);
      box-shadow: 0 0 8px color-mix(in srgb, var(--sev-low) 70%, transparent);
      animation: blink 1.2s ease-in-out infinite;
    }
  }
}
@keyframes blink { 50% { opacity: 0.35; } }

.term-body {
  flex: 1; height: 320px; overflow-y: auto;
  padding: 12px 14px;
  background: var(--bg-terminal);
  border-radius: 0 0 var(--radius) var(--radius);
  font-family: var(--font-mono); font-size: 12px; line-height: 1.85;

  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); }
}

.term-line {
  display: flex; gap: 10px; align-items: baseline;
  padding: 1px 0;
  animation: line-in 0.25s ease-out;

  .ts { color: #6b7688; flex: none; }
  .no { color: #6b7688; flex: none; min-width: 38px; text-align: right; }
  .res {
    flex: none; width: 14px; text-align: center; color: var(--sev-low-v);

    &.fail { color: var(--sev-critical-v); font-weight: 700; }
  }
  .msg { word-break: break-all; color: #aeb9cc; min-width: 0; }

  /* 内外网 IP 视觉区分（终端内亮色档） */
  .ip-int { color: #22d3ee; }
  .ip-ext { color: var(--sev-high-v); }
}
@keyframes line-in { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }

/* 语义等级徽标：色 + 文字缺一不可，终端内用 vivid 档 */
.sev-badge {
  flex: none; display: inline-block;
  padding: 0 7px; margin-right: 6px; border-radius: 4px;
  font-size: 10.5px; line-height: 17px; font-weight: 700;

  &.lv-critical { color: var(--sev-critical-v); background: rgba(248, 113, 113, 0.12); box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.4); }
  &.lv-high { color: var(--sev-high-v); background: rgba(251, 146, 60, 0.12); box-shadow: inset 0 0 0 1px rgba(251, 146, 60, 0.4); }
  &.lv-medium { color: var(--sev-medium-v); background: rgba(250, 204, 21, 0.1); box-shadow: inset 0 0 0 1px rgba(250, 204, 21, 0.4); }
  &.lv-low { color: var(--sev-low-v); background: rgba(74, 222, 128, 0.1); box-shadow: inset 0 0 0 1px rgba(74, 222, 128, 0.4); }
}

.term-empty {
  height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: #6b7688; font-size: 12px; text-align: center; line-height: 2;

  svg { opacity: 0.4; }
}

/* ---------- 保存预设弹窗 / 历史抽屉 ---------- */
.preset-form {
  display: flex; flex-direction: column; gap: 8px;
  padding-top: 4px;

  label { font-size: 12.5px; font-weight: 600; }
}

/* 摘要是技术值串（IP/模板/数量），等宽展示便于扫读 */
.preset-summary {
  font-size: 11.5px; color: var(--fg-muted);
  font-family: var(--font-mono); word-break: break-all;
  padding: 8px 10px; border-radius: var(--radius-ctl);
  background: var(--bg-input);
}
.cell-mono { font-family: var(--font-mono); font-size: 11.5px; }
.cell-fail { color: var(--sev-critical); font-family: var(--font-mono); font-size: 11.5px; }

/* ---------- 响应式 ---------- */
@media (max-width: 1200px) {
  .content-grid {
    grid-template-columns: 1fr;
    grid-template-areas: 'config' 'template' 'terminal';
  }
}
</style>
