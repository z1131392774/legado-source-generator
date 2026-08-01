/**
 * Content Script - Search URL Capture
 *
 * Strategy: User types "我的" into the search box → clicks the site's search button →
 * we intercept the outgoing request and replace "我的" with {{key}}.
 */

(function () {
  'use strict';

  let captureActive = false;
  let urlPollInterval = null;
  let originalFetch = window.fetch;
  let originalXHROpen = XMLHttpRequest.prototype.open;
  let originalXHRSend = XMLHttpRequest.prototype.send;

  // Preset keyword to fill into the search input
  const PRESET_KEYWORD = '我的';

  // SessionStorage key for pending capture across page navigations
  const PENDING_CAPTURE_KEY = 'legado_pending_search_capture';

  function savePendingCapture(data) {
    try {
      sessionStorage.setItem(PENDING_CAPTURE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
    } catch (e) {}
  }

  function clearPendingCapture() {
    try {
      sessionStorage.removeItem(PENDING_CAPTURE_KEY);
    } catch (e) {}
  }

  /**
   * Detect charset from page <meta> tags
   */
  function detectPageCharset() {
    const meta = document.querySelector('meta[charset]');
    if (meta) return normalizeCharset(meta.getAttribute('charset'));
    const httpEquiv = document.querySelector('meta[http-equiv="Content-Type"]');
    if (httpEquiv) {
      const content = httpEquiv.getAttribute('content') || '';
      const match = content.match(/charset\s*=\s*([^\s;]+)/i);
      if (match) return normalizeCharset(match[1]);
    }
    return 'utf-8';
  }

  function normalizeCharset(charset) {
    const raw = (charset || '').trim().toLowerCase();
    if (!raw) return 'utf-8';
    const first = raw.split(',')[0].trim();
    if (first === 'gb2312' || first === 'x-gbk') return 'gbk';
    return first;
  }

  function resolveFormCharset(form) {
    const acceptCharset = form?.getAttribute('accept-charset') || '';
    if (!acceptCharset) return detectPageCharset();
    return normalizeCharset(acceptCharset);
  }

  /**
   * Find the form associated with a button/link.
   * Returns: { form, inputsToFill, isLink, linkUrl }
   */
  function findSearchForm(clickedElement) {
    // Check if it's a link
    const link = clickedElement.closest('a[href]');
    if (link) {
      return { form: null, inputsToFill: [], isLink: true, linkUrl: new URL(link.href, window.location.href).href };
    }

    // Find the form: button.form or closest parent form
    const form = clickedElement.form || clickedElement.closest('form');
    if (!form) return null;

    // Collect ALL text inputs in the form — no selection needed
    const inputs = [];
    form.querySelectorAll('input').forEach((inp) => {
      const type = inp.type || 'text';
      if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset') return;
      const rect = inp.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        inputs.push(inp);
      }
    });

    return { form, inputsToFill: inputs, isLink: false, linkUrl: null };
  }

  /**
   * 仅用于规则模板拼接，真实请求编码交给浏览器原生表单提交。
   */
  function encodeTemplateValue(str) {
    return encodeURIComponent(str);
  }

  /**
   * Replace the encoded keyword with {{key}} in URL
   */
  function replaceKeywordInUrl(url, encodedKeyword) {
    return url.replace(encodedKeyword, '{{key}}');
  }

  /**
   * Replace the encoded keyword with {{key}} in body
   */
  function replaceKeywordInBody(body, encodedKeyword) {
    if (!body || !encodedKeyword) return body;
    return body.replace(encodedKeyword, '{{key}}');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function replaceKeywordInLinkUrl(linkUrl) {
    try {
      const parsed = new URL(linkUrl, window.location.href);
      const keys = Array.from(parsed.searchParams.keys());
      const preferred = ['q', 'query', 'wd', 'word', 'key', 'kw', 'keyword', 'search', 'searchkey'];
      let targetKey = keys.find((k) => preferred.includes(k.toLowerCase()));
      if (!targetKey && keys.length === 1) targetKey = keys[0];
      if (targetKey) {
        parsed.searchParams.set(targetKey, '{{key}}');
        return parsed.toString();
      }
    } catch (e) {}

    return linkUrl.replace(new RegExp(escapeRegex(PRESET_KEYWORD), 'g'), '{{key}}');
  }

  function replaceKnownKeywordTokens(input) {
    if (!input) return input;
    const utf8Encoded = encodeURIComponent(PRESET_KEYWORD);
    return input
      .replace(new RegExp(escapeRegex(PRESET_KEYWORD), 'g'), '{{key}}')
      .replace(new RegExp(escapeRegex(utf8Encoded), 'g'), '{{key}}');
  }

  function decodePercentBytes(segment, charset) {
    try {
      const bytes = [];
      const byteMatches = segment.match(/%([0-9A-Fa-f]{2})/g) || [];
      for (const token of byteMatches) {
        bytes.push(parseInt(token.slice(1), 16));
      }
      if (!bytes.length) return '';
      return new TextDecoder(normalizeCharset(charset || 'utf-8')).decode(new Uint8Array(bytes));
    } catch (e) {
      return '';
    }
  }

  function containsKeywordInPercentEncoded(input, charset) {
    if (!input) return false;
    const matches = input.match(/(?:%[0-9A-Fa-f]{2})+/g);
    if (!matches) return false;
    return matches.some((seg) => decodePercentBytes(seg, charset).includes(PRESET_KEYWORD));
  }

  function replaceKeywordInFormEncodedString(text, charset) {
    if (!text) return text;
    const parts = text.split('&');
    let replaced = false;
    const mapped = parts.map((part) => {
      const eq = part.indexOf('=');
      if (eq < 0) return part;
      const key = part.slice(0, eq);
      const value = part.slice(eq + 1);
      if (containsKnownKeywordToken(value, charset)) {
        replaced = true;
        return key + '={{key}}';
      }
      return part;
    });
    return replaced ? mapped.join('&') : text;
  }

  function replaceKeywordInCapturedUrl(rawUrl, charset) {
    try {
      const parsed = new URL(rawUrl, window.location.href);
      if (parsed.search) {
        const query = parsed.search.slice(1);
        const replacedQuery = replaceKeywordInFormEncodedString(query, charset);
        if (replacedQuery !== query) {
          parsed.search = replacedQuery ? '?' + replacedQuery : '';
          return parsed.toString();
        }
      }
    } catch (e) {}
    return replaceKnownKeywordTokens(rawUrl);
  }

  function replaceKeywordInCapturedBody(rawBody, charset) {
    if (!rawBody) return rawBody;
    return replaceKeywordInFormEncodedString(rawBody, charset);
  }

  function containsKnownKeywordToken(input, charset) {
    if (!input) return false;
    const utf8Encoded = encodeURIComponent(PRESET_KEYWORD);
    return (
      input.includes('{{key}}') ||
      input.includes(PRESET_KEYWORD) ||
      input.includes(utf8Encoded) ||
      containsKeywordInPercentEncoded(input, charset)
    );
  }

  /**
   * Parse form elements on the page
   */
  function detectSearchForms() {
    const forms = document.querySelectorAll('form');
    const results = [];
    forms.forEach((form) => {
      const action = form.getAttribute('action') || form.action || '';
      const method = (form.getAttribute('method') || 'GET').toUpperCase();
      const acceptCharset = form.getAttribute('accept-charset') || '';
      const inputs = form.querySelectorAll('input[type="text"], input[type="search"]');
      const selects = form.querySelectorAll('select[name]');
      if (!inputs.length && !selects.length && !action) return;
      results.push({
        action,
        method,
        charset: acceptCharset || detectPageCharset(),
        hasSearchInput: inputs.length > 0,
        hasSelect: selects.length > 0
      });
    });
    return results;
  }

  /**
   * Build search template from form data.
   * 实际请求编码由浏览器原生提交处理。
   */
  function buildSearchUrl(form, method, actionUrl, charset) {
    const formData = new FormData(form);
    const params = [];
    let encodedKeyword = '{{key}}';
    let body = '';

    formData.forEach((value, key) => {
      const encodedKey = encodeURIComponent(key); // keys are always UTF-8 safe
      const encodedValue = value === PRESET_KEYWORD ? '{{key}}' : encodeTemplateValue(value);
      params.push(encodedKey + '=' + encodedValue);
    });

    // Defensive: also explicitly collect <select> and <input type="hidden">
    // inside the form. Some sites may have fields that FormData misses.
    form.querySelectorAll('select[name], input[type="hidden"][name]').forEach((el) => {
      const key = el.name;
      const value = el.value;
      if (value === undefined || value === null) return;
      const encodedKey = encodeURIComponent(key);
      const encodedValue = value === PRESET_KEYWORD ? '{{key}}' : encodeTemplateValue(value);
      const param = encodedKey + '=' + encodedValue;
      if (!params.some((p) => p.startsWith(encodedKey + '='))) {
        params.push(param);
      }
    });

    // Also collect <select> elements outside the form but on the page.
    // Some sites place selects outside the form and read them via JS.
    document.querySelectorAll('select[name]').forEach((select) => {
      if (form.contains(select)) return;
      const key = select.name;
      const value = select.value;
      if (!value) return;
      const encodedKey = encodeURIComponent(key);
      const encodedValue = value === PRESET_KEYWORD ? '{{key}}' : encodeTemplateValue(value);
      const param = encodedKey + '=' + encodedValue;
      if (!params.some((p) => p.startsWith(encodedKey + '='))) {
        params.push(param);
      }
    });

    const queryString = params.join('&');
    if (method === 'GET') {
      return { url: actionUrl + (actionUrl.includes('?') ? '&' : '?') + queryString, encodedKeyword };
    } else {
      body = queryString;
      return { url: actionUrl, body, encodedKeyword };
    }
  }

  /**
   * Send captured data to the popup
   */
  function sendCapturedData(method, urlWithPlaceholder, body, charset, forms) {
    captureActive = false;
    restoreOriginals();
    stopUrlPolling();
    clearPendingCapture();

    chrome.runtime.sendMessage({ action: 'searchCaptured', method, url: urlWithPlaceholder, charset, body, forms });
  }

  function submitFormAsGetInNewTab(form) {
    const originalTarget = form.getAttribute('target');
    form.setAttribute('target', '_blank');
    try {
      // 使用 HTMLFormElement.prototype.submit 避免 name="submit" 的元素遮蔽
      HTMLFormElement.prototype.submit.call(form);
    } finally {
      if (originalTarget === null) {
        form.removeAttribute('target');
      } else {
        form.setAttribute('target', originalTarget);
      }
    }
  }

  /* ═══════════════════════════════════
     Strategy 1: Intercept click on search button
     ═══════════════════════════════════ */

  function interceptSearchButtonClick() {
    const handler = function (e) {
      if (!captureActive) return;

      // Find the clicked search button:
      // - <button type="submit">, <input type="submit">, <input type="button">
      // - <a> links that might trigger search
      const target = e.target;
      const searchButton = target.closest(
        'button, input[type="submit"], input[type="button"], a[href], [role="button"]'
      );
      if (!searchButton) return;

      if (!lockedSearchButton) {
        lockedSearchButton = searchButton;
      }
      if (searchButton !== lockedSearchButton) return;

      const searchInfo = findSearchForm(searchButton);
      if (!searchInfo) {
        savePendingCapture({
          mode: 'await-navigation',
          method: 'GET',
          body: '',
          charset: detectPageCharset(),
          forms: detectSearchForms(),
          originalUrl: window.location.href
        });

        console.log('[search-capture] Armed pending capture for non-form search button');
        return;
      }

      // For links, prevent default. For forms, let them submit naturally.
      if (searchInfo.isLink) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }

      console.log('[search-capture] Search button clicked:', {
        tag: searchButton.tagName,
        type: searchButton.type,
        text: searchButton.textContent?.trim(),
        value: searchButton.value,
        isLink: searchInfo.isLink
      });

      if (searchInfo.isLink) {
        // It's a link — capture and open in new tab directly
        e.preventDefault();
        e.stopImmediatePropagation();

        const linkUrl = searchInfo.linkUrl;
        const charset = detectPageCharset();
        const forms = detectSearchForms();

        const urlWithPlaceholder = replaceKeywordInLinkUrl(linkUrl);
        sendCapturedData('GET', urlWithPlaceholder, '', charset, forms);
        try {
          window.open(linkUrl, '_blank');
        } catch (err) {
          window.location.href = linkUrl;
        }

        return;
      }

      // It's a form
      clickHandlerProcessedForm = true;

      // Schedule a microtask to detect JS-driven URL changes after onclick/onsubmit
      // handlers run. This captures the real URL for sites that use window.location.href
      // instead of native form submission (e.g. cuoceng.com's handleSearch).
      const urlBefore = window.location.href;
      const captureCharset = detectPageCharset();
      const captureForms = detectSearchForms();
      Promise.resolve().then(() => {
        if (!captureActive || !clickHandlerProcessedForm) return;
        if (window.location.href !== urlBefore) {
          clickHandlerProcessedForm = false;
          const urlWithPlaceholder = replaceKeywordInCapturedUrl(window.location.href, captureCharset);
          console.log('[search-capture] Captured JS-driven navigation:', urlWithPlaceholder);
          sendCapturedData('GET', urlWithPlaceholder, '', captureCharset, captureForms);
        }
      });

      console.log('[search-capture] Form click captured, letting natural submission proceed');
    };

    document.addEventListener('click', handler, true);
    return handler;
  }

  /* ═══════════════════════════════════
     Strategy 2: Hijack fetch()
     ═══════════════════════════════════ */

  function hijackFetch() {
    window.fetch = function () {
      const input = arguments[0];
      const init = arguments[1] || {};
      let method = (init.method || 'GET').toUpperCase();
      let url = '';
      let body = '';

      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof Request) {
        url = input.url;
        method = input.method.toUpperCase();
      }
      if (init.body) {
        body = typeof init.body === 'string' ? init.body : JSON.stringify(init.body);
      }

      const originalCall = originalFetch.apply(this, arguments);
      captureRequest(method, url, body);
      return originalCall;
    };
  }

  /* ═══════════════════════════════════
     Strategy 3: Hijack XMLHttpRequest
     ═══════════════════════════════════ */

  function hijackXHR() {
    const xhrPrototype = XMLHttpRequest.prototype;
    let currentMethod = '';
    let currentUrl = '';
    let currentBody = '';

    xhrPrototype.open = function (method, url) {
      currentMethod = method.toUpperCase();
      try {
        currentUrl = new URL(url, window.location.href).href;
      } catch (e) {
        currentUrl = url;
      }
      currentBody = '';
      return originalXHROpen.apply(this, arguments);
    };

    xhrPrototype.send = function (body) {
      if (body && typeof body === 'string') {
        currentBody = body;
      }
      captureRequest(currentMethod, currentUrl, currentBody);
      return originalXHRSend.apply(this, arguments);
    };
  }

  /* ═══════════════════════════════════
     Strategy 4: Intercept form submit (fallback)
     Only for non-click form submissions (e.g., Enter key in input)
     ═══════════════════════════════════ */

  let clickHandlerProcessedForm = false;
  let lockedSearchButton = null;

  function interceptFormSubmits() {
    const handler = function (e) {
      if (!captureActive) return;
      const form = e.target;
      if (!form || form.tagName !== 'FORM') return;

      if (!clickHandlerProcessedForm) return;

      const action = form.getAttribute('action') || form.action || window.location.href;
      const method = (form.getAttribute('method') || 'GET').toUpperCase();
      const actionUrl = new URL(action, window.location.href).href;
      const charset = resolveFormCharset(form);

      const urlResult = buildSearchUrl(form, method, actionUrl, charset);
      const fullUrl = urlResult.url;
      const body = urlResult.body || '';
      const encodedKeyword = urlResult.encodedKeyword;

      const urlWithPlaceholder = replaceKeywordInUrl(fullUrl, encodedKeyword);
      const bodyWithPlaceholder = body ? replaceKeywordInBody(body, encodedKeyword) : '';
      const forms = detectSearchForms();

      if (method === 'POST') {
        clickHandlerProcessedForm = false;

        // POST: capture data and let the form submit naturally.
        captureActive = false;
        restoreOriginals();
        stopUrlPolling();

        chrome.runtime.sendMessage({
          action: 'searchCaptured',
          method: method,
          url: urlWithPlaceholder,
          charset: charset,
          body: bodyWithPlaceholder,
          forms: forms
        });
        // Don't prevent default — form submits with filled value.
      } else {
        // GET
        const hasOnsubmit = form.hasAttribute('onsubmit') || typeof form.onsubmit === 'function';

        if (hasOnsubmit) {
          // Form has JS onsubmit that may override the URL (e.g. cuoceng.com handleSearch).
          // Let the onsubmit run — the microtask in interceptSearchButtonClick will capture
          // the actual URL from window.location.href.
          // Don't reset clickHandlerProcessedForm or call preventDefault.
        } else {
          clickHandlerProcessedForm = false;

          // Standard GET form: prevent default, submit to new tab instead.
          e.preventDefault();
          e.stopImmediatePropagation();
          submitFormAsGetInNewTab(form);

          captureActive = false;
          restoreOriginals();
          stopUrlPolling();

          chrome.runtime.sendMessage({
            action: 'searchCaptured',
            method,
            url: urlWithPlaceholder,
            charset,
            body: bodyWithPlaceholder,
            forms
          });
        }
      }
    };

    document.addEventListener('submit', handler, true);
    return handler;
  }

  /* ═══════════════════════════════════
     Helper functions
     ═══════════════════════════════════ */

  function captureRequest(method, url, body) {
    if (!captureActive) return;

    const urlLower = url.toLowerCase();
    const skipExtensions = [
      '.js',
      '.css',
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.svg',
      '.ico',
      '.woff',
      '.woff2',
      '.ttf',
      '.map'
    ];
    if (skipExtensions.some((ext) => urlLower.includes(ext))) return;
    if (urlLower.startsWith('/static/') || urlLower.includes('/assets/')) return;

    const charset = detectPageCharset();
    const hasKeyword = containsKnownKeywordToken(url, charset) || containsKnownKeywordToken(body || '', charset);
    if (!hasKeyword) return;

    const urlWithPlaceholder = replaceKeywordInCapturedUrl(url, charset);
    const bodyWithPlaceholder = body ? replaceKeywordInCapturedBody(body, charset) : '';
    const forms = detectSearchForms();

    sendCapturedData(method.toUpperCase(), urlWithPlaceholder, bodyWithPlaceholder, charset, forms);
  }

  function restoreOriginals() {
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXHROpen;
    XMLHttpRequest.prototype.send = originalXHRSend;
  }

  let urlPollBeforeUnloadHandler = null;

  function startUrlPolling() {
    const originalUrl = window.location.href;
    const charset = detectPageCharset();
    urlPollInterval = setInterval(() => {
      if (!captureActive) return;
      const currentUrl = window.location.href;
      if (currentUrl !== originalUrl) {
        const urlWithPlaceholder = replaceKeywordInCapturedUrl(currentUrl, charset);
        const forms = detectSearchForms();
        const formInfo = forms.find((f) => f.hasSearchInput) || forms[0];
        const method = formInfo ? formInfo.method : 'GET';
        sendCapturedData(method, urlWithPlaceholder, '', charset, forms);
      }
    }, 50);

    // Fallback for very fast JS-driven navigations (e.g. window.location.href)
    // where setInterval may not fire before the page unloads.
    urlPollBeforeUnloadHandler = function () {
      if (!captureActive) return;
      const currentUrl = window.location.href;
      const forms = detectSearchForms();
      const formInfo = forms.find((f) => f.hasSearchInput) || forms[0];
      const method = formInfo ? formInfo.method : 'GET';
      savePendingCapture({
        mode: 'await-navigation',
        method,
        body: '',
        charset,
        forms,
        originalUrl,
        url: currentUrl !== originalUrl ? replaceKeywordInCapturedUrl(currentUrl, charset) : ''
      });
    };
    window.addEventListener('beforeunload', urlPollBeforeUnloadHandler);
  }

  function stopUrlPolling() {
    if (urlPollInterval) {
      clearInterval(urlPollInterval);
      urlPollInterval = null;
    }
    if (urlPollBeforeUnloadHandler) {
      window.removeEventListener('beforeunload', urlPollBeforeUnloadHandler);
      urlPollBeforeUnloadHandler = null;
    }
  }

  /* ═══════════════════════════════════
     Public API
     ═══════════════════════════════════ */

  let searchClickHandler = null;
  let formSubmitHandler = null;

  function startCapture() {
    captureActive = true;
    clickHandlerProcessedForm = false;
    lockedSearchButton = null;
    clearPendingCapture();

    // Listen for user clicking the site's search button
    searchClickHandler = interceptSearchButtonClick();
    formSubmitHandler = interceptFormSubmits();

    hijackFetch();
    hijackXHR();
    startUrlPolling();
  }

  function stopCapture() {
    captureActive = false;
    restoreOriginals();
    stopUrlPolling();
    lockedSearchButton = null;
    clearPendingCapture();
    if (searchClickHandler) {
      document.removeEventListener('click', searchClickHandler, true);
      searchClickHandler = null;
    }
    if (formSubmitHandler) {
      document.removeEventListener('submit', formSubmitHandler, true);
      formSubmitHandler = null;
    }
    // Don't send searchCaptureForms here - cancellation means user doesn't want any data
  }

  /* ═══════════════════════════════════
     Message handler
     ═══════════════════════════════════ */

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'startSearchCapture':
        startCapture();
        sendResponse({ success: true });
        break;
      case 'stopSearchCapture':
        stopCapture();
        sendResponse({ success: true });
        break;
      case 'getSearchForms':
        sendResponse({ forms: detectSearchForms(), charset: detectPageCharset() });
        break;
      default:
        sendResponse({ success: false });
    }
    return true;
  });

  /* ═══════════════════════════════════
     Recover pending capture from sessionStorage
     (for JS-driven navigations like window.location.href)
     ═══════════════════════════════════ */

  try {
    const pending = sessionStorage.getItem(PENDING_CAPTURE_KEY);
    if (pending) {
      const data = JSON.parse(pending);
      // Only recover if captured within the last 10 seconds
      if (data.timestamp && Date.now() - data.timestamp < 10000) {
        let recoveredUrl = data.url || '';
        if (
          !recoveredUrl &&
          data.mode === 'await-navigation' &&
          data.originalUrl &&
          window.location.href !== data.originalUrl
        ) {
          recoveredUrl = replaceKeywordInCapturedUrl(window.location.href, data.charset || detectPageCharset());
        }
        if (recoveredUrl) {
          chrome.runtime.sendMessage({
            action: 'searchCaptured',
            method: data.method || 'GET',
            url: recoveredUrl,
            charset: data.charset || detectPageCharset(),
            body: data.body || '',
            forms: data.forms || []
          });
        }
      }
      sessionStorage.removeItem(PENDING_CAPTURE_KEY);
    }
  } catch (e) {}
})();
