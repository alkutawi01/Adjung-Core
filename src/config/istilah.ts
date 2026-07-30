// Istilah paparan — SATU tempat untuk perkataan yang dilihat editor (2026-07-30, permintaan
// pemilik projek: "selaraskan istilah, masih bercampur dan celaru").
//
// Peraturan Perlembagaan: label mesti 100% Bahasa Melayu; Bahasa Inggeris hanya dibenarkan
// bertulis condong (italic) apabila tiada padanan Melayu yang diluluskan lagi.
//
// PENTING: nilai DALAMAN tidak ditukar. `contentMode` disimpan dalam slots_config sebagai
// 'Manual' / 'AI Generated' / 'RSS Direct', dan status disimpan sebagai approved/pending/archived.
// Menterjemah nilai yang disimpan bermakna setiap perbandingan dalam kod dan setiap baris lama
// dalam pangkalan data terpaksa ditukar sekali — jadi terjemahan dibuat pada saat MEMAPAR sahaja,
// di sini.

/** Mod kandungan (lajur "Kaedah" di Indeks, "Mod Kandungan" di borang Urus Slot). */
export const MOD_KANDUNGAN_LABEL: Record<string, string> = {
  'Manual': 'Manual',
  'AI Generated': 'Jana AI',
  'RSS Direct': 'Suapan RSS',
};

export const labelMod = (nilai?: string | null): string => {
  if (!nilai) return '';
  return MOD_KANDUNGAN_LABEL[nilai] || nilai;
};

/** Status kandungan seperti dipapar. Kunci ialah label dalaman IndeksConsole, bukan nilai DB. */
export const STATUS_LABEL: Record<string, string> = {
  Live: 'Aktif',
  Pending: 'Menunggu',
  Archive: 'Arkib',
};

export const labelStatus = (nilai?: string | null): string => {
  if (!nilai) return '';
  return STATUS_LABEL[nilai] || nilai;
};
