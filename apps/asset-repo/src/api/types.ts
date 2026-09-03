/**
 * 资产仓库的统一类型定义（V2 结构化形状）。
 * 视图只认识这里的形状，不关心背后是 localStorage 还是后端接口——
 * mock/real 两种实现跑同一套协议，页面里没有任何 if (mode) 分支。
 */

// 数据源模式统一用契约包定义（基座偏好、数据通道、子应用读取三处一个真源）
export type { ApiMode } from '@aegis/contract'

/** 资产类型：五类共用一张表，type 是判别 tag（与后端 ItemSaveDTO 的 @Pattern 白名单一致） */
export type AssetType = 'snippet' | 'component' | 'function' | 'doc' | 'link'

/**
 * 资产内单个文件（git 模型）：path 平铺完整路径可含目录（如 components/FilterBar.vue），
 * 目录只是路径前缀而非实体，文件树由前端按 / 切分还原。
 */
export interface AssetFile {
  path: string
  /** Shiki 语法名 / 预览语言标识；未知语言退化为纯文本展示 */
  lang: string | null
  code: string
}

/** 在线预览的外部依赖声明（import map 数据源；version 必须锁定，绝不 latest） */
export interface AssetDep {
  name: string
  version: string
  /** bundled=平台预打包产物（内网可用）；cdn=运行时 esm.sh 解析（需出网） */
  source: 'bundled' | 'cdn'
}

/** 一条资产（real=asset_item 行投影；mock=本地记录，字段同构） */
export interface AssetItem {
  id: string
  name: string
  type: AssetType
  /** 代码语言（Shiki 语法名；doc 固定 md；link 为 null） */
  lang: string | null
  description: string | null
  /** 文件清单（link 为空数组） */
  files: AssetFile[]
  /** 预览入口：必须命中 files 里的 path；不预览的资产为 null */
  entry: string | null
  /** 预览依赖声明（无依赖为空数组） */
  deps: AssetDep[]
  /** link 类型的目标 URL 原文；其余类型 null */
  url: string | null
  /** 标签数组（存储层是逗号串，api 层拆装，视图永远拿数组） */
  tags: string[]
  copyCount: number
  updateTime: string
}

/** 检索条件（全部可选，组合即 AND） */
export interface ItemQuery {
  /** 关键字：命中名称 / 说明 / 文件内容任一处 */
  kw?: string
  /** 类型精确过滤 */
  type?: AssetType
  /** 标签精确过滤（整段匹配，java 不会误中 javascript） */
  tag?: string
}

/** 新增/更新的提交载荷（与后端 ItemSaveDTO 对齐，tags 在 api 层拼成逗号串） */
export interface ItemSavePayload {
  name: string
  type: AssetType
  lang?: string
  description?: string
  /** link 专用：目标 URL */
  url?: string
  /** 预览入口路径（必须命中 files） */
  entry?: string
  files: AssetFile[]
  deps: AssetDep[]
  tags: string[]
}

/**
 * 是否可在线预览：入口存在、是 .vue 单文件组件、声明了 vue 依赖。
 * 入口给 .ts/.md 没有可渲染的产物，预览沙箱跑的是组件不是模块——
 * 这条规则与后端无关（后端只存数据），所以放契约层由两端推导。
 */
export function isPreviewable(item: Pick<AssetItem, 'entry' | 'deps'>): boolean {
  if (!item.entry || !item.entry.endsWith('.vue')) return false
  return item.deps.some((d) => d.name === 'vue')
}

/** 资产类型 → 图标名：左列列表与右栏详情共用，避免新增类型时漏改一处 */
export const ASSET_TYPE_ICON: Record<AssetType, string> = {
  snippet: 'code',
  component: 'box',
  function: 'terminal',
  doc: 'fileText',
  link: 'link',
}
