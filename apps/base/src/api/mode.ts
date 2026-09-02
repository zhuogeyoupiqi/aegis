import { useAppStore, type ApiMode } from '@/stores/app'

/**
 * 基座的数据源模式读取。
 *
 * 唯一真源是 appStore.prefs.apiMode（设置抽屉改它、localStorage 持久化它），
 * 基座自己的 api 层每次请求时来这里问——不留本地缓存，切完开关下一次请求立即生效。
 *
 * 与子应用（soc-tools）的区别：子应用收不到 pinia，模式由基座经 micro-app
 * 数据通道下发（见 @aegis/shared 的 useBaseThemeBridge），那边的 mode.ts 是另一套读取逻辑。
 */
export function getApiMode(): ApiMode {
  // api 调用都发生在用户交互/生命周期内，此时 pinia 已安装，直接取 store 即可
  return useAppStore().prefs.apiMode
}
