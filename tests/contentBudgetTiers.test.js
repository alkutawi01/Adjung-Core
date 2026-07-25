import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContentBudget } from '../core/editorial/ContentBudget.js';

test('ContentBudget - HERO tier validation (Slot 0)', () => {
  // HERO solo max: title 115, brief 350 -- shared budget: 90/115 + 50/350 = 0.926 <= 1
  const valid = validateContentBudget(0, 'A'.repeat(90), 'B'.repeat(50));
  assert.equal(valid.isValid, true);

  const overflowTitle = validateContentBudget(0, 'A'.repeat(120), 'B'.repeat(100));
  assert.equal(overflowTitle.isValid, false);
});

test('ContentBudget - MENEGAK tier validation (Slot 1)', () => {
  // MENEGAK solo max: title 168, brief 429 -- shared budget: 100/168 + 150/429 = 0.945 <= 1
  const valid = validateContentBudget(1, 'A'.repeat(100), 'B'.repeat(150));
  assert.equal(valid.isValid, true);
});

test('ContentBudget - STANDARD tier validation (Slot 2)', () => {
  // STANDARD solo max: title 110, brief 280 -- shared budget: 60/110 + 100/280 = 0.902 <= 1
  const valid = validateContentBudget(2, 'A'.repeat(60), 'B'.repeat(100));
  assert.equal(valid.isValid, true);

  const invalid = validateContentBudget(2, 'A'.repeat(120), 'B'.repeat(200));
  assert.equal(invalid.isValid, false);
});

test('ContentBudget - SEGI_EMPAT_MEDIUM tier validation (Slot 13)', () => {
  // SEGI_EMPAT_MEDIUM solo max: title 94, brief 126 -- shared budget: 40/94 + 60/126 = 0.902 <= 1
  const valid = validateContentBudget(13, 'A'.repeat(40), 'B'.repeat(60));
  assert.equal(valid.isValid, true);
});

test('ContentBudget - SEGI_EMPAT_SMALL tier validation (Slot 3)', () => {
  // SEGI_EMPAT_SMALL solo max: title 62, brief 78 -- shared budget: 30/62 + 35/78 = 0.933 <= 1
  const valid = validateContentBudget(3, 'A'.repeat(30), 'B'.repeat(35));
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
  // TICKER solo max: title 80, brief 220 -- shared budget: 30/80 + 120/220 = 0.920 <= 1
  const valid = validateContentBudget(-1, 'A'.repeat(30), 'B'.repeat(120));
  assert.equal(valid.isValid, true);

  const invalid = validateContentBudget(-1, 'A'.repeat(85), 'B'.repeat(150));
  assert.equal(invalid.isValid, false);
});
