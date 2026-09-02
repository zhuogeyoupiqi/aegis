import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { i18n } from './locales'

// 与基座同源的 token / 基础样式：独立打开时走默认主题，被基座装载后由主题桥接管
import '@aegis/shared/styles/tokens.less'
import '@aegis/shared/styles/base.less'

createApp(App).use(router).use(i18n).mount('#app')
