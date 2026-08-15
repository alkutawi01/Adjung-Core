// Regression: had aksara Sumber mesti muat nama penerbit sebenar.
//
// Pepijat sebenar 2026-08-16 — simulasi "Dengan rujukan" guna sumber sebenar (The Malaysian
// Reserve), publish ditolak (400) sebab hadSumber Tetapan Am Slot ketika itu = 20 aksara, tapi
// "The Malaysian Reserve" = 21 aksara. Nama outlet berita SEBENAR (bukan reka, bukan pelik/luar
// biasa panjang) pun tak muat. Audit ChatGPT: had 20 terlalu ketat berbanding realiti nama media
// (New Straits Times=17, The Star Malaysia=18, The Malaysian Reserve=21, South China Morning
// Post=24) — naikkan ke 50 (Tetapan Am Slot, permintaan Izzat 2026-08-16, disahkan visual tiada
// overflow kad/mobile). Ujian ni kunci corak validasi supaya had tak turun semula tanpa disedari.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setMedanLimits, validateMedanTambahan } from '../core/editorial/ContentBudget.js';

test('validateMedanTambahan — hadSumber 50 muat nama penerbit sebenar (21-30 aksara)', () => {
  setMedanLimits({ hadSumber: 50, hadSumberMin: 3 });
  const namaSumberSebenar = [
    'The Malaysian Reserve', // 21
    'South China Morning Post', // 25
    'New Straits Times', // 18
    'The Star Malaysia', // 18
  ];
  for (const nama of namaSumberSebenar) {
    const hasil = validateMedanTambahan({ source: nama });
    assert.equal(hasil.isValid, true, `"${nama}" (${nama.length} aksara) patut lulus had 50`);
  }
});

test('validateMedanTambahan — corak pepijat asal direplika (hadSumber 20 tolak nama sebenar)', () => {
  setMedanLimits({ hadSumber: 20, hadSumberMin: 3 });
  const hasil = validateMedanTambahan({ source: 'The Malaysian Reserve' }); // 21 aksara
  assert.equal(hasil.isValid, false, 'corak had lama (20) mesti tolak nama 21 aksara — replika pepijat asal');
  // Set semula ke had baharu supaya ujian lain (jika dijalankan susulan) tak terjejas keadaan sisa.
  setMedanLimits({ hadSumber: 50, hadSumberMin: 3 });
});

test('validateMedanTambahan — hadSumberMin kekal berkuat kuasa pada had baharu', () => {
  setMedanLimits({ hadSumber: 50, hadSumberMin: 3 });
  const hasil = validateMedanTambahan({ source: 'AB' }); // 2 aksara, bawah min 3
  assert.equal(hasil.isValid, false, 'nama sumber terlalu pendek (bawah hadSumberMin) tetap ditolak');
});
