import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

// 基座构建配置
// 关键点：
// 1. micro-app 是运行时自定义元素，必须告诉 Vue 模板编译器别把它当 Vue 组件
// 2. antd 按需自动导入：模板里直接写 a-xxx，无需手动 import（函数式 API 如 message 仍需手动 import）
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // micro-app 标签由 micro-app 运行时接管，Vue 只负责原样渲染
          isCustomElement: (tag) => tag === 'micro-app',
        },
      },
    }),
    Components({
      // importStyle: false —— antd v4 样式由 CSS-in-JS 运行时注入，
      // 不存在 per-component 样式文件，默认的 style/css 导入会 404
      resolvers: [AntDesignVueResolver({ importStyle: false })],
      // 生成组件类型声明，模板里的 a-xxx 才能通过 vue-tsc 检查
      dts: 'components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 8000,
    // /api 代理到后端 8090（与 soc-tools 的约定一致）。
    // 不用 8080：本机 miku/soc-web 的 dev server 长期占用它
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
})
