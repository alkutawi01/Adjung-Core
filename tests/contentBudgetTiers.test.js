import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContentBudget } from '../core/editorial/ContentBudget.js';

test('ContentBudget - HERO tier validation (Slot 0)', () => {
  // HERO solo max: title 115, brief 350
  const valid = validateContentBudget(0, 'A'.repeat(90), 'B'.repeat(158));
  assert.equal(valid.isValid, true);

  const overflowTitle = validateContentBudget(0, 'A'.repeat(120), 'B'.repeat(100));
  assert.equal(overflowTitle.isValid, false);
});

test('ContentBudget - MENEGAK tier validation (Slot 1)', () => {
  // MENEGAK solo max: title 168, brief 429
  const valid = validateContentBudget(1, 'A'.repeat(150), 'B'.repeat(300));
  assert.equal(valid.isValid, true);
});

test('ContentBudget - STANDARD tier validation (Slot 2)', () => {
  // STANDARD solo max: title 110, brief 280
  const valid = validateContentBudget(2, 'A'.repeat(100), 'B'.repeat(250));
  assert.equal(valid.isValid, true);

  const invalid = validateContentBudget(2, 'A'.repeat(120), 'B'.repeat(200));
  assert.equal(invalid.isValid, false);
});

test('ContentBudget - SEGI_EMPAT_MEDIUM tier validation (Slot 13)', () => {
  // SEGI_EMPAT_MEDIUM solo max: title 94, brief 126
  const valid = validateContentBudget(13, 'A'.repeat(90), 'B'.repeat(120));
  assert.equal(valid.isValid, true);
});

test('ContentBudget - SEGI_EMPAT_SMALL tier validation (Slot 3)', () => {
  // SEGI_EMPAT_SMALL solo max: title 62, brief 78
  const valid = validateContentBudget(3, 'A'.repeat(60), 'B'.repeat(70));
  assert.equal(valid.isValid, true);
});

test('ContentBudget - BAR tier validation (Slot 7)', () => {
  // BAR solo max: title 40, brief 0 (brief = 0)
  const valid = validateContentBudget(7, 'A'.repeat(35), '');
  assert.equal(valid.isValid, true);

  const invalid = validateContentBudget(7, 'A'.repeat(45), '');
  assert.equal(invalid.isValid, false);
});

test('ContentBudget - TICKER tier validation (Slot -1)', () => {
  // TICKER solo max: title 80, brief 220
  const valid = validateContentBudget(-1, 'A'.repeat(75), 'B'.repeat(200));
  assert.equal(valid.isValid, true);

  const invalid = validateContentBudget(-1, 'A'.repeat(85), 'B'.repeat(150));
  assert.equal(invalid.isValid, false);
});
