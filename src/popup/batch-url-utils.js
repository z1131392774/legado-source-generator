(function (globalScope) {
  function buildBatchReplaceRegex(pattern, options = {}) {
    const source = String(pattern || '');
    if (!source) {
      throw new Error('正则表达式不能为空');
    }
    let flags = '';
    if (options.global !== false) flags += 'g';
    if (options.ignoreCase) flags += 'i';
    return new RegExp(source, flags);
  }

  function replaceUrlByRegex(url, pattern, replacement, options = {}) {
    const regex = buildBatchReplaceRegex(pattern, options);
    const source = String(url || '');
    return source.replace(regex, String(replacement || ''));
  }

  function applyBatchUrlReplace(items, indexes, config = {}) {
    const result = { updatedCount: 0, totalCount: 0 };
    if (!Array.isArray(items)) return result;
    const targetIndexes = Array.isArray(indexes) ? indexes : [];
    result.totalCount = targetIndexes.length;

    targetIndexes.forEach((i) => {
      const item = items[i];
      if (!item || item.isSeparator) return;
      const prevUrl = String(item.url || '');
      const nextUrl = replaceUrlByRegex(prevUrl, config.pattern, config.replacement, {
        global: config.global !== false,
        ignoreCase: !!config.ignoreCase
      });
      item.url = nextUrl;
      if (nextUrl !== prevUrl) result.updatedCount += 1;
    });
    return result;
  }

  function applyCategoryPagingByTemplate(url, config = {}) {
    let nextUrl = String(url || '');
    const categoryPattern = String(config.categoryPattern || '');
    const pagedUrlTemplate = String(config.pagedUrlTemplate || '');
    const firstPageDiffRaw = String(config.firstPageDiff || '');

    if (categoryPattern && pagedUrlTemplate && !/\{\{page}}/.test(nextUrl)) {
      let categoryRule = categoryPattern.replace(/(\+|\?)/g, '\\$1');
      categoryRule = categoryRule.replace(/分类$/g, '(.*)').replace(/分类(?!$)/g, '(.*?)');
      const categoryRegex = new RegExp(categoryRule);
      const match = nextUrl.match(categoryRegex);
      if (match) {
        const category = match[1] || '';
        nextUrl = pagedUrlTemplate.replace(/页码/g, '{{page}}').replace(/分类/g, category);
      }
    }

    if (firstPageDiffRaw && !/<,.*?>/.test(nextUrl)) {
      const firstPageDiff = firstPageDiffRaw.replace(/(\+|\?)/g, '\\$1').replace(/页码/g, '{{page}}');
      const firstPageRegex = new RegExp(`(${firstPageDiff})`, 'g');
      nextUrl = nextUrl.replace(firstPageRegex, '<,$1>');
    }

    return nextUrl;
  }

  const exportsObj = { buildBatchReplaceRegex, replaceUrlByRegex, applyBatchUrlReplace, applyCategoryPagingByTemplate };

  globalScope.BatchUrlUtils = exportsObj;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
