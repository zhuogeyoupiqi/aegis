import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 子应用构建配置
// 关键点：
// 1. hash 路由 —— micro-app iframe 沙箱下最稳的路由模式（base 路径无法注入 history）
// 2. 生产 base 指向基座托管的静态路径 /child/soc-tools/，dev 时直连根路径
export default defineConfig({
  plugins: [vue()],
  base: process.env.NODE_ENV === 'production' ? '/child/soc-tools/' : '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 8002,
  },
})
