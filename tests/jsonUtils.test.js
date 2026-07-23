import test from 'node:test';
import assert from 'node:assert/strict';
import { safeJsonParse } from '../core/utils/jsonUtils.js';

test('safeJsonParse - parses valid JSON string correctly', () => {
  const result = safeJsonParse('{"key":"value"}', {});
  assert.deepEqual(result, { key: 'value' });
});

test('safeJsonParse - returns fallback on invalid JSON syntax', () => {
  const result = safeJsonParse('invalid-json{', { fallback: true });
  assert.deepEqual(result, { fallback: true });
});

test('safeJsonParse - handles null and empty input gracefully', () => {
  assert.deepEqual(safeJsonParse(null, []), []);
  assert.deepEqual(safeJsonParse('', 'default'), 'default');
  assert.deepEqual(safeJsonParse(undefined, {}), {});
});
