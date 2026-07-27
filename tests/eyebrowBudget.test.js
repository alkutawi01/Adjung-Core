import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBidangTopik } from '../core/editorial/ContentBudget.js';
import { MAX_EYEBROW_CHARS_BY_TIER, eyebrowLabel, eyebrowCeilingForSlot, TIER_SLOTS } from '../core/editorial/GeometryConfig.js';

// Had eyebrow wujud sebab bajet tajuk+huraian diukur dengan andaian eyebrow SATU baris.
// Eyebrow yang membalut menolak tajuk+huraian ke bawah 1:1 tanpa kad membesar — kerosakan
// senyap. Ujian ni menjaga peraturan tu daripada reput.

const ok = (r) => assert.equal(r.isValid, true, r.reason);
const ditolak = (r) => assert.equal(r.isValid, false, 'sepatutnya ditolak tapi lulus');

test('Eyebrow - Topik panjang ditolak pada tier sempit (MENEGAK, had 36)', () => {
  const r = validateBidangTopik({
    slotBidang: 'Sastera', itemBidang: 'Sastera',
    topik: 'Kesusasteraan Melayu Moden Nusantara', // label = 45 aksara
    requireTopik: true, slotIndex: 12,
  });
  ditolak(r);
  assert.match(r.reason, /melebihi ruang eyebrow/);
});

test('Eyebrow - Topik pendek lulus pada tier yang sama', () => {
  ok(validateBidangTopik({
    slotBidang: 'Sastera', itemBidang: 'Sastera', topik: 'Puisi',
    requireTopik: true, slotIndex: 12,
  }));
});

test('Eyebrow - label tepat pada had diterima, satu aksara lebih ditolak', () => {
  const slot = 12; // MENEGAK
  const had = eyebrowCeilingForSlot(slot);
  const bidang = 'Sastera';
  const bakiTepat = had - bidang.length - 3; // 3 = ' | '

  ok(validateBidangTopik({
    slotBidang: bidang, itemBidang: bidang, topik: 'T'.repeat(bakiTepat),
    requireTopik: true, slotIndex: slot,
  }));
  ditolak(validateBidangTopik({
    slotBidang: bidang, itemBidang: bidang, topik: 'T'.repeat(bakiTepat + 1),
    requireTopik: true, slotIndex: slot,
  }));
});

test('Eyebrow - setiap slot dalam satu tier dapat had yang SAMA', () => {
  // Peraturan projek paling kerap dilanggar: pembetulan mesti di peringkat tier, bukan per-slot.
  Object.entries(TIER_SLOTS).forEach(([tier, slots]) => {
    const hads = slots.map(s => eyebrowCeilingForSlot(s));
    assert.equal(new Set(hads).size, 1, `Tier ${tier} ada had berbeza antara slotnya: ${hads}`);
    assert.equal(hads[0], MAX_EYEBROW_CHARS_BY_TIER[tier], `Tier ${tier} tidak padan dengan jadual had`);
  });
});

test('Eyebrow - format label sama seperti yang dirender kad', () => {
  assert.equal(eyebrowLabel('Ekonomi', 'Kewangan Islam'), 'Ekonomi | Kewangan Islam');
  assert.equal(eyebrowLabel('Ekonomi', ''), 'Ekonomi');       // kandungan lama tanpa Topik
  assert.equal(eyebrowLabel('', 'Kewangan Islam'), 'Kewangan Islam');
  assert.equal(eyebrowLabel('  Ekonomi  ', '  Puisi  '), 'Ekonomi | Puisi');
});

test('Eyebrow - tanpa slotIndex, semakan panjang dilangkau (tak pecahkan pemanggil lama)', () => {
  ok(validateBidangTopik({
    slotBidang: 'Sastera', itemBidang: 'Sastera',
    topik: 'T'.repeat(500), requireTopik: true,
  }));
});

test('Eyebrow - semakan panjang tidak menggantikan semakan Bidang/Topik sedia ada', () => {
  const salahBidang = validateBidangTopik({
    slotBidang: 'Sastera', itemBidang: 'Ekonomi', topik: 'Puisi',
    requireTopik: true, slotIndex: 12,
  });
  ditolak(salahBidang);
  assert.match(salahBidang.reason, /tidak sepadan dengan bidang slot/);

  const tiadaTopik = validateBidangTopik({
    slotBidang: 'Sastera', itemBidang: 'Sastera', topik: '',
    requireTopik: true, slotIndex: 12,
  });
  ditolak(tiadaTopik);
  assert.match(tiadaTopik.reason, /Topik diperlukan/);
});
