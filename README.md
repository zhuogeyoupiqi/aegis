# Aegis 个人能力平台

微前端基座 + SOC 实战工具集。当前为 **MVP 第 1 周：纯前端验证版**，数据全部 mock，后端未接入。

## 目录结构

```
aegis/
├── apps/
│   ├── base/          # 基座：登录、布局壳、主题系统、动态菜单、子应用装载（端口 8000）
│   └── soc-tools/     # SOC 工具集子应用：Syslog 发包器（端口 8002）
├── packages/
│   ├── contract/      # 契约包：基座/子应用共享的常量与类型（零依赖）
│   └── shared/        # 共享层：设计 token 样式、工具函数、子应用主题桥
├── pnpm-workspace.yaml
└── package.json
```

## 快速开始

```bash
pnpm install        # 安装依赖（需 pnpm ≥ 9.5，支持 catalog）
pnpm dev            # 同时启动基座(8000) + 子应用(8002)
# 或分开启动
pnpm dev:base       # 仅基座
pnpm dev:soc        # 仅子应用
```

浏览器打开 http://localhost:8000 ，演示账号 `admin / 123456`。

## 第 1 周验证清单（对照方案文档 §7）

- [x] pnpm monorepo + catalog 统一依赖版本
- [x] `@aegis/contract` 契约包：APP_CODES / 主题快照 / 菜单结构等共享类型
- [x] 基座登录（mock，api 层封装，后端就绪后换 axios 零改组件）
- [x] 动态菜单（mock，菜单是 stub 重定向与侧栏渲染的唯一事实来源）
- [x] 主题系统：7 套主题色 × 明/暗 × 跟随系统 × 色弱/灰度（右上角「项目配置」抽屉）
- [x] 三种导航布局：侧边 / 顶部 / 混合（参考 Vben）
- [x] 侧边栏折叠（64px 图标态）
- [x] TagsView 多标签：切换 / 关闭 / 右键菜单（刷新、固定、关闭其他）/ 子应用识别色
- [x] **Vite 子应用 micro-app iframe 沙箱装载**（`/soc/syslog-sender`，基座路径映射子应用 hash 路由）
- [x] 基座 → 子应用主题同步（`setData` + 契约 key，切主题实时跟随）
- [x] Syslog 发包器：CEF/LEEF/JSON/KV 模板 + 变量插入 + 渲染预览 + 模拟发送终端

## 关键设计决策

| 决策 | 原因 |
| --- | --- |
| micro-app `iframe` 沙箱 | Vite/ESM 子应用无法被 with-sandbox 劫持，iframe 模式是官方推荐解法，且天然支持跨源 dev |
| 子应用 hash 路由 | iframe 沙箱下最稳的基座↔子应用路由联动方式：基座 `entry + #/path` 直接指定 |
| 设计 token 放 `@aegis/shared` | 基座与子应用 import 同一份 CSS，主题天然一致（monorepo L1 源码共享的直接收益） |
| 主题色全走 `color-mix()` 派生 | 换主题色只覆写 `--primary/--grad-1/--grad-2` 三个变量，全站生效 |
| 终端恒定深色 | SOC 长时间读日志的护眼刚需，不参与明暗切换 |
| api 层薄封装 mock | 组件只认 `@/api/*` 函数，后端就绪后替换实现即可 |
| 发送动作用 setInterval 模拟 | 后端就绪后换 SSE 事件监听（DatagramSocket 直发），交互与样式不动 |

## Mock 边界（后续替换点）

| 模块 | 当前 | 替换为 |
| --- | --- | --- |
| `apps/base/src/mock/auth.ts` | admin/123456 校验 | `POST /api/auth/login`（JWT） |
| `apps/base/src/mock/menu.ts` | 静态菜单 + 注册表 | `GET /api/menu`（按角色下发） |
| `apps/soc-tools/src/views/SyslogSender.vue` 发送循环 | setInterval 模拟 | 后端 DatagramSocket + SSE 回传 |

## 类型检查 / 构建

```bash
pnpm typecheck
pnpm build
```
