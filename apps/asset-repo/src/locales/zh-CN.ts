/**
 * asset-repo 子应用中文语言包。
 * 结构约定：types.<key> 与 AssetType 枚举一一对应，新增类型两处同步改。
 */
export default {
  repo: {
    title: '资产仓库',
    desc: '个人开发资产的统一入口：代码片段、组件、工具函数、知识文档与链接剪藏——存进来、搜得到、一键复制。',
    searchPlaceholder: '搜索名称 / 说明 / 正文…',
    typeAll: '全部',
    tagPlaceholder: '按标签筛选',
    create: '新建资产',
    refresh: '刷新',
    loadFailed: '资产列表加载失败',

    // 数据源只读徽标（控制点在基座设置抽屉，子应用页面禁止出现开关）
    sourceLabel: '数据源',
    sourceMock: '模拟',
    sourceReal: '真实接口',

    // 左列列表
    listEmpty: '没有匹配的资产',
    listEmptyHint: '换个关键字试试，或新建一条',
    copyCountShort: '{n} 次复制',

    // 右列详情
    detailEmptyTitle: '从左侧选择一条资产',
    detailEmptySub: '选中后在这里预览高亮代码、复制与编辑',
    copy: '复制',
    copied: '已复制到剪贴板',
    copyFailed: '复制失败，请手动选择正文复制',
    edit: '编辑',
    delete: '删除',
    deleteConfirm: '删除后不可恢复（后端留逻辑删除底账），确定？',
    deleted: '已删除',
    saved: '已保存',
    copyCount: '复制 {n} 次',
    updated: '更新于 {time}',
    openLink: '打开链接',
    linkLabel: '链接地址',
    descriptionLabel: '说明',

    types: {
      snippet: '代码片段',
      component: '组件',
      function: '工具函数',
      doc: '知识文档',
      link: '链接剪藏',
    },

    form: {
      createTitle: '新建资产',
      editTitle: '编辑资产',
      name: '名称',
      nameRequired: '请输入资产名称',
      namePlaceholder: '例如：useDebounceFn / grep 应急速查',
      type: '类型',
      lang: '语言',
      langPlaceholder: '选择语言（用于高亮）',
      description: '说明',
      descriptionPlaceholder: '一句话说明这条资产是干嘛的（可选）',
      tags: '标签',
      tagsPlaceholder: '输入后回车确认，最多 8 个',
      tagsHint: '保存时统一转小写去重，用于左侧筛选',
      content: '正文',
      contentRequired: '请输入正文内容',
      contentPlaceholder: '粘贴代码全文 / 文档内容 / 链接 URL',
      contentHint: '代码按所选语言高亮展示；链接剪藏填 URL 即可',
      submit: '保 存',
      cancel: '取 消',
    },
  },
} as const
