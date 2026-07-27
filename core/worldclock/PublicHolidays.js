// Cuti umum tetap (tarikh yang sama setiap tahun) untuk jalur Jam Dunia, berserta skop
// negerinya. Sebelum ini jadual ni dikunci mengikut NAMA BANDAR di dalam WorldClockStrip.tsx
// dan cuma ada satu entri, 'Kuala Lumpur'. Sebab kesemua 15 bandar berkongsi zon waktu
// 'Asia/Kuala_Lumpur', logik sandaran di sana menyalin senarai KL kepada SETIAP bandar —
// jadi Hari Wilayah Persekutuan (1 Februari) memaparkan status Cuti Umum di Kangar, Ipoh,
// Kuching dan semua yang lain, sedangkan ia cuti untuk Wilayah Persekutuan sahaja.
//
// Cuti bergerak (Aidilfitri, Deepavali, Tahun Baharu Cina dan seumpamanya) TIDAK ada di sini:
// tarikhnya berubah setiap tahun dan datang dari API cuti dalam createWorldClockRoutes().
// Jadual ni sandaran untuk cuti bertarikh tetap sahaja, dipakai apabila API tidak dapat
// dihubungi.

/** Kod semua negeri dan Wilayah Persekutuan, sama seperti kod yang dipakai API cuti. */
export const ALL_STATE_CODES = [
  'JHR', 'KDH', 'KTN', 'MLK', 'NSN', 'PHG', 'PNG', 'PRK', 'PLS', 'SGR', 'TRG',
  'SBH', 'SWK', 'KUL', 'LBN', 'PJY',
];

const kecuali = (...codes) => ALL_STATE_CODES.filter(s => !codes.includes(s));

/**
 * Kunci `key` ialah format "MM/DD" — sama seperti kunci yang dibina jalur Jam Dunia dari
 * Intl.DateTimeFormat. `states: null` bermakna seluruh negara; jika tidak, ia senarai kod
 * negeri yang benar-benar menyambut cuti itu.
 */
export const FIXED_HOLIDAYS = [
  // Tahun Baharu bukan cuti umum di Johor, Kedah, Kelantan, Perlis dan Terengganu.
  { key: '01/01', name: 'Tahun Baharu', states: kecuali('JHR', 'KDH', 'KTN', 'PLS', 'TRG') },
  // Hari Wilayah Persekutuan — Wilayah Persekutuan sahaja. Inilah pepijat asal.
  { key: '02/01', name: 'Hari Wilayah Persekutuan', states: ['KUL', 'LBN', 'PJY'] },
  { key: '05/01', name: 'Hari Pekerja', states: null },
  { key: '08/31', name: 'Hari Kebangsaan', states: null },
  { key: '09/16', name: 'Hari Malaysia', states: null },
  { key: '12/25', name: 'Hari Krismas', states: null },
];

/**
 * Cari cuti umum bertarikh tetap bagi satu negeri pada satu tarikh.
 *
 * @param {string} gregKey   Tarikh dalam format "MM/DD", cth "02/01" untuk 1 Februari.
 * @param {string} stateCode Kod negeri bandar itu, cth "KUL".
 * @returns {{ name: string } | null} Cuti yang sepadan, atau null jika tiada.
 */
export function findFixedHoliday(gregKey, stateCode) {
  if (!gregKey || !stateCode) return null;
  const match = FIXED_HOLIDAYS.find(
    h => h.key === gregKey && (h.states === null || h.states.includes(stateCode))
  );
  return match ? { name: match.name } : null;
}
