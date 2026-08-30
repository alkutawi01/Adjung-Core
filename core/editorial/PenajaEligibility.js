// PenajaEligibility.js (2026-08-30, audit + kemas kini modul Penaja, permintaan Izzat)
//
// SATU tapak semakan kelayakan tajaan, dikongsi pelayan (server.js/sponsorRoutes.js) DAN
// klien (FrontpageView.tsx) — corak sama seperti core/editorial/GeometryConfig.js, fail ESM
// `.js` biasa diimport terus (laluan relatif berakhir `.js`), bukan disalin semula.
//
// Dua semakan berasingan, gabung dengan AND di pemanggil:
//   1. sponsorAktifPadaMasa — julat tarikh (mulaTajaan/tamatTajaan) ATAU jatuh balik `bulan`.
//   2. penajaLayakUntukSlot — skop portal-keseluruhan (senarai kosong) ATAU per-slot.

/**
 * Adakah tajaan AKTIF pada masa yang diberi. Penaja BAHARU (julat ISO 8601 lengkap,
 * mulaTajaan/tamatTajaan kedua-duanya diisi) dinilai ikut julat tarikh sebenar — logo
 * hilang TEPAT bila tamatTajaan berlalu. Penaja LAMA (bulanan, tiada julat ISO) jatuh
 * balik ke padanan `bulan` sedia ada, supaya rekod sebelum migrasi ni terus berfungsi
 * tanpa data tambahan.
 */
function sponsorAktifPadaMasa(sponsor, sekarang, bulanSemasaStr) {
  if (!sponsor) return false;
  if (sponsor.mulaTajaan && sponsor.tamatTajaan) {
    const masa = sekarang instanceof Date ? sekarang.getTime() : new Date(sekarang).getTime();
    const mula = new Date(sponsor.mulaTajaan).getTime();
    const tamat = new Date(sponsor.tamatTajaan).getTime();
    if (Number.isNaN(masa) || Number.isNaN(mula) || Number.isNaN(tamat)) return false;
    return masa >= mula && masa <= tamat;
  }
  return !!sponsor.bulan && sponsor.bulan === bulanSemasaStr;
}

/**
 * Adakah penaja layak untuk SLOT tertentu. `sponsor.slotIndexes` kosong/tiada = portal
 * keseluruhan (semua slot layak, kelakuan asal sebelum skop per-slot wujud). Senarai
 * tidak kosong = penaja HANYA layak untuk slot yang disenaraikan.
 */
function penajaLayakUntukSlot(sponsor, slotIndex) {
  const skop = Array.isArray(sponsor?.slotIndexes) ? sponsor.slotIndexes : [];
  if (skop.length === 0) return true;
  if (slotIndex === undefined || slotIndex === null || slotIndex === '') return false;
  const n = typeof slotIndex === 'string' ? parseInt(slotIndex, 10) : slotIndex;
  if (Number.isNaN(n)) return false;
  return skop.includes(n);
}

export { sponsorAktifPadaMasa, penajaLayakUntukSlot };
