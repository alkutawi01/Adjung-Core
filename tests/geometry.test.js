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
  //
  // 2026-07-28: MENEGAK/STANDARD/SEGI_EMPAT_MEDIUM/SEGI_EMPAT_SMALL/KOMPAK numbers updated after
  // real empirical remeasurement against actual rendered card markup (see GEOMETRY_RATIOS's own
  // comment in GeometryConfig.js) -- the old numbers here had never been measured against real
  // cards and drifted from actual capacity by a wide margin for several tiers.
  assert.deepEqual(ceilingForSlot(0), { maxTitle: 115, maxBrief: 350, maxBriefLong: 800 }); // HERO
  assert.deepEqual(ceilingForSlot(1), { maxTitle: 102, maxBrief: 379, maxBriefLong: 800 }); // MENEGAK
  assert.deepEqual(ceilingForSlot(2), { maxTitle: 135, maxBrief: 352, maxBriefLong: 600 }); // STANDARD
  assert.deepEqual(ceilingForSlot(13), { maxTitle: 68, maxBrief: 158, maxBriefLong: 500 }); // SEGI_EMPAT_MEDIUM
  assert.deepEqual(ceilingForSlot(3), { maxTitle: 35, maxBrief: 96, maxBriefLong: 400 }); // SEGI_EMPAT_SMALL
  assert.deepEqual(ceilingForSlot(4), { maxTitle: 54, maxBrief: 68, maxBriefLong: 400 }); // KOMPAK
  assert.deepEqual(ceilingForSlot(7), { maxTitle: 95, maxBrief: 0, maxBriefLong: 0 }); // BAR
  assert.deepEqual(ceilingForSlot(-1), { maxTitle: 80, maxBrief: 220, maxBriefLong: 0 }); // TICKER
});

test('validateContentBudget - validates valid title and brief budget', () => {
  // MENEGAK solo max: title 102, brief 379
  const result = validateContentBudget(1, 'A'.repeat(51), 'B'.repeat(189));
  assert.equal(result.isValid, true);
});

test('validateContentBudget - rejects budget overflow', () => {
  // MENEGAK title overflow: > 102 (110)
  const result = validateContentBudget(1, 'A'.repeat(110), 'B'.repeat(200));
  assert.equal(result.isValid, false);
  assert.match(result.reason, /melebihi had yang dibenarkan/);
});

test('validateContentBudget - KOMPAK tier budget line validation', () => {
  // KOMPAK solo max: title 54, brief 68
  const validResult = validateContentBudget(4, 'A'.repeat(27), 'B'.repeat(34));
  assert.equal(validResult.isValid, true);

  const overflowResult = validateContentBudget(4, 'A'.repeat(54), 'B'.repeat(50));
  assert.equal(overflowResult.isValid, false);
});
