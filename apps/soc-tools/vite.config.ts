import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

// 子应用构建配置
// 关键点：
// 1. hash 路由 —— micro-app iframe 沙箱下最稳的路由模式（base 路径无法注入 history）
// 2. 生产 base 指向基座托管的静态路径 /child/soc-tools/，dev 时直连根路径
// 3. antd 按需自动导入：模板里直接写 a-xxx（函数式 API 如 message 仍需手动 import）
export default defineConfig({
  plugins: [
    vue(),
    Components({
      // importStyle: false —— antd v4 样式由 CSS-in-JS 运行时注入，
      // 不存在 per-component 样式文件，默认的 style/css 导入会 404
      resolvers: [AntDesignVueResolver({ importStyle: false })],
      dts: 'components.d.ts',
    }),
  ],
  base: process.env.NODE_ENV === 'production' ? '/child/soc-tools/' : '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 8002,
    // /api 转发到本地 aegis-server 8090（8080 被 miku/soc-web dev server 占用）
    // SSE 分块响应在 http-proxy 下正常透传
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
})
