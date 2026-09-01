/**
 * soc-tools 子应用中文语言包。
 * 只覆盖本应用自己的页面（当前是 Syslog 发包器）；
 * 基座会在装载时把语言偏好经数据通道下发（见 App.vue 对 lastLang 的 watch）。
 */
export default {
  syslog: {
    title: 'Syslog 发包器',
    mvpBadge: 'MVP 核心功能',
    desc: '向 SIEM / 日志采集器发送模拟 syslog 报文，验证解析规则与告警策略。真实模式下由后端 DatagramSocket 直发、SSE 实时回传，任务落库留痕。',
    wlBadge: '白名单：RFC1918 私有网段 + 回环',
    auditBadge: '发送留痕已启用',
    saveTask: '保存任务',
    history: '发送历史',

    // 数据源模式（页头开关）
    sourceLabel: '数据源',
    sourceMock: '模拟',
    sourceReal: '真实接口',

    // 发送配置面板
    configTitle: '发送配置',
    configSub: 'UDP 直发 · 白名单管控',
    targetLabel: '目标地址（IP : 端口）',
    wlOk: '目标在白名单网段内（10/8 · 172.16/12 · 192.168/16 · 127/8）',
    wlBad: '目标不在白名单内，发送将被后端拦截',
    protocolLabel: '传输协议',
    protocolHint: 'TCP / TLS 将于二期支持',
    countLabel: '发送数量 / 间隔',
    countHint: '单次最多 2000 条 · 间隔最小 50ms',
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
    wlBlocked: '目标不在白名单网段内，发送被拦截',
    taskFailed: '发送任务异常终止',
    doneToast: '发送完成：{total} 条 · 失败 {failed} · 平均 {rate} 条/秒',

    // 保存配置预设（页头「保存任务」弹窗）
    savePresetTitle: '保存为配置预设',
    presetNameLabel: '预设名称',
    presetNamePh: '给这组发送配置起个名字（64 字以内）',
    presetSaved: '预设「{name}」已保存',
    presetDeleted: '预设已删除',
    confirmDeletePreset: '删除预设「{name}」？该操作不可恢复。',

    // 发送历史抽屉
    histTitle: '发送历史',
    tabHistory: '历史任务',
    tabPresets: '保存的配置',
    colTime: '时间',
    colTarget: '目标',
    colTpl: '模板',
    colCount: '条数（成功/计划）',
    colStatus: '状态',
    colDuration: '耗时',
    colAction: '操作',
    colName: '名称',
    colSummary: '配置摘要',
    actionReplay: '复现',
    actionLoad: '载入',
    actionDelete: '删除',
    actionSave: '保存',
    actionCancel: '取消',
    stDone: '完成',
    stCancelled: '已取消',
    stFailed: '失败',
    stRunning: '进行中',
    clearFinished: '清空已结束任务',
    confirmDeleteTask: '删除这条历史记录？仅从列表隐藏，底账保留。',
    confirmClearHistory: '将删除全部已完成 / 已取消 / 失败的历史记录（进行中的不受影响，仅从列表隐藏、底账保留）。确定继续？',
    taskDeleted: '历史记录已删除',
    historyCleared: '已清理 {n} 条历史记录',
    configLoaded: '配置已载入表单，确认无误后可开始发送',
    loadBlockedSending: '发送进行中，请先停止再载入配置',
  },
} as const
