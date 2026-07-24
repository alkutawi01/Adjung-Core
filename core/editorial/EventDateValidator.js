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

export default {
  extractOrganizerAcronym,
};
