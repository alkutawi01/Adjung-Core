// Pemenggalan suku kata Bahasa Melayu — untuk hyphenation kad bento pada lebar sempit.
//
// KENAPA MODUL INI WUJUD
// Pada telefon, lajur kad sesempit ~87px ruang teks. Perkataan Melayu terbitan (awalan +
// kata dasar + akhiran) kerap melebihi lebar itu — "Didahulukan", "Dipersembahkan",
// "Pelancongan". Sebelum ini CSS `word-break: break-word` memecahkannya di MANA-MANA huruf
// tanpa sempang ("Didahulukan" → "Didahulukan"/"n"), yang nampak rosak.
//
// KENAPA BUKAN `hyphens: auto`
// Diuji hidup (2026-07-31): pelayar terbenam TIADA kamus hyphenation langsung — bukan sahaja
// Melayu (`ms`), malah Inggeris dan Jerman pun gagal pecah, sedangkan `hyphens: auto` memang
// terpakai (computed = "auto"). Chromium muat turun kamus sebagai komponen atas permintaan,
// dan `ms` besar kemungkinan tiada langsung dalam set itu. Masalah terburuknya: apabila kamus
// tiada, `hyphens: auto` GAGAL SECARA SENYAP — tiada sempang, tiada amaran, dan kita takkan
// perasan sehingga ada yang menegur. Jadi ia tak boleh dipercayai.
//
// KENAPA PENDEKATAN INI SELAMAT DARI SEGI EDITORIAL
// Fungsi ini menyisip aksara SOFT HYPHEN (U+00AD) — aksara TAK KELIHATAN yang hanya menjadi
// sempang APABILA pelayar benar-benar perlu memecahkan baris di situ. Ia:
//   - tidak mengubah kandungan tersimpan (dipakai pada masa PAPAR sahaja),
//   - tidak mengubah teks yang disalin pengguna (soft hyphen digugurkan semasa salin),
//   - tidak menjejaskan carian/pembaca skrin,
//   - tidak nampak langsung jika perkataan itu sudah muat.
// Jadi ia TIDAK melanggar Falsafah teras #1 (jangan potong/tulis-ganti teks editorial) —
// tiada satu huruf pun ditambah atau dibuang daripada kandungan sebenar.
//
// PERATURAN PEMENGGALAN (struktur suku kata Melayu: (K)(K)V(K))
// Melayu jauh lebih teratur daripada Inggeris, jadi pemenggalan boleh dikira secara
// deterministik tanpa kamus. Antara dua vokal, kira bilangan UNIT konsonan:
//   0 konsonan (V-V)     → penggal antara vokal          : "ba-ik", "la-ut", "ka-in"
//   1 konsonan (V-KV)    → penggal SEBELUM konsonan      : "ba-ca", "bu-ku", "a-nak"
//   2 konsonan (VK-KV)   → penggal ANTARA konsonan       : "ban-tu", "am-bil", "bang-sa"
//   3+ konsonan (VK-KKV) → penggal selepas konsonan PERTAMA: "ins-tru-men"
//
// DIGRAF dikira sebagai SATU unit konsonan: ng, ny, sy, kh, gh
//   "bangun"  → ba-ngun   (ng satu unit → corak V-KV)
//   "bangsa"  → bang-sa   (ng + s = dua unit → corak VK-KV)
//   "menyanyi"→ me-nya-nyi
//   "akhir"   → a-khir
//
// DIFTONG (ai, au, oi) tidak dipenggal, TAPI hanya di HUJUNG perkataan:
//   "pan-tai", "pi-sau", "su-ngai"   (diftong — kekal bersama)
//   "ka-in", "ma-in", "a-ir"         (bukan diftong — vokal diikuti konsonan, dipenggal)

const VOKAL = new Set(['a', 'e', 'i', 'o', 'u']);
const DIGRAF = ['ng', 'ny', 'sy', 'kh', 'gh'];
const DIFTONG = ['ai', 'au', 'oi'];

/**
 * Aksara soft hyphen (U+00AD) — tak kelihatan sehingga pelayar perlu pecah baris di situ.
 *
 * Ditulis sebagai escape `­`, BUKAN aksara literal. Aksara literal U+00AD tak kelihatan
 * langsung dalam editor/diff, jadi ia senyap-senyap boleh hilang atau ditukar oleh penormalan
 * teks, transform bundler, atau tampal-salin — dan apabila ia jadi rentetan kosong, seluruh
 * pemenggal ini bertukar menjadi tiada operasi TANPA sebarang ralat.
 */
export const SOFT_HYPHEN = String.fromCharCode(0x00AD);

/**
 * Perkataan lebih pendek daripada ini tidak diproses langsung. Bukan kerana ia akan rosak,
 * tetapi kerana perkataan pendek tidak pernah menyebabkan limpahan pada lebar kad kita,
 * jadi memprosesnya cuma kerja sia-sia.
 */
const PANJANG_MIN = 7;

/**
 * Serpihan minimum di kiri dan kanan setiap sempang. Peraturan tipografi biasa: jangan
 * tinggalkan satu huruf terpencil ("Didahulukan" → "D-idahulukan" nampak rosak). Dua huruf
 * ialah kompromi yang sesuai untuk lajur telefon yang sempit — nilai lebih besar (3) akan
 * menolak terlalu banyak titik penggal yang sah pada lebar sesempit ini.
 */
const SERPIHAN_MIN = 2;

const adalahVokal = (c) => VOKAL.has(c);

/**
 * Pengecualian editor (2026-08-16, arahan Izzat — "sistem yg dah ada dah betul, cuma saya nak
 * sistem benarkan editor buat apa2 pengecualian, jika editor rasa perlu. dia mcm autocorrect").
 * Peraturan (K)(K)V(K) di atas betul untuk kebanyakan perkataan Melayu, tapi bukan SEMUA — ada
 * perkataan yang pemenggalan "betul" mengikut kelaziman berbeza daripada hasil algoritma (cth.
 * kata pinjaman, nama khas, singkatan janggal). Peta ni PILIHAN TAMBAHAN yang diperiksa DAHULU,
 * bukan gantian keseluruhan sistem — perkataan yang tiada dalam peta terus guna algoritma sedia
 * ada seperti biasa.
 *
 * Diselaraskan oleh caller (FrontpageView.tsx) via setPemenggalanPengecualian() setiap kali
 * senarai pengecualian berubah — corak SAMA seperti setGlosSelariAktif/setTypographyRulesAktif
 * di utils.tsx (satu peta dalam-modul, bukan prop dihantar merentasi ~30 tapak render kad).
 *
 * Kunci peta ialah perkataan huruf kecil, nilai ialah SENARAI OFFSET aksara (bukan corak
 * bersempang mentah) — offset dikira SEKALI di sini semasa dimuatkan, bukan berulang kali pada
 * setiap render kad. Mengekalkan offset (bukan corak) juga bermakna penyisipan sempang guna
 * huruf SEBENAR perkataan yang dipaparkan (cth. "Pentadbiran" huruf besar P kekal), bukan huruf
 * daripada corak tersimpan (yang sentiasa huruf kecil) — jadi kes huruf asal tidak sekali-kali
 * disentuh oleh ciri ni.
 */
let pengecualianPemenggalan = new Map();

/**
 * Tukar corak bersempang editor (cth. "pen-tad-bir-an") kepada senarai offset aksara tempat
 * sempang patut disisip. Pulangkan null jika corak tidak sah (offset pertama < SERPIHAN_MIN dsb)
 * — TIDAK sekali-kali mengubah kandungan tanpa jaminan struktur perkataan kekal utuh apabila
 * sempang dibuang semula (lihat validasi di pemenggalanRoutes.js, yang dipanggil semasa simpan;
 * semakan sini pertahanan KEDUA supaya data lapuk/rosak dalam DB tidak sekali-kali sampai ke
 * paparan pembaca walaupun laluan simpan entah bagaimana terlepas).
 */
const corakKepadaOffset = (perkataan, corak) => {
  if (typeof corak !== 'string' || !corak.includes('-')) return null;
  const segmen = corak.split('-');
  if (segmen.some((s) => s.length === 0)) return null;
  // Corak (sempang dibuang) MESTI sepadan tepat perkataan asal — kalau tidak, sisipan sempang
  // akan mengubah/rosakkan teks editorial sebenar, melanggar falsafah teras jangan sentuh teks.
  if (segmen.join('').toLowerCase() !== perkataan.toLowerCase()) return null;
  const offset = [];
  let pos = 0;
  for (let i = 0; i < segmen.length - 1; i++) {
    pos += segmen[i].length;
    offset.push(pos);
  }
  return offset;
};

/**
 * Muatkan senarai pengecualian editor. `senarai` ialah array {perkataan, corak} (bentuk sama
 * seperti baris jadual `pemenggalan_pengecualian`, lihat pemenggalanRoutes.js). Entri dengan
 * corak tak sah dilangkau senyap (bukan lontar ralat) — satu entri rosak tidak patut gugurkan
 * seluruh peta pengecualian untuk perkataan lain yang sah.
 */
export function setPemenggalanPengecualian(senarai) {
  const peta = new Map();
  for (const entri of senarai || []) {
    const perkataan = (entri?.perkataan || '').trim();
    const corak = (entri?.corak || '').trim();
    if (!perkataan) continue;
    const offset = corakKepadaOffset(perkataan, corak);
    if (!offset || offset.length === 0) continue;
    peta.set(perkataan.toLowerCase(), offset);
  }
  pengecualianPemenggalan = peta;
}

/**
 * Baca satu unit konsonan bermula pada indeks `i` — mengembalikan panjangnya (2 untuk digraf,
 * 1 untuk konsonan biasa). Digraf mesti dikira sebagai satu unit, jika tidak "bangun" akan
 * dipenggal "ban-gun" (salah) dan bukan "ba-ngun" (betul).
 */
const panjangUnitKonsonan = (kata, i) => {
  const dua = kata.slice(i, i + 2).toLowerCase();
  return DIGRAF.includes(dua) ? 2 : 1;
};

/**
 * Adakah pasangan vokal pada indeks `i` ialah diftong yang tidak boleh dipenggal?
 * Hanya benar di HUJUNG perkataan — "pantai" (diftong) lawan "kain" (bukan; ai diikuti n,
 * jadi dua suku kata: ka-in).
 */
const adalahDiftongHujung = (kata, i) => {
  const pasangan = kata.slice(i, i + 2).toLowerCase();
  return DIFTONG.includes(pasangan) && i + 2 === kata.length;
};

/**
 * Cari semua kedudukan penggal yang sah dalam SATU perkataan (tiada ruang di dalamnya).
 * Mengembalikan array indeks — sempang disisip SEBELUM setiap indeks.
 *
 * Diasingkan daripada penyisipan supaya boleh diuji terus dan digunakan semula (cth untuk
 * mengira lebar suku kata terpanjang jika suatu hari nanti kita perlu).
 */
export function cariTitikPenggal(kata) {
  if (typeof kata !== 'string' || kata.length < PANJANG_MIN) return [];

  const titik = [];
  let i = 0;

  // Langkau konsonan pembuka ("str" dalam "struktur") — tiada penggal sebelum vokal pertama.
  while (i < kata.length && !adalahVokal(kata[i].toLowerCase())) i++;

  while (i < kata.length) {
    // `i` menunjuk pada vokal. Cari vokal seterusnya, sambil mengira unit konsonan di antaranya.
    if (adalahDiftongHujung(kata, i)) break;

    let j = i + 1;
    const unit = [];
    while (j < kata.length && !adalahVokal(kata[j].toLowerCase())) {
      const panjang = panjangUnitKonsonan(kata, j);
      unit.push({ mula: j, panjang });
      j += panjang;
    }

    if (j >= kata.length) break; // Konsonan penutup — tiada vokal lagi, tiada penggal.

    // `j` ialah vokal seterusnya. Tentukan titik penggal ikut bilangan unit konsonan.
    let penggal;
    if (unit.length === 0) {
      penggal = j;                                   // V-V   : "ba-ik"
    } else if (unit.length === 1) {
      penggal = unit[0].mula;                        // V-KV  : "ba-ca"
    } else {
      penggal = unit[1].mula;                        // VK-KV : "ban-tu" / VK-KKV : "ins-tru"
    }

    if (penggal >= SERPIHAN_MIN && kata.length - penggal >= SERPIHAN_MIN) {
      titik.push(penggal);
    }
    i = j;
  }

  return titik;
}

/**
 * Sisip soft hyphen pada setiap titik penggal SATU perkataan.
 * Perkataan yang mengandungi aksara bukan-huruf (angka, tanda sempang, URL) dibiarkan
 * sepenuhnya — peraturan suku kata di atas hanya sah untuk ejaan Melayu biasa, dan meneka
 * pada URL/kod hanya akan merosakkannya.
 */
function penggalSatuPerkataan(kata) {
  if (!/^[A-Za-zÀ-ÿ']+$/.test(kata)) return kata;

  // Pengecualian editor diperiksa DAHULU, sebelum algoritma (K)(K)V(K) — lihat komen
  // pengecualianPemenggalan di atas. Tiada had PANJANG_MIN di sini (tak macam cariTitikPenggal)
  // sebab editor mungkin sengaja mahu pengecualian pada perkataan pendek juga.
  const override = pengecualianPemenggalan.get(kata.toLowerCase());
  const titik = override || cariTitikPenggal(kata);
  if (titik.length === 0) return kata;

  let hasil = '';
  let sebelum = 0;
  for (const t of titik) {
    hasil += kata.slice(sebelum, t) + SOFT_HYPHEN;
    sebelum = t;
  }
  return hasil + kata.slice(sebelum);
}

/**
 * Sisip soft hyphen ke dalam SEMUA perkataan panjang dalam satu rentetan teks.
 *
 * Selamat dipanggil pada teks yang sudah mengandungi soft hyphen (idempoten) — aksara
 * U+00AD sedia ada digugurkan dahulu supaya tidak bertimbun jika fungsi ini dipanggil dua
 * kali pada teks yang sama.
 *
 * @param {string} teks Teks editorial mentah.
 * @returns {string} Teks sama, cuma dengan titik penggal tak kelihatan disisipkan.
 */
export function penggalSukuKata(teks) {
  if (typeof teks !== 'string' || teks === '') return teks;

  return teks
    .split(SOFT_HYPHEN).join('')
    .replace(/[A-Za-zÀ-ÿ']+/g, (kata) => penggalSatuPerkataan(kata));
}
