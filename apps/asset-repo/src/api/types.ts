/**
 * 资产仓库的统一类型定义。
 * 视图只认识这里的形状，不关心背后是 localStorage 还是后端接口——
 * mock/real 两种实现跑同一套协议，页面里没有任何 if (mode) 分支。
 */

// 数据源模式统一用契约包定义（基座偏好、数据通道、子应用读取三处一个真源）
export type { ApiMode } from '@aegis/contract'

/** 资产类型：五类共用一张表，type 是判别 tag（与后端 ItemSaveDTO 的 @Pattern 白名单一致） */
export type AssetType = 'snippet' | 'component' | 'function' | 'doc' | 'link'

/** 一条资产（real=asset_item 行投影；mock=本地记录，字段同构） */
export interface AssetItem {
  id: string
  name: string
  type: AssetType
  /** 代码语言（Shiki 语法名；doc 固定 md；link 为 null） */
  lang: string | null
  description: string | null
  /** 正文：代码全文 / markdown / URL */
  content: string
  /** 标签数组（存储层是逗号串，api 层拆装，视图永远拿数组） */
  tags: string[]
  copyCount: number
  updateTime: string
}

/** 检索条件（全部可选，组合即 AND） */
export interface ItemQuery {
  /** 关键字：命中名称 / 说明 / 正文任一列 */
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
  content: string
  tags: string[]
}
