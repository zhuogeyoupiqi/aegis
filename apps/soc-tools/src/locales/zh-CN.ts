/**
 * soc-tools 子应用中文语言包。
 * 只覆盖本应用自己的页面（当前是 Syslog 发包器）；
 * 基座会在装载时把语言偏好经数据通道下发（见 App.vue 对 lastLang 的 watch）。
 */
export default {
  syslog: {
    title: 'Syslog 发包器',
    mvpBadge: 'MVP 核心功能',
    desc: '向 SIEM / 日志采集器发送模拟 syslog 报文，验证解析规则与告警策略。当前端到端为 mock；后端就绪后由 DatagramSocket 直发、SSE 实时回传。',
    wlBadge: '白名单模式已开启 10.0.0.0/8',
    auditBadge: '发送留痕已启用',
    saveTask: '保存任务',
    history: '发送历史',

    // 发送配置面板
    configTitle: '发送配置',
    configSub: 'UDP 直发 · 白名单管控',
    targetLabel: '目标地址（IP : 端口）',
    wlOk: '目标在白名单网段内（10.0.0.0/8）',
    wlBad: '目标不在白名单内，发送将被后端拦截',
    protocolLabel: '传输协议',
    protocolHint: 'TCP / TLS 将于二期支持',
    countLabel: '发送数量 / 间隔',
    countHint: '间隔最小 50ms · 令牌桶限速将于二期接入',
    loopbackTitle: '回环监听',
    loopbackHint: '本地 UDP 5140 收自己发的包，自证报文格式',
    randomizeTitle: '变量随机化',
    randomizeHint: '每次发送重新生成 IP / 用户名 / 序号',
    start: '开始发送',
    stop: '停止发送',

    // 消息模板面板
    tplTitle: '消息模板',
    tplSub: '变量占位符将在发送时渲染',
    aiGen: 'AI 生成模板',
    aiToast: 'AI 生成模板将在 AI 子应用就绪后接入',
    varHint: '点击插入变量到光标处',
    previewLabel: '▍渲染预览',

    // 实时日志终端
    stSending: '发送中',
    stIdle: '空闲',
    termTitle: '实时发送日志',
    statSent: '已发送',
    statFailed: '失败',
    statRate: '速率',
    perSec: '条/s',
    statElapsed: '耗时',
    autoScroll: '自动滚动',
    on: '开',
    off: '关',
    clear: '清空',
    termEmpty: '暂无发送记录 · 点击「开始发送」查看实时回传',
    insertedVar: '已插入变量 {var}',

    // severity 等级名（终端徽标，按 sevLevel 返回的 key 查词条）
    sev: {
      critical: '危急',
      high: '高危',
      medium: '中危',
      low: '低危',
    },

    // toast 提示
    stopped: '已手动停止发送',
    wlBlocked: '目标不在白名单（10.0.0.0/8）内，发送被拦截',
    doneToast: '发送完成：{total} 条 · 失败 {failed} · 平均 {rate} 条/秒',
    savedTask: '发送任务已保存，可在「发送历史」中一键复现（mock）',
    historyToast: '发送历史（mock）：今日 14 次任务 · 累计 3,208 条',
  },
} as const
