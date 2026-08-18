// Satu sumber kebenaran untuk senarai jenis animasi carousel Adjung Core, dikongsi pelayan
// (core/routes/*.js) dan frontend (src/components/*.tsx) — corak sama seperti GeometryConfig.js.
//
// Dicipta 2026-08-18 selepas imbasan kod mendedahkan senarai
// ['pudar','colophon','sapuan_lajur','gerak_susun'] ditaip tangan ~10 kali merentasi 4 fail
// (FrontpageView.tsx, SenaraiSlotConsole.tsx, TetapanAmSlotConsole.tsx, slotAmRoutes.js,
// slotsConfigRoutes.js) — CORAK TEPAT yang CLAUDE.md rekodkan pernah menyembunyikan 2 pepijat
// sebenar (5 salinan nombor had aksara, 2026-07-25). Import terus daripada fail ni; JANGAN taip
// semula senarai jenis animasi di tempat lain.

// Empat jenis animasi carousel yang DILAKSANAKAN sebenar dalam kod (Fasa 7, 2026-08-04) — lihat
// CarouselStableBlock (FrontpageView.tsx) untuk pelaksanaan penuh setiap satu. Senarai ni SENGAJA
// terhad kepada apa yang wujud — jangan tawarkan pilihan yang tak dilaksanakan.
export const JENIS_ANIMASI_ASAS = ['pudar', 'colophon', 'sapuan_lajur', 'gerak_susun'];

// 'rawak' BUKAN jenis animasi sendiri — ia arahan pilih SATU drpd JENIS_ANIMASI_ASAS secara
// rawak setiap kali carousel bertukar pusingan (2026-08-18, soalan Izzat). Peringkat GLOBAL
// sahaja (Tetapan Am Slot) buat masa ni — override per-slot (Senarai Slot → Tetapan Kad) kekal
// terhad kepada JENIS_ANIMASI_ASAS sahaja, TIDAK termasuk 'rawak'.
export const JENIS_ANIMASI_RAWAK = 'rawak';

// Pilih SATU jenis rawak drpd kolam yang diberi — jatuh balik ke JENIS_ANIMASI_ASAS penuh kalau
// kolam kosong/tak sah (elak keadaan "Rawak" terpilih tapi kolam kosong = tiada animasi
// terpapar). Fungsi TULEN, guna Math.random() SEKALI setiap panggilan — pemanggil (bukan fungsi
// ni) yang tentukan BILA panggilan berlaku (setiap pusingan carousel, setiap klik "Main"
// pratonton, dsb).
export function pilihJenisRawak(kolam) {
  const kolamSah = Array.isArray(kolam) && kolam.length ? kolam : JENIS_ANIMASI_ASAS;
  return kolamSah[Math.floor(Math.random() * kolamSah.length)];
}
