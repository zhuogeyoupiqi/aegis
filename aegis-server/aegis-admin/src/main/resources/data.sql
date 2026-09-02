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

-- 资产仓库种子：每类一条示范（snippet/component/doc/link），让真实接口模式首启不空库，
-- 也给"搜索/标签筛选/复制计数排序"提供可直接验证的数据。copy_count 给了差异化初值，
-- 排序效果（复制多的在前）开箱可见。asset_item 无业务唯一键，靠固定主键防重插。
-- 正文里统一用双引号写代码字符串：避免 SQL 单引号转义把种子内容弄得没法读
INSERT IGNORE INTO asset_item (id, name, type, lang, description, content, tags, copy_count, create_by)
VALUES (101, 'useDebounceFn', 'snippet', 'ts',
        'Vue3 防抖 composable：输入框搜索等高频触发的标准件',
        'import { ref, onUnmounted } from "vue"\n\n/** 防抖执行：停顿 wait 毫秒后才真正触发 */\nexport function useDebounceFn<F extends (...args: any[]) => void>(fn: F, wait = 300) {\n  const timer = ref<ReturnType<typeof setTimeout> | null>(null)\n\n  function run(...args: Parameters<F>) {\n    if (timer.value) clearTimeout(timer.value)\n    timer.value = setTimeout(() => fn(...args), wait)\n  }\n\n  // 组件卸载清掉挂起的定时器，避免回调打到已销毁的组件\n  onUnmounted(() => {\n    if (timer.value) clearTimeout(timer.value)\n  })\n\n  return { run }\n}',
        'vue,composable', 12, 'seed'),
       (102, 'Result 统一返回包装', 'component', 'java',
        'Spring Boot 接口统一 Result<T>：code=0 成功，A/B/C 分段错误码',
        'import java.io.Serializable;\n\n/**\n * 统一接口返回包装。前后端契约：code=0 成功，非 0 分段\n * （A 调用方问题 / B 业务规则 / C 服务端内部）。\n */\npublic class Result<T> implements Serializable {\n\n    private String code;\n    private String message;\n    private T data;\n\n    public static <T> Result<T> ok(T data) {\n        Result<T> r = new Result<>();\n        r.code = "0";\n        r.data = data;\n        return r;\n    }\n\n    public static <T> Result<T> fail(String code, String message) {\n        Result<T> r = new Result<>();\n        r.code = code;\n        r.message = message;\n        return r;\n    }\n}',
        'java,spring', 3, 'seed'),
       (103, 'grep 应急速查', 'doc', 'md',
        'SOC 排查时最常用的 grep 组合，按使用频率排列',
        '# grep 应急速查\n\n## 最常用\n- grep -rn "pattern" /var/log          # 递归 + 行号，排查日志第一反应\n- grep -i "error" app.log              # 忽略大小写\n- grep -c "Failed" secure.log          # 只数条数\n- grep -A 3 -B 1 "panic" app.log       # 命中行后 3 行前 1 行（上下文）\n\n## 进阶\n- grep -E "10\\\\.0\\\\.[0-9]+\\\\.[0-9]+" access.log      # 扩展正则提内网 IP\n- grep -v "health-check" access.log                  # 反选，滤掉探活噪声\n- zgrep "sqlmap" *.gz                                # 直接搜压缩日志\n- grep -o "src=[0-9.]*" alert.log | sort | uniq -c | sort -rn   # 提字段并计数\n\n## 排查思路\n先 -c 确认量级 → 再 -A/-B 看上下文 → 最后 -o + uniq -c 做聚合。',
        'bash,soc', 7, 'seed'),
       (104, 'MITRE ATT&CK 官网', 'link', NULL,
        '攻击技战术知识库，写报告/研判时查技战术编号的第一入口',
        'https://attack.mitre.org/',
        'threatintel', 5, 'seed');
