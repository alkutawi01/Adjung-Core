import test from 'node:test';
import assert from 'node:assert/strict';
import { statusLuputCutiSekolah, AMBANG_AMARAN_HARI } from '../core/utils/kitaranCutiSekolah.js';

// Cuti sekolah datang daripada senarai berkod keras (SCHOOL_HOLIDAYS_LALAI) atau suntingan
// manual — BUKAN daripada API cuti (API itu cuti umum sahaja). Bila tarikh terakhir berlalu,
// Jam Dunia berhenti memapar cuti sekolah SECARA SENYAP. Ujian ni menjaga amaran yang menutup
// kegagalan senyap tu, termasuk cabang yang mustahil dilihat pada skrin hari ni (data semasa
// masih ~185 hari daripada tamat, jadi cabang "hampir"/"sudah" tamat tak akan render lagi).

const senarai = (...tarikhAkhir) => tarikhAkhir.map((end) => ({ start: '2026-01-01', end, group: 'A', name: 'Cuti' }));

test('cuti sekolah - senarai masih jauh daripada tamat tidak memberi amaran', () => {
  const hasil = statusLuputCutiSekolah(senarai('2027-02-14'), '2026-08-13');
  assert.equal(hasil, null);
});

test('cuti sekolah - amaran muncul tepat pada ambang, bukan sehari lebih awal', () => {
  // Ambang 120 hari: 2026-10-17 -> 2027-02-14 ialah 120 hari.
  const padaAmbang = statusLuputCutiSekolah(senarai('2027-02-14'), '2026-10-17');
  assert.ok(padaAmbang, 'sepatutnya beri amaran tepat pada ambang');
  assert.equal(padaAmbang.tamat, false);
  assert.equal(padaAmbang.bezaHari, AMBANG_AMARAN_HARI);

  const sehariLebihAwal = statusLuputCutiSekolah(senarai('2027-02-14'), '2026-10-16');
  assert.equal(sehariLebihAwal, null, 'sehari sebelum ambang belum perlu amaran');
});

test('cuti sekolah - senarai yang sudah tamat ditanda tamat, bukan sekadar amaran', () => {
  const hasil = statusLuputCutiSekolah(senarai('2027-02-14'), '2027-02-15');
  assert.ok(hasil);
  assert.equal(hasil.tamat, true);
  assert.equal(hasil.bezaHari, -1);
  assert.equal(hasil.tarikhAkhir, '2027-02-14');
});

test('cuti sekolah - hari TERAKHIR masih dikira belum tamat', () => {
  const hasil = statusLuputCutiSekolah(senarai('2027-02-14'), '2027-02-14');
  assert.ok(hasil);
  assert.equal(hasil.tamat, false, 'pada hari terakhir cuti masih sah, belum tamat');
  assert.equal(hasil.bezaHari, 0);
});

test('cuti sekolah - guna tarikh tamat PALING LEWAT, bukan yang terakhir dalam susunan array', () => {
  // Susunan array sengaja tidak mengikut kronologi.
  const hasil = statusLuputCutiSekolah(senarai('2027-02-14', '2026-09-19', '2027-01-02'), '2027-02-15');
  assert.ok(hasil);
  assert.equal(hasil.tarikhAkhir, '2027-02-14');
});

test('cuti sekolah - input kosong/tak sah dikendalikan tanpa ranap', () => {
  assert.equal(statusLuputCutiSekolah([], '2026-08-13'), null);
  assert.equal(statusLuputCutiSekolah(null, '2026-08-13'), null);
  assert.equal(statusLuputCutiSekolah(undefined, '2026-08-13'), null);
  assert.equal(statusLuputCutiSekolah(senarai('2027-02-14'), 'bukan-tarikh'), null);
  assert.equal(statusLuputCutiSekolah([{ end: '' }, { end: '   ' }], '2026-08-13'), null);
  assert.equal(statusLuputCutiSekolah([{ end: '14/02/2027' }], '2026-08-13'), null, 'format bukan ISO diabaikan');
  assert.equal(statusLuputCutiSekolah([{}, { end: null }], '2026-08-13'), null);
});
