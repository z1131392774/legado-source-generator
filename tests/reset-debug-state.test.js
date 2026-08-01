/**
 * Regression checks for preserving Chrome debug inputs during reset-all.
 * Run: node tests/reset-debug-state.test.js
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const popupSource = fs.readFileSync(path.resolve(__dirname, '..', 'src/popup/popup.js'), 'utf8');

function extractFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} function exists`);

  const braceStart = source.indexOf('{', start);
  assert.notEqual(braceStart, -1, `${name} function has a body`);

  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) return source.slice(start, i + 1);
  }

  throw new Error(`${name} function body was not closed`);
}

const resetSource = extractFunctionSource(popupSource, 'handleReset');

assert.match(popupSource, /function getResetPreservedDebugState\(\)/, 'reset has a helper for preserving debug state');

assert.match(
  resetSource,
  /const preservedDebugState = getResetPreservedDebugState\(\);/,
  'reset captures debug state before cloning defaults'
);

assert.match(
  resetSource,
  /state\.debugIp = preservedDebugState\.debugIp;/,
  'reset restores debug IP into the new state'
);

assert.match(
  resetSource,
  /state\.debugPort = preservedDebugState\.debugPort;/,
  'reset restores debug port into the new state'
);

assert.match(
  resetSource,
  /chrome\.storage\.local\.set\(\{ legadoSourceState: state \}\);/,
  'reset persists the reset state with preserved debug config'
);

assert.doesNotMatch(
  resetSource,
  /document\.getElementById\('debug/,
  'reset does not clear or mutate debug panel inputs'
);

assert.doesNotMatch(
  resetSource,
  /debugWs|debugFinished|debugTimeout|debugStartBtn|debugStopBtn|debugResult/,
  'reset does not stop or mutate an active debug session'
);

assert.doesNotMatch(
  resetSource,
  /chrome\.storage\.local\.remove\(\['legadoSourceState'/,
  'reset does not delete the whole persisted state before preserving debug config'
);

console.log('reset debug state tests passed');
