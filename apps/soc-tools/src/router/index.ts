import { createRouter, createWebHashHistory } from 'vue-router'
import SyslogSender from '@/views/SyslogSender.vue'

// hash 路由：基座通过 entry + #/path 直接指定子应用内部路由，
// 避免 iframe 沙箱下 history 模式的路径同步问题
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/syslog-sender' },
    {
      path: '/syslog-sender',
      name: 'syslog-sender',
      component: SyslogSender,
      meta: { title: 'Syslog 发包器' },
    },
    // 后续工具（日志解析器等）在这里追加路由
    { path: '/:pathMatch(.*)*', redirect: '/syslog-sender' },
  ],
})

export default router
