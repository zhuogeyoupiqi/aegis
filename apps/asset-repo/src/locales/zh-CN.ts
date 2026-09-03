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

    // 数据源只读徽标（控制点在基座设置抽屉，子应用页面禁止出现开关）
    sourceLabel: '数据源',
    sourceMock: '模拟',
    sourceReal: '真实接口',

    // 主题切换（仅子应用独立运行时显示）
    themeLight: '切换为浅色',
    themeDark: '切换为深色',

    // 视图切换
    viewGrid: '卡片网格',
    viewList: '列表分栏',
    backToGrid: '返回卡片列表',

    // 左列列表
    listEmpty: '没有匹配的资产',
    listEmptyHint: '换个关键字试试，或新建一条',

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

    // V2：文件树 / 预览 / 依赖 / 复制动作组
    previewable: '可预览',
    tabCode: '代码',
    tabPreview: '预览',
    filesLabel: '文件',
    linesShort: '{n} 行',
    copyThisFile: '复制此文件',
    copyAllFiles: '复制全部（按路径分节）',
    downloadZip: '下载 .zip',
    copiedFile: '已复制 {path}',
    zipDone: 'zip 已开始下载',
    zipFallback: '打包组件暂不可用，已复制拼接文本',
    depsLabel: '依赖',
    depsEmpty: '未声明外部依赖',
    depBundled: '预打包',
    depCdn: 'CDN',
    previewRunning: '运行中',
    previewLoading: '编译预览中…',
    previewRetry: '重试',
    previewLoadFailed: '预览加载失败',
    previewCompileFailed: '编译失败',
    previewShowDetail: '查看详情',
    previewHideDetail: '收起详情',
    previewCopyError: '复制错误',
    previewFallback: '预打包产物缺失（{names}），已回退公网 CDN',

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
      // content / contentRequired / contentHint 等 V1 键已移除，文件正文在 V2 中按文件清单处理；contentPlaceholder 在文件区复用
      contentPlaceholder: '粘贴代码全文 / 文档内容',
      submit: '保 存',
      cancel: '取 消',

      // 抽屉标签页
      formTabMeta: '元信息',
      formTabFiles: '文件',
      formTabDeps: '依赖',

      // V2 表单：文件区 / 预览入口 / 依赖编辑
      url: '链接地址',
      setEntry: '设为预览入口',
      noFileSelected: '从左侧选择一个文件开始编辑',
      linkNoFiles: '链接剪藏不需要文件',
      linkNoDeps: '链接剪藏不需要依赖',
      urlRequired: '请输入链接地址',
      files: '文件',
      filesRequired: '至少需要一个文件（可粘贴或拖入文件夹）',
      addFile: '新文件',
      importFolder: '导入文件夹',
      scanDeps: '扫描依赖',
      addDep: '手动添加依赖',
      removeDep: '移除依赖',
      dropHint: '也可以直接把组件文件夹拖进来',
      removeFile: '移除文件',
      pathPlaceholder: '路径，如 src/index.ts（可含目录）',
      pathInvalid: '文件路径不合法：{path}（不能为空、不能以 / 开头、不能含 ..）',
      entry: '预览入口',
      entryHint: '预览沙箱从此文件启动渲染，仅支持 .vue',
      entryPlaceholder: '选择入口文件（可选）',
      entryInvalid: '预览入口必须是文件清单里的路径',
      depsTitle: '预览依赖',
      depsHint: 'import map 数据源；版本必须锁定（不使用 latest）',
      version: '版本',
      depVersionRequired: '依赖 {name} 缺少版本号',
      ingested: '导入 {n} 个文件，跳过 {m} 个（非文本/超限/噪声目录）',
      brokenImports: '{n} 处相对导入指向不存在的文件',
    },
  },
} as const
