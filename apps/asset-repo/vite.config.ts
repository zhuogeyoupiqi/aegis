import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

// 子应用构建配置（与 soc-tools 同配方）
// 关键点：
// 1. hash 路由 —— micro-app iframe 沙箱下最稳的路由模式（base 路径无法注入 history）
// 2. 生产 base 指向基座托管的静态路径 /child/asset-repo/，dev 时直连根路径
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
  base: process.env.NODE_ENV === 'production' ? '/child/asset-repo/' : '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 端口分配：8000 基座 / 8001 资产仓库 / 8002 soc-tools（方案文档 §3.1）
    port: 8001,
    // /api 转发到本地 aegis-server 8090（8080 被 miku/soc-web dev server 占用）
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
})
