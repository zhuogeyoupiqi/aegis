import { createApp } from 'vue'
import { createPinia } from 'pinia'
import microApp from '@micro-zoe/micro-app'
import App from './App.vue'
import router from './router'
import { i18n } from './locales'

// 与子应用共用的设计 token / 基础样式（monorepo L1 源码共享）
import '@aegis/shared/styles/tokens.less'
import '@aegis/shared/styles/base.less'

// 启动微前端运行时：必须在渲染包含 <micro-app> 的组件之前调用
microApp.start()

createApp(App).use(createPinia()).use(router).use(i18n).mount('#app')
