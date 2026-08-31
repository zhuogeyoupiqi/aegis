import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import enUS from './en-US'

export type Lang = 'zh-CN' | 'en-US'

export const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
]

/**
 * 基座 i18n 实例。
 * - legacy: false → Composition API 模式（useI18n / i18n.global）
 * - globalInjection: true → 模板里可直接用 $t
 * - 初始语言由 app store 从持久化偏好里再同步一次（见 stores/app.ts）
 * - missing/fallback 警告关掉：词条缺失时回退中文即可，控制台别刷屏
 */
export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

/** 切语言统一走这里：i18n locale 与 antd 组件文案（ConfigProvider :locale）共用同一来源 */
export function setI18nLocale(lang: Lang): void {
  i18n.global.locale.value = lang
  // HTML lang 属性跟着换：语义正确，也方便浏览器翻译类辅助工具
  document.documentElement.setAttribute('lang', lang)
}
