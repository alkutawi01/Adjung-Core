import test from 'node:test';
import assert from 'node:assert/strict';
import { GEOMETRY_RATIOS, TIER_SLOTS, tierForSlot, FALLBACK_CEILINGS, ceilingForSlot } from '../core/editorial/GeometryConfig.js';
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

test('ceilingForSlot - matches canonical GEOMETRY_RATIOS for every tier (regression guard)', () => {
  // Guards against the class of bug found 2026-07-25: server.js and FrontpageView.tsx each kept
  // their own hand-typed copy of these ceilings, and 4 of 8 tiers had silently drifted from the
  // canonical values here. ceilingForSlot() is now the single source both of them delegate to --
  // this test asserts it actually matches GEOMETRY_RATIOS for a representative slot per tier.
  assert.deepEqual(ceilingForSlot(0), { maxTitle: 115, maxBrief: 350, maxBriefLong: 800 }); // HERO
  assert.deepEqual(ceilingForSlot(1), { maxTitle: 168, maxBrief: 429, maxBriefLong: 800 }); // MENEGAK
  assert.deepEqual(ceilingForSlot(2), { maxTitle: 110, maxBrief: 280, maxBriefLong: 600 }); // STANDARD
  assert.deepEqual(ceilingForSlot(13), { maxTitle: 94, maxBrief: 126, maxBriefLong: 500 }); // SEGI_EMPAT_MEDIUM
  assert.deepEqual(ceilingForSlot(3), { maxTitle: 62, maxBrief: 78, maxBriefLong: 400 }); // SEGI_EMPAT_SMALL
  assert.deepEqual(ceilingForSlot(4), { maxTitle: 80, maxBrief: 41, maxBriefLong: 400 }); // KOMPAK
  assert.deepEqual(ceilingForSlot(7), { maxTitle: 95, maxBrief: 0, maxBriefLong: 0 }); // BAR
  assert.deepEqual(ceilingForSlot(-1), { maxTitle: 80, maxBrief: 220, maxBriefLong: 0 }); // TICKER
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
  assert.match(result.reason, /melebihi had yang dibenarkan/);
});

test('validateContentBudget - KOMPAK tier budget line validation', () => {
  // KOMPAK solo max: title 80, brief 41
  const validResult = validateContentBudget(4, 'A'.repeat(40), 'B'.repeat(20));
  assert.equal(validResult.isValid, true);

  const overflowResult = validateContentBudget(4, 'A'.repeat(80), 'B'.repeat(50));
  assert.equal(overflowResult.isValid, false);
});
