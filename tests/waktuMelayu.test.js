import test from 'node:test';
import assert from 'node:assert/strict';
import { istilahWaktu, jam12, masaMelayu, masa24, JULAT_WAKTU } from '../core/worldclock/WaktuMelayu.js';

// Julat waktu ini datang daripada poster rasmi DBP yang dirujuk pemilik projek. Ia MUDAH
// tersilap ditulis (TENGAH MALAM hanya SATU jam; TENGAH HARI menjangkau DUA jam), jadi setiap
// sempadan diuji secara eksplisit — bukan sekadar satu contoh per istilah.

test('sempadan setiap julat waktu tepat seperti poster DBP', () => {
  // TENGAH MALAM: 00:00 – 00:59 SAHAJA
  assert.equal(istilahWaktu(0), 'TENGAH MALAM');
  // PAGI: 01:00 – 11:59 (01:00 sudah PAGI, bukan lagi tengah malam)
  assert.equal(istilahWaktu(1), 'PAGI');
  assert.equal(istilahWaktu(11), 'PAGI');
  // TENGAH HARI: 12:00 – 13:59 (DUA jam penuh, bukan pukul 12 sahaja)
  assert.equal(istilahWaktu(12), 'TENGAH HARI');
  assert.equal(istilahWaktu(13), 'TENGAH HARI');
  // PETANG: 14:00 – 18:59
  assert.equal(istilahWaktu(14), 'PETANG');
  assert.equal(istilahWaktu(18), 'PETANG');
  // MALAM: 19:00 – 23:59
  assert.equal(istilahWaktu(19), 'MALAM');
  assert.equal(istilahWaktu(23), 'MALAM');
});

test('setiap jam 0-23 ada tepat SATU istilah (tiada lompang, tiada bertindih)', () => {
  for (let j = 0; j <= 23; j++) {
    const padanan = JULAT_WAKTU.filter(w => j >= w.dari && j <= w.hingga);
    assert.equal(padanan.length, 1, `jam ${j} sepatutnya padan tepat satu julat, dapat ${padanan.length}`);
    assert.ok(istilahWaktu(j), `jam ${j} tiada istilah`);
  }
});

test('angka 12 jam: 0 dan 12 kedua-duanya dipapar sebagai 12', () => {
  assert.equal(jam12(0), '12');
  assert.equal(jam12(12), '12');
  assert.equal(jam12(13), '1');
  assert.equal(jam12(23), '11');
  assert.equal(jam12(9), '9');
});

test('masaMelayu: angka 12 jam + istilah waktu', () => {
  assert.equal(masaMelayu(17, 12), '5:12 PETANG');
  assert.equal(masaMelayu(9, 5), '9:05 PAGI');
  assert.equal(masaMelayu(12, 30), '12:30 TENGAH HARI');
  assert.equal(masaMelayu(0, 30), '12:30 TENGAH MALAM');
  assert.equal(masaMelayu(21, 0), '9:00 MALAM');
});

test('masaMelayu: 00:30 dan 12:30 kongsi angka sama, dibezakan oleh istilah', () => {
  // Inilah sebab istilah waktu WAJIB ada — angka 12 jam sahaja tidak cukup untuk membezakannya.
  assert.equal(masaMelayu(0, 30).split(' ')[0], masaMelayu(12, 30).split(' ')[0]);
  assert.notEqual(masaMelayu(0, 30), masaMelayu(12, 30));
});

test('masa24: sentiasa dua digit kedua-dua belah', () => {
  assert.equal(masa24(17, 12), '17:12');
  assert.equal(masa24(0, 30), '00:30');
  assert.equal(masa24(9, 5), '09:05');
  assert.equal(masa24(23, 59), '23:59');
});

test('minit diterima sebagai rentetan (sumber Intl.formatToParts) mahupun nombor', () => {
  assert.equal(masaMelayu(17, '12'), '5:12 PETANG');
  assert.equal(masa24(9, '05'), '09:05');
});

test('input tidak sah dikendalikan tanpa ranap', () => {
  assert.equal(istilahWaktu(NaN), '');
  assert.equal(istilahWaktu(undefined), '');
  assert.equal(istilahWaktu(99), '');
});

test('tiada istilah AM/PM terhasil di mana-mana', () => {
  // Antara muka Adjung 100% Bahasa Melayu — AM/PM ialah singkatan Latin dan tidak dibenarkan.
  for (let j = 0; j <= 23; j++) {
    const teks = masaMelayu(j, 0) + ' ' + masa24(j, 0);
    assert.ok(!/\b(AM|PM)\b/i.test(teks), `jam ${j} menghasilkan AM/PM: ${teks}`);
  }
});
