// ============================================
//    Import JSON Config — shared utilities
//    Used by both src/ and src-firefox/
// ============================================

'use strict';

const IMPORT_CATEGORIES = [
  {
    key: 'basic',
    label: '基本',
    items: [
      { key: 'bookSourceUrl', label: '源URL', type: 'state' },
      { key: 'bookSourceName', label: '源名称', type: 'state' },
      { key: 'bookSourceType', label: '书源类型', type: 'state' },
      { key: 'bookUrlPattern', label: 'URL规则', type: 'state' },
      { key: 'header', label: '请求头', type: 'header' },
      { key: 'loginCheckJs', label: '登录检测', type: 'state' },
      { key: 'bookSourceComment', label: '注释', type: 'state' }
    ]
  },
  {
    key: 'search',
    label: '搜索页',
    items: [
      { key: 'searchUrl', label: '搜索URL', type: 'searchUrl' },
      { key: 'bookList', label: '书籍列表', type: 'rule' },
      { key: 'name', label: '书名', type: 'rule' },
      { key: 'author', label: '作者', type: 'rule' },
      { key: 'kind', label: '分类', type: 'rule' },
      { key: 'wordCount', label: '字数', type: 'rule' },
      { key: 'lastChapter', label: '最新章节', type: 'rule' },
      { key: 'intro', label: '简介', type: 'rule' },
      { key: 'coverUrl', label: '封面URL', type: 'rule' },
      { key: 'bookUrl', label: '详情页URL', type: 'rule' },
      { key: 'checkKeyWord', label: '校验关键词', type: 'rule' }
    ]
  },
  {
    key: 'explore',
    label: '发现页',
    items: [
      { key: 'exploreUrl', label: '发现URL', type: 'exploreUrl' },
      { key: 'bookList', label: '书籍列表', type: 'rule' },
      { key: 'name', label: '书名', type: 'rule' },
      { key: 'author', label: '作者', type: 'rule' },
      { key: 'kind', label: '分类', type: 'rule' },
      { key: 'wordCount', label: '字数', type: 'rule' },
      { key: 'lastChapter', label: '最新章节', type: 'rule' },
      { key: 'intro', label: '简介', type: 'rule' },
      { key: 'coverUrl', label: '封面URL', type: 'rule' },
      { key: 'bookUrl', label: '详情页URL', type: 'rule' }
    ]
  },
  {
    key: 'bookInfo',
    label: '详情页',
    items: [
      { key: 'name', label: '书名', type: 'rule' },
      { key: 'author', label: '作者', type: 'rule' },
      { key: 'kind', label: '分类', type: 'rule' },
      { key: 'wordCount', label: '字数', type: 'rule' },
      { key: 'lastChapter', label: '最新章节', type: 'rule' },
      { key: 'intro', label: '简介', type: 'rule' },
      { key: 'coverUrl', label: '封面URL', type: 'rule' },
      { key: 'tocUrl', label: '目录链接', type: 'rule' }
    ]
  },
  {
    key: 'toc',
    label: '目录页',
    items: [
      { key: 'chapterList', label: '目录列表', type: 'rule' },
      { key: 'chapterName', label: '章节名称', type: 'rule' },
      { key: 'chapterUrl', label: '章节链接', type: 'rule' },
      { key: 'isVolume', label: '卷名标识', type: 'rule' },
      { key: 'updateTime', label: '更新时间', type: 'rule' },
      { key: 'isVip', label: 'VIP标识', type: 'rule' },
      { key: 'isPay', label: '付费标识', type: 'rule' },
      { key: 'nextTocUrl', label: '下一页目录', type: 'rule' }
    ]
  },
  {
    key: 'content',
    label: '正文页',
    items: [
      { key: 'content', label: '正文内容', type: 'rule' },
      { key: 'subContent', label: '后续正文', type: 'rule' },
      { key: 'title', label: '章节标题', type: 'rule' },
      { key: 'nextContentUrl', label: '下一页正文', type: 'rule' },
      { key: 'webJs', label: '脚本注入', type: 'rule' }
    ]
  }
];

/**
 * Build a selection key for an item.
 * Format: "category.itemKey" (e.g., "basic.bookSourceUrl", "search.bookList")
 */
function buildSelectionKey(categoryKey, itemKey) {
  return categoryKey + '.' + itemKey;
}

/**
 * Get the default import selection (all true).
 */
function getDefaultImportSelection() {
  const selection = {};
  IMPORT_CATEGORIES.forEach((cat) => {
    cat.items.forEach((item) => {
      selection[buildSelectionKey(cat.key, item.key)] = true;
    });
  });
  return selection;
}

/**
 * Load import selection from chrome.storage.local.
 * Falls back to default (all true) if not found.
 */
function loadImportSelection(callback) {
  chrome.storage.local.get(['importSelection'], (result) => {
    if (result.importSelection && typeof result.importSelection === 'object') {
      const defaults = getDefaultImportSelection();
      // Merge with defaults so new items are auto-selected
      callback({ ...defaults, ...result.importSelection });
    } else {
      callback(getDefaultImportSelection());
    }
  });
}

/**
 * Save import selection to chrome.storage.local.
 */
function saveImportSelection(selection) {
  chrome.storage.local.set({ importSelection: selection });
}

/**
 * Parse import JSON string. Supports single object or array.
 * Array: takes the first element.
 * Returns parsed object or throws an error with a user-friendly message.
 */
function parseImportJson(jsonStr) {
  if (!jsonStr || !jsonStr.trim()) {
    throw new Error('JSON 内容为空');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('JSON 解析失败: ' + e.message);
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new Error('JSON 数组为空');
    }
    parsed = parsed[0];
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('JSON 格式不正确，需要对象或数组');
  }

  return parsed;
}

/**
 * Check if the current state is effectively empty (all defaults).
 * Used to determine whether to show the cover warning.
 */
function isStateEmpty(st) {
  if (!st) return true;

  // Check basic fields
  if ((st.bookSourceUrl || '').trim()) return false;
  if ((st.bookSourceName || '').trim()) return false;
  if (st.bookSourceType !== 0 && st.bookSourceType !== undefined) return false;
  if ((st.bookUrlPattern || '').trim()) return false;
  if ((st.loginCheckJs || '').trim()) return false;
  if ((st.bookSourceComment || '').trim()) return false;
  if ((st.searchUrl || '').trim()) return false;
  if ((st.exploreUrl || '').trim()) return false;

  // Check header items
  if (Array.isArray(st.headerItems) && st.headerItems.length > 0) {
    const hasNonEmpty = st.headerItems.some((h) => (h.key || '').trim() || (h.value || '').trim());
    if (hasNonEmpty) return false;
  }

  // Check rule fields
  const rules = st.rules || {};
  for (const ruleType of ['search', 'explore', 'bookInfo', 'toc', 'content']) {
    const rule = rules[ruleType];
    if (!rule) continue;
    const fields = rule.fields || {};
    for (const key of Object.keys(fields)) {
      const fd = fields[key];
      if (fd && fd.value && fd.value.trim()) return false;
    }
  }

  return true;
}

/**
 * Build the cover warning HTML string.
 * Returns '' if no warning is needed (all current state is empty).
 */
function buildCoverWarning(parsedJson, st) {
  if (isStateEmpty(st)) return '';

  const importUrl = (parsedJson.bookSourceUrl || '').trim();
  const currentUrl = (st.bookSourceUrl || '').trim();

  if (!importUrl && !currentUrl) return '';

  if (importUrl === currentUrl) {
    return '<div class="import-warning"><span class="import-warning-icon">⚠️</span> 源URL相同，确认覆盖导入？</div>';
  }

  const importUrlDisplay = importUrl || '(空)';
  const currentUrlDisplay = currentUrl || '(空)';
  const urlChangeHtml =
    importUrl !== currentUrl
      ? `<div class="import-warning"><span class="import-warning-icon">⚠️</span> 源URL不同： <code>${escapeHtml(currentUrlDisplay)}</code> → <code>${escapeHtml(importUrlDisplay)}</code></div>`
      : '';

  return urlChangeHtml;
}

/**
 * Apply imported JSON data to the state object based on user selection.
 * This function MUTATES the state object in-place.
 * If a selected field has a value in JSON, it overwrites.
 * If a selected field is empty/null/undefined in JSON, it also overwrites (clears).
 *
 * @param {object} st - The current state object (will be mutated)
 * @param {object} parsedJson - The parsed JSON data to import
 * @param {object} selection - Map of selectionKey -> boolean
 */
function applyImportToState(st, parsedJson, selection) {
  IMPORT_CATEGORIES.forEach((cat) => {
    cat.items.forEach((item) => {
      const selKey = buildSelectionKey(cat.key, item.key);
      if (!selection[selKey]) return; // User didn't select this item

      const jsonVal = getJsonValue(parsedJson, cat.key, item.key, item.type);

      switch (item.type) {
        case 'state':
          applyStateField(st, item.key, jsonVal);
          break;
        case 'header':
          applyHeader(st, jsonVal);
          break;
        case 'searchUrl':
          applySearchUrl(st, jsonVal);
          break;
        case 'exploreUrl':
          applyExploreUrl(st, jsonVal);
          break;
        case 'rule':
          applyRuleField(st, cat.key, item.key, jsonVal);
          break;
      }
    });
  });
}

/**
 * Extract a value from parsed JSON using the mapping.
 */
function getJsonValue(parsedJson, categoryKey, itemKey, itemType) {
  // Non-rule types come from top-level JSON fields
  if (itemType === 'searchUrl') return parsedJson.searchUrl;
  if (itemType === 'exploreUrl') return parsedJson.exploreUrl;
  if (itemType === 'header') return parsedJson.header;
  if (itemType === 'state') return parsedJson[itemKey];

  // Rule type: look inside ruleSearch / ruleExplore / ruleBookInfo / etc.
  const ruleTypeMap = {
    search: 'ruleSearch',
    explore: 'ruleExplore',
    bookInfo: 'ruleBookInfo',
    toc: 'ruleToc',
    content: 'ruleContent'
  };
  const jsonKey = ruleTypeMap[categoryKey];
  if (jsonKey) {
    const ruleObj = parsedJson[jsonKey];
    if (ruleObj && typeof ruleObj === 'object') {
      return ruleObj[itemKey];
    }
  }
  return undefined;
}

function applyStateField(st, key, value) {
  if (key === 'bookSourceType') {
    st[key] = value != null ? Number(value) || 0 : 0;
  } else {
    st[key] = value != null ? String(value).trim() : '';
  }
}

function applyHeader(st, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    // Convert object header to array of {key, value} pairs
    st.headerItems = Object.entries(value)
      .filter(([k]) => k != null)
      .map(([k, v]) => ({ key: String(k).trim(), value: v != null ? String(v).trim() : '' }));
  } else if (value === '' || value === null || value === undefined) {
    // Clear headers if value is empty
    st.headerItems = [];
  }
  // If value is an array, string, or other type, don't touch headers
}

function applySearchUrl(st, value) {
  st.searchUrl = value != null ? String(value).trim() : '';
}

function applyExploreUrl(st, value) {
  st.exploreUrl = value != null ? String(value).trim() : '';
}

/**
 * Parse an exploreUrl string into explore items array.
 * Supports:
 *   Format 1: "key::url\nkey::url" (newline-separated title::url pairs)
 *   Format 2: JSON array string "[{\"title\":\"...\",\"url\":\"...\"}]"
 */
function parseExploreUrlToItems(exploreUrlStr) {
  if (!exploreUrlStr || !exploreUrlStr.trim()) return [];

  // Try format 2 (JSON array)
  try {
    const parsed = JSON.parse(exploreUrlStr);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        title: item.title || '',
        url: item.url || '',
        isSeparator: Boolean(item.isSeparator),
        style: item.style || {}
      }));
    }
  } catch (e) {
    // Not JSON, try format 1
  }

  // Format 1: "title::url" lines
  return exploreUrlStr
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const idx = line.indexOf('::');
      if (idx > 0) {
        return { title: line.substring(0, idx), url: line.substring(idx + 2), isSeparator: false, style: {} };
      }
      return { title: line, url: '', isSeparator: true, style: {} };
    });
}

function applyRuleField(st, ruleType, fieldKey, value) {
  if (!st.rules) st.rules = {};
  if (!st.rules[ruleType]) {
    st.rules[ruleType] = { currentStep: 0, fields: {}, fieldStates: {}, bookListSelector: null };
  }

  const rule = st.rules[ruleType];
  if (!rule.fields) rule.fields = {};
  if (!rule.fieldStates) rule.fieldStates = {};

  const strValue = value != null ? String(value).trim() : '';

  rule.fields[fieldKey] = {
    value: strValue,
    state: strValue ? 'selected' : 'pending',
    rawSelector: '',
    tagName: '',
    previews: []
  };
  rule.fieldStates[fieldKey] = strValue ? 'selected' : 'pending';
}
