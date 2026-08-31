import { createRouter, createWebHistory } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useMenuStore } from '@/stores/menu'
import { useUserStore } from '@/stores/user'
import LoginView from '@/views/LoginView.vue'
import MainLayout from '@/layouts/MainLayout.vue'

/**
 * 基座路由表。
 * meta 约定：title 存 i18n 词条 key；appCode 标记页面归属（标签着色用）；
 * menuPrefix=true 表示「该前缀下的页面是否真实存在由菜单数据决定」，
 * 守卫里据此把菜单标记为 stub 的入口重定向到统一占位页。
 */
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { title: 'route.login' } },
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: '', redirect: '/workbench' },
        {
          path: 'workbench',
          name: 'workbench',
          component: () => import('@/views/WorkbenchView.vue'),
          meta: { title: 'menu.items.workbench', appCode: 'base' },
        },
        {
          // soc 前缀全部交给子应用容器：把 /soc/xxx 映射为子应用 hash 路由 #/xxx
          path: 'soc/:rest(.*)*',
          name: 'soc-child',
          component: () => import('@/views/ChildAppView.vue'),
          meta: { title: 'menu.items.syslog-sender', appCode: 'soc-tools', menuPrefix: true },
        },
        {
          path: 'asset/:rest(.*)*',
          name: 'asset-stub',
          component: () => import('@/views/StubView.vue'),
          meta: { title: 'route.comingSoon', menuPrefix: true },
        },
        {
          path: 'ai/:rest(.*)*',
          name: 'ai-stub',
          component: () => import('@/views/StubView.vue'),
          meta: { title: 'route.comingSoon', menuPrefix: true },
        },
        {
          path: 'system/:rest(.*)*',
          name: 'system-stub',
          component: () => import('@/views/StubView.vue'),
          meta: { title: 'route.comingSoon', menuPrefix: true },
        },
        {
          path: 'coming-soon',
          name: 'coming-soon',
          component: () => import('@/views/StubView.vue'),
          meta: { title: 'route.comingSoon' },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/workbench' },
  ],
})

/**
 * 标签页路径规范化：只保留 path + 我们自己的语义 query（stub 页的 item/group 菜单 key）。
 * 基座 URL 可能被外部写入无关 query（如微前端路由同步的残留），若参与标签身份，
 * 同一页面会裂成多个标签——这里统一洗掉。
 */
export function normalizeTabPath(fullPath: string): string {
  const [pathAndQuery] = fullPath.split('#')
  const [path, search] = pathAndQuery.split('?')
  const source = new URLSearchParams(search ?? '')
  const kept = new URLSearchParams()
  if (source.get('item')) kept.set('item', source.get('item') as string)
  if (source.get('group')) kept.set('group', source.get('group') as string)
  const qs = kept.toString()
  return qs ? `${path}?${qs}` : path
}

/** 全局前置守卫：登录态校验 → 菜单兜底加载 → stub 入口重定向 → 标签页登记 */
router.beforeEach(async (to) => {
  const userStore = useUserStore()

  // 登录态守卫：无 token 一律回登录页
  if (to.path !== '/login' && !userStore.token) return '/login'
  if (to.path === '/login' && userStore.token) return '/workbench'

  // 刷新页面直达内部路由时菜单还没加载，先补拉
  if (to.path !== '/login') {
    const menuStore = useMenuStore()
    if (!menuStore.loaded) await menuStore.ensureLoaded()

    // stub 入口重定向到统一占位页：菜单数据决定哪个页面「真实存在」。
    // query 带菜单 key（而非文案）：文案由展示层查词条，切语言后仍正确
    if (to.matched.some((r) => r.meta.menuPrefix)) {
      const item = menuStore.findItem(to.path)
      if (item?.stub) {
        return { path: '/coming-soon', query: { item: item.key, group: item.groupKey } }
      }
    }
  }

  // 打开新页面时顺手把标签页记录上。标签标题存 i18n 词条 key：
  // 语言切换时 TagsView 重新 t() 即可跟随，无需改写已存标签
  const appStore = useAppStore()
  const itemKey = to.query.item as string | undefined
  const title = itemKey ? `menu.items.${itemKey}` : (to.meta.title as string | undefined)
  if (title && to.name !== 'login') {
    appStore.addTab({
      path: normalizeTabPath(to.fullPath),
      title,
      appCode: (to.meta.appCode as string) || 'base',
    })
  }
})

export default router
