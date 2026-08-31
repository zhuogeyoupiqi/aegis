<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { APP_CODES, CHILD_DATA_KEYS, type AppCode } from '@aegis/contract'
import { useAppStore } from '@/stores/app'
import { useMenuStore } from '@/stores/menu'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const appStore = useAppStore()
const menuStore = useMenuStore()

/** 当前路由要装载的子应用（由路由 meta 指定，用契约类型收窄 registry 索引） */
const appCode = computed<AppCode>(() => (route.meta.appCode as AppCode) || APP_CODES.SOC_TOOLS)
const registration = computed(() => menuStore.registry[appCode.value])

/**
 * 子应用地址：
 * - dev 直连子应用 dev 端口（跨源也无所谓，iframe 沙箱天生支持）
 * - build 后走基座同域静态路径
 * - 基座路径 /soc/xxx 映射子应用 hash 路由 #/xxx，路由联动不靠通信
 */
const appUrl = computed(() => {
  if (!registration.value) return ''
  const entry = import.meta.env.DEV ? registration.value.devEntry : registration.value.prodEntry
  const childPath = route.path.replace(/^\/soc/, '') || '/'
  return `${entry}#${childPath}`
})

const el = ref<HTMLElement | null>(null)
const loading = ref(true)
const failed = ref(false)

/** 把主题快照推给子应用（mounted 事件后与主题变化时各调一次） */
function pushTheme(): void {
  const target = el.value as unknown as { setData?: (data: Record<string, unknown>) => void } | null
  target?.setData?.({ [CHILD_DATA_KEYS.THEME]: appStore.themeSnapshot })
}

function onChildMounted(): void {
  loading.value = false
  failed.value = false
  pushTheme()
}

function onChildError(): void {
  loading.value = false
  failed.value = true
}

function retry(): void {
  loading.value = true
  failed.value = false
  // refreshKey 变化触发整页重建：micro-app 销毁后重新装载
  appStore.refresh()
}

watch(() => appStore.themeSnapshot, pushTheme, { deep: true })
</script>

<template>
  <div class="child-app">
    <div v-if="!registration" class="state">
      <AppIcon name="xCircle" :size="26" />
      <p>子应用「{{ appCode }}」未在注册表中登记，请检查菜单数据。</p>
    </div>

    <template v-else>
      <!-- 装载中 -->
      <div v-if="loading && !failed" class="state">
        <span class="spinner" />
        <p>正在装载「{{ registration.name }}」…</p>
        <p class="state__sub">micro-app iframe 沙箱 · {{ appUrl }}</p>
      </div>

      <!-- 装载失败：一般是子应用 dev server 没起，antd 的 a-result 承载错误态 -->
      <a-result v-if="failed" class="state state--error" status="warning" title="子应用装载失败">
        <template #subTitle>
          <p class="state__sub">请确认 soc-tools 已启动（pnpm dev:soc，端口 8002）</p>
        </template>
        <template #extra>
          <a-button type="primary" @click="retry">
            <template #icon><AppIcon name="refresh" :size="13" /></template>
            重试
          </a-button>
        </template>
      </a-result>

      <!--
        iframe 属性：Vite/ESM 子应用必须用 iframe 沙箱（with-sandbox 拦不住 ESM）
        destroy：切走即销毁，避免隐藏状态干扰下次装载
        router-mode="pure"：关闭子应用路由回写基座 URL。默认 search 模式会把子路由
        以 ?soc-tools=... 写进基座地址并派发原生 popstate，基座 router 跟着重导航，
        同一页面会裂成多个标签页；基座路径 → 子应用 hash 的映射我们自己做了，不需要它同步
      -->
      <micro-app
        v-if="!failed"
        ref="el"
        :name="appCode"
        :url="appUrl"
        iframe
        destroy
        router-mode="pure"
        @mounted="onChildMounted"
        @error="onChildError"
      />
    </template>
  </div>
</template>

<style scoped>
.child-app {
  /* 子应用视口高度：扣除顶栏 48 + 标签栏 40 + 内容区上下留白 */
  min-height: calc(100vh - 158px);
  display: flex;
}
micro-app {
  flex: 1;
  width: 100%;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.state {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px;
  padding: 60px 20px;
  color: var(--fg-muted);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}
.state p { font-size: 13px; color: var(--fg-sub); }
.state__sub { font-size: 11.5px; color: var(--fg-muted); font-family: var(--font-mono); }
.state--error :deep(svg) { color: var(--sev-critical); }
.state--error .btn { margin-top: 8px; }

.spinner {
  width: 26px; height: 26px;
  border-radius: 50%;
  border: 3px solid color-mix(in srgb, var(--primary) 20%, transparent);
  border-top-color: var(--primary);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
