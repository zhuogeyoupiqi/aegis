import { delay } from '@aegis/shared'
import { APP_CODES, type AppRegistration, type MenuGroup } from '@aegis/contract'

/**
 * 菜单与子应用注册表 mock。
 * 菜单是「唯一事实来源」：路由守卫按它判断 stub 重定向，侧栏/工作台按它渲染。
 * 后续接后端时换成 /api/menu 返回同结构 JSON。
 */

/** 子应用注册表：基座按 code 找 entry 装载 */
const registry: Partial<Record<string, AppRegistration>> = {
  [APP_CODES.SOC_TOOLS]: {
    code: APP_CODES.SOC_TOOLS,
    name: 'SOC 工具集',
    devEntry: 'http://localhost:8002/',
    prodEntry: '/child/soc-tools/',
  },
}

const groups: MenuGroup[] = [
  {
    key: 'common',
    title: '常用',
    children: [
      { key: 'workbench', title: '工作台', icon: 'workbench', appCode: 'base', path: '/workbench' },
    ],
  },
  {
    key: 'soc',
    title: 'SOC 工具集',
    children: [
      // 第 1 周唯一真实页面：micro-app iframe 沙箱装载的子应用
      { key: 'syslog-sender', title: 'Syslog 发包器', icon: 'syslog', appCode: 'soc-tools', path: '/soc/syslog-sender' },
      { key: 'log-parser', title: '日志解析器', icon: 'parser', appCode: 'soc-tools', path: '/soc/log-parser', stub: true },
      { key: 'sample-factory', title: '告警样本工场', icon: 'factory', appCode: 'soc-tools', path: '/soc/sample-factory', stub: true },
      { key: 'codec', title: '编码解码', icon: 'codec', appCode: 'soc-tools', path: '/soc/codec', stub: true },
      { key: 'ioc', title: 'IOC 处理', icon: 'ioc', appCode: 'soc-tools', path: '/soc/ioc', stub: true },
      { key: 'ip-tool', title: 'IP 工具', icon: 'ip', appCode: 'soc-tools', path: '/soc/ip-tool', stub: true },
    ],
  },
  {
    key: 'asset',
    title: '知识资产',
    children: [
      { key: 'asset-repo', title: '资产仓库', icon: 'assets', appCode: 'asset-repo', path: '/asset/repo', stub: true },
      { key: 'vuln-kb', title: '漏洞知识库', icon: 'shield', appCode: 'asset-repo', path: '/asset/vulns', stub: true },
      { key: 'playbooks', title: 'Playbook 库', icon: 'playbook', appCode: 'asset-repo', path: '/asset/playbooks', stub: true },
    ],
  },
  {
    key: 'ai',
    title: '智能',
    children: [
      { key: 'ai-studio', title: 'AI 工作台', icon: 'ai', appCode: 'ai-studio', path: '/ai/studio', stub: true },
      { key: 'prompts', title: '提示词库', icon: 'prompts', appCode: 'ai-studio', path: '/ai/prompts', stub: true },
    ],
  },
  {
    key: 'system',
    title: '系统',
    children: [
      { key: 'users', title: '用户与权限', icon: 'users', appCode: 'system-admin', path: '/system/users', stub: true },
      { key: 'apps', title: '子应用管理', icon: 'apps', appCode: 'system-admin', path: '/system/apps', stub: true },
      { key: 'audit', title: '操作审计', icon: 'audit', appCode: 'system-admin', path: '/system/audit', stub: true },
    ],
  },
]

export function menuMock(): Promise<{ groups: MenuGroup[]; registry: Partial<Record<string, AppRegistration>> }> {
  return delay({ groups, registry }, 250)
}
