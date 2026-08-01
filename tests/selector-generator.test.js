const assert = require('node:assert/strict');

const chromeSelectorGen = require('../src/lib/selector-generator.js');
const firefoxSelectorGen = require('../src-firefox/lib/selector-generator.js');

function createNode(tagName, options = {}) {
  return { tagName, id: options.id || '', className: options.className || '', parentElement: options.parent || null };
}

function withMockDocument(queryMap, fn) {
  const originalDocument = global.document;

  const body = createNode('BODY');
  const html = createNode('HTML');

  global.document = {
    body,
    documentElement: html,
    querySelectorAll(selector) {
      return queryMap[selector] || [];
    }
  };

  try {
    fn({ body, html });
  } finally {
    global.document = originalDocument;
  }
}

function runSelectorGeneratorSuite(generator, name) {
  (function testFullPathSelectorForSiblingItems() {
    const queryMap = {};
    withMockDocument(queryMap, ({ body }) => {
      const recommend = createNode('DIV', { className: 'recommend', parent: body });
      const main = createNode('DIV', { id: 'main', parent: recommend });
      const item1 = createNode('DIV', { className: 'hot_sale', parent: main });
      const item2 = createNode('DIV', { className: 'hot_sale featured', parent: main });

      const expectedSelector = 'div.recommend > div#main > div.hot_sale';
      queryMap[expectedSelector] = [item1, item2];

      const selector = generator.getIntersectionSelector(item1, item2);
      assert.equal(selector, expectedSelector, `${name}: sibling list items should return full path selector`);
    });
  })();

  (function testLcaConvergesForDifferentDepthSelections() {
    const queryMap = {};
    withMockDocument(queryMap, ({ body }) => {
      const recommend = createNode('DIV', { className: 'recommend', parent: body });
      const main = createNode('DIV', { id: 'main', parent: recommend });
      const item1 = createNode('DIV', { className: 'hot_sale', parent: main });
      const item2 = createNode('DIV', { className: 'hot_sale', parent: main });
      const title1 = createNode('P', { className: 'title', parent: item1 });

      const expectedSelector = 'div.recommend > div#main > div.hot_sale';
      queryMap[expectedSelector] = [item1, item2];

      const selector = generator.getIntersectionSelector(title1, item2);
      assert.equal(selector, expectedSelector, `${name}: mixed-depth selection should converge via LCA`);
    });
  })();

  (function testTagMismatchFallsBackToNullWhenNoMatch() {
    withMockDocument({}, ({ body }) => {
      const root = createNode('DIV', { className: 'recommend', parent: body });
      const a = createNode('A', { className: 'book-link', parent: root });
      const img = createNode('IMG', { className: 'book-cover', parent: root });

      const selector = generator.getIntersectionSelector(a, img);
      assert.equal(selector, null, `${name}: mismatched tags should return null when no fallback matches`);
    });
  })();
}

runSelectorGeneratorSuite(chromeSelectorGen, 'chrome');
runSelectorGeneratorSuite(firefoxSelectorGen, 'firefox');

console.log('selector-generator tests passed');
