-- Aegis MVP 建表脚本（方案文档 §2.2.2）
-- 幂等：全部 IF NOT EXISTS，配合 spring.sql.init.mode=always 实现零手工初始化。
-- ai 域的表属于后续阶段（AI 网关），本阶段不建；资产域表见文末"资产域"一节。
-- 通用六字段（BaseEntity 对应列）：id/create_time/update_time/create_by/deleted/version，
-- 雪花 ID 由应用生成（ASSIGN_ID），所以主键不用 AUTO_INCREMENT。

-- ============ 系统域 ============

-- 用户表（登录接入 SA-Token 时启用，先立表结构）
CREATE TABLE IF NOT EXISTS sys_user (
    id          BIGINT       NOT NULL COMMENT '雪花ID',
    username    VARCHAR(64)  NOT NULL COMMENT '登录名',
    password    VARCHAR(128) NOT NULL COMMENT '密码（加密存储，不存明文）',
    nickname    VARCHAR(64)  NULL COMMENT '显示名',
    email       VARCHAR(128) NULL COMMENT '邮箱',
    status      TINYINT      NOT NULL DEFAULT 1 COMMENT '1 启用 0 禁用',
    create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by   VARCHAR(64)  NULL COMMENT '创建人',
    deleted     TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除：0 正常 1 已删',
    version     INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
    PRIMARY KEY (id),
    UNIQUE KEY uk_username (username)
) ENGINE = InnoDB COMMENT = '用户';

-- 角色表（预留：RBAC，MVP 单人自用暂只有一条管理员数据）
CREATE TABLE IF NOT EXISTS sys_role (
    id          BIGINT      NOT NULL,
    role_code   VARCHAR(64) NOT NULL COMMENT '角色编码（admin/user）',
    role_name   VARCHAR(64) NOT NULL COMMENT '角色名',
    remark      VARCHAR(255) NULL,
    create_time DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by   VARCHAR(64) NULL,
    deleted     TINYINT     NOT NULL DEFAULT 0,
    version     INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_role_code (role_code)
) ENGINE = InnoDB COMMENT = '角色';

-- 菜单表：树形 + 微前端路由三元组（app_code/route_path/component），
-- 方案文档定位它是"应用注册中心 + 菜单动态下发"的数据基础，基座启动时拉取
CREATE TABLE IF NOT EXISTS sys_menu (
    id          BIGINT       NOT NULL,
    parent_id   BIGINT       NOT NULL DEFAULT 0 COMMENT '父菜单ID，0=顶级',
    menu_name   VARCHAR(64)  NOT NULL COMMENT '菜单名',
    app_code    VARCHAR(32)  NULL COMMENT '所属微前端（base/soc-tools/asset-repo）',
    route_path  VARCHAR(255) NULL COMMENT '前端路由路径',
    component   VARCHAR(255) NULL COMMENT '组件路径（子应用内部路由用）',
    menu_type   TINYINT      NOT NULL DEFAULT 1 COMMENT '1 目录 2 菜单 3 按钮',
    icon        VARCHAR(64)  NULL,
    sort_no     INT          NOT NULL DEFAULT 0 COMMENT '同级排序，小的在前',
    visible     TINYINT      NOT NULL DEFAULT 1,
    create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by   VARCHAR(64)  NULL,
    deleted     TINYINT     NOT NULL DEFAULT 0,
    version     INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE = InnoDB COMMENT = '菜单（含微前端注册信息）';

-- 系统配置表：业务运营类配置落库（运行期可改、无需重启）。
-- 与 yml 的分工见 SysConfigDO 类注释；syslog 白名单就住在这里
CREATE TABLE IF NOT EXISTS sys_config (
    id          BIGINT       NOT NULL,
    cfg_key     VARCHAR(128) NOT NULL COMMENT '配置键，点分命名空间（syslog.whitelist）',
    cfg_value   TEXT         NULL COMMENT '配置值（字符串，结构化内容由读取方解析）',
    remark      VARCHAR(255) NULL COMMENT '人读备注',
    create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by   VARCHAR(64)  NULL,
    deleted     TINYINT     NOT NULL DEFAULT 0,
    version     INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_cfg_key (cfg_key)
) ENGINE = InnoDB COMMENT = '系统配置';

-- ============ 审计域 ============

-- 操作审计表：对应 SysOpLogDO，@AuditLog 切面写入（失败的尝试也记录）
CREATE TABLE IF NOT EXISTS sys_op_log (
    id           BIGINT       NOT NULL,
    module       VARCHAR(32)  NOT NULL COMMENT '业务模块（syslog/system）',
    action       VARCHAR(64)  NOT NULL COMMENT '动作（send-task/cancel）',
    operator     VARCHAR(64)  NOT NULL COMMENT '操作人',
    detail       VARCHAR(512) NULL COMMENT '操作对象描述',
    client_ip    VARCHAR(64)  NULL COMMENT '调用方IP',
    cost_ms      BIGINT       NULL COMMENT '耗时毫秒',
    success      TINYINT      NOT NULL DEFAULT 1 COMMENT '1 成功 0 失败',
    error_msg    VARCHAR(512) NULL COMMENT '失败原因',
    operate_time DATETIME     NOT NULL COMMENT '动作发生时间',
    create_time  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by    VARCHAR(64)  NULL,
    deleted      TINYINT      NOT NULL DEFAULT 0,
    version      INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_operate_time (operate_time),
    KEY idx_module_action (module, action)
) ENGINE = InnoDB COMMENT = '操作审计';

-- 登录日志表（登录接入后由 SA-Token 登录回调写入，先立表）
CREATE TABLE IF NOT EXISTS sys_login_log (
    id          BIGINT       NOT NULL,
    username    VARCHAR(64)  NOT NULL COMMENT '尝试登录的用户名（失败的也要记）',
    success     TINYINT      NOT NULL DEFAULT 1 COMMENT '1 成功 0 失败',
    client_ip   VARCHAR(64)  NULL,
    user_agent  VARCHAR(255) NULL COMMENT '登录端浏览器标识',
    error_msg   VARCHAR(255) NULL COMMENT '失败原因（密码错/账号禁用）',
    login_time  DATETIME     NOT NULL,
    create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by   VARCHAR(64)  NULL,
    deleted     TINYINT      NOT NULL DEFAULT 0,
    version     INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_login_time (login_time)
) ENGINE = InnoDB COMMENT = '登录日志';

-- ============ SOC 域 ============

-- 发送模板表：CEF/LEEF/JSON/KV 报文骨架。
-- 职责边界（§2.2.3）：变量渲染在前端，后端只存模板原文
CREATE TABLE IF NOT EXISTS soc_send_template (
    id          BIGINT       NOT NULL,
    tpl_key     VARCHAR(32)  NOT NULL COMMENT '模板key（CEF/LEEF/JSON/KV/自定义）',
    name        VARCHAR(64)  NOT NULL COMMENT '显示名',
    content     TEXT         NOT NULL COMMENT '模板原文（${var} 占位符由前端渲染）',
    builtin     TINYINT      NOT NULL DEFAULT 0 COMMENT '1 内置不可删 0 用户自建',
    create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by   VARCHAR(64)  NULL,
    deleted     TINYINT      NOT NULL DEFAULT 0,
    version     INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_tpl_key (tpl_key)
) ENGINE = InnoDB COMMENT = 'syslog 发送模板';

-- 发送任务表：一次发包一条记录，SOC 排查"这批告警是谁发的"就查它
CREATE TABLE IF NOT EXISTS soc_send_task (
    id              BIGINT       NOT NULL,
    target_ip       VARCHAR(64)  NOT NULL COMMENT '目标IP（白名单校验过）',
    target_port     INT          NOT NULL COMMENT '目标UDP端口',
    protocol        VARCHAR(16)  NOT NULL DEFAULT 'udp' COMMENT '协议（预留 tcp）',
    template_key    VARCHAR(32)  NULL COMMENT '使用的模板key',
    payload_preview VARCHAR(512) NULL COMMENT '报文预览（前512字符）',
    total_count     INT          NOT NULL COMMENT '计划条数',
    interval_ms     INT          NOT NULL COMMENT '发送间隔毫秒',
    sent_count      INT          NOT NULL DEFAULT 0 COMMENT '成功条数',
    failed_count    INT          NOT NULL DEFAULT 0 COMMENT '失败条数',
    duration_ms     BIGINT       NULL COMMENT '总耗时毫秒',
    status          VARCHAR(16)  NOT NULL COMMENT 'RUNNING/DONE/CANCELLED/FAILED',
    error_msg       VARCHAR(512) NULL COMMENT '结束原因/异常摘要',
    start_time      DATETIME     NULL COMMENT '开始发送时间',
    create_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by       VARCHAR(64)  NULL,
    deleted         TINYINT      NOT NULL DEFAULT 0,
    version         INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_create_time (create_time),
    KEY idx_status (status)
) ENGINE = InnoDB COMMENT = 'syslog 发送任务（留痕）';

-- 发送配置预设表："保存任务"按钮的落点。
-- 与 soc_send_task 的分工：task 是"跑过的每一次"（留痕，系统写），
-- preset 是"想反复用的配置"（书签，用户存）
CREATE TABLE IF NOT EXISTS soc_send_preset (
    id               BIGINT       NOT NULL,
    name             VARCHAR(64)  NOT NULL COMMENT '预设名',
    target_ip        VARCHAR(64)  NOT NULL COMMENT '目标IP',
    target_port      INT          NOT NULL COMMENT '目标UDP端口',
    template_key     VARCHAR(32)  NOT NULL COMMENT '模板key',
    template_content TEXT         NOT NULL COMMENT '模板编辑框全文（复现以此为准）',
    count            INT          NOT NULL COMMENT '计划条数',
    interval_ms      INT          NOT NULL COMMENT '发送间隔毫秒',
    randomize        TINYINT      NOT NULL DEFAULT 1 COMMENT '变量随机化开关',
    create_time      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by        VARCHAR(64)  NULL,
    deleted          TINYINT      NOT NULL DEFAULT 0,
    version          INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE = InnoDB COMMENT = 'syslog 发送配置预设';

-- ============ 资产域 ============

-- 资产条目表（方案文档 §M2 资产库）：片段/组件/函数/文档/链接 五类共一张表，
-- type 字段区分——五类共享同一形状（名字+正文+标签），拆表只会带来五份重复 CRUD。
-- asset_version 版本表（历史版本回溯）属于后续阶段，先不建。
-- tags 存逗号分隔小写串：个人库量级下 FIND_IN_SET 足够，量级上来再演进 Meilisearch
CREATE TABLE IF NOT EXISTS asset_item (
    id           BIGINT       NOT NULL,
    name         VARCHAR(128) NOT NULL COMMENT '资产名',
    type         VARCHAR(32)  NOT NULL COMMENT '类型：snippet/component/function/doc/link',
    lang         VARCHAR(32)  NULL COMMENT '代码语言（code 类用；doc 固定 md；link 为空）',
    description  VARCHAR(512) NULL COMMENT '一句话说明',
    content      MEDIUMTEXT   NOT NULL COMMENT '正文：link=URL 原文；其余=JSON{files,entry,deps}',
    tags         VARCHAR(255) NULL COMMENT '标签，逗号分隔小写',
    copy_count   INT          NOT NULL DEFAULT 0 COMMENT '复制次数（使用频率排序权重）',
    create_time  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by    VARCHAR(64)  NULL,
    deleted      TINYINT      NOT NULL DEFAULT 0,
    version      INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_type (type),
    KEY idx_copy_count (copy_count)
) ENGINE = InnoDB COMMENT = '个人开发资产条目';

-- V2 迁移：已存在的库不会走进上面的 CREATE IF NOT EXISTS，用幂等 MODIFY 把 TEXT 升 MEDIUMTEXT。
-- 多文件 JSON（utf8mb4 下 64KB 仅约 2 万汉字）超 TEXT 上限很常见；MODIFY 重复执行无害，
-- 每次启动都跑一遍的代价是开发库小表的一次表定义检查，无感
ALTER TABLE asset_item MODIFY COLUMN content MEDIUMTEXT NOT NULL COMMENT '正文：link=URL 原文；其余=JSON{files,entry,deps}';
