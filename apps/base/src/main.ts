import { createApp } from 'vue'
import { createPinia } from 'pinia'
import microApp from '@micro-zoe/micro-app'
import App from './App.vue'
import router from './router'

// 与子应用共用的设计 token / 基础样式（monorepo L1 源码共享）
import '@aegis/shared/styles/tokens.css'
import '@aegis/shared/styles/base.css'

// 启动微前端运行时：必须在渲染包含 <micro-app> 的组件之前调用
microApp.start()

createApp(App).use(createPinia()).use(router).mount('#app')
