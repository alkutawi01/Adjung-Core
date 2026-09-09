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

// Kunci Ticker BERASINGAN (2026-08-08, dapatan audit keselamatan ChatGPT) — `system_settings.
// inTheNewsText` (Ticker/Modul Khas) ialah domain data lain sepenuhnya drpd kandungan editorial
// (editorial_revisions/slots_config), jadi ia dapat rantaian sendiri, BUKAN kongsi
// denganKunciKandungan. Sebabnya: pengambilan RSS (executeDirectRssFetch) buat panggilan rangkaian
// PERLAHAN (fetch ke pelayan RSS luar) sebelum sampai ke bahagian tulis DB — kalau ia kongsi kunci
// yang SAMA dgn suntingan kandungan, editor lain akan tersekat menunggu fetch RSS luaran siap,
// yang boleh ambil beberapa saat. Kunci ni HANYA membalut bahagian baca-ubah-tulis inTheNewsText
// sebenar (pantas, DB sahaja) di setiap pemanggil — bukan keseluruhan fungsi pengambilan RSS.
let rantaianKunciTicker = Promise.resolve();

export function denganKunciTicker(fn) {
  const giliran = rantaianKunciTicker.catch(() => {}).then(fn);
  rantaianKunciTicker = giliran.catch(() => {});
  return giliran;
}

// Kunci CategoryRegistry BERASINGAN (2026-09-09, dapatan bug-hunt) — `POST /categories/merge`
// dan `POST /categories/rename` (categoryRoutes.js) panggil `CategoryRegistry.mergeCategories()`/
// `renameCategory()` (core/category/CategoryRegistry.js) yang membuka `BEGIN TRANSACTION`
// SENDIRI pada sambungan sqlite3 DIKONGSI, TANPA sebarang kunci — SIBLING pepijat persis
// `POST /glosari` yang dibaiki sebelum ni (unwrapped BEGIN TRANSACTION + sambungan dikongsi =
// "cannot start a transaction within a transaction" bila dua permintaan bertindih). Dua editor
// klik "Gabung Bidang"/"Namakan Semula Bidang" serentak (atau satu klik dua kali pantas) cukup
// mencetuskannya. Disahkan reproduce SEBENAR (scratch DB, N permintaan serentak ke
// /categories/merge) -- lihat `.simulasi/sim54-kategori-transaksi-serentak.mjs`. Kunci
// BERASINGAN drpd denganKunciKandungan (Bidang/CategoryRegistry ialah domain data lain drpd
// editorial_revisions/slots_config, tiada sebab saling menyekat).
let rantaianKunciKategori = Promise.resolve();

export function denganKunciKategori(fn) {
  const giliran = rantaianKunciKategori.catch(() => {}).then(fn);
  rantaianKunciKategori = giliran.catch(() => {});
  return giliran;
}

// Kunci peranan pengguna BERASINGAN (2026-09-09, bug-hunt) — `PATCH /users/:id/roles`
// (userAdminRoutes.js) ganti SELURUH set baris `user_roles` bagi satu akaun: DELETE FROM
// user_roles WHERE userId = ? diikuti gelung INSERT OR IGNORE, TANPA sebarang kunci — sibling
// pepijat persis corak yang dibaiki di permohonanPenajaRoutes.js/sponsorRoutes.js (senarai anak
// digantikan penuh bagi SATU ibu). Dua permintaan PATCH .../roles hampir serentak bagi AKAUN SAMA
// (cth dua tab Pentadbir terbuka, atau klik dua kali pantas) boleh berselang-seli DELETE/INSERT
// masing-masing — peranan yang sepatutnya wujud selepas KEDUA-DUA permintaan selesai boleh hilang
// senyap (baris DELETE permintaan B padam baris INSERT permintaan A yang baru selesai, atau
// sebaliknya), akaun tinggal dengan set peranan daripada SATU permintaan sahaja walaupun kedua-dua
// respons HTTP pulangkan 200 OK. Kunci BERASINGAN drpd denganKunciKandungan (user_roles ialah
// domain kebenaran akaun, bukan kandungan editorial, tiada sebab saling menyekat).
let rantaianKunciPeranan = Promise.resolve();

export function denganKunciPeranananPengguna(fn) {
  const giliran = rantaianKunciPeranan.catch(() => {}).then(fn);
  rantaianKunciPeranan = giliran.catch(() => {});
  return giliran;
}

export default denganKunciKandungan;
