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
//
// Kamus label boleh sunting (2026-08-02, Fasa 6 "Editor label & tooltip") — nilai di bawah
// kekal sebagai LALAI. Ketua Editor/Pentadbir boleh menetapkan nilai gantian melalui
// Tetapan → Label Sistem (TetapanConsole.tsx), disimpan dalam jadual `ui_labels`. Gantian
// dimuatkan sekali semasa aplikasi mula (muatPindaanLabel(), src/config/labelOverrides.ts)
// ke dalam `overridesLabel` di bawah — SEMUA fungsi labelXxx() di fail ni MESTI semak
// `overridesLabel` dahulu sebelum jatuh balik kepada nilai lalai. Jangan pintas laluan ni di
// mana-mana tapak panggilan.

/** Gantian label yang dimuat daripada pelayan (kunci sepadan `ui_labels.key`). Kosong = guna lalai. */
let overridesLabel: Record<string, string> = {};

/** Dipanggil oleh muatPindaanLabel() semasa aplikasi mula / selepas simpan Tetapan → Label Sistem. */
export const setLabelOverrides = (map: Record<string, string>): void => {
  overridesLabel = map && typeof map === 'object' ? map : {};
};

// Nilai kosong/ruang kosong tak pernah dianggap gantian sah — label tak boleh papar kosong.
const gantian = (kunci: string, lalai: string): string => {
  const nilai = overridesLabel[kunci];
  return typeof nilai === 'string' && nilai.trim() !== '' ? nilai : lalai;
};

/** Mod kandungan (lajur "Kaedah" di Indeks, "Mod Kandungan" di borang Urus Slot). */
export const MOD_KANDUNGAN_LABEL: Record<string, string> = {
  'Manual': 'Manual',
  'AI Generated': 'Jana AI',
  'RSS Direct': 'Suapan RSS',
};

export const labelMod = (nilai?: string | null): string => {
  if (!nilai) return '';
  const lalai = MOD_KANDUNGAN_LABEL[nilai] || nilai;
  return gantian(`mod.${nilai}`, lalai);
};

/** Status kandungan seperti dipapar. Kunci ialah label dalaman IndeksConsole, bukan nilai DB. */
export const STATUS_LABEL: Record<string, string> = {
  Live: 'Aktif',
  Pending: 'Menunggu',
  Archive: 'Arkib',
  // Dijadualkan (2026-08-02) — BEZA daripada Menunggu (Pending): Menunggu = tunggu kelulusan
  // Ketua Editor; Dijadualkan = SUDAH lulus, cuma tunggu masa terbit tiba (Jadual Terbit).
  Scheduled: 'Dijadualkan',
  // Tong Sampah (2026-08-08) — status lembut sebelum padam KEKAL, boleh Pulihkan.
  Dipadam: 'Dipadam',
};

export const labelStatus = (nilai?: string | null): string => {
  if (!nilai) return '';
  const lalai = STATUS_LABEL[nilai] || nilai;
  return gantian(`status.${nilai}`, lalai);
};

// Mesej sistem ringkas (toast simpan/terbit/gagal) — set terkurasi (2026-08-02, Fasa 6), BUKAN
// sapuan menyeluruh setiap mesej dalam aplikasi. Skop sengaja terhad kepada mesej pendek
// yang editor lihat rutin semasa kerja harian (simpan draf, terbit, tetapan) — mesej ralat
// teknikal/log audit/dalaman TIDAK disenaraikan di sini, kekal terus dikodkan di tapak panggilan.
export const MESEJ_SISTEM_LABEL: Record<string, string> = {
  'toast.draf_disimpan': 'Draf disimpan',
  'toast.gagal_terbit': 'Gagal menerbitkan kandungan.',
  'toast.gagal_simpan_draf': 'Gagal simpan draf.',
  'toast.tetapan_disimpan': 'Disimpan',
  'toast.profil_disimpan': 'Profil disimpan',
  'toast.templat_ai_disimpan': 'Templat AI disimpan',
  'toast.tetapan_am_disimpan': 'Tetapan disimpan dan berkuat kuasa serta-merta.',
  'toast.gagal_muat_sejarah': 'Gagal memuatkan sejarah versi.',
  'toast.kata_laluan_ditukar': 'Kata laluan berjaya ditukar',
  'toast.username_ditukar': 'Kata nama berjaya ditukar',
  'toast.emel_ditukar': 'Emel berjaya ditukar',
};

/** Cari mesej sistem terkurasi ikut kunci (cth `labelUi('toast.draf_disimpan')`). */
export const labelUi = (kunci: keyof typeof MESEJ_SISTEM_LABEL): string => {
  const lalai = MESEJ_SISTEM_LABEL[kunci] || String(kunci);
  return gantian(kunci, lalai);
};

/** Kamus penuh label lalai (untuk panel Tetapan → Label Sistem papar semua kunci berkumpulan). */
export const SEMUA_LABEL_LALAI: { kategori: string; kunci: string; lalai: string }[] = [
  ...Object.entries(MOD_KANDUNGAN_LABEL).map(([nilai, lalai]) => ({
    kategori: 'Mod Kandungan',
    kunci: `mod.${nilai}`,
    lalai,
  })),
  ...Object.entries(STATUS_LABEL).map(([nilai, lalai]) => ({
    kategori: 'Status',
    kunci: `status.${nilai}`,
    lalai,
  })),
  ...Object.entries(MESEJ_SISTEM_LABEL).map(([kunci, lalai]) => ({
    kategori: 'Mesej Sistem',
    kunci,
    lalai,
  })),
];
