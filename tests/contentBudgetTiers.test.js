import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContentBudget } from '../core/editorial/ContentBudget.js';

test('ContentBudget - HERO tier validation (Slot 0)', () => {
  // HERO solo max: title 115, brief 350 — shared budget: 90/115 + 50/350 = 0.926 <= 1
  const valid = validateContentBudget(0, 'A'.repeat(90), 'B'.repeat(50));
  assert.equal(valid.isValid, true);

  const overflowTitle = validateContentBudget(0, 'A'.repeat(120), 'B'.repeat(100));
  assert.equal(overflowTitle.isValid, false);
});

test('ContentBudget - MENEGAK tier validation (Slot 1)', () => {
  // MENEGAK solo max (2026-07-28 remeasurement): title 102, brief 379 — shared budget:
  // 50/102 + 189/379 = 0.490 + 0.499 = 0.989 <= 1
  const valid = validateContentBudget(1, 'A'.repeat(50), 'B'.repeat(189));
  assert.equal(valid.isValid, true);
});

test('ContentBudget - STANDARD tier validation (Slot 2)', () => {
  // STANDARD solo max (2026-07-28 remeasurement): title 135, brief 352 — shared budget:
  // 60/135 + 100/352 = 0.444 + 0.284 = 0.728 <= 1
  const valid = validateContentBudget(2, 'A'.repeat(60), 'B'.repeat(100));
  assert.equal(valid.isValid, true);

  const invalid = validateContentBudget(2, 'A'.repeat(120), 'B'.repeat(200));
  assert.equal(invalid.isValid, false);
});

test('ContentBudget - SEGI_EMPAT_MEDIUM tier validation (Slot 13)', () => {
  // SEGI_EMPAT_MEDIUM solo max (2026-07-28 remeasurement): title 68, brief 158 — shared budget:
  // 30/68 + 60/158 = 0.441 + 0.380 = 0.821 <= 1
  const valid = validateContentBudget(13, 'A'.repeat(30), 'B'.repeat(60));
  assert.equal(valid.isValid, true);
});

test('ContentBudget - SEGI_EMPAT_SMALL tier validation (Slot 3)', () => {
  // SEGI_EMPAT_SMALL solo max (2026-07-28 remeasurement): title 35, brief 96 — shared budget:
  // 17/35 + 48/96 = 0.486 + 0.500 = 0.986 <= 1
  const valid = validateContentBudget(3, 'A'.repeat(17), 'B'.repeat(48));
  assert.equal(valid.isValid, true);
});

test('ContentBudget - BAR tier validation (Slot 7)', () => {
  // BAR solo max: title 95, brief 0 (brief = 0)
  const valid = validateContentBudget(7, 'A'.repeat(90), '');
  assert.equal(valid.isValid, true);

  const invalid = validateContentBudget(7, 'A'.repeat(100), '');
  assert.equal(invalid.isValid, false);
});

test('ContentBudget - TICKER tier validation (Slot -1)', () => {
  // TICKER solo max: title 80, brief 220 — shared budget: 30/80 + 120/220 = 0.920 <= 1
  const valid = validateContentBudget(-1, 'A'.repeat(30), 'B'.repeat(120));
  assert.equal(valid.isValid, true);

  const invalid = validateContentBudget(-1, 'A'.repeat(85), 'B'.repeat(150));
  assert.equal(invalid.isValid, false);
});
