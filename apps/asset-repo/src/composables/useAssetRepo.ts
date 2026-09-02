import { computed, ref, watch } from 'vue'
import { toast } from '@aegis/shared'
import { i18n } from '@/locales'
import { deleteItem, incrementCopy, listItems, saveItem, updateItem } from '@/api/items'
import type { AssetItem, AssetType, ItemSavePayload } from '@/api/types'

/**
 * 资产仓库的业务状态机（检索 / 选中 / 表单 / 增删改 / 复制计数）。
 *
 * 子应用没有 pinia，跨组件共享用「模块级单例」：状态创建在模块作用域，
 * useAssetRepo() 只是取同一份引用——视图、详情面板、表单抽屉看到的是同一份数据。
 */

/* ---------- 列表与筛选 ---------- */

const items = ref<AssetItem[]>([])
const loading = ref(false)
/** 检索关键字（名称/说明/正文三列模糊，输入防抖 300ms 后触发重查） */
const kw = ref('')
/** 类型过滤（空串 = 全部） */
const typeFilter = ref<AssetType | ''>('')
/** 标签过滤（undefined = 不过滤；选项由现有资产的标签聚合而来） */
const tagFilter = ref<string | undefined>(undefined)
const selectedId = ref<string | null>(null)

const selected = computed(() => items.value.find((i) => i.id === selectedId.value) ?? null)

/** 标签下拉选项：从列表聚合去重，选了标签后可顺藤摸到同类资产 */
const tagOptions = computed(() => {
  const set = new Set<string>()
  for (const item of items.value) for (const tag of item.tags) set.add(tag)
  return [...set].sort()
})

/** 重查列表；选中项被过滤掉时自动落到首条（双栏检索台：右栏尽量不空着） */
async function reload(): Promise<void> {
  loading.value = true
  try {
    items.value = await listItems({
      kw: kw.value.trim() || undefined,
      type: typeFilter.value || undefined,
      tag: tagFilter.value,
    })
    if (!items.value.some((i) => i.id === selectedId.value)) {
      selectedId.value = items.value[0]?.id ?? null
    }
  } catch (e) {
    // 检索失败给可读文案（网络不通 / 会话失效已在 http 层 toast 过，这里兜住其余）
    toast(e instanceof Error ? e.message : String(e), 'bad')
    items.value = []
    selectedId.value = null
  } finally {
    loading.value = false
  }
}

// 关键字防抖：输入停顿后再查，避免每敲一个字符打一次后端
let kwTimer: ReturnType<typeof setTimeout> | null = null
watch(kw, () => {
  if (kwTimer) clearTimeout(kwTimer)
  kwTimer = setTimeout(reload, 300)
})
// 类型/标签是离散选择，变更即查
watch([typeFilter, tagFilter], reload)

/* ---------- 新建 / 编辑抽屉 ---------- */

const drawerOpen = ref(false)
/** 当前编辑的资产（null = 新建模式） */
const editing = ref<AssetItem | null>(null)
const saving = ref(false)

function openCreate(): void {
  editing.value = null
  drawerOpen.value = true
}

function openEdit(item: AssetItem): void {
  editing.value = item
  drawerOpen.value = true
}

function closeDrawer(): void {
  drawerOpen.value = false
  editing.value = null
}

/** 提交表单（新建/编辑共用）：成功后重查列表并关抽屉；失败保持抽屉开着让用户改 */
async function submit(payload: ItemSavePayload): Promise<boolean> {
  saving.value = true
  try {
    if (editing.value) {
      await updateItem(editing.value.id, payload)
    } else {
      await saveItem(payload)
    }
    toast(i18n.global.t('repo.saved'))
    drawerOpen.value = false
    editing.value = null
    await reload()
    return true
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), 'bad')
    return false
  } finally {
    saving.value = false
  }
}

/* ---------- 删除 / 复制 ---------- */

async function remove(item: AssetItem): Promise<void> {
  try {
    await deleteItem(item.id)
    toast(i18n.global.t('repo.deleted'))
    await reload()
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), 'bad')
  }
}

/**
 * 复制资产正文并打计数。
 * 顺序刻意为"先反馈复制成功，再打点"：计数接口失败不应让用户以为复制没成功；
 * 本地先把次数 +1（不立即重排——刚点完复制的条目突然跳位会很懵，下次重查自然归位）。
 */
async function copy(item: AssetItem): Promise<void> {
  const ok = await copyText(item.content)
  if (!ok) {
    toast(i18n.global.t('repo.copyFailed'), 'bad')
    return
  }
  toast(i18n.global.t('repo.copied'))
  await incrementCopy(item.id).catch(() => {})
  const local = items.value.find((i) => i.id === item.id)
  if (local) local.copyCount++
}

/* ---------- 剪贴板工具 ---------- */

/**
 * 写剪贴板，带 iframe 沙箱兜底。
 * Clipboard API 在跨源 iframe / 非安全上下文里可能被拒，
 * 退化到隐藏 textarea + execCommand（老但哪里都能用）。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

/** 导出同一份单例状态与动作 */
export function useAssetRepo() {
  return {
    // 列表与筛选
    items,
    loading,
    kw,
    typeFilter,
    tagFilter,
    tagOptions,
    selectedId,
    selected,
    reload,
    // 表单抽屉
    drawerOpen,
    editing,
    saving,
    openCreate,
    openEdit,
    closeDrawer,
    submit,
    // 动作
    remove,
    copy,
  }
}
