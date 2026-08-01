/**
 * Unit tests for buildNativeIndexRule logic
 * Run: node tests/native-index.test.js
 */

// Inline the buildNativeIndexRule and buildAtSelector functions for testing
function buildAtSelector(sel, key, tag) {
  const linkFields = ['bookUrl', 'chapterUrl', 'tocUrl', 'nextTocUrl', 'nextContentUrl'];
  if (linkFields.includes(key)) {
    return tag === 'a' ? sel + '@href' : sel + ' a@href';
  } else if (key === 'coverUrl') {
    return tag === 'img' ? sel + '@src' : sel + ' img@src';
  } else {
    return sel + '@text';
  }
}

function buildNativeIndexRule(baseSelector, fieldKey, fieldData, isListField) {
  if (isListField) {
    const start = fieldData.listIndex?.start ? parseInt(fieldData.listIndex.start, 10) : 0;
    const end = fieldData.listIndex?.end ? parseInt(fieldData.listIndex.end, 10) : 0;

    if (isNaN(start) || isNaN(end)) return baseSelector;

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

  const singleVal = fieldData.listIndex?.single ? parseInt(fieldData.listIndex.single, 10) : 0;
  const tagName = fieldData.tagName || '';

  if (!singleVal || isNaN(singleVal) || singleVal === 0) {
    return buildAtSelector(baseSelector, fieldKey, tagName);
  }

  const index = singleVal > 0 ? singleVal - 1 : singleVal;
  const atPart = buildAtSelector('', fieldKey, tagName);
  return `${baseSelector}.${index}${atPart}`;
}

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, msg) {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.log(`  ❌ ${msg}`);
    console.log(`     Expected: ${expected}`);
    console.log(`     Actual:   ${actual}`);
  }
}

// ─── List field tests ───
console.log('\nList field tests');

assertEqual(
  buildNativeIndexRule('div.item', 'bookList', { listIndex: {} }, true),
  'div.item',
  'Default (no index) → no filter'
);

assertEqual(
  buildNativeIndexRule('div.item', 'bookList', { listIndex: { start: '1', end: '0' } }, true),
  'div.item',
  'start=1, end=0 → no filter'
);

assertEqual(
  buildNativeIndexRule('div.item', 'bookList', { listIndex: { start: '2', end: '0' } }, true),
  'div.item[1:]',
  'start=2, end=0 → [1:]'
);

assertEqual(
  buildNativeIndexRule('div.item', 'bookList', { listIndex: { start: '1', end: '10' } }, true),
  'div.item[:9]',
  'start=1, end=10 → [:9]'
);

assertEqual(
  buildNativeIndexRule('div.item', 'bookList', { listIndex: { start: '2', end: '10' } }, true),
  'div.item[1:9]',
  'start=2, end=10 → [1:9]'
);

assertEqual(
  buildNativeIndexRule('div.item', 'bookList', { listIndex: { start: '1', end: '-1' } }, true),
  'div.item',
  'start=1, end=-1 → no filter (all items)'
);

assertEqual(
  buildNativeIndexRule('div.item', 'bookList', { listIndex: { start: '2', end: '-1' } }, true),
  'div.item[1:-1]',
  'start=2, end=-1 → [1:-1]'
);

assertEqual(
  buildNativeIndexRule('div.item', 'bookList', { listIndex: { start: '1', end: '-2' } }, true),
  'div.item[:-2]',
  'start=1, end=-2 → [:-2]'
);

// ─── Non-list field tests ───
console.log('\n📄 Non-list field tests');

assertEqual(
  buildNativeIndexRule('h3.title', 'name', { listIndex: {}, tagName: 'h3' }, false),
  'h3.title@text',
  'No index → @text'
);

assertEqual(
  buildNativeIndexRule('h3.title', 'name', { listIndex: { single: '2' }, tagName: 'h3' }, false),
  'h3.title.1@text',
  'single=2 → .1@text'
);

assertEqual(
  buildNativeIndexRule('a.link', 'bookUrl', { listIndex: { single: '2' }, tagName: 'a' }, false),
  'a.link.1@href',
  'URL field single=2 → .1@href'
);

assertEqual(
  buildNativeIndexRule('img.cover', 'coverUrl', { listIndex: { single: '3' }, tagName: 'div' }, false),
  'img.cover.2 img@src',
  'Cover field single=3, not img tag → .2 img@src'
);

assertEqual(
  buildNativeIndexRule('h3.title', 'name', { listIndex: { single: '-1' }, tagName: 'h3' }, false),
  'h3.title.-1@text',
  'single=-1 → .-1@text'
);

assertEqual(
  buildNativeIndexRule('h3.title', 'name', { listIndex: { single: '0' }, tagName: 'h3' }, false),
  'h3.title@text',
  'single=0 → no index'
);

// ─── Edge cases ───
console.log('\n🔧 Edge case tests');

assertEqual(
  buildNativeIndexRule('div.item', 'bookList', { listIndex: { start: 'abc', end: '0' } }, true),
  'div.item',
  'Invalid start → fallback'
);

assertEqual(
  buildNativeIndexRule('div.item', 'bookList', { listIndex: { start: '5', end: '5' } }, true),
  'div.item[4:4]',
  'start=5, end=5 → [4:4] (single item)'
);

// ─── Summary ───
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
