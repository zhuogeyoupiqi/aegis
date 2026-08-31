/// <reference types="vite/client" />

// .vue 单文件组件的类型垫片（vue-tsc 原生支持，这里主要服务编辑器提示）
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
