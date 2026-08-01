const RULE_TYPE_ORDER = ['search', 'explore', 'bookInfo', 'toc', 'content'];

const LIST_FIELD_KEYS = ['bookList', 'chapterList'];
const LIST_SCOPED_FIELDS = {
  explore: ['name', 'author', 'kind', 'wordCount', 'lastChapter', 'intro', 'coverUrl', 'bookUrl'],
  search: ['name', 'author', 'kind', 'wordCount', 'lastChapter', 'intro', 'coverUrl', 'bookUrl', 'checkKeyWord'],
  toc: ['chapterName', 'chapterUrl', 'isVolume', 'updateTime', 'isVip', 'isPay']
};
const DEBUG_PREFIX = '<js>java.log("输入:" + result);</js>';
const NEXT_PAGE_QUICK_INSERT_RULE = 'text.下一页@href';
const NEXT_PAGE_QUICK_INSERT_FIELDS = ['nextTocUrl', 'nextContentUrl'];

const RULE_TYPES = {
  explore: {
    label: '发现页',
    fields: [
      { key: 'bookList', label: '书籍列表', required: false },
      { key: 'name', label: '书名', required: false },
      { key: 'author', label: '作者', required: false },
      { key: 'kind', label: '分类', required: false },
      { key: 'wordCount', label: '字数', required: false },
      { key: 'lastChapter', label: '最新章节', required: false },
      { key: 'intro', label: '简介', required: false },
      { key: 'coverUrl', label: '封面URL', required: false },
      { key: 'bookUrl', label: '详情页URL', required: false }
    ]
  },
  search: {
    label: '搜索页',
    fields: [
      { key: 'bookList', label: '书籍列表', required: false },
      { key: 'name', label: '书名', required: false },
      { key: 'author', label: '作者', required: false },
      { key: 'kind', label: '分类', required: false },
      { key: 'wordCount', label: '字数', required: false },
      { key: 'lastChapter', label: '最新章节', required: false },
      { key: 'intro', label: '简介', required: false },
      { key: 'coverUrl', label: '封面URL', required: false },
      { key: 'bookUrl', label: '详情页URL', required: false },
      { key: 'checkKeyWord', label: '校验关键词', required: false }
    ]
  },
  bookInfo: {
    label: '详情页',
    fields: [
      { key: 'name', label: '书名', required: false },
      { key: 'author', label: '作者', required: false },
      { key: 'kind', label: '分类', required: false },
      { key: 'wordCount', label: '字数', required: false },
      { key: 'lastChapter', label: '最新章节', required: false },
      { key: 'intro', label: '简介', required: false },
      { key: 'coverUrl', label: '封面URL', required: false },
      { key: 'tocUrl', label: '目录链接', required: false }
    ]
  },
  toc: {
    label: '目录页',
    fields: [
      { key: 'chapterList', label: '目录列表', required: false },
      { key: 'chapterName', label: '章节名称', required: false },
      { key: 'chapterUrl', label: '章节链接', required: false },
      { key: 'isVolume', label: '卷名标识', required: false },
      { key: 'updateTime', label: '更新时间', required: false },
      { key: 'isVip', label: 'VIP标识', required: false },
      { key: 'isPay', label: '付费标识', required: false },
      { key: 'nextTocUrl', label: '下一页目录', required: false }
    ]
  },
  content: {
    label: '正文页',
    fields: [
      { key: 'content', label: '正文内容', required: false },
      { key: 'subContent', label: '后续正文', required: false },
      { key: 'title', label: '章节标题', required: false },
      { key: 'nextContentUrl', label: '下一页正文', required: false },
      { key: 'webJs', label: '脚本注入', required: false }
    ]
  }
};

const DEFAULT_STATE = Object.freeze({
  activeMode: 'basic',
  activeRuleType: 'search',
  rules: {
    explore: { currentStep: 0, fields: {}, fieldStates: {}, bookListSelector: null },
    search: { currentStep: 0, fields: {}, fieldStates: {}, bookListSelector: null },
    bookInfo: { currentStep: 0, fields: {}, fieldStates: {}, bookListSelector: null },
    toc: { currentStep: 0, fields: {}, fieldStates: {}, bookListSelector: null },
    content: { currentStep: 0, fields: {}, fieldStates: {}, bookListSelector: null }
  },
  exploreUrl: '',
  searchUrl: '',
  bookSourceType: 0,
  bookSourceName: '',
  bookSourceUrl: '',
  bookUrlPattern: '',
  // Captured search configuration
  searchConfig: null, // { method, url, charset, body, pageTemplate }
  headerItems: [],
  bookSourceComment: '',
  loginCheckJs: ''
});

let state = structuredClone(DEFAULT_STATE);

const CF_LOGIN_CHECK_JS = `var resultUrl = result.url();
var resultCode = result.code();
var resultBoDy = result.body();
if (/_cf_|ge_ua|verify.php/gi.test(resultBoDy) && resultCode >= 403) {
  if (key) {
    url = baseUrl + java.ruleUrl;
  }
  cookie.removeCookie(baseUrl);
  result = java.startBrowserAwait(resultUrl, "验证", false);
  if (key) {
    url =
      org.jsoup.Jsoup.parse(result.body())
        .select('meta[property="og:url"]')
        .attr("content") || url;
  }
}
result;`;

function getFields() {
  return RULE_TYPES[state.activeRuleType].fields;
}

function getRuleState() {
  return state.rules[state.activeRuleType];
}

function isListFieldKey(fieldKey) {
  return LIST_FIELD_KEYS.includes(fieldKey);
}

function isListScopedField(ruleType, fieldKey) {
  return (LIST_SCOPED_FIELDS[ruleType] || []).includes(fieldKey);
}

function isNextPageQuickInsertField(fieldKey) {
  return NEXT_PAGE_QUICK_INSERT_FIELDS.includes(fieldKey);
}

function renderModeTabs() {
  const container = document.getElementById('modeTabs');
  if (!container) return;

  const modes = [
    { key: 'basic', label: '基本' },
    { key: 'searchUrl', label: '搜索URL' },
    { key: 'exploreUrl', label: '发现页URL' },
    { key: 'rules', label: '规则' }
  ];

  container.innerHTML = modes
    .map((m) => {
      const active = m.key === state.activeMode ? ' active' : '';
      return `<button class="rule-tab${active}" data-mode="${m.key}">${m.label}</button>`;
    })
    .join('');

  container.querySelectorAll('.rule-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeMode = btn.dataset.mode;
      saveState();
      renderModeTabs();
      updateEditorVisibility();
    });
  });
}

function updateEditorVisibility() {
  const searchEditor = document.getElementById('searchUrlEditor');
  const exploreEditor = document.getElementById('exploreUrlEditor');
  const advancedPanel = document.getElementById('advancedPanel');
  const ruleTabs = document.getElementById('ruleTypeTabs');
  const stepIndicator = document.querySelector('.step-indicator');
  const formArea = document.querySelector('.form-area');
  const navButtons = document.getElementById('navButtons');

  if (state.activeMode === 'basic') {
    searchEditor?.classList.add('hidden');
    exploreEditor?.classList.add('hidden');
    advancedPanel?.classList.remove('hidden');
    ruleTabs?.classList.add('hidden');
    stepIndicator?.classList.add('hidden');
    formArea?.classList.add('hidden');
    navButtons?.classList.add('hidden');
  } else if (state.activeMode === 'searchUrl') {
    searchEditor?.classList.remove('hidden');
    exploreEditor?.classList.add('hidden');
    advancedPanel?.classList.add('hidden');
    ruleTabs?.classList.add('hidden');
    stepIndicator?.classList.add('hidden');
    formArea?.classList.add('hidden');
    navButtons?.classList.add('hidden');
  } else if (state.activeMode === 'exploreUrl') {
    searchEditor?.classList.add('hidden');
    exploreEditor?.classList.remove('hidden');
    advancedPanel?.classList.add('hidden');
    ruleTabs?.classList.add('hidden');
    stepIndicator?.classList.add('hidden');
    formArea?.classList.add('hidden');
    navButtons?.classList.add('hidden');
  } else {
    searchEditor?.classList.add('hidden');
    exploreEditor?.classList.add('hidden');
    advancedPanel?.classList.add('hidden');
    ruleTabs?.classList.remove('hidden');
    stepIndicator?.classList.remove('hidden');
    formArea?.classList.remove('hidden');
    navButtons?.classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initExploreEditor();
  renderModeTabs();
  renderRuleTypeTabs();
  renderFields();
  loadState();
  bindEvents();
  bindMessageListener();
});

function loadState() {
  chrome.storage.local.get(['legadoSourceState'], (result) => {
    if (result.legadoSourceState) {
      state = { ...state, ...result.legadoSourceState };
      document.getElementById('bookSourceName').value = state.bookSourceName || '';
      document.getElementById('bookSourceUrl').value = state.bookSourceUrl || '';
      document.getElementById('searchUrlTemplate').value = state.searchUrl || '';
      const migrated = Array.isArray(state.headerItems)
        ? state.headerItems
        : [
            { key: 'User-Agent', value: state.advancedHeaderUa || '' },
            { key: 'Referer', value: state.advancedHeaderRefer || '' }
          ].filter((item) => item.value);
      state.headerItems = migrated;
      // Migrate old enableCfShield boolean -> loginCheckJs string
      if (state.enableCfShield === true && !state.loginCheckJs) {
        state.loginCheckJs = CF_LOGIN_CHECK_JS;
        delete state.enableCfShield;
      } else if (state.enableCfShield !== undefined) {
        delete state.enableCfShield;
      }

      const loginCheckJsEl = document.getElementById('loginCheckJs');
      if (loginCheckJsEl) loginCheckJsEl.value = state.loginCheckJs || '';

      const bookUrlPatternEl = document.getElementById('bookUrlPattern');
      if (bookUrlPatternEl) bookUrlPatternEl.value = state.bookUrlPattern || '';

      const bookCommentEl = document.getElementById('bookSourceComment');
      if (bookCommentEl) bookCommentEl.value = state.bookSourceComment || '';

      // Migrate old data: auto-detect JS mode from existing <js> rules
      Object.keys(state.rules || {}).forEach((ruleType) => {
        const rule = state.rules[ruleType];
        Object.keys(rule.fields || {}).forEach((fieldKey) => {
          const fieldData = rule.fields[fieldKey];
          if (fieldData && fieldData.value && fieldData.value.startsWith('<js>')) {
            if (fieldData.useJsIndex === undefined) {
              fieldData.useJsIndex = true;
            }
          }
          if (fieldData && fieldData.useJsIndex === undefined) {
            fieldData.useJsIndex = false;
          }
        });
      });

      setTimeout(() => {
        autoResizeTextarea(document.getElementById('bookSourceName'));
        autoResizeTextarea(document.getElementById('bookSourceUrl'));
        autoResizeTextarea(document.getElementById('searchUrlTemplate'));
      }, 0);
    }

    const contentTypeSelect = document.getElementById('bookSourceTypeSelect');
    if (contentTypeSelect) {
      contentTypeSelect.value = String(state.bookSourceType || 0);
    }

    renderModeTabs();
    renderRuleTypeTabs();
    updateStepIndicator();
    renderFields();
    updateNavButtons();
    renderFieldStatusSummary();
    renderHeaderItems();
    updateEditorVisibility();
  });
}

function getDefaultRefer() {
  const url = (document.getElementById('bookSourceUrl')?.value || '').trim();
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function renderHeaderItems() {
  const container = document.getElementById('advancedHeadersList');
  if (!container) return;
  const items = Array.isArray(state.headerItems) ? state.headerItems : [];
  container.innerHTML = items
    .map((item, index) => {
      const key = (item?.key || '').replace(/"/g, '&quot;');
      const value = (item?.value || '').replace(/"/g, '&quot;');
      return `<div class="advanced-item" data-index="${index}">
      <textarea class="input advanced-key" data-role="key" rows="1" placeholder="键">${key}</textarea>
      <textarea class="input advanced-value" data-role="value" rows="1" placeholder="值">${value}</textarea>
      <button class="btn btn-clear advanced-remove" data-action="remove" type="button">删除</button>
    </div>`;
    })
    .join('');
  container.querySelectorAll('textarea.input').forEach((el) => autoResizeTextarea(el));
}

function collectHeaderItemsFromDom() {
  const container = document.getElementById('advancedHeadersList');
  if (!container) return [];
  const rows = Array.from(container.querySelectorAll('.advanced-item'));
  return rows
    .map((row) => {
      const key = row.querySelector('[data-role="key"]')?.value?.trim() || '';
      const value = row.querySelector('[data-role="value"]')?.value?.trim() || '';
      return { key, value };
    })
    .filter((item) => item.key || item.value);
}

function addHeaderItem(key = '', value = '') {
  if (!Array.isArray(state.headerItems)) state.headerItems = [];
  state.headerItems.push({ key, value });
  renderHeaderItems();
  saveState();
}

function addDefaultUserAgentHeader() {
  if (!Array.isArray(state.headerItems)) state.headerItems = [];
  state.headerItems.push({ key: 'User-Agent', value: navigator.userAgent || '' });
  renderHeaderItems();
  saveState();
}

function addMobileUserAgentHeader() {
  if (!Array.isArray(state.headerItems)) state.headerItems = [];
  state.headerItems.push({ key: 'User-Agent', value: 'java.getWebViewUA()' });
  renderHeaderItems();
  saveState();
}

function addDefaultRefererHeader() {
  if (!Array.isArray(state.headerItems)) state.headerItems = [];
  state.headerItems.push({ key: 'Referer', value: getDefaultRefer() });
  renderHeaderItems();
  saveState();
}

function saveState() {
  state.bookSourceName = document.getElementById('bookSourceName').value;
  state.bookSourceUrl = document.getElementById('bookSourceUrl').value;
  state.searchUrl = document.getElementById('searchUrlTemplate').value;
  state.bookSourceType = Number(document.getElementById('bookSourceTypeSelect')?.value) || 0;
  state.headerItems = collectHeaderItemsFromDom();
  const loginCheckJsEl = document.getElementById('loginCheckJs');
  state.loginCheckJs = loginCheckJsEl ? loginCheckJsEl.value : '';
  state.bookUrlPattern = document.getElementById('bookUrlPattern')?.value || '';
  state.bookSourceComment = document.getElementById('bookSourceComment')?.value || '';
  chrome.storage.local.set({ legadoSourceState: state });
}

function syncSearchUrlState() {
  state.searchUrl = document.getElementById('searchUrlTemplate').value;
  chrome.storage.local.set({ legadoSourceState: state });
}

function buildJsRule(body, returnsList = false) {
  const catchReturnExpr = returnsList ? '[""+e]' : '""+e';
  return `<js>(function(result){
    try{
${body}
    }catch(e){
      return ${catchReturnExpr};
    }
})(result)</js>`;
}

function parseSingleIndex(value) {
  const parsed = value ? parseInt(value, 10) : 0;
  if (!parsed || isNaN(parsed)) return null;
  return parsed > 0 ? parsed - 1 : parsed;
}

function resolveArrayIndex(index, length) {
  return index < 0 ? length + index : index;
}

function buildJsArrayIndexExpr(index, sizeExpr) {
  return index < 0 ? `${sizeExpr} + (${index})` : String(index);
}

/**
 * Build native Legado index selector (non-JS mode).
 * UI inputs are 1-based; native syntax is 0-based.
 */
function buildNativeIndexRule(baseSelector, fieldKey, fieldData, isListField) {
  if (isListField) {
    const start = fieldData.listIndex?.start ? parseInt(fieldData.listIndex.start, 10) : 0;
    const end = fieldData.listIndex?.end ? parseInt(fieldData.listIndex.end, 10) : 0;

    if (isNaN(start) || isNaN(end)) return baseSelector;

    // Default: no filter (start=1 or empty, end=-1/0 or empty)
    if ((!start || start <= 1) && (!end || end === 0 || end === -1)) {
      return baseSelector;
    }

    const nativeStart = start > 1 ? start - 1 : '';
    const nativeEnd = end > 0 ? end - 1 : end < 0 ? end : '';

    if (nativeStart === '' && nativeEnd === '') return baseSelector;
    if (nativeStart === '' && nativeEnd !== '') return `${baseSelector}[:${nativeEnd}]`;
    if (nativeStart !== '' && nativeEnd === '') return `${baseSelector}[${nativeStart}:]`;
    return `${baseSelector}[${nativeStart}:${nativeEnd}]`;
  }

  // Non-list field: single index
  const singleVal = fieldData.listIndex?.single ? parseInt(fieldData.listIndex.single, 10) : 0;
  const tagName = fieldData.tagName || '';
  const listItemTag = fieldData.listItemTagName || '';

  const linkFields = ['bookUrl', 'chapterUrl', 'tocUrl', 'nextTocUrl', 'nextContentUrl'];
  if (listItemTag === 'a' && linkFields.includes(fieldKey)) {
    if (!singleVal || isNaN(singleVal) || singleVal === 0) {
      return 'a@href';
    }
    const index = parseSingleIndex(fieldData.listIndex?.single);
    return `a.${index}@href`;
  }

  if (!singleVal || isNaN(singleVal) || singleVal === 0) {
    return buildAtSelector(baseSelector, fieldKey, tagName, listItemTag);
  }

  const index = parseSingleIndex(fieldData.listIndex?.single);
  const atPart = buildAtSelector('', fieldKey, tagName, listItemTag);
  return `${baseSelector}.${index}${atPart}`;
}

function buildJsIndexRule(baseSelector, fieldKey, fieldData, isListField) {
  if (isListField) {
    const { start, end } = fieldData.listIndex || {};
    const startVal = start ? parseInt(start, 10) : 0;
    const endVal = end ? parseInt(end, 10) : 0;

    let endExpr;
    if (endVal > 0) {
      endExpr = String(endVal);
    } else if (endVal === -1) {
      endExpr = 'list.size()';
    } else if (endVal < -1) {
      endExpr = `list.size() + (${endVal}) + 1`;
    } else {
      endExpr = 'list.size()';
    }

    const startExpr = startVal > 1 ? startVal - 1 : 0;
    if (startVal > 1 || endVal > 0 || endVal < -1) {
      return buildJsRule(
        `        var doc = org.jsoup.Jsoup.parse(result);
        var list = doc.select("${baseSelector}");
        var start = ${startExpr};
        var end = ${endExpr};
        var result = new org.jsoup.select.Elements();
        for (var i = start; i < end; i++) {
          result.add(list.get(i));
        }
        return result;`,
        true
      );
    }

    return buildJsRule(
      `        var doc = org.jsoup.Jsoup.parse(result);
        var list = doc.select("${baseSelector}");
        return list;`,
      true
    );
  }

  const selectedTag = fieldData.tagName || '';
  const listItemTag = fieldData.listItemTagName || '';
  const singleVal = fieldData.listIndex?.single ? parseInt(fieldData.listIndex.single, 10) : 0;

  // JS mode: no index means first match (equivalent to native @ rule);
  // only fall back to native when the index input is invalid
  let index = parseSingleIndex(fieldData.listIndex?.single);
  if (index === null) {
    if (singleVal === 0) {
      index = 0;
    } else {
      return buildAtSelector(baseSelector, fieldKey, selectedTag, listItemTag);
    }
  }

  let matchSelector = baseSelector;
  let returnExpr;
  if (LINK_FIELDS.includes(fieldKey)) {
    matchSelector = listItemTag === 'a' ? 'a' : baseSelector + (selectedTag === 'a' ? '' : ' a');
    returnExpr = 'String(matches.get(index).attr("href"))';
  } else if (fieldKey === 'coverUrl') {
    matchSelector = baseSelector + (selectedTag === 'img' ? '' : ' img');
    returnExpr = 'String(matches.get(index).attr("src"))';
  } else {
    returnExpr = 'String(matches.get(index).text())';
  }
  const indexExpr = buildJsArrayIndexExpr(index, 'matches.size()');

  return buildJsRule(`    var doc = org.jsoup.Jsoup.parse(result);
    var matches = doc.select("${matchSelector}");
    var index = ${indexExpr};
    return ${returnExpr};`);
}

function buildIndexedRule(baseSelector, fieldKey, fieldData, isListField) {
  if (fieldData.useJsIndex) {
    return buildJsIndexRule(baseSelector, fieldKey, fieldData, isListField);
  }
  return buildNativeIndexRule(baseSelector, fieldKey, fieldData, isListField);
}

function renderRuleTypeTabs() {
  const container = document.getElementById('ruleTypeTabs');
  if (!container) return;

  container.innerHTML = RULE_TYPE_ORDER.map((key) => {
    const cfg = RULE_TYPES[key];
    const active = key === state.activeRuleType ? ' active' : '';
    return `<button class="rule-tab${active}" data-type="${key}">${cfg.label}</button>`;
  }).join('');

  container.querySelectorAll('.rule-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeRuleType = btn.dataset.type;
      saveState();
      renderRuleTypeTabs();
      updateStepIndicator();
      renderFields();
      updateNavButtons();
      renderFieldStatusSummary();
    });
  });
}

function updateStepIndicator() {
  const stepText = document.getElementById('stepText');
  if (!stepText) return;
  const fields = getFields();
  const rule = getRuleState();
  if (rule.currentStep === fields.length) {
    stepText.innerHTML = `汇总: ${fields.length} 个字段`;
    return;
  }
  const field = fields[rule.currentStep];
  stepText.innerHTML = `<span class="step-num">${rule.currentStep + 1}/${fields.length}</span> ${field.label}${field.required ? ' <span class="required">*</span>' : ''}`;
}

function renderFields() {
  const container = document.getElementById('fieldContainer');
  const fields = getFields();
  const rule = getRuleState();

  if (rule.currentStep === fields.length) {
    renderSummaryView(container);
    return;
  }

  const field = fields[rule.currentStep];
  const fieldData = rule.fields[field.key] || {};

  if (field.key === 'webJs') {
    const value = fieldData.value || '';
    container.innerHTML = `
      <div class="field-item">
        <label>${field.label}</label>
        <div class="field-value">
          <textarea id="fieldValue" class="input" rows="1"
            placeholder="请输入脚本内容">${escapeHtml(value)}</textarea>
        </div>
        <div class="field-actions">
          <button id="lazyLoadBtn" class="btn btn-action">懒加载</button>
          <button id="clearBtn" class="btn btn-action btn-clear">清空</button>
        </div>
      </div>
    `;
    const textarea = document.getElementById('fieldValue');
    textarea.addEventListener('input', handleWebJsInput);
    autoResizeTextarea(textarea);
    document.getElementById('clearBtn').addEventListener('click', handleClearField);
    document.getElementById('lazyLoadBtn').addEventListener('click', () => {
      const contentField = state.rules.content?.fields?.content;
      if (contentField?.rawSelector) {
        document.getElementById('lazySelector').value = contentField.rawSelector;
      }
      document.getElementById('lazyLoadModal').classList.remove('hidden');
    });
    return;
  }

  const fieldState = rule.fieldStates[field.key] || 'pending';
  const isLinkField = LINK_FIELDS.includes(field.key);
  const rawValue = fieldData.value || '';
  const value = fieldData.webView && isLinkField && rawValue ? applyWebView(rawValue) : rawValue;
  const isNativeListField = isListFieldKey(field.key);
  const isPickerListField = isNativeListField;
  const fieldIndex = fieldData.listIndex || {};

  // Get list field's index range for non-list fields so they respect the list range
  let listIndexRange = null;
  if (!isPickerListField && isListScopedField(state.activeRuleType, field.key)) {
    const listFields = fields.filter((f) => isListFieldKey(f.key));
    if (listFields.length > 0) {
      const listFieldData = rule.fields[listFields[0].key] || {};
      listIndexRange = listFieldData.listIndex || null;
    }
  }

  const filteredPreviews = fieldData.previews
    ? filterPreviewsByIndex(fieldData.previews, fieldIndex, isPickerListField, listIndexRange)
    : fieldData.previews;

  const useJsIndex = fieldData.useJsIndex || false;
  const nextPageQuickInsertHTML = isNextPageQuickInsertField(field.key)
    ? `<button id="quickNextPageRuleBtn" class="btn btn-action" title="插入 ${escapeHtml(NEXT_PAGE_QUICK_INSERT_RULE)}">预设规则</button>`
    : '';

  const indexHTML = isNativeListField
    ? `<div class="index-row">
        <div class="index-mode-row">
          <div style="display:flex;align-items:center;gap:8px">
            <label class="index-mode-label" title="原生模式生成更简洁的规则；JS模式支持更复杂的自定义逻辑">
              <input type="checkbox" id="useJsIndex" ${useJsIndex ? 'checked' : ''}>
              JS 脚本模式
            </label>
            <label class="index-mode-label" title="启用后将在规则前插入调试日志">
              <input type="checkbox" id="debugCheckbox" ${fieldData.debug ? 'checked' : ''}>
              调试模式
            </label>
          </div>
        </div>
        <div class="index-label-row">
          <label>索引范围</label>
          <button id="indexTutorialBtn" class="btn btn-secondary">教程</button>
        </div>
        <div class="index-inputs">
          <input type="text" id="indexStart" class="input input--center input--50" value="${escapeHtml(fieldIndex.start || '')}" placeholder="1">
          <span class="index-sep">至</span>
          <input type="text" id="indexEnd" class="input input--center input--50" value="${escapeHtml(fieldIndex.end || '')}" placeholder="-1">
          <button id="indexApplyBtn" class="btn btn-action btn-index-apply">确认</button>
        </div>
      </div>`
    : `<div class="index-row index-row-single">
        <div class="index-mode-row">
          <div style="display:flex;align-items:center;gap:8px">
            <label class="index-mode-label" title="原生模式生成更简洁的规则；JS模式支持更复杂的自定义逻辑">
              <input type="checkbox" id="useJsIndex" ${useJsIndex ? 'checked' : ''}>
              JS 脚本模式
            </label>
            <label class="index-mode-label" title="启用后将在规则前插入调试日志">
              <input type="checkbox" id="debugCheckbox" ${fieldData.debug ? 'checked' : ''}>
              调试模式
            </label>
          </div>
        </div>
        <div class="index-label-row">
          <label>索引</label>
          <button id="indexTutorialBtn" class="btn btn-secondary">教程</button>
        </div>
        <div class="index-inputs-single">
          <input type="text" id="indexSingle" class="input input--center input--50" value="${escapeHtml(fieldIndex.single || '')}" placeholder="1">
          <button id="indexApplyBtn" class="btn btn-action btn-index-apply">确认</button>
        </div>
      </div>`;

  container.innerHTML = `
    <div class="field-item">
      <label>${field.label}${field.required ? ' <span class="required">*</span>' : ''}</label>
      <div class="field-value">
        <textarea id="fieldValue" class="input" rows="1"
          placeholder="请输入或选择">${escapeHtml(value)}</textarea>
      </div>
      <div class="field-actions">
        <button id="selectBtn" class="btn btn-primary" ${fieldState === 'picking' ? 'disabled' : ''}>
          ${fieldState === 'picking' ? '选择中...' : '选择元素'}
        </button>
        ${fieldState === 'picking' ? `<button id="cancelBtn" class="btn btn-action btn-cancel">取消选择</button>` : ''}
        <button id="confirmBtn" class="btn btn-action">确认输入</button>
        ${nextPageQuickInsertHTML}
        ${isLinkField ? `<button id="webViewBtn" class="btn btn-action${fieldData.webView ? ' btn-active' : ''}">webView${fieldData.webView ? ' ✓' : ''}</button>` : ''}
        ${fieldState === 'selected' ? `<button id="clearBtn" class="btn btn-action btn-clear">清空</button>` : ''}
      </div>
      ${indexHTML}
      ${
        isPickerListField
          ? `
      <div class="list-hint">⚠️ <strong>需要选择两个同列表元素</strong>，自动提取交集生成选择器</div>
      `
          : ''
      }
      ${
        fieldState === 'selected' && (fieldData.rawSelector || fieldData.value)
          ? `
        <div class="selector-info">
          <span class="selector-label">规则:</span>
          <code class="selector-value">${escapeHtml(fieldData.value || fieldData.rawSelector || '')}</code>
        </div>
        ${
          filteredPreviews && filteredPreviews.length > 0
            ? `
          <div class="preview-section">
            <div class="preview-header" data-toggle="preview">
              <span class="preview-toggle">▶</span>
              预览 (${filteredPreviews.length} 个匹配)
            </div>
            <div class="preview-list hidden">
              ${filteredPreviews
                .map((p, i) => {
                  const ep = applyPreviewExtraction(p, fieldData.value);
                  return `
                <div class="preview-item">
                  <div class="preview-item-header">
                    <span class="preview-index">#${i + 1}</span>
                    <span class="preview-text">${escapeHtml((ep.text || '').substring(0, 80))}${(ep.text || '').length > 80 ? '...' : ''}</span>
                  </div>
                  ${ep.html ? `<div class="preview-html"><pre class="preview-code">${escapeHtml(ep.html)}</pre></div>` : ''}
                </div>`;
                })
                .join('')}
            </div>
          </div>
        `
            : ''
        }
      `
          : ''
      }
    </div>
  `;

  bindFieldEvents();
}

function renderSummaryView(container) {
  const fields = getFields();
  const rule = getRuleState();

  const rows = fields
    .map((f, index) => {
      const fieldState = rule.fieldStates[f.key] || 'pending';
      const fieldData = rule.fields[f.key] || {};
      const stateDot = `<span class="state-dot state-dot--${fieldState}" title="${fieldState === 'selected' ? '已配置' : fieldState === 'picking' ? '选择中' : '未配置'}"></span>`;

      const isLinkField = LINK_FIELDS.includes(f.key);
      const rawValue = fieldData.value || '';
      const value = fieldData.webView && isLinkField && rawValue ? applyWebView(rawValue) : rawValue;

      return `
      <div class="summary-row" data-step-index="${index}">
        <div class="summary-field-info">
          ${stateDot}
          <span class="summary-field-name" data-step-index="${index}">${f.label}${f.required ? ' <span class="required">*</span>' : ''}</span>
        </div>
        <textarea class="input summary-field-value" rows="1" data-field-key="${f.key}" placeholder="未配置">${escapeHtml(value)}</textarea>
      </div>
    `;
    })
    .join('');

  container.innerHTML = `
    <div class="field-item summary-view">
      <label>规则汇总</label>
      <div class="summary-list">
        ${rows}
      </div>
    </div>
  `;

  // Bind field name click to jump
  container.querySelectorAll('.summary-field-name').forEach((el) => {
    el.addEventListener('click', () => {
      const stepIndex = parseInt(el.dataset.stepIndex, 10);
      if (!Number.isNaN(stepIndex)) {
        goToStep(stepIndex);
      }
    });
  });

  // Bind textarea input to save
  container.querySelectorAll('.summary-field-value').forEach((el) => {
    autoResizeTextarea(el);
    el.addEventListener('input', (e) => {
      const key = e.target.dataset.fieldKey;
      if (!key) return;
      let value = e.target.value;
      const fieldData = rule.fields[key] || {};
      // Strip webView suffix if applicable before saving
      if (fieldData.webView && LINK_FIELDS.includes(key)) {
        value = stripWebView(value);
      }
      if (!rule.fields[key]) {
        rule.fields[key] = { value: '', state: 'selected', rawSelector: '' };
      }
      rule.fields[key].value = value;
      rule.fields[key].state = 'selected';
      rule.fieldStates[key] = 'selected';
      saveState();
      renderFieldStatusSummary();
    });
  });
}

function bindFieldEvents() {
  const selectBtn = document.getElementById('selectBtn');
  if (selectBtn) selectBtn.addEventListener('click', handleSelectElement);
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', handleCancelSelection);
  const confirmBtn = document.getElementById('confirmBtn');
  if (confirmBtn)
    confirmBtn.addEventListener('click', () => {
      document.getElementById('fieldValue')?.blur();
    });
  const fieldValue = document.getElementById('fieldValue');
  if (fieldValue) {
    fieldValue.addEventListener('input', handleFieldInput);
    fieldValue.addEventListener('blur', handleFieldBlur);
    autoResizeTextarea(fieldValue);
  }
  const quickNextPageRuleBtn = document.getElementById('quickNextPageRuleBtn');
  if (quickNextPageRuleBtn) {
    quickNextPageRuleBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    quickNextPageRuleBtn.addEventListener('click', handleQuickNextPageRuleInsert);
  }
  const indexStart = document.getElementById('indexStart');
  if (indexStart) indexStart.addEventListener('input', handleIndexInput);
  const indexEnd = document.getElementById('indexEnd');
  if (indexEnd) indexEnd.addEventListener('input', handleIndexInput);
  const indexSingle = document.getElementById('indexSingle');
  if (indexSingle) indexSingle.addEventListener('input', handleIndexInput);
  const indexApplyBtn = document.getElementById('indexApplyBtn');
  if (indexApplyBtn) indexApplyBtn.addEventListener('click', handleIndexApply);
  const useJsIndexCb = document.getElementById('useJsIndex');
  if (useJsIndexCb) useJsIndexCb.addEventListener('change', handleUseJsIndexChange);
  const indexTutorialBtn = document.getElementById('indexTutorialBtn');
  if (indexTutorialBtn) {
    indexTutorialBtn.addEventListener('click', () => {
      document.getElementById('indexTutorialModal')?.classList.remove('hidden');
    });
  }
  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) clearBtn.addEventListener('click', handleClearField);
  const webViewBtn = document.getElementById('webViewBtn');
  if (webViewBtn) {
    webViewBtn.addEventListener('click', () => {
      const fields = getFields();
      const rule = getRuleState();
      const field = fields[rule.currentStep];
      if (!rule.fields[field.key]) rule.fields[field.key] = {};
      rule.fields[field.key].webView = !rule.fields[field.key].webView;
      saveState();
      renderFields();
    });
  }
  const debugCheckbox = document.getElementById('debugCheckbox');
  if (debugCheckbox) {
    debugCheckbox.addEventListener('change', (e) => {
      const fields = getFields();
      const rule = getRuleState();
      const field = fields[rule.currentStep];
      if (!rule.fields[field.key]) rule.fields[field.key] = {};
      const fieldData = rule.fields[field.key];

      if (e.target.checked) {
        if (!fieldData.value) {
          fieldData.value = DEBUG_PREFIX;
        } else {
          fieldData.value = applyDebugPrefix(fieldData.value, true);
        }
      } else if (fieldData.value) {
        fieldData.value = applyDebugPrefix(fieldData.value, false);
      }
      fieldData.debug = e.target.checked;

      saveState();
      renderFields();
    });
  }
}

function handleSelectElement() {
  const fields = getFields();
  const rule = getRuleState();
  const field = fields[rule.currentStep];

  const isListField = isListFieldKey(field.key);
  const useListScope = isListScopedField(state.activeRuleType, field.key);

  if (useListScope && !rule.bookListSelector) {
    return;
  }

  let itemSelector = '';
  let rootSelector = '';
  if (rule.bookListSelector && useListScope) {
    itemSelector = rule.bookListSelector;
    rootSelector = rule.bookListSelector;
  }

  rule.fieldStates[field.key] = 'picking';
  saveState();
  updateStepIndicator();
  renderFields();
  renderFieldStatusSummary();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    const tabId = tabs[0].id;

    chrome.tabs.sendMessage(
      tabId,
      { action: 'startPicker', step: field.key, isListField, rootSelector, itemSelector },
      (response) => {
        if (chrome.runtime.lastError) {
          reInjectContentScript(tabId, field.key, isListField, rootSelector, itemSelector);
        }
      }
    );
  });
}

function reInjectContentScript(tabId, step, isListField, rootSelector, itemSelector) {
  const injectJS =
    typeof chrome.scripting !== 'undefined'
      ? () =>
          chrome.scripting.executeScript({
            target: { tabId },
            files: ['lib/selector-generator.js', 'content/picker.js']
          })
      : () =>
          new Promise((resolve, reject) => {
            chrome.tabs.executeScript(tabId, { file: '/lib/selector-generator.js' }, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              chrome.tabs.executeScript(tabId, { file: '/content/picker.js' }, () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                  return;
                }
                resolve();
              });
            });
          });

  const injectCSS =
    typeof chrome.scripting !== 'undefined'
      ? () => chrome.scripting.insertCSS({ target: { tabId }, files: ['content/picker.css'] })
      : () =>
          new Promise((resolve) => {
            chrome.tabs.insertCSS(tabId, { file: 'content/picker.css' }, resolve);
          });

  injectJS().then(() => {
    injectCSS();
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { action: 'startPicker', step, isListField, rootSelector, itemSelector });
    }, 200);
  });
}

function handleCancelSelection() {
  const fields = getFields();
  const rule = getRuleState();
  const field = fields[rule.currentStep];

  rule.fieldStates[field.key] = 'pending';
  saveState();
  updateStepIndicator();
  renderFields();
  renderFieldStatusSummary();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'stopPicker' });
    }
  });
}

function resolvePreviewSelector(input) {
  const raw = (input || '').trim();
  if (!raw) return '';

  const canQuery = (sel) => {
    try {
      document.createElement('div').querySelector(sel);
      return true;
    } catch (e) {
      return false;
    }
  };

  if (canQuery(raw)) return raw;

  let candidate = raw
    .replace(/^<js>\s*/i, '')
    .replace(/\s*<\/js>$/i, '')
    .trim();

  candidate = candidate.replace(/\s*@[^@\s]+$/, '').trim();

  if (candidate && canQuery(candidate)) return candidate;

  return '';
}

function stripDebugPrefix(ruleValue) {
  const raw = ruleValue || '';
  return raw.startsWith(DEBUG_PREFIX) ? raw.slice(DEBUG_PREFIX.length) : raw;
}

function applyDebugPrefix(ruleValue, enabled) {
  const raw = ruleValue || '';
  if (!raw) return raw;
  const stripped = stripDebugPrefix(raw);
  return enabled ? DEBUG_PREFIX + stripped : stripped;
}

function parseTextRule(input) {
  const raw = stripDebugPrefix(input || '').trim();
  if (!raw || raw.startsWith('<js>')) return null;

  const match = raw.match(/^text\.([^@]+?)(?:@[^@\s]+)?$/);
  if (!match || !match[1].trim()) return null;

  let text = match[1].trim();
  const indexMatch = text.match(/^(.*)\.(-?\d+)$/);
  const index = indexMatch && indexMatch[1].trim() ? parseInt(indexMatch[2], 10) : null;
  if (index !== null) {
    text = indexMatch[1].trim();
  }

  const attrMatch = raw.match(/@([^@\s]+)$/);
  return { text, attr: attrMatch ? attrMatch[1] : '', index };
}

function buildTextRule(parsed, index) {
  if (!parsed || !parsed.text) return '';
  const indexPart = index === null || index === undefined ? '' : `.${index}`;
  const attrPart = parsed.attr ? `@${parsed.attr}` : '';
  return `text.${parsed.text}${indexPart}${attrPart}`;
}

function resolveTextPreviewRule(input) {
  const parsed = parseTextRule(input);
  return parsed ? stripDebugPrefix(input || '').trim() : '';
}

function buildTextIndexedRule(ruleValue, fieldData, isListField) {
  if (isListField) return '';

  const parsed = parseTextRule(ruleValue);
  if (!parsed) return '';

  const singleVal = fieldData.listIndex?.single ? parseInt(fieldData.listIndex.single, 10) : 0;
  if (!singleVal || isNaN(singleVal) || singleVal === 0) {
    return buildTextRule(parsed, null);
  }

  const index = parseSingleIndex(fieldData.listIndex?.single);
  if (index === null) {
    return buildTextRule(parsed, null);
  }

  return buildTextRule(parsed, index);
}

function buildPreviewMessage(ruleValue, previewSelector) {
  const previewRule = resolveTextPreviewRule(ruleValue);
  if (previewRule) {
    return { action: 'previewRule', rule: previewRule };
  }
  if (previewSelector) {
    return { action: 'previewSelector', selector: previewSelector };
  }
  return null;
}

function requestFieldPreview(fieldKey, ruleValue, previewSelector) {
  if (!ruleValue || ruleValue.startsWith('<js>')) return;

  const message = buildPreviewMessage(ruleValue, previewSelector);
  if (!message) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
      if (chrome.runtime.lastError || !response) return;
      const rule = getRuleState();
      const fieldData = rule.fields[fieldKey];
      if (fieldData) {
        fieldData.previews = response.previews || [];
        saveState();
        renderFields();
      }
    });
  });
}

function previewManualSelector(fieldKey, selector) {
  const previewSelector = resolvePreviewSelector(selector);
  const previewRule = resolveTextPreviewRule(selector);

  // Always set rawSelector so the rule label shows even if preview fails
  const rule = getRuleState();
  const fieldData = rule.fields[fieldKey];
  if (fieldData) {
    fieldData.rawSelector = previewRule || previewSelector || selector;
    // Set bookListSelector for list fields so subsequent fields can scope selection
    if (isListFieldKey(fieldKey)) {
      rule.bookListSelector = previewSelector || selector;
    }
    saveState();
    renderFields();
  }

  requestFieldPreview(fieldKey, selector, previewSelector);
}

function handleClearField() {
  const fields = getFields();
  const rule = getRuleState();
  const field = fields[rule.currentStep];

  delete rule.fields[field.key];
  rule.fieldStates[field.key] = 'pending';

  if (isListFieldKey(field.key)) {
    rule.bookListSelector = null;
  }

  saveState();
  renderFields();
  renderFieldStatusSummary();
  updateStepIndicator();
}

function handleQuickNextPageRuleInsert() {
  const fields = getFields();
  const rule = getRuleState();
  const field = fields[rule.currentStep];

  if (!field || !isNextPageQuickInsertField(field.key)) return;

  if (!rule.fields[field.key]) {
    rule.fields[field.key] = { value: '', state: 'selected', rawSelector: '' };
  }

  const fieldData = rule.fields[field.key];
  const value = applyDebugPrefix(NEXT_PAGE_QUICK_INSERT_RULE, !!fieldData.debug);

  fieldData.value = value;
  fieldData.rawSelector = NEXT_PAGE_QUICK_INSERT_RULE;
  fieldData.state = 'selected';
  rule.fieldStates[field.key] = 'selected';

  saveState();
  renderFieldStatusSummary();
  updateStepIndicator();
  renderFields();

  requestFieldPreview(field.key, NEXT_PAGE_QUICK_INSERT_RULE, '');
}

function handleIndexInput(e) {
  const fields = getFields();
  const rule = getRuleState();
  const field = fields[rule.currentStep];
  const fieldData = rule.fields[field.key] || {};
  if (!fieldData.listIndex) fieldData.listIndex = {};
  if (e.target.id === 'indexSingle') {
    fieldData.listIndex.single = e.target.value;
  } else {
    fieldData.listIndex[e.target.id === 'indexStart' ? 'start' : 'end'] = e.target.value;
  }
  saveState();
}

function handleUseJsIndexChange(e) {
  const fields = getFields();
  const rule = getRuleState();
  const field = fields[rule.currentStep];

  const fieldData = rule.fields[field.key];

  if (!fieldData) return;
  fieldData.useJsIndex = e.target.checked;

  // Auto-regenerate rule if rawSelector exists
  if (fieldData.rawSelector) {
    const isListField = isListFieldKey(field.key);
    const textRule = buildTextIndexedRule(fieldData.rawSelector, fieldData, isListField);
    if (fieldData.useJsIndex) {
      // Trigger JS generation by re-running handleIndexApply logic
      handleIndexApply();
      return;
    } else {
      const nextValue = textRule || buildNativeIndexRule(fieldData.rawSelector, field.key, fieldData, isListField);
      fieldData.value = applyDebugPrefix(nextValue, fieldData.debug);
    }
  }

  saveState();
  renderFields();
}

function handleIndexApply() {
  const fields = getFields();
  const rule = getRuleState();
  const field = fields[rule.currentStep];

  const isListField = isListFieldKey(field.key);

  const fieldData = rule.fields[field.key];
  if (!fieldData || !fieldData.rawSelector) return;

  if (!fieldData.listIndex) fieldData.listIndex = {};

  const baseSelector = fieldData.rawSelector;
  // JS mode: skip text rules when rawSelector is a CSS selector (text-only
  // rules like "text.xxx" have no selector to select, keep them as-is)
  const isTextRule = !isListField && parseTextRule(baseSelector) !== null;
  const textRule =
    fieldData.useJsIndex && !isTextRule ? '' : buildTextIndexedRule(baseSelector, fieldData, isListField);
  const nextValue = textRule || buildIndexedRule(baseSelector, field.key, fieldData, isListField);
  rule.fields[field.key].value = applyDebugPrefix(nextValue, fieldData.debug);

  saveState();
  renderFields();
  renderFieldStatusSummary();
}

/**
 * Apply rule extraction to a preview item based on the rule's @suffix.
 * Generic: @text, @ownText, @textNodes, @html, @outerHtml, @all, @href, @src, @data-*, etc.
 */
function applyPreviewExtraction(p, ruleValue) {
  if (!ruleValue || typeof ruleValue !== 'string') return p;
  if (ruleValue.includes('<js>')) return p;

  const atMatch = ruleValue.match(/@(\w+)$/);
  if (!atMatch) return p;

  const attr = atMatch[1];
  const html = p.html || '';
  if (!html) return p;

  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const el = tmp.firstElementChild;
  if (!el) return p;

  let extracted;
  let sourceHtml = p.html;

  switch (attr) {
    case 'text':
      extracted = el.textContent;
      break;
    case 'ownText':
      // Element's own text, excluding children's text
      extracted = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join('');
      break;
    case 'textNodes':
      // Direct text child nodes, joined with newline
      extracted = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent.trim())
        .filter(Boolean)
        .join('\n');
      break;
    case 'html':
      extracted = el.innerHTML;
      break;
    case 'outerHtml':
      extracted = el.outerHTML;
      break;
    case 'all':
      // All text including children, same as text
      extracted = el.textContent;
      break;
    default:
      // Any attribute: href, src, data-*, id, class, etc.
      extracted = el.getAttribute(attr);
      if (extracted == null) {
        // Fallback: try child element's attribute (e.g., a inside div for @href)
        const child = el.querySelector(`[${attr}]`);
        if (child) {
          extracted = child.getAttribute(attr);
          if (extracted != null) sourceHtml = child.outerHTML;
        }
      }
      if (extracted == null && p.listHtml) {
        // Fallback: try list item's attribute (e.g., <a> wraps clicked <dd>)
        const listTmp = document.createElement('div');
        listTmp.innerHTML = p.listHtml;
        const listEl = listTmp.firstElementChild;
        if (listEl) {
          extracted = listEl.getAttribute(attr);
          if (extracted != null) sourceHtml = p.listHtml;
        }
      }
      break;
  }

  if (extracted == null) return { text: p.text + ` [无${attr}]`, html: p.html };
  return { text: String(extracted).trim(), html: sourceHtml };
}

function filterPreviewsByIndex(previews, index, isListField, listRange) {
  if (!previews || !previews.length) return previews;

  const isGrouped = Array.isArray(previews[0]);

  if (!isListField) {
    // If list field has an index range, slice groups before applying single index
    let groups = previews;
    if (listRange && (listRange.start || listRange.end)) {
      const ls = listRange.start ? parseInt(listRange.start, 10) : 0;
      const le = listRange.end ? parseInt(listRange.end, 10) : groups.length;
      const gs = ls < 0 ? groups.length + ls : Math.max(0, ls - 1);
      const ge = le < 0 ? groups.length + le + 1 : Math.min(groups.length, le);
      groups = groups.slice(gs, ge);
    }

    if (index.single !== undefined && index.single !== '') {
      const itemIndex = parseSingleIndex(index.single);
      if (itemIndex === null) return isGrouped ? groups.flat() : groups;

      if (isGrouped) {
        const placeholder = { text: '', html: '' };
        return groups.map((group) => {
          const i = resolveArrayIndex(itemIndex, group.length);
          return i >= 0 && i < group.length ? group[i] : placeholder;
        });
      }
      const i = resolveArrayIndex(itemIndex, groups.length);
      if (i >= 0 && i < groups.length) {
        return [groups[i]];
      }
      return [];
    }
    return isGrouped ? groups.flat() : groups;
  }

  // List field: flat array, slice by range
  const flat = isGrouped ? previews.flat() : previews;
  const start = index.start ? parseInt(index.start, 10) : 0;
  const end = index.end ? parseInt(index.end, 10) : flat.length;
  const s = start < 0 ? flat.length + start : Math.max(0, start - 1);
  const e = end < 0 ? flat.length + end + 1 : Math.min(flat.length, end);
  return flat.slice(s, e);
}

function handleFieldInput(e) {
  const fields = getFields();
  const rule = getRuleState();
  const field = fields[rule.currentStep];
  let value = e.target.value;

  // Strip webView suffix if the field has webView enabled,
  // so we store the raw rule and apply webView dynamically on export/display
  if (rule.fields[field.key]?.webView && LINK_FIELDS.includes(field.key)) {
    value = stripWebView(value);
  }

  if (!rule.fields[field.key]) {
    rule.fields[field.key] = { value: '', state: 'selected', rawSelector: '' };
  }
  rule.fields[field.key].value = value;
}

function handleWebJsInput(e) {
  const fields = getFields();
  const rule = getRuleState();
  const field = fields[rule.currentStep];
  const value = e.target.value;

  if (!rule.fields[field.key]) {
    rule.fields[field.key] = { value: '', state: 'selected', rawSelector: '' };
  }
  rule.fields[field.key].value = value;
  rule.fields[field.key].state = 'selected';
  rule.fieldStates[field.key] = 'selected';
  saveState();
  renderFieldStatusSummary();
}

function handleFieldBlur(e) {
  const fields = getFields();
  const rule = getRuleState();
  const field = fields[rule.currentStep];
  let value = (e.target.value || '').trim();

  // Strip webView suffix if the field has webView enabled
  if (rule.fields[field.key]?.webView && LINK_FIELDS.includes(field.key)) {
    value = stripWebView(value);
  }

  if (!value) {
    delete rule.fields[field.key];
    rule.fieldStates[field.key] = 'pending';
    saveState();
    renderFieldStatusSummary();
    updateStepIndicator();
    renderFields();
    return;
  }

  if (!rule.fields[field.key]) {
    rule.fields[field.key] = { value: '', state: 'selected', rawSelector: '' };
  }
  const fieldData = rule.fields[field.key];
  fieldData.value = value;
  fieldData.state = 'selected';
  rule.fieldStates[field.key] = 'selected';

  // Set rawSelector and bookListSelector for preview display
  const previewSelector = resolvePreviewSelector(value);
  const previewRule = resolveTextPreviewRule(value);
  fieldData.rawSelector = previewRule || previewSelector || value;
  if (isListFieldKey(field.key)) {
    rule.bookListSelector = previewSelector || value;
  }

  saveState();
  renderFieldStatusSummary();
  updateStepIndicator();
  renderFields();

  requestFieldPreview(field.key, value, previewSelector);
}

function goToNextStep() {
  const fields = getFields();
  const rule = getRuleState();
  if (rule.currentStep < fields.length) {
    rule.currentStep++;
    saveState();
    updateStepIndicator();
    renderFields();
    updateNavButtons();
    renderFieldStatusSummary();
  }
}

function goToPrevStep() {
  const rule = getRuleState();
  if (rule.currentStep > 0) {
    rule.currentStep--;
    saveState();
    updateStepIndicator();
    renderFields();
    updateNavButtons();
    renderFieldStatusSummary();
  }
}

function goToStep(index) {
  const rule = getRuleState();
  if (index === rule.currentStep) return;
  rule.currentStep = index;
  saveState();
  updateStepIndicator();
  renderFields();
  updateNavButtons();
  renderFieldStatusSummary();
}

function updateNavButtons() {
  const fields = getFields();
  const rule = getRuleState();
  document.getElementById('prevBtn').disabled = rule.currentStep === 0;
  document.getElementById('nextBtn').textContent = rule.currentStep === fields.length ? '完成' : '下一步';
}

function renderFieldStatusSummary() {
  const summaryContainer = document.getElementById('fieldStatusSummary');
  if (!summaryContainer) return;

  const fields = getFields();
  const rule = getRuleState();
  const summary = fields
    .map((f, index) => {
      const fieldState = rule.fieldStates[f.key] || 'pending';
      const activeClass = index === rule.currentStep ? ' active' : '';
      return `<span class="status-item status-item--${fieldState}${activeClass}" data-field="${f.key}" data-step-index="${index}">${f.label}</span>`;
    })
    .join('');

  const summaryActiveClass = rule.currentStep === fields.length ? ' active' : '';
  const summaryHtml = `<span class="status-item status-item--summary${summaryActiveClass}" data-step-index="${fields.length}">汇总</span>`;

  summaryContainer.innerHTML = summary + summaryHtml;

  summaryContainer.querySelectorAll('.status-item').forEach((item) => {
    item.addEventListener('click', () => {
      const stepIndex = parseInt(item.dataset.stepIndex, 10);
      if (!Number.isNaN(stepIndex)) {
        goToStep(stepIndex);
      }
    });
  });
}

function bindEvents() {
  document.getElementById('prevBtn').addEventListener('click', goToPrevStep);
  document.getElementById('nextBtn').addEventListener('click', handleNext);
  document.getElementById('exportBtn').addEventListener('click', handleExport);
  document.getElementById('copyBtn').addEventListener('click', handleCopy);
  document.getElementById('downloadBtn').addEventListener('click', handleDownload);
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('resetBtn').addEventListener('click', handleReset);
  document.getElementById('app').addEventListener('click', (e) => {
    const header = e.target.closest('[data-toggle="preview"]');
    if (header) togglePreviews(header);
  });

  document.getElementById('bookSourceName').addEventListener('input', saveState);
  document.getElementById('bookSourceUrl').addEventListener('input', saveState);
  document.getElementById('bookSourceTypeSelect')?.addEventListener('change', (e) => {
    state.bookSourceType = Number(e.target.value) || 0;
    saveState();
    renderFields();
    renderFieldStatusSummary();
  });

  autoResizeTextarea(document.getElementById('bookSourceName'));
  autoResizeTextarea(document.getElementById('bookSourceUrl'));
  autoResizeTextarea(document.getElementById('searchUrlTemplate'));

  document.getElementById('autoFillBtn').addEventListener('click', handleAutoFill);
  document.getElementById('checkUpdateBtn').addEventListener('click', handleCheckUpdate);
  document.getElementById('closeUpdateBtn').addEventListener('click', () => {
    document.getElementById('updateModal').classList.add('hidden');
  });

  // Quick insert button (span, not button — prevent focus loss)
  const quickInsertBtn = document.getElementById('quickInsertBtn');
  if (quickInsertBtn) {
    quickInsertBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    quickInsertBtn.addEventListener('click', () => {
      if (typeof window.openQuickInsertPanel === 'function') {
        const activeEl = document.activeElement;
        window.loadSnippets(() => {
          window.openQuickInsertPanel(activeEl);
        });
      }
    });
  }

  document.getElementById('importBtn').addEventListener('click', openImportModal);
  document.getElementById('closeImportBtn').addEventListener('click', closeImportModal);
  document.getElementById('cancelImportBtn').addEventListener('click', closeImportModal);
  document.getElementById('confirmImportBtn').addEventListener('click', handleImportConfirm);
  document.getElementById('importFileBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', handleImportFileSelect);
  document.getElementById('importJsonTextarea').addEventListener('input', handleImportJsonInput);
  document.getElementById('importSelectAllBtn')?.addEventListener('click', () => {
    importSelection = getDefaultImportSelection();
    saveImportSelection(importSelection);
    renderImportTree();
  });
  document.getElementById('importInvertBtn')?.addEventListener('click', () => {
    IMPORT_CATEGORIES.forEach((cat) => {
      cat.items.forEach((item) => {
        const key = buildSelectionKey(cat.key, item.key);
        importSelection[key] = !importSelection[key];
      });
    });
    saveImportSelection(importSelection);
    renderImportTree();
  });
  document.getElementById('closeIndexTutorialBtn')?.addEventListener('click', () => {
    document.getElementById('indexTutorialModal')?.classList.add('hidden');
  });

  document.getElementById('lazyGenerateBtn')?.addEventListener('click', () => {
    const script = generateLazyLoadScript();
    const textarea = document.getElementById('fieldValue');
    if (textarea) {
      textarea.value = script;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.getElementById('lazyLoadModal')?.classList.add('hidden');
  });
  document.getElementById('lazyCancelBtn')?.addEventListener('click', () => {
    document.getElementById('lazyLoadModal')?.classList.add('hidden');
  });

  document.getElementById('captureSearchUrlBtn').addEventListener('click', handleCaptureSearchUrl);
  document.getElementById('searchCaptureCancelListenBtn').addEventListener('click', handleCancelSearchListen);
  document.getElementById('searchMethod').addEventListener('change', onSearchConfigChange);
  document.getElementById('searchCharset').addEventListener('input', rebuildSearchUrlFromForm);
  document.getElementById('searchWebView').addEventListener('change', rebuildSearchUrlFromForm);
  document.getElementById('searchBodyTemplate').addEventListener('input', () => {
    autoResizeTextarea(document.getElementById('searchBodyTemplate'));
    rebuildSearchUrlFromForm();
  });
  document.getElementById('searchUrlTemplate').addEventListener('input', () => {
    autoResizeTextarea(document.getElementById('searchUrlTemplate'));
    state.searchConfig = null;
    saveState();
  });
  document.getElementById('advancedHeadersList')?.addEventListener('input', saveState);
  document.getElementById('advancedHeadersList')?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action="remove"]');
    if (!target) return;
    const row = target.closest('.advanced-item');
    const index = Number(row?.dataset?.index);
    if (Number.isNaN(index) || !Array.isArray(state.headerItems)) return;
    state.headerItems.splice(index, 1);
    renderHeaderItems();
    saveState();
  });
  document.getElementById('addHeaderItemBtn')?.addEventListener('click', () => addHeaderItem('', ''));
  document.getElementById('addUaHeaderBtn')?.addEventListener('click', addDefaultUserAgentHeader);
  document.getElementById('addMobileUaHeaderBtn')?.addEventListener('click', addMobileUserAgentHeader);
  document.getElementById('addRefererHeaderBtn')?.addEventListener('click', addDefaultRefererHeader);
  document.getElementById('autoFillCfBtn')?.addEventListener('click', () => {
    const el = document.getElementById('loginCheckJs');
    if (el) {
      el.value = CF_LOGIN_CHECK_JS;
      autoResizeTextarea(el);
      saveState();
    }
  });
  document.getElementById('loginCheckJs')?.addEventListener('input', saveState);
  document.getElementById('bookSourceComment')?.addEventListener('input', saveState);
  document.getElementById('insertPagePlaceholderBtn').addEventListener('click', () => {
    const el = document.getElementById('searchUrlTemplate');
    const pos = el.selectionStart;
    const before = el.value.substring(0, pos);
    const after = el.value.substring(pos);
    el.value = before + '{{page}}' + after;
    autoResizeTextarea(el);
    saveState();
    el.focus();
  });
}

function handleAutoFill() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    const tab = tabs[0];
    const nameEl = document.getElementById('bookSourceName');
    const urlEl = document.getElementById('bookSourceUrl');
    const patternEl = document.getElementById('bookUrlPattern');

    if (nameEl) nameEl.value = tab.title || '';
    if (urlEl) {
      try {
        const url = new URL(tab.url);
        urlEl.value = url.origin;
      } catch {
        urlEl.value = tab.url || '';
      }
    }
    if (patternEl) {
      try {
        const url = new URL(tab.url);
        // 提取顶级域名部分，生成正则表达式
        // 例如: https://www.pixiv.net/... -> (https?://)?(www\.)?pixiv\.net
        const hostname = url.hostname;
        // 移除 www. 前缀（如果存在）
        const domain = hostname.replace(/^www\./, '');
        // 转义点号
        const escapedDomain = domain.replace(/\./g, '\\.');
        // 生成正则表达式：可选的协议前缀 + 可选的www. + 域名
        patternEl.value = `(https?://)?(www\\.)?${escapedDomain}`;
      } catch {
        patternEl.value = '';
      }
    }

    autoResizeTextarea(nameEl);
    autoResizeTextarea(urlEl);
    autoResizeTextarea(patternEl);
    saveState();
  });
}

function handleCheckUpdate() {
  const modal = document.getElementById('updateModal');
  const currentEl = document.getElementById('currentVersion');
  const latestEl = document.getElementById('latestVersion');
  const statusEl = document.getElementById('updateStatus');

  modal.classList.remove('hidden');
  const currentVersion = chrome.runtime.getManifest().version;
  currentEl.textContent = currentVersion;
  latestEl.textContent = '检查中...';
  statusEl.textContent = '';

  getLatestVersionWithFallback()
    .then((latest) => {
      latestEl.textContent = latest;
      const compareResult = compareVersions(latest, currentVersion);

      if (compareResult > 0) {
        statusEl.textContent = '发现新版本';
        statusEl.style.color = 'var(--success)';
      } else {
        statusEl.textContent = '已是最新版本';
        statusEl.style.color = '';
      }
    })
    .catch(() => {
      latestEl.textContent = '检查失败';
      statusEl.textContent = '请检查网络连接或手动访问仓库查看';
      statusEl.style.color = 'var(--danger)';
    });
}

async function getLatestVersionWithFallback() {
  try {
    return await fetchLatestTagFromGitee();
  } catch {
    return fetchLatestTagFromGitHub();
  }
}

function fetchLatestTagFromGitee() {
  return fetchLatestTagVersion('https://gitee.com/api/v5/repos/z1131392774/legado-source-generator/tags', 'name');
}

function fetchLatestTagFromGitHub() {
  return fetchLatestTagVersion('https://api.github.com/repos/z1131392774/legado-source-generator/tags', 'name');
}

async function fetchLatestTagVersion(url, fieldName) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Network error');

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('No tags found');

  const versions = data.map((item) => normalizeTagVersion(item?.[fieldName])).filter(Boolean);

  if (!versions.length) throw new Error('No valid semver tag found');

  return versions.reduce((latest, current) => {
    if (!latest) return current;
    return compareVersions(current, latest) > 0 ? current : latest;
  }, '');
}

function normalizeTagVersion(tagName) {
  if (typeof tagName !== 'string') return '';
  const version = tagName.trim().replace(/^v/i, '');
  return /^\d+(\.\d+){1,3}$/.test(version) ? version : '';
}

function compareVersions(a, b) {
  const pa = String(a)
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b)
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const length = Math.max(pa.length, pb.length);

  for (let i = 0; i < length; i += 1) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }

  return 0;
}

function autoResizeTextarea(el) {
  if (!el) return;
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 19;
  const maxHeight = lineHeight * 10;
  const resize = () => {
    const current = parseFloat(el.style.height) || 0;
    if (current > maxHeight) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  };
  el.addEventListener('input', resize);
  resize();
}

function generateLazyLoadScript() {
  const selector = document.getElementById('lazySelector').value.trim();
  const checkTarget = document.getElementById('lazyCheckTarget').value;
  const expectPattern = document.getElementById('lazyExpect').value.trim();
  const rejectPattern = document.getElementById('lazyReject').value.trim();
  const readyCheck = document.getElementById('lazyReadyCheck').value.trim();
  const normalizeWhitespace = document.getElementById('lazyNormalize').checked;
  const scrollToBottom = document.getElementById('lazyScroll').checked;

  return `(() => {
  // ========== 用户配置区 ==========
  const selector = '${selector}';
  const checkTarget = '${checkTarget}';
  const expectPattern = ${expectPattern || 'null'};
  const rejectPattern = ${rejectPattern || 'null'};
  const readyCheck = ${readyCheck ? `(${readyCheck})` : 'null'};
  const normalizeWhitespace = ${normalizeWhitespace};
  const scrollToBottom = ${scrollToBottom};
  // ==============================

  if (scrollToBottom && !window.__legado_scrolled) {
    window.scrollTo(0, document.body.scrollHeight);
    window.__legado_scrolled = true;
    return null;
  }

  const el = document.querySelector(selector);
  if (!el) return null;

  if (typeof readyCheck === 'function') {
    return readyCheck(el) ? document.documentElement.outerHTML : null;
  }

  let content = checkTarget === 'html'
    ? el.outerHTML
    : (el.innerText || el.textContent || '');
  if (checkTarget === 'text' && normalizeWhitespace) {
    content = content.replace(/\\s+/g, ' ').trim();
  }

  if (rejectPattern && rejectPattern.test(content)) return null;
  if (expectPattern && !expectPattern.test(content)) return null;

  return document.documentElement.outerHTML;
})();`;
}

function handleNext() {
  const fields = getFields();
  const rule = getRuleState();

  if (rule.currentStep === fields.length) {
    handleExport();
    return;
  }

  goToNextStep();
}

function handleExport() {
  const bookSourceName = (state.bookSourceName || '').trim();
  const bookSourceUrl = (state.bookSourceUrl || '').trim();
  if (!bookSourceName) {
    showToast('请先填写书源名称', 'warning');
    return;
  }
  if (!bookSourceUrl) {
    showToast('请先填写书源 URL', 'warning');
    return;
  }
  const jsonData = generateJson();
  const textarea = document.getElementById('jsonOutput');
  textarea.value = JSON.stringify(jsonData, null, 2);
  textarea.dataset.downloadJson = JSON.stringify([jsonData], null, 2);
  document.getElementById('exportModal').classList.remove('hidden');
}

function generateJson() {
  const exploreResult =
    typeof window.getExploreJsonString === 'function' ? window.getExploreJsonString() : state.exploreUrl || '';
  const exploreUrlValue =
    typeof exploreResult === 'string'
      ? exploreResult
      : exploreResult.length > 0
        ? JSON.stringify(exploreResult, null, 2)
        : '';

  const result = {
    ruleSearch: buildRuleSection('search'),
    ruleBookInfo: buildRuleSection('bookInfo'),
    ruleToc: buildRuleSection('toc'),
    ruleContent: buildRuleSection('content'),
    ruleExplore: buildRuleSection('explore'),
    bookSourceType: Number(state.bookSourceType) || 0,
    bookSourceUrl: (state.bookSourceUrl || '').trim(),
    bookUrlPattern: (state.bookUrlPattern || '').trim(),
    bookSourceName: (state.bookSourceName || '').trim(),
    searchUrl: state.searchUrl || '',
    exploreUrl: exploreUrlValue
  };

  const items = Array.isArray(state.headerItems) ? state.headerItems : [];
  const hasMobileUA = items.some(
    (item) => (item?.key || '').trim() === 'User-Agent' && (item?.value || '').includes('java.getWebViewUA()')
  );
  if (hasMobileUA) {
    const pairs = [];
    items.forEach((item) => {
      const key = (item?.key || '').trim();
      const value = (item?.value || '').trim();
      if (!key || !value) return;
      if (key === 'User-Agent' && value.includes('java.getWebViewUA()')) {
        pairs.push(`    "${key}": ${value}`);
      } else {
        pairs.push(`    "${key}": ${JSON.stringify(value)}`);
      }
    });
    result.header = `@js:\nJSON.stringify({\n${pairs.join(',\n')}\n})`;
  } else {
    const header = {};
    items.forEach((item) => {
      const key = (item?.key || '').trim();
      const value = (item?.value || '').trim();
      if (key && value) {
        header[key] = value;
      }
    });
    result.header = Object.keys(header).length > 0 ? header : '';
  }
  result.loginCheckJs = state.loginCheckJs?.trim() || '';
  result.bookSourceComment = state.bookSourceComment?.trim() || '';

  return result;
}

const LINK_FIELDS = ['bookUrl', 'chapterUrl', 'tocUrl', 'nextTocUrl', 'nextContentUrl'];

function applyWebView(rule) {
  if (!rule) return rule;
  if (rule.includes('{"webView":true}')) return rule; // already applied
  if (rule.includes('<js>') && rule.includes('</js>')) {
    // JS script: only modify the return in the try block (before }catch or } catch),
    // not the catch block's return ""+e
    const catchIdx = rule.search(/\}\s*catch/);
    if (catchIdx !== -1) {
      const tryPart = rule.substring(0, catchIdx);
      const catchPart = rule.substring(catchIdx);
      const modified = tryPart.replace(/return\s+([^;]+);/g, 'return $1 + \',{"webView":true}\';');
      return modified + catchPart;
    }
    // Fallback: no catch block found, replace all returns
    return rule.replace(/return\s+([^;]+);/g, 'return $1 + \',{"webView":true}\';');
  } else {
    // Pure selector: append @js suffix
    return rule + '@js:result+\',{"webView":true}\'';
  }
}

function stripWebView(rule) {
  if (!rule) return rule;
  // Strip @js suffix for pure selectors
  let stripped = rule.replace(/@js:result\+',\{"webView":true\}'$/, '');
  if (stripped !== rule) return stripped;
  // Strip webView from JS return statements (only in try block)
  const catchIdx = rule.search(/\}\s*catch/);
  if (catchIdx !== -1) {
    const tryPart = rule.substring(0, catchIdx);
    const catchPart = rule.substring(catchIdx);
    const modified = tryPart.replace(/ \+',\{"webView":true\}'/g, '');
    return modified + catchPart;
  }
  // Fallback: no catch block, strip all occurrences
  stripped = rule.replace(/ \+',\{"webView":true\}'/g, '');
  return stripped;
}

function buildRuleSection(type) {
  const rule = state.rules[type];
  const fields = RULE_TYPES[type].fields;
  const section = {};

  fields.forEach((field) => {
    const fieldData = rule.fields[field.key];
    if (fieldData && fieldData.value) {
      let value = fieldData.value;
      if (fieldData.webView && LINK_FIELDS.includes(field.key)) {
        value = applyWebView(value);
      }
      section[field.key] = value;
    }
  });

  return Object.keys(section).length > 0 ? section : '';
}

function handleCopy() {
  const textarea = document.getElementById('jsonOutput');
  navigator.clipboard
    .writeText(textarea.value)
    .then(() => {
      showToast('已复制到剪贴板', 'info');
    })
    .catch(() => {
      textarea.select();
      document.execCommand('copy');
    });
}

function handleDownload() {
  const textarea = document.getElementById('jsonOutput');
  const jsonStr = textarea.dataset.downloadJson || textarea.value;
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `legado-source-${state.bookSourceName || 'export'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
//    Import JSON Config
// ============================================

let importSelection = null; // Current import selection (map of key -> boolean)
let parsedImportJson = null; // Successfully parsed import JSON

function openImportModal() {
  const modal = document.getElementById('importModal');
  const jsonTextarea = document.getElementById('importJsonTextarea');
  const errorEl = document.getElementById('importJsonError');
  const treeSection = document.getElementById('importTreeSection');
  const confirmBtn = document.getElementById('confirmImportBtn');
  const warningArea = document.getElementById('importWarningArea');

  // Reset state
  parsedImportJson = null;
  jsonTextarea.value = '';
  errorEl.classList.add('hidden');
  errorEl.textContent = '';
  treeSection.classList.add('hidden');
  warningArea.innerHTML = '';
  confirmBtn.disabled = true;

  // Load persistent import selection
  loadImportSelection((sel) => {
    importSelection = sel;
  });

  modal.classList.remove('hidden');
  jsonTextarea.focus();
}

function closeImportModal() {
  document.getElementById('importModal').classList.add('hidden');
}

function handleImportJsonInput() {
  const jsonTextarea = document.getElementById('importJsonTextarea');
  const errorEl = document.getElementById('importJsonError');
  const treeSection = document.getElementById('importTreeSection');
  const confirmBtn = document.getElementById('confirmImportBtn');
  const warningArea = document.getElementById('importWarningArea');

  const raw = jsonTextarea.value;

  if (!raw.trim()) {
    errorEl.classList.add('hidden');
    treeSection.classList.add('hidden');
    warningArea.innerHTML = '';
    confirmBtn.disabled = true;
    parsedImportJson = null;
    return;
  }

  try {
    parsedImportJson = parseImportJson(raw);
    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    // Ensure selection is loaded before rendering
    if (!importSelection) {
      importSelection = getDefaultImportSelection();
    }

    renderImportTree();
    treeSection.classList.remove('hidden');

    // Build cover warning
    warningArea.innerHTML = buildCoverWarning(parsedImportJson, state);

    confirmBtn.disabled = false;
  } catch (e) {
    parsedImportJson = null;
    errorEl.textContent = e.message;
    errorEl.classList.remove('hidden');
    treeSection.classList.add('hidden');
    warningArea.innerHTML = '';
    confirmBtn.disabled = true;
  }
}

function handleImportFileSelect() {
  const fileInput = document.getElementById('importFileInput');
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const jsonTextarea = document.getElementById('importJsonTextarea');
    jsonTextarea.value = reader.result;
    autoResizeTextarea(jsonTextarea);
    // Trigger parse
    handleImportJsonInput();
  };
  reader.readAsText(file);

  // Reset file input so same file can be selected again
  fileInput.value = '';
}

function renderImportTree() {
  const container = document.getElementById('importTreeContainer');
  if (!container) return;

  // Ensure selection is initialized
  if (!importSelection) {
    importSelection = getDefaultImportSelection();
  }

  let html = '';

  IMPORT_CATEGORIES.forEach((cat) => {
    // Count selected children
    const total = cat.items.length;
    const selected = cat.items.filter((item) => importSelection[buildSelectionKey(cat.key, item.key)]).length;
    const allSelected = selected === total;

    html += '<div class="import-tree-category">';
    html += '<label class="import-tree-parent">';
    html +=
      '<input type="checkbox" class="import-cat-check" ' +
      'data-cat="' +
      cat.key +
      '"' +
      (allSelected ? ' checked' : '') +
      '>';
    html += '<span class="import-cat-label">' + cat.label + '</span>';
    html += '</label>';

    html += '<div class="import-tree-children">';
    cat.items.forEach((item) => {
      const selKey = buildSelectionKey(cat.key, item.key);
      const checked = importSelection[selKey] ? ' checked' : '';
      html += '<label class="import-tree-child">';
      html +=
        '<input type="checkbox" class="import-item-check" ' +
        'data-cat="' +
        cat.key +
        '" data-key="' +
        item.key +
        '"' +
        checked +
        '>';
      html += '<span>' + item.label + '</span>';
      html += '</label>';
    });
    html += '</div>';
    html += '</div>';
  });

  container.innerHTML = html;

  // Set indeterminate state on category checkboxes with partial selection
  container.querySelectorAll('.import-cat-check').forEach((cb) => {
    const catKey = cb.dataset.cat;
    const cat = IMPORT_CATEGORIES.find((c) => c.key === catKey);
    if (cat) {
      const total = cat.items.length;
      const selected = cat.items.filter((item) => importSelection[buildSelectionKey(catKey, item.key)]).length;
      cb.indeterminate = selected > 0 && selected < total;
    }
  });

  // Bind category checkbox events
  container.querySelectorAll('.import-cat-check').forEach((cb) => {
    cb.addEventListener('change', function () {
      const catKey = this.dataset.cat;
      const checked = this.checked;
      // Set all child items
      const cat = IMPORT_CATEGORIES.find((c) => c.key === catKey);
      if (cat) {
        cat.items.forEach((item) => {
          importSelection[buildSelectionKey(catKey, item.key)] = checked;
        });
      }
      saveImportSelection(importSelection);

      // Update child checkboxes visually
      const children = container.querySelectorAll('.import-item-check[data-cat="' + catKey + '"]');
      children.forEach((child) => {
        child.checked = checked;
      });
    });
  });

  // Bind item checkbox events
  container.querySelectorAll('.import-item-check').forEach((cb) => {
    cb.addEventListener('change', function () {
      const catKey = this.dataset.cat;
      const itemKey = this.dataset.key;
      importSelection[buildSelectionKey(catKey, itemKey)] = this.checked;
      saveImportSelection(importSelection);

      // Update parent checkbox state
      updateParentCheckbox(container, catKey);
    });
  });
}

function updateParentCheckbox(container, catKey) {
  const parentCb = container.querySelector('.import-cat-check[data-cat="' + catKey + '"]');
  if (!parentCb) return;

  const cat = IMPORT_CATEGORIES.find((c) => c.key === catKey);
  if (!cat) return;

  const total = cat.items.length;
  const selected = cat.items.filter((item) => importSelection[buildSelectionKey(catKey, item.key)]).length;

  parentCb.checked = selected === total;
  parentCb.indeterminate = selected > 0 && selected < total;
}

function handleImportConfirm() {
  if (!parsedImportJson) {
    showToast('请先输入有效的 JSON', 'warning');
    return;
  }

  if (!importSelection) {
    importSelection = getDefaultImportSelection();
  }

  // Apply import to state
  applyImportToState(state, parsedImportJson, importSelection);

  // Close modal
  closeImportModal();

  // Save state directly (don't use saveState which reads from old DOM)
  chrome.storage.local.set({ legadoSourceState: state });

  // Sync DOM from state and refresh all UI panels
  syncDomFromState();
  renderModeTabs();
  renderRuleTypeTabs();
  updateStepIndicator();
  renderFields();
  updateNavButtons();
  renderFieldStatusSummary();
  renderHeaderItems();
  updateEditorVisibility();

  // If exploreUrl was imported, update explore editor state
  if (importSelection['explore.exploreUrl']) {
    const exploreStr = parsedImportJson.exploreUrl;
    if (exploreStr) {
      const items = parseExploreUrlToItems(exploreStr);
      chrome.storage.local.set({ exploreEditorState: { items: items, format: 2 } });
      if (typeof loadExploreState === 'function') {
        loadExploreState();
      }
    }
  }

  showToast('导入成功', 'info');
}

/**
 * Sync all DOM inputs from the current state object.
 * Used after import to reflect the new state values in the UI.
 */
function syncDomFromState() {
  const nameEl = document.getElementById('bookSourceName');
  const urlEl = document.getElementById('bookSourceUrl');
  const commentEl = document.getElementById('bookSourceComment');
  const loginEl = document.getElementById('loginCheckJs');
  const typeEl = document.getElementById('bookSourceTypeSelect');
  const patternEl = document.getElementById('bookUrlPattern');
  const searchEl = document.getElementById('searchUrlTemplate');

  if (nameEl) {
    nameEl.value = state.bookSourceName || '';
    autoResizeTextarea(nameEl);
  }
  if (urlEl) {
    urlEl.value = state.bookSourceUrl || '';
    autoResizeTextarea(urlEl);
  }
  if (commentEl) {
    commentEl.value = state.bookSourceComment || '';
    autoResizeTextarea(commentEl);
  }
  if (loginEl) {
    loginEl.value = state.loginCheckJs || '';
    autoResizeTextarea(loginEl);
  }
  if (typeEl) typeEl.value = String(state.bookSourceType || 0);
  if (patternEl) {
    patternEl.value = state.bookUrlPattern || '';
    autoResizeTextarea(patternEl);
  }
  if (searchEl) {
    searchEl.value = state.searchUrl || '';
    autoResizeTextarea(searchEl);
  }
}

function closeModal() {
  document.getElementById('exportModal').classList.add('hidden');
}

function handleReset() {
  if (!confirm('确定要重置所有进度吗？')) return;

  // Reset state from default — single source of truth, no manual field sync needed
  state = structuredClone(DEFAULT_STATE);

  chrome.storage.local.remove(['legadoSourceState', 'exploreEditorState']);

  // Reset DOM elements
  document.getElementById('bookSourceName').value = '';
  document.getElementById('bookSourceUrl').value = '';
  document.getElementById('bookSourceComment').value = '';
  document.getElementById('loginCheckJs').value = '';
  const contentTypeSelect = document.getElementById('bookSourceTypeSelect');
  if (contentTypeSelect) contentTypeSelect.value = '0';
  const bookUrlPatternEl = document.getElementById('bookUrlPattern');
  if (bookUrlPatternEl) bookUrlPatternEl.value = '';
  document.getElementById('searchUrlTemplate').value = '';
  document.getElementById('searchMethod').value = 'GET';
  document.getElementById('searchCharset').value = '';
  document.getElementById('searchWebView').value = 'false';
  document.getElementById('searchBodyTemplate').value = '';

  renderHeaderItems();

  if (typeof window.clearExploreEditor === 'function') {
    window.clearExploreEditor();
  }

  renderModeTabs();
  updateEditorVisibility();
  renderRuleTypeTabs();
  updateStepIndicator();
  renderFields();
  updateNavButtons();
  renderFieldStatusSummary();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.togglePreviews = (header) => {
  const list = header.nextElementSibling;
  const toggle = header.querySelector('.preview-toggle');
  if (list.classList.contains('hidden')) {
    list.classList.remove('hidden');
    toggle.textContent = '▼';
  } else {
    list.classList.add('hidden');
    toggle.textContent = '▶';
  }
};

// Helper: build @ selector with smart attribute detection
function buildAtSelector(sel, key, tag, listItemTag) {
  const linkFields = ['bookUrl', 'chapterUrl', 'tocUrl', 'nextTocUrl', 'nextContentUrl'];
  if (linkFields.includes(key)) {
    if (listItemTag === 'a') return 'a@href';
    return tag === 'a' ? sel + '@href' : sel + ' a@href';
  } else if (key === 'coverUrl') {
    return tag === 'img' ? sel + '@src' : sel + ' img@src';
  } else {
    return sel + '@text';
  }
}

function toLegadoRule(selector, fieldKey, fieldData, tagName, listItemTag) {
  const isListField = isListFieldKey(fieldKey);
  const nextFieldData = {
    ...fieldData,
    tagName: tagName || fieldData.tagName || '',
    listItemTagName: listItemTag || fieldData.listItemTagName || ''
  };
  return buildIndexedRule(selector, fieldKey, nextFieldData, isListField);
}

function handleSelectorSelected(message) {
  const { selector, step, previews } = message;

  const fields = getFields();
  const field = fields.find((f) => f.key === step);

  if (!field) {
    console.error('Unknown field step:', step);
    return;
  }

  const rule = getRuleState();
  const fieldData = rule.fields[step] || {};
  const legadoRule = toLegadoRule(selector, step, fieldData, message.tagName, message.listItemTagName);

  rule.fields[step] = {
    value: legadoRule,
    state: 'selected',
    rawSelector: selector,
    tagName: message.tagName || '',
    listItemTagName: message.listItemTagName || '',
    previews: previews || []
  };
  rule.fieldStates[step] = 'selected';

  if (isListFieldKey(step)) {
    rule.bookListSelector = selector;
  }

  saveState();
  renderFields();
  renderFieldStatusSummary();
}

function bindMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'selectorSelected':
        handleSelectorSelected(message);
        sendResponse({ success: true });
        break;
      case 'exploreCollected':
        if (typeof window.handleExploreCollected === 'function') {
          window.handleExploreCollected(message.items);
        }
        sendResponse({ success: true });
        break;
      case 'exploreItemCollected':
        if (typeof window.handleExploreItemCollected === 'function') {
          window.handleExploreItemCollected(message.item, message.total);
        }
        sendResponse({ success: true });
        break;
      case 'exploreCollectionStarted':
        if (typeof window.handleExploreCollectionStarted === 'function') {
          window.handleExploreCollectionStarted();
        }
        sendResponse({ success: true });
        break;
      case 'exploreElementHover':
        if (typeof window.handleExploreElementHover === 'function') {
          window.handleExploreElementHover(message);
        }
        sendResponse({ success: true });
        break;
      case 'pickerReady':
        showPickerStatus();
        break;
      case 'pickerElementInfo':
        updatePickerStatus(message);
        break;
      case 'pickerStopped': {
        hidePickerStatus();
        const fields = getFields();
        const rule = getRuleState();
        const currentField = fields[rule.currentStep];
        if (currentField && rule.fieldStates[currentField.key] === 'picking') {
          rule.fieldStates[currentField.key] = 'pending';
          saveState();
          updateStepIndicator();
          renderFields();
        }
        break;
      }
      case 'showToast':
        showToast(message.message, message.type);
        break;
      case 'searchCaptured':
        handleSearchCaptured(message);
        // Stop the content script capture
        if (searchCaptureTabId) {
          chrome.tabs.sendMessage(searchCaptureTabId, { action: 'stopSearchCapture' });
        }
        break;
      case 'searchCaptureForms':
        handleSearchCaptureForms(message);
        break;
      default:
        break;
    }
    return true;
  });
}

function showPickerStatus() {
  const container = document.getElementById('pickerStatusContainer');
  if (container) container.classList.remove('hidden');
}

function hidePickerStatus() {
  const container = document.getElementById('pickerStatusContainer');
  if (container) container.classList.add('hidden');
}

function updatePickerStatus(message) {
  const stepEl = document.getElementById('pickerStatusStep');
  const elementEl = document.getElementById('pickerStatusElement');
  if (stepEl) stepEl.textContent = message.step || '-';
  if (elementEl)
    elementEl.textContent = message.elementInfo ? `${message.elementInfo} ${message.elementText || ''}` : '-';
}

/**
 * Show toast notification (same style as picker.js)
 * @param {string} message - Toast message
 * @param {string} type - Toast type: 'warning' | 'error' | 'info'
 */
function showToast(message, type = 'warning') {
  const colors = { warning: '#faad14', error: '#ff4d4f', info: '#1890ff' };

  let container = document.getElementById('popup-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'popup-toast-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    `;
    document.documentElement.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `popup-toast popup-toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    background: ${colors[type] || colors.warning};
    color: #fff;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 13px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    animation: toast-in 0.3s ease;
  `;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast && toast.parentNode) {
      toast.style.animation = 'toast-out 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

/* ============================================
   Search URL Capture
   ============================================ */

let searchCaptureTabId = null;
let searchCaptureReceived = false; // Track if we already received a capture
let searchCaptureCancelled = false; // Track if user cancelled the capture

function handleCaptureSearchUrl() {
  state.activeMode = 'searchUrl';
  saveState();
  renderModeTabs();
  updateEditorVisibility();

  searchCaptureCancelled = false; // Reset cancelled flag for new capture

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    searchCaptureTabId = tabs[0].id;

    // Show modal with listening state
    openSearchCaptureModal();
    showSearchCaptureListening();

    // Inject content script if needed, then start capture
    injectSearchCaptureScript(tabs[0].id, () => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'startSearchCapture' }, (response) => {
        if (chrome.runtime.lastError) {
          showToast('无法注入脚本，请确认当前页面可访问', 'error');
          closeSearchCaptureModal();
        }
      });
    });
  });
}

function injectSearchCaptureScript(tabId, callback) {
  chrome.tabs.executeScript(tabId, { file: '/content/search-capture.js' }, () => {
    if (chrome.runtime.lastError) {
      showToast('脚本注入失败: ' + chrome.runtime.lastError.message, 'error');
      closeSearchCaptureModal();
    } else {
      callback();
    }
  });
}

function handleCancelSearchListen() {
  if (searchCaptureTabId) {
    chrome.tabs.sendMessage(searchCaptureTabId, { action: 'stopSearchCapture' });
  }
  searchCaptureCancelled = true; // Prevent subsequent searchCaptureForms from filling
  closeSearchCaptureModal();
}

function openSearchCaptureModal() {
  searchCaptureReceived = false;
  document.getElementById('searchCaptureListening').classList.add('hidden');
  document.getElementById('searchCaptureForm').classList.remove('hidden');
  // Auto-resize textareas
  autoResizeTextarea(document.getElementById('searchUrlTemplate'));
  autoResizeTextarea(document.getElementById('searchBodyTemplate'));
}

function closeSearchCaptureModal() {
  document.getElementById('searchCaptureListening').classList.add('hidden');
  document.getElementById('searchCaptureForm').classList.remove('hidden');
  searchCaptureTabId = null;
}

function showSearchCaptureListening() {
  document.getElementById('searchCaptureListening').classList.remove('hidden');
  document.getElementById('searchCaptureForm').classList.add('hidden');
}

function showSearchCaptureForm(data) {
  document.getElementById('searchCaptureListening').classList.add('hidden');
  document.getElementById('searchCaptureForm').classList.remove('hidden');

  const methodEl = document.getElementById('searchMethod');
  const urlEl = document.getElementById('searchUrlTemplate');
  const charsetEl = document.getElementById('searchCharset');
  const bodyEl = document.getElementById('searchBodyTemplate');
  const bodyField = document.getElementById('searchBodyField');

  methodEl.value = data.method || 'GET';
  charsetEl.value = data.charset || 'utf-8';
  bodyEl.value = data.body || '';

  const webViewEl = document.getElementById('searchWebView');
  webViewEl.value = data.webView === true || data.webView === 'true' ? 'true' : 'false';

  // Build complete Legado-format search URL
  const method = methodEl.value;
  const charset = charsetEl.value;
  const body = bodyEl.value;
  const webView = webViewEl.value === 'true';
  const url = data.url || '';

  const needsCharset = charset && charset !== 'utf-8';
  if (method === 'POST' || needsCharset || webView) {
    // POST, non-UTF8, or webView: use JSON format
    const config = {};
    if (needsCharset) config.charset = charset;
    if (method !== 'GET') config.method = method;
    if (method === 'POST' && body) {
      config.body = body;
    }
    if (webView) {
      config.webView = true;
    }
    urlEl.value = url + ',' + JSON.stringify(config);
    bodyField.classList.remove('hidden');
  } else {
    // Simple GET UTF-8
    urlEl.value = url;
    bodyField.classList.add('hidden');
  }

  // Auto-resize textareas
  autoResizeTextarea(urlEl);
  autoResizeTextarea(bodyEl);
  syncSearchUrlState();
}

function onSearchConfigChange() {
  const method = document.getElementById('searchMethod').value;
  const bodyField = document.getElementById('searchBodyField');
  // POST Body 始终显示
  rebuildSearchUrlFromForm();
}

/**
 * Rebuild the search URL textarea when user edits method/charset/body in the capture form
 */
function rebuildSearchUrlFromForm() {
  const urlEl = document.getElementById('searchUrlTemplate');
  const methodEl = document.getElementById('searchMethod');
  const charsetEl = document.getElementById('searchCharset');
  const bodyEl = document.getElementById('searchBodyTemplate');
  const webViewEl = document.getElementById('searchWebView');

  const method = methodEl.value;
  const charset = charsetEl.value;
  const body = bodyEl.value;
  const webView = webViewEl.value === 'true';

  // Extract base URL (everything before the first comma+JSON)
  let baseUrl = urlEl.value || '';
  const commaIdx = baseUrl.indexOf(',{');
  if (commaIdx !== -1) {
    baseUrl = baseUrl.substring(0, commaIdx);
  }

  const needsCharset = charset && charset !== 'utf-8';
  if (method === 'POST' || needsCharset || webView) {
    const config = {};
    if (needsCharset) config.charset = charset;
    if (method !== 'GET') config.method = method;
    if (method === 'POST' && body) {
      config.body = body;
    }
    if (webView) {
      config.webView = true;
    }
    urlEl.value = baseUrl + ',' + JSON.stringify(config);
  } else {
    urlEl.value = baseUrl;
  }

  syncSearchUrlState();
}

function handleSearchCaptureConfirm() {
  const url = document.getElementById('searchUrlTemplate').value.trim();

  if (!url) {
    showToast('请输入搜索 URL', 'warning');
    return;
  }

  // 下方搜索 URL 输入框作为唯一数据源
  const searchUrlEl = document.getElementById('searchUrlTemplate');
  searchUrlEl.value = url;
  autoResizeTextarea(searchUrlEl);

  // Save state
  const method = document.getElementById('searchMethod').value;
  const charset = document.getElementById('searchCharset').value.trim() || 'utf-8';
  const body = document.getElementById('searchBodyTemplate').value.trim();
  state.searchConfig = { method, url, charset, body, pageTemplate: '' };
  saveState();

  showToast('搜索 URL 已更新', 'info');
  closeSearchCaptureModal();
}

function handleSearchCaptured(message) {
  // Called when a search request is captured
  searchCaptureReceived = true;
  console.log('[popup] searchCaptured received:', {
    method: message.method,
    url: message.url,
    charset: message.charset,
    body: message.body
  });
  showSearchCaptureForm({
    method: message.method,
    url: message.url,
    charset: message.charset,
    body: message.body,
    forms: message.forms
  });
}

function handleSearchCaptureForms(message) {
  // Fallback: called when forms are detected but no request was captured
  // Skip if we already received searchCaptured (don't overwrite correct data)
  // Skip if user cancelled the capture
  if (searchCaptureReceived || searchCaptureCancelled) return;

  if (message.forms && message.forms.length > 0) {
    const form = message.forms.find((f) => f.hasSearchInput) || message.forms[0];
    if (form && form.action) {
      showSearchCaptureForm({
        method: form.method,
        url: form.action,
        charset: form.charset,
        body: '',
        forms: message.forms
      });
      return;
    }
  }

  // No forms found, show blank form
  showSearchCaptureForm({ method: 'GET', url: '', charset: message.charset || 'utf-8', body: '', forms: [] });
}
