/**
 * EventDateValidator.js
 * Enjin validator tarikh acara & pengekstrakan akronim penganjur Adjung Brief.
 * Berpandukan Peraturan Redaksi & Spesifikasi Slot Adjung Brief v1.2 Final.
 */

// Pemetaan kamus akronim penganjur utama rasmi
const ORGANIZER_ACRONYM_MAP = {
  'DEWAN BAHASA DAN PUSTAKA': 'DBP',
  'PERBADANAN PERPUSTAKAAN AWAM SELANGOR': 'PPAS',
  'PERPUSTAKAAN NEGARA MALAYSIA': 'PNM',
  'KEMENTERIAN PENDIDIKAN MALAYSIA': 'KPM',
  'DEWAN BANDARAYA KUALA LUMPUR': 'DBKL',
  'INSTITUT TERJEMAHAN & BUKU MALAYSIA': 'ITBM',
  'INSTITUT TERJEMAHAN DAN BUKU MALAYSIA': 'ITBM',
  'MAJLIS AGAMA ISLAM SELANGOR': 'MAIS',
  'JABATAN AGAMA ISLAM SELANGOR': 'JAIS',
  'JABATAN KEMAJUAN ISLAM MALAYSIA': 'JAKIM',
  'UNIVERSITI MALAYA': 'UM',
  'UNIVERSITI KEBANGSAAN MALAYSIA': 'UKM',
  'UNIVERSITI PUTRA MALAYSIA': 'UPM',
  'UNIVERSITI SAINS MALAYSIA': 'USM',
  'UNIVERSITI TEKNOLOGI MARA': 'UiTM',
  'UNIVERSITI ISLAM ANTARABANGSA MALAYSIA': 'UIAM',
  'YAYASAN WARISAN ISLAM': 'YWI'
};

/**
 * Ekstrak akronim penganjur secara rasmi mengikut Spesifikasi Slot 5.3
 */
export function extractOrganizerAcronym(item) {
  if (!item) return '—';

  const rawText = (item.organizer || item.penganjur || item.source || item.manualSource || item.desk || item.category || '').toString().trim();
  if (!rawText) return '—';

  // 1. Jika pengguna menyediakan akronim dalam kurungan e.g. "Dewan Bahasa dan Pustaka (DBP)" -> "DBP"
  const parenMatch = rawText.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    return parenMatch[1].trim().toUpperCase();
  }

  const upperText = rawText.toUpperCase();

  // 2. Semak kamus pemetaan akronim rasmi jika pengguna memasukkan nama penuh
  if (ORGANIZER_ACRONYM_MAP[upperText]) {
    return ORGANIZER_ACRONYM_MAP[upperText];
  }

  // 3. Jika input sudah sedia ada pendek/akronim (kurang dari 12 aksara atau 1-2 perkataan)
  const words = upperText.split(/\s+/);
  if (words.length <= 2 || upperText.length <= 10) {
    return upperText;
  }

  // 4. Jika nama penuh panjang tanpa kurungan, bina akronim dari huruf pertama kata kunci utama
  const acronym = words
    .filter(w => !['DAN', 'DE', 'LA', 'OF', '&', 'DAN/ATAU'].includes(w))
    .map(w => w[0])
    .join('')
    .toUpperCase();

  return acronym || upperText;
}

const NAMA_BULAN = [
  'JAN', 'FEB', 'MAC', 'APR', 'MEI', 'JUN', 'JUL', 'OGOS', 'SEPT', 'OKT', 'NOV', 'DIS',
];

// Format satu tarikh ISO (yyyy-mm-dd, daripada <input type="date">) ke "21 OGOS 2026". Nilai
// bukan-ISO (teks lama bebas, cth "21 Ogos 2026" ditaip terus sebelum pemetik kalendar wujud)
// dipulangkan AS-IS, uppercase — tiada percubaan menghurai format bebas, elak paparan rosak.
//
// Padanan bentuk regex sahaja TAK CUKUP (dapatan bug-hunt 2026-09-09, sama corak seperti
// validateTarikhSumber() di ContentBudget.js) — "2026-02-30" (Februari tiada 30 hari) lulus
// regex asal dan `NAMA_BULAN[Number(bulan)-1]` (bulan 02 sah), jadi fungsi ni dahulu terus
// papar "30 FEB 2026" kepada pembaca: tarikh mustahil tapi kelihatan munasabah, senyap tanpa
// sebarang amaran. Blok manual/API terus (server.js, case 'tarikhMula'/'tarikhTamat') tak
// pernah sahkan tarikh acara Bar secara kalendar sebenar sebelum simpan, jadi paparan ialah
// SATU-SATUNYA gerbang — sahkan bulan 01-12 DAN hari sebenar wujud bagi bulan/tahun tu (guna
// Date.UTC + round-trip, elak anjak zon waktu/anjak senyap "30 Feb" -> "2 Mac") sebelum bina
// label; tarikh yang gagal jatuh balik ke rentetan asal uppercase (sama falsafah sedia ada
// utk format bukan-ISO — jangan tunjuk tarikh salah sebagai kalau ia sah).
function formatSatuTarikh(iso) {
  const trimmed = (iso || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return trimmed.toUpperCase();
  const [, tahun, bulan, hari] = match;
  const namaBulan = NAMA_BULAN[Number(bulan) - 1];
  if (!namaBulan) return trimmed.toUpperCase();
  const tahunNum = Number(tahun);
  const bulanNum = Number(bulan);
  const hariNum = Number(hari);
  const d = new Date(Date.UTC(tahunNum, bulanNum - 1, hariNum));
  const sahBenar = d.getUTCFullYear() === tahunNum && d.getUTCMonth() === bulanNum - 1 && d.getUTCDate() === hariNum;
  if (!sahBenar) return trimmed.toUpperCase();
  return `${hariNum} ${namaBulan} ${tahun}`;
}

/**
 * Format tarikh acara Slot Bar untuk paparan kad — satu tarikh, atau julat "21 - 23 OGOS 2026"
 * (2026-08-07, permintaan Izzat: pemetik kalendar Mula/Tamat, boleh julat berbilang hari).
 * dateEnd kosong atau sama dengan dateStart = paparan satu tarikh sahaja (acara sehari).
 */
export function formatEventDateRange(dateStart, dateEnd) {
  const mula = (dateStart || '').trim();
  const tamat = (dateEnd || '').trim();
  if (!mula) return '';
  if (!tamat || tamat === mula) return formatSatuTarikh(mula);
  return `${formatSatuTarikh(mula)} - ${formatSatuTarikh(tamat)}`;
}

export default {
  extractOrganizerAcronym,
  formatEventDateRange,
};
