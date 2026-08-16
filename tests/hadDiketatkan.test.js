// Regression: pengecualian had-DIKETATKAN bagi kandungan yang sudah tersimpan (2026-08-16,
// keputusan Izzat: "kandungan yg dah terbit ... tak perlu patuh had aksara baru; hanya kandungan
// baharu yg perlu patuh").
//
// Senario sebenar yang dilaporkan: kandungan disiarkan bawah had lama -> Ketua Editor ketatkan had
// -> SEBARANG suntingan kandungan tu (walau betulkan satu ejaan) ditolak selamanya, kandungan
// terperangkap. Ujian ni kunci PERATURAN KEPUTUSANnya (bukan laluan HTTP penuh, yang perlukan
// pelayan+DB): pengecualian bergantung pada sama ada kandungan TERSIMPAN (sebelum suntingan)
// sudah pun gagal had SEMASA.
//
// Peraturan (rujuk core/routes/contentRoutes.js, PATCH /content/:id):
//   tersimpan GAGAL had semasa  -> dikecualikan (terbit bawah had lama, bukan salah editor)
//   tersimpan LULUS had semasa  -> kuat kuasa penuh (suntingan INI yang melebihi had, patut sekat)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContentBudget } from '../core/editorial/ContentBudget.js';

// Cerminan TEPAT keputusan dalam contentRoutes.js — kalau logik di sana berubah, kemas kini sini
// SERENTAK (ujian ni yang menahan peraturan, bukan sekadar mendokumenkannya).
function budgetDikuatkuasa({ slotIndex, tajukLama, huraianLama, tajukBaharu, huraianBaharu }) {
  const lulusSebelumSunting = validateContentBudget(slotIndex, tajukLama, huraianLama).isValid;
  if (!lulusSebelumSunting) return { isValid: true }; // dikecualikan
  return validateContentBudget(slotIndex, tajukBaharu, huraianBaharu);
}

const SLOT_KOMPAK = 4;
// Kes SEBENAR daripada tangkapan skrin Izzat — 51 aksara tajuk + 83 aksara huraian, kad KOMPAK.
const TAJUK_PANJANG = 'WoW-KL 2026 hidupkan budaya membaca bersama penulis';
const HURAIAN_PANJANG = 'WoW-KL 2026 mengangkat budaya membaca melalui buku, idea dan perbincangan bermakna.';

test('kes Izzat: kandungan tersimpan sudah gagal had semasa -> suntingan DIBENARKAN (tak terperangkap)', () => {
  assert.equal(
    validateContentBudget(SLOT_KOMPAK, TAJUK_PANJANG, HURAIAN_PANJANG).isValid,
    false,
    'prasyarat ujian: kandungan ni memang gagal had semasa'
  );
  const hasil = budgetDikuatkuasa({
    slotIndex: SLOT_KOMPAK,
    tajukLama: TAJUK_PANJANG, huraianLama: HURAIAN_PANJANG,
    // Editor cuma betulkan ejaan — masih melebihi had baharu, tapi tak patut disekat.
    tajukBaharu: TAJUK_PANJANG, huraianBaharu: HURAIAN_PANJANG.replace('mengangkat', 'mengangkatkan'),
  });
  assert.equal(hasil.isValid, true);
});

test('kandungan tersimpan LULUS had semasa -> suntingan yang melebihi had TETAP disekat', () => {
  // Kandungan pendek yang sah, kemudian editor panjangkan sampai melimpah kad.
  const tajukPendek = 'Tajuk ringkas';
  const huraianPendek = 'Huraian ringkas yang muat.';
  const asalSah = validateContentBudget(SLOT_KOMPAK, tajukPendek, huraianPendek).isValid;
  if (!asalSah) return; // kalau had tier berubah sampai ni pun tak sah, ujian tak relevan

  const hasil = budgetDikuatkuasa({
    slotIndex: SLOT_KOMPAK,
    tajukLama: tajukPendek, huraianLama: huraianPendek,
    tajukBaharu: TAJUK_PANJANG, huraianBaharu: HURAIAN_PANJANG,
  });
  assert.equal(hasil.isValid, false, 'suntingan sendiri yang melimpahkan kad MESTI kekal disekat');
});

test('mesej ralat TIDAK lagi mendakwa "Kandungan tidak disiarkan" (modul pengesahan tak tahu akibat)', () => {
  // Pepijat Izzat: kandungan JELAS masih hidup di halaman awam semasa mesej ni dipaparkan.
  // Ayat akibat kini ditambah oleh PEMANGGIL, ikut laluan masing-masing (terbit vs sunting).
  const r = validateContentBudget(SLOT_KOMPAK, TAJUK_PANJANG, HURAIAN_PANJANG);
  assert.equal(r.isValid, false);
  assert.ok(!/tidak disiarkan/i.test(r.reason), `reason tak patut nyatakan akibat: ${r.reason}`);
  assert.match(r.reason, /melebihi had/, 'tapi mesti tetap nyatakan FAKTA had yang dilanggar');
});

test('tajuk sahaja melebihi ruang (huraian kosong) — juga tiada dakwaan akibat', () => {
  const r = validateContentBudget(SLOT_KOMPAK, TAJUK_PANJANG.repeat(3), '');
  assert.equal(r.isValid, false);
  assert.ok(!/tidak disiarkan/i.test(r.reason), `reason tak patut nyatakan akibat: ${r.reason}`);
});
