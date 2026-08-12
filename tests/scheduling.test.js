import test from 'node:test';
import assert from 'node:assert/strict';
import { isDue, hasReplacementForExpiry, klLocalToIso, isoToKlLocalInput, formatKlDisplay, resolveEffectiveStatus } from '../core/editorial/Scheduling.js';

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

// Regresi zon waktu (simulasi UX #29, 2026-08-12) — jadual terbit/luput tersangkut dan hanya
// menyala kira-kira 8 JAM lewat. Puncanya BUKAN isDue(), tetapi penapisan masa yang dahulu
// dibuat sebagai perbandingan RENTETAN dalam SQL:
//
//   WHERE er.scheduledPublishAt <= ?      -- parameter = new Date().toISOString(), UTC 'Z'
//
// klLocalToIso() menulis nilai sebagai waktu tempatan KL berserta ofset ('...T15:09:00+08:00'),
// manakala parameternya UTC ('...T07:11:40.713Z'). SQLite membanding TEKS aksara demi aksara,
// jadi '15:09' tidak pernah dikira <= '07:11' walaupun detik itu SUDAH berlalu.
//
// Ujian ini mengunci dua perkara: (a) isDue() menilai ofset dengan betul, dan (b) perbandingan
// rentetan mentah memang salah — supaya sesiapa yang tergoda "mengoptimumkan" penapisan itu
// kembali ke dalam SQL akan nampak sebabnya gagal.
test('Scheduling - jadual berofset +08:00 yang sudah matang dikira due (regresi #29)', () => {
  // 15:09 waktu KL = 07:09 UTC. Jam sekarang 07:11 UTC, jadi ia SUDAH matang 2 minit lalu.
  const jadualKl = '2026-08-12T15:09:00+08:00';
  const nowMs = new Date('2026-08-12T07:11:40.713Z').getTime();
  assert.equal(isDue(jadualKl, nowMs), true);
});

test('Scheduling - perbandingan rentetan mentah gagal untuk ofset KL (sebab #29 berlaku)', () => {
  const jadualKl = '2026-08-12T15:09:00+08:00';
  const nowIso = '2026-08-12T07:11:40.713Z';
  // Inilah kelakuan lama: rentetan kata "belum sampai" sedangkan masanya sudah berlalu.
  assert.equal(jadualKl <= nowIso, false);
  // Perbandingan sebagai DETIK MASA pula betul — jurang inilah puncanya.
  assert.equal(new Date(jadualKl) <= new Date(nowIso), true);
});

test('Scheduling - jadual berofset +08:00 yang belum matang tidak dikira due', () => {
  const jadualKl = '2026-08-12T15:09:00+08:00'; // = 07:09 UTC
  const nowMs = new Date('2026-08-12T07:00:00.000Z').getTime(); // 9 minit sebelum
  assert.equal(isDue(jadualKl, nowMs), false);
});

test('Scheduling - klLocalToIso menghasilkan nilai yang isDue() boleh nilai dengan betul', () => {
  // Ikat helper penulis kepada helper pembaca: apa yang ditulis mesti boleh dinilai semula.
  const ditulis = klLocalToIso('2026-08-12T15:09');
  const sudahLalu = new Date('2026-08-12T07:30:00.000Z').getTime(); // 07:09 UTC sudah berlalu
  const belumSampai = new Date('2026-08-12T06:30:00.000Z').getTime();
  assert.equal(isDue(ditulis, sudahLalu), true);
  assert.equal(isDue(ditulis, belumSampai), false);
});

// Regresi status jadual (simulasi UX #36.2, 2026-08-12) — batal jadual (kosongkan
// scheduledPublishAt tanpa hantar status eksplisit) meninggalkan rekod anak yatim
// status='scheduled' selama-lamanya, kandungan hilang drpd pembaca tanpa amaran. Tiga
// senario dikunci di sini supaya sesiapa yang sentuh semula resolveEffectiveStatus() nampak
// terus kalau simetri SET/BATAL terlanggar.
test('Scheduling - resolveEffectiveStatus: tetapkan jadual (approved -> scheduled)', () => {
  const hasil = resolveEffectiveStatus({
    scheduledPublishAt: '2026-08-12T20:00:00+08:00',
    status: undefined,
    currentStatus: 'approved',
  });
  assert.equal(hasil, 'scheduled');
});

test('Scheduling - resolveEffectiveStatus: batal jadual (scheduled -> approved, bukan anak yatim)', () => {
  const hasil = resolveEffectiveStatus({
    scheduledPublishAt: null,
    status: undefined,
    currentStatus: 'scheduled',
  });
  assert.equal(hasil, 'approved');
});

test('Scheduling - resolveEffectiveStatus: status eksplisit sentiasa dihormati, tak diganggu logik automatik', () => {
  const hasil = resolveEffectiveStatus({
    scheduledPublishAt: null,
    status: 'pending',
    currentStatus: 'scheduled',
  });
  assert.equal(hasil, 'pending');
});
