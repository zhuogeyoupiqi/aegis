import { computed, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { ThemeSnapshot } from '@aegis/contract'
import { toast } from '@aegis/shared'
import { setI18nLocale, type Lang } from '@/locales'

/* ================= 主题预设（参考 Vben 的多主题色） ================= */
export interface ThemePreset {
  key: string
  label: string
  primary: string
  gradFrom: string
  gradTo: string
}

export const THEME_PRESETS: ThemePreset[] = [
  { key: 'violet', label: '紫罗兰', primary: '#7c3aed', gradFrom: '#7c3aed', gradTo: '#c026d3' },
  { key: 'blue',   label: '海空蓝', primary: '#2563eb', gradFrom: '#2563eb', gradTo: '#06b6d4' },
  { key: 'cyan',   label: '青碧',   primary: '#0891b2', gradFrom: '#0891b2', gradTo: '#22d3ee' },
  { key: 'green',  label: '翡翠绿', primary: '#059669', gradFrom: '#059669', gradTo: '#84cc16' },
  { key: 'amber',  label: '琥珀橙', primary: '#d97706', gradFrom: '#d97706', gradTo: '#f59e0b' },
  { key: 'rose',   label: '绯红',   primary: '#e11d48', gradFrom: '#e11d48', gradTo: '#fb7185' },
  { key: 'pink',   label: '洋红',   primary: '#db2777', gradFrom: '#db2777', gradTo: '#f472b6' },
]

export type ThemeMode = 'light' | 'dark' | 'auto'
export type NavLayout = 'side' | 'top' | 'mixed'

/** 全局外观偏好（持久化到 localStorage） */
export interface AppPrefs {
  mode: ThemeMode
  color: string
  layout: NavLayout
  showTabs: boolean
  colorWeak: boolean
  gray: boolean
  /** 界面语言：持久化，并随主题一起下发子应用 */
  lang: Lang
}

const PREFS_KEY = 'aegis:prefs'
const DEFAULT_PREFS: AppPrefs = {
  mode: 'light',
  color: 'violet',
  layout: 'side',
  showTabs: true,
  colorWeak: false,
  gray: false,
  lang: 'zh-CN',
}

/** 从 localStorage 恢复偏好；存档损坏时静默回默认值（外观类偏好不值得抛错误） */
function loadPrefs(): AppPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    // 合并而不是直接用存档：升级新增偏好项时不至于缺字段
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<AppPrefs>) } : { ...DEFAULT_PREFS }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

/** 标签页条目。title 存 i18n 词条 key（如 menu.items.workbench），渲染时 t() 解析 */
export interface TagItem {
  path: string
  title: string
  appCode: string
  affix?: boolean
}

/** toast 语义类型：ok=成功 / bad=错误 / info=中性提示 */
export type ToastType = 'ok' | 'bad' | 'info'

export const useAppStore = defineStore('app', () => {
  /* ---------- 主题 ---------- */
  // 跟随系统：监听操作系统外观变化，auto 模式下实时重算
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const systemDark = ref(media.matches)
  media.addEventListener('change', (e) => { systemDark.value = e.matches })

  const prefs = reactive<AppPrefs>(loadPrefs())

  /** auto 在这里就解析成明/暗：后续所有消费方（DOM、antd、子应用快照）只拿结果，不重复判断 */
  const resolvedMode = computed<'light' | 'dark'>(() =>
    prefs.mode === 'auto' ? (systemDark.value ? 'dark' : 'light') : prefs.mode,
  )
  /** 当前主题色预设；key 对不上时兜底第一个，保证任何存档都能渲染 */
  const preset = computed(() => THEME_PRESETS.find((p) => p.key === prefs.color) ?? THEME_PRESETS[0])

  /** 下发给子应用的主题快照（契约包类型） */
  const themeSnapshot = computed<ThemeSnapshot>(() => ({
    mode: resolvedMode.value,
    primary: preset.value.primary,
    gradFrom: preset.value.gradFrom,
    gradTo: preset.value.gradTo,
  }))

  /** 把偏好落到 DOM：data-theme + 主题色变量 + 无障碍 class */
  function applyAppearance(): void {
    const root = document.documentElement
    root.dataset.theme = resolvedMode.value
    root.style.setProperty('--primary', preset.value.primary)
    root.style.setProperty('--grad-1', preset.value.gradFrom)
    root.style.setProperty('--grad-2', preset.value.gradTo)
    root.classList.toggle('color-weak', prefs.colorWeak)
    root.classList.toggle('gray-mode', prefs.gray)
  }

  watch([resolvedMode, preset, () => prefs.colorWeak, () => prefs.gray], applyAppearance)
  watch(prefs, () => localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)), { deep: true })

  // 语言：持久化值在 store 实例化时立即生效（否则刷新后首屏是中文再闪切）
  setI18nLocale(prefs.lang)
  watch(
    () => prefs.lang,
    (lang) => setI18nLocale(lang),
  )

  // store 实例化即应用一次，避免进入主布局后才闪切
  applyAppearance()

  /** 恢复默认外观；语言也一并回中文（语言属于偏好的组成部分而非运行状态） */
  function resetPrefs(): void {
    Object.assign(prefs, DEFAULT_PREFS)
  }

  /* ---------- 标签页 ---------- */
  const tabs = ref<TagItem[]>([
    // 常驻首页标签：标题同其它标签一样存词条 key
    { path: '/workbench', title: 'menu.items.workbench', appCode: 'base', affix: true },
  ])

  /** 新增标签（按 path 去重）：path 由路由守卫经 normalizeTabPath 洗过，可作身份键 */
  function addTab(tab: TagItem): void {
    if (!tabs.value.some((t) => t.path === tab.path)) tabs.value.push(tab)
  }

  /** 关闭单个标签；affix（常驻工作台）不可关 */
  function removeTab(path: string): void {
    tabs.value = tabs.value.filter((t) => !(t.path === path && !t.affix))
  }

  /** 关闭除指定标签外的全部（保留 affix） */
  function closeOthers(path: string): void {
    tabs.value = tabs.value.filter((t) => t.affix || t.path === path)
  }

  /* ---------- 刷新（配合 TagsView 右键「刷新」重建 micro-app） ---------- */
  const refreshKey = ref(0)
  /** 递增刷新键：MainLayout 用它作 router-view 的 key，key 变 = 整页重建 */
  function refresh(): void {
    refreshKey.value++
  }

  /* ---------- 布局状态 ---------- */
  const sidebarCollapsed = ref(false)
  /** mixed 布局下当前激活的顶部分组 key */
  const activeTopGroup = ref('')
  const settingsOpen = ref(false)

  /* ---------- Toast ---------- */
  /**
   * 全局轻提示：转发到 shared 的 toast（内部走 antd message）。
   * store 里拿不到组件上下文，所以经由 shared 的绑定机制使用带主题的实例。
   */
  function pushToast(text: string, type: ToastType = 'ok'): void {
    toast(text, type)
  }

  return {
    prefs,
    systemDark,
    resolvedMode,
    preset,
    themeSnapshot,
    resetPrefs,
    tabs,
    addTab,
    removeTab,
    closeOthers,
    refreshKey,
    refresh,
    sidebarCollapsed,
    activeTopGroup,
    settingsOpen,
    pushToast,
  }
})
