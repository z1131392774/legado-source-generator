const assert = require('node:assert/strict');

// 模拟最小化的 popup 环境
let mockSaveCalled = false;
let mockUpdateStepCalled = false;
let mockRenderFieldsCalled = false;
let mockUpdateNavCalled = false;
let mockRenderSummaryCalled = false;

global.state = {
  activeRuleType: 'search',
  rules: { search: { currentStep: 0, fields: {}, fieldStates: {}, bookListSelector: null } }
};

global.saveState = () => {
  mockSaveCalled = true;
};
global.updateStepIndicator = () => {
  mockUpdateStepCalled = true;
};
global.renderFields = () => {
  mockRenderFieldsCalled = true;
};
global.updateNavButtons = () => {
  mockUpdateNavCalled = true;
};
global.renderFieldStatusSummary = () => {
  mockRenderSummaryCalled = true;
};
global.getRuleState = () => global.state.rules[global.state.activeRuleType];

// 被测函数（与 popup.js 中逻辑一致）
function goToStep(index) {
  const rule = global.getRuleState();
  if (index === rule.currentStep) return;
  rule.currentStep = index;
  global.saveState();
  global.updateStepIndicator();
  global.renderFields();
  global.updateNavButtons();
  global.renderFieldStatusSummary();
}

// 测试 1: 正常跳转
global.state.rules.search.currentStep = 0;
mockSaveCalled = false;
mockUpdateStepCalled = false;
mockRenderFieldsCalled = false;
mockUpdateNavCalled = false;
mockRenderSummaryCalled = false;
goToStep(2);
assert.strictEqual(global.state.rules.search.currentStep, 2, 'currentStep 应变为 2');
assert.strictEqual(mockSaveCalled, true, 'saveState 应被调用');
assert.strictEqual(mockUpdateStepCalled, true, 'updateStepIndicator 应被调用');
assert.strictEqual(mockRenderFieldsCalled, true, 'renderFields 应被调用');
assert.strictEqual(mockUpdateNavCalled, true, 'updateNavButtons 应被调用');
assert.strictEqual(mockRenderSummaryCalled, true, 'renderFieldStatusSummary 应被调用');

// 测试 2: 跳转到相同 index 应短路返回
mockSaveCalled = false;
mockUpdateStepCalled = false;
mockRenderFieldsCalled = false;
mockUpdateNavCalled = false;
mockRenderSummaryCalled = false;
goToStep(2);
assert.strictEqual(mockSaveCalled, false, '相同 index 时不应调用 saveState');
assert.strictEqual(mockUpdateStepCalled, false, '相同 index 时不应调用 updateStepIndicator');
assert.strictEqual(mockRenderFieldsCalled, false, '相同 index 时不应调用 renderFields');
assert.strictEqual(mockUpdateNavCalled, false, '相同 index 时不应调用 updateNavButtons');
assert.strictEqual(mockRenderSummaryCalled, false, '相同 index 时不应调用 renderFieldStatusSummary');

// 测试 3: 跳转到 index 0
goToStep(0);
assert.strictEqual(global.state.rules.search.currentStep, 0, 'currentStep 应变为 0');

console.log('All navigation tests passed!');
