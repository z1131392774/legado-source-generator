/**
 * Unit tests for popup preview index filtering.
 * Run: node tests/preview-index.test.js
 */

function parseSingleIndex(value) {
  const parsed = value ? parseInt(value, 10) : 0;
  if (!parsed || isNaN(parsed)) return null;
  return parsed > 0 ? parsed - 1 : parsed;
}

function resolveArrayIndex(index, length) {
  return index < 0 ? length + index : index;
}

function filterPreviewsByIndex(previews, index, isListField, listRange) {
  if (!previews || !previews.length) return previews;

  const isGrouped = Array.isArray(previews[0]);

  if (!isListField) {
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

  const flat = isGrouped ? previews.flat() : previews;
  const start = index.start ? parseInt(index.start, 10) : 0;
  const end = index.end ? parseInt(index.end, 10) : flat.length;
  const s = start < 0 ? flat.length + start : Math.max(0, start - 1);
  const e = end < 0 ? flat.length + end + 1 : Math.min(flat.length, end);
  return flat.slice(s, e);
}

let passed = 0;
let failed = 0;

function assertDeepEqual(actual, expected, msg) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson === expectedJson) {
    passed++;
    console.log(`  PASS ${msg}`);
  } else {
    failed++;
    console.log(`  FAIL ${msg}`);
    console.log(`     Expected: ${expectedJson}`);
    console.log(`     Actual:   ${actualJson}`);
  }
}

const flat = [{ text: 'Chapter 1' }, { text: 'Chapter 2' }, { text: 'Chapter 3' }];

const grouped = [
  [{ text: 'Book A - first' }, { text: 'Book A - latest' }],
  [{ text: 'Book B - first' }, { text: 'Book B - latest' }]
];

console.log('\nPreview single index tests');

assertDeepEqual(
  filterPreviewsByIndex(flat, { single: '-1' }, false),
  [{ text: 'Chapter 3' }],
  'single=-1 selects last flat preview'
);

assertDeepEqual(
  filterPreviewsByIndex(grouped, { single: '-1' }, false),
  [{ text: 'Book A - latest' }, { text: 'Book B - latest' }],
  'single=-1 selects last item in each preview group'
);

assertDeepEqual(filterPreviewsByIndex(flat, { single: '0' }, false), flat, 'single=0 keeps all previews');

assertDeepEqual(filterPreviewsByIndex(flat, { single: 'abc' }, false), flat, 'invalid single index keeps all previews');

assertDeepEqual(
  filterPreviewsByIndex(flat, { single: '-4' }, false),
  [],
  'out-of-range negative index returns no flat preview'
);

console.log('\nPreview list range tests');

assertDeepEqual(
  filterPreviewsByIndex(flat, { start: '1', end: '-1' }, true),
  flat,
  'list range end=-1 includes through last preview'
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
