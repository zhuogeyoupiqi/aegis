# Aegis Server —— 后端服务

Aegis 个人能力平台的后端：**Maven 多模块的模块化单体**（方案文档 §2.2.1）。
当前已实现 syslog 发包模块（UDP 实发 + SSE 实时回传 + 白名单 + 留痕）、登录（SA-Token）与资产库（asset-repo），AI 网关后续阶段接入。

## 模块结构

```
aegis-server
├── aegis-common      公共件（零依赖）：Result 统一返回 / ErrorCode / BizException / CIDR 工具
├── aegis-framework   技术基建：全局异常 / 审计切面 / MyBatis-Plus 配置 / 操作人上下文
├── aegis-system      系统域：sys_config 配置读写（白名单就在这）
├── aegis-asset       资产域：资产仓库（条目 CRUD + 关键字/标签检索 + 复制计数）
├── aegis-soc         SOC 工具域：syslog 发包（任务/事件中心/线程池/Controller）
├── aegis-ai          AI 域（预留，暂无代码）
└── aegis-admin       启动聚合：唯一 main，打包部署产物（其余模块不允许有启动类）
```

依赖只能自上而下（admin → 业务模块 → framework → common），禁止反向依赖。

## 环境要求

| 依赖 | 版本 | 说明 |
|---|---|---|
| JDK | 17（LTS） | Spring Boot 3.x 基准版本；本机多版本时用 `JAVA_HOME` 指定 |
| Maven | 3.8+ | `brew install maven` |
| MySQL | 8.0+ | 建库建账号见下方首次启动 |

## 首次启动

### 1. 建库 + 建应用账号（root 只用这一次）

```bash
mysql -uroot -p -e "
CREATE DATABASE IF NOT EXISTS aegis DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER IF NOT EXISTS 'aegis'@'localhost' IDENTIFIED BY 'aegis123';
CREATE USER IF NOT EXISTS 'aegis'@'127.0.0.1' IDENTIFIED BY 'aegis123';
GRANT ALL PRIVILEGES ON aegis.* TO 'aegis'@'localhost';
GRANT ALL PRIVILEGES ON aegis.* TO 'aegis'@'127.0.0.1';
FLUSH PRIVILEGES;"
```

应用账号只有 `aegis` 一个库的权限（最小权限原则，配置文件里不出现 root 密码）。

### 2. 打包

```bash
cd aegis-server
export JAVA_HOME=$(/usr/libexec/java_home -v 17)   # 本机默认 JDK 不是 17 时需要
mvn -pl aegis-admin -am package -DskipTests
```

产物：`aegis-admin/target/aegis-admin-0.1.0.jar`（可执行 fat jar，约 32MB）。

### 3. 启动

```bash
java -jar aegis-admin/target/aegis-admin-0.1.0.jar
```

启动时自动完成：建 10 张表（幂等 `CREATE TABLE IF NOT EXISTS`）→ 灌种子数据（白名单配置、4 套内置模板、4 条资产种子，`INSERT IGNORE`）→ 清理上次异常中断的 RUNNING 任务。

看到这行就是起来了：

```
Started AegisApplication in x.xxx seconds
```

- 服务端口：**8090**（不用 8080：本机有其他项目长期占用）
- 健康探测：`curl http://localhost:8090/api/syslog/tasks`
  返回 `code: "A0401"`（未登录）即服务正常——接口已受 SA-Token 拦截

## 日常开发

```bash
# 开发运行（改代码重启由 IDE 或 Ctrl-C 重跑负责，当前未配 devtools）。
# 注意 spring-boot:run 不能带 -am：-am 会把根聚合工程卷进 reactor，
# run 目标在根 POM 上执行会报 "Unable to find a suitable main class"。
# 兄弟模块（common/framework/soc 等）有改动时，先 install 一次再单模块运行：
mvn -q install -DskipTests && mvn -pl aegis-admin spring-boot:run

# 只编译验证，不打包（带 -am 没问题，package/compile 不受上述限制）
mvn -q -pl aegis-admin -am compile

# 环境变量覆盖数据源（不改文件换库/换密码）
AEGIS_DB_PASSWORD=xxx AEGIS_DB_HOST=192.168.x.x java -jar aegis-admin/target/aegis-admin-0.1.0.jar
```

## 接口一览

### 认证（SA-Token）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录，返回 `{ token, user }`；**免鉴权**。请求体 `{ username, password }` |
| POST | `/api/auth/logout` | 注销当前会话 |
| GET | `/api/auth/me` | 当前登录人信息 `{ account, nickname, roles }` |

演示账号 `admin / 123456`（BCrypt 落库，登录失败与用户不存在同文案 `B0101` 防账号枚举）。
所有 `/api/**` 接口默认要求登录（拦截器见 `SaTokenConfig`），白名单仅两条：
`POST /api/auth/login` 与 SSE `GET /api/syslog/tasks/*/events`（EventSource 无法自定义请求头）。

请求需带 `Authorization: Bearer <token>`（前缀 `Bearer` 含空格，漏了视同未登录 `A0401`）。
后端用内存会话，**重启后所有 token 失效**，前端会自动跳回登录页重新登录一次。

### syslog 发包

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/syslog/tasks` | 创建发送任务，返回 `{ taskId }`（**字符串**，雪花 ID 防 JS 精度丢失） |
| GET | `/api/syslog/tasks?current=1&size=20` | 发送历史（分页，新的在前；size 上限 100） |
| DELETE | `/api/syslog/tasks/{taskId}` | 删除单条历史（逻辑删除；RUNNING 拒绝 `B0002`） |
| DELETE | `/api/syslog/tasks` | 清空全部终态历史，返回清理条数 |
| GET | `/api/syslog/tasks/{taskId}/events` | SSE 事件流（text/event-stream，不套 Result 包装） |
| POST | `/api/syslog/tasks/{taskId}/cancel` | 取消运行中任务 |
| GET | `/api/syslog/presets` | 配置预设列表（个人工具量级，不分页） |
| POST | `/api/syslog/presets` | 保存预设（表单整体存档，`name` ≤ 64 字） |
| DELETE | `/api/syslog/presets/{id}` | 删除预设（不存在返回 `B0404`） |

### 创建任务

```bash
# 先登录拿 token（此后所有业务接口都要带 Bearer 头）
TOKEN=$(curl -s -X POST http://localhost:8090/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"123456"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')

curl -X POST http://localhost:8090/api/syslog/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"targetIp":"127.0.0.1","targetPort":1514,"templateKey":"CEF","intervalMs":100,
       "payloads":["CEF:0|Security|Aegis|1.0|1001|Test|8|src=10.1.1.5","CEF:0|Security|Aegis|1.0|1002|Test|6|src=10.1.1.6"]}'
```

参数约束（DTO 校验注解为准）：`targetIp` 必须是 IPv4 字面量且**在白名单网段内**；`payloads` 1~2000 条、单条 ≤ 8KB（渲染在前端完成，后端只做字节搬运）；`intervalMs` 20~60000。列表长度即发送条数。

### 订阅事件流

```bash
curl -N http://localhost:8090/api/syslog/tasks/{taskId}/events
```

三种事件（`type` 字段判别）：`line`（单条结果）、`stats`（实时统计，约 200ms/10 条推一次）、`done`（终态：DONE / CANCELLED / FAILED）。
任务结束后订阅仍会重放缓冲区内的事件（最多 500 条，供断线补播）。

### 本地收包自测

```bash
nc -kul 1514    # 另开终端监听 UDP 1514，页面上把目标填 127.0.0.1:1514
```

### 资产仓库（asset-repo）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/asset/items?current=1&size=20&kw=&type=&tag=` | 分页检索：`kw` 模糊命中名称/说明/正文，`type` 精确（snippet/component/function/doc/link），`tag` 精确（`FIND_IN_SET`，java 不误中 javascript）。按复制次数降序 |
| POST | `/api/asset/items` | 新增资产；`tags` 逗号串（服务端小写去重，>8 个拒绝 `A0001`） |
| PUT | `/api/asset/items/{id}` | 更新资产（不存在返回 `B0404`） |
| DELETE | `/api/asset/items/{id}` | 删除资产（逻辑删除，底账保留） |
| POST | `/api/asset/items/{id}/copy` | 复制计数 +1（`setSql` 原子自增；**不打审计**——读语义高频打点，避免刷爆 op_log） |

五类资产共一张 `asset_item` 表（差异只在 type 与展示形态）；正文 `content` TEXT（64KB，DTO `@Size(60000)` 前置拦截）。

## 配置说明

- `application.yml`：与环境无关的部分（端口 8090、SQL 初始化、MyBatis-Plus 映射规则）
- `application-dev.yml`：数据源（支持 `AEGIS_DB_HOST/PORT/USER/PASSWORD` 环境变量覆盖）、开发期 SQL 日志
- **白名单**存在 `sys_config` 表的 `syslog.whitelist`（JSON 数组），改完即生效不用重启；默认 `10/8、172.16/12、192.168/16、127/8`：

```bash
# 例：追加一个网段
mysql -uaegis -paegis123 aegis -e "UPDATE sys_config SET cfg_value='[\"10.0.0.0/8\",\"172.16.0.0/12\",\"192.168.0.0/16\",\"127.0.0.0/8\",\"100.64.0.0/10\"]' WHERE cfg_key='syslog.whitelist';"
```

## 数据库表（10 张）

| 表 | 用途 |
|---|---|
| sys_user / sys_role / sys_menu | 用户/角色/菜单（含微前端注册字段，登录接入后启用） |
| sys_config | 运行期可改的业务配置（白名单住这里） |
| sys_op_log | 操作审计（@AuditLog 切面写入，**失败的尝试也记录**） |
| sys_login_log | 登录日志（SA-Token 接入后启用） |
| soc_send_task | 发送任务留痕：谁、何时、对哪、发了多少、结果如何 |
| soc_send_template | 报文模板（CEF/LEEF/JSON/KV 内置种子） |
| soc_send_preset | 发送配置预设（"保存任务"的落点；task 是日记系统写，preset 是书签用户存） |
| asset_item | 资产条目（五类共表：名字/类型/语言/标签/正文/复制计数） |

所有表带通用六字段：`id（雪花）/ create_time / update_time / create_by / deleted（逻辑删）/ version（乐观锁）`，由 `BaseEntity` + MyBatis-Plus 自动维护。

## 常见问题

| 现象 | 原因与处理 |
|---|---|
| **如何停止服务** | 前台 `Ctrl-C`；后台 `lsof -ti tcp:8090 \| xargs kill`。普通 kill 会等在跑的发送任务收尾（最长 30s），`kill -9` 跳过收尾但下次启动会自动清理孤儿任务 |
| 启动报 `Access denied for user 'aegis'` | 应用账号密码与 `application-dev.yml` 不一致，或首次启动没执行建账号 SQL |
| 端口占用 `Port 8090 was already in use` | `lsof -ti tcp:8090 \| xargs kill` 后重启 |
| 发送被拒 `B0001 目标不在白名单网段` | 白名单生效中（防被当内网 UDP 探测器滥用），改 `sys_config` 配置 |
| 前端报"无法连接后端" | 后端没起；确认 8090 在线、前端 vite 代理指向 8090 |
| 运行日志在哪 | 控制台即日志（dev 级别 debug）；后台跑时 `nohup java -jar ... > /tmp/aegis-server.log 2>&1 &` |
