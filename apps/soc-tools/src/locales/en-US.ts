/**
 * soc-tools English locale. Keys mirror zh-CN.ts one-to-one —
 * 缺一个键就会回退中文，新增文案时两个文件必须同步改。
 */
export default {
  syslog: {
    title: 'Syslog Sender',
    mvpBadge: 'MVP core feature',
    desc: 'Send simulated syslog messages to a SIEM / log collector to validate parsing rules and alert policies. Fully mocked for now; once the backend lands it will send via DatagramSocket and stream back over SSE.',
    wlBadge: 'Whitelist mode on: 10.0.0.0/8',
    auditBadge: 'Send audit trail enabled',
    saveTask: 'Save task',
    history: 'Send history',

    configTitle: 'Send Configuration',
    configSub: 'UDP direct send · whitelist enforced',
    targetLabel: 'Target (IP : port)',
    wlOk: 'Target is inside the whitelist range (10.0.0.0/8)',
    wlBad: 'Target is outside the whitelist; the backend will block the send',
    protocolLabel: 'Transport protocol',
    protocolHint: 'TCP / TLS arrive in phase 2',
    countLabel: 'Count / interval',
    countHint: 'Minimum interval 50ms · token-bucket rate limiting in phase 2',
    loopbackTitle: 'Loopback listener',
    loopbackHint: 'Local UDP 5140 receives our own packets to verify the format',
    randomizeTitle: 'Randomize variables',
    randomizeHint: 'Regenerate IP / username / seq on every send',
    start: 'Start sending',
    stop: 'Stop sending',

    tplTitle: 'Message Template',
    tplSub: 'Placeholders are rendered at send time',
    aiGen: 'AI template',
    aiToast: 'AI-generated templates arrive once the AI sub-app is ready',
    varHint: 'Click a variable to insert it at the cursor',
    previewLabel: '▍Rendered preview',

    stSending: 'Sending',
    stIdle: 'Idle',
    termTitle: 'Live Send Log',
    statSent: 'Sent',
    statFailed: 'Failed',
    statRate: 'Rate',
    perSec: 'msg/s',
    statElapsed: 'Elapsed',
    autoScroll: 'Auto-scroll',
    on: 'On',
    off: 'Off',
    clear: 'Clear',
    termEmpty: 'No sends yet · press "Start sending" to watch the live log',
    insertedVar: 'Inserted variable {var}',

    sev: {
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    },

    stopped: 'Sending stopped manually',
    wlBlocked: 'Target is outside the whitelist (10.0.0.0/8); send blocked',
    doneToast: 'Done: {total} messages · {failed} failed · avg {rate} msg/s',
    savedTask: 'Task saved — replay it from "Send history" (mock)',
    historyToast: 'Send history (mock): 14 tasks today · 3,208 messages total',
  },
} as const
