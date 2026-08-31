import { createRouter, createWebHistory } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useMenuStore } from '@/stores/menu'
import { useUserStore } from '@/stores/user'
import LoginView from '@/views/LoginView.vue'
import MainLayout from '@/layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { title: '登录' } },
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: '', redirect: '/workbench' },
        {
          path: 'workbench',
          name: 'workbench',
          component: () => import('@/views/WorkbenchView.vue'),
          meta: { title: '工作台', appCode: 'base' },
        },
        {
          // soc 前缀全部交给子应用容器：把 /soc/xxx 映射为子应用 hash 路由 #/xxx
          path: 'soc/:rest(.*)*',
          name: 'soc-child',
          component: () => import('@/views/ChildAppView.vue'),
          meta: { title: 'Syslog 发包器', appCode: 'soc-tools', menuPrefix: true },
        },
        {
          path: 'asset/:rest(.*)*',
          name: 'asset-stub',
          component: () => import('@/views/StubView.vue'),
          meta: { title: '建设中', menuPrefix: true },
        },
        {
          path: 'ai/:rest(.*)*',
          name: 'ai-stub',
          component: () => import('@/views/StubView.vue'),
          meta: { title: '建设中', menuPrefix: true },
        },
        {
          path: 'system/:rest(.*)*',
          name: 'system-stub',
          component: () => import('@/views/StubView.vue'),
          meta: { title: '建设中', menuPrefix: true },
        },
        {
          path: 'coming-soon',
          name: 'coming-soon',
          component: () => import('@/views/StubView.vue'),
          meta: { title: '建设中' },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/workbench' },
  ],
})

router.beforeEach(async (to) => {
  const userStore = useUserStore()

  // 登录态守卫：无 token 一律回登录页
  if (to.path !== '/login' && !userStore.token) return '/login'
  if (to.path === '/login' && userStore.token) return '/workbench'

  // 刷新页面直达内部路由时菜单还没加载，先补拉
  if (to.path !== '/login') {
    const menuStore = useMenuStore()
    if (!menuStore.loaded) await menuStore.ensureLoaded()

    // stub 入口重定向到统一占位页：菜单数据决定哪个页面「真实存在」
    if (to.matched.some((r) => r.meta.menuPrefix)) {
      const item = menuStore.findItem(to.path)
      if (item?.stub) {
        return { path: '/coming-soon', query: { title: item.title, group: item.groupTitle } }
      }
    }
  }

  // 打开新页面时顺手把标签页记录上（标题优先取菜单语义，如 stub 的原始标题）
  const appStore = useAppStore()
  const title = (to.query.title as string) || (to.meta.title as string)
  if (title && to.name !== 'login') {
    appStore.addTab({
      path: to.fullPath,
      title,
      appCode: (to.meta.appCode as string) || 'base',
    })
  }
})

export default router
