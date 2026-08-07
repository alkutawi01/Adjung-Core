import { setMedanLimitOverrides } from '../../core/editorial/GeometryConfig.js';

// Pindaan had geometri Topik/Huraian Panjang di sisi BROWSER (2026-08-08) — sama corak persis
// muatPindaanTier() (tierOverrides.ts), sebab yang sama tepat: GeometryConfig.js ialah kod
// KONGSI, server dan browser masing-masing muatkan salinan sendiri. Server terima pindaan Ketua
// Editor daripada Tetapan Am Slot (hadHuraianPanjang/hadTopik, slotAmRoutes.js) semasa boot,
// tetapi salinan browser tak tahu apa-apa — modal Urus Slot terus papar had lalai (600/25)
// walaupun server sebenarnya kuat kuasakan nombor lain (cth 1200/25) semasa simpan.
//
// Ditemui 2026-08-08 semasa ujian sebenar (Izzat tetapkan Huraian Panjang 1000-1200 di Tetapan
// Am Slot, tapi modal Urus Slot masih papar "min 400/maks 600") — bug SAMA persis yang muatPindaanTier
// dibina untuk elak, terlepas pandang sebab pindaan medan-limit dibina berasingan daripada
// pindaan tier malam yang sama.
export const muatPindaanMedanLimit = async (): Promise<void> => {
  try {
    const res = await fetch('/api/system/slot-am-settings');
    if (!res.ok) return;
    const data = await res.json();
    setMedanLimitOverrides({
      maxBriefLong: Number(data?.hadHuraianPanjang) || 0,
      maxTopik: Number(data?.hadTopik) || 0,
    });
  } catch {
    // Senyap: gagal ambil bermakna guna nilai lalai — bukan keadaan rosak.
  }
};
