import test from 'node:test';
import assert from 'node:assert/strict';
import { sponsorAktifPadaMasa, penajaLayakUntukSlot } from '../core/editorial/PenajaEligibility.js';

// Penaja BAHARU (julat ISO 8601 penuh) — layak HANYA dalam julat mula/tamat, logo mesti hilang
// TEPAT bila tamat berlalu (keperluan Izzat 2026-08-16 #4).
test('sponsorAktifPadaMasa: julat ISO — aktif dalam julat', () => {
  const sponsor = { mulaTajaan: '2026-08-01T00:00:00+08:00', tamatTajaan: '2026-08-08T00:00:00+08:00' };
  assert.equal(sponsorAktifPadaMasa(sponsor, new Date('2026-08-05T12:00:00+08:00'), '2026-08'), true);
});

test('sponsorAktifPadaMasa: julat ISO — tidak aktif sebelum mula', () => {
  const sponsor = { mulaTajaan: '2026-08-01T00:00:00+08:00', tamatTajaan: '2026-08-08T00:00:00+08:00' };
  assert.equal(sponsorAktifPadaMasa(sponsor, new Date('2026-07-31T23:59:59+08:00'), '2026-08'), false);
});

test('sponsorAktifPadaMasa: julat ISO — tidak aktif tepat selepas tamat', () => {
  const sponsor = { mulaTajaan: '2026-08-01T00:00:00+08:00', tamatTajaan: '2026-08-08T00:00:00+08:00' };
  assert.equal(sponsorAktifPadaMasa(sponsor, new Date('2026-08-08T00:00:01+08:00'), '2026-08'), false);
});

test('sponsorAktifPadaMasa: julat ISO — sempadan inklusif (tepat pada mula/tamat)', () => {
  const sponsor = { mulaTajaan: '2026-08-01T00:00:00+08:00', tamatTajaan: '2026-08-08T00:00:00+08:00' };
  assert.equal(sponsorAktifPadaMasa(sponsor, new Date('2026-08-01T00:00:00+08:00'), '2026-08'), true);
  assert.equal(sponsorAktifPadaMasa(sponsor, new Date('2026-08-08T00:00:00+08:00'), '2026-08'), true);
});

// Penaja LAMA (bulanan, tiada julat ISO) — mesti jatuh balik ke padanan `bulan`, backward-compat.
test('sponsorAktifPadaMasa: jatuh balik ke `bulan` bila tiada julat ISO', () => {
  assert.equal(sponsorAktifPadaMasa({ bulan: '2026-08' }, new Date('2026-08-15T00:00:00+08:00'), '2026-08'), true);
  assert.equal(sponsorAktifPadaMasa({ bulan: '2026-07' }, new Date('2026-08-15T00:00:00+08:00'), '2026-08'), false);
});

test('sponsorAktifPadaMasa: separuh julat (hanya satu daripada mula/tamat diisi) jatuh balik `bulan`', () => {
  const sponsor = { mulaTajaan: '2026-08-01T00:00:00+08:00', bulan: '2026-08' };
  assert.equal(sponsorAktifPadaMasa(sponsor, new Date('2026-08-15T00:00:00+08:00'), '2026-08'), true);
});

test('sponsorAktifPadaMasa: tarikh tidak sah dianggap tidak aktif, tidak crash', () => {
  const sponsor = { mulaTajaan: 'bukan-tarikh', tamatTajaan: '2026-08-08T00:00:00+08:00' };
  assert.equal(sponsorAktifPadaMasa(sponsor, new Date(), '2026-08'), false);
});

test('sponsorAktifPadaMasa: sponsor null/undefined selamat', () => {
  assert.equal(sponsorAktifPadaMasa(null, new Date(), '2026-08'), false);
  assert.equal(sponsorAktifPadaMasa(undefined, new Date(), '2026-08'), false);
});

// Skop slot — senarai kosong/tiada = portal keseluruhan (kelakuan asal, semua slot layak).
test('penajaLayakUntukSlot: skop kosong = portal keseluruhan, layak untuk sebarang slot', () => {
  assert.equal(penajaLayakUntukSlot({ slotIndexes: [] }, 5), true);
  assert.equal(penajaLayakUntukSlot({}, 5), true);
  assert.equal(penajaLayakUntukSlot({ slotIndexes: [] }, 0), true);
});

test('penajaLayakUntukSlot: skop tidak kosong — layak hanya untuk slot disenaraikan', () => {
  const sponsor = { slotIndexes: [0, 5, 12] };
  assert.equal(penajaLayakUntukSlot(sponsor, 5), true);
  assert.equal(penajaLayakUntukSlot(sponsor, 6), false);
});

test('penajaLayakUntukSlot: terima slotIndex sebagai rentetan (data-slot DOM)', () => {
  const sponsor = { slotIndexes: [0, 5, 12] };
  assert.equal(penajaLayakUntukSlot(sponsor, '5'), true);
  assert.equal(penajaLayakUntukSlot(sponsor, '6'), false);
});

test('penajaLayakUntukSlot: skop tidak kosong — slotIndex tiada/null tidak layak', () => {
  const sponsor = { slotIndexes: [0, 5] };
  assert.equal(penajaLayakUntukSlot(sponsor, undefined), false);
  assert.equal(penajaLayakUntukSlot(sponsor, null), false);
  assert.equal(penajaLayakUntukSlot(sponsor, ''), false);
});
