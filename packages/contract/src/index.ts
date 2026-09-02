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
  /** 语言（'zh-CN' | 'en-US'）：子应用跟随基座切换 i18n locale 与 antd locale */
  LANG: 'lang',
  /**
   * 用户态（登录快照）：token 与用户信息由基座统一下发，子应用只读——
   * iframe 跨源下子应用既拿不到 cookie 也无法自持会话，基座是唯一登录态持有者
   */
  USER: 'user',
  /**
   * 数据源模式（mock/real）：与主题/语言同机制的全局配置，基座设置抽屉是唯一控制点，
   * 子应用页面上不允许再出现模式开关（避免两处状态打架）
   */
  API_MODE: 'api-mode',
} as const

/** 数据源模式：mock = 本地模拟（无后端可用），real = 真实后端接口 */
export type ApiMode = 'mock' | 'real'

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

/**
 * 登录态快照（基座 → 子应用）：token 供子应用调真实接口时拼 Authorization 头，
 * user 供界面展示。未登录时基座显式下发 null（比漏发旧值诚实，子应用据此走未登录分支）。
 */
export interface AuthSnapshot {
  token: string
  user: UserSnapshot
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
