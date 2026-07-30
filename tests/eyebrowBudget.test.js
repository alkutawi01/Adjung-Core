import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBidangTopik } from '../core/editorial/ContentBudget.js';
import {
  MAX_EYEBROW_CHARS_BY_TIER, MAX_EYEBROW_TOPIK_CHARS_BY_TIER, FOCUS_VIEW_EYEBROW_MAX_CHARS,
  eyebrowLabel, eyebrowCeilingForSlot, topikCeilingForSlot, TIER_SLOTS,
} from '../core/editorial/GeometryConfig.js';

// Had eyebrow wujud sebab bajet tajuk+huraian diukur dengan andaian eyebrow SATU baris.
// Eyebrow yang membalut menolak tajuk+huraian ke bawah 1:1 tanpa kad membesar — kerosakan
// senyap. Ujian ni menjaga peraturan tu daripada reput.
//
// DUA laluan render, DUA had: kad papar IKON Bidang + Topik (laluan biasa, Topik wujud) ATAU
// nama Bidang sebagai teks (laluan lama, Topik kosong). Lihat nota di ContentBudget.js dan
// MAX_EYEBROW_TOPIK_CHARS_BY_TIER di GeometryConfig.js.

const ok = (r) => assert.equal(r.isValid, true, r.reason);
const ditolak = (r) => assert.equal(r.isValid, false, 'sepatutnya ditolak tapi lulus');

test('Eyebrow ikon - Topik panjang ditolak pada tier sempit (MENEGAK, had Topik 34)', () => {
  const r = validateBidangTopik({
    slotBidang: 'Sastera', itemBidang: 'Sastera',
    topik: 'T'.repeat(topikCeilingForSlot(12) + 1),
    requireTopik: true, slotIndex: 12,
  });
  ditolak(r);
  assert.match(r.reason, /melebihi ruang eyebrow/);
});

test('Eyebrow ikon - Topik pendek lulus pada tier yang sama', () => {
  ok(validateBidangTopik({
    slotBidang: 'Sastera', itemBidang: 'Sastera', topik: 'Puisi',
    requireTopik: true, slotIndex: 12,
  }));
});

test('Eyebrow ikon - Topik tepat pada had diterima, satu aksara lebih ditolak', () => {
  const slot = 12; // MENEGAK
  const had = topikCeilingForSlot(slot);

  ok(validateBidangTopik({
    slotBidang: 'Sastera', itemBidang: 'Sastera', topik: 'T'.repeat(had),
    requireTopik: true, slotIndex: slot,
  }));
  ditolak(validateBidangTopik({
    slotBidang: 'Sastera', itemBidang: 'Sastera', topik: 'T'.repeat(had + 1),
    requireTopik: true, slotIndex: slot,
  }));
});

test('Eyebrow ikon - nama Bidang panjang TIDAK lagi menyempitkan had Topik (bug 2026-07-28)', () => {
  // Sebelum dibetulkan: pengesahan menyemak label GABUNGAN "Bidang | Topik", jadi Bidang panjang
  // memakan sebahagian besar had tier, meninggalkan sedikit ruang untuk Topik. Kad sebenar papar
  // IKON Bidang (bukan nama), jadi had Topik KAD sepatutnya sama tak kira panjang nama Bidang.
  //
  // Bidang dibina supaya label gabungan (Bidang + ' | ' + Topik pada had penuh) tepat-tepat masih
  // muat ruang Focus View (had BERASINGAN, lihat ujian "Eyebrow Focus View" di bawah) — supaya
  // ujian ni semata-mata menguji had kad, tak tersadung had lain.
  const slot = 12; // MENEGAK
  const hadTopikKad = topikCeilingForSlot(slot);
  const bidangPanjang = 'B'.repeat(Math.max(0, FOCUS_VIEW_EYEBROW_MAX_CHARS - hadTopikKad - 3));

  ok(validateBidangTopik({
    slotBidang: bidangPanjang, itemBidang: bidangPanjang, topik: 'T'.repeat(hadTopikKad),
    requireTopik: true, slotIndex: slot,
  }));
});

test('Eyebrow Focus View - label gabungan yang lulus had kad tetap ditolak jika melimpah ruang Focus View', () => {
  // Focus View SENTIASA papar label PENUH (tiada ikon), lebar lajur TETAP tak kira tier — had
  // berasingan daripada had Topik kad. STANDARD (had Topik kad = 59) lapang untuk Topik pendek
  // ni sendirian, tapi Bidang panjang + Topik boleh tetap melebihi ruang Focus View (49 aksara).
  const slot = 2; // STANDARD
  const topik = 'Sejarah';
  const bidangPanjang = 'B'.repeat(FOCUS_VIEW_EYEBROW_MAX_CHARS - topik.length - 3 + 1); // 1 lebih drpd had gabungan

  const r = validateBidangTopik({
    slotBidang: bidangPanjang, itemBidang: bidangPanjang, topik,
    requireTopik: true, slotIndex: slot,
  });
  ditolak(r);
  assert.match(r.reason, /Focus View/);
});

test('Eyebrow ikon - setiap slot dalam satu tier dapat had Topik yang SAMA', () => {
  // Peraturan projek paling kerap dilanggar: pembetulan mesti di peringkat tier, bukan per-slot.
  Object.entries(TIER_SLOTS).forEach(([tier, slots]) => {
    const hads = slots.map(s => topikCeilingForSlot(s));
    assert.equal(new Set(hads).size, 1, `Tier ${tier} ada had Topik berbeza antara slotnya: ${hads}`);
    assert.equal(hads[0], MAX_EYEBROW_TOPIK_CHARS_BY_TIER[tier], `Tier ${tier} tidak padan dengan jadual had Topik`);
  });
});

test('Eyebrow teks (fallback) - Topik kosong: had jatuh balik kepada nama Bidang sahaja', () => {
  // Tiada Topik = tiada ikon (lihat EyebrowKad) = kad papar nama Bidang sebagai teks. Laluan ni
  // cuma berlaku untuk kandungan lama (requireTopik=false); kandungan baharu wajib ada Topik.
  const slot = 12; // MENEGAK, eyebrowCeilingForSlot = 36
  const had = eyebrowCeilingForSlot(slot);

  ok(validateBidangTopik({
    slotBidang: 'B'.repeat(had), itemBidang: 'B'.repeat(had), topik: '',
    requireTopik: false, slotIndex: slot,
  }));
  const r = validateBidangTopik({
    slotBidang: 'B'.repeat(had + 1), itemBidang: 'B'.repeat(had + 1), topik: '',
    requireTopik: false, slotIndex: slot,
  });
  ditolak(r);
  assert.match(r.reason, /Nama Bidang/);
});

test('Eyebrow - format label sama seperti yang dirender kad (Focus View, fallback teks)', () => {
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
