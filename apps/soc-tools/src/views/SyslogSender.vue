<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { App } from 'ant-design-vue'
import { bindFeedback, escapeHtml, lastThemeSnapshot, nowTime, pad, pick, randomInt, toast } from '@aegis/shared'
import AppIcon from '@/components/AppIcon.vue'

/* ============================================================
   Syslog 发包器 —— SOC 工具集第 1 个真实工具
   当前为纯前端 mock：发送动作用 setInterval 模拟。
   真实实现（第 2 周后端就绪）：后端 DatagramSocket 直发 + SSE 回传，
   本页只需把「模拟循环」换成 SSE 事件监听，交互与样式不动。
   ============================================================ */

const { t } = useI18n()

// 接入 <a-app> 上下文的 message 实例：toast 才能吃到当前主题（暗色不闪白底）
bindFeedback(App.useApp().message)

/* ---------- 模板与样本数据（贴近真实 SOC 场景） ---------- */
const TEMPLATES: Record<string, string> = {
  CEF: 'CEF:0|Security|Aegis-Test|1.0|${event_id}|${event_name}|${severity}|src=${random_ip} dst=192.168.1.20 suser=${user} dhost=WEB-01 msg=Triggered by Aegis sender seq=${seq}',
  LEEF: 'LEEF:1.0|Aegis|ThreatSensor|2.1|${event_id}|src=${random_ip} dst=192.168.1.20 sev=${severity} usrName=${user} msg=${event_name}',
  JSON: '{"facility":"auth","severity":${severity},"event_id":"${event_id}","name":"${event_name}","src":"${random_ip}","dst":"192.168.1.20","user":"${user}","ts":"${timestamp}"}',
  KV: 'time=${timestamp} event_id=${event_id} name=${event_name} sev=${severity} src=${random_ip} dst=192.168.1.20 user=${user} action=deny',
}
/** 模板选择器的选项（KV 对外展示为 Key-Value） */
const TPL_OPTIONS = [
  { label: 'CEF', value: 'CEF' },
  { label: 'LEEF', value: 'LEEF' },
  { label: 'JSON', value: 'JSON' },
  { label: 'Key-Value', value: 'KV' },
]

/** 事件池：模拟 SIEM 常见告警类型（名称 + severity 0-10） */
const EVENT_POOL = [
  { id: '1001', name: 'Brute Force Login Attempt', sev: 8 },
  { id: '1002', name: 'Port Scan Detected', sev: 6 },
  { id: '1003', name: 'Malware Hash Match', sev: 9 },
  { id: '1004', name: 'Privilege Escalation Attempt', sev: 9 },
  { id: '1005', name: 'Data Exfiltration Suspected', sev: 8 },
  { id: '1006', name: 'Suspicious DNS Query', sev: 5 },
  { id: '1007', name: 'Login Outside Business Hours', sev: 4 },
  { id: '1008', name: 'Webshell Upload Detected', sev: 9 },
] as const

const USER_POOL = ['admin', 'root', 'svc_backup', 'zhang.wei', 'oracle', 'gitlab-runner', 'jenkins'] as const
/** 内外网源 IP 池：内网青色、外网橙色（终端内视觉区分） */
const IP_INT_POOL = ['10.12.33.', '10.20.8.', '172.16.4.', '192.168.10.'] as const
const IP_EXT_POOL = ['45.132.88.', '103.44.7.', '185.220.101.', '91.240.118.'] as const

const VAR_CHIPS = ['${timestamp}', '${seq}', '${random_ip}', '${user}', '${event_id}', '${event_name}', '${severity}']

/* ---------- 表单状态 ---------- */
const targetIp = ref('10.12.33.45')
const targetPort = ref(514) // 协议固定 UDP（TCP/TLS 二期支持）
const sendCount = ref(50)
const sendInterval = ref(200)
const loopback = ref(true) // 预留后端参数：本地 5140 收自己发的包自证格式
const randomize = ref(true) // 关闭后使用固定样本，便于复现问题
const currentTpl = ref('CEF')
const tplText = ref(TEMPLATES.CEF)

/** 白名单：真实后端会硬拦 10.0.0.0/8 之外的目标，mock 在前端先拦一道 */
const whitelistOk = computed(() => /^10\./.test(targetIp.value.trim()))

/** 传输协议选项：UDP 可用，TCP/TLS 二期开放（a-segmented 的 disabled 项） */
const PROTOCOL_OPTIONS = [
  { label: 'UDP', value: 'UDP' },
  { label: 'TCP', value: 'TCP', disabled: true },
  { label: 'TLS', value: 'TLS', disabled: true },
]

/* ---------- 发送状态 ---------- */
const sending = ref(false)
const sent = ref(0)
const failed = ref(0)
const total = ref(0)
const startTime = ref(0)
const elapsed = ref(0)
const rate = ref(0)
const autoScroll = ref(true)
let sendTimer: ReturnType<typeof setInterval> | null = null
let statsTimer: ReturnType<typeof setInterval> | null = null
let failAt = -1

/** 单条终端日志（msg 为转义 + IP 高亮后的 HTML 片段） */
interface LogLine {
  seq: number
  ts: string
  fail: boolean
  /** 徽标配色类名（lv-critical 等）与词条 key 同源，语言切换后文案在模板里现查 */
  sevCls: string
  sevKey: 'critical' | 'high' | 'medium' | 'low'
  sevNum: number
  html: string
}
const logs = ref<LogLine[]>([])
const termBody = ref<HTMLElement | null>(null)

/**
 * a-textarea 换回原生 textarea 后这里就是原生元素类型：
 * 插入变量需要读写光标位置（selectionStart/End/setSelectionRange），
 * antd 组件实例没有直接暴露这些，原生元素最直接。
 */
const tplArea = ref<HTMLTextAreaElement | null>(null)

const progressPct = computed(() =>
  total.value ? Math.min(((sent.value + failed.value) / total.value) * 100, 100) : 0,
)

/** 进度条渐变跟随基座下发的主题快照（未收到数据前用品牌紫兜底） */
const gradColors = computed(() => ({
  from: lastThemeSnapshot.value?.gradFrom ?? '#7c3aed',
  to: lastThemeSnapshot.value?.gradTo ?? '#c026d3',
}))

/* ---------- 渲染逻辑 ---------- */
/** 随机生成源 IP：三成概率外网，贴近真实攻击来源分布 */
function randomIp(): { ip: string; ext: boolean } {
  // 三成概率外网源，贴近真实攻击来源分布
  const ext = Math.random() < 0.3
  const base = ext ? pick(IP_EXT_POOL) : pick(IP_INT_POOL)
  return { ip: base + randomInt(2, 254), ext }
}

/**
 * severity(0-10) → 语义等级。
 * 只返回配色类名与词条 key，中/英等级名由语言包提供（模板里现查），
 * 切语言时历史日志行的徽标文案也能跟着变。
 */
function sevLevel(s: number): { cls: string; key: LogLine['sevKey'] } {
  if (s >= 9) return { cls: 'lv-critical', key: 'critical' }
  if (s >= 7) return { cls: 'lv-high', key: 'high' }
  if (s >= 4) return { cls: 'lv-medium', key: 'medium' }
  return { cls: 'lv-low', key: 'low' }
}

interface RenderResult {
  text: string
  evt: (typeof EVENT_POOL)[number]
  src: { ip: string; ext: boolean }
  user: string
}

/** 渲染模板：把 ${var} 占位符替换为样本值；随机化关闭时用固定样本 */
function renderTemplate(tpl: string, seq: number): RenderResult {
  const evt = randomize.value ? pick(EVENT_POOL) : EVENT_POOL[0]
  const src = randomize.value ? randomIp() : { ip: '10.12.33.45', ext: false }
  const user = randomize.value ? pick(USER_POOL) : 'admin'
  const d = new Date()
  const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${nowTime()}+08:00`
  const text = tpl
    .replace(/\$\{timestamp\}/g, ts)
    .replace(/\$\{seq\}/g, String(seq))
    .replace(/\$\{random_ip\}/g, src.ip)
    .replace(/\$\{user\}/g, user)
    .replace(/\$\{event_id\}/g, evt.id)
    .replace(/\$\{event_name\}/g, evt.name)
    .replace(/\$\{severity\}/g, String(evt.sev))
  return { text, evt, src, user }
}

/** 渲染预览：变量值高亮（紫 = 普通变量，橙 = IP）。依赖 tplText 变化时重算一次 */
const previewHtml = computed(() => {
  const r = renderTemplate(tplText.value, 1)
  const html = escapeHtml(r.text)
    .replace(r.src.ip, `<span class="hl-ip">${r.src.ip}</span>`)
    .replace(r.evt.name, `<span class="hl">${r.evt.name}</span>`)
    .replace(r.user, `<span class="hl">${r.user}</span>`)
  return `<span class="pv-label">${t('syslog.previewLabel')}</span><br>${html}`
})

/** 切换预设模板：把选中模板的原始文本灌进编辑框（用户可再改） */
function onTplChange(key: string | number): void {
  currentTpl.value = String(key)
  tplText.value = TEMPLATES[currentTpl.value] ?? tplText.value
}

/** 点击变量 chip 插入到模板光标处 */
function insertVar(v: string): void {
  const area = tplArea.value
  if (!area) return
  const pos = area.selectionStart ?? area.value.length
  area.value = area.value.slice(0, pos) + v + area.value.slice(area.selectionEnd ?? pos)
  tplText.value = area.value
  area.focus()
  area.setSelectionRange(pos + v.length, pos + v.length)
  toast(t('syslog.insertedVar', { var: v }), 'info')
}

/* ---------- 发送模拟 ---------- */
/** 把一次发送结果追加进终端：转义 + IP 高亮 + 行数上限 + 自动滚动 */
function appendLine(r: RenderResult, seq: number, isFail: boolean): void {
  const lv = sevLevel(r.evt.sev)
  const html = escapeHtml(r.text).replace(
    r.src.ip,
    `<span class="ip-${r.src.ext ? 'ext' : 'int'}">${r.src.ip}</span>`,
  )
  logs.value.push({
    seq,
    ts: nowTime(),
    fail: isFail,
    sevCls: lv.cls,
    sevKey: lv.key,
    sevNum: r.evt.sev,
    html,
  })
  // 行数上限 600：长任务防内存膨胀（真实实现同理）
  if (logs.value.length > 600) logs.value.splice(0, logs.value.length - 600)
  if (autoScroll.value) {
    nextTick(() => {
      if (termBody.value) termBody.value.scrollTop = termBody.value.scrollHeight
    })
  }
}

/** 重算耗时与速率：节拍内即时更新 + 300ms 定时器兜底（发送结束后速率定格） */
function updateStats(): void {
  elapsed.value = (Date.now() - startTime.value) / 1000
  rate.value = elapsed.value > 0 ? sent.value / elapsed.value : 0
}

/** 停止发送：清两个定时器并复位状态；finished=true 表示发完自动停 */
function stopSend(finished: boolean): void {
  if (sendTimer) clearInterval(sendTimer)
  if (statsTimer) clearInterval(statsTimer)
  sendTimer = null
  statsTimer = null
  sending.value = false
  if (finished) {
    toast(
      t('syslog.doneToast', {
        total: sent.value + failed.value,
        failed: failed.value,
        rate: rate.value.toFixed(1),
      }),
    )
  }
}

/** 发送节拍：每 interval 发一条，发满 total 后自动停 */
function tick(): void {
  if (sent.value + failed.value >= total.value) {
    stopSend(true)
    return
  }
  const seq = sent.value + failed.value + 1
  const isFail = seq === failAt
  const r = renderTemplate(tplText.value, seq)
  if (isFail) failed.value++
  else sent.value++
  appendLine(r, seq, isFail)
  updateStats()
}

/** 启停发送的总入口：停止 / 白名单拦截 / 组装参数并启动节拍定时器 */
function toggleSend(): void {
  if (sending.value) {
    stopSend(false)
    toast(t('syslog.stopped'), 'info')
    return
  }
  if (!whitelistOk.value) {
    toast(t('syslog.wlBlocked'), 'bad')
    return
  }
  total.value = Math.max(1, Math.floor(sendCount.value) || 50)
  const interval = Math.max(50, Math.floor(sendInterval.value) || 200)
  sent.value = 0
  failed.value = 0
  startTime.value = Date.now()
  // 数量 ≥ 20 时随机失败一条，让失败统计与红色行真实可见
  failAt = total.value >= 20 ? randomInt(5, total.value - 1) : -1
  sending.value = true
  updateStats()
  sendTimer = setInterval(tick, interval)
  statsTimer = setInterval(updateStats, 300)
}

/** 清空终端日志（不影响统计数字） */
function clearLogs(): void {
  logs.value = []
}

// 组件卸载必须清定时器：微前端下子应用会被频繁销毁重建
onUnmounted(() => {
  if (sendTimer) clearInterval(sendTimer)
  if (statsTimer) clearInterval(statsTimer)
})

function saveTask(): void {
  toast(t('syslog.savedTask'))
}
function showHistory(): void {
  toast(t('syslog.historyToast'), 'info')
}
</script>

<template>
  <div class="page">
    <!-- 页头 -->
    <div class="page-header">
      <div>
        <h1>
          {{ t('syslog.title') }}
          <span class="pbadge pbadge--ok"><span class="dot" />{{ t('syslog.mvpBadge') }}</span>
        </h1>
        <p class="desc">{{ t('syslog.desc') }}</p>
        <div class="page-badges">
          <span class="pbadge pbadge--ok"><span class="dot" />{{ t('syslog.wlBadge') }}</span>
          <span class="pbadge">{{ t('syslog.auditBadge') }}</span>
        </div>
      </div>
      <div class="page-header-actions">
        <a-button @click="saveTask">
          <template #icon><AppIcon name="save" :size="13" /></template>
          {{ t('syslog.saveTask') }}
        </a-button>
        <a-button @click="showHistory">
          <template #icon><AppIcon name="clock" :size="13" /></template>
          {{ t('syslog.history') }}
        </a-button>
      </div>
    </div>

    <div class="content-grid">
      <!-- ===== 发送配置 ===== -->
      <section class="panel panel--config">
        <div class="panel-head">
          <AppIcon name="sliders" :size="15" />
          <h2>{{ t('syslog.configTitle') }}</h2>
          <span class="sub">{{ t('syslog.configSub') }}</span>
        </div>
        <div class="panel-body">
          <div class="field">
            <label>{{ t('syslog.targetLabel') }}</label>
            <div class="ip-row">
              <a-input v-model:value="targetIp" class="ip-row__ip" spellcheck="false" />
              <a-input-number
                v-model:value="targetPort"
                class="ip-row__port"
                :min="1"
                :max="65535"
                :controls="false"
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

          <div class="field">
            <label>{{ t('syslog.protocolLabel') }}</label>
            <a-segmented :value="'UDP'" :options="PROTOCOL_OPTIONS" />
            <p class="field-hint">{{ t('syslog.protocolHint') }}</p>
          </div>

          <div class="field">
            <label>{{ t('syslog.countLabel') }}</label>
            <div class="ip-row">
              <a-input-number v-model:value="sendCount" class="ip-row__num" :min="1" :max="10000" />
              <a-input-number
                v-model:value="sendInterval"
                class="ip-row__num"
                :min="50"
                :step="50"
                addon-after="ms"
              />
            </div>
            <p class="field-hint">{{ t('syslog.countHint') }}</p>
          </div>

          <div class="switch-row">
            <div class="info">
              <b>{{ t('syslog.loopbackTitle') }}</b>
              <span>{{ t('syslog.loopbackHint') }}</span>
            </div>
            <a-switch v-model:checked="loopback" size="small" />
          </div>
          <div class="switch-row">
            <div class="info">
              <b>{{ t('syslog.randomizeTitle') }}</b>
              <span>{{ t('syslog.randomizeHint') }}</span>
            </div>
            <a-switch v-model:checked="randomize" size="small" />
          </div>

          <div class="send-area">
            <a-button
              block
              :type="sending ? 'default' : 'primary'"
              :danger="sending"
              @click="toggleSend"
            >
              <template #icon><AppIcon name="send" :size="14" /></template>
              {{ sending ? t('syslog.stop') : t('syslog.start') }}
            </a-button>
            <a-progress
              class="send-progress"
              :percent="progressPct"
              :show-info="false"
              :stroke-color="gradColors"
              size="small"
            />
          </div>
        </div>
      </section>

      <!-- ===== 消息模板 ===== -->
      <section class="panel panel--template">
        <div class="panel-head">
          <AppIcon name="terminal" :size="15" />
          <h2>{{ t('syslog.tplTitle') }}</h2>
          <span class="sub">{{ t('syslog.tplSub') }}</span>
          <div class="right">
            <a-button size="small" @click="toast(t('syslog.aiToast'), 'info')">
              <template #icon><AppIcon name="sparkles" :size="12" /></template>
              {{ t('syslog.aiGen') }}
            </a-button>
          </div>
        </div>
        <div class="panel-body">
          <div class="field">
            <a-segmented v-model:value="currentTpl" :options="TPL_OPTIONS" @change="onTplChange" />
          </div>

          <!--
            模板编辑用原生 textarea 而非 a-textarea：
            等宽字体 / 行高 / 焦点环是强定制需求，antd 的 CSS-in-JS 样式在运行时
            注入头部、优先级高于打包样式，覆盖要处处提权，不如原生元素干净。
            光标插入逻辑也直接依赖原生 selectionStart/End。
          -->
          <textarea ref="tplArea" v-model="tplText" class="code-area" spellcheck="false" />

          <div class="var-section">
            <p class="var-title">{{ t('syslog.varHint') }}</p>
            <div class="var-chips">
              <button v-for="v in VAR_CHIPS" :key="v" class="var-chip" @click="insertVar(v)">{{ v }}</button>
            </div>
          </div>

          <div class="render-preview" v-html="previewHtml" />
        </div>
      </section>

      <!-- ===== 实时日志终端（恒定深色，不随主题切换） ===== -->
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
            <a-button size="small" @click="autoScroll = !autoScroll">
              {{ t('syslog.autoScroll') }}：{{ autoScroll ? t('syslog.on') : t('syslog.off') }}
            </a-button>
            <a-button size="small" :disabled="logs.length === 0" @click="clearLogs">
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
            <!-- msg 为组件内构建的 HTML（已 escapeHtml 转义后拼接高亮 span） -->
            <span class="msg" v-html="line.html" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 18px 20px 28px;
  min-height: 100vh;
}

/* ---------- 页头 ---------- */
.page-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px; }
.page-header h1 {
  font-size: 17px; font-weight: 700;
  display: flex; align-items: center; gap: 10px;
}
.page-header .desc { color: var(--fg-muted); font-size: 12.5px; margin-top: 5px; line-height: 1.6; }
.page-badges { display: flex; gap: 8px; margin-top: 9px; }
.pbadge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 10px; border-radius: 10px; font-size: 11.5px;
  border: 1px solid var(--border); color: var(--fg-sub);
  background: var(--bg-card);
}
.pbadge .dot { width: 6px; height: 6px; border-radius: 50%; }
.pbadge--ok { color: var(--sev-low); border-color: color-mix(in srgb, var(--sev-low) 30%, transparent); background: color-mix(in srgb, var(--sev-low) 6%, transparent); }
.pbadge--ok .dot { background: var(--sev-low); box-shadow: 0 0 6px color-mix(in srgb, var(--sev-low) 60%, transparent); }
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
.ip-row { display: flex; gap: 8px; }
.ip-row__port { width: 88px; flex: none; }
.ip-row__num { flex: 1; min-width: 0; }
/* IP 与端口是技术值，统一等宽字体 */
.ip-row :deep(input) { font-family: var(--font-mono); }

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
}
.code-area:focus {
  outline: none; background: var(--input-focus-bg);
  border-color: color-mix(in srgb, var(--primary) 50%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent);
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
}
.var-chip:hover { background: color-mix(in srgb, var(--primary) 14%, transparent); transform: translateY(-1px); }

.render-preview {
  margin-top: 13px; padding: 11px 13px;
  background: var(--bg-input);
  border: 1px dashed color-mix(in srgb, var(--primary) 30%, transparent);
  border-radius: var(--radius-ctl);
  font-family: var(--font-mono); font-size: 11.5px; line-height: 1.7;
  color: var(--fg-sub); word-break: break-all;
}
/* v-html 内部节点不吃 scoped，需要 :deep 穿透 */
.render-preview :deep(.pv-label) { color: var(--fg-muted); }
.render-preview :deep(.hl) { color: var(--primary); font-weight: 600; }
.render-preview :deep(.hl-ip) { color: var(--sev-high); font-weight: 600; }

/* ---------- 终端 ---------- */
.term-stats { display: flex; gap: 16px; align-items: center; font-size: 12px; color: var(--fg-muted); }
.stat b { color: var(--fg); font-family: var(--font-mono); font-weight: 600; }
.stat--err b { color: var(--sev-critical); }
.term-status {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 10px; border-radius: 10px; font-size: 11.5px;
  color: var(--fg-muted);
}
.term-status .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--fg-muted); }
.term-status.running {
  color: var(--sev-low);
  background: color-mix(in srgb, var(--sev-low) 7%, transparent);
  border: 1px solid color-mix(in srgb, var(--sev-low) 30%, transparent);
}
.term-status.running .dot {
  background: var(--sev-low);
  box-shadow: 0 0 8px color-mix(in srgb, var(--sev-low) 70%, transparent);
  animation: blink 1.2s ease-in-out infinite;
}
@keyframes blink { 50% { opacity: 0.35; } }

.term-body {
  flex: 1; height: 320px; overflow-y: auto;
  padding: 12px 14px;
  background: var(--bg-terminal);
  border-radius: 0 0 var(--radius) var(--radius);
  font-family: var(--font-mono); font-size: 12px; line-height: 1.85;
}
.term-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); }
.term-line { display: flex; gap: 10px; align-items: baseline; padding: 1px 0; animation: line-in 0.25s ease-out; }
@keyframes line-in { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
.term-line .ts { color: #6b7688; flex: none; }
.term-line .no { color: #6b7688; flex: none; min-width: 38px; text-align: right; }
.term-line .res { flex: none; width: 14px; text-align: center; color: var(--sev-low-v); }
.term-line .res.fail { color: var(--sev-critical-v); font-weight: 700; }
.term-line .msg { word-break: break-all; color: #aeb9cc; min-width: 0; }
/* 内外网 IP 视觉区分（终端内亮色档） */
.term-line :deep(.ip-int) { color: #22d3ee; }
.term-line :deep(.ip-ext) { color: var(--sev-high-v); }

/* 语义等级徽标：色 + 文字缺一不可，终端内用 vivid 档 */
.sev-badge {
  flex: none; display: inline-block;
  padding: 0 7px; margin-right: 6px; border-radius: 4px;
  font-size: 10.5px; line-height: 17px; font-weight: 700;
}
.sev-badge.lv-critical { color: var(--sev-critical-v); background: rgba(248, 113, 113, 0.12); box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.4); }
.sev-badge.lv-high { color: var(--sev-high-v); background: rgba(251, 146, 60, 0.12); box-shadow: inset 0 0 0 1px rgba(251, 146, 60, 0.4); }
.sev-badge.lv-medium { color: var(--sev-medium-v); background: rgba(250, 204, 21, 0.1); box-shadow: inset 0 0 0 1px rgba(250, 204, 21, 0.4); }
.sev-badge.lv-low { color: var(--sev-low-v); background: rgba(74, 222, 128, 0.1); box-shadow: inset 0 0 0 1px rgba(74, 222, 128, 0.4); }

.term-empty {
  height: 100%; display: grid; place-items: center;
  color: #6b7688; font-size: 12px; text-align: center; line-height: 2;
}
.term-empty :deep(svg) { opacity: 0.4; }

/* ---------- 响应式 ---------- */
@media (max-width: 1200px) {
  .content-grid {
    grid-template-columns: 1fr;
    grid-template-areas: 'config' 'template' 'terminal';
  }
}
</style>
