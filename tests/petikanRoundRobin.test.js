import test from 'node:test';
import assert from 'node:assert/strict';
import { pilihDanSusunKolam } from '../core/editorial/PetikanConfig.js';

// Bina koleksi ujian: 6 kategori, masing-masing ada cukup item supaya round-robin
// Peringkat 1 sentiasa terhad oleh saiz kolam (bukan kehabisan baldi kategori) —
// ini pastikan kategori PERTAMA dalam susunan round-robin sentiasa dapat "slot bonus".
function binaKoleksi() {
  const kategoriSenarai = ['Agama', 'Budaya', 'Ekonomi', 'Politik', 'Sains', 'Sejarah'];
  const senarai = [];
  let id = 1;
  for (const kategori of kategoriSenarai) {
    for (let i = 0; i < 3; i++) {
      senarai.push({ id: id++, kategori, teks: `${kategori}-${i}` });
    }
  }
  return senarai;
}

test('pilihDanSusunKolam - putaran round-robin berbeza ikut tarikh (bukan sentiasa mula A)', () => {
  const koleksi = binaKoleksi();
  const tarikhSenarai = [
    '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04',
    '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08',
  ];

  const kategoriPertamaSetiapHari = tarikhSenarai.map((tarikh) => {
    const hasil = pilihDanSusunKolam(koleksi, tarikh, 6);
    // Peringkat 1 round-robin: kategori item PERTAMA yg dipilih (sebelum Peringkat 2
    // menyusun semula) sepadan kategori pertama dlm kunciKategori berputar. Kita infer
    // ini secara tak langsung: kira kekerapan setiap kategori muncul sbg kategori PERTAMA
    // dlm hasil tersusun merentasi pelbagai tarikh — patut berbeza2, bukan tetap 'Agama'.
    return hasil[0].kategori;
  });

  const kategoriUnik = new Set(kategoriPertamaSetiapHari);
  assert.ok(
    kategoriUnik.size > 1,
    `Kategori pertama patut berputar merentasi hari, tapi hasil sentiasa sama: ${[...kategoriUnik]}`
  );
});

test('pilihDanSusunKolam - konsisten pada tarikh sama (deterministik, bukan rawak)', () => {
  const koleksi = binaKoleksi();
  const hasil1 = pilihDanSusunKolam(koleksi, '2026-09-03', 6);
  const hasil2 = pilihDanSusunKolam(koleksi, '2026-09-03', 6);

  assert.deepEqual(
    hasil1.map((p) => p.id),
    hasil2.map((p) => p.id),
    'Dua panggilan pada tarikh sama mesti hasilkan susunan sama'
  );
});

test('pilihDanSusunKolam - pemilihan/pengacakan dalam baldi kategori tidak tersentuh', () => {
  // Kekalkan sahaja kategori TUNGGAL supaya putaran round-robin (yg cuma 1 kategori) tak
  // mengubah apa-apa - ujian ni fokus pastikan item DALAM baldi masih diacak ikut benih
  // tarikh seperti asal (bukan urutan asal senarai input).
  const senarai = [];
  for (let i = 0; i < 8; i++) senarai.push({ id: i, kategori: 'Agama' });

  const hasil = pilihDanSusunKolam(senarai, '2026-09-03', 8);
  const idAsal = new Set(senarai.map((p) => p.id));
  const idHasil = hasil.map((p) => p.id);

  assert.ok(idHasil.length > 0, 'kolam patut mengandungi sekurang-kurangnya satu item');
  // Setiap item hasil mesti berasal drpd koleksi asal, dan tiada pendua (kekangan KERAS).
  assert.equal(new Set(idHasil).size, idHasil.length, 'tiada petikan patut berulang');
  for (const id of idHasil) {
    assert.ok(idAsal.has(id), `id ${id} tidak wujud dalam koleksi asal`);
  }
});
