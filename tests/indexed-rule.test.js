/**
 * Unit tests for shared indexed rule generation.
 * Run: node tests/indexed-rule.test.js
 */

const LINK_FIELDS = ['bookUrl', 'chapterUrl', 'tocUrl', 'nextTocUrl', 'nextContentUrl'];

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

function buildJsArrayIndexExpr(index, sizeExpr) {
  return index < 0 ? `${sizeExpr} + (${index})` : String(index);
}

function buildAtSelector(sel, key, tag, listItemTag) {
  if (LINK_FIELDS.includes(key)) {
    if (listItemTag === 'a') return 'a@href';
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
  const listItemTag = fieldData.listItemTagName || '';

  if (listItemTag === 'a' && LINK_FIELDS.includes(fieldKey)) {
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

  if (singleVal === 0) {
    return buildAtSelector(baseSelector, fieldKey, selectedTag, listItemTag);
  }

  const index = parseSingleIndex(fieldData.listIndex?.single);
  if (index === null) {
    return buildAtSelector(baseSelector, fieldKey, selectedTag, listItemTag);
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

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, msg) {
  if (actual === expected) {
    passed++;
    console.log(`  PASS ${msg}`);
  } else {
    failed++;
    console.log(`  FAIL ${msg}`);
    console.log(`     Expected: ${expected}`);
    console.log(`     Actual:   ${actual}`);
  }
}

function assertIncludes(actual, expectedPart, msg) {
  if (actual.includes(expectedPart)) {
    passed++;
    console.log(`  PASS ${msg}`);
  } else {
    failed++;
    console.log(`  FAIL ${msg}`);
    console.log(`     Missing: ${expectedPart}`);
    console.log(`     Actual:  ${actual}`);
  }
}

console.log('\nShared indexed rule tests');

assertEqual(
  buildIndexedRule('h3.title', 'name', { listIndex: {}, tagName: 'h3' }, false),
  'h3.title@text',
  'initial picker rule uses text extraction without index'
);

assertEqual(
  buildIndexedRule('a.book', 'bookUrl', { listIndex: {}, tagName: 'a' }, false),
  'a.book@href',
  'initial picker rule uses href extraction for selected links'
);

assertEqual(
  buildIndexedRule('h3.title', 'lastChapter', { listIndex: { single: '-1' }, tagName: 'h3' }, false),
  'h3.title.-1@text',
  'native single=-1 keeps Legado reverse index syntax'
);

const jsLastChapterRule = buildIndexedRule(
  'h3.title',
  'lastChapter',
  { useJsIndex: true, listIndex: { single: '-1' }, tagName: 'h3' },
  false
);
assertIncludes(
  jsLastChapterRule,
  'var index = matches.size() + (-1);',
  'JS single=-1 converts to jsoup-safe index expression'
);
assertIncludes(
  jsLastChapterRule,
  'return String(matches.get(index).text());',
  'JS text field extracts selected indexed text'
);

const jsContainerLinkRule = buildIndexedRule(
  'div.info',
  'tocUrl',
  { useJsIndex: true, listIndex: { single: '2' }, tagName: 'div' },
  false
);
assertIncludes(
  jsContainerLinkRule,
  'var matches = doc.select("div.info a");',
  'JS link field indexes extracted child links when selected element is a container'
);
assertIncludes(
  jsContainerLinkRule,
  'return String(matches.get(index).attr("href"));',
  'JS link field extracts href from indexed link'
);

const jsListRule = buildIndexedRule(
  'div.item',
  'bookList',
  { useJsIndex: true, listIndex: { start: '2', end: '-2' } },
  true
);
assertIncludes(jsListRule, 'var start = 1;', 'JS list start index converts from 1-based UI input');
assertIncludes(
  jsListRule,
  'var end = list.size() + (-2) + 1;',
  'JS list negative end converts to inclusive reverse range'
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
