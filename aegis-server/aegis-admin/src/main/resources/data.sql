-- 种子数据（幂等：INSERT IGNORE 依赖各表唯一键，重复启动不会重复插入）
-- ID 用固定值而非自动生成：种子数据要可引用（菜单 parent_id 指向父菜单），随机 ID 做不到。

-- syslog 发送白名单：RFC1918 私有网段 + 回环。
-- 与 SyslogWhitelistService.DEFAULT_CIDRS 保持一致——配置缺失时的兜底也是这组，
-- 两处一致才不会出现"表里有值但和预期不一样"的困惑
INSERT IGNORE INTO sys_config (id, cfg_key, cfg_value, remark, create_by)
VALUES (1, 'syslog.whitelist',
        '["10.0.0.0/8","172.16.0.0/12","192.168.0.0/16","127.0.0.0/8"]',
        'syslog 发包目标白名单（CIDR 数组）。改这里即可放开/收紧网段，无需重启', 'seed');

-- 内置发送模板：key 与前端 SyslogSender 的 TEMPLATES 一一对应（CEF/LEEF/JSON/KV），
-- 前端连上真实接口后从后端拉模板列表，mock 里那份保留不动（要求：mock 不删除）
INSERT IGNORE INTO soc_send_template (id, tpl_key, name, content, builtin, create_by)
VALUES (101, 'CEF', 'CEF 标准格式',
        'CEF:0|Security|Aegis-Test|1.0|${event_id}|${event_name}|${severity}|src=${random_ip} dst=192.168.1.20 suser=${user} dhost=WEB-01 msg=Triggered by Aegis sender seq=${seq}',
        1, 'seed'),
       (102, 'LEEF', 'LEEF 标准格式',
        'LEEF:1.0|Aegis|ThreatSensor|2.1|${event_id}|src=${random_ip} dst=192.168.1.20 sev=${severity} usrName=${user} msg=${event_name}',
        1, 'seed'),
       (103, 'JSON', 'JSON 结构化',
        '{"facility":"auth","severity":${severity},"event_id":"${event_id}","name":"${event_name}","src":"${random_ip}","dst":"192.168.1.20","user":"${user}","ts":"${timestamp}"}',
        1, 'seed'),
       (104, 'KV', 'Key-Value 键值对',
        'time=${timestamp} event_id=${event_id} name=${event_name} sev=${severity} src=${random_ip} dst=192.168.1.20 user=${user} action=deny',
        1, 'seed');

-- 管理员账号：密码是 "123456" 的 BCrypt 密文（演示账号，勿用于生产）。
-- 库里已存在该行时 INSERT IGNORE 不生效，靠下面的 UPDATE 迁移把老占位串换成真密文——
-- WHERE 限定占位串：用户后来自己改过的密码绝不能被种子数据覆盖
INSERT IGNORE INTO sys_user (id, username, password, nickname, status, create_by)
VALUES (1, 'admin', '$2a$10$ACWx8P5Uhq7a2LmiQerZKuZ6TLP7KlSSszJO8RJThOlf8yI082tAG', '管理员', 1, 'seed');

-- 老库迁移：把 SA-Token 接入前的占位密码升级为真实密文（幂等：更新过一次后 WHERE 不再命中）
UPDATE sys_user
SET password = '$2a$10$ACWx8P5Uhq7a2LmiQerZKuZ6TLP7KlSSszJO8RJThOlf8yI082tAG'
WHERE id = 1 AND password = '{bcrypt}pending-sa-token-integration';

INSERT IGNORE INTO sys_role (id, role_code, role_name, remark, create_by)
VALUES (1, 'admin', '管理员', '拥有全部权限', 'seed');
