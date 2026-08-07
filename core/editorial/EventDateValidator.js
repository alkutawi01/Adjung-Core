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
function formatSatuTarikh(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!match) return (iso || '').trim().toUpperCase();
  const [, tahun, bulan, hari] = match;
  const namaBulan = NAMA_BULAN[Number(bulan) - 1];
  if (!namaBulan) return iso.toUpperCase();
  return `${Number(hari)} ${namaBulan} ${tahun}`;
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
