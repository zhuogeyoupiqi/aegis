import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 基座构建配置
// 关键点：micro-app 是运行时自定义元素，必须告诉 Vue 模板编译器别把它当 Vue 组件
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
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 8000,
  },
})
