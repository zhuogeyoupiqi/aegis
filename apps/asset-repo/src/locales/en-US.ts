/**
 * asset-repo English locale. Keys mirror zh-CN.ts one-to-one —
 * 缺一个键就会回退中文，新增文案时两个文件必须同步改。
 */
export default {
  repo: {
    title: 'Asset Repository',
    desc: 'One home for personal dev assets: snippets, components, utilities, docs and link clippings — store, search, and copy in one click.',
    searchPlaceholder: 'Search name / description / content…',
    typeAll: 'All',
    tagPlaceholder: 'Filter by tag',
    create: 'New Asset',
    refresh: 'Refresh',
    loadFailed: 'Failed to load assets',

    sourceLabel: 'Data source',
    sourceMock: 'Mock',
    sourceReal: 'Real API',

    listEmpty: 'No matching assets',
    listEmptyHint: 'Try another keyword, or create one',
    copyCountShort: '{n} copies',

    detailEmptyTitle: 'Select an asset on the left',
    detailEmptySub: 'Preview highlighted code, copy and edit here',
    copy: 'Copy',
    copied: 'Copied to clipboard',
    copyFailed: 'Copy failed, please select the content manually',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirm: 'This cannot be undone (soft-deleted on the backend). Continue?',
    deleted: 'Deleted',
    saved: 'Saved',
    copyCount: '{n} copies',
    updated: 'Updated {time}',
    openLink: 'Open link',
    linkLabel: 'URL',
    descriptionLabel: 'Description',

    types: {
      snippet: 'Snippet',
      component: 'Component',
      function: 'Utility',
      doc: 'Doc',
      link: 'Link',
    },

    form: {
      createTitle: 'New Asset',
      editTitle: 'Edit Asset',
      name: 'Name',
      nameRequired: 'Please enter the asset name',
      namePlaceholder: 'e.g. useDebounceFn / grep cheatsheet',
      type: 'Type',
      lang: 'Language',
      langPlaceholder: 'Pick a language (for highlighting)',
      description: 'Description',
      descriptionPlaceholder: 'One line about what this asset is for (optional)',
      tags: 'Tags',
      tagsPlaceholder: 'Type and press Enter, up to 8',
      tagsHint: 'Normalized to lowercase and deduped on save',
      content: 'Content',
      contentRequired: 'Please enter the content',
      contentPlaceholder: 'Paste code / markdown / URL',
      contentHint: 'Code is highlighted by the selected language; links take a URL',
      submit: 'Save',
      cancel: 'Cancel',
    },
  },
} as const
