<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref } from 'vue'
import { escapeHtml, nowTime, pad, pick, randomInt } from '@aegis/shared'
import AppIcon from '@/components/AppIcon.vue'

/* ============================================================
   Syslog 发包器 —— SOC 工具集第 1 个真实工具
   当前为纯前端 mock：发送动作用 setInterval 模拟。
   真实实现（第 2 周后端就绪）：后端 DatagramSocket 直发 + SSE 回传，
   本页只需把「模拟循环」换成 SSE 事件监听，交互与样式不动。
   ============================================================ */

/* ---------- 模板与样本数据（贴近真实 SOC 场景） ---------- */
const TEMPLATES: Record<string, string> = {
  CEF: 'CEF:0|Security|Aegis-Test|1.0|${event_id}|${event_name}|${severity}|src=${random_ip} dst=192.168.1.20 suser=${user} dhost=WEB-01 msg=Triggered by Aegis sender seq=${seq}',
  LEEF: 'LEEF:1.0|Aegis|ThreatSensor|2.1|${event_id}|src=${random_ip} dst=192.168.1.20 sev=${severity} usrName=${user} msg=${event_name}',
  JSON: '{"facility":"auth","severity":${severity},"event_id":"${event_id}","name":"${event_name}","src":"${random_ip}","dst":"192.168.1.20","user":"${user}","ts":"${timestamp}"}',
  KV: 'time=${timestamp} event_id=${event_id} name=${event_name} sev=${severity} src=${random_ip} dst=192.168.1.20 user=${user} action=deny',
}
const TPL_KEYS = Object.keys(TEMPLATES)

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
const targetPort = ref('514') // 协议固定 UDP（TCP/TLS 二期支持）
const sendCount = ref(50)
const sendInterval = ref(200)
const loopback = ref(true) // 预留后端参数：本地 5140 收自己发的包自证格式
const randomize = ref(true) // 关闭后使用固定样本，便于复现问题
const currentTpl = ref('CEF')
const tplText = ref(TEMPLATES.CEF)

/** 白名单：真实后端会硬拦 10.0.0.0/8 之外的目标，mock 在前端先拦一道 */
const whitelistOk = computed(() => /^10\./.test(targetIp.value.trim()))

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
  sevCls: string
  sevLabel: string
  sevNum: number
  html: string
}
const logs = ref<LogLine[]>([])
const termBody = ref<HTMLElement | null>(null)
const tplArea = ref<HTMLTextAreaElement | null>(null)

const progressPct = computed(() =>
  total.value ? Math.min(((sent.value + failed.value) / total.value) * 100, 100) : 0,
)

/* ---------- 渲染逻辑 ---------- */
function randomIp(): { ip: string; ext: boolean } {
  // 三成概率外网源，贴近真实攻击来源分布
  const ext = Math.random() < 0.3
  const base = ext ? pick(IP_EXT_POOL) : pick(IP_INT_POOL)
  return { ip: base + randomInt(2, 254), ext }
}

/** severity(0-10) → 语义等级（色 + 文字，缺一不可） */
function sevLevel(s: number): { cls: string; label: string } {
  if (s >= 9) return { cls: 'lv-critical', label: '危急' }
  if (s >= 7) return { cls: 'lv-high', label: '高危' }
  if (s >= 4) return { cls: 'lv-medium', label: '中危' }
  return { cls: 'lv-low', label: '低危' }
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
  return `<span class="pv-label">▍渲染预览</span><br>${html}`
})

function switchTpl(key: string): void {
  currentTpl.value = key
  tplText.value = TEMPLATES[key]
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
  toast(`已插入变量 ${v}`, 'info')
}

/* ---------- 发送模拟 ---------- */
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
    sevLabel: lv.label,
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

function updateStats(): void {
  elapsed.value = (Date.now() - startTime.value) / 1000
  rate.value = elapsed.value > 0 ? sent.value / elapsed.value : 0
}

function stopSend(finished: boolean): void {
  if (sendTimer) clearInterval(sendTimer)
  if (statsTimer) clearInterval(statsTimer)
  sendTimer = null
  statsTimer = null
  sending.value = false
  if (finished) {
    toast(
      `发送完成：${sent.value + failed.value} 条 · 失败 ${failed.value} · 平均 ${rate.value.toFixed(1)} 条/秒`,
    )
  }
}

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

function toggleSend(): void {
  if (sending.value) {
    stopSend(false)
    toast('已手动停止发送', 'info')
    return
  }
  if (!whitelistOk.value) {
    toast('目标不在白名单（10.0.0.0/8）内，发送被拦截', 'bad')
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

function clearLogs(): void {
  logs.value = []
}

// 组件卸载必须清定时器：微前端下子应用会被频繁销毁重建
onUnmounted(() => {
  if (sendTimer) clearInterval(sendTimer)
  if (statsTimer) clearInterval(statsTimer)
})

/* ---------- 轻提示（子应用独立于基座的 toast） ---------- */
interface LocalToast {
  id: number
  type: 'ok' | 'bad' | 'info'
  text: string
}
let toastSeq = 0
const toasts = ref<LocalToast[]>([])
function toast(text: string, type: LocalToast['type'] = 'ok'): void {
  const id = ++toastSeq
  toasts.value.push({ id, type, text })
  setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id) }, 2800)
}

function saveTask(): void {
  toast('发送任务已保存，可在「发送历史」中一键复现（mock）')
}
function showHistory(): void {
  toast('发送历史（mock）：今日 14 次任务 · 累计 3,208 条', 'info')
}
</script>

<template>
  <div class="page">
    <!-- 页头 -->
    <div class="page-header">
      <div>
        <h1>
          Syslog 发包器
          <span class="pbadge pbadge--ok"><span class="dot" />MVP 核心功能</span>
        </h1>
        <p class="desc">
          向 SIEM / 日志采集器发送模拟 syslog 报文，验证解析规则与告警策略。
          当前端到端为 mock；后端就绪后由 DatagramSocket 直发、SSE 实时回传。
        </p>
        <div class="page-badges">
          <span class="pbadge pbadge--ok"><span class="dot" />白名单模式已开启 10.0.0.0/8</span>
          <span class="pbadge">发送留痕已启用</span>
        </div>
      </div>
      <div class="page-header-actions">
        <button class="btn" @click="saveTask"><AppIcon name="save" :size="13" /> 保存任务</button>
        <button class="btn" @click="showHistory"><AppIcon name="clock" :size="13" /> 发送历史</button>
      </div>
    </div>

    <div class="content-grid">
      <!-- ===== 发送配置 ===== -->
      <section class="panel panel--config">
        <div class="panel-head">
          <AppIcon name="sliders" :size="15" />
          <h2>发送配置</h2>
          <span class="sub">UDP 直发 · 白名单管控</span>
        </div>
        <div class="panel-body">
          <div class="field">
            <label>目标地址（IP : 端口）</label>
            <div class="input-group">
              <input v-model="targetIp" class="input input-mono" spellcheck="false" />
              <input v-model="targetPort" class="input input--short input-mono" spellcheck="false" />
            </div>
            <p class="field-hint" :class="whitelistOk ? 'ok' : 'bad'">
              <template v-if="whitelistOk">
                <AppIcon name="check" :size="11" /> 目标在白名单网段内（10.0.0.0/8）
              </template>
              <template v-else>
                <AppIcon name="xCircle" :size="11" /> 目标不在白名单内，发送将被后端拦截
              </template>
            </p>
          </div>

          <div class="field">
            <label>传输协议</label>
            <div class="segmented">
              <button class="seg active">UDP</button>
              <button class="seg disabled" title="二期支持">TCP <span class="tag-2">二期</span></button>
              <button class="seg disabled" title="二期支持">TLS <span class="tag-2">二期</span></button>
            </div>
          </div>

          <div class="field">
            <label>发送数量 / 间隔</label>
            <div class="input-group">
              <input v-model.number="sendCount" class="input input-mono" type="number" min="1" max="10000" />
              <input v-model.number="sendInterval" class="input input--short input-mono" type="number" min="50" step="50" title="间隔（毫秒）" />
            </div>
            <p class="field-hint">间隔单位 ms，最小 50ms · 令牌桶限速将于二期接入</p>
          </div>

          <div class="switch-row">
            <div class="info">
              <b>回环监听</b>
              <span>本地 UDP 5140 收自己发的包，自证报文格式</span>
            </div>
            <label class="switch">
              <input v-model="loopback" type="checkbox" />
              <span class="track" /><span class="thumb" />
            </label>
          </div>
          <div class="switch-row">
            <div class="info">
              <b>变量随机化</b>
              <span>每次发送重新生成 IP / 用户名 / 序号</span>
            </div>
            <label class="switch">
              <input v-model="randomize" type="checkbox" />
              <span class="track" /><span class="thumb" />
            </label>
          </div>

          <div class="send-area">
            <button
              class="btn btn-block"
              :class="sending ? 'btn-danger-outline' : 'btn-primary'"
              @click="toggleSend"
            >
              <AppIcon name="send" :size="14" />
              {{ sending ? '停止发送' : '开始发送' }}
            </button>
            <div class="progress">
              <div class="bar" :style="{ width: progressPct + '%' }" />
            </div>
          </div>
        </div>
      </section>

      <!-- ===== 消息模板 ===== -->
      <section class="panel panel--template">
        <div class="panel-head">
          <AppIcon name="terminal" :size="15" />
          <h2>消息模板</h2>
          <span class="sub">变量占位符将在发送时渲染</span>
          <div class="right">
            <button class="btn" @click="toast('AI 生成模板将在 AI 子应用就绪后接入', 'info')">
              <AppIcon name="sparkles" :size="12" /> AI 生成模板
            </button>
          </div>
        </div>
        <div class="panel-body">
          <div class="field">
            <div class="tpl-chips">
              <button
                v-for="key in TPL_KEYS"
                :key="key"
                class="chip"
                :class="{ active: currentTpl === key }"
                @click="switchTpl(key)"
              >
                {{ key === 'KV' ? 'Key-Value' : key }}
              </button>
            </div>
          </div>

          <textarea ref="tplArea" v-model="tplText" class="code-area" spellcheck="false" />

          <div class="var-section">
            <p class="var-title">点击插入变量到光标处</p>
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
            <span class="dot" />{{ sending ? '发送中' : '空闲' }}
          </span>
          <h2>实时发送日志</h2>
          <div class="right">
            <div class="term-stats">
              <span class="stat">已发送 <b>{{ sent }}</b></span>
              <span class="stat stat--err">失败 <b>{{ failed }}</b></span>
              <span class="stat">速率 <b>{{ rate.toFixed(1) }}</b> 条/s</span>
              <span class="stat">耗时 <b>{{ elapsed.toFixed(1) }}</b>s</span>
            </div>
            <button class="btn" @click="autoScroll = !autoScroll">自动滚动：{{ autoScroll ? '开' : '关' }}</button>
            <button class="btn" @click="clearLogs">清空</button>
          </div>
        </div>
        <div ref="termBody" class="term-body">
          <div v-if="logs.length === 0" class="term-empty">
            <div>
              <AppIcon name="terminal" :size="30" />
              <br />暂无发送记录 · 点击「开始发送」查看实时回传
            </div>
          </div>
          <div v-for="line in logs" :key="line.seq" class="term-line">
            <span class="ts">{{ line.ts }}</span>
            <span class="no">#{{ line.seq }}</span>
            <span class="res" :class="line.fail ? 'fail' : 'ok'">{{ line.fail ? '✕' : '✓' }}</span>
            <span class="sev-badge" :class="line.sevCls">{{ line.sevLabel }} {{ line.sevNum }}</span>
            <!-- msg 为组件内构建的 HTML（已 escapeHtml 转义后拼接高亮 span） -->
            <span class="msg" v-html="line.html" />
          </div>
        </div>
      </section>
    </div>

    <!-- 轻提示 -->
    <div class="toasts">
      <transition-group name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.type}`">
          <AppIcon :name="t.type === 'ok' ? 'checkCircle' : t.type === 'bad' ? 'xCircle' : 'info'" :size="15" />
          <span>{{ t.text }}</span>
        </div>
      </transition-group>
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

.tag-2 {
  font-size: 9px; padding: 0 4px; border-radius: 3px; line-height: 13px;
  background: rgba(16, 16, 20, 0.07); color: var(--fg-muted); font-family: var(--font-ui);
}

.send-area { margin-top: 14px; }
.progress {
  height: 5px; border-radius: 3px;
  background: var(--bg-input); overflow: hidden;
  margin-top: 10px;
}
.progress .bar {
  height: 100%; width: 0%;
  background: var(--grad-btn);
  border-radius: 3px; transition: width 0.15s linear;
}

/* ---------- 模板区 ---------- */
.tpl-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.chip {
  padding: 4px 13px; border-radius: 14px;
  border: 1px solid var(--border-strong); background: transparent;
  color: var(--fg-muted); font-size: 12px; cursor: pointer;
  font-family: var(--font-mono); transition: all var(--ease);
}
.chip:hover { color: var(--fg-sub); }
.chip.active {
  color: var(--primary);
  border-color: color-mix(in srgb, var(--primary) 50%, transparent);
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  font-weight: 700;
}

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

/* ---------- 轻提示 ---------- */
.toasts {
  position: fixed; top: 14px; right: 16px; z-index: 99;
  display: flex; flex-direction: column; gap: 9px;
  pointer-events: none;
}
.toast {
  display: flex; align-items: center; gap: 9px;
  padding: 10px 15px; min-width: 220px; max-width: 360px;
  background: var(--bg-float);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-float);
  font-size: 12.5px;
}
.toast--ok { color: var(--sev-low); }
.toast--bad { color: var(--sev-critical); }
.toast--info { color: var(--primary); }
.toast span { color: var(--fg); }
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(14px); }

/* ---------- 响应式 ---------- */
@media (max-width: 1200px) {
  .content-grid {
    grid-template-columns: 1fr;
    grid-template-areas: 'config' 'template' 'terminal';
  }
}
</style>
