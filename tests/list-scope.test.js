/**
 * Unit tests for field-level list scoping.
 * Run: node tests/list-scope.test.js
 */

const assert = require('node:assert/strict');

const LIST_FIELD_KEYS = ['bookList', 'chapterList'];
const LIST_SCOPED_FIELDS = {
  explore: ['name', 'author', 'kind', 'wordCount', 'lastChapter', 'intro', 'coverUrl', 'bookUrl'],
  search: ['name', 'author', 'kind', 'wordCount', 'lastChapter', 'intro', 'coverUrl', 'bookUrl', 'checkKeyWord'],
  toc: ['chapterName', 'chapterUrl', 'isVolume', 'updateTime', 'isVip', 'isPay']
};

function isListFieldKey(fieldKey) {
  return LIST_FIELD_KEYS.includes(fieldKey);
}

function isListScopedField(ruleType, fieldKey) {
  return (LIST_SCOPED_FIELDS[ruleType] || []).includes(fieldKey);
}

function buildPickerScope(ruleType, fieldKey, listSelector) {
  const isListField = isListFieldKey(fieldKey);
  const useListScope = isListScopedField(ruleType, fieldKey);

  if (useListScope && !listSelector) {
    return null;
  }

  let itemSelector = '';
  let rootSelector = '';
  if (listSelector && useListScope) {
    itemSelector = listSelector;
    rootSelector = listSelector;
  }

  return { isListField, rootSelector, itemSelector };
}

function shouldApplyListRange(ruleType, fieldKey) {
  return !isListFieldKey(fieldKey) && isListScopedField(ruleType, fieldKey);
}

assert.equal(isListScopedField('toc', 'chapterUrl'), true, 'chapterUrl is scoped to chapterList items');
assert.equal(isListScopedField('toc', 'nextTocUrl'), false, 'nextTocUrl is page-scoped');
assert.equal(isListScopedField('content', 'nextContentUrl'), false, 'nextContentUrl is page-scoped');
assert.equal(isListScopedField('search', 'bookUrl'), true, 'search bookUrl is scoped to bookList items');

assert.deepEqual(
  buildPickerScope('toc', 'nextTocUrl', '.section-list li'),
  { isListField: false, rootSelector: '', itemSelector: '' },
  'nextTocUrl picker does not inherit chapterList root/item scope'
);

assert.deepEqual(
  buildPickerScope('toc', 'chapterUrl', '.section-list li'),
  { isListField: false, rootSelector: '.section-list li', itemSelector: '.section-list li' },
  'chapterUrl picker keeps chapterList root/item scope'
);

assert.deepEqual(
  buildPickerScope('toc', 'chapterList', '.section-list li'),
  { isListField: true, rootSelector: '', itemSelector: '' },
  'chapterList itself is a list field, not a list-scoped item field'
);

assert.equal(buildPickerScope('toc', 'chapterUrl', ''), null, 'list-scoped fields still require list selector');
assert.equal(shouldApplyListRange('toc', 'chapterName'), true, 'chapterName preview follows chapterList range');
assert.equal(shouldApplyListRange('toc', 'nextTocUrl'), false, 'nextTocUrl preview ignores chapterList range');
assert.equal(shouldApplyListRange('content', 'nextContentUrl'), false, 'nextContentUrl preview ignores list range');

console.log('All list scope tests passed!');
