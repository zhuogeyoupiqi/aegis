/**
 * 资产条目的读写层（api 层唯一出口，视图只 import 这一个模块）。
 * 与发包器的 history.ts 同构：mock 走 localStorage、real 走后端接口，
 * 模式分发在函数内部完成，视图不感知差异。
 *
 * V2 结构化形状：content 字段拆成 files/entry/deps/url（link 存 URL）。
 * 种子数据从 seeds.json 载入——同一份 JSON 也是后端 data.sql 的生成源，
 * 两端种子一比一同构（生成脚本见会话记录，改动种子请改 JSON 后两端重新生成）。
 */
import { getApiMode } from './mode'
import { request } from './http'
import seedsJson from './seeds.json'
import type { AssetDep, AssetFile, AssetItem, AssetType, ItemQuery, ItemSavePayload } from './types'

/* ---------- 后端返回形状（Result 解包后的 data） ---------- */

interface ItemVO {
  id: string
  name: string
  type: AssetType
  lang: string | null
  description: string | null
  files: { path: string; lang: string | null; code: string }[]
  entry: string | null
  deps: AssetDep[]
  url: string | null
  /** 后端 tags 是逗号串（与存储同构），这里拆成数组 */
  tags: string
  copyCount: number
  updateTime: string
}

interface ItemPageVO {
  total: number
  items: ItemVO[]
}

/* ---------- mock 实现：localStorage 一张"表" ---------- */

// V2 升 key：旧 key 存的是单文件 content 形状，直接读会缺 files/deps 字段；
// 隔离开让旧数据自然废弃（清浏览器存储即消失），不做无谓的迁移代码
const LS_ITEMS = 'aegis:asset-items:v2'
/** 种子指纹的存档键：与 LS_ITEMS 分开存，读时对比判断种子是否需要重灌 */
const LS_SEED_FP = 'aegis:asset-items:seed-fp'

/**
 * mock 种子：由原型 ITEMS 导出的 JSON（后端 data.sql 同源生成）。
 * 固定 ID 101-106 与后端种子一致——切 real 模式时同名同 ID，
 * 用户对"哪条是内置示范"的心智不随模式漂移。
 */
const SEEDS: AssetItem[] = (seedsJson as RawSeed[]).map((s, i) => ({
  id: String(101 + i),
  name: s.name,
  type: s.type as AssetType,
  lang: s.lang ?? null,
  description: s.description ?? null,
  files: (s.files ?? []).map((f) => ({ path: f.path, lang: f.lang ?? null, code: f.code })),
  entry: s.entry ?? null,
  deps: (s.deps ?? []).map((d) => ({ name: d.name, version: d.version, source: d.source })),
  url: s.url ?? null,
  tags: s.tags ?? [],
  copyCount: s.copyCount ?? 0,
  updateTime: s.updateTime ?? '2026-09-01 12:00',
}))

/** seeds.json 的原始形状（生成端字段全可缺省，载入时统一补默认值） */
interface RawSeed {
  name: string
  type: AssetType
  lang?: string
  description?: string
  files?: { path: string; lang?: string; code: string }[]
  entry?: string
  deps?: { name: string; version: string; source: 'bundled' | 'cdn' }[]
  url?: string
  tags?: string[]
  copyCount?: number
  updateTime?: string
}

/** 种子内容指纹（djb2 短哈希）：seeds.json 一变即自动失效存量里的旧种子条目 */
const SEEDS_FINGERPRINT = (() => {
  let h = 5381
  for (const ch of JSON.stringify(seedsJson)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0
  return h.toString(36)
})()

/** 生成不依赖雪花 ID 的本地主键（mock 模式不会发给后端，无精度问题） */
function localId(): string {
  return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function readAll(): AssetItem[] {
  try {
    const raw = localStorage.getItem(LS_ITEMS)
    // 首次访问写入种子；之后用户清空就是真空（空数组也是合法存量，种子不复活）
    if (raw === null) {
      localStorage.setItem(LS_SEED_FP, SEEDS_FINGERPRINT)
      localStorage.setItem(LS_ITEMS, JSON.stringify(SEEDS))
      return SEEDS.map((s) => ({ ...s }))
    }
    const stored = JSON.parse(raw) as AssetItem[]
    // 种子内容升级（如预览写法修正）：指纹不一致时只替换种子段（固定 ID 101-106），
    // 用户自建数据保留。mock 主键是 'mxxxx' 形态，Number() 为 NaN，判断必须用区间取反防止误删
    if (localStorage.getItem(LS_SEED_FP) !== SEEDS_FINGERPRINT) {
      const merged = [...stored.filter((i) => !(Number(i.id) >= 101 && Number(i.id) <= 106)), ...SEEDS.map((s) => ({ ...s }))]
      localStorage.setItem(LS_SEED_FP, SEEDS_FINGERPRINT)
      writeAll(merged)
      return merged.map((i) => ({ ...i }))
    }
    return stored
  } catch {
    return []
  }
}

function writeAll(list: AssetItem[]): void {
  localStorage.setItem(LS_ITEMS, JSON.stringify(list))
}

/** 统一排序：复制次数（使用频率）降序，同频按更新时间降序——与后端一致 */
function sortItems(list: AssetItem[]): AssetItem[] {
  return [...list].sort((a, b) => b.copyCount - a.copyCount || b.updateTime.localeCompare(a.updateTime))
}

/** mock 检索：类型/标签精确、关键字扫名称/说明/文件内容/URL（语义对齐后端 LIKE + FIND_IN_SET） */
function mockList(query: ItemQuery): AssetItem[] {
  const kw = query.kw?.trim().toLowerCase() ?? ''
  const tag = query.tag?.toLowerCase() ?? ''
  return sortItems(
    readAll().filter(
      (i) =>
        (!query.type || i.type === query.type) &&
        (!tag || i.tags.includes(tag)) &&
        (!kw ||
          i.name.toLowerCase().includes(kw) ||
          (i.description ?? '').toLowerCase().includes(kw) ||
          (i.url ?? '').toLowerCase().includes(kw) ||
          i.files.some((f) => f.code.toLowerCase().includes(kw))),
    ),
  )
}

/** 标签规范化（对齐后端 normalizeTags）：小写 + 去重，mock 数据不至于长出变体 */
function normalizeTags(tags: string[]): string[] {
  const seen: string[] = []
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase()
    if (tag && !seen.includes(tag)) seen.push(tag)
  }
  return seen
}

/** 提交载荷 → 后端请求体（tags 拼逗号串；空值字段不发送，后端 jakarta 校验按 null 走） */
function toBody(payload: ItemSavePayload) {
  return {
    name: payload.name,
    type: payload.type,
    lang: payload.lang || undefined,
    description: payload.description || undefined,
    url: payload.url || undefined,
    entry: payload.entry || undefined,
    files: payload.files.map((f) => ({ path: f.path, lang: f.lang || undefined, code: f.code })),
    deps: payload.deps.map((d) => ({ name: d.name, version: d.version, source: d.source })),
    tags: normalizeTags(payload.tags).join(','),
  }
}

/** 提交载荷 → mock 记录（real 走 toBody，mock 直接存结构化形状） */
function toRecord(id: string, payload: ItemSavePayload, base?: AssetItem): AssetItem {
  return {
    id,
    name: payload.name,
    type: payload.type,
    lang: payload.lang || null,
    description: payload.description || null,
    files: payload.files,
    entry: payload.entry || null,
    deps: payload.deps,
    url: payload.url || null,
    tags: normalizeTags(payload.tags),
    copyCount: base?.copyCount ?? 0,
    updateTime: new Date().toISOString(),
  }
}

/* ---------- 对外 API（按当前模式分发） ---------- */

/** 检索资产列表（real 一页取 100：个人库量级一页装下，翻页交互后续再上） */
export async function listItems(query: ItemQuery = {}): Promise<AssetItem[]> {
  if (getApiMode() === 'real') {
    const qs = new URLSearchParams({ current: '1', size: '100' })
    if (query.kw) qs.set('kw', query.kw)
    if (query.type) qs.set('type', query.type)
    if (query.tag) qs.set('tag', query.tag)
    const page = await request<ItemPageVO>('/asset/items?' + qs.toString())
    return page.items.map((v) => ({
      ...v,
      files: v.files ?? [],
      deps: v.deps ?? [],
      tags: v.tags ? v.tags.split(',').filter(Boolean) : [],
    }))
  }
  return mockList(query)
}

/** 新建资产 */
export async function saveItem(payload: ItemSavePayload): Promise<void> {
  if (getApiMode() === 'real') {
    await request<void>('/asset/items', { method: 'POST', body: JSON.stringify(toBody(payload)) })
    return
  }
  const list = readAll()
  list.unshift(toRecord(localId(), payload))
  writeAll(list)
}

/** 更新资产 */
export async function updateItem(id: string, payload: ItemSavePayload): Promise<void> {
  if (getApiMode() === 'real') {
    await request<void>('/asset/items/' + id, { method: 'PUT', body: JSON.stringify(toBody(payload)) })
    return
  }
  const list = readAll()
  const idx = list.findIndex((i) => i.id === id)
  if (idx === -1) throw new Error('资产不存在或已删除')
  list[idx] = toRecord(id, payload, list[idx])
  writeAll(list)
}

/** 删除资产 */
export async function deleteItem(id: string): Promise<void> {
  if (getApiMode() === 'real') {
    await request<void>('/asset/items/' + id, { method: 'DELETE' })
    return
  }
  writeAll(readAll().filter((i) => i.id !== id))
}

/** 复制计数 +1（real 走专用端点原子自增；后端刻意不打审计，前端无需关心） */
export async function incrementCopy(id: string): Promise<void> {
  if (getApiMode() === 'real') {
    await request<void>(`/asset/items/${id}/copy`, { method: 'POST' })
    return
  }
  const list = readAll()
  const idx = list.findIndex((i) => i.id === id)
  if (idx === -1) return
  // 对齐后端行为：MySQL 的 ON UPDATE CURRENT_TIMESTAMP 会顺带刷新 update_time
  list[idx] = { ...list[idx], copyCount: list[idx].copyCount + 1, updateTime: new Date().toISOString() }
  writeAll(list)
}
