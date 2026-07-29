// 英語の UI 文言（base.md 6 章）。構造は ja.ts と揃える。
export default {
  app: {
    name: 'Mobile Eagle',
  },
  header: {
    folder: 'Folders',
    filter: 'Filter',
    select: 'Select',
    settings: 'Settings',
  },
  theme: {
    label: 'Theme',
    light: 'Light',
    dark: 'Dark',
    auto: 'Auto',
  },
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    apply: 'Apply',
    close: 'Close',
  },
  breadcrumb: {
    all: 'All',
    uncategorized: 'Uncategorized',
  },
  filter: {
    stars: 'Rating',
    exts: 'File type',
    keyword: 'Keyword',
    keywordPlaceholder: 'Enter a search keyword',
    tags: 'Tags',
    tagsPlaceholder: 'Enter tags separated by ","',
    tagsHelp: 'Separate multiple tags with ","',
    clear: 'Clear filter',
  },
  grid: {
    empty: 'No images to show',
    toggleFit: 'Toggle fit',
    sizeUp: 'Larger',
    sizeDown: 'Smaller',
  },
  action: {
    selectedCount: '{n} selected',
    range: 'A→B',
    rangeHint: 'Choose the start and end',
    rating: 'Rating',
    move: 'Move to folder',
    delete: 'Delete',
    apply: 'Apply',
    confirmDelete: 'Delete {n} items?',
    confirmMove: 'Move {n} items to "{name}"?',
    moveTitle: 'Choose a destination folder',
    ratingFailed: 'Some ratings could not be updated',
    deleteFailed: 'Failed to delete',
    moveFailed: 'Failed to move to the folder',
  },
  auth: {
    title: 'Authentication',
    placeholder: 'Enter password',
    error: 'Incorrect password',
  },
  connection: {
    error: 'Cannot connect to the server',
    retry: 'Retry',
  },
};
