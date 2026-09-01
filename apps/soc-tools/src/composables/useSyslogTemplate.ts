/**
 * Syslog 模板渲染逻辑。
 *
 * 职责：管理模板骨架、变量 chip、样本池，以及把模板渲染成最终报文。
 * 不持有发送状态，只负责"给定模板文本和序号，生成报文字符串"。
 */

import { computed, ref } from 'vue'
import { escapeHtml, nowTime, pad, pick, randomInt } from '@aegis/shared'
import type { RenderedMessage } from '@/api/types'

/** 内置模板骨架（用户可在编辑框内二次修改） */
export const TEMPLATES: Record<string, string> = {
  CEF: 'CEF:0|Security|Aegis-Test|1.0|${event_id}|${event_name}|${severity}|src=${random_ip} dst=192.168.1.20 suser=${user} dhost=WEB-01 msg=Triggered by Aegis sender seq=${seq}',
  LEEF: 'LEEF:1.0|Aegis|ThreatSensor|2.1|${event_id}|src=${random_ip} dst=192.168.1.20 sev=${severity} usrName=${user} msg=${event_name}',
  JSON: '{"facility":"auth","severity":${severity},"event_id":"${event_id}","name":"${event_name}","src":"${random_ip}","dst":"192.168.1.20","user":"${user}","ts":"${timestamp}"}',
  KV: 'time=${timestamp} event_id=${event_id} name=${event_name} sev=${severity} src=${random_ip} dst=192.168.1.20 user=${user} action=deny',
}

/** 模板选择器选项（KV 对外展示为 Key-Value） */
export const TPL_OPTIONS = [
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

export const VAR_CHIPS = ['${timestamp}', '${seq}', '${random_ip}', '${user}', '${event_id}', '${event_name}', '${severity}']

export type SevKey = 'critical' | 'high' | 'medium' | 'low'

/** severity(0-10) → 语义等级（配色类名 + 词条 key） */
export function sevLevel(s: number): { cls: string; key: SevKey } {
  if (s >= 9) return { cls: 'lv-critical', key: 'critical' }
  if (s >= 7) return { cls: 'lv-high', key: 'high' }
  if (s >= 4) return { cls: 'lv-medium', key: 'medium' }
  return { cls: 'lv-low', key: 'low' }
}

/** 随机生成源 IP：三成概率外网，贴近真实攻击来源分布 */
export function randomIp(): { ip: string; ext: boolean } {
  const ext = Math.random() < 0.3
  const base = ext ? pick(IP_EXT_POOL) : pick(IP_INT_POOL)
  return { ip: base + randomInt(2, 254), ext }
}

/** 单条渲染结果（含报文文本与展示用元数据） */
export interface RenderResult {
  text: string
  evt: (typeof EVENT_POOL)[number]
  src: { ip: string; ext: boolean }
  user: string
}

/**
 * @param randomize 是否使用随机样本；关闭后用固定样本，便于复现问题
 */
export function useSyslogTemplate(randomize: { value: boolean }) {
  const currentTpl = ref('CEF')
  const tplText = ref(TEMPLATES.CEF)

  /** 切换预设模板：把选中模板的原始文本灌进编辑框（用户可再改） */
  function onTplChange(key: string | number): void {
    currentTpl.value = String(key)
    tplText.value = TEMPLATES[currentTpl.value] ?? tplText.value
  }

  /** 渲染模板：把 ${var} 占位符替换为样本值 */
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

  /** 驱动层需要的渲染回调：模板渲染在前端，映射成驱动约定的形状 */
  function renderForDriver(seq: number): RenderedMessage {
    const r = renderTemplate(tplText.value, seq)
    return { text: r.text, severity: r.evt.sev, srcIp: r.src.ip, srcExt: r.src.ext }
  }

  /** 渲染预览：变量值高亮（紫 = 普通变量，橙 = IP） */
  const previewHtml = computed(() => {
    const r = renderTemplate(tplText.value, 1)
    const html = escapeHtml(r.text)
      .replace(r.src.ip, `<span class="hl-ip">${r.src.ip}</span>`)
      .replace(r.evt.name, `<span class="hl">${r.evt.name}</span>`)
      .replace(r.user, `<span class="hl">${r.user}</span>`)
    return `<span class="pv-label">渲染预览</span><br>${html}`
  })

  return {
    currentTpl,
    tplText,
    previewHtml,
    onTplChange,
    renderTemplate,
    renderForDriver,
  }
}

/**
 * 在 textarea 光标处插入文本。
 * 为什么单独抽：原生 textarea 才能读写 selectionStart/End，
 * antd 的 a-textarea 实例不直接暴露这些 DOM 属性。
 */
export function insertAtCursor(area: HTMLTextAreaElement, value: string): void {
  const pos = area.selectionStart ?? area.value.length
  area.value = area.value.slice(0, pos) + value + area.value.slice(area.selectionEnd ?? pos)
  area.focus()
  area.setSelectionRange(pos + value.length, pos + value.length)
}
