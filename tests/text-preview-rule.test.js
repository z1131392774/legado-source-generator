/**
 * Unit tests for Legado text.* preview request routing.
 * Run: node tests/text-preview-rule.test.js
 */

const assert = require('node:assert/strict');

const DEBUG_PREFIX = '<js>java.log("输入:" + result);</js>';

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

function parseSingleIndex(value) {
  const parsed = value ? parseInt(value, 10) : 0;
  if (!parsed || isNaN(parsed)) return null;
  return parsed > 0 ? parsed - 1 : parsed;
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

assert.equal(
  resolveTextPreviewRule('text.下一页@href'),
  'text.下一页@href',
  'text rule with href suffix is recognized'
);

assert.equal(resolveTextPreviewRule('text.@href'), '', 'empty text rule is ignored');

assert.deepEqual(
  buildPreviewMessage('text.下一页@href', 'text.下一页'),
  { action: 'previewRule', rule: 'text.下一页@href' },
  'text rule takes precedence over CSS-shaped preview selector'
);

assert.deepEqual(
  buildPreviewMessage('.index-container a@href', '.index-container a'),
  { action: 'previewSelector', selector: '.index-container a' },
  'CSS selector rule keeps existing previewSelector routing'
);

assert.deepEqual(
  parseTextPreviewRule('text.下一页@href'),
  { text: '下一页', attr: 'href' },
  'content preview parser extracts text and attr'
);

assert.deepEqual(
  parseTextPreviewRule('text.下一页.1@href'),
  { text: '下一页', attr: 'href' },
  'content preview parser strips native text index before text matching'
);

assert.deepEqual(
  parseTextPreviewRule('text. 下一 页 @href'),
  { text: '下一 页', attr: 'href' },
  'content preview parser normalizes whitespace inside text'
);

assert.equal(parseTextPreviewRule('div > a@href'), null, 'non-text rule is not parsed as text rule');

assert.equal(
  buildTextIndexedRule('text.下一页@href', { listIndex: { single: '2' } }, false),
  'text.下一页.1@href',
  'single=2 applies native zero-based index to text rule'
);

assert.equal(
  buildTextIndexedRule('text.下一页.1@href', { listIndex: { single: '0' } }, false),
  'text.下一页@href',
  'single=0 removes native text index'
);

assert.equal(
  buildTextIndexedRule('text.下一页@href', { listIndex: { single: '-1' } }, false),
  'text.下一页.-1@href',
  'single=-1 keeps reverse index syntax on text rule'
);

assert.equal(
  buildTextIndexedRule('text.下一页@href', { listIndex: { single: '2' } }, true),
  '',
  'list field range indexing does not rewrite text rule'
);

assert.equal(
  applyDebugPrefix(buildTextIndexedRule('text.下一页@href', { listIndex: { single: '2' } }, false), true),
  DEBUG_PREFIX + 'text.下一页.1@href',
  'debug prefix is preserved when indexed text rule is rebuilt'
);

console.log('All text preview rule tests passed!');
