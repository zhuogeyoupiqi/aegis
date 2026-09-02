import { computed, ref } from 'vue'
import { lastThemeSnapshot } from '@aegis/shared'
import { createHighlighter, type Highlighter } from 'shiki'

/**
 * Shiki 静态高亮（方案文档 §5.3：MVP 用 Shiki 做展示高亮，Monaco 编辑器后续再上）。
 *
 * - 按需声明语言与主题，打包器据此 tree-shake——不引全量语言包
 * - highlighter 是模块级单例：创建要加载语法/主题，全应用共享一份
 * - highlight() 是同步函数：highlighter 尚未就绪时先返回转义后的纯文本，
 *   ready 翻转后依赖它的 computed 自动重算——首帧不阻塞、也不闪白
 */

/** 高亮支持的语言全集（表单里的语言选项与此保持一致，避免选了不高亮） */
const LANGS = ['typescript', 'javascript', 'vue', 'java', 'python', 'go', 'sql', 'bash', 'json', 'yaml', 'markdown'] as const

/** 双主题：跟随基座下发的明暗模式切换，无需重建 highlighter */
const THEMES = ['github-light', 'github-dark'] as const

/** 语言别名归一（表单值 → shiki 内置语法 id；'text' 走纯文本分支） */
const ALIAS: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  md: 'markdown',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  py: 'python',
}

/** promise 兑现时回填：highlight() 的同步路径直接判空使用 */
let highlighter: Highlighter | null = null
/** 就绪标记：视图的 computed 依赖它，加载完成后自动从纯文本切到高亮 */
const ready = ref(false)
/** 加载 promise 的 memoization：多处调用 preload 也只创建一次 highlighter */
let loading: Promise<void> | null = null

/** 触发预加载（视图 setup 里调一次，把语法加载的耗时藏进首屏） */
function preload(): void {
  if (!loading) {
    loading = createHighlighter({ langs: [...LANGS], themes: [...THEMES] }).then((h) => {
      highlighter = h
      ready.value = true
    })
  }
}

/** 高亮失败/未就绪时的兜底：转义后包一层 pre，保证先有内容再变好看 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function useShiki() {
  /** 当前是否暗色：主题桥下发的快照 mode 已解析（light/dark），不含 auto；未收到前为 null 按浅色 */
  const dark = computed(() => lastThemeSnapshot.value?.mode === 'dark')

  /** 同步取高亮 HTML（未就绪/语言不支持时退化为转义纯文本） */
  function highlight(code: string, lang: string | null): string {
    // 先读这两个 ref：调用方的 computed 借此建立依赖，就绪/切主题后自动重算
    const isDark = dark.value
    const isReady = ready.value
    const normalized = lang ? (ALIAS[lang] ?? lang) : 'text'

    if (isReady && highlighter && normalized !== 'text' && (LANGS as readonly string[]).includes(normalized)) {
      try {
        return highlighter.codeToHtml(code, {
          lang: normalized,
          theme: isDark ? 'github-dark' : 'github-light',
        })
      } catch {
        // 个别语法渲染异常时不让整页崩掉，走纯文本兜底
      }
    }
    return `<pre class="shiki-plain"><code>${escapeHtml(code)}</code></pre>`
  }

  return { highlight, preload, dark, ready }
}
