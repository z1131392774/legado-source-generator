/**
 * Content Script - Element Picker
 * Handles element selection for rule creation
 */

(function () {
  'use strict';

  // State
  let isPickerActive = false;
  let currentHoveredElement = null;
  let selectedElement = null;
  let firstItemElement = null;
  let hoverTimeout = null;
  let currentStep = 'bookList';
  let isListField = false;
  let rootElement = null;
  let listItemSelector = '';

  // Explore collector state
  let isExploreCollectorActive = false;
  let exploreCollectedItems = [];

  /**
   * Check if extension context is still valid.
   * Returns false after extension reload/update.
   */
  function isContextValid() {
    try {
      return !!chrome.runtime?.id;
    } catch (e) {
      return false;
    }
  }

  /**
   * Safe wrapper for chrome.runtime.sendMessage.
   * Handles Extension context invalidated errors gracefully.
   */
  function safeSendMessage(message, callback) {
    if (!isContextValid()) {
      console.warn('[Picker] Extension context invalidated, stopping picker');
      stopPicker();
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (response) => {
        void chrome.runtime.lastError;
        if (callback) callback(response);
      });
    } catch (e) {
      console.warn('[Picker] sendMessage failed:', e.message);
      stopPicker();
    }
  }

  // Known root elements for smart detection
  const KNOWN_ROOTS = {
    bookList: ['#bookList', '.book-list', '[data-book-list]', '.novel-list', '#novel-list', '.chapter-list'],
    bookItem: ['.book-item', '.novel-item', '[data-book-item]', '.book-card', '.story-item']
  };

  /**
   * Show toast notification - delegate to popup
   * @param {string} message - Toast message
   * @param {string} type - Toast type: 'warning' | 'error' | 'info'
   */
  function showToast(message, type = 'warning') {
    // 仅在侧边栏显示提示，避免网页与侧边栏重复弹出。
    safeSendMessage({ action: 'showToast', message: message, type: type });
  }

  /**
   * Check if element is inside Shadow DOM
   * @param {Element} element - The element to check
   * @returns {boolean}
   */
  function isInShadowDOM(element) {
    return !!element.getRootNode().host;
  }

  /**
   * Check if element is inside an iframe
   * @param {Element} element - The element to check
   * @returns {boolean}
   */
  function isInIframe(element) {
    return window.frameElement !== null;
  }

  /**
   * Check if selector uses auto-generated class (contains hash-like patterns)
   * @param {string} selector - The CSS selector
   * @returns {boolean}
   */
  function hasDynamicClass(selector) {
    // Match patterns like .aB3xY, ._123, .random-hash
    const dynamicClassPattern = /\.-?[_a-zA-Z]+[_a-zA-Z0-9]*[0-9]+[a-zA-Z0-9]*|\.[0-9]+[a-zA-Z]/;
    return dynamicClassPattern.test(selector);
  }

  /**
   * Check if selector returns any elements
   * @param {string} selector - The CSS selector
   * @returns {number} - Number of matching elements
   */
  function countSelectorMatches(selector) {
    try {
      return document.querySelectorAll(selector).length;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Find the appropriate root element for selector generation
   * @param {Element} element - The target element
   * @returns {Element|null} - The root element or null
   */
  function findSmartRoot(element) {
    // Try to find bookList container
    for (const selector of KNOWN_ROOTS.bookList) {
      try {
        const root = document.querySelector(selector);
        if (root && root.contains(element) && root !== element) {
          return root;
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return document.body;
  }

  /**
   * Check if element matches current step context
   * @param {Element} element - The element to check
   * @returns {Object} - { matches: boolean, warning: string }
   */
  function checkElementContext(element) {
    const result = { matches: true, warning: '' };

    // Detect potential multi-element selection
    try {
      const selector = getCssSelector(element, { root: findSmartRoot(element), preferReusable: true });
      const matches = document.querySelectorAll(selector);

      if (matches.length > 1) {
        result.warning = `Warning: This selector matches ${matches.length} elements`;
      }
    } catch (e) {
      // Ignore errors
    }

    // Check if element is likely interactive
    const isInteractive = ['a', 'button', 'input', 'select', 'textarea'].includes(element.tagName.toLowerCase());

    if (currentStep === 'coverUrl') {
      const hasImage =
        element.tagName.toLowerCase() === 'img' ||
        element.querySelector('img') !== null ||
        element.style.backgroundImage;
      if (!hasImage) {
        result.warning = 'Expected image element for cover URL';
      }
    }

    if (currentStep === 'lastChapter') {
      const isLink = element.tagName.toLowerCase() === 'a';
      if (!isLink && !element.querySelector('a')) {
        result.warning = 'Expected link element for chapter';
      }
    }

    return result;
  }

  /**
   * Handle mouseover - highlight element
   * @param {MouseEvent} event
   */
  function handleMouseOver(event) {
    if (!isPickerActive) return;

    const element = event.target;
    if (!element || element === document.body || element === document.documentElement) {
      return;
    }

    // Clear previous highlight
    if (currentHoveredElement && currentHoveredElement !== element) {
      currentHoveredElement.classList.remove('picker-hover');
    }

    currentHoveredElement = element;
    element.classList.add('picker-hover');

    clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      sendElementInfo(element);
    }, 50);
  }

  function sendElementInfo(element) {
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes =
      element.className && typeof element.className === 'string'
        ? `.${element.className.trim().replace(/\s+/g, '.')}`
        : '';
    const text = element.textContent ? element.textContent.trim().substring(0, 80) : '';
    const stepLabel = firstItemElement ? `${currentStep} (2/2)` : `${currentStep}`;

    safeSendMessage({
      action: 'pickerElementInfo',
      step: stepLabel,
      elementInfo: `<${tagName}${id}${classes}>`,
      elementText: text.length >= 80 ? text + '...' : text
    });
  }

  /**
   * Handle mouseout - remove highlight
   * @param {MouseEvent} event
   */
  function handleMouseOut(event) {
    if (!isPickerActive) return;

    const element = event.target;
    if (element && element.classList) {
      element.classList.remove('picker-hover');
    }
  }

  /**
   * Handle click - select element and generate selector
   * @param {MouseEvent} event
   */
  function handleClick(event) {
    if (!isPickerActive) return;

    event.preventDefault();
    event.stopPropagation();

    const element = event.target;
    if (!element || element === document.body || element === document.documentElement) {
      return;
    }

    if (currentHoveredElement) {
      currentHoveredElement.classList.remove('picker-hover');
    }
    if (selectedElement) {
      selectedElement.classList.remove('picker-selected');
    }

    selectedElement = element;
    currentHoveredElement = element;
    element.classList.add('picker-selected');
    sendElementInfo(element);

    showToast('已锁定，按 ↑↓ 调整，Enter 确认', 'info');
  }

  /**
   * Handle keyboard - Esc to cancel
   * @param {KeyboardEvent} event
   */
  function handleKeyDown(event) {
    if (!isPickerActive) return;

    if (event.key === 'Escape') {
      stopPicker();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (currentHoveredElement) {
        confirmSelection();
      } else {
        showToast('请先点击选择一个元素', 'warning');
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      navigateParent();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      navigateChild();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      navigatePrevSibling();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      navigateNextSibling();
    }
  }

  function navigateParent() {
    if (!currentHoveredElement) return;
    const parent = currentHoveredElement.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) return;

    currentHoveredElement.classList.remove('picker-hover');
    currentHoveredElement = parent;
    parent.classList.add('picker-hover');
    sendElementInfo(parent);
  }

  function navigateChild() {
    if (!currentHoveredElement) return;
    const child = currentHoveredElement.firstElementChild;
    if (!child) return;

    currentHoveredElement.classList.remove('picker-hover');
    currentHoveredElement = child;
    child.classList.add('picker-hover');
    sendElementInfo(child);
  }

  function navigatePrevSibling() {
    if (!currentHoveredElement) return;
    const prev = currentHoveredElement.previousElementSibling;
    if (!prev) return;

    currentHoveredElement.classList.remove('picker-hover');
    currentHoveredElement = prev;
    prev.classList.add('picker-hover');
    sendElementInfo(prev);
  }

  function navigateNextSibling() {
    if (!currentHoveredElement) return;
    const next = currentHoveredElement.nextElementSibling;
    if (!next) return;

    currentHoveredElement.classList.remove('picker-hover');
    currentHoveredElement = next;
    next.classList.add('picker-hover');
    sendElementInfo(next);
  }

  function collectPreviews(selector, maxCount, listItemSelector) {
    try {
      const mkItem = (el, listItem) => {
        const item = {
          text: el.textContent ? el.textContent.trim().replace(/\s+/g, ' ').substring(0, 150) : '',
          html: el.outerHTML
        };
        if (listItem && listItem !== el) {
          item.listHtml = listItem.outerHTML;
        }
        return item;
      };

      if (listItemSelector) {
        // Group elements by parent list item: [[item1_matches...], [item2_matches...], ...]
        const listItems = document.querySelectorAll(listItemSelector);
        const groups = [];
        for (const item of listItems) {
          const els = item.querySelectorAll(selector);
          groups.push(Array.from(els).map((el) => mkItem(el, item)));
        }
        return groups;
      }

      const elements = document.querySelectorAll(selector);
      const limit = maxCount || elements.length;
      const results = [];
      for (let i = 0; i < limit; i++) {
        results.push(mkItem(elements[i]));
      }
      return results;
    } catch (e) {
      return [];
    }
  }

  function normalizePreviewText(text) {
    return (text || '').trim().replace(/\s+/g, ' ');
  }

  function parseTextPreviewRule(rule) {
    const raw = (rule || '').trim();
    if (!raw || raw.includes('<js>')) return null;

    const match = raw.match(/^text\.([^@]+?)(?:@([^@\s]+))?$/);
    if (!match) return null;

    let text = normalizePreviewText(match[1]);
    const indexMatch = text.match(/^(.*)\.(-?\d+)$/);
    if (indexMatch && indexMatch[1].trim()) {
      text = indexMatch[1].trim();
    }
    if (!text) return null;

    return { text, attr: match[2] || '' };
  }

  function pickPreviewSourceElement(el, attr) {
    if (!attr) return el;

    if (attr === 'href') {
      return el.matches('a[href]') ? el : el.closest('a[href]') || el.querySelector('a[href]') || el;
    }

    try {
      if (el.hasAttribute(attr)) return el;
      return el.querySelector(`[${attr}]`) || el;
    } catch (e) {
      return el;
    }
  }

  function collectTextRulePreviews(rule) {
    const parsed = parseTextPreviewRule(rule);
    if (!parsed) return [];

    const elements = Array.from(document.querySelectorAll('body *')).filter(
      (el) => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)
    );

    const exactMatches = elements.filter((el) => normalizePreviewText(el.textContent) === parsed.text);
    const matches = exactMatches.length
      ? exactMatches
      : elements.filter((el) => normalizePreviewText(el.textContent).includes(parsed.text));

    const minimalMatches = matches.filter((el) => !matches.some((other) => other !== el && el.contains(other)));

    const seen = new Set();
    const results = [];
    minimalMatches.forEach((el) => {
      const sourceEl = pickPreviewSourceElement(el, parsed.attr);
      if (seen.has(sourceEl)) return;
      seen.add(sourceEl);
      results.push({ text: normalizePreviewText(sourceEl.textContent).substring(0, 150), html: sourceEl.outerHTML });
    });
    return results;
  }

  function confirmSelection() {
    if (!currentHoveredElement) return;

    const element = currentHoveredElement;

    /* Two-step list selection */
    if (isListField && !firstItemElement) {
      firstItemElement = element;
      element.classList.add('picker-first-item');
      showToast('已选择第1个，再选一个同列表元素', 'info');
      return;
    }

    if (isListField && firstItemElement) {
      if (element === firstItemElement) {
        showToast('请选择另一个不同的元素', 'warning');
        return;
      }

      const intersectionSelector = getIntersectionSelector(firstItemElement, element);

      if (!intersectionSelector) {
        showToast('两个元素无公共class，请重新选择列表容器', 'error');
        firstItemElement.classList.remove('picker-first-item');
        firstItemElement = null;
        return;
      }

      const matchCount = countSelectorMatches(intersectionSelector);
      if (matchCount === 0) {
        showToast('交集选择器无匹配，请重新选择', 'error');
        firstItemElement.classList.remove('picker-first-item');
        firstItemElement = null;
        return;
      }

      const previews = collectPreviews(intersectionSelector, matchCount);
      const tagName = firstItemElement.tagName.toLowerCase();

      safeSendMessage({
        action: 'selectorSelected',
        selector: intersectionSelector,
        step: currentStep,
        tagName,
        elementInfo: {
          id: firstItemElement.id || null,
          classes: firstItemElement.className ? firstItemElement.className.trim().split(/\s+/) : [],
          text: firstItemElement.textContent ? firstItemElement.textContent.trim().substring(0, 100) : ''
        },
        isIntersection: true,
        warning: '',
        previews
      });

      stopPicker();
      return;
    }

    /* Single element selection (non-list fields) */
    const warnings = [];

    // [DEBUG] Log element info for Edge debugging
    console.log('[Picker:DEBUG] confirmSelection — element:', {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      instanceofElement: element instanceof Element,
      instanceofHTMLElement: element instanceof HTMLElement,
      constructorName: element.constructor?.name
    });

    if (isInShadowDOM(element)) {
      warnings.push('Warning: Element is inside Shadow DOM - selector may not work');
    }

    if (isInIframe(element)) {
      warnings.push('Warning: Element is inside an iframe - cross-origin restrictions may apply');
    }

    // Find root for selector generation: use listItem as base if available
    let listItemRoot = null;
    if (listItemSelector) {
      try {
        const listItems = document.querySelectorAll(listItemSelector);
        for (const item of listItems) {
          if (item.contains(element)) {
            listItemRoot = item;
            break;
          }
        }
      } catch (e) {
        /* skip */
      }
    }

    const root = listItemRoot || rootElement || findSmartRoot(element);

    // [DEBUG] Log root info
    console.log('[Picker:DEBUG] confirmSelection — root:', {
      tagName: root?.tagName,
      id: root?.id,
      className: root?.className,
      isBody: root === document.body,
      isSameAsElement: root === element,
      listItemRoot: listItemRoot ? { tag: listItemRoot.tagName, class: listItemRoot.className } : null,
      rootElement: rootElement ? { tag: rootElement.tagName, class: rootElement.className } : null,
      smartRoot: findSmartRoot(element)
        ? { tag: findSmartRoot(element).tagName, class: findSmartRoot(element).className }
        : null
    });

    // When element IS the root (e.g., user clicked the list container itself),
    // getCssSelector returns empty because getTagPath(element, root) produces no path.
    // Fall back to using document.body as root so the selector is generated relative
    // to the full document instead.
    const effectiveRoot = root && root === element ? document.body : root;

    let selector;
    try {
      selector = getCssSelector(element, { root: effectiveRoot, preferReusable: true });
    } catch (e) {
      // [DEBUG] Log if getCssSelector throws
      console.error('[Picker:DEBUG] getCssSelector threw:', e.message, {
        elementTagName: element.tagName,
        elementInstanceOfElement: element instanceof Element
      });
      showToast('选择器生成失败: ' + e.message, 'error');
      return;
    }

    // [DEBUG] Log selector result
    console.log('[Picker:DEBUG] confirmSelection — selector result:', {
      selector,
      selectorTrimmed: selector?.trim(),
      isEmpty: !selector || selector.trim() === ''
    });

    if (!selector || selector.trim() === '') {
      showToast('请选择一个有效元素', 'error');
      return;
    }

    if (hasDynamicClass(selector)) {
      warnings.push('Warning: Selector uses auto-generated class - may be unstable');
    }

    const matchCount = countSelectorMatches(selector);
    if (matchCount === 0) {
      warnings.push('Warning: Selector returns 0 elements - may be invalid');
    }

    const contextCheck = checkElementContext(element);
    if (contextCheck.warning) {
      warnings.push(contextCheck.warning);
    }

    const previews = collectPreviews(selector, matchCount, listItemSelector);

    safeSendMessage({
      action: 'selectorSelected',
      selector,
      step: currentStep,
      tagName: element.tagName.toLowerCase(),
      listItemTagName: listItemRoot ? listItemRoot.tagName.toLowerCase() : null,
      elementInfo: {
        id: element.id || null,
        classes: element.className ? element.className.trim().split(/\s+/) : [],
        text: element.textContent ? element.textContent.trim().substring(0, 100) : ''
      },
      root: root !== document.body ? getCssSelector(root, { root: document.body }) : null,
      warning: warnings.join('; '),
      previews
    });

    stopPicker();
  }

  function handleBeforeUnload() {
    stopPicker();
  }

  /**
   * Start picker mode
   * @param {Object} data - Message data
   */
  function startPicker(data) {
    if (isPickerActive) return;
    isPickerActive = true;
    currentStep = data?.step || 'bookList';
    isListField = data?.isListField || false;
    listItemSelector = data?.itemSelector || '';
    firstItemElement = null;
    selectedElement = null;

    if (data?.rootSelector) {
      try {
        rootElement = document.querySelector(data.rootSelector);
      } catch (e) {
        rootElement = document.body;
      }
    }

    console.log('Picker started, step:', currentStep, 'isListField:', isListField, 'itemSelector:', listItemSelector);

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('beforeunload', handleBeforeUnload);

    injectPickerStyles();

    safeSendMessage({ action: 'pickerReady', step: currentStep });
  }

  /**
   * Stop picker mode
   */
  function stopPicker() {
    if (!isPickerActive) return;

    isPickerActive = false;

    // Remove event listeners
    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('mouseout', handleMouseOut, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('beforeunload', handleBeforeUnload);

    document.querySelectorAll('.picker-hover, .picker-selected, .picker-first-item').forEach((el) => {
      el.classList.remove('picker-hover', 'picker-selected', 'picker-first-item');
    });
    currentHoveredElement = null;
    selectedElement = null;
    firstItemElement = null;

    const container = document.getElementById('picker-toast-container');
    if (container) container.remove();

    safeSendMessage({ action: 'pickerStopped' });
  }

  /**
   * Inject picker styles into page
   */
  function injectPickerStyles() {
    if (document.getElementById('picker-styles')) return;

    const css = `
      .picker-hover { outline: 2px solid #4CAF50 !important; outline-offset: 2px !important; }
      .picker-selected { outline: 2px solid #2196F3 !important; outline-offset: 2px !important; }
      .picker-first-item { outline: 3px dashed #ff9800 !important; outline-offset: 3px !important; background: rgba(255,152,0,0.08) !important; }
      .picker-panel { position: fixed !important; top: 20px !important; right: 20px !important; z-index: 2147483647 !important; background: #fff !important; border: 1px solid #e0e0e0 !important; border-radius: 8px !important; font-family: -apple-system, BlinkMacSystemFont, sans-serif !important; font-size: 14px !important; color: #333 !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; min-width: 200px !important; cursor: move !important; }
      .picker-panel-content { padding: 12px 16px !important; }
      .picker-panel-header { display: flex !important; align-items: center !important; justify-content: space-between !important; margin-bottom: 8px !important; }
      .picker-panel-title { font-weight: 600 !important; color: #222 !important; }
      .picker-panel-info { color: #666 !important; font-size: 13px !important; line-height: 1.5 !important; }
      .picker-panel-shortcut { margin-top: 8px !important; padding-top: 8px !important; border-top: 1px solid #eee !important; font-size: 12px !important; color: #888 !important; }
      .picker-panel-shortcut kbd { background: #f5f5f5 !important; border: 1px solid #ddd !important; border-radius: 4px !important; padding: 2px 6px !important; font-family: monospace !important; font-size: 11px !important; }
      @media (prefers-color-scheme: dark) {
        .picker-panel { background: #2d2d2d !important; border-color: #444 !important; color: #e0e0e0 !important; }
        .picker-panel-title { color: #fff !important; }
        .picker-panel-info { color: #aaa !important; }
        .picker-panel-shortcut { border-top-color: #444 !important; color: #888 !important; }
        .picker-panel-shortcut kbd { background: #3d3d3d !important; border-color: #555 !important; color: #ccc !important; }
      }
      @keyframes toast-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes toast-out { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(20px); } }
    `;
    const style = document.createElement('style');
    style.id = 'picker-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function startExploreCollector() {
    if (isExploreCollectorActive) return;
    isExploreCollectorActive = true;
    exploreCollectedItems = [];

    injectPickerStyles();

    document.addEventListener('mouseover', onExploreMouseOver, true);
    document.addEventListener('mouseout', onExploreMouseOut, true);
    document.addEventListener('click', onExploreClick, true);
    document.addEventListener('keydown', onExploreKeydown, true);

    safeSendMessage({ action: 'exploreCollectionStarted' });
  }

  let exploreHoveredEl = null;
  function onExploreMouseOver(e) {
    if (!isExploreCollectorActive) return;
    const el = e.target.closest('a');
    if (!el) return;
    if (exploreHoveredEl && exploreHoveredEl !== el) exploreHoveredEl.classList.remove('picker-hover');
    exploreHoveredEl = el;
    el.classList.add('picker-hover');
    safeSendMessage({
      action: 'exploreElementHover',
      elementInfo: `<a.${el.className ? el.className.trim().split(/\s+/)[0] : ''}>`,
      elementText: el.textContent.trim().substring(0, 80)
    });
  }

  function onExploreMouseOut(e) {
    if (!isExploreCollectorActive) return;
    const el = e.target.closest('a');
    if (el) el.classList.remove('picker-hover');
  }

  function onExploreClick(e) {
    if (!isExploreCollectorActive) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.target.closest('a');
    if (!el) {
      showToast('请点击一个链接元素', 'warning');
      return;
    }

    const title = el.textContent.trim().substring(0, 50);
    const url = el.href || '';

    if (!title) {
      showToast('该元素没有文本内容', 'warning');
      return;
    }

    exploreCollectedItems.push({ title, url });
    showToast(`已添加: ${title}`, 'info');

    safeSendMessage({ action: 'exploreItemCollected', item: { title, url }, total: exploreCollectedItems.length });

    el.classList.add('picker-selected');
    setTimeout(() => el.classList.remove('picker-selected'), 500);
  }

  function onExploreKeydown(e) {
    if (e.key === 'Enter' && isExploreCollectorActive) {
      e.preventDefault();
      e.stopPropagation();
      finishExploreCollection();
    }
  }

  function finishExploreCollection() {
    isExploreCollectorActive = false;
    document.removeEventListener('mouseover', onExploreMouseOver, true);
    document.removeEventListener('mouseout', onExploreMouseOut, true);
    document.removeEventListener('click', onExploreClick, true);
    document.removeEventListener('keydown', onExploreKeydown, true);
    if (exploreHoveredEl) {
      exploreHoveredEl.classList.remove('picker-hover');
      exploreHoveredEl = null;
    }

    safeSendMessage({ action: 'exploreCollected', items: exploreCollectedItems });

    showToast(`已发送 ${exploreCollectedItems.length} 项`, 'info');
    exploreCollectedItems = [];
  }

  /**
   * Handle incoming messages from popup
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Picker received message:', message);

    switch (message.action) {
      case 'startPicker':
        startPicker(message);
        sendResponse({ success: true });
        break;

      case 'startExploreCollector':
        startExploreCollector();
        sendResponse({ success: true });
        break;

      case 'stopExploreCollector':
        finishExploreCollection();
        sendResponse({ success: true });
        break;

      case 'stopPicker':
        stopPicker();
        sendResponse({ success: true });
        break;

      case 'previewSelector':
        try {
          const previewSelector = message.selector;
          const previewElements = document.querySelectorAll(previewSelector);
          const previewCount = previewElements.length;
          const previewLimit = previewCount;
          const previewResults = [];
          for (let i = 0; i < previewLimit; i++) {
            const el = previewElements[i];
            previewResults.push({
              text: el.textContent ? el.textContent.trim().replace(/\s+/g, ' ').substring(0, 150) : '',
              html: el.outerHTML
            });
          }
          sendResponse({ previews: previewResults, count: previewCount });
        } catch (e) {
          sendResponse({ previews: [], count: 0 });
        }
        break;

      case 'previewRule':
        try {
          const previewResults = collectTextRulePreviews(message.rule);
          sendResponse({ previews: previewResults, count: previewResults.length });
        } catch (e) {
          sendResponse({ previews: [], count: 0 });
        }
        break;

      case 'getCurrentStep':
        sendResponse({ step: currentStep });
        break;

      case 'startSearchCapture':
      case 'stopSearchCapture':
      case 'getSearchForms':
        sendResponse({ success: false, ignored: true });
        break;

      default:
        // Unknown message
        console.warn('Unknown message action:', message.action);
    }

    return true; // Keep message channel open for async response
  });

  console.log('Picker content script initialized');
})();
