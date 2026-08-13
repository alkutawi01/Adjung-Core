// Kitaran hayat senarai cuti sekolah (SCHOOL-HOLIDAY-SOURCE-001, 2026-08-13).
//
// Cuti sekolah TIDAK datang daripada API. API cuti yang disambungkan
// (malaysia-holiday.dydxsoft.my, lihat worldClockRoutes.js) membekalkan cuti UMUM sahaja —
// disahkan dengan panggilan sebenar: 49 rekod, medan name/date/day_name/state_codes, SIFAR
// menyebut sekolah/penggal/persekolahan. Bila system_settings.schoolHolidaysJson kosong,
// sistem jatuh balik ke SCHOOL_HOLIDAYS_LALAI, senarai berkod keras yang entri terakhirnya
// tamat pertengahan Feb 2027.
//
// Masalah teras BUKAN "berkod keras" — sandaran berkod keras kadang-kadang wajar. Masalahnya
// TIADA pengurusan kitaran hayat: selepas tarikh terakhir berlalu, Jam Dunia berhenti memapar
// cuti sekolah secara SENYAP, tanpa amaran, dan tiada sesiapa tahu bila ia berlaku. Fungsi ni
// menutup jurang senyap itu.
//
// Diasingkan sebagai fungsi TULEN (bukan dibiar dalam komponen React) supaya ia benar-benar
// boleh diuji: dengan data semasa amaran belum tercetus lagi (~185 hari lagi), jadi cabang
// "hampir tamat" dan "sudah tamat" mustahil disahkan dengan mata pada skrin hari ni.

/** Ambang amaran awal, hari. ~4 bulan: takwim persekolahan tahun berikutnya lazimnya sudah
 *  diterbitkan sebelum tempoh ini, jadi editor ada masa munasabah untuk bertindak. */
export const AMBANG_AMARAN_HARI = 120;

const MILISAAT_SEHARI = 86400000;

/**
 * Nilai status kitaran hayat senarai cuti sekolah.
 *
 * @param {Array<{end?: string}>} senarai — tempoh cuti; hanya medan `end` (YYYY-MM-DD) dibaca.
 * @param {string} hariIniIso — tarikh hari ini sebagai YYYY-MM-DD (disuntik, bukan Date.now(),
 *        supaya boleh diuji secara deterministik).
 * @returns {null | { tamat: boolean, bezaHari: number, tarikhAkhir: string }}
 *          `null` bermakna tiada apa perlu dipaparkan (senarai kosong, tarikh tak sah, atau
 *          masih jauh daripada tamat).
 */
export function statusLuputCutiSekolah(senarai, hariIniIso) {
  if (!Array.isArray(senarai) || senarai.length === 0) return null;
  if (typeof hariIniIso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hariIniIso)) return null;

  const tarikhTamat = senarai
    .map((c) => (c && typeof c.end === 'string' ? c.end.trim() : ''))
    .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t))
    .sort();
  if (tarikhTamat.length === 0) return null;

  const tarikhAkhir = tarikhTamat[tarikhTamat.length - 1];
  const msAkhir = Date.parse(`${tarikhAkhir}T00:00:00Z`);
  const msHariIni = Date.parse(`${hariIniIso}T00:00:00Z`);
  if (Number.isNaN(msAkhir) || Number.isNaN(msHariIni)) return null;

  const bezaHari = Math.round((msAkhir - msHariIni) / MILISAAT_SEHARI);
  if (bezaHari < 0) return { tamat: true, bezaHari, tarikhAkhir };
  if (bezaHari <= AMBANG_AMARAN_HARI) return { tamat: false, bezaHari, tarikhAkhir };
  return null;
}
