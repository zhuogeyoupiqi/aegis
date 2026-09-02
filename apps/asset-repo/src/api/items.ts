/**
 * 资产条目的读写层（api 层唯一出口，视图只 import 这一个模块）。
 * 与发包器的 history.ts 同构：mock 走 localStorage、real 走后端接口，
 * 模式分发在函数内部完成，视图不感知差异。
 */
import { getApiMode } from './mode'
import { request } from './http'
import type { AssetItem, AssetType, ItemQuery, ItemSavePayload } from './types'

/* ---------- 后端返回形状（Result 解包后的 data） ---------- */

interface ItemVO {
  id: string
  name: string
  type: AssetType
  lang: string | null
  description: string | null
  content: string
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

const LS_ITEMS = 'aegis:asset-items'

/**
 * mock 种子：与 data.sql 的后端种子同构（同名同标签同复制次数），
 * 让"不启动后端也能演示"的模式下首屏同样不空库。
 * 种子代码串里统一用双引号，保持与 data.sql 一致的可读性。
 */
const SEEDS: AssetItem[] = [
  {
    id: '101',
    name: 'useDebounceFn',
    type: 'snippet',
    lang: 'ts',
    description: 'Vue3 防抖 composable：输入框搜索等高频触发的标准件',
    content: [
      'import { ref, onUnmounted } from "vue"',
      '',
      '/** 防抖执行：停顿 wait 毫秒后才真正触发 */',
      'export function useDebounceFn<F extends (...args: any[]) => void>(fn: F, wait = 300) {',
      '  const timer = ref<ReturnType<typeof setTimeout> | null>(null)',
      '',
      '  function run(...args: Parameters<F>) {',
      '    if (timer.value) clearTimeout(timer.value)',
      '    timer.value = setTimeout(() => fn(...args), wait)',
      '  }',
      '',
      '  // 组件卸载清掉挂起的定时器，避免回调打到已销毁的组件',
      '  onUnmounted(() => {',
      '    if (timer.value) clearTimeout(timer.value)',
      '  })',
      '',
      '  return { run }',
      '}',
    ].join('\n'),
    tags: ['vue', 'composable'],
    copyCount: 12,
    updateTime: '2026-09-02T10:00:00',
  },
  {
    id: '102',
    name: 'Result 统一返回包装',
    type: 'component',
    lang: 'java',
    description: 'Spring Boot 接口统一 Result<T>：code=0 成功，A/B/C 分段错误码',
    content: [
      'import java.io.Serializable;',
      '',
      '/**',
      ' * 统一接口返回包装。前后端契约：code=0 成功，非 0 分段',
      ' * （A 调用方问题 / B 业务规则 / C 服务端内部）。',
      ' */',
      'public class Result<T> implements Serializable {',
      '',
      '    private String code;',
      '    private String message;',
      '    private T data;',
      '',
      '    public static <T> Result<T> ok(T data) {',
      '        Result<T> r = new Result<>();',
      '        r.code = "0";',
      '        r.data = data;',
      '        return r;',
      '    }',
      '',
      '    public static <T> Result<T> fail(String code, String message) {',
      '        Result<T> r = new Result<>();',
      '        r.code = code;',
      '        r.message = message;',
      '        return r;',
      '    }',
      '}',
    ].join('\n'),
    tags: ['java', 'spring'],
    copyCount: 3,
    updateTime: '2026-09-01T15:30:00',
  },
  {
    id: '103',
    name: 'grep 应急速查',
    type: 'doc',
    lang: 'md',
    description: 'SOC 排查时最常用的 grep 组合，按使用频率排列',
    content: [
      '# grep 应急速查',
      '',
      '## 最常用',
      '- grep -rn "pattern" /var/log          # 递归 + 行号，排查日志第一反应',
      '- grep -i "error" app.log              # 忽略大小写',
      '- grep -c "Failed" secure.log          # 只数条数',
      '- grep -A 3 -B 1 "panic" app.log       # 命中行后 3 行前 1 行（上下文）',
      '',
      '## 进阶',
      '- grep -E "10\\.0\\.[0-9]+\\.[0-9]+" access.log      # 扩展正则提内网 IP',
      '- grep -v "health-check" access.log                  # 反选，滤掉探活噪声',
      '- zgrep "sqlmap" *.gz                                # 直接搜压缩日志',
      '- grep -o "src=[0-9.]*" alert.log | sort | uniq -c | sort -rn   # 提字段并计数',
      '',
      '## 排查思路',
      '先 -c 确认量级 → 再 -A/-B 看上下文 → 最后 -o + uniq -c 做聚合。',
    ].join('\n'),
    tags: ['bash', 'soc'],
    copyCount: 7,
    updateTime: '2026-08-30T09:12:00',
  },
  {
    id: '104',
    name: 'MITRE ATT&CK 官网',
    type: 'link',
    lang: null,
    description: '攻击技战术知识库，写报告/研判时查技战术编号的第一入口',
    content: 'https://attack.mitre.org/',
    tags: ['threatintel'],
    copyCount: 5,
    updateTime: '2026-08-28T14:00:00',
  },
]

/** 生成不依赖雪花 ID 的本地主键（mock 模式不会发给后端，无精度问题） */
function localId(): string {
  return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function readAll(): AssetItem[] {
  try {
    const raw = localStorage.getItem(LS_ITEMS)
    // 首次访问写入种子；之后用户清空就是真空（空数组也是合法存量，种子不复活）
    if (raw === null) {
      localStorage.setItem(LS_ITEMS, JSON.stringify(SEEDS))
      return SEEDS.map((s) => ({ ...s }))
    }
    return JSON.parse(raw) as AssetItem[]
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

/** mock 检索：类型/标签精确、关键字三列模糊（语义对齐后端 LIKE + FIND_IN_SET） */
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
          i.content.toLowerCase().includes(kw)),
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

/** 提交载荷 → 后端请求体（tags 拼逗号串，字段名与 ItemSaveDTO 一一对应） */
function toBody(payload: ItemSavePayload) {
  return {
    name: payload.name,
    type: payload.type,
    lang: payload.lang || undefined,
    description: payload.description || undefined,
    content: payload.content,
    tags: normalizeTags(payload.tags).join(','),
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
      tags: v.tags ? v.tags.split(',').filter(Boolean) : [],
    }))
  }
  return mockList(query)
}

/** 新建资产 */
export async function saveItem(payload: ItemSavePayload): Promise<void> {
  const tags = normalizeTags(payload.tags)
  if (getApiMode() === 'real') {
    await request<void>('/asset/items', { method: 'POST', body: JSON.stringify({ ...toBody(payload), tags: tags.join(',') }) })
    return
  }
  const list = readAll()
  list.unshift({
    id: localId(),
    name: payload.name,
    type: payload.type,
    lang: payload.lang || null,
    description: payload.description || null,
    content: payload.content,
    tags,
    copyCount: 0,
    updateTime: new Date().toISOString(),
  })
  writeAll(list)
}

/** 更新资产 */
export async function updateItem(id: string, payload: ItemSavePayload): Promise<void> {
  const tags = normalizeTags(payload.tags)
  if (getApiMode() === 'real') {
    await request<void>('/asset/items/' + id, { method: 'PUT', body: JSON.stringify({ ...toBody(payload), tags: tags.join(',') }) })
    return
  }
  const list = readAll()
  const idx = list.findIndex((i) => i.id === id)
  if (idx === -1) throw new Error('资产不存在或已删除')
  list[idx] = { ...list[idx], ...payload, lang: payload.lang || null, description: payload.description || null, tags, updateTime: new Date().toISOString() }
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
