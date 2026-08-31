/**
 * @aegis/contract —— 基座 ⇄ 子应用 ⇄ 后端 之间的协议层（零依赖）
 *
 * 为什么要有这个包：微前端下事件名、应用编码、数据键名一旦以字符串字面量
 * 散落在多个应用里，改名就是灾难。所有"约定"集中在这里，改协议只动一个包。
 */

/** 子应用编码（应用注册中心、菜单下发、标签页着色统一使用） */
export const APP_CODES = {
  BASE: 'base',
  SOC_TOOLS: 'soc-tools',
  ASSET_REPO: 'asset-repo',
  AI_STUDIO: 'ai-studio',
  SYSTEM_ADMIN: 'system-admin',
} as const

export type AppCode = (typeof APP_CODES)[keyof typeof APP_CODES]

/** 子应用注册信息（生产由后端 sys_config 下发，MVP 阶段前端 mock） */
export interface AppRegistration {
  code: AppCode
  /** 展示名（如「SOC 工具集」） */
  name: string
  /** 开发环境入口（Vite dev 端口） */
  devEntry: string
  /** 生产环境入口（同域路径部署，见方案文档 2.5.3 决策 1） */
  prodEntry: string
}

/** 基座 → 子应用 数据通道的键（micro-app setData 载荷的键名契约） */
export const CHILD_DATA_KEYS = {
  /** 主题快照：子应用收到后同步自己的 CSS 变量 */
  THEME: 'theme',
  /** 用户态（只读快照）：子应用展示用户名/权限用，禁止自行管理 token */
  USER: 'user',
} as const

/** 主题快照：基座下发、子应用应用（useBaseThemeBridge 消费） */
export interface ThemeSnapshot {
  mode: 'light' | 'dark'
  /** 主色（--primary） */
  primary: string
  /** 渐变起止（--grad-1 / --grad-2） */
  gradFrom: string
  gradTo: string
}

/** 用户信息快照（登录后由基座注入子应用） */
export interface UserSnapshot {
  account: string
  nickname: string
  roles: string[]
}

/** 菜单节点（后端 sys_menu 下发结构的子集，MVP 由前端 mock） */
export interface MenuItem {
  key: string
  title: string
  icon?: string
  /** 归属子应用编码：base 为基座内置页面 */
  appCode: AppCode
  /** 基座路由路径（子应用内部路由由子应用自行处理） */
  path: string
  /** 未接入子应用的占位项 */
  stub?: boolean
}

export interface MenuGroup {
  key: string
  title: string
  children: MenuItem[]
}
