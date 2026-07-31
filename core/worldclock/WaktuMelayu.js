// Penetapan masa mengikut sistem 24 jam — istilah waktu Bahasa Melayu (rujukan DBP).
//
// Sumber peraturan: poster rasmi "PENETAPAN MASA MENGIKUT SISTEM 24 JAM" yang dirujuk pemilik
// projek. Julatnya ditakrifkan pada jam 24 jam, BUKAN 12 jam — itu sebabnya modul ini sentiasa
// menerima jam 24 jam sebagai input walaupun paparan akhirnya menggunakan angka 12 jam:
//
//   PAGI          01:00 – 11:59
//   TENGAH HARI   12:00 – 13:59
//   PETANG        14:00 – 18:59
//   MALAM         19:00 – 23:59
//   TENGAH MALAM  00:00 – 00:59
//
// Perhatikan dua perangkap yang mudah tersilap jika peraturan ini ditulis terus dalam komponen:
//   1. TENGAH MALAM ialah 00:00–00:59 SAHAJA — bukan keseluruhan waktu awal pagi. Jam 01:00
//      sudah pun PAGI.
//   2. TENGAH HARI menjangkau DUA jam penuh (12:00–13:59), bukan pukul 12 sahaja.
//
// Istilah ini menggantikan AM/PM sepenuhnya pada paparan telefon. AM/PM ialah singkatan Latin
// (ante/post meridiem) — ia tiada tempat dalam antara muka 100% Bahasa Melayu.

/** Julat waktu rasmi, mengikut jam 24 jam. `hingga` adalah inklusif. */
export const JULAT_WAKTU = [
  { nama: 'TENGAH MALAM', dari: 0, hingga: 0 },
  { nama: 'PAGI', dari: 1, hingga: 11 },
  { nama: 'TENGAH HARI', dari: 12, hingga: 13 },
  { nama: 'PETANG', dari: 14, hingga: 18 },
  { nama: 'MALAM', dari: 19, hingga: 23 },
];

/**
 * Istilah waktu Melayu bagi satu jam 24 jam.
 *
 * @param {number} jam24 Jam dalam sistem 24 jam (0–23).
 * @returns {string} PAGI | TENGAH HARI | PETANG | MALAM | TENGAH MALAM
 */
export function istilahWaktu(jam24) {
  const j = Number(jam24);
  if (!Number.isFinite(j)) return '';
  const jamBulat = Math.floor(j);
  const padanan = JULAT_WAKTU.find(w => jamBulat >= w.dari && jamBulat <= w.hingga);
  return padanan ? padanan.nama : '';
}

/**
 * Tukar jam 24 jam kepada angka jam 12 jam untuk paparan.
 * 0 dan 12 kedua-duanya dipapar sebagai 12 (00:30 → "12:30", 12:30 → "12:30") — istilah waktu
 * yang membezakannya ("TENGAH MALAM" lawan "TENGAH HARI"), bukan angkanya.
 */
export function jam12(jam24) {
  const j = Math.floor(Number(jam24));
  if (!Number.isFinite(j)) return '';
  const h = j % 12;
  return String(h === 0 ? 12 : h);
}

/**
 * Masa gaya Melayu: angka 12 jam + istilah waktu. Contoh: "5:12 PETANG", "12:30 TENGAH MALAM".
 * Dipakai pada sisi tarikh HIJRAH baris meta telefon.
 *
 * @param {number} jam24  Jam 24 jam (0–23).
 * @param {string|number} minit Minit, akan dipad kepada dua digit.
 */
export function masaMelayu(jam24, minit) {
  const mm = String(minit).padStart(2, '0');
  const istilah = istilahWaktu(jam24);
  return istilah ? `${jam12(jam24)}:${mm} ${istilah}` : `${jam12(jam24)}:${mm}`;
}

/**
 * Masa sistem 24 jam, sentiasa dua digit pada kedua-dua belah. Contoh: "17:12", "00:30".
 * Dipakai pada sisi tarikh MASIHI baris meta telefon.
 */
export function masa24(jam24, minit) {
  const hh = String(Math.floor(Number(jam24))).padStart(2, '0');
  const mm = String(minit).padStart(2, '0');
  return `${hh}:${mm}`;
}
