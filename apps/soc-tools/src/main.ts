import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// 与基座同源的 token / 基础样式：独立打开时走默认主题，被基座装载后由主题桥接管
import '@aegis/shared/styles/tokens.css'
import '@aegis/shared/styles/base.css'

createApp(App).use(router).mount('#app')
