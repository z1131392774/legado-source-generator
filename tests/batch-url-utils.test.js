const assert = require('node:assert/strict');
const {
  buildBatchReplaceRegex,
  replaceUrlByRegex,
  applyBatchUrlReplace,
  applyCategoryPagingByTemplate
} = require('../src/popup/batch-url-utils.js');

(function testBuildRegexFlags() {
  const regex = buildBatchReplaceRegex('abc', { global: true, ignoreCase: true });
  assert.equal(regex.flags.includes('g'), true);
  assert.equal(regex.flags.includes('i'), true);
})();

(function testReplaceUrlByRegex() {
  const out = replaceUrlByRegex('/sort/xuanhuan/2.html', 'xuanhuan', '玄幻', { global: false, ignoreCase: false });
  assert.equal(out, '/sort/玄幻/2.html');
})();

(function testApplyBatchUrlReplaceSkipsSeparatorAndCountsUpdated() {
  const items = [
    { title: 'A', url: '/sort/xuanhuan/2.html' },
    { title: '分隔', url: '', isSeparator: true },
    { title: 'B', url: '/sort/xuanhuan/3.html' }
  ];
  const result = applyBatchUrlReplace(items, [0, 1, 2], {
    pattern: 'xuanhuan',
    replacement: '分类',
    global: true,
    ignoreCase: false
  });

  assert.equal(result.updatedCount, 2);
  assert.equal(items[0].url, '/sort/分类/2.html');
  assert.equal(items[1].url, '');
  assert.equal(items[2].url, '/sort/分类/3.html');
})();

(function testApplyCategoryPagingByTemplate() {
  const output = applyCategoryPagingByTemplate('/sort/xuanhuan/', {
    categoryPattern: '/sort/分类/',
    pagedUrlTemplate: '/sort/分类/index_页码.html',
    firstPageDiff: 'index_页码.html'
  });
  assert.equal(output, '/sort/xuanhuan/<,index_{{page}}.html>');
})();

(function testApplyCategoryPagingByTemplateKeepsExistingPageMarker() {
  const output = applyCategoryPagingByTemplate('/sort/xuanhuan/{{page}}.html', {
    categoryPattern: '/sort/分类/',
    pagedUrlTemplate: '/sort/分类/页码.html',
    firstPageDiff: 'index_页码.html'
  });
  assert.equal(output, '/sort/xuanhuan/{{page}}.html');
})();

console.log('batch-url-utils tests passed');
