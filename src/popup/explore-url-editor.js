const EXPLORE_PROPS = [
  'layout_flexGrow',
  'layout_flexShrink',
  'layout_alignSelf',
  'layout_flexBasisPercent',
  'layout_wrapBefore'
];

let exploreItems = [];
let selectedCardIndex = -1;
let exploreFormat = 2;
let isCollecting = false;
let batchSelectMode = false;
let selectedCardIndexes = new Set();
let styleTemplates = [];
let defaultTemplateId = '';
let reopenManageAfterTemplateModal = false;
let batchUrlMode = 'template';

function initExploreEditor() {
  bindExploreEvents();
  bindBatchEvents();
  loadStyleTemplateState();
  loadExploreState();
}

function bindExploreEvents() {
  const collectBtn = document.getElementById('exploreCollectBtn');
  if (collectBtn) collectBtn.addEventListener('click', startExploreCollection);

  const stopBtn = document.getElementById('exploreStopCollectBtn');
  if (stopBtn) stopBtn.addEventListener('click', stopExploreCollection);

  const addItemBtn = document.getElementById('exploreAddItemBtn');
  if (addItemBtn) addItemBtn.addEventListener('click', () => addExploreItem({ title: '新分类', url: '' }));

  const addSepBtn = document.getElementById('exploreAddSeparatorBtn');
  if (addSepBtn)
    addSepBtn.addEventListener('click', () => addExploreItem({ title: '分隔', url: '', isSeparator: true }));

  const exportBtn = document.getElementById('exploreExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportExploreJson);

  const clearBtn = document.getElementById('exploreClearBtn');
  if (clearBtn)
    clearBtn.addEventListener('click', () => {
      if (exploreItems.length && !confirm('确定要清空所有发现页URL吗？')) return;
      window.clearExploreEditor();
    });

  const copyBtn = document.getElementById('exploreCopyBtn');
  if (copyBtn)
    copyBtn.addEventListener('click', () => {
      const textarea = document.getElementById('exploreJsonOutput');
      navigator.clipboard.writeText(textarea.value).then(() => window.showToast('已复制到剪贴板', 'info'));
    });

  const closeBtn = document.getElementById('exploreCloseModalBtn');
  if (closeBtn)
    closeBtn.addEventListener('click', () => {
      document.getElementById('exploreJsonModal').classList.add('hidden');
    });

  bindExplorePreviewInput();
  bindFormatToggle();
}

function bindBatchEvents() {
  const toggle = document.getElementById('batchSelectToggle');
  const layoutBtn = document.getElementById('batchLayoutBtn');
  const urlBtn = document.getElementById('batchUrlBtn');
  const defaultTplBtn = document.getElementById('setDefaultTemplateBtn');
  const applyBtn = document.getElementById('applyStyleBtn');
  const layoutApplyBtn = document.getElementById('batchLayoutApplyConfirmBtn');
  const layoutCancelBtn = document.getElementById('batchLayoutCancelBtn');
  const urlApplyBtn = document.getElementById('batchUrlApplyConfirmBtn');
  const urlCancelBtn = document.getElementById('batchUrlCancelBtn');
  const templateSaveBtn = document.getElementById('templateSaveBtn');
  const templateCancelBtn = document.getElementById('templateCancelBtn');
  const defaultCancelBtn = document.getElementById('defaultTemplateCancelBtn');
  const applyConfirmBtn = document.getElementById('applyTemplateConfirmBtn');
  const applyCancelBtn = document.getElementById('applyTemplateCancelBtn');
  const templateSearchInput = document.getElementById('templateSearchInput');
  const templateManageAddBtn = document.getElementById('templateManageAddBtn');
  const selectAllBtn = document.getElementById('batchSelectAllBtn');
  const invertBtn = document.getElementById('batchInvertBtn');
  const tabTemplateBtn = document.getElementById('batchUrlTabTemplate');
  const tabRegexBtn = document.getElementById('batchUrlTabRegex');

  if (toggle) {
    toggle.addEventListener('change', (e) => {
      batchSelectMode = !!e.target.checked;
      if (!batchSelectMode) selectedCardIndexes.clear();
      updateBatchActionAvailability();
      renderExploreCards();
      renderPropsPanel();
    });
  }
  if (layoutBtn)
    layoutBtn.addEventListener('click', () => {
      if (!batchSelectMode) return showBatchNotice('请先开启复选模式', 'warning');
      openBatchModal('batchLayoutModal');
    });
  if (urlBtn)
    urlBtn.addEventListener('click', () => {
      if (!batchSelectMode) return showBatchNotice('请先开启复选模式', 'warning');
      prefillBatchTemplateFieldsFromSelection();
      setBatchUrlMode('template');
      openBatchModal('batchUrlModal');
    });
  if (layoutCancelBtn) layoutCancelBtn.addEventListener('click', () => closeBatchModal('batchLayoutModal'));
  if (layoutApplyBtn) layoutApplyBtn.addEventListener('click', applyBatchLayoutToSelected);
  if (urlCancelBtn) urlCancelBtn.addEventListener('click', () => closeBatchModal('batchUrlModal'));
  if (urlApplyBtn) urlApplyBtn.addEventListener('click', applyBatchUrlToSelected);
  if (templateSaveBtn) templateSaveBtn.addEventListener('click', createStyleTemplateFromModal);
  if (templateCancelBtn)
    templateCancelBtn.addEventListener('click', () => {
      resetTemplateModal();
      closeBatchModal('styleTemplateModal');
      if (reopenManageAfterTemplateModal) {
        reopenManageAfterTemplateModal = false;
        renderTemplateManageList(document.getElementById('templateSearchInput')?.value?.trim() || '');
        openBatchModal('defaultTemplateModal');
      }
    });
  if (defaultTplBtn)
    defaultTplBtn.addEventListener('click', () => {
      const searchEl = document.getElementById('templateSearchInput');
      if (searchEl) searchEl.value = '';
      renderTemplateManageList();
      openBatchModal('defaultTemplateModal');
    });
  if (defaultCancelBtn) defaultCancelBtn.addEventListener('click', () => closeBatchModal('defaultTemplateModal'));
  if (templateManageAddBtn)
    templateManageAddBtn.addEventListener('click', () => {
      resetTemplateModal();
      reopenManageAfterTemplateModal = true;
      openBatchModal('styleTemplateModal');
    });
  if (applyBtn)
    applyBtn.addEventListener('click', () => {
      renderTemplateSelect();
      openBatchModal('applyStyleModal');
    });
  if (applyConfirmBtn) applyConfirmBtn.addEventListener('click', applyTemplateFromModalToSelected);
  if (applyCancelBtn) applyCancelBtn.addEventListener('click', () => closeBatchModal('applyStyleModal'));
  if (selectAllBtn) selectAllBtn.addEventListener('click', selectAllCards);
  if (invertBtn) invertBtn.addEventListener('click', invertSelection);
  if (tabTemplateBtn) tabTemplateBtn.addEventListener('click', () => setBatchUrlMode('template'));
  if (tabRegexBtn) tabRegexBtn.addEventListener('click', () => setBatchUrlMode('regex'));
  if (templateSearchInput) {
    templateSearchInput.addEventListener('input', () => renderTemplateManageList(templateSearchInput.value.trim()));
  }

  bindBatchUrlInputAutoResize();
  updateBatchActionAvailability();
}

function loadStyleTemplateState() {
  chrome.storage.local.get(['exploreStyleState'], (result) => {
    if (result.exploreStyleState) {
      styleTemplates = result.exploreStyleState.templates || [];
      defaultTemplateId = result.exploreStyleState.defaultTemplateId || '';
    }
    ensureTemplateConsistency();
    renderTemplateSelect();
  });
}

function saveStyleTemplateState() {
  chrome.storage.local.set({ exploreStyleState: { templates: styleTemplates, defaultTemplateId } });
}

function renderTemplateSelect() {
  const selects = ['applyTemplateSelect'];
  const options = ['<option value="">选择模板</option>'].concat(
    styleTemplates.map(
      (t) =>
        `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}${t.id === defaultTemplateId ? '（默认）' : ''}</option>`
    )
  );
  selects.forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = options.join('');
    if (defaultTemplateId) select.value = defaultTemplateId;
  });
}

function renderTemplateManageList(keyword = '') {
  const container = document.getElementById('templateManageList');
  if (!container) return;
  const list = styleTemplates.filter((t) => !keyword || t.name.toLowerCase().includes(keyword.toLowerCase()));
  if (!list.length) {
    container.innerHTML = '<div class="template-manage-item">暂无模板</div>';
    return;
  }
  container.innerHTML = list
    .map((t) => {
      const styleText = [
        `layout_flexGrow=${t.style?.layout_flexGrow ?? 1}`,
        `layout_flexShrink=${t.style?.layout_flexShrink ?? 0}`,
        `layout_alignSelf=${t.style?.layout_alignSelf ?? 'auto'}`,
        `layout_flexBasisPercent=${t.style?.layout_flexBasisPercent ?? -1}`,
        `layout_wrapBefore=${!!t.style?.layout_wrapBefore}`
      ].join('\n');
      return `<div class="template-manage-item" data-id="${escapeHtml(t.id)}">
      <div class="row"><span class="name">${escapeHtml(t.name)}</span>${t.id === defaultTemplateId ? '<span class="default-tag">默认</span>' : ''}</div>
      <div class="actions">
        <button class="tpl-view">查看</button>
        <button class="tpl-edit">编辑</button>
        <button class="tpl-default">设默认</button>
        <button class="tpl-delete" ${styleTemplates.length <= 1 ? 'disabled' : ''}>删除</button>
      </div>
      <div class="detail hidden">${escapeHtml(styleText)}</div>
    </div>`;
    })
    .join('');

  container.querySelectorAll('.template-manage-item').forEach((itemEl) => {
    const id = itemEl.dataset.id;
    itemEl.querySelector('.tpl-view')?.addEventListener('click', () => {
      itemEl.querySelector('.detail')?.classList.toggle('hidden');
    });
    itemEl.querySelector('.tpl-edit')?.addEventListener('click', () => openEditTemplateModal(id));
    itemEl.querySelector('.tpl-default')?.addEventListener('click', () => setTemplateAsDefault(id));
    itemEl.querySelector('.tpl-delete')?.addEventListener('click', () => deleteTemplate(id));
  });
}

function openBatchModal(id) {
  closeAllBatchModals();
  document.getElementById(id)?.classList.remove('hidden');
}

function closeBatchModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function closeAllBatchModals() {
  ['batchLayoutModal', 'batchUrlModal', 'styleTemplateModal', 'defaultTemplateModal', 'applyStyleModal'].forEach((id) =>
    document.getElementById(id)?.classList.add('hidden')
  );
}

function updateBatchActionAvailability() {
  const layoutBtn = document.getElementById('batchLayoutBtn');
  const urlBtn = document.getElementById('batchUrlBtn');
  const selectIds = ['batchSelectAllBtn', 'batchInvertBtn'];
  if (layoutBtn) {
    layoutBtn.disabled = !batchSelectMode;
    layoutBtn.classList.toggle('disabled', !batchSelectMode);
  }
  if (urlBtn) {
    urlBtn.disabled = !batchSelectMode;
    urlBtn.classList.toggle('disabled', !batchSelectMode);
  }
  selectIds.forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = !batchSelectMode;
    btn.classList.toggle('disabled', !batchSelectMode);
  });
}

function showBatchNotice(message, type = 'info') {
  window.showToast(message, type);
}

function setBatchUrlMode(mode) {
  batchUrlMode = mode === 'regex' ? 'regex' : 'template';
  const templateBtn = document.getElementById('batchUrlTabTemplate');
  const regexBtn = document.getElementById('batchUrlTabRegex');
  const templatePanel = document.getElementById('batchUrlPanelTemplate');
  const regexPanel = document.getElementById('batchUrlPanelRegex');

  if (templateBtn) templateBtn.classList.toggle('active', batchUrlMode === 'template');
  if (regexBtn) regexBtn.classList.toggle('active', batchUrlMode === 'regex');
  if (templatePanel) templatePanel.classList.toggle('hidden', batchUrlMode !== 'template');
  if (regexPanel) regexPanel.classList.toggle('hidden', batchUrlMode !== 'regex');
}

function bindBatchUrlInputAutoResize() {
  const ids = [
    'batchCategoryPattern',
    'batchPagedUrlTemplate',
    'batchFirstPageDiff',
    'batchUrlPattern',
    'batchUrlReplacement'
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.batchResizeBound === '1') return;
    el.dataset.batchResizeBound = '1';
    if (typeof autoResizeTextarea === 'function') {
      autoResizeTextarea(el);
      return;
    }
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 19;
    const maxHeight = lineHeight * 10;
    const resize = () => {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    };
    el.addEventListener('input', resize);
    resize();
  });
}

function getFirstSelectedUrl() {
  const sortedIndexes = Array.from(selectedCardIndexes).sort((a, b) => a - b);
  for (const i of sortedIndexes) {
    const item = exploreItems[i];
    if (!item || item.isSeparator) continue;
    const url = String(item.url || '').trim();
    if (url) return url;
  }
  return '';
}

function setBatchUrlFieldValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function prefillBatchTemplateFieldsFromSelection() {
  const sampleUrl = getFirstSelectedUrl();
  if (!sampleUrl) return;
  setBatchUrlFieldValue('batchCategoryPattern', sampleUrl);
  setBatchUrlFieldValue('batchPagedUrlTemplate', sampleUrl);
}

function updateCollectionStatus(active, count = 0) {
  isCollecting = active;
  const statusEl = document.getElementById('exploreCollectionStatus');
  const countDisplay = document.getElementById('exploreCountDisplay');
  const collectBtn = document.getElementById('exploreCollectBtn');
  const indicatorEl = document.getElementById('exploreCollectionIndicator');

  if (active) {
    if (statusEl) statusEl.classList.remove('hidden');
    if (indicatorEl) indicatorEl.classList.remove('hidden');
    if (countDisplay) countDisplay.textContent = count;
    if (collectBtn) collectBtn.disabled = true;
  } else {
    if (statusEl) statusEl.classList.add('hidden');
    if (indicatorEl) indicatorEl.classList.add('hidden');
    if (collectBtn) collectBtn.disabled = false;
  }
}

function updateExploreCollectionIndicator(step, elementInfo, elementText) {
  const indicatorEl = document.getElementById('exploreCollectionIndicator');
  const stepEl = document.getElementById('exploreIndicatorStep');
  const elementEl = document.getElementById('exploreIndicatorElement');
  if (!indicatorEl || indicatorEl.classList.contains('hidden')) return;
  if (stepEl) stepEl.textContent = step || '-';
  if (elementEl) elementEl.textContent = elementInfo ? `${elementInfo} ${elementText || ''}` : '-';
}

function startExploreCollection() {
  if (isCollecting) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    const tabId = tabs[0].id;
    chrome.tabs.sendMessage(tabId, { action: 'startExploreCollector' }, (response) => {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript({ target: { tabId }, files: ['content/picker.js'] }).then(() => {
          chrome.scripting.insertCSS({ target: { tabId }, files: ['content/picker.css'] });
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: 'startExploreCollector' });
          }, 200);
        });
      }
    });
  });
}

function stopExploreCollection() {
  if (!isCollecting) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { action: 'stopExploreCollector' });
    finishCollection();
  });
}

function finishCollection() {
  isCollecting = false;
  updateCollectionStatus(false);
}

window.handleExploreCollected = function (items) {
  items.forEach((item) => {
    addExploreItem({ title: item.title, url: item.url });
  });
  updateExploreUrlPreview();
  finishCollection();
};

window.handleExploreItemCollected = function (item, total) {
  updateCollectionStatus(true, total);
  updateExploreCollectionIndicator('收集中', `<a>`, item.title);
};

window.handleExploreCollectionStarted = function () {
  updateCollectionStatus(true, 0);
};

window.handleExploreElementHover = function (message) {
  updateExploreCollectionIndicator('收集中', message.elementInfo, message.elementText);
};

function loadExploreState() {
  chrome.storage.local.get(['exploreEditorState'], (result) => {
    if (result.exploreEditorState) {
      if (result.exploreEditorState.items) {
        exploreItems = result.exploreEditorState.items;
        renderExploreCards();
      }
      if (result.exploreEditorState.format) {
        exploreFormat = result.exploreEditorState.format;
      }
      updateExploreUrlPreview();
      updateFormatButtons();
    }
  });
}

function saveExploreState() {
  chrome.storage.local.set({ exploreEditorState: { items: exploreItems, format: exploreFormat } });
}

function addExploreItem(item) {
  ensureTemplateConsistency();
  const defaults = { title: '', url: '', isSeparator: false, style: getDefaultStyle() };
  exploreItems.push({ ...defaults, ...item, style: { ...defaults.style, ...(item.style || {}) } });
  saveExploreState();
  renderExploreCards();
  updateExploreUrlPreview();
}

function removeExploreItem(index) {
  exploreItems.splice(index, 1);
  selectedCardIndexes = new Set(
    Array.from(selectedCardIndexes)
      .filter((i) => i !== index)
      .map((i) => (i > index ? i - 1 : i))
  );
  if (selectedCardIndex === index) selectedCardIndex = -1;
  else if (selectedCardIndex > index) selectedCardIndex--;
  saveExploreState();
  renderExploreCards();
  renderPropsPanel();
  updateExploreUrlPreview();
}

function renderExploreCards() {
  const container = document.getElementById('exploreCards');
  if (!container) return;

  container.innerHTML = exploreItems
    .map((item, i) => {
      const selected = i === selectedCardIndex ? ' selected' : '';
      const batchSelected = selectedCardIndexes.has(i) ? ' batch-selected' : '';
      const sepClass = item.isSeparator ? ' separator' : '';
      const flexGrow = item.style?.layout_flexGrow ?? 1;
      const flexShrink = item.style?.layout_flexShrink ?? 0;
      const flexBasis = item.style?.layout_flexBasisPercent ?? -1;
      const basisCss = flexBasis > 0 ? `${Math.round(flexBasis * 10000) / 100}%` : 'auto';
      const widthStyle =
        flexBasis > 0
          ? `flex: ${flexGrow} ${flexShrink} ${basisCss}; max-width: ${basisCss};`
          : `flex: ${flexGrow} ${flexShrink} calc((100% - 8px) / 3);`;

      return `<div class="editor-card${selected}${batchSelected}${sepClass}" data-index="${i}" style="${widthStyle}">
      ${batchSelectMode ? `<input type="checkbox" class="card-check" data-index="${i}" ${selectedCardIndexes.has(i) ? 'checked' : ''}>` : ''}
      <span class="card-title">${escapeHtml(item.title)}</span>
      ${item.url ? `<span class="card-url">${escapeHtml(item.url.substring(0, 40))}${item.url.length > 40 ? '...' : ''}</span>` : ''}
      <button class="card-delete" data-index="${i}">×</button>
      <div class="card-resize-handle" data-index="${i}"></div>
    </div>`;
    })
    .join('');

  container.querySelectorAll('.editor-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('card-delete')) return;
      if (e.target.classList.contains('card-resize-handle')) return;
      if (e.target.classList.contains('card-check')) return;
      if (batchSelectMode) {
        const idx = parseInt(card.dataset.index, 10);
        if (selectedCardIndexes.has(idx)) selectedCardIndexes.delete(idx);
        else selectedCardIndexes.add(idx);
        renderExploreCards();
        return;
      }
      selectedCardIndex = parseInt(card.dataset.index, 10);
      renderExploreCards();
      renderPropsPanel();
    });
  });

  container.querySelectorAll('.card-check').forEach((chk) => {
    chk.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(chk.dataset.index, 10);
      if (chk.checked) selectedCardIndexes.add(idx);
      else selectedCardIndexes.delete(idx);
      renderExploreCards();
    });
  });

  container.querySelectorAll('.card-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeExploreItem(parseInt(btn.dataset.index, 10));
    });
  });

  initCardDragDrop();
  initCardResize();
}

function initCardDragDrop() {
  const container = document.getElementById('exploreCards');
  if (!container) return;

  let dragIndex = -1;

  container.querySelectorAll('.editor-card').forEach((card) => {
    card.draggable = true;

    card.addEventListener('dragstart', (e) => {
      dragIndex = parseInt(card.dataset.index, 10);
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      container.querySelectorAll('.editor-card').forEach((c) => (c.style.borderTop = ''));
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const targetIndex = parseInt(card.dataset.index, 10);
      if (targetIndex !== dragIndex && dragIndex >= 0) {
        card.style.borderTop = '2px solid var(--accent)';
      }
    });

    card.addEventListener('dragleave', () => {
      card.style.borderTop = '';
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.style.borderTop = '';
      const targetIndex = parseInt(card.dataset.index, 10);
      if (targetIndex !== dragIndex && dragIndex >= 0) {
        const [moved] = exploreItems.splice(dragIndex, 1);
        exploreItems.splice(targetIndex, 0, moved);
        if (selectedCardIndex === dragIndex) selectedCardIndex = targetIndex;
        saveExploreState();
        renderExploreCards();
      }
      dragIndex = -1;
    });
  });
}

function initCardResize() {
  const container = document.getElementById('exploreCards');
  if (!container) return;

  let resizing = false;
  let resizeStartX = 0;
  let resizeCardIndex = -1;
  let resizeStartFlexBasis = 0;

  container.querySelectorAll('.card-resize-handle').forEach((handle) => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resizing = true;
      resizeStartX = e.clientX;
      resizeCardIndex = parseInt(handle.dataset.index, 10);
      resizeStartFlexBasis = exploreItems[resizeCardIndex].style?.layout_flexBasisPercent ?? -1;
      document.addEventListener('mousemove', onResizeMove);
      document.addEventListener('mouseup', onResizeEnd);
    });
  });

  function onResizeMove(e) {
    if (!resizing || resizeCardIndex < 0) return;
    const dx = e.clientX - resizeStartX;
    const pctChange = dx / 100;
    const newBasis = Math.round(Math.max(-1, Math.min(1, resizeStartFlexBasis + pctChange)) * 100) / 100;
    exploreItems[resizeCardIndex].style.layout_flexBasisPercent = newBasis;
    renderExploreCards();
    if (selectedCardIndex === resizeCardIndex) renderPropsPanel();
  }

  function onResizeEnd() {
    resizing = false;
    resizeCardIndex = -1;
    saveExploreState();
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  }
}

function renderPropsPanel() {
  const container = document.getElementById('exploreProps');
  if (!container) return;

  if (batchSelectMode) {
    container.innerHTML = '<div class="props-placeholder">复选模式中：右侧单项编辑已禁用，请使用批量工具</div>';
    return;
  }

  if (selectedCardIndex < 0 || selectedCardIndex >= exploreItems.length) {
    container.innerHTML = '<div class="props-placeholder">选择卡片编辑样式</div>';
    return;
  }

  const item = exploreItems[selectedCardIndex];
  const s = item.style || {};

  container.innerHTML = `
    <div class="props-form">
      <label>
        <span>标题</span>
        <textarea id="propTitle" class="input" rows="1">${escapeHtml(item.title)}</textarea>
      </label>
      <label>
        <span>URL</span>
        <textarea id="propUrl" class="input" rows="1" ${item.isSeparator ? 'readonly placeholder="分隔项无URL"' : ''}>${escapeHtml(item.url)}</textarea>
      </label>
      <div class="prop-row">
        <span class="prop-label">layout_flexGrow</span>
        <input type="number" id="propFlexGrow" class="input" value="${s.layout_flexGrow ?? 1}" step="1">
      </div>
      <div class="prop-row">
        <span class="prop-label">layout_flexShrink</span>
        <input type="number" id="propFlexShrink" class="input" value="${s.layout_flexShrink ?? 0}" step="1">
      </div>
      <div class="prop-row">
        <span class="prop-label">layout_alignSelf</span>
        <input type="text" id="propAlignSelf" class="input" value="${s.layout_alignSelf ?? 'auto'}">
      </div>
      <div class="prop-row">
        <span class="prop-label">layout_flexBasisPercent</span>
        <input type="number" id="propFlexBasisPercent" class="input" value="${s.layout_flexBasisPercent ?? -1}" step="0.1">
      </div>
      <div class="prop-row">
        <span class="prop-label">layout_wrapBefore</span>
        <input type="checkbox" id="propWrapBefore" ${s.layout_wrapBefore ? 'checked' : ''}>
      </div>
    </div>
  `;

  const bind = (id, prop, transform, target = 'style') => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const val = transform ? transform(el) : el.value;
      if (target === 'item') {
        exploreItems[selectedCardIndex][prop] = val;
      } else {
        exploreItems[selectedCardIndex].style[prop] = val;
      }
      saveExploreState();
      renderExploreCards();
      updateExploreUrlPreview();
    });
    if (el.type === 'checkbox') {
      el.addEventListener('change', () => {
        if (target === 'item') {
          exploreItems[selectedCardIndex][prop] = el.checked;
        } else {
          exploreItems[selectedCardIndex].style[prop] = el.checked;
        }
        saveExploreState();
        renderExploreCards();
        updateExploreUrlPreview();
      });
    }
  };

  bind('propTitle', 'title', (el) => el.value, 'item');
  bind('propUrl', 'url', (el) => el.value, 'item');
  bind('propFlexGrow', 'layout_flexGrow', (el) => parseFloat(el.value) || 0);
  bind('propFlexShrink', 'layout_flexShrink', (el) => parseFloat(el.value) || 0);
  bind('propAlignSelf', 'layout_alignSelf', (el) => el.value);
  bind('propFlexBasisPercent', 'layout_flexBasisPercent', (el) => parseFloat(el.value) ?? -1);
  bind('propWrapBefore', 'layout_wrapBefore', (el) => el.checked);

  const propTitle = document.getElementById('propTitle');
  const propUrl = document.getElementById('propUrl');
  if (propTitle) autoResize(propTitle);
  if (propUrl) autoResize(propUrl);
}

function autoResize(el) {
  const resize = () => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  el.addEventListener('input', resize);
  resize();
}

function exportExploreJson() {
  const output =
    exploreFormat === 1
      ? itemsToExploreUrlFormat1(exploreItems)
      : JSON.stringify(itemsToExploreJson(exploreItems), null, 2);

  document.getElementById('exploreJsonOutput').value = output;
  document.getElementById('exploreJsonModal').classList.remove('hidden');
}

function getExploreJsonString() {
  return exploreFormat === 1 ? itemsToExploreUrlFormat1(exploreItems) : itemsToExploreJson(exploreItems);
}

window.getExploreUrlEditorItems = getExploreJsonString;
window.itemsToExploreUrl = itemsToExploreUrl;
window.clearExploreEditor = function () {
  exploreItems = [];
  selectedCardIndex = -1;
  saveExploreState();
  renderExploreCards();
  renderPropsPanel();
  updateExploreUrlPreview();
};

function itemsToExploreUrl(items) {
  return items
    .map((item) => {
      const url = item.isSeparator ? '' : item.url;
      return `${item.title}::${url}`;
    })
    .join('\n');
}

function updateExploreUrlPreview() {
  const textarea = document.getElementById('exploreUrlPreview');
  if (!textarea) return;
  if (!exploreItems.length) {
    textarea.value = '';
    textarea.style.height = 'auto';
    return;
  }
  textarea.value =
    exploreFormat === 1
      ? itemsToExploreUrlFormat1(exploreItems)
      : JSON.stringify(itemsToExploreJson(exploreItems), null, 2);
  setTimeout(() => autoResizePreview(), 0);
}

function autoResizePreview() {
  const textarea = document.getElementById('exploreUrlPreview');
  if (!textarea) return;
  const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 19;
  const maxHeight = lineHeight * 10;
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
}

function itemsToExploreUrlFormat1(items) {
  return items
    .map((item) => {
      const url = item.isSeparator ? '' : item.url;
      return `${item.title}::${url}`;
    })
    .join('\n');
}

function itemsToExploreJson(items) {
  return items.map((item) => {
    const obj = { title: item.title, url: item.url };
    const style = {};
    EXPLORE_PROPS.forEach((prop) => {
      const val = item.style?.[prop];
      if (val !== undefined && val !== null && val !== false && val !== 'auto' && val !== -1 && val !== 0) {
        style[prop] = val;
      }
    });
    if (Object.keys(style).length > 0) obj.style = style;
    return obj;
  });
}

function bindFormatToggle() {
  document.querySelectorAll('.format-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      exploreFormat = parseInt(btn.dataset.format, 10);
      saveExploreState();
      updateExploreUrlPreview();
      updateFormatButtons();
    });
  });
}

function updateFormatButtons() {
  document.querySelectorAll('.format-btn').forEach((btn) => {
    btn.classList.toggle('active', parseInt(btn.dataset.format, 10) === exploreFormat);
  });
}

function bindExplorePreviewInput() {
  const textarea = document.getElementById('exploreUrlPreview');
  if (!textarea) return;

  textarea.addEventListener('input', () => {
    const lines = textarea.value.split('\n').filter((l) => l.trim());
    exploreItems = lines.map((line) => {
      const sepIdx = line.indexOf('::');
      if (sepIdx === -1) {
        return { title: line.trim(), url: '', isSeparator: false, style: getDefaultStyle() };
      }
      const title = line.substring(0, sepIdx).trim();
      const url = line.substring(sepIdx + 2).trim();
      return { title, url, isSeparator: !url, style: getDefaultStyle() };
    });
    saveExploreState();
    renderExploreCards();
    renderPropsPanel();
  });
}

function getDefaultStyle() {
  const template = styleTemplates.find((t) => t.id === defaultTemplateId);
  if (template?.style) {
    return {
      layout_flexGrow: template.style.layout_flexGrow ?? 1,
      layout_flexShrink: template.style.layout_flexShrink ?? 0,
      layout_alignSelf: template.style.layout_alignSelf ?? 'auto',
      layout_flexBasisPercent: template.style.layout_flexBasisPercent ?? -1,
      layout_wrapBefore: template.style.layout_wrapBefore ?? false
    };
  }
  return {
    layout_flexGrow: 1,
    layout_flexShrink: 0,
    layout_alignSelf: 'auto',
    layout_flexBasisPercent: parseFloat(document.getElementById('tplFlexBasisPercent')?.value || '-1'),
    layout_wrapBefore: false
  };
}

function getBatchStylePatch() {
  const patch = {};
  if (document.getElementById('batchEnableFlexGrow')?.checked)
    patch.layout_flexGrow = parseFloat(document.getElementById('batchFlexGrow')?.value || '1') || 0;
  if (document.getElementById('batchEnableFlexShrink')?.checked)
    patch.layout_flexShrink = parseFloat(document.getElementById('batchFlexShrink')?.value || '0') || 0;
  if (document.getElementById('batchEnableAlignSelf')?.checked)
    patch.layout_alignSelf = document.getElementById('batchAlignSelf')?.value || 'auto';
  if (document.getElementById('batchEnableFlexBasis')?.checked)
    patch.layout_flexBasisPercent = parseFloat(document.getElementById('batchFlexBasisPercent')?.value || '-1');
  if (document.getElementById('batchEnableWrapBefore')?.checked)
    patch.layout_wrapBefore = !!document.getElementById('batchWrapBefore')?.checked;
  return patch;
}

function getBatchUrlReplaceConfig() {
  const pattern = document.getElementById('batchUrlPattern')?.value || '';
  if (!pattern.trim()) return null;
  return {
    pattern,
    replacement: document.getElementById('batchUrlReplacement')?.value || '',
    global: !!document.getElementById('batchRegexGlobal')?.checked,
    ignoreCase: !!document.getElementById('batchRegexIgnoreCase')?.checked
  };
}

function getBatchCategoryPagingConfig() {
  const categoryPattern = document.getElementById('batchCategoryPattern')?.value?.trim() || '';
  const pagedUrlTemplate = document.getElementById('batchPagedUrlTemplate')?.value?.trim() || '';
  const firstPageDiff = document.getElementById('batchFirstPageDiff')?.value?.trim() || '';
  if (!categoryPattern && !pagedUrlTemplate && !firstPageDiff) return null;
  return { categoryPattern, pagedUrlTemplate, firstPageDiff };
}

function applyBatchLayoutToSelected() {
  if (!selectedCardIndexes.size) {
    window.showToast('请先在复选模式下选择卡片', 'warning');
    return;
  }
  const patch = getBatchStylePatch();
  if (!Object.keys(patch).length) {
    window.showToast('请至少勾选一个要修改的 layout 属性', 'warning');
    return;
  }
  const targetIndexes = Array.from(selectedCardIndexes);
  targetIndexes.forEach((i) => {
    if (!exploreItems[i]) return;
    exploreItems[i].style = { ...(exploreItems[i].style || {}), ...patch };
  });
  saveExploreState();
  renderExploreCards();
  renderPropsPanel();
  showBatchNotice(`已更新 layout ${targetIndexes.length} 项`);
  closeBatchModal('batchLayoutModal');
}

function applyBatchUrlToSelected() {
  if (!selectedCardIndexes.size) {
    window.showToast('请先在复选模式下选择卡片', 'warning');
    return;
  }
  if (typeof BatchUrlUtils === 'undefined') {
    window.showToast('URL 替换工具未加载，请刷新后重试', 'error');
    return;
  }

  const useTemplateMode = batchUrlMode !== 'regex';
  const urlConfig = useTemplateMode ? null : getBatchUrlReplaceConfig();
  const categoryConfig = useTemplateMode ? getBatchCategoryPagingConfig() : null;

  if (useTemplateMode && !categoryConfig) {
    window.showToast('模板匹配模式下，请填写分类匹配模板与翻页模板', 'warning');
    return;
  }
  if (!useTemplateMode && !urlConfig) {
    window.showToast('正则匹配模式下，请填写正则表达式', 'warning');
    return;
  }

  if (categoryConfig) {
    const hasCategoryPattern = !!categoryConfig.categoryPattern;
    const hasPagedTemplate = !!categoryConfig.pagedUrlTemplate;
    if (hasCategoryPattern !== hasPagedTemplate) {
      window.showToast('分类匹配模板和翻页模板需同时填写', 'warning');
      return;
    }
  }
  const targetIndexes = Array.from(selectedCardIndexes);
  if (urlConfig) {
    try {
      BatchUrlUtils.buildBatchReplaceRegex(urlConfig.pattern, urlConfig);
    } catch (error) {
      window.showToast(`URL 正则无效：${error.message || error}`, 'error');
      return;
    }
  }
  let changedCount = 0;
  let effectiveCount = 0;
  targetIndexes.forEach((i) => {
    const item = exploreItems[i];
    if (!item || item.isSeparator) return;
    effectiveCount += 1;
    const prevUrl = String(item.url || '');
    let nextUrl = prevUrl;
    if (categoryConfig) {
      nextUrl = BatchUrlUtils.applyCategoryPagingByTemplate(nextUrl, categoryConfig);
    }
    if (urlConfig) {
      nextUrl = BatchUrlUtils.replaceUrlByRegex(nextUrl, urlConfig.pattern, urlConfig.replacement, urlConfig);
    }
    item.url = nextUrl;
    if (nextUrl !== prevUrl) changedCount += 1;
  });
  saveExploreState();
  updateExploreUrlPreview();
  renderExploreCards();
  renderPropsPanel();
  showBatchNotice(`已更新 URL ${changedCount}/${effectiveCount} 项`);
  closeBatchModal('batchUrlModal');
}

function createStyleTemplateFromModal() {
  const editingId = document.getElementById('editingTemplateId')?.value || '';
  const name = document.getElementById('templateName')?.value?.trim();
  if (!name) return;
  const style = {
    layout_flexGrow: parseFloat(document.getElementById('tplFlexGrow')?.value || '1') || 0,
    layout_flexShrink: parseFloat(document.getElementById('tplFlexShrink')?.value || '0') || 0,
    layout_alignSelf: document.getElementById('tplAlignSelf')?.value || 'auto',
    layout_flexBasisPercent: parseFloat(document.getElementById('tplFlexBasisPercent')?.value || '-1'),
    layout_wrapBefore: !!document.getElementById('tplWrapBefore')?.checked
  };
  if (editingId) {
    styleTemplates = styleTemplates.map((t) => (t.id === editingId ? { ...t, name, style } : t));
    showBatchNotice(`已更新模板：${name}`);
  } else {
    const id = `tpl_${Date.now()}`;
    styleTemplates.push({ id, name, style });
    showBatchNotice(`已新增模板：${name}`);
  }
  saveStyleTemplateState();
  renderTemplateSelect();
  renderTemplateManageList();
  resetTemplateModal();
  closeBatchModal('styleTemplateModal');
  if (reopenManageAfterTemplateModal) {
    reopenManageAfterTemplateModal = false;
    renderTemplateManageList(document.getElementById('templateSearchInput')?.value?.trim() || '');
    openBatchModal('defaultTemplateModal');
  }
}

function openEditTemplateModal(id) {
  const tpl = styleTemplates.find((t) => t.id === id);
  if (!tpl) return;
  document.getElementById('styleTemplateModalTitle').textContent = '编辑样式模板';
  document.getElementById('editingTemplateId').value = tpl.id;
  document.getElementById('templateName').value = tpl.name || '';
  document.getElementById('tplFlexGrow').value = tpl.style?.layout_flexGrow ?? 1;
  document.getElementById('tplFlexShrink').value = tpl.style?.layout_flexShrink ?? 0;
  document.getElementById('tplAlignSelf').value = tpl.style?.layout_alignSelf ?? 'auto';
  document.getElementById('tplFlexBasisPercent').value = tpl.style?.layout_flexBasisPercent ?? -1;
  document.getElementById('tplWrapBefore').checked = !!tpl.style?.layout_wrapBefore;
  reopenManageAfterTemplateModal = true;
  openBatchModal('styleTemplateModal');
}

function setTemplateAsDefault(id) {
  defaultTemplateId = id;
  saveStyleTemplateState();
  renderTemplateSelect();
  renderTemplateManageList(document.getElementById('templateSearchInput')?.value?.trim() || '');
  showBatchNotice('默认模板已更新');
}

function deleteTemplate(id) {
  if (styleTemplates.length <= 1) {
    showBatchNotice('至少保留一个模板');
    return;
  }
  const tpl = styleTemplates.find((t) => t.id === id);
  if (!tpl) return;
  if (!confirm(`确认删除模板「${tpl.name}」吗？`)) return;
  styleTemplates = styleTemplates.filter((t) => t.id !== id);
  if (defaultTemplateId === id) defaultTemplateId = '';
  saveStyleTemplateState();
  renderTemplateSelect();
  renderTemplateManageList(document.getElementById('templateSearchInput')?.value?.trim() || '');
  showBatchNotice('模板已删除');
}

function ensureTemplateConsistency() {
  if (!Array.isArray(styleTemplates)) styleTemplates = [];
  if (!styleTemplates.length) {
    const id = `tpl_${Date.now()}`;
    styleTemplates = [
      {
        id,
        name: '默认',
        style: {
          layout_flexGrow: 1,
          layout_flexShrink: 0,
          layout_alignSelf: 'auto',
          layout_flexBasisPercent: -1,
          layout_wrapBefore: false
        }
      }
    ];
    defaultTemplateId = id;
    saveStyleTemplateState();
    return;
  }
  styleTemplates = styleTemplates.map((t) => ({
    ...t,
    style: {
      layout_flexGrow: t.style?.layout_flexGrow ?? 1,
      layout_flexShrink: t.style?.layout_flexShrink ?? 0,
      layout_alignSelf: t.style?.layout_alignSelf ?? 'auto',
      layout_flexBasisPercent: t.style?.layout_flexBasisPercent ?? -1,
      layout_wrapBefore: t.style?.layout_wrapBefore ?? false
    }
  }));
  if (!defaultTemplateId || !styleTemplates.some((t) => t.id === defaultTemplateId)) {
    defaultTemplateId = styleTemplates[0].id;
  }
  saveStyleTemplateState();
}

function selectAllCards() {
  if (!batchSelectMode) return;
  selectedCardIndexes = new Set(exploreItems.map((_, i) => i));
  renderExploreCards();
}

function invertSelection() {
  if (!batchSelectMode) return;
  const next = new Set();
  exploreItems.forEach((_, i) => {
    if (!selectedCardIndexes.has(i)) next.add(i);
  });
  selectedCardIndexes = next;
  renderExploreCards();
}

function clearSelection() {
  selectedCardIndexes.clear();
  renderExploreCards();
}

function resetTemplateModal() {
  document.getElementById('styleTemplateModalTitle').textContent = '新增样式模板';
  document.getElementById('editingTemplateId').value = '';
  document.getElementById('templateName').value = '';
  document.getElementById('tplFlexGrow').value = 1;
  document.getElementById('tplFlexShrink').value = 0;
  document.getElementById('tplAlignSelf').value = 'auto';
  document.getElementById('tplFlexBasisPercent').value = -1;
  document.getElementById('tplWrapBefore').checked = false;
}

function applyTemplateFromModalToSelected() {
  const select = document.getElementById('applyTemplateSelect');
  const tpl = styleTemplates.find((t) => t.id === select?.value);
  if (!tpl) {
    window.showToast('请先选择模板', 'warning');
    return;
  }
  const targetIndexes =
    batchSelectMode && selectedCardIndexes.size
      ? Array.from(selectedCardIndexes)
      : selectedCardIndex >= 0
        ? [selectedCardIndex]
        : [];
  if (!targetIndexes.length) {
    window.showToast('请先选择卡片（单选或复选）', 'warning');
    return;
  }
  targetIndexes.forEach((i) => {
    if (!exploreItems[i]) return;
    exploreItems[i].style = { ...(exploreItems[i].style || {}), ...(tpl.style || {}) };
  });
  saveExploreState();
  renderExploreCards();
  renderPropsPanel();
  showBatchNotice(`已应用模板到 ${targetIndexes.length} 项`);
  closeBatchModal('applyStyleModal');
}
