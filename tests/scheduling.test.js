import test from 'node:test';
import assert from 'node:assert/strict';
import { isDue, hasReplacementForExpiry, klLocalToIso, isoToKlLocalInput, formatKlDisplay } from '../core/editorial/Scheduling.js';

test('Scheduling - isDue returns false for null/empty timestamp', () => {
  assert.equal(isDue(null), false);
  assert.equal(isDue(''), false);
  assert.equal(isDue(undefined), false);
});

test('Scheduling - isDue returns true when timestamp is in the past', () => {
  const past = new Date(Date.now() - 60000).toISOString();
  assert.equal(isDue(past), true);
});

test('Scheduling - isDue returns false when timestamp is in the future', () => {
  const future = new Date(Date.now() + 60000).toISOString();
  assert.equal(isDue(future), false);
});

test('Scheduling - isDue respects injected nowMs', () => {
  const t = '2026-08-05T01:00:00+08:00';
  assert.equal(isDue(t, new Date('2026-08-05T02:00:00+08:00').getTime()), true);
  assert.equal(isDue(t, new Date('2026-08-05T00:00:00+08:00').getTime()), false);
});

test('Scheduling - hasReplacementForExpiry: no other items in slot -> blocked', () => {
  assert.equal(hasReplacementForExpiry([]), false);
  assert.equal(hasReplacementForExpiry(undefined), false);
});

test('Scheduling - hasReplacementForExpiry: only archived/rejected others -> blocked', () => {
  assert.equal(hasReplacementForExpiry(['archived', 'rejected', 'archived']), false);
});

test('Scheduling - hasReplacementForExpiry: an approved sibling -> allowed', () => {
  assert.equal(hasReplacementForExpiry(['archived', 'approved']), true);
});

test('Scheduling - hasReplacementForExpiry: a pending or scheduled sibling also counts -> allowed', () => {
  assert.equal(hasReplacementForExpiry(['pending']), true);
  assert.equal(hasReplacementForExpiry(['scheduled']), true);
});

test('Scheduling - klLocalToIso appends Malaysia +08:00 offset', () => {
  assert.equal(klLocalToIso('2026-08-05T09:00'), '2026-08-05T09:00:00+08:00');
  assert.equal(klLocalToIso(''), null);
  assert.equal(klLocalToIso(null), null);
});

test('Scheduling - isoToKlLocalInput round-trips a KL-offset ISO string', () => {
  assert.equal(isoToKlLocalInput('2026-08-05T09:00:00+08:00'), '2026-08-05T09:00');
  assert.equal(isoToKlLocalInput(null), '');
});

test('Scheduling - formatKlDisplay produces a non-empty Malay-locale string', () => {
  const label = formatKlDisplay('2026-08-05T09:00:00+08:00');
  assert.ok(label.length > 0);
  assert.equal(formatKlDisplay(null), '');
});
