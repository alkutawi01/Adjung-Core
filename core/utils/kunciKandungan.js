// Kunci mutasi kandungan/slot KONGSI (2026-08-08, dapatan audit keselamatan ChatGPT) — dicabut
// daripada contentRoutes.js supaya SATU rantaian yang sama benar-benar menyekat merentasi SEMUA
// laluan yang mengubah editorial_revisions/slots_config.manualSummary: PATCH/DELETE/POST
// kandungan, tolak-ke-draf, pulih-Tong-Sampah, POST /slots (Tulis Kandungan), DAN tik penjadual
// (server.js). Sebelum ni contentRoutes.js ada rantaian sendiri manakala slotsConfigRoutes.js dan
// penjadual server.js langsung TIADA kunci — dua permintaan pada laluan berlainan (cth editor
// PATCH kandungan semasa penjadual sedang tik) tak pernah saling menyekat walau kedua-duanya
// ubah baris DB yang sama, sebab masing-masing rantaian TERPISAH (kalau kekal berasingan). Satu
// modul kongsi ni pastikan cuma SATU rantaian sebenar wujud dalam seluruh proses.
//
// Cukup kerana pelayan satu proses (PM2 mod fork) — kalau kelak diskalakan kepada berbilang tika,
// ini mesti jadi kunci peringkat pangkalan data (cth advisory lock/baris `SELECT ... FOR UPDATE`
// setara SQLite tak ada, jadi perlu reka bentuk lain sepenuhnya).
let rantaianKunciKandungan = Promise.resolve();

export function denganKunciKandungan(fn) {
  const giliran = rantaianKunciKandungan.catch(() => {}).then(fn);
  rantaianKunciKandungan = giliran.catch(() => {});
  return giliran;
}

export default denganKunciKandungan;
