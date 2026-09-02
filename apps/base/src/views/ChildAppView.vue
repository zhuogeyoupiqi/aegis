<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { APP_CODES, CHILD_DATA_KEYS, type AppCode, type AuthSnapshot } from '@aegis/contract'
import { useAppStore } from '@/stores/app'
import { useMenuStore } from '@/stores/menu'
import { useUserStore } from '@/stores/user'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const appStore = useAppStore()
const menuStore = useMenuStore()
const userStore = useUserStore()
const { t } = useI18n()

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

/**
 * 把基座侧的共享状态推给子应用：主题快照 + 界面语言 + 登录态 + 数据源模式。
 * mounted 事件后（子应用监听就绪）与任一状态变化时各调一次。
 *
 * 登录态显式下发 null（基座未登录时）：比漏发旧值诚实，子应用据此走未登录分支。
 *
 * 注意：micro-app 自定义元素通过 `data` 属性setter下发数据（不是 setData 方法），
 * 赋值后会进入事件中心，子应用 addDataListener 可收到；写错成 setData 会静默失败。
 */
function pushData(): void {
  const target = el.value as unknown as { data?: Record<string, unknown> } | null
  if (!target) return
  const auth: AuthSnapshot | null = userStore.token
    ? { token: userStore.token, user: userStore.userInfo! }
    : null
  target.data = {
    [CHILD_DATA_KEYS.THEME]: appStore.themeSnapshot,
    [CHILD_DATA_KEYS.LANG]: appStore.prefs.lang,
    [CHILD_DATA_KEYS.USER]: auth,
    [CHILD_DATA_KEYS.API_MODE]: appStore.prefs.apiMode,
  }
}

function onChildMounted(): void {
  loading.value = false
  failed.value = false
  pushData()
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

watch(() => appStore.themeSnapshot, pushData, { deep: true })
// 语言也随数据通道下发：基座切语言，已装载的子应用无需刷新即可跟随
watch(() => appStore.prefs.lang, pushData)
// 数据源模式同机制：基座设置抽屉切换，子应用下一次请求立即跟随
watch(() => appStore.prefs.apiMode, pushData)
// 登录/登出也重推：登出后子应用的 lastAuth 变 null，真实接口请求不再带旧 token
watch([() => userStore.token, () => userStore.userInfo], pushData, { deep: true })
</script>

<template>
  <div class="child-app">
    <div v-if="!registration" class="state">
      <AppIcon name="xCircle" :size="26" />
      <p>{{ t('child.unregistered', { code: appCode }) }}</p>
    </div>

    <template v-else>
      <!-- 装载中 -->
      <div v-if="loading && !failed" class="state">
        <span class="spinner" />
        <p>{{ t('child.loading', { name: registration.name }) }}</p>
        <p class="state__sub">micro-app iframe 沙箱 · {{ appUrl }}</p>
      </div>

      <!-- 装载失败：一般是子应用 dev server 没起，antd 的 a-result 承载错误态 -->
      <a-result v-if="failed" class="state state--error" status="warning" :title="t('child.loadFailed')">
        <template #subTitle>
          <p class="state__sub">{{ t('child.checkServer') }}</p>
        </template>
        <template #extra>
          <a-button type="primary" @click="retry">
            <template #icon><AppIcon name="refresh" :size="13" /></template>
            {{ t('child.retry') }}
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

<style scoped lang="less">
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

  p { font-size: 13px; color: var(--fg-sub); }

  &__sub { font-size: 11.5px; color: var(--fg-muted); font-family: var(--font-mono); }

  &--error {
    :deep(svg) { color: var(--sev-critical); }
    .btn { margin-top: 8px; }
  }
}

.spinner {
  width: 26px; height: 26px;
  border-radius: 50%;
  border: 3px solid color-mix(in srgb, var(--primary) 20%, transparent);
  border-top-color: var(--primary);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
