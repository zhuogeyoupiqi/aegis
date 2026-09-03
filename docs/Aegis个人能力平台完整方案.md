# Aegis 个人能力平台 · 完整产品与技术方案

> 版本：v1.5（2026-09-02）
> 变更：v1.5 asset-repo 资产仓库 MVP 落地（五类资产共表 asset_item、Shiki 静态高亮双栏检索台、mock/real 双轨、复制计数驱动排序、复制打点不打审计、基座 ChildAppView 前缀泛化 childPrefix）；v1.4 SA-Token 真实登录落地（登录/注销/拦截/BCrypt/登录日志）+ mock/real 收敛为全局数据源开关（登录页与设置抽屉双入口、单真源、切换重置会话）+ 样式层迁移 less；v1.3 新增「当前开发进度」快照（见下方），syslog 发包器后端联通（UDP+SSE+白名单+留痕）、前端 mock/real 双驱动切换；v1.2 §4 UI 规范整体切换为「浅色紫渐变 SaaS」基准（多主题色体系/明暗双主题/恒定深色终端/登录页规范）；v1.1 新增 2.4 前端工程化与构建策略（Turborepo 权衡）、2.5 部署方案设计；monorepo 结构新增 `@aegis/contract` 契约包；迭代规划纳入部署任务
>
> 技术栈基线：micro-app 微前端 + Vue3 + Vite（前端）｜Java + Spring Boot（后端）｜MySQL
>
> 第一原则：单人可落地、对 SOC 日常工作真实有用、为未来扩展预留能力。

---

## 📍 当前开发进度（2026-09-02 更新）

**当前阶段：MVP「发包器可用」+「真实登录」+「资产仓库」已达成（2026-09-02 asset-repo 前后端端到端验证通过），其余 MVP 项暂缓（过两天再说）。**

| 模块 | 状态 | 说明 |
|---|---|---|
| 前端基座（apps/base） | ✅ 完成 | 登录/动态菜单/iframe 沙箱/侧边折叠/标签页/主题系统（7 色+明暗+三布局）/国际化中英 |
| 共享包（packages/shared + contract） | ✅ 完成 | antd 主题桥接、theme/lang/auth/api-mode 数据通道、less 样式层（tokens/base）、工具函数、契约常量 |
| soc-tools：Syslog 发包器 UI | ✅ 完成 | 配置面板/模板编辑+变量插入/实时终端（sevLevel 着色/600 行上限）/白名单预检 |
| soc-tools：mock/real 双驱动 | ✅ 完成 | 模式由基座经数据通道下发（通道 > 自身 localStorage > `VITE_API_MODE` > mock）；页头只读徽标展示当前模式（开关已收敛到基座）；mock 保留不删 |
| 后端骨架（aegis-server） | ✅ 完成 | Maven 多模块模块化单体（common/framework/system/asset/soc/ai/admin），`mvn package` 通过 |
| 后端 syslog 模块 | ✅ 代码完成 | POST 建任务 → 线程池 UDP 直发 → SSE 实时回传（line/stats/done）→ soc_send_task 留痕；CIDR 白名单（sys_config 可配）；@AuditLog 审计切面 |
| 发包器「保存任务 + 发送历史」 | ✅ 完成 | 页头「保存任务」把当前表单存为配置预设（soc_send_preset）、「发送历史」抽屉两个页签（历史任务可复现/预设可载入删除）；mock 模式同构落 localStorage |
| 10 张核心表 | ✅ 完成 | schema.sql 幂等建表 + data.sql 种子（白名单配置/4 套内置模板/4 条资产种子），启动自动初始化（已验证） |
| 发包器端到端联调 | ✅ 完成 | 已验证：API 建任务 → UDP 实发（nc 实收逐条报文）→ SSE 事件流（含断线补播）→ 留痕落库（soc_send_task + sys_op_log）→ 白名单拦截外网目标；前端经 vite 代理走通全链路 |
| SA-Token 真实登录 + 全局数据源 | ✅ 完成 | 后端：SA-Token 1.46 拦截 `/api/**`（白名单仅 login 与 SSE）、BCrypt 密码（admin/123456，幂等迁移老库占位串）、sys_login_log 成败都留痕、审计 operator 从会话取登录名（logout 场景回退发起时快照）。前端：mock/real 全局开关（默认 mock，不启后端可完整操作平台），**登录页与设置抽屉双入口、单真源 prefs.apiMode**（登录前可选模式，避免"想用真实接口得先 mock 登录绕一圈"；切换即重置会话回登录页，保证会话永远属于当前数据源），经 micro-app 数据通道下发子应用（发包器页头按钮已移除，改只读徽标）；登录态 token 同通道下发，子应用 A0401 只 toast 不跳转（路由权在基座）。curl 全链路已验证（登录/错密码同文案 B0101/防枚举、裸 token 拦截、logout 后失效、SSE 豁免、operator=admin 落库） |
| asset-repo 资产仓库 | ✅ 完成 | 后端：asset_item 单表五类共表（snippet/component/function/doc/link，type 判别），检索 = LIKE 三列模糊 + FIND_IN_SET 标签精确，排序 copy_count 降序（使用频率），复制计数端点 setSql 原子自增且**不打审计**（读语义防刷爆 op_log），标签服务端小写去重（>8 拒绝）。前端：apps/asset-repo 子应用（8001），双栏检索台（左列表右详情常驻）、Shiki 静态高亮（github-light/dark 随主题通道切换）、编辑 textarea（Monaco 后续）、复制走剪贴板 API + execCommand 兜底、标签点选即筛选；mock 走 localStorage（种子与 data.sql 同构，**保留不删**）、real 走 /api/asset/items。curl 全链路已验证（过滤/CRUD/计数自增/A0401/审计 operator=admin） |
| Docker 部署（compose + deploy.sh） | ⏸ 暂缓 | 开发环境即可用：`java -jar` 起后端 8090，vite 代理 `/api` |

**架构落点补充（实现与 §2/§5.2 的差异，均为实现期决策）**：
1. 后端端口 **8090**（8080 被本机 miku/soc-web dev server 长期占用）；
2. 模板渲染完全留在前端（§2.2.3 边界的严格执行）：前端把整批渲染好的报文列表 `payloads` 一次性上送，后端逐条进 UDP 包——线上内容与终端展示必然一致，条数即列表长度，不再单独传 `count`；
3. SSE 订阅为 GET，前端直接用原生 `EventSource`（§5.2 提到"不要用 EventSource"针对的是 POST 建 SSE 的设计，本实现无此限制）；
4. 登录实现与 §2.3.2 设想的差异：token 走 `Authorization: Bearer` 请求头（基座/子应用 iframe 跨源，cookie 通道天然不可用，§2.3.2 的双 token 无感刷新暂不落地——当前单 token 7 天有效，内存会话重启失效重新登录一次即可，接 Redis 时再评估）；未登录统一走 **HTTP 200 + code A0401**（不单独用 HTTP 401，保持 Result 风格单一）；SSE 端点豁免鉴权（EventSource 无法自定义请求头，taskId 雪花不可枚举）；mock/real 数据源开关为**登录页 + 设置抽屉双入口、单真源 `prefs.apiMode`**，切换即重置会话回登录页。
5. 资产库与 §5.3 全量愿景的差距（均为 MVP 口径 §7 的刻意裁剪）：五类资产**共一张 `asset_item` 表**（§5.3 的 asset_version 版本表、@vue/repl 在线预览、Meilisearch 全文检索、Monaco 编辑器均属后续阶段）；基座 `ChildAppView` 的子应用路径映射从 `/^\/soc/` 硬编码泛化为路由 meta `childPrefix`（/soc、/asset 各自声明）——此后新子应用接入只改路由表 + 注册表两处，装载视图零改动。

---

---

## 一、顶层产品定位与长期目标

### 1.1 一句话定位

> **一套以自研 micro-app 微前端底座为骨架、以 SOC 实战工具为拳头、以个人知识资产为沉淀、以 AI 为神经的个人能力操作系统（Personal Capability OS）。**

代号 **Aegis**（宙斯盾，SOC 属性天然契合），备选 OpsDeck / Nexus。以下统一用 Aegis。

### 1.2 它到底是什么（纠正一个定位偏差）

零散想法里有"微前端底座""资产仓库""syslog 工具"三个东西，容易做成三个平行工具。正确的关系是**分层关系**：

```
┌─────────────────────────────────────────────┐
│  拳头层：SOC 工具集 + AI 能力   ← 天天用，产生价值    │
├─────────────────────────────────────────────┤
│  血肉层：个人资产仓库            ← 沉淀经验，产生复利  │
├─────────────────────────────────────────────┤
│  骨架层：micro-app 微前端底座    ← 承载一切，产生能力  │
└─────────────────────────────────────────────┘
```

底座不是产品，是"让工具和资产可以无限长出来的地基"；资产库不是仓库，是"工具使用经验沉淀的回路"。三者闭环：**用工具干活 → 沉淀资产 → 资产反哺工具（组件发布回底座共享层）→ AI 串联全程**。

### 1.3 核心价值（三层）

| 价值层 | 内容 | 如何验证做到了 |
|---|---|---|
| 效率价值 | SOC 工作/开发工作当天提效：syslog 调试不用翻旧脚本、代码片段不用翻聊天记录 | 工作中每天打开 ≥3 次 |
| 资产价值 | 组件、片段、Playbook、Prompt 全部结构化沉淀，可检索可复用 | 半年后能靠搜索找到 90% 的历史沉淀 |
| 能力价值 | 完整走通微前端 + 全栈 + AI 工程化，形成架构师作品集 | 可对外开源/写文章/面试讲解 |

### 1.4 为谁服务

- **第一用户**：自己（SOC 安全运营工程师 + 前端工程师）。所有设计决策先服务自己，不做多人协同的过度设计。
- **顺带受益**：团队同事（分享链接、导出工具）；远期开源社区（安全工程师/前端工程师群体）。

### 1.5 短中长期路线

| 阶段 | 时间 | 主题 | 完成标志 |
|---|---|---|---|
| 短期 | 0–3 月 | **自用提效工具**：底座跑通 + syslog 发包器 + 资产库基础版 | 日常工作真实在用，替代旧脚本/记事本 |
| 中期 | 3–6 月 | **日常工作主入口**：完整交互体验（TagsView/布局/主题/Ctrl+K）+ AI 三个杀手场景 + SOC 工具集扩充 | 打开浏览器第一个开的页面是 Aegis |
| 长期 | 6–12 月+ | **可开源的平台**：组件共享生态、RAG、Agent/MCP、子应用脚手架、SOC 态势首页 | GitHub 可开源、他人可按规范接入子应用 |

**解决碎片化的总纲**：以后每冒出一个新想法，先问三个问题——它是工具（放 SOC 工具集/新子应用）、是资产（放资产库）、还是底座能力（放基座）？三问归类，想法再多也不会乱。

---

## 二、整体系统架构设计

### 2.1 前端整体架构（micro-app 微前端底座）

#### 2.1.1 总体拓扑

```
                     ┌──────────────────────────────────────┐
                     │        基座 Base（Vue3 + Vite）          │
                     │  登录认证 / 动态菜单 / 路由分发 / TagsView  │
                     │  主题系统 / 全局布局 / 权限指令 / 错误兜底    │
                     │  全局通信总线 / 应用注册中心 / Ctrl+K 面板   │
                     └───┬─────────┬─────────┬─────────┬─────┘
                         │         │         │         │
                    <micro-app> <micro-app> <micro-app> <micro-app>
                         │         │         │         │
                   ┌─────┴────┐ ┌──┴─────┐ ┌┴────────┐ ┌┴────────┐
                   │asset-repo│ │soc-tools│ │ai-studio│ │system-  │
                   │ 资产仓库  │ │SOC 工具集│ │AI 工作台 │ │admin 设置│
                   └──────────┘ └────────┘ └─────────┘ └─────────┘
                         └────┬────┴────┬────┴────┬────┘
                        ┌─────┴─────────┴─────────┴─────┐
                        │  pnpm monorepo 共享层（见 2.1.3）  │
                        │  contract / shared / ui / …      │
                        └────────────────────────────────┘
```

#### 2.1.2 基座与子应用划分策略

**基座只做 8 件事**（多做一件事都是过度设计）：认证与用户态、动态菜单与路由映射、子应用加载/预加载/保活/销毁、全局通信、主题与布局、TagsView、权限指令、全局错误兜底。**基座不写任何业务功能。**

**子应用按业务域划分，个人项目 4 个起步、上限 7 个**（拆太细只有成本没有收益）：

| 子应用 | 域 | 说明 |
|---|---|---|
| asset-repo | 知识资产 | 组件/片段/文档/Playbook |
| soc-tools | SOC 工具 | 发包器/解析器/编码/IOC 等 |
| ai-studio | AI | 会话、Prompt 库、Copilot 容器 |
| system-admin | 系统 | 用户/菜单/配置/日志 |
| （预留）dashboard | 态势 | 三期 SOC 态势大屏首页 |
| （预留）任意新工具 | — | 按接入规范新增，不动基座 |

**接入规范**（为"未来新增子应用预留能力"的核心）：新子应用 = 1 份约定文件（生命周期挂载/卸载、路由 base、菜单注册清单 JSON）+ 基座配置表加一行。菜单、权限、图标全部配置驱动，从后端下发。

#### 2.1.3 【组件共享问题】最优落地方案（重点，详见五.1）

先给结论：**不做单一方案，做"三层共享体系"，主力是 monorepo 源码共享**。

| 层 | 机制 | 覆盖场景 | 占比 |
|---|---|---|---|
| L1 源码共享 | pnpm monorepo 内部包（@aegis/shared、@aegis/ui），子应用构建时源码级引用 | 工具函数、hooks、请求实例、90% 业务组件 | ~85% |
| L2 运行时注册 | 基座维护共享注册表 + micro-app 全局数据下发 | 全局单例（axios 实例、用户态、主题）+ 资产库"一键发布"的动态组件 | ~10% |
| L3 Web Components | Vue3 `defineCustomElement` 封装 | 极少数需跨框架复用的高价值组件（如通用 CRUD 表格） | ~5% |

关键洞察：**个人 monorepo 下，所有子应用永远引用同一份共享源码，天然不存在"多版本漂移"——这直接消解了微前端共享最头疼的版本治理问题**（这正是 npm 发包 / Module Federation shared 要花大量精力解决的东西）。

> 技术事实提醒（已核实）：Vite 子应用产出 ESM，micro-app 默认的 with 沙箱无法拦截，**1.0 起官方为 Vite 提供了 iframe 沙箱方案**，接入时子应用需启用 iframe 沙箱模式。这是 Vite 技术栈下绕不开的第一个坑，MVP 第一周就会遇到，提前列入验证清单。

#### 2.1.4 公共依赖与公共组件仓库设计（monorepo 完整结构）

```
aegis/
├── apps/
│   ├── base/              # 基座（dev 端口 8000）
│   ├── asset-repo/        # 子应用：资产仓库（8001）
│   ├── soc-tools/         # 子应用：SOC 工具集（8002）
│   ├── ai-studio/         # 子应用：AI 工作台（8003）
│   └── system-admin/      # 子应用：系统设置（8004）
├── packages/
│   ├── contract/          # ★ 契约包（零依赖）：微前端通信事件名常量、
│   │                      #   全局数据结构类型、权限码枚举、路由命名规范
│   │                      #   —— 基座与所有子应用共同依赖的"协议"，防止魔法字符串散落
│   ├── shared/            # 纯逻辑：utils/hooks/请求封装/枚举/类型（依赖 contract）
│   ├── ui/                # 业务组件：查询表单生成器、高级表格、描述列表…
│   ├── ui-elements/       # defineCustomElement 封装的跨框架组件
│   └── config/            # eslint / tsconfig / vite 预设配置
├── deploy/                # ★ 部署产物（nginx 配置、docker-compose、deploy.sh）
├── pnpm-workspace.yaml    # workspace 定义 + catalog 统一依赖版本
└── package.json           # 根脚本：dev / build / lint（见 2.4）
```

三个工程化要点：

1. **契约包独立**：`@aegis/contract` 零依赖、只含常量和类型，是"基座 ⇄ 子应用 ⇄ 后端"之间的协议层。事件名（如 `THEME_CHANGE`）、权限码（`asset:add`）集中定义，改协议只动一个包。
2. **pnpm catalog 统一依赖版本**：`pnpm-workspace.yaml` 中用 `catalog:` 声明 vue/antdv/vite 等版本，所有子应用引用 `catalog:`——**这是单人 monorepo 下比 Turborepo 更先该上的"一致性"基础设施**（见 2.4）。
3. **基础库共享（vue/antdv/dayjs 只加载一次）**：二期通过 **import map 指向自托管路径**（不是公网 CDN——SOC 环境常在内网/受限网络，公网 CDN 是不可用项），子应用 Vite 构建时 external。MVP 阶段**不做**，各子应用自带依赖即可（micro-app 样式隔离下重复加载可接受，先跑通再优化）。

### 2.2 后端 SpringBoot 架构设计

#### 2.2.1 分层与模块划分（模块化单体）

**明确取舍：不上微服务、不上网关**。采用 Maven 多模块的模块化单体（modular monolith）——类比前端：就像 monorepo 里多个包但一次构建部署，保留未来拆分能力。

```
aegis-server/
├── aegis-common/       # Result<T>、全局异常、常量、工具类
├── aegis-framework/    # SA-Token 认证、审计日志、跨域、MyBatis-Plus 配置
├── aegis-system/       # 用户/角色/菜单/字典/配置/操作日志
├── aegis-asset/        # 资产仓库：组件/片段/文档/标签
├── aegis-soc/          # SOC 工具：syslog 发包、解析模板、IOC 查询代理
├── aegis-ai/           # AI 网关：多模型适配、SSE、Prompt 模板、（三期）RAG/Agent
└── aegis-admin/        # 启动聚合模块（唯一含 main 的模块）
```

每模块内部固定四层：`Controller（只做参数校验和转发）→ Service（业务逻辑）→ Mapper（MyBatis-Plus）→ DO/VO`。

认证选型（学习期友好优先）：

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| **SA-Token** | API 直白（一行登录/鉴权/踢人），中文文档全，内置双 token | 不是"行业标准"关键词 | **推荐**：学习期一周能上手，概念少 |
| Spring Security | 行业标准，面试加分，过滤器链功底 | 概念重（FilterChain/Provider/Context），学习曲线陡 | 二期后可对照重构理解，不急于上 |

#### 2.2.2 数据库设计思路

- **通用字段约定**（所有表强制）：`id（雪花算法）、create_time、update_time、create_by、deleted（逻辑删除）、version（乐观锁）`——类比前端：相当于所有组件共同遵守的 props 基础协议。
- **命名**：库表/字段 snake_case，Java 字段 camelCase（MyBatis-Plus map-underscore 自动映射）。
- **核心表清单**：

| 域 | 表 | 要点 |
|---|---|---|
| 系统 | sys_user / sys_role / sys_menu / sys_config / sys_dict | sys_menu 树形结构，含 `app_code + route_path + component` 字段，**支撑微前端菜单动态下发** |
| 资产 | asset_item / asset_category / asset_tag / asset_version / asset_file | asset_item 用 `type` 区分 组件/片段/函数/文档/链接；版本表存 diff 基线 |
| SOC | soc_send_task / soc_send_template / soc_parse_template | 发包任务留存（复现当时怎么测的）、CEF 等模板 |
| AI | ai_provider / ai_conversation / ai_message / ai_prompt_template / ai_usage_log | **密钥只存后端**；usage_log 做 token 成本统计 |
| 审计 | sys_op_log / sys_login_log | SOC 从业者的职业本能：操作留痕 |

#### 2.2.3 后端能力边界

后端只做四类事：**数据持久化、统一认证、AI 代理（密钥与流式）、浏览器做不了的事（UDP 发包、文件落盘、外联情报源代理）**。其余全部前端做——不要让后端长出模板渲染之类的奇怪职责。

### 2.3 前后端交互、权限体系、存储设计

**交互协议**：

| 通道 | 用途 |
|---|---|
| REST + 统一 `Result<T>` | 常规 CRUD |
| **SSE** | AI 流式输出、syslog 发包进度实时回传 |
| WebSocket（二期） | 本地日志监听回显、AI Agent 执行日志 |

- 双 token 无感刷新：`accessToken`（短）+ `refreshToken`（长），axios 拦截器 401 时静默续期；类比前端：就是路由守卫 + 请求拦截器的组合拳。
- 微前端下的关键细节：**token 只存在基座**，子应用通过 micro-app 全局数据拿到注入的请求实例/用户态，禁止子应用各自管 token（否则登出、续期会失控）。

**权限体系（RBAC 三层）**：

| 层 | 机制 | 类比 |
|---|---|---|
| 菜单/路由权限 | 后端按角色下发菜单树 → 基座动态注册路由 | Vue Router 动态路由 `addRoute` |
| 接口权限 | SA-Token 注解 `@SaCheckPermission("asset:add")` | 路由守卫 |
| 按钮权限 | 自定义 `v-permission` 指令 | `v-if` 的全局版 |

**存储设计**：

| 存储 | 用途 | 阶段 |
|---|---|---|
| MySQL 8 | 全部业务数据 + 资产元数据 | MVP |
| 本地磁盘（约定目录） | 组件源码附件、图片、demo 文件 | MVP |
| Redis | 会话、缓存、验证码 | 二期（MVP 用 SA-Token 内存/本地存储顶住） |
| MinIO | 对象存储（替换本地磁盘） | 二期可选 |
| Meilisearch | 资产全文检索 | 二期（MVP 用 MySQL LIKE + 标签） |

### 2.4 前端工程化与构建策略（Turborepo 权衡）★

#### 2.4.1 Turborepo 到底解决什么

Turbo 的四大能力：**按依赖拓扑编排任务**（build/lint/dev 声明式 pipeline）、**本地构建缓存**（输入不变直接回放产物）、**远程缓存**（团队/CI 共享缓存，核心价值所在）、**统一任务入口**。

#### 2.4.2 对照本项目的场景特点

- **单人开发**：无团队协作，远程缓存收益趋近于零；
- **应用规模**：4–6 个 Vite 应用 + 4 个包，单个 Vite 构建秒级～十几秒，全量 build 不构成痛点；
- **共享包源码直出**：workspace 内 `@aegis/*` 直接引源码，**没有"包预构建"环节——turbo 缓存的主战场在本项目不存在**；
- **dev 场景**：micro-app 开发时通常只起"基座 + 当前开发的 1 个子应用"（全起 5 个 Vite 进程反而费内存），`pnpm --filter` 原生够用。

#### 2.4.3 对比与结论

| 维度 | 纯 pnpm workspace | + Turborepo |
|---|---|---|
| 依赖管理/link | ✅ | ✅（底层还是 pnpm） |
| 并行执行脚本 | `pnpm -r --parallel` | ✅ 日志聚合更好看 |
| 构建缓存 | ❌ | ✅ 本地缓存 |
| 远程缓存/CI 提速 | ❌ | ✅（单人收益小） |
| 依赖拓扑感知 | 需自己排 `--filter` 顺序 | ✅ 声明 pipeline |
| 对"源码直出共享包"的价值 | — | 小（无预构建可缓存） |
| 学习/维护成本 | 零 | turbo.json + 一层心智模型 |

**结论：MVP 不引入 Turborepo，用 pnpm 原生 + catalog + 几条 workspace 脚本。**

替代方案补齐 turbo 在本场景下真正有价值的部分：

```yaml
# pnpm-workspace.yaml —— catalog 统一依赖版本（先于 turbo 的"一致性"价值）
packages:
  - 'apps/*'
  - 'packages/*'
catalog:
  vue: ^3.5.0
  'ant-design-vue': ^4.2.0
  vite: ^6.0.0
  pinia: ^2.3.0
```

```json
// 根 package.json scripts —— 覆盖日常全部场景
{
  "scripts": {
    "dev": "pnpm --filter @aegis/base --filter @aegis/soc-tools dev",
    "dev:all": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint"
  }
}
```

**引入 Turborepo 的触发条件（满足任一即可加，届时成本约半天）**：
1. 全量 `build` 超过 1 分钟，且频繁构建；
2. 上 CI（GitHub Actions）且构建排队影响体验；
3. 开源后出现外部贡献者（多人协作需要远程缓存与任务规范）。

> 顺带对比：Nx 功能更强（代码生成、插件体系）但更重、更"有主见"，与本项目"不过度设计"原则冲突，不考虑。

### 2.5 部署方案设计（Docker Compose）★

#### 2.5.1 部署形态选型

| 形态 | 适用 | 结论 |
|---|---|---|
| 裸机 systemd + nginx + 手装 MySQL | 最简单 | 环境漂移、迁移服务器痛苦，放弃 |
| **Docker Compose（推荐）** | 单机个人平台 | 一份 `docker-compose.yml` 描述全部基础设施，一键起停、可复制、可迁移；将来开源给别人 demo 也是 `docker compose up` 最友好 |
| K8s | 集群、多实例 | 个人平台纯过度设计，**明确不做** |

#### 2.5.2 生产部署架构

```
用户浏览器
   │
   ▼
Nginx (:80/:443)
 ├── /                → 基座静态产物（SPA, try_files 兜底）
 ├── /child/*         → 各子应用静态产物（同域不同路径）
 └── /api/*           → 反代 aegis-server:8080
                          ├─ SSE：proxy_buffering off（关键！）
                          └─ WS：Upgrade 头透传（二期）
docker-compose 服务群：
  ├── nginx          # 前端静态产物 volume 挂载
  ├── aegis-server   # Spring Boot（多阶段构建的 jre 镜像）
  ├── mysql:8        # 数据卷持久化
  ├── [二期] redis / meilisearch / minio
  └── [可选] ollama  # 本地大模型，敏感数据不出网
```

#### 2.5.3 关键决策与配置

**决策 1：子应用与基座同域不同路径部署（强烈推荐）**

- 方案：基座在 `/`，子应用在 `/child/soc-tools/` 等路径，子应用 Vite 构建配 `base: '/child/soc-tools/'`；
- 理由：彻底规避跨域、cookie、micro-app 跨域加载配置问题；内网环境免证书麻烦；
- 反方案（多端口/多域名）要配 CORS、micro-app url 逐环境维护，收益为零，不做。

**决策 2：子应用地址走后端配置下发**

开发环境子应用在 `localhost:800x`，生产在 `/child/xxx/`——两套地址不要打进前端构建产物。应用注册信息（名称/入口 URL/激活规则）存 `sys_config`，基座启动时拉取。**改地址不发版**，这也是"应用注册中心"的实现基础。

**Nginx 核心配置（deploy/nginx/conf.d/aegis.conf）**：

```nginx
server {
    listen 80;
    server_name _;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    # ---------- 前端：基座 ----------
    location / {
        root /usr/share/nginx/html/base;
        # SPA history 路由兜底
        try_files $uri $uri/ /index.html;
    }

    # ---------- 前端：子应用（同域路径，规避跨域） ----------
    location /child/soc-tools/ {
        alias /usr/share/nginx/html/child/soc-tools/;
        try_files $uri $uri/ /child/soc-tools/index.html;
    }
    location /child/asset-repo/ {
        alias /usr/share/nginx/html/child/asset-repo/;
        try_files $uri $uri/ /child/asset-repo/index.html;
    }
    # 其余子应用同构，后续由脚手架生成

    # ---------- 后端 API ----------
    location /api/ {
        proxy_pass http://aegis-server:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # SSE 关键：关闭缓冲并放长超时，否则 AI 流式输出/发包实时日志会被 nginx 攒住
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;

        # WebSocket（二期本地日志监听）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**docker-compose（deploy/docker-compose.yml）**：

```yaml
services:
  nginx:
    image: nginx:1.27-alpine
    ports:
      - '80:80'
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./web:/usr/share/nginx/html:ro   # 前端各应用构建产物按 base/ child/ 目录摆放
    depends_on:
      - aegis-server

  aegis-server:
    build:
      context: ../aegis-server
    expose:
      - '8080'                            # 只暴露给内部网络，不经 nginx 直连不了
    environment:
      SPRING_PROFILES_ACTIVE: prod
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/aegis?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai
      SPRING_DATASOURCE_USERNAME: aegis
      SPRING_DATASOURCE_PASSWORD: ${DB_PASSWORD}   # 从 .env 注入，不进 git
    depends_on:
      - mysql

  mysql:
    image: mysql:8.4
    volumes:
      - mysql-data:/var/lib/mysql
    environment:
      MYSQL_DATABASE: aegis
      MYSQL_USER: aegis
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}

volumes:
  mysql-data:
```

**后端镜像（多阶段构建，aegis-server/Dockerfile）**：

```dockerfile
# 阶段一：构建（Maven + JDK21）
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY . .
# -pl aegis-admin -am：只构建启动模块及其依赖模块
RUN mvn -pl aegis-admin -am package -DskipTests

# 阶段二：运行（仅 JRE，镜像更小）
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/aegis-admin/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

#### 2.5.4 发布流程（deploy/deploy.sh）

```bash
#!/usr/bin/env bash
# 一键发布：构建前端 → 摆放产物 → 构建后端镜像 → 拉起服务
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

echo "==> 1/4 构建前端（基座 + 子应用）"
pnpm -r build

echo "==> 2/4 摆放静态产物到 deploy/web"
rm -rf deploy/web && mkdir -p deploy/web/child
cp -r apps/base/dist                deploy/web/base
cp -r apps/soc-tools/dist           deploy/web/child/soc-tools
cp -r apps/asset-repo/dist          deploy/web/child/asset-repo
cp -r apps/system-admin/dist        deploy/web/child/system-admin
cp -r apps/ai-studio/dist           deploy/web/child/ai-studio

echo "==> 3/4 构建后端镜像"
docker compose -f deploy/docker-compose.yml build aegis-server

echo "==> 4/4 拉起服务"
docker compose -f deploy/docker-compose.yml up -d
echo "==> 完成：http://<服务器IP>/"
```

环境矩阵：

| 环境 | 前端 | 后端 | 基础设施 |
|---|---|---|---|
| 开发（本机） | Vite dev 多端口（基座 8000，子应用 800x） | IDEA 本地起 | MySQL 本机 Docker 单容器 |
| 生产（服务器/工作机） | Nginx 静态产物 | aegis-server 容器 | docker-compose 全家桶 |

CI/CD：MVP 用 `deploy.sh` 手动一条命令（单人项目足够）；三期开源化时上 GitHub Actions（构建镜像推 GHCR → 服务器拉取重启），不提前做。

#### 2.5.5 数据备份（个人资产平台的 P0，不可省）

资产库是个人知识资产，**丢库 = 最大损失**，备份从 MVP 第一天就要有：

```bash
# cron 每日凌晨 2 点：MySQL 全量 + 资产附件目录，保留 14 份
0 2 * * * docker exec aegis-mysql mysqldump -uaegis -p"$DB_PASSWORD" aegis | gzip > /backup/aegis-db-$(date +\%F).sql.gz && tar czf /backup/aegis-files-$(date +\%F).tar.gz /data/aegis/files && find /backup -name "aegis-*" -mtime +14 -delete
```

策略：本地保留 14 份 + 每周一份同步到异地（对象存储/网盘/另一台机器，二期内置到系统设置的"备份管理"页面）。

---

## 三、完整功能模块拆解

### M1 微前端底座能力模块

| 一级功能 | 二级功能点 | 说明 |
|---|---|---|
| 应用管理 | 应用注册/启停、健康检查、预加载策略、加载耗时统计 | 配置驱动：菜单→路由→子应用映射存后端 |
| 动态菜单 | 远程菜单下发、图标管理、菜单搜索过滤、拖拽排序 | 新增子应用不改基座代码 |
| 生命周期 | 预加载（空闲时）、keep-alive 保活、卸载回收、崩溃兜底页 | 子应用白屏不影响基座和其他子应用 |
| 全局通信 | 数据总线（用户/主题/语言）、事件订阅、跨应用跳转 API | `useAppBridge()` 统一封装，事件名集中在 `@aegis/contract` |
| 组件共享 | 共享注册中心、组件版本查看、资产库一键发布到共享层 | 见五.1/五.3，平台特色 |
| 主题系统 | 暗黑/亮色、主题色切换、圆角/密度偏好、主题持久化 | CSS 变量驱动，子应用自动跟随 |
| 错误监控 | 全局 error 上钩、子应用加载失败重试、错误日志落库 | 三期加性能指标 |

### M2 个人开发资产仓库模块

| 一级功能 | 二级功能点 | 说明 |
|---|---|---|
| 组件管理 | 组件 CRUD（源码+demo+props 文档）、在线实时预览、一键复制、版本历史 diff、标签分类 | 预览方案见五.3 |
| 代码片段 | 片段管理、Shiki 高亮、全文搜索、常用置顶、复制计数 | "复制次数"自动排序出高频片段 |
| 工具函数库 | 函数+用法示例、在线运行验证（playground）、TS 类型展示 | 函数带可执行 demo 才敢复用 |
| 知识文档 | Markdown 编辑、目录树、附件、全文搜索 | SOC 排查笔记、架构笔记安身处 |
| 链接剪藏 | 网址收藏+摘要+标签、失效检测 | 替代浏览器书签的散乱 |
| 模板库 | 项目模板、代码模板（axios 拦截器、Pinia store 骨架…） | 新项目 30 秒起步 |
| Playbook 库 | 应急响应 SOP、checklist 勾选进度、按事件类型归档 | **SOC 专属：处置经验结构化** |
| 检索体系 | 标签体系、关键词搜索（MVP）→ Meilisearch（二期）→ AI 语义搜索（三期） | 沉淀的价值 = 能否被找回 |

### M3 SOC 安全运营工具集模块

| 一级功能 | 二级功能点 | 说明 |
|---|---|---|
| **syslog 发包器** | UDP/TCP 发送、CEF/LEEF/JSON/key-value 模板、变量填充（时间戳/随机 IP/自增序号）、批量+速率控制、实时发送日志、任务保存复现 | 核心拳头，见五.2 |
| 告警样本工场 | 按 SIEM 场景生成模拟告警（暴力破解/扫描/挖矿…）、一键组合发包器 | 发包器+样本库 = 告警规则验证演练闭环 |
| 日志解析器 | 正则/Grok 风格解析调试、实时高亮命中、解析模板保存、格式转换（CEF↔JSON） | 写解析规则不用再开在线工具 |
| IOC 处理 | IP/域名/Hash 批量去重校验、情报源聚合查询（VT/微步等，自配 Key）、IOC 备注归档 | 后端代理外联，Key 不落前端 |
| IP 工具 | CIDR 子网计算、进制转换、内网段判断（10/172.16-31/192.168 及自定义）、地理归属查询 | |
| 编码解码 | Base64/32/Hex/URL、JWT 解码、时间戳、Unicode、大小写/驼峰转换 | 开发+安全双用 |
| 加解密 | 哈希计算（MD5/SHA 系列）、AES/RSA 演示、随机密码/密钥生成、密码强度 | |
| 正则测试器 | 实时匹配高亮、分组捕获展示、性能提示 | |
| 文本处理 | JSON 格式化/压缩/校验、CSV↔JSON、文本 diff、去重排序 | |
| CVE 查询 | 关键词/CVE 编号查询（NVD API）、收藏关注列表 | 周报素材 |
| 报表助手 | 周报/月报模板、数据占位、导出 Markdown/Word | 三期与 AI 打通自动生成 |

### M4 系统基础交互模块

| 一级功能 | 二级功能点 | 说明 |
|---|---|---|
| 布局系统 | 侧边/顶部/混合三种布局、菜单折叠（含悬浮模式）、菜单宽度调节、布局持久化 | 见四.3 |
| TagsView | 多标签、右键菜单（刷新/关闭/关其他/关所有/固定/在新窗口打开）、拖拽排序、超量折叠、刷新保活、脏表单关闭确认 | 见四.3 改进点 |
| 全局命令面板 | Ctrl+K 统一搜索：菜单/资产/工具/AI 指令、最近访问 | 高级感与效率的核心交互 |
| 通知中心 | 站内消息、发包任务完成通知、AI 任务完成通知 | |
| 全局细节 | 面包屑、页面切换动画（可关）、全局 loading 进度条、骨架屏、空/错状态、返回顶部 | |
| 安全交互 | 水印（可关）、锁屏（Alt+L）、会话超时提醒 | SOC 职业习惯 |

### M5 AI 融合能力模块

| 一级功能 | 二级功能点 | 说明 |
|---|---|---|
| AI 网关 | 多供应商接入（DeepSeek/Kimi/通义/OpenAI 兼容协议/本地 Ollama）、模型切换、Key 后端托管、token 用量统计 | 见五.4 |
| 全局 Copilot | 右侧常驻抽屉（Alt+A 唤起）、页面上下文自动注入、划词→AI（选中日志右键"分析"） | 不是弹窗，是工作台侧翼 |
| SOC AI 工具 | 日志解析规则生成、告警研判辅助（威胁等级/攻击链阶段/处置建议/误报概率）、告警/事件总结报告、Playbook 生成 | 见五.4，杀手场景 |
| 开发 AI 工具 | 组件文档自动生成、代码解释/重构/单测生成、自然语言搜资产、SQL 生成（注入表结构） | |
| AI 工作台 | 多会话管理、Prompt 模板库（个人 Prompt 资产，支持变量占位）、Markdown 渲染+代码块一键复制 | |
| 知识问答 RAG | 资产库文档向量化、基于个人知识问答（带引用来源） | 三期 |
| Agent 工具调用 | AI 直接操作平台（Function Calling / MCP）：如"发 10 条暴力破解样本到 10.1.1.5:514" | 三期，平台 Copilot 形态 |
| 安全护栏 | 发送前敏感信息检测与脱敏提示（IP/主机名/密钥正则识别） | **SOC 红线功能，必须做** |

### M6 系统设置模块

| 一级功能 | 二级功能点 |
|---|---|
| 权限管理 | 用户/角色/菜单权限分配、API 权限查看 |
| 菜单管理 | 菜单树 CRUD、图标选择、与子应用路由绑定关系维护 |
| AI 配置 | 供应商/模型/温度/系统提示词/代理地址/用量上限告警 |
| 字典与参数 | 数据字典、系统参数（发包默认目标白名单等） |
| 日志审计 | 操作日志、登录日志、AI 调用日志查询导出 |
| 个性化 | 主题/布局/快捷键/默认首页配置 |
| 数据管理 | 资产导出备份（JSON 全量导出）、数据导入恢复、备份管理页面（2.5.5 的产品化） |

---

## 四、UI & 交互完整规范

### 4.1 视觉风格定位与配色（v1.2 修订：以「浅色紫渐变 SaaS」为基准）

**定位：明亮现代的 SaaS 浅色基调 + 紫渐变品牌识别 + SOC 语义色体系 + 恒定深色终端**。专业感不再靠"全屏暗色作战室"撑，而靠三件事：渐变主色的克制使用（只出现在主操作/品牌区/激活态）、SOC 语义色的严谨（全平台统一、色配文字）、日志区恒定深色（护眼与专业锚点）。暗色模式完整支持，作为偏好而非默认。

组件策略：**基座壳层（布局/登录/主题/标签页）自绘**保证品牌一致性；业务密集页（复杂表单/表格）用 Ant Design Vue + VxeTable 承载，通过 token 对齐视觉。

| 类别 | 设计值（CSS 变量统一管理） |
|---|---|
| 页面基调 | 浅色（默认）：页面 `#f5f5f7` / 卡片 `#ffffff` / 浮层 `#ffffff`；暗色：`#0f1016` / `#171821` / `#1d1e29`（`data-theme` 切换，层次靠明度差不靠描边） |
| 主色 | 靛紫 `#7c3aed`；品牌/主操作渐变 `#7c3aed → #c026d3`（品牌区 135°、按钮 90° 两式）；hover、焦点环、淡色底、光晕投影全部由主色 `color-mix()` 派生——**换主题色一处生效** |
| 主题色体系（参考 Vben） | 7 套预设：紫罗兰（默认）/ 海空蓝 / 青碧 / 翡翠绿 / 琥珀橙 / 绯红 / 洋红；主题模式：浅色 / 暗黑 / 跟随系统；附色弱、灰度模式；偏好 localStorage 持久化，经通信总线同步子应用 |
| 卡片与控件 | 卡片 16px 圆角 + 环境阴影（`0 10px 30px rgba(16,16,20,.06)`，弱描边）；控件 10px；输入框 `#f5f6f8` 无边框、聚焦白底 + 主色光环；顶栏/标签栏白色玻璃（blur 14px） |
| 氛围 | 页面角落低强度主色光斑（blur 110px）——仅登录页/空态/工作台使用，数据密集页不加，避免噪感 |
| 终端/日志 | **恒定深色 `#0d1117`，不随主题切换**——SOC 长时间读日志的护眼刚需，也是浅色界面里的专业锚点 |
| 功能色（SOC 语义） | **双档制**：浅色 UI 用深色档 危急 `#dc2626` / 高危 `#ea580c` / 中危 `#d97706` / 低危 `#16a34a`；深色底（终端/暗色模式）用 vivid 档 `#f87171` / `#fb923c` / `#facc15` / `#4ade80`；**色 + 文字强制成对出现** |
| TagsView 子应用色 | base `#3b82f6` / soc `#06b6d4` / asset `#2563eb` / ai `#d946ef`（标签顶部色条、菜单徽标、面包屑 chip 同源） |
| 字体 | UI：Inter/`-apple-system` 栈；**代码与日志强制等宽 JetBrains Mono**（SOC 看日志对齐是刚需） |
| 质感细节 | 卡片 hover 阴影抬升（不做发光描边）、动效 200–300ms `ease-out`、焦点态主色光环、进度条走主渐变 |

### 4.2 响应式适配方案

中后台本质桌面优先，但必须"全页面有响应式行为"：

| 断点 | 范围 | 行为 |
|---|---|---|
| xxl/xl | ≥1200 | 完整布局：侧边菜单展开+多栏 |
| lg | 992–1199 | 菜单自动折叠为图标模式 |
| md | 768–991 | 菜单收起变抽屉，TagsView 保留 |
| sm 及以下 | <768 | 单列布局、表格转"卡片列表"或横向滚动+列显隐、表单单列化、Copilot 变全屏页 |

实现：`useBreakpoint()` composable（`@vueuse/core` 的 `useBreakpoints`）控制结构切换 + CSS 变量/媒体查询控制密度；表格用 VxeTable 列的 `visible` 响应式配置；**禁止写死像素宽度**（进 lint 规则）。

### 4.3 菜单与 TagsView 交互

**菜单**：

- 折叠：点击/悬停展开二选一（设置项），折叠态 hover 弹出子菜单（Popover 承载），状态持久化；
- 位置切换：左侧（默认）/顶部/混合（顶级在顶、子级在左）三种模式，运行时热切换不刷新；
- 折叠动画宽度过渡；菜单头部显示当前子应用徽标（微前端"我在哪"的定位感）；
- 配置入口：右上角「项目配置」抽屉（参考 Vben）集中管理——主题模式（浅色/暗黑/跟随系统）、主题色色板、导航布局（侧边/顶部/混合缩略图选择）、功能开关（标签页显隐、色弱、灰度），改动即时生效并持久化。

**TagsView 完整能力（对齐 Vben）**：多标签路由缓存、右键菜单（刷新/关闭/关闭其他/关闭所有/关闭左侧/固定 pin/最大化）、affix 固定首页、拖拽排序、超过阈值横向滚动+下拉列表、刷新后恢复、同路由不同 query 分组。

**在 Vben 基础上的 5 个改进点**（差异化亮点）：

1. **按子应用着色**：微前端下不同子应用的标签顶部色条区分（资产=蓝、SOC=青、AI=紫），跨应用多任务时定位快；
2. **脏表单关闭确认**：标签页内表单未保存时关标签弹确认（子应用向基座上报 dirty 状态，走通信总线）；
3. **固定标签分组**：常用工具（如发包器）支持"永久固定+快捷键 Alt+数字直达"；
4. **AI 上下文标记**：标签上标注哪些页面已注入 Copilot 上下文；
5. **会话快照**：一键保存当前所有标签为一组"工作场景"（如"告警演练场景"=发包器+解析器+情报查询），次日一键恢复——为 SOC 排查多工具并行场景设计。

### 4.4 全局交互细节

- **Ctrl+K 命令面板**：统一入口搜菜单/资产/工具/动作/AI 指令，模糊匹配+最近使用，键盘全程可操作；
- 反馈三件套统一：`message`（轻提示）/`notification`（异步结果）/`result` 页（终态），全平台只用这三档；
- 表格标准（VxeTable 封装进 `@aegis/ui`）：列配置持久化、密度切换、全屏、空态插画统一；
- 所有列表页骨架屏 200ms 内出现；路由切换顶部 2px 进度条（青色）；
- 快捷键体系：`Ctrl+K` 面板、`Alt+A` Copilot、`Alt+数字` 切标签、`Ctrl+W` 关当前标签、`?` 呼出快捷键帮助。

### 4.5 登录页规范（v1.2 新增）

- **形态**：居中分栏卡——左 47% 品牌渐变区（logo + 一句话定位 + 3 条能力特性 + 平台指标 + 波浪装饰），右白色表单区（账号/密码/记住我/忘记密码/登录按钮/安全提示）；≤880px 收起品牌区只留表单；
- **禁止第三方登录**（GitHub/Google/微信登录一律不做）：内部个人平台不存在该场景，登录方式只有账号密码；远期如需 LDAP/OTP 再按需扩展；
- **品牌区克制原则**：不放装饰性复杂图形（如雷达动画）与重复大标题——信息一次说清，视觉焦点让给渐变与排版本身；元素之间留足呼吸，宁少勿堆；
- **必备项**：内部系统安全提示条（"请妥善保管账号凭据"）、Enter 快速登录、版本标识 `Internal`；校验失败卡片抖动 + 输入即清除错误态；
- **数据源入口（v1.4 新增）**：表单下方常驻「数据源」小号切换（模拟/真实接口），与设置抽屉同真源——登录前选好模式直接以该模式登录；真实模式附后端启动提示；演示账号提示仅模拟模式显示；
- **主题**：登录页固定品牌主题（默认紫渐变），不跟随用户主题偏好，进入平台后才应用个性化设置。

---

## 五、关键难点专项方案

### 5.1 micro-app 组件共享完整落地方案（重点）

**第一步：把"组件共享"拆成 4 个不同的子问题**（混在一起谈是方案失败的根源）：

| 子问题 | 本质 | 对应方案 |
|---|---|---|
| A. 基础库重复加载 | vue/antdv 打进每个子应用 | import map + external（二期） |
| B. 业务组件复用 | 组件代码跨子应用使用 | **monorepo 源码共享（主力）** |
| C. 单例与状态共享 | 用户态/主题/请求实例全局唯一 | 基座 L2 注册表 + micro-app 全局数据 |
| D. 跨框架复用 | 未来非 Vue 子应用也要用 | defineCustomElement（L3） |

**B：主力方案（monorepo 源码共享）落地细节**

```
packages/shared/
├── src/
│   ├── utils/        # 纯函数
│   ├── composables/  # useAppBridge / useTheme / useUser
│   ├── request/      # axios 封装（token 由基座注入，非自己读）
│   └── types/        # 全局类型
└── package.json      # name: "@aegis/shared"，main/module 指 src（源码直出）
```

子应用 `package.json` 依赖 `"@aegis/shared": "workspace:*"`，Vite 对 workspace 包默认源码处理、无需预构建产物、HMR 直达。**收益**：TS 类型全程完整、改共享组件所有子应用即时生效、无版本漂移、无运行时魔法。**边界**：`@aegis/ui` 里禁止 import 子应用业务代码（单向依赖，进 ESLint 规则）。

**C：L2 运行时注册表（基座启动时建立）**

```ts
// 基座 main.ts —— 全局共享注册表：只放"必须全局唯一"的东西
import { setGlobalData } from '@micro-zoe/micro-app'
import { SHARED_KEYS } from '@aegis/contract' // 事件名/键名集中在契约包

setGlobalData({
  [SHARED_KEYS.request]: request,   // 统一 axios 实例（拦截器含 token/续期）
  [SHARED_KEYS.userStore]: userStore, // 用户态（只读代理）
  [SHARED_KEYS.theme]: theme,       // 主题令牌
  [SHARED_KEYS.eventBus]: eventBus, // 跨应用事件总线
})
```

子应用通过 `useAppBridge()`（`@aegis/shared` 提供）以响应式方式订阅，主题/用户态变化自动同步。**原则：数据走 L2，代码走 L1，永远不把"组件对象"塞进 window 传来传去**（会丢类型、丢响应性、埋雷）。

**A：基础库共享（二期做）**：基座 `index.html` 写 import map，`vue / ant-design-vue / dayjs` 指向**自托管**的 ESM 产物（放基座 public 目录或内网静态服务），子应用 Rollup `external` 同名映射。SOC 环境不依赖公网 CDN。

**D：L3 Web Components（按需，最后做）**：`defineCustomElement` 封装 2–3 个高价值组件（通用 CRUD 表格、日志查看器），注册为 `<aegis-pro-table>`。注意点：props 走 attributes 需可序列化，复杂数据用 property 赋值，事件用 `CustomEvent`。

**实施顺序**：MVP 只做 L1（shared 包）+ 通信总线 → 二期加 import map + L2 发布流 → 三期按需 L3。**明确不做**：Module Federation（与 micro-app 沙箱叠加复杂度不成比例）、npm 私服发版流水线（monorepo 下无必要）。

### 5.2 syslog 发包器实现思路

**关键技术事实：浏览器 JS 无法发送 UDP/TCP 原生报文（Web 平台限制），"发包器"必须是后端能力**——这正好是练 Java 网络编程的绝佳场景。

```
前端(配置面板)                后端(aegis-soc)              目标
┌──────────────┐  REST 下发  ┌─────────────────┐  UDP/TCP  ┌────────┐
│ 目标/协议/模板 │ ─────────→ │ SyslogSendService │ ────────→ │ SIEM/  │
│ 变量/速率/数量 │            │ DatagramSocket/    │           │ 日志采集 │
└──────┬───────┘   SSE 回传   │ Netty(二期TCP/TLS) │           └────────┘
       │ ←─────────────────  │ 发送结果实时推送     │
   ▼ 实时日志/失败明细          └─────────────────┘
```

- **MVP 用 `java.net.DatagramSocket`**（JDK 自带，UDP syslog 场景足够）；二期 TCP/TLS 与高并发再引入 Netty；
- 模板引擎：变量占位 `${timestamp} ${seq} ${random_ip} ${src_ip}`，内置 CEF/LEEF/JSON/key-value 四类骨架模板（存 `soc_send_template` 表，可自定义）；
- 发送控制：总量上限、间隔（简单 `Thread.sleep` 起步即可）、异步执行（`@Async` + 线程池）、可取消；
- **回显验证（杀手细节）**：后端可选开启"回环监听模式"——本地起 UDP 5140 监听自己发出的报文并回显，"自己发自己收"，验证报文格式是否正确，不依赖目标环境；
- **安全约束（SOC 从业者必须做对）**：目标地址白名单（`sys_config` 配置允许的网段），防止平台被当作内网 UDP 探测器滥用；发包记录落 `soc_send_task` 留痕。

Java 侧核心（可直接运行的骨架，供起步）：

```java
/**
 * Syslog UDP 发包服务
 * 为什么放后端：浏览器无原生 UDP 能力，且发包行为需要留痕与白名单管控
 */
@Service
public class SyslogUdpSenderService {

    /** 发送一批 syslog 报文，并通过 SseEmitter 实时回传每条结果 */
    public void sendBatch(SyslogSendTask task, SseEmitter emitter) throws IOException {
        // 目标地址白名单校验：防止平台被滥用为内网探测工具
        if (!targetWhitelist.matches(task.getTargetIp())) {
            throw new BizException("目标地址不在白名单内，请先在系统设置中添加");
        }
        try (DatagramSocket socket = new DatagramSocket()) {
            InetAddress target = InetAddress.getByName(task.getTargetIp());
            for (int i = 0; i < task.getCount(); i++) {
                String message = templateEngine.render(task.getTemplate(), i); // 填充变量
                byte[] data = message.getBytes(StandardCharsets.UTF_8);
                socket.send(new DatagramPacket(data, data.length, target, task.getPort()));
                // 每条发送结果实时推给前端日志面板
                emitter.send(SseEmitter.event().name("log").data(
                        Map.of("seq", i + 1, "message", message, "status", "sent")));
                // 速率控制：MVP 用固定间隔即可，满足测试场景
                Thread.sleep(task.getIntervalMs());
            }
        } finally {
            emitter.complete();
        }
    }
}
```

前端用 `fetch` + 流式读取消费 SSE（不要用 `EventSource`，它不支持带 POST body 和自定义头），逐条追加进等宽字体日志面板，带发送速率实时统计。

### 5.3 资产库组件/片段管理、复用、预览方案

**存储模型**：MySQL 存元数据（名称/类型/标签/描述/props 文档）+ 源码正文（`asset_item.content`，text 字段）+ 版本记录（`asset_version`，Monaco DiffEditor 对比两版差异）；附件/图片走文件存储。

**在线预览（技术核心，两个方案对比）**：

| 方案 | 做法 | 结论 |
|---|---|---|
| A. 存编译产物，动态 import | 组件提前编译成 ESM，运行时 `defineAsyncComponent` 加载 | 展示可以，**无法即时改代码看效果**；还需维护构建链路 |
| **B. 浏览器内即时编译（推荐）** | 基于 **@vue/repl**（Vue 官方 SFC Playground 的核心库）二次封装 | 保存的就是 SFC 源码、改完即时预览、所见即所得；与"资产即源码"理念完美契合 |

**B 的落地要点**：

- 保存态：组件资产 = SFC 源码 + demo 源码，纯文本，天然可 diff、可搜索；
- 预览态：`@vue/repl` 沙箱编译运行，支持依赖版本切换（预览 antdv 不同版本下的表现）；
- 安全边界：repl 运行在 iframe `srcdoc` 沙箱内，`sandbox="allow-scripts"` 禁止访问父页面 cookie/localStorage——**资产库里存的是自己写的代码，但预览安全边界仍必须有**（将来导入他人代码片段时这就是底线）；
- 编辑器：Monaco Editor（VS Code 同款，diff 视图直接复用）；高亮：Shiki（VS Code 同款着色，静态高亮场景比 Monaco 轻）。

**复用通道（三条，覆盖不同场景）**：

1. **一键复制**：Shiki 展示页 + 复制按钮 + 复制计数（计数驱动"高频资产"排序）；
2. **引用到工程**：monorepo 内组件直接从资产库"同步"到 `packages/ui`（MVP 用导出/导入文件，二期做成脚本：`aegis pull <asset-name>`）；
3. **发布到运行时共享层**：资产库组件一键注册进基座 L2 注册表，任何子应用立即可用——**这是"资产库 ↔ 微前端底座"打通的特色闭环，也是平台区别于普通 Snippet 工具的招牌**。

**搜索演进**：MVP（MySQL LIKE + 标签，够用）→ 二期（Meilisearch：轻量、中文友好、Docker 一键起，个人项目最优解，不要上 ES）→ 三期（embedding 语义搜索，与 AI 模块共用向量设施）。

**V2 落地实录（2026-09，方案 B 已上线，源码级核实的实战结论）**：

- **落地形态**：`@vue/repl@4.7.2` 的 `Sandbox` 只读面板（不拉编辑器 chunk，核心 ~450KB 懒加载）+ 假浏览器外壳；`content` 列升 MEDIUMTEXT 存 `{files,entry,deps}` JSON；复制动作分化（单文件 / 按路径分节拼接 / jszip 下载）；文件夹拖拽整体入库（剥最外层目录、跳 node_modules）；6 条种子含 7 文件目录化组件，首屏即可预览。
- **import map 两层**：`bundled` → 同源 `/repl-deps/{name}@{version}.esm.js`（构建期 esbuild 产物入 git，共享依赖全程 external 保单 Vue 实例）+ HEAD 探测；缺失回退 `esm.sh` 锁版本并 toast 明示。antd 必须带 `?external=vue&deps=dayjs@1.11.13`（默认构建 656 处根相对 `/vue@>=3.2.0` 导入绕过 import map → 双 Vue 实例白屏，已实测）。
- **四个实战坑（均已修复，留档防复发）**：
  1. **micro-app 沙箱 origin 陷阱**：沙箱内 `window.location.origin` 返回基座源（8000），拼出的 `/repl-deps` URL 在预览 iframe 原生模块加载器里 404 白屏；且 micro-app 代理沙箱内 fetch 重写到子应用源，HEAD 探测假阳性掩盖问题。根治：产物根一律 `new URL(import.meta.url).origin`——JS 引擎层面的真实模块 URL，任何沙箱代理改不了。
  2. **antd external 子路径漏网**：esbuild 裸包名 `external` 连子路径放行，`@ant-design/icons-vue/es/icons/*` 与 `dayjs/plugin/*` 留在产物里绕过映射。预打包脚本已为实际用到的子路径生成 shim 产物并在清单 `subpaths` 登记精确键（优先于前缀映射）。
  3. **iframe 高度塌陷**：repl 预览 iframe 的 `height:100%` 挂在 `flex:1 + min-height`（height:auto）容器上，CSS 规范下百分比解析失效回落默认 150px。改 `.iframe-container` 绝对定位 `inset:0` 铺满。
  4. **沙箱内无 unplugin 自动注册**：种子代码里 kebab 的 `<a-table>` 解析失败渲染成空元素——入库代码必须显式导入 + PascalCase；demo 入口若依赖挂载时拉数据，别忘了真的调 `run()`（否则预览只剩表头）。
- **已知边界**：dayjs 插件/语言包走 esm.sh 前缀映射，离线内网下带插件的 antd 预览会缺件（README 注明）；repl 的 TS 用 sucrase 只剥类型不检查，预览 ≠ typecheck。

### 5.4 AI 深度打通方案

**架构原则：AI 是"后端网关 + 前端场景注入"的神经系统，不是聊天窗**。

```
前端各场景(划词分析/侧栏/命令面板)          后端 aegis-ai 模块
┌───────────────────────────┐   SSE 流式   ┌──────────────────────────┐
│ Copilot 侧栏 │ 工具页 AI 按钮 │ ◄────────── │  AI Gateway              │
│ 划词右键     │ Ctrl+K 指令   │ ──────────► │  ├ Spring AI 统一抽象      │
└───────────────────────────┘  意图+上下文   │  ├ 多供应商适配(OpenAI兼容)│
                                            │  ├ Prompt 模板管理/变量渲染  │
                                            │  ├ 上下文构建器(页面感知)    │
                                            │  ├ 敏感信息检测/脱敏 ←SOC红线│
                                            │  └ token 用量记账          │
                                            └─────┬────────────┬───────┘
                                              ┌───┴───┐   ┌────┴────┐
                                              │DeepSeek│  │本地Ollama│ ←内网兜底
                                              │Kimi/通义│  │(数据不出网)│
                                              └───────┘   └─────────┘
```

- **技术选型：Spring AI**（统一 Chat/Embedding/VectorStore 抽象，正好是学习路径，后续换模型零改动）对比手写 WebClient SSE 透传：后者更轻但每个供应商自己适配。**推荐 Spring AI 起步**，理解抽象后可局部手写透传做精细控制。
- **上下文感知机制（"深度融入"的实现核心）**：基座维护 `PageContext`（当前子应用/页面/选中对象摘要），Copilot 打开时自动作为 system 上下文注入——在发包器页面划选一条日志，AI 已知道"这是 CEF 格式、来自你的发包任务"，无需用户复述。
- **落地功能（按价值排序，每期做 3 个）**：

| 场景 | 交互 | 价值 |
|---|---|---|
| 日志解析规则生成 | 贴日志样本 → AI 出正则/Grok + 逐字段解释 → 一键存为解析模板 | 写解析规则效率 ×5 |
| 告警研判辅助 | 告警原文+资产上下文 → 结构化输出（等级/攻击链阶段/处置建议/误报概率） | 研判思路标准化，新人期神器 |
| 组件文档生成 | 资产库内读组件源码 → props/events/示例文档 | 沉淀不再拖延 |
| 代码解释/重构/单测 | 资产库片段页内按钮 | 开发提效 |
| SQL 生成 | 注入表结构 schema → 自然语言出 SQL | 全栈学习加速 |
| 周报生成 | 平台内本周工具使用/演练记录+手动补充 → Markdown | 周报 30 分钟→5 分钟 |
| 自然语言搜资产 | "之前存过一个防抖的 hook" → 语义检索 | 三期（embedding） |
| Agent 工具操作 | "发 10 条暴力破解样本到 10.1.1.5:514" → AI 调用发包 API | 三期（Function Calling），并**将平台工具封装为 MCP Server**，Claude 等外部 AI 客户端也能驱动你的平台——平台从"用 AI"升级为"可被 AI 编排" |

- **SOC 安全红线（必须内建，不能靠自觉）**：发送第三方 LLM 前正则检测 IP/内网域名/密钥样式/身份证手机号，命中则拦截并提示确认或自动脱敏（`1.2.3.4 → x.x.x.4` 保留末位定位）；同时提供"本地 Ollama 通道"给敏感数据场景——**这是把 SOC 职业素养产品化，也是这个平台最"懂安全"的功能点**。

---

## 六、风险点 & 取舍建议

### 6.1 技术风险与微前端坑点

| 风险/坑 | 影响 | 对策 |
|---|---|---|
| Vite 子应用沙箱（ESM 无法被 with 沙箱拦截） | 高，MVP 第一周就撞 | 用 micro-app 1.0+ 的 **iframe 沙箱模式**接入 Vite 子应用；MVP 首个里程碑就验证"Vite 子应用跑通" |
| antdv 弹窗/下拉挂 body，逃逸样式隔离 | 弹窗在子应用内样式丢失 | 子应用统一改挂容器内（antdv ConfigProvider `getPopupContainer`）；MVP 定为编码规范 |
| keep-alive 保活内存泄漏 | 长开页面内存涨 | 标签关闭即销毁 + 保活页面上限（如 10） |
| 预览/REPL 安全 | XSS 面 | iframe sandbox 隔离，禁 cookie 访问 |
| 后端 UDP 发包被滥用为内网探测 | 安全事故 | 目标白名单 + 留痕（前文已述） |
| AI 幻觉误导研判 | 错误处置建议 | 输出强制带"AI 建议仅供辅助"水位声明 + 引用来源 |
| AI token 失控 | 费用 | 用量记账 + 月度上限告警 + 本地模型兜底 |
| 部署环境漂移 / 迁移服务器痛苦 | 运维负担 | 2.5 的 docker-compose 全量容器化，配置全部 .env 化 |
| 数据丢失（个人知识资产） | **不可逆损失** | 2.5.5 备份策略从 MVP 第一天执行 |
| 单人精力导致烂尾 | **最大风险** | 见下方取舍，MVP 严格砍范围 |

### 6.2 取舍建议（防过度设计清单）

**明确不做**：微服务/网关、K8s、ES/Kafka/RocketMQ、npm 私服+发版流水线、Module Federation、Turborepo（触发条件见 2.4.3）、多人协同编辑、一开始就上 CI/CD 集群部署、超过 7 个子应用的拆分。

**优先级判断标准**：对"今天的 SOC 工作 + 本周的开发"有无直接帮助。按此标准排序：**syslog 发包器 > 代码片段库 > TagsView/布局 > 组件预览 > AI 场景 > RAG > 大屏**。微前端底座深度（组件共享三层、监控）是长期竞争力，但按二三期节奏走，不阻塞 MVP。

---

## 七、分阶段迭代规划

| 期 | 周期 | 目标主题 | 交付范围 | 验收标准（做到才算完） |
|---|---|---|---|---|
| **MVP** | 第 1–6 周 | 跑通底座，工具先用起来 | 基座：登录(SA-Token)、动态菜单、**Vite 子应用 iframe 沙箱跑通**、侧边折叠、简版标签页、主题系统（7 套主题色 + 明暗 + 跟随系统 + 三布局）；子应用 soc-tools：syslog 发包器（UDP+模板+SSE 回显）；asset-repo：片段/组件存储+Shiki 高亮+标签搜索+一键复制；后端：模块化单体骨架、Result/异常/审计、核心 8 张表；**工程与部署：pnpm monorepo+catalog+契约包、docker-compose（nginx+server+mysql）、deploy.sh 一键部署、备份 cron** | ① 在真实 SIEM/采集器上完成一次告警规则验证演练 ② 旧脚本/备忘录里的片段全部入库并检索到 ③ 新增一个空子应用 ≤30 分钟 ④ 服务器上 `deploy.sh` 一条命令可访问，备份文件存在 |
| **二期** | 第 7–14 周 | 日常工作主入口 + AI 三个杀手场景 | 底座：TagsView 完整版+Vben 改进点、三布局切换、Ctrl+K 面板、import map 依赖共享、L2 注册表、亮暗双主题精修；SOC：日志解析器、编码解码全家桶、IP/IOC 工具、告警样本工场；资产库：@vue/repl 预览、Monaco+版本 diff、文档库、Meilisearch；AI：Spring AI 网关+Copilot 侧栏（日志解析/告警研判/组件文档三场景）+脱敏护栏；后端与部署：Redis、SSE、MinIO、AI 用量记账，compose 扩容、备份管理页面 | ① 日常打开浏览器的首页变成 Aegis ② 用 AI 生成 1 条真实可用的解析规则 ③ 周报借助报表助手完成一次 ④ 敏感数据走本地 Ollama 通道完成一次研判 |
| **三期** | 第 15–26 周 | 可开源的平台级形态 | RAG 个人知识问答（向量库选 PGVector/Redis）、Agent 工具调用+**平台工具 MCP Server 化**、子应用脚手架模板（`pnpm create aegis-app`）、L3 Web Components、性能与错误监控、SOC 态势首页（工作台+统计大屏：资产增长、工具使用热力、AI 用量）、数据备份导出、开源化治理（文档/许可证/示例数据）；工程化：按 2.4.3 触发条件评估引入 Turborepo、GitHub Actions CI | ① 外部 AI 客户端通过 MCP 驱动你的发包器 ② 陌生人按 README 30 分钟跑起 Demo ③ 首页大屏截图能直接当作品集封面 |

**执行节奏建议**：每周一个可演示的小闭环（哪怕是"菜单能从数据库下发了"），单人项目靠"持续可见的进展"对抗烂尾；每期结束写一篇复盘文档存入资产库——它本身就是平台"资产沉淀"理念的自我践行。

---

## 附录：参考链接

- [微前端框架 MicroApp 1.0 正式发布（Vite/ESM iframe 沙箱方案）- 京东云开发者社区](https://developer.jdcloud.com/article/3340)
- [MicroApp 官方文档](https://jd-opensource.github.io/micro-app/) / [GitHub Demo 仓库](https://github.com/jd-opensource/micro-app)
- [micro-app Issue #1611：主/子应用公共依赖共享讨论](https://github.com/jd-opensource/micro-app/issues/1611)
- [微前端模块共享你真的懂了吗 - 腾讯云](https://cloud.tencent.com/developer/article/1952704)
- [关于微前端，你想知道的都在这（import-map/externals 共享）- 知乎](https://zhuanlan.zhihu.com/p/608467054)
- [pnpm catalog（workspace 统一依赖版本）官方文档](https://pnpm.io/zh-CN/catalogs)
- [Turborepo 官方文档](https://turborepo.com/docs)
