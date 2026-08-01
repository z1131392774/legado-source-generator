/**
 * Regression checks for the built-in next-page quick insert button.
 * Run: node tests/next-page-quick-insert.test.js
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const POPUP_FILES = ['src/popup/popup.js', 'src-firefox/popup/popup.js'];

function readProjectFile(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function assertNextPageQuickInsertWired(file) {
  const source = readProjectFile(file);

  assert.match(
    source,
    /const NEXT_PAGE_QUICK_INSERT_RULE = 'text\.下一页@href';/,
    `${file} defines the canonical next-page text rule`
  );
  assert.match(
    source,
    /const NEXT_PAGE_QUICK_INSERT_FIELDS = \['nextTocUrl', 'nextContentUrl'\];/,
    `${file} limits the shortcut to TOC/content next-page fields`
  );
  assert.match(
    source,
    /function isNextPageQuickInsertField\(fieldKey\)/,
    `${file} uses a field gate for rendering the shortcut`
  );
  assert.match(source, /id="quickNextPageRuleBtn"/, `${file} renders the quick insert button`);
  assert.match(
    source,
    /id="quickNextPageRuleBtn"[^>]*>预设规则<\/button>/,
    `${file} labels the shortcut as preset rule`
  );
  assert.match(
    source,
    /quickNextPageRuleBtn\.addEventListener\('mousedown'/,
    `${file} prevents focus-loss blur before the shortcut click`
  );
  assert.match(
    source,
    /quickNextPageRuleBtn\.addEventListener\('click', handleQuickNextPageRuleInsert\)/,
    `${file} binds the shortcut click handler`
  );
  assert.match(
    source,
    /requestFieldPreview\(field\.key, NEXT_PAGE_QUICK_INSERT_RULE, ''\)/,
    `${file} previews the inserted text rule`
  );
}

POPUP_FILES.forEach(assertNextPageQuickInsertWired);

console.log('next-page quick insert tests passed');
