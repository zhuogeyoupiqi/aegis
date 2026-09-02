import { ref, type Ref } from 'vue'
import type { AssetFile } from '@/api/types'

/**
 * 文件树构建与折叠状态（详情面板 / 表单抽屉共用）。
 *
 * 存储是 git 模型平铺路径（无目录实体），树由前端按 / 切分还原；
 * 排序对齐 IDE 直觉：目录在前（字母序）、文件在后（字母序），
 * 用户扫视时"容器先于内容"，不会在文件和目录间来回跳。
 */

export interface TreeDir {
  type: 'dir'
  /** 目录名（最后一段） */
  name: string
  /** 完整路径（折叠状态的 key，必须全局唯一且稳定） */
  path: string
  children: TreeNode[]
}

export interface TreeFile {
  type: 'file'
  name: string
  path: string
  lang: string | null
}

export type TreeNode = TreeDir | TreeFile

/** 平铺文件清单 → 嵌套树；同一路径重复出现时后者覆盖（导入去重后的兜底语义） */
export function buildTree(files: Pick<AssetFile, 'path' | 'lang'>[]): TreeNode[] {
  // 目录表：目录完整路径 → true（只需要 key，装配时按前缀找直接子级）
  const dirs = new Map<string, true>()
  // 文件表：完整路径 → 树节点需要的两个字段（code 不进树，选中后再取）
  const fileMap = new Map<string, { path: string; lang: string | null }>()

  for (const f of files) {
    const path = f.path.replace(/^\/+/, '')
    fileMap.set(path, { ...f, path, lang: f.lang ?? null })
    const segs = path.split('/')
    segs.pop() // 文件名出列，剩下的是祖先目录链
    let prefix = ''
    for (const seg of segs) {
      prefix = prefix ? `${prefix}/${seg}` : seg
      dirs.set(prefix, true)
    }
  }

  // 递归装配：children = 直接子目录（目录表里余一段的）+ 直接文件（文件表里余一段的）
  function childrenOf(parent: string): TreeNode[] {
    const childDirs: TreeNode[] = []
    const childFiles: TreeNode[] = []
    const parentPrefix = parent ? parent + '/' : ''
    for (const [dirPath] of dirs) {
      if (!dirPath.startsWith(parentPrefix)) continue
      const rest = dirPath.slice(parentPrefix.length)
      // 直接子目录：余下部分恰有一段且不是文件（rest 无 / 即目录名本身）
      if (rest && !rest.includes('/')) childDirs.push(buildDirFull(dirPath))
    }
    for (const [filePath, f] of fileMap) {
      if (!filePath.startsWith(parentPrefix)) continue
      const rest = filePath.slice(parentPrefix.length)
      if (rest && !rest.includes('/')) {
        childFiles.push({ type: 'file', name: rest, path: filePath, lang: f.lang })
      }
    }
    childDirs.sort((a, b) => a.name.localeCompare(b.name))
    childFiles.sort((a, b) => a.name.localeCompare(b.name))
    return [...childDirs, ...childFiles]
  }
  function buildDirFull(dirPath: string): TreeDir {
    return { type: 'dir', name: dirPath.split('/').pop()!, path: dirPath, children: childrenOf(dirPath) }
  }

  return childrenOf('')
}

/**
 * 折叠状态：Set<dirPath> 记"已折叠"目录（默认全展开，收少数比开少数顺手）。
 * 状态放调用方还是这里？——两个面板各自独立折叠互不干扰，所以按调用点实例化。
 */
export function useTreeCollapse(): { collapsed: Ref<Set<string>>; toggle: (dirPath: string) => void } {
  const collapsed = ref(new Set<string>())
  function toggle(dirPath: string): void {
    // Set 的引用不变不会触发响应式更新，这里整体换新 Set（树规模个位数，复制成本可忽略）
    const next = new Set(collapsed.value)
    if (next.has(dirPath)) next.delete(dirPath)
    else next.add(dirPath)
    collapsed.value = next
  }
  return { collapsed, toggle }
}
