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

-- 资产仓库种子（V2 结构化）：6 条示范覆盖全部五类，其中两条可在线预览、一条多文件目录化，
-- 让真实接口模式首启即有"标志性"内容，也给"搜索/标签筛选/复制计数排序/文件树/依赖面板"提供验证数据。
-- copy_count 给差异化初值，排序效果（复制多的在前）开箱可见。
-- 固定 ID 101-106：种子要可引用；与 V1 旧种子（同 ID 段、单文件形状）冲突由下面的 DELETE 解决——
-- INSERT IGNORE 对已存在的旧形状行永远不生效，必须先删后插才换得动形状；WHERE 限定 seed，用户自建数据不动。
-- content 的 JSON 与前端 mock 种子（apps/asset-repo/src/api/seeds.json）同源、由脚本生成；
-- 组件用显式导入 + PascalCase 以适配预览沙箱（沙箱内没有 unplugin 自动注册）。反斜杠按 MySQL 语义双写。
DELETE FROM asset_item WHERE create_by = 'seed';

INSERT IGNORE INTO asset_item (id, name, type, lang, description, content, tags, copy_count, create_by)
VALUES        (101, 'ProSearchTable 检索表格', 'component', 'vue',
        '带检索栏与分页的表格封装：fetch 逻辑进 composable，列定义进 hooks，检索栏/工具条拆子组件——目录化入库 7 个文件，demo.vue 可在线预览。',
        '{"files":[{"path":"index.vue","lang":"vue","code":"<script setup lang=\\"ts\\">\\nimport { Table } from ''ant-design-vue''\\nimport { useProTable } from ''./useProTable''\\nimport { useColumns } from ''./hooks/useColumns''\\nimport FilterBar from ''./components/FilterBar.vue''\\nimport Toolbar from ''./components/Toolbar.vue''\\nimport type { SearchTableProps } from ''./types''\\n\\nconst props = defineProps<SearchTableProps>()\\n\\n// 检索/分页/loading 全部收进 composable，组件零业务状态\\nconst { loading, dataSource, pagination, run, search } = useProTable(props.fetch, {\\n  defaultPage: 1,\\n  pageSize: 20,\\n})\\nconst columns = useColumns(props.rowActions)\\n</script>\\n\\n<template>\\n  <section class=\\"pro-search-table\\">\\n    <FilterBar :search=\\"search\\" :loading=\\"loading\\">\\n      <slot name=\\"filter\\" />\\n    </FilterBar>\\n    <Toolbar>\\n      <slot name=\\"toolbar\\" />\\n    </Toolbar>\\n    <Table\\n      :loading=\\"loading\\"\\n      :columns=\\"columns\\"\\n      :data-source=\\"dataSource\\"\\n      :pagination=\\"pagination\\"\\n      row-key=\\"id\\"\\n      @change=\\"run\\"\\n    />\\n  </section>\\n</template>"},{"path":"useProTable.ts","lang":"ts","code":"import { reactive, ref } from ''vue''\\nimport { debounce } from ''lodash-es''\\nimport type { FetchFn, ProTableState } from ''./types''\\n\\nexport function useProTable(fetch: FetchFn, options = {}) {\\n  const loading = ref(false)\\n  const state = reactive<ProTableState>({ page: 1, pageSize: 20, total: 0 })\\n  const dataSource = ref<Record<string, unknown>[]>([])\\n\\n  async function run(next = {}) {\\n    loading.value = true\\n    try {\\n      const { items, total } = await fetch({ ...state, ...next })\\n      dataSource.value = items\\n      state.total = total\\n    } finally {\\n      loading.value = false\\n    }\\n  }\\n\\n  // 检索请求防抖 300ms，避免连打关键字打爆接口\\n  const search = debounce(run, 300)\\n  return { loading, dataSource, pagination: state, run, search }\\n}"},{"path":"types.ts","lang":"ts","code":"export interface PageQuery {\\n  page: number\\n  pageSize: number\\n  kw?: string\\n}\\n\\nexport interface PageResult<T> {\\n  items: T[]\\n  total: number\\n}\\n\\nexport interface ProTableState {\\n  page: number\\n  pageSize: number\\n  total: number\\n}\\n\\nexport type FetchFn = (q: PageQuery) => Promise<PageResult<Record<string, unknown>>>\\n\\nexport interface SearchTableProps {\\n  rowActions?: string[]\\n  fetch: FetchFn\\n}"},{"path":"components/FilterBar.vue","lang":"vue","code":"<script setup lang=\\"ts\\">\\nimport { Button } from ''ant-design-vue''\\n// 检索栏容器：默认插槽放筛选项，右侧固定查询按钮\\ndefineProps<{ search: () => void; loading?: boolean }>()\\n</script>\\n\\n<template>\\n  <div class=\\"filter-bar\\">\\n    <slot />\\n    <Button type=\\"primary\\" :loading=\\"loading\\" @click=\\"search\\">查询</Button>\\n  </div>\\n</template>\\n\\n<style scoped>\\n.filter-bar {\\n  display: flex;\\n  gap: 8px;\\n  margin-bottom: 12px;\\n}\\n</style>"},{"path":"components/Toolbar.vue","lang":"vue","code":"<script setup lang=\\"ts\\">\\n// 工具条容器：左侧标题位 + 右侧动作位，全部插槽化\\n</script>\\n\\n<template>\\n  <div class=\\"table-toolbar\\">\\n    <slot name=\\"left\\" />\\n    <div class=\\"table-toolbar__right\\"><slot /></div>\\n  </div>\\n</template>\\n\\n<style scoped>\\n.table-toolbar {\\n  display: flex;\\n  justify-content: space-between;\\n  margin-bottom: 8px;\\n}\\n\\n.table-toolbar__right {\\n  display: flex;\\n  gap: 8px;\\n}\\n</style>"},{"path":"hooks/useColumns.ts","lang":"ts","code":"import type { TableColumnProps } from ''ant-design-vue''\\n\\n/** 列定义工厂：操作列宽度按动作数自适应，避免手写魔法值 */\\nexport function useColumns(rowActions?: string[]): TableColumnProps[] {\\n  const base: TableColumnProps[] = [\\n    { title: ''时间'', dataIndex: ''time'', width: 120 },\\n    { title: ''源 IP'', dataIndex: ''src'', width: 130 },\\n    { title: ''告警类型'', dataIndex: ''type'' },\\n  ]\\n  if (!rowActions?.length) return base\\n  return [...base, { title: ''操作'', key: ''action'', width: 60 + rowActions.length * 48 }]\\n}"},{"path":"demo.vue","lang":"vue","code":"<script setup lang=\\"ts\\">\\n// 示例文件：预览入口。沙箱里没有 unplugin 自动注册，antd 组件显式导入 + PascalCase\\nimport { ref } from ''vue''\\nimport { Input } from ''ant-design-vue''\\nimport ProSearchTable from ''./index.vue''\\n\\nconst kw = ref('''')\\n\\n// 预览环境没有真实后端：fetch 用本地模拟数据\\nconst ALERTS = [\\n  { id: 1, time: ''14:03:11'', src: ''10.1.1.5'', type: ''LNK 泛洪'' },\\n  { id: 2, time: ''14:02:47'', src: ''172.16.8.23'', type: ''SSH 暴力破解'' },\\n]\\nconst fetch = (q) => Promise.resolve({\\n  items: ALERTS.filter((r) => !q.kw || r.src.includes(q.kw)),\\n  total: ALERTS.length,\\n})\\n</script>\\n\\n<template>\\n  <ProSearchTable :fetch=\\"fetch\\" :row-actions=\\"[''研判'']\\">\\n    <template #filter>\\n      <Input v-model:value=\\"kw\\" placeholder=\\"按源 IP 检索\\" allow-clear />\\n    </template>\\n  </ProSearchTable>\\n</template>"}],"entry":"demo.vue","deps":[{"name":"vue","version":"3.5.42","source":"bundled"},{"name":"ant-design-vue","version":"4.2.6","source":"bundled"},{"name":"@ant-design/icons-vue","version":"7.0.1","source":"bundled"},{"name":"lodash-es","version":"4.17.21","source":"cdn"}]}',
        'vue,antd,封装,表格', 34, 'seed'),
       (102, 'extractAlertFields 告警字段提取', 'function', 'ts',
        '从 syslog / CEF 原文里提取 src、dst、端口、等级等关键字段，返回结构化对象；值班时快速取字段不用肉眼扫日志。右侧预览可直接粘贴日志实测。',
        '{"files":[{"path":"index.ts","lang":"ts","code":"/** 从告警原文提取结构化字段：优先 CEF 扩展键，退化到 LEEF/键值对 */\\nexport function extractAlertFields(raw: string) {\\n  const pick = (key: string) => raw.match(new RegExp(key + ''=([^\\\\s]+)''))?.[1]\\n\\n  return {\\n    src: pick(''src'') ?? null,\\n    dst: pick(''dst'') ?? null,\\n    port: Number(pick(''spt'') ?? 0),\\n    severity: pick(''severity'') ?? inferByKeyword(raw),\\n    raw: raw.length > 512 ? raw.slice(0, 512) + ''…'' : raw,\\n  }\\n}\\n\\nfunction inferByKeyword(raw: string): string {\\n  if (/flood|scan|brute/i.test(raw)) return ''high''\\n  if (/policy|violation/i.test(raw)) return ''medium''\\n  return ''low''\\n}"},{"path":"demo.vue","lang":"vue","code":"<script setup lang=\\"ts\\">\\n// 沙箱里没有 unplugin 自动注册：antd 组件显式导入 + PascalCase\\nimport { ref, computed } from ''vue''\\nimport { Textarea } from ''ant-design-vue''\\nimport { extractAlertFields } from ''./index''\\n\\nconst raw = ref(''<134>1 2026-09-02T14:03:11.284Z SIEM-01 CEF - src=10.1.1.5 dst=192.168.30.7 spt=445 rule=\\"LNK flood\\"'')\\nconst result = computed(() => extractAlertFields(raw.value))\\n</script>\\n\\n<template>\\n  <Textarea v-model:value=\\"raw\\" :rows=\\"3\\" />\\n  <pre class=\\"out\\">{{ JSON.stringify(result, null, 2) }}</pre>\\n</template>"}],"entry":"demo.vue","deps":[{"name":"vue","version":"3.5.42","source":"bundled"},{"name":"ant-design-vue","version":"4.2.6","source":"bundled"}]}',
        'soc,正则,工具', 21, 'seed'),
       (103, 'useDebounceFn', 'snippet', 'ts',
        '通用防抖 composable：立即执行首调用，尾部触发合并；表格检索、窗口 resize 场景直接贴走。',
        '{"files":[{"path":"useDebounceFn.ts","lang":"ts","code":"import { onUnmounted } from ''vue''\\n\\nexport function useDebounceFn<T extends (...args: any[]) => void>(fn: T, delay = 300) {\\n  let timer: ReturnType<typeof setTimeout> | null = null\\n\\n  const run = (...args: Parameters<T>) => {\\n    if (timer) clearTimeout(timer)\\n    timer = setTimeout(() => fn(...args), delay)\\n  }\\n\\n  // 组件卸载顺手清掉定时器，避免内存里挂着幽灵回调\\n  onUnmounted(() => timer && clearTimeout(timer))\\n  return run\\n}"}],"entry":null,"deps":[]}',
        'vue,composable', 12, 'seed'),
       (104, 'Result 统一返回包装', 'component', 'java',
        'Spring Boot 统一响应体：code / message / data 三段式，静态工厂 ok / fail 直出；配合全局异常处理器使用。Java 资产暂不支持在线预览。',
        '{"files":[{"path":"Result.java","lang":"java","code":"public class Result<T> {\\n\\n    private String code;\\n    private String message;\\n    private T data;\\n\\n    public static <T> Result<T> ok(T data) {\\n        Result<T> r = new Result<>();\\n        r.code = \\"00000\\";\\n        r.message = \\"success\\";\\n        r.data = data;\\n        return r;\\n    }\\n\\n    public static <T> Result<T> fail(String code, String message) {\\n        Result<T> r = new Result<>();\\n        r.code = code;\\n        r.message = message;\\n        return r;\\n    }\\n}"}],"entry":null,"deps":[]}',
        'java,spring', 8, 'seed'),
       (105, 'grep 应急速查', 'doc', 'md',
        '凌晨处置时 3 秒翻出来的 grep 组合拳：按场景索引，从百万行日志里圈人、圈 IP、圈时间窗。',
        '{"files":[{"path":"grep-cheatsheet.md","lang":"md","code":"# grep 应急速查\\n\\n## 圈出某 IP 的全部行为（含上下文）\\n```bash\\ngrep -C 3 ''10.1.1.5'' /var/log/secure\\n```\\n\\n## 时间窗内的高频源 IP TOP20\\n```bash\\ngrep ''02/Sep/2026:14:'' access.log | awk ''{print $1}'' | sort | uniq -c | sort -rn | head -20\\n```\\n\\n## 只看失败登录（暴破研判）\\n```bash\\ngrep -i ''failed password'' /var/log/secure | grep -v ''invalid user''\\n```"}],"entry":null,"deps":[]}',
        'bash,soc', 7, 'seed'),
       (106, 'MITRE ATT&CK 官网', 'link', NULL,
        '攻击技战术知识库官方站：研判时查 TID、看检测建议的第一入口。',
        'https://attack.mitre.org/',
        'threatintel', 5, 'seed');
