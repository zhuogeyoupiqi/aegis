<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from '@aegis/shared'
import type { FormInstance } from 'ant-design-vue'
import AppIcon from '@/components/AppIcon.vue'
import FileTree from '@/components/FileTree.vue'
import CodeEditor from '@/components/CodeEditor.vue'
import { useAssetRepo } from '@/composables/useAssetRepo'
import { ingestPicked, pickedFromDataTransfer, pickedFromFileList, langFromPath } from '@/composables/useFolderIngest'
import { scanDeps } from '@/composables/useDepScan'
import type { AssetDep, AssetFile, AssetType, ItemSavePayload } from '@/api/types'

/**
 * 新建 / 编辑资产的表单抽屉。
 * V3 交互：扩宽抽屉 + 标签页分区（元信息 / 文件 / 依赖），
 * 让文件编辑有稳定空间，避免长表单滚动迷失。
 */
const { t } = useI18n()
const { drawerOpen, editing, saving, closeDrawer, submit } = useAssetRepo()

const formRef = ref<FormInstance>()
const dirInputRef = ref<HTMLInputElement>()

/** 当前激活的标签页 */
const tab = ref<'meta' | 'files' | 'deps'>('meta')

/** 语言选项 = Shiki 已装载的语法集（见 useShiki 的 LANGS），选了就一定有高亮 */
const LANG_OPTIONS = [
  { label: 'TypeScript', value: 'ts' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'Vue', value: 'vue' },
  { label: 'Java', value: 'java' },
  { label: 'Python', value: 'python' },
  { label: 'Go', value: 'go' },
  { label: 'SQL', value: 'sql' },
  { label: 'Bash', value: 'bash' },
  { label: 'JSON', value: 'json' },
  { label: 'YAML', value: 'yaml' },
  { label: 'Markdown', value: 'md' },
  { label: 'Plain text', value: 'text' },
]

const ASSET_TYPES: AssetType[] = ['snippet', 'component', 'function', 'doc', 'link']
const typeOptions = computed(() => ASSET_TYPES.map((v) => ({ label: t(`repo.types.${v}`), value: v })))

const formState = reactive({
  name: '',
  type: 'snippet' as AssetType,
  lang: 'ts',
  description: '',
  tags: [] as string[],
  url: '',
})

/* ---------- 文件清单与依赖（不进 a-form 的 model：校验在提交时统一做） ---------- */

const files = ref<AssetFile[]>([])
const deps = ref<AssetDep[]>([])
const entry = ref<string | null>(null)
const activeIndex = ref(0)
const dragging = ref(false)
const busy = ref(false)
const dragCounter = ref(0)

/** 当前编辑的文件对象：用索引定位，重命名时对象本身不变，避免输入框闪失 */
const activeFile = computed<AssetFile | null>(() => files.value[activeIndex.value] ?? null)
/** 文件树高亮 key：从 activeFile 派生，始终与当前编辑文件路径一致 */
const activePath = computed(() => activeFile.value?.path ?? null)

const rules = computed(() => ({
  name: [{ required: true, message: t('repo.form.nameRequired'), trigger: 'blur' }],
  // url 只对 link 类型生效；其他类型不渲染该字段，也不校验
  url: formState.type === 'link' ? [{ required: true, message: t('repo.form.urlRequired'), trigger: 'blur' }] : [],
}))

/** 代码类资产才显示语言选择；doc 固定 md、link 无语言——语义在类型上，不重复让用户选 */
const isCodeType = computed(() => ['snippet', 'component', 'function'].includes(formState.type))

// 每次打开重置表单：编辑态回填原值，新建态重默认值
watch(drawerOpen, (open) => {
  if (!open) return
  tab.value = 'meta'
  const src = editing.value
  Object.assign(formState, {
    name: src?.name ?? '',
    type: src?.type ?? 'snippet',
    lang: src?.lang ?? 'ts',
    description: src?.description ?? '',
    tags: src ? [...src.tags] : [],
    url: src?.url ?? '',
  })
  files.value = src ? src.files.map((f) => ({ ...f })) : [newFile('index.ts')]
  deps.value = src ? src.deps.map((d) => ({ ...d })) : []
  entry.value = src?.entry ?? null
  // 默认选中入口文件；没有入口则选中第一个文件
  const entryIdx = files.value.findIndex((f) => f.path === entry.value)
  activeIndex.value = entryIdx >= 0 ? entryIdx : 0
  // 先赋值再清校验，避免 resetFields 把值闪回空
  nextTick(() => {
    formRef.value?.clearValidate()
  })
})

/** 类型切换时把语言带到位：doc → md、link → text（提交时会被置空），代码类保持用户所选 */
watch(
  () => formState.type,
  (type) => {
    if (type === 'doc') formState.lang = 'md'
    if (type === 'link') formState.lang = 'text'
  },
)

function newFile(path: string): AssetFile {
  return { path, lang: langFromPath(path) ?? 'ts', code: '' }
}

/* ---------- 文件区动作 ---------- */

function uniqueFileName(): string {
  let idx = 1
  while (files.value.some((f) => f.path === `file-${idx}.ts`)) idx++
  return `file-${idx}.ts`
}

function addFile(): void {
  const f = newFile(uniqueFileName())
  files.value.push(f)
  activeIndex.value = files.value.length - 1
  tab.value = 'files'
}

function removeFile(path: string): void {
  const idx = files.value.findIndex((f) => f.path === path)
  if (idx === -1) return
  files.value.splice(idx, 1)
  if (entry.value === path) entry.value = null
  // 删除的是当前活动文件：优先前移；否则保持当前索引（Vue 会自动对应到新数组）
  if (activeIndex.value === idx) {
    activeIndex.value = Math.max(0, idx - 1)
  } else if (activeIndex.value > idx) {
    activeIndex.value--
  }
}

/** 当前文件路径变化时自动探测语言，保持编辑器高亮正确 */
watch(
  () => activeFile.value?.path,
  (p) => {
    const f = activeFile.value
    if (!f || !p) return
    const lang = langFromPath(p)
    if (lang) f.lang = lang
  },
)

async function ingestFromInput(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement
  if (!input.files?.length) return
  await runIngest(pickedFromFileList(input.files))
  input.value = ''
}

async function ingestFromDrop(ev: DragEvent): Promise<void> {
  if (!ev.dataTransfer) return
  await runIngest(await pickedFromDataTransfer(ev.dataTransfer))
}

function onDragEnter(): void {
  dragCounter.value++
  dragging.value = true
}

function onDragLeave(): void {
  dragCounter.value--
  if (dragCounter.value <= 0) {
    dragging.value = false
    dragCounter.value = 0
  }
}

function onDrop(ev: DragEvent): void {
  dragging.value = false
  dragCounter.value = 0
  ingestFromDrop(ev)
}

async function runIngest(picked: { path: string; file: File }[]): Promise<void> {
  if (!picked.length) return
  busy.value = true
  try {
    const { files: got, skipped } = await ingestPicked(picked)
    const byPath = new Map(files.value.map((f) => [f.path, f]))
    for (const f of got) byPath.set(f.path, f) // 后到覆盖：同名文件视为编辑
    files.value = [...byPath.values()]
    if (!entry.value) entry.value = got.find((f) => f.path.endsWith('.vue'))?.path ?? null
    // 导入后如果当前活动文件不在新清单里，优先切到入口文件
    const curPath = activePath.value
    if (!curPath || !byPath.has(curPath)) {
      const fallbackIdx = files.value.findIndex((f) => f.path === entry.value)
      activeIndex.value = fallbackIdx >= 0 ? fallbackIdx : 0
    }
    if (skipped.length) {
      toast(t('repo.form.ingested', { n: got.length, m: skipped.length }), 'info')
    }
  } finally {
    busy.value = false
  }
}

/** 扫描依赖：裸导入 → 预置版本表；按名字合并（已有的版本/来源不动，只补新） */
function runScan(): void {
  const { deps: found, broken } = scanDeps(files.value)
  const byName = new Map(deps.value.map((d) => [d.name, d]))
  for (const d of found) if (!byName.has(d.name)) byName.set(d.name, d)
  deps.value = [...byName.values()]
  if (broken.length) toast(t('repo.form.brokenImports', { n: broken.length }), 'info')
}

/** 把当前文件设为预览入口：只有 .vue 文件才能作为沙箱启动点 */
function setEntry(path: string): void {
  if (path.endsWith('.vue')) {
    entry.value = path
  }
}

/* ---------- 依赖编辑 ---------- */

function addDep(): void {
  deps.value.push({ name: '', version: '', source: 'bundled' })
}

function removeDep(i: number): void {
  deps.value.splice(i, 1)
}

/* ---------- 提交 ---------- */

async function onSubmit(): Promise<void> {
  await formRef.value?.validate()

  // 前端校验对齐后端口径（A0001 的报错在后端是英文技术句，这里给可读的本地化提示）
  if (formState.type !== 'link') {
    if (!files.value.length) {
      toast(t('repo.form.filesRequired'), 'bad')
      tab.value = 'files'
      return
    }
    const bad = files.value.find(
      (f) => !f.path.trim() || f.path.startsWith('/') || f.path.split('/').includes('..') || !f.code.trim(),
    )
    if (bad) {
      toast(t('repo.form.pathInvalid', { path: bad.path || '(空)' }), 'bad')
      tab.value = 'files'
      return
    }
    if (entry.value && !files.value.some((f) => f.path === entry.value)) {
      toast(t('repo.form.entryInvalid'), 'bad')
      return
    }
  }
  const noVersion = deps.value.find((d) => d.name.trim() && !d.version.trim())
  if (noVersion) {
    toast(t('repo.form.depVersionRequired', { name: noVersion.name }), 'bad')
    tab.value = 'deps'
    return
  }

  const payload: ItemSavePayload = {
    name: formState.name.trim(),
    type: formState.type,
    lang: isCodeType.value ? formState.lang : formState.type === 'doc' ? 'md' : undefined,
    description: formState.description.trim() || undefined,
    url: formState.type === 'link' ? formState.url.trim() : undefined,
    entry: formState.type !== 'link' ? entry.value ?? undefined : undefined,
    files: formState.type === 'link' ? [] : files.value.map((f) => ({ ...f, path: f.path.trim() })),
    deps: formState.type === 'link' ? [] : deps.value.filter((d) => d.name.trim()).map((d) => ({ ...d })),
    tags: formState.tags,
  }
  await submit(payload)
}
</script>

<template>
  <a-drawer
    :open="drawerOpen"
    :title="editing ? t('repo.form.editTitle') : t('repo.form.createTitle')"
    width="min(900px, 96vw)"
    destroy-on-close
    :footer="null"
    @close="closeDrawer"
  >
    <!-- 顶部标签页：元信息 / 文件 / 依赖 -->
    <div class="drawer-tabs">
      <button class="drawer-tab" :class="{ active: tab === 'meta' }" @click="tab = 'meta'">
        <AppIcon name="sliders" :size="12" />
        {{ t('repo.form.formTabMeta') }}
      </button>
      <button class="drawer-tab" :class="{ active: tab === 'files' }" @click="tab = 'files'">
        <AppIcon name="folder" :size="12" />
        {{ t('repo.form.formTabFiles') }}
      </button>
      <button class="drawer-tab" :class="{ active: tab === 'deps' }" @click="tab = 'deps'">
        <AppIcon name="pkg" :size="12" />
        {{ t('repo.form.formTabDeps') }}
      </button>
    </div>

    <div class="drawer-content">
      <!-- 元信息标签 -->
      <a-form v-show="tab === 'meta'" ref="formRef" :model="formState" :rules="rules" layout="vertical" class="item-form">
        <a-form-item :label="t('repo.form.name')" name="name">
          <a-input v-model:value="formState.name" :placeholder="t('repo.form.namePlaceholder')" allow-clear />
        </a-form-item>

        <div class="form-grid">
          <a-form-item :label="t('repo.form.type')" name="type">
            <a-select v-model:value="formState.type" :options="typeOptions" />
          </a-form-item>
          <a-form-item v-if="isCodeType" :label="t('repo.form.lang')" name="lang">
            <a-select v-model:value="formState.lang" :options="LANG_OPTIONS" />
          </a-form-item>
        </div>

        <a-form-item :label="t('repo.form.tags')" name="tags" :extra="t('repo.form.tagsHint')">
          <a-select
            v-model:value="formState.tags"
            mode="tags"
            :placeholder="t('repo.form.tagsPlaceholder')"
            :open="false"
            :token-separators="[',', ' ']"
          />
        </a-form-item>

        <a-form-item v-if="formState.type === 'link'" :label="t('repo.form.url')" name="url">
          <a-input v-model:value="formState.url" placeholder="https://…" allow-clear />
        </a-form-item>

        <a-form-item :label="t('repo.form.description')" name="description">
          <a-textarea v-model:value="formState.description" :rows="3" :placeholder="t('repo.form.descriptionPlaceholder')" />
        </a-form-item>
      </a-form>

      <!-- 文件标签 -->
      <div v-show="tab === 'files' && formState.type !== 'link'" class="files-tab">
        <div
          class="files-zone"
          :class="{ dragging }"
          @dragover.prevent
          @dragenter.prevent="onDragEnter"
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop($event)"
        >
          <div class="files-toolbar">
            <button class="btn btn-default btn-sm" @click="addFile">
              <AppIcon name="plus" :size="12" />
              {{ t('repo.form.addFile') }}
            </button>
            <button class="btn btn-default btn-sm" @click="dirInputRef?.click()">
              <AppIcon name="upload" :size="12" />
              {{ t('repo.form.importFolder') }}
            </button>
            <button class="btn btn-default btn-sm" @click="runScan">
              <AppIcon name="pkg" :size="12" />
              {{ t('repo.form.scanDeps') }}
            </button>
            <input ref="dirInputRef" type="file" class="hidden-input" webkitdirectory @change="ingestFromInput" />
            <span class="drop-hint">{{ t('repo.form.dropHint') }}</span>
          </div>

          <a-spin :spinning="busy" size="small">
            <div class="files-split">
              <div class="files-tree">
                <FileTree
                  :files="files"
                  :active-path="activePath"
                  :entry="entry"
                  removable
                  @select="(p) => (activeIndex = files.findIndex((f: AssetFile) => f.path === p))"
                  @remove="removeFile"
                />
              </div>
              <div v-if="activeFile" class="files-editor">
                <div class="editor-head">
                  <input
                    v-model="activeFile.path"
                    class="path-input"
                    :placeholder="t('repo.form.pathPlaceholder')"
                    spellcheck="false"
                  />
                  <a-tooltip v-if="activeFile.path.endsWith('.vue')" :title="t('repo.form.setEntry')">
                    <button
                      class="btn btn-icon"
                      :class="entry === activeFile.path ? 'btn-primary' : 'btn-default'"
                      type="button"
                      @click="setEntry(activeFile.path)"
                    >
                      <AppIcon name="play" :size="11" />
                    </button>
                  </a-tooltip>
                </div>
                <div class="editor-body">
                  <CodeEditor v-model="activeFile.code" :lang="activeFile.lang" :placeholder="t('repo.form.contentPlaceholder')" />
                </div>
              </div>
              <div v-else class="files-editor-empty">
                <AppIcon name="fileText" :size="32" />
                <p>{{ t('repo.form.noFileSelected') }}</p>
              </div>
            </div>
          </a-spin>
        </div>
      </div>

      <div v-if="tab === 'files' && formState.type === 'link'" class="tab-empty">
        <AppIcon name="link" :size="32" />
        <p>{{ t('repo.form.linkNoFiles') }}</p>
      </div>

      <!-- 依赖标签 -->
      <div v-show="tab === 'deps' && formState.type !== 'link'" class="deps-tab">
        <div class="deps-toolbar">
          <button class="btn btn-default btn-sm" @click="runScan">
            <AppIcon name="pkg" :size="12" />
            {{ t('repo.form.scanDeps') }}
          </button>
          <button class="btn btn-ghost btn-sm" @click="addDep">
            <AppIcon name="plus" :size="12" />
            {{ t('repo.form.addDep') }}
          </button>
          <span class="deps-hint">{{ t('repo.form.depsHint') }}</span>
        </div>
        <div class="dep-rows">
          <div v-for="(dep, i) in deps" :key="`${dep.name}-${i}`" class="dep-row">
            <input v-model="dep.name" class="dep-input dep-name" placeholder="package-name" spellcheck="false" />
            <input v-model="dep.version" class="dep-input dep-version" :placeholder="t('repo.form.version')" spellcheck="false" />
            <a-select v-model:value="dep.source" size="small" class="dep-source" :options="[
              { label: t('repo.depBundled'), value: 'bundled' },
              { label: t('repo.depCdn'), value: 'cdn' },
            ]" />
            <button type="button" class="btn btn-icon btn-danger-outline" :title="t('repo.form.removeDep')" @click="removeDep(i)">
              <AppIcon name="x" :size="11" />
            </button>
          </div>
          <p v-if="!deps.length" class="dep-empty">{{ t('repo.depsEmpty') }}</p>
        </div>
      </div>

      <div v-if="tab === 'deps' && formState.type === 'link'" class="tab-empty">
        <AppIcon name="link" :size="32" />
        <p>{{ t('repo.form.linkNoDeps') }}</p>
      </div>
    </div>

    <div class="drawer-footer">
      <button class="btn btn-default" @click="closeDrawer">{{ t('repo.form.cancel') }}</button>
      <button class="btn btn-primary" :disabled="saving" @click="onSubmit">
        <AppIcon name="save" :size="13" />
        {{ t('repo.form.submit') }}
      </button>
    </div>
  </a-drawer>
</template>

<style scoped lang="less">
.drawer-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  margin-bottom: 16px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  width: fit-content;
}

.drawer-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  font-size: 13px;
  color: var(--fg-muted);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--ease);

  &:hover {
    color: var(--fg-sub);
  }

  &.active {
    color: var(--fg);
    background: var(--bg-card);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }
}

.drawer-content {
  min-height: 420px;
}

:deep(.ant-drawer-body) {
  display: flex;
  flex-direction: column;
  padding-bottom: 0;
}

:deep(.ant-drawer-header) {
  border-bottom: 1px solid var(--border);
}

:deep(.ant-drawer-title) {
  font-weight: 600;
  font-size: 15px;
  color: var(--fg);
}

.item-form {
  :deep(.ant-form-item-label > label) {
    font-size: 12px;
    color: var(--fg-sub);
    height: auto;
  }

  :deep(.ant-form-item-extra) {
    font-size: 11px;
    color: var(--fg-muted);
    padding-top: 4px;
  }

  :deep(.ant-input),
  :deep(.ant-select-selector),
  :deep(.ant-input-affix-wrapper) {
    background: var(--bg-input);
    border-color: transparent;
    color: var(--fg);
  }

  :deep(.ant-input::placeholder),
  :deep(.ant-select-selection-placeholder) {
    color: var(--fg-muted);
  }

  :deep(.ant-form-item) {
    margin-bottom: 16px;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
}

.hidden-input {
  display: none;
}

.files-tab,
.deps-tab {
  height: 100%;
}

.files-zone {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  padding: 12px;
  transition: border-color var(--ease);

  &.dragging {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 4%, transparent);
  }
}

.files-toolbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;

  .drop-hint {
    margin-left: auto;
    font-size: 11px;
    color: var(--fg-muted);
  }
}

.files-split {
  flex: 1;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 12px;
  min-height: 360px;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
}

.files-tree {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 6px;
  overflow-y: auto;
}

.files-editor {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-card);
}

.editor-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-input);
}

.editor-body {
  flex: 1;
  min-height: 260px;
  overflow: hidden;
}

.files-editor-empty,
.tab-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--fg-muted);
  min-height: 260px;

  p {
    margin: 0;
    font-size: 12.5px;
  }
}

.path-input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--fg);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: border-color var(--ease);

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.deps-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;

  .deps-hint {
    margin-left: auto;
    font-size: 11.5px;
    color: var(--fg-muted);
  }
}

.dep-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dep-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 10px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);

  .dep-input {
    height: 28px;
    padding: 0 8px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--fg);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    outline: none;
    transition: border-color var(--ease);

    &:focus {
      border-color: var(--primary);
    }
  }

  .dep-name {
    flex: 1;
    min-width: 0;
  }

  .dep-version {
    width: 120px;
    flex: none;
  }

  .dep-source {
    width: 100px;
    flex: none;
  }
}

.dep-empty {
  margin: 0;
  padding: 20px 0;
  text-align: center;
  font-size: 12px;
  color: var(--fg-muted);
}

.drawer-footer {
  flex: none;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 0 0;
  border-top: 1px solid var(--border);
  margin-top: auto;
}

// antd drawer 本身没有 footer 插槽时，底部操作区通过 margin-top:auto 贴底
:deep(.ant-drawer-content) {
  display: flex;
  flex-direction: column;
}
</style>
