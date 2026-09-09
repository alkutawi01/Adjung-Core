// Regression: Tarikh Sumber wajib diisi untuk kandungan bersumber LUAR.
//
// Dapatan Izzat 2026-09-04 — kandungan diterbitkan dengan sumber luar (bukan "Adjung Editorial")
// tanpa Tarikh Sumber, tak disekat langsung: validateTarikhSumber() sebelum ni benarkan medan
// kosong TANPA MENGIRA sumber ("medan kosong kekal dibenarkan" — komen asal 2026-08-19 tu cuma
// betulkan FORMAT, tak pernah kuatkuasakan kehadiran). Pembaca perlu tahu bila fakta sumber luar
// itu asalnya diterbitkan untuk nilai berita sebenar. Kandungan ASLI Adjung sendiri (sumber
// "Adjung Editorial"/"Editorial Adjung") dikecualikan — tiada "sumber luar" untuk dicatat
// tarikhnya. Ujian ni kunci gerbang wajib supaya tak terlepas/turun senyap lagi.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTarikhSumber, sumberAdjungSendiri } from '../core/editorial/ContentBudget.js';

test('validateTarikhSumber — kosong DITOLAK bila sumber ialah luar (bukan Adjung sendiri)', () => {
  const hasil = validateTarikhSumber('', 'Dar al-Ifta Mesir');
  assert.equal(hasil.isValid, false, 'sumber luar tanpa Tarikh Sumber mesti ditolak');
});

test('validateTarikhSumber — undefined DITOLAK bila sumber ialah luar', () => {
  const hasil = validateTarikhSumber(undefined, 'BBC');
  assert.equal(hasil.isValid, false, 'medan tak diisi langsung + sumber luar mesti ditolak');
});

test('validateTarikhSumber — kosong DIBENARKAN bila sumber "Adjung Editorial"', () => {
  const hasil1 = validateTarikhSumber('', 'Adjung Editorial');
  const hasil2 = validateTarikhSumber('', 'Editorial Adjung');
  assert.equal(hasil1.isValid, true, 'sumber sendiri "Adjung Editorial" tak perlu Tarikh Sumber');
  assert.equal(hasil2.isValid, true, 'sumber sendiri "Editorial Adjung" (susunan lain) tak perlu Tarikh Sumber');
});

test('validateTarikhSumber — padanan sumber sendiri tak sensitif huruf besar/kecil + ruang', () => {
  const hasil = validateTarikhSumber('', '  adjung editorial  ');
  assert.equal(hasil.isValid, true, 'padanan mesti toleran huruf besar/kecil dan ruang lebih');
});

test('validateTarikhSumber — format sah (YYYY-MM-DD) tetap lulus untuk sumber luar', () => {
  const hasil = validateTarikhSumber('2026-08-17', 'Dar al-Ifta Mesir');
  assert.equal(hasil.isValid, true, 'format ISO sah patut lulus');
});

test('validateTarikhSumber — format tak sah tetap ditolak (tak berubah drpd sebelum ni)', () => {
  const hasil = validateTarikhSumber('17/8/2026', 'BBC');
  assert.equal(hasil.isValid, false, 'format bukan ISO patut ditolak');
});

test('validateTarikhSumber — bulan/hari mustahil ditolak walau bentuk regex \\d{2}-\\d{2} lulus (2026-09-09, bug-hunt)', () => {
  // "2026-13-45" lulus regex /^\d{4}-\d{2}-\d{2}$/ asal (cuma semak bentuk digit, bukan
  // kalendar sebenar) — new Date('2026-13-45') pulangkan Invalid Date, yang kemudiannya
  // bocorkan rentetan MENTAH terus kepada pembaca di getDisplayDate()/formatTarikhSumberPanjang()
  // (FrontpageView.tsx) sebab kedua-dua fungsi tu jatuh balik ke `raw` bila Date tak sah.
  const bulanMustahil = validateTarikhSumber('2026-13-45', 'BBC');
  assert.equal(bulanMustahil.isValid, false, 'bulan 13 mustahil, mesti ditolak');
});

test('validateTarikhSumber — hari tak wujud utk bulan tu ditolak, bukan dianjak senyap (2026-09-09, bug-hunt)', () => {
  // "2026-02-30" (Februari tiada 30 hari) lulus regex bentuk asal DAN new Date() anjak SENYAP
  // ke 2 Mac 2026 tanpa sebarang ralat — tarikh sumber SALAH terpapar kepada pembaca sebagai
  // tarikh yang kelihatan sah.
  const hariTakWujud = validateTarikhSumber('2026-02-30', 'BBC');
  assert.equal(hariTakWujud.isValid, false, '30 Februari tidak wujud, mesti ditolak');
});

test('validateTarikhSumber — 29 Februari tahun lompat diterima, tahun biasa ditolak', () => {
  assert.equal(validateTarikhSumber('2024-02-29', 'BBC').isValid, true, '2024 tahun lompat, 29 Feb sah');
  assert.equal(validateTarikhSumber('2026-02-29', 'BBC').isValid, false, '2026 bukan tahun lompat, 29 Feb tak wujud');
});

test('sumberAdjungSendiri — cermin FrontpageView.tsx (padanan tepat dua sentinel sahaja)', () => {
  assert.equal(sumberAdjungSendiri('Adjung Editorial'), true);
  assert.equal(sumberAdjungSendiri('Editorial Adjung'), true);
  assert.equal(sumberAdjungSendiri('Bernama'), false);
  assert.equal(sumberAdjungSendiri(''), false);
  assert.equal(sumberAdjungSendiri(undefined), false);
});
