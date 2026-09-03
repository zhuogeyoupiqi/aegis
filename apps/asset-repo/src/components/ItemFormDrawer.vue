<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from '@aegis/shared'
import type { FormInstance } from 'ant-design-vue'
import AppIcon from '@/components/AppIcon.vue'
import FileTree from '@/components/FileTree.vue'
import { useAssetRepo } from '@/composables/useAssetRepo'
import { ingestPicked, pickedFromDataTransfer, pickedFromFileList, langFromPath } from '@/composables/useFolderIngest'
import { scanDeps } from '@/composables/useDepScan'
import type { AssetDep, AssetFile, AssetType, ItemSavePayload } from '@/api/types'

/**
 * 新建 / 编辑资产的表单抽屉。
 * 开关与编辑目标直接读写 useAssetRepo 单例（drawerOpen / editing），
 * 提交走 composable 的 submit：失败时抽屉保持打开，用户改完再交。
 *
 * V2 文件区：工具条（新文件 / 导入文件夹 / 扫描依赖）+ 文件树 + 当前文件编辑器，
 * 整个区域可拖放目录（webkitGetAsEntry 递归展开）。
 */
const { t } = useI18n()
const { drawerOpen, editing, saving, closeDrawer, submit } = useAssetRepo()

const formRef = ref<FormInstance>()
const dirInputRef = ref<HTMLInputElement>()

/** 语言选项 = Shiki 已装载的语法集（见 useShiki 的 LANGS），选了就一定有高亮 */
const LANG_OPTIONS = ['ts', 'javascript', 'vue', 'java', 'python', 'go', 'sql', 'bash', 'json', 'yaml', 'md', 'text']

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
const activePath = ref<string | null>(null)
const dragging = ref(false)
const busy = ref(false)

const activeIdx = computed(() => files.value.findIndex((f) => f.path === activePath.value))
const activeFile = computed<AssetFile | null>(() => (activeIdx.value === -1 ? null : files.value[activeIdx.value]))

/** 预览入口候选：只列 .vue（入口语义是"沙箱从这个组件启动渲染"） */
const entryOptions = computed(() =>
  files.value.filter((f) => f.path.endsWith('.vue')).map((f) => ({ label: f.path, value: f.path })),
)

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
  formRef.value?.resetFields()
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
  activePath.value = entry.value ?? files.value[0]?.path ?? null
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

function addFile(): void {
  const f = newFile(`file-${files.value.length + 1}.ts`)
  files.value.push(f)
  activePath.value = f.path
}

function removeFile(path: string): void {
  const idx = files.value.findIndex((f) => f.path === path)
  if (idx === -1) return
  files.value.splice(idx, 1)
  if (entry.value === path) entry.value = null
  if (activePath.value === path) activePath.value = files.value[Math.max(0, idx - 1)]?.path ?? null
}

/** 路径编辑后同步语言探测，并同步 activePath，避免改名后文件树高亮丢失 */
watch(
  () => activeFile.value?.path,
  (p, prev) => {
    const f = activeFile.value
    if (!f || !p) return
    const lang = langFromPath(p)
    if (lang) f.lang = lang
    // 当前活动文件被重命名时，把选中 key 一起迁到新路径，否则树高亮与后续切回都会失效
    if (prev && activePath.value === prev) {
      activePath.value = p
    }
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

async function runIngest(picked: { path: string; file: File }[]): Promise<void> {
  if (!picked.length) return
  busy.value = true
  try {
    const { files: got, skipped } = await ingestPicked(picked)
    const byPath = new Map(files.value.map((f) => [f.path, f]))
    for (const f of got) byPath.set(f.path, f) // 后到覆盖：同名文件视为编辑
    files.value = [...byPath.values()]
    if (!entry.value) entry.value = got.find((f) => f.path.endsWith('.vue'))?.path ?? null
    if (!activePath.value || !byPath.has(activePath.value)) activePath.value = entry.value ?? files.value[0]?.path ?? null
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

/* ---------- 提交 ---------- */

async function onSubmit(): Promise<void> {
  await formRef.value?.validate()

  // 前端校验对齐后端口径（A0001 的报错在后端是英文技术句，这里给可读的本地化提示）
  if (formState.type !== 'link') {
    if (!files.value.length) {
      toast(t('repo.form.filesRequired'), 'bad')
      return
    }
    const bad = files.value.find(
      (f) => !f.path.trim() || f.path.startsWith('/') || f.path.split('/').includes('..') || !f.code.trim(),
    )
    if (bad) {
      toast(t('repo.form.pathInvalid', { path: bad.path || '(空)' }), 'bad')
      return
    }
    if (entry.value && !files.value.some((f) => f.path === entry.value)) {
      toast(t('repo.form.entryInvalid'), 'bad')
      return
    }
  }
  const noVersion = deps.value.find((d) => !d.version.trim())
  if (noVersion) {
    toast(t('repo.form.depVersionRequired', { name: noVersion.name }), 'bad')
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
    deps: formState.type === 'link' ? [] : deps.value.map((d) => ({ ...d })),
    tags: formState.tags,
  }
  await submit(payload)
}
</script>

<template>
  <a-drawer
    :open="drawerOpen"
    :title="editing ? t('repo.form.editTitle') : t('repo.form.createTitle')"
    width="min(680px, 94vw)"
    destroy-on-close
    @close="closeDrawer"
  >
    <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical" class="item-form">
      <a-form-item :label="t('repo.form.name')" name="name">
        <a-input v-model:value="formState.name" :placeholder="t('repo.form.namePlaceholder')" allow-clear />
      </a-form-item>

      <div class="form-grid">
        <a-form-item :label="t('repo.form.type')" name="type">
          <a-select v-model:value="formState.type" :options="typeOptions" />
        </a-form-item>
        <a-form-item v-if="isCodeType" :label="t('repo.form.lang')" name="lang">
          <a-select v-model:value="formState.lang" :options="LANG_OPTIONS.map((v) => ({ value: v }))" />
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

      <!-- link：只收 URL；其余类型走文件区 -->
      <a-form-item v-if="formState.type === 'link'" :label="t('repo.form.url')" name="url">
        <a-input v-model:value="formState.url" placeholder="https://…" allow-clear />
      </a-form-item>

      <template v-else>
        <a-form-item :label="t('repo.form.files')" name="files">
          <!-- 拖放热区：整个文件区（含树与编辑器）都是 drop 目标 -->
          <div
            class="files-zone"
            :class="{ dragging }"
            @dragover.prevent="dragging = true"
            @dragleave="dragging = false"
            @drop.prevent="dragging = false; ingestFromDrop($event)"
          >
            <div class="files-toolbar">
              <a-button size="small" @click="addFile">
                <template #icon><AppIcon name="plus" :size="12" /></template>
                {{ t('repo.form.addFile') }}
              </a-button>
              <a-button size="small" @click="dirInputRef?.click()">
                <template #icon><AppIcon name="upload" :size="12" /></template>
                {{ t('repo.form.importFolder') }}
              </a-button>
              <a-button size="small" @click="runScan">
                <template #icon><AppIcon name="pkg" :size="12" /></template>
                {{ t('repo.form.scanDeps') }}
              </a-button>
              <!-- webkitdirectory 是非标属性，Vue 模板里用 DOM 属性绑定绕过类型检查 -->
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
                    @select="(p) => (activePath = p)"
                    @remove="removeFile"
                  />
                </div>
                <div v-if="activeFile" class="files-editor">
                  <input
                    v-model="activeFile.path"
                    class="path-input"
                    :placeholder="t('repo.form.pathPlaceholder')"
                    spellcheck="false"
                  />
                  <textarea
                    v-model="activeFile.code"
                    class="code-input"
                    :placeholder="t('repo.form.contentPlaceholder')"
                    spellcheck="false"
                  />
                </div>
              </div>
            </a-spin>
          </div>
        </a-form-item>

        <a-form-item
          v-if="entryOptions.length"
          :label="t('repo.form.entry')"
          name="entry"
          :extra="t('repo.form.entryHint')"
        >
          <a-select v-model:value="entry" :options="entryOptions" allow-clear :placeholder="t('repo.form.entryPlaceholder')" />
        </a-form-item>

        <a-form-item :label="t('repo.form.depsTitle')" name="deps" :extra="t('repo.form.depsHint')">
          <div class="dep-rows">
            <div v-for="(dep, i) in deps" :key="dep.name" class="dep-row">
              <span class="dep-name">{{ dep.name }}</span>
              <input v-model="dep.version" class="dep-input" :placeholder="t('repo.form.version')" spellcheck="false" />
              <a-select v-model:value="dep.source" size="small" class="dep-source" :options="[
                { label: t('repo.depBundled'), value: 'bundled' },
                { label: t('repo.depCdn'), value: 'cdn' },
              ]" />
              <span class="dep-remove" role="button" @click="deps.splice(i, 1)"><AppIcon name="x" :size="11" /></span>
            </div>
            <p v-if="!deps.length" class="dep-empty">{{ t('repo.depsEmpty') }}</p>
          </div>
        </a-form-item>
      </template>

      <a-form-item :label="t('repo.form.description')" name="description">
        <a-textarea v-model:value="formState.description" :rows="2" :placeholder="t('repo.form.descriptionPlaceholder')" />
      </a-form-item>
    </a-form>

    <template #footer>
      <div class="drawer-footer">
        <a-button @click="closeDrawer">{{ t('repo.form.cancel') }}</a-button>
        <a-button type="primary" :loading="saving" @click="onSubmit">
          <template #icon><AppIcon name="save" :size="13" /></template>
          {{ t('repo.form.submit') }}
        </a-button>
      </div>
    </template>
  </a-drawer>
</template>

<style scoped lang="less">
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

.files-zone {
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 10px;
  transition: border-color var(--ease);

  &.dragging {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 4%, transparent);
  }
}

.files-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;

  .drop-hint {
    margin-left: auto;
    font-size: 11px;
    color: var(--fg-muted);
  }
}

.files-split {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 10px;
  min-height: 260px;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
}

.files-tree {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.files-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.path-input,
.code-input,
.dep-input {
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--fg);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  transition: border-color var(--ease);

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.path-input {
  height: 30px;
  padding: 0 10px;
}

.code-input {
  flex: 1;
  min-height: 220px;
  padding: 10px 12px;
  line-height: 1.6;
  resize: vertical;
}

.dep-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dep-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;

  .dep-name {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--fg-sub);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dep-input {
    width: 110px;
    height: 28px;
    padding: 0 8px;
  }

  .dep-source {
    width: 96px;
    flex: none;
  }

  .dep-remove {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    color: var(--fg-muted);
    cursor: pointer;
    transition: all var(--ease);

    &:hover {
      color: #fd5257;
      background: rgba(253, 82, 87, 0.1);
    }
  }
}

.dep-empty {
  margin: 0;
  font-size: 11.5px;
  color: var(--fg-muted);
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
