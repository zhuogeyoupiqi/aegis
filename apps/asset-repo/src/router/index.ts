import { createRouter, createWebHashHistory } from 'vue-router'
import AssetRepoView from '@/views/AssetRepoView.vue'

// hash 路由：基座通过 entry + #/path 直接指定子应用内部路由，
// 避免 iframe 沙箱下 history 模式的路径同步问题
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'repo', component: AssetRepoView },
    // 后续页面（漏洞知识库等）在这里追加路由
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
