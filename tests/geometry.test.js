import test from 'node:test';
import assert from 'node:assert/strict';
import { GEOMETRY_RATIOS, TIER_SLOTS, tierForSlot, FALLBACK_CEILINGS } from '../core/editorial/GeometryConfig.js';
import { validateContentBudget } from '../core/editorial/ContentBudget.js';

test('GeometryConfig - All 8 tiers have GEOMETRY_RATIOS defined', () => {
  const expectedTiers = ['HERO', 'MENEGAK', 'STANDARD', 'SEGI_EMPAT_MEDIUM', 'SEGI_EMPAT_SMALL', 'KOMPAK', 'BAR', 'TICKER'];
  for (const tier of expectedTiers) {
    assert.ok(GEOMETRY_RATIOS[tier], `Missing GEOMETRY_RATIOS definition for tier ${tier}`);
    assert.ok(GEOMETRY_RATIOS[tier].maxTitleAlone > 0, `${tier} should have maxTitleAlone > 0`);
  }
});

test('GeometryConfig - tierForSlot maps slot indices correctly', () => {
  assert.equal(tierForSlot(0), 'HERO');
  assert.equal(tierForSlot(1), 'MENEGAK');
  assert.equal(tierForSlot(2), 'STANDARD');
  assert.equal(tierForSlot(13), 'SEGI_EMPAT_MEDIUM');
  assert.equal(tierForSlot(3), 'SEGI_EMPAT_SMALL');
  assert.equal(tierForSlot(4), 'KOMPAK');
  assert.equal(tierForSlot(7), 'BAR');
  assert.equal(tierForSlot(-1), 'TICKER');
});

test('validateContentBudget - validates valid title and brief budget', () => {
  // MENEGAK solo max: title 168, brief 429
  const result = validateContentBudget(1, 'A'.repeat(84), 'B'.repeat(214));
  assert.equal(result.isValid, true);
});

test('validateContentBudget - rejects budget overflow', () => {
  // MENEGAK title overflow: > 168 (175)
  const result = validateContentBudget(1, 'A'.repeat(175), 'B'.repeat(200));
  assert.equal(result.isValid, false);
  assert.match(result.reason, /melebihi had maksima/);
});

test('validateContentBudget - KOMPAK tier budget line validation', () => {
  // KOMPAK solo max: title 80, brief 41
  const validResult = validateContentBudget(4, 'A'.repeat(40), 'B'.repeat(20));
  assert.equal(validResult.isValid, true);

  const overflowResult = validateContentBudget(4, 'A'.repeat(80), 'B'.repeat(50));
  assert.equal(overflowResult.isValid, false);
});
