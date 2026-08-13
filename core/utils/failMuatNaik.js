import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Pembersihan fail muat naik yatim (STORAGE-002, audit #47.11/#48.9.5, 2026-08-13).
//
// Sebelum ni TIADA laluan padam pun memanggil fs.unlink — fail imej kekal di cakera SELAMANYA
// walaupun kandungan yang merujuknya dipadam kekal. Dua akibat: (a) cakera membesar tanpa had,
// (b) lampiran kandungan yang "dipadam" masih boleh dicapai sesiapa yang tahu/teka URLnya
// (lihat juga nama fail rawak di mediaRoutes.js — sebelum ni timestamp+nama asal sahaja).
//
// FALSAFAH KEGAGALAN: kalau kita TAK DAPAT BUKTIKAN sesuatu fail sudah tiada rujukan, fail itu
// DIKEKALKAN. Ralat pertanyaan, jadual hilang, nilai pelik — semuanya dilayan sebagai "mungkin
// masih dirujuk". Meninggalkan fail yatim cuma membazir ruang; memadam fail yang MASIH dirujuk
// memecahkan kandungan hidup, dan tiada backup fail media (CLAUDE.md: tiada backup boleh
// dipercayai). Berat sebelah ke arah menyimpan, sentiasa.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_MUAT_NAIK = path.resolve(__dirname, '..', '..', 'public', 'uploads');

/** Awalan URL yang benar-benar menunjuk ke folder muat naik kita sendiri. */
const AWALAN_MUAT_NAIK = '/uploads/';

/**
 * Tukar nilai atribut tersimpan kepada NAMA FAIL selamat dalam folder muat naik, atau null.
 *
 * Menolak apa-apa yang bukan laluan /uploads/ tempatan (URL luar, teks kosong, nilai bukan
 * rentetan), dan menolak sebarang nama yang tak duduk TERUS dalam folder muat naik selepas
 * diselesaikan (pertahanan path traversal — nilai atribut datang daripada input editor, jadi
 * ia TIDAK dipercayai walaupun laluan tulisnya digerbang).
 */
export function namaFailMuatNaik(nilai) {
  if (typeof nilai !== 'string') return null;
  const teks = nilai.trim();
  if (!teks.startsWith(AWALAN_MUAT_NAIK)) return null;
  const tanpaQuery = teks.split(/[?#]/)[0];
  const baki = tanpaQuery.slice(AWALAN_MUAT_NAIK.length);

  // SATU segmen nama fail sahaja, aksara terhad. Sengaja MENOLAK (bukan "membetulkan") apa-apa
  // yang mengandungi pemisah laluan, segmen `..`, pengekodan peratus atau aksara luar jangkaan.
  // Mengambil basename() daripada laluan bersarang memang sudah selamat dari segi containment
  // (hasilnya tetap duduk dalam folder muat naik), TETAPI ia menulis semula input pelik menjadi
  // nama fail SAH yang lain — cth "/uploads/../../../etc/passwd" jadi "passwd", lalu kita cuba
  // padam public/uploads/passwd yang bukan fail yang dirujuk sesiapa. Menolak terus lebih jujur
  // pada niat fungsi ni dan mengekalkan hala berat sebelah "kalau ragu, JANGAN padam".
  // Julat aksara ni tepat meliputi nama yang mediaRoutes.js sendiri jana:
  // `${cap masa}-${16 hex}-${nama asas [A-Za-z0-9_-]}${sambungan}`.
  if (!/^[A-Za-z0-9._-]+$/.test(baki)) return null;
  if (baki === '.' || baki === '..') return null;

  const penuh = path.resolve(DIR_MUAT_NAIK, baki);
  // Jaring terakhir: hasil yang diselesaikan mesti duduk TEPAT dalam folder muat naik.
  if (path.dirname(penuh) !== DIR_MUAT_NAIK) return null;
  return baki;
}

/**
 * Setiap tempat dalam pangkalan data yang boleh menyimpan URL fail muat naik. Kalau satu jadual
 * baharu menyimpan URL imej kelak, TAMBAH DI SINI — kalau tidak, pembersihan boleh memadam fail
 * yang jadual itu masih rujuk.
 *
 * `static_pages.content` dan `system_settings.inTheNewsText` ialah blob teks bebas yang boleh
 * MENGANDUNGI URL imej di tengah-tengah kandungan (bukan lajur URL tulen) — sebab itu semakan
 * guna LIKE %nama%, bukan padanan tepat.
 */
const TAPAK_RUJUKAN = [
  { jadual: 'editorial_attribute_values', lajur: 'valueText' },
  { jadual: 'slots_config', lajur: 'manualImageUrl' },
  { jadual: 'slot_am_settings', lajur: 'logoPenaja' },
  { jadual: 'sponsors', lajur: 'logoUrl' },
  { jadual: 'static_pages', lajur: 'content' },
  { jadual: 'system_settings', lajur: 'inTheNewsText' },
];

/**
 * Kutip nama fail muat naik daripada senarai baris atribut ({ valueText }) — nyahduplikasi.
 * Dipanggil SEBELUM baris dipadam (selepas itu nilainya dah hilang).
 */
export function kutipNamaFailDariAtribut(barisAtribut) {
  const set = new Set();
  for (const baris of barisAtribut || []) {
    const nama = namaFailMuatNaik(baris && baris.valueText);
    if (nama) set.add(nama);
  }
  return [...set];
}

/**
 * Padam fail muat naik yang sudah TIADA rujukan di mana-mana. Dipanggil SELEPAS penulisan DB
 * (padam baris) berjaya — bukan sebelum, dan tidak sekali-kali di dalam transaksi: fail yang
 * sudah dipadam tak boleh "digulung semula" kalau transaksi itu gagal kemudian.
 *
 * Pulangkan { dipadam: string[], dikekalkan: string[] } untuk log/ujian.
 */
export async function padamFailMuatNaikYatim(dbGet, senaraiNama, { konteks = 'padam-kandungan' } = {}) {
  const dipadam = [];
  const dikekalkan = [];

  for (const nama of senaraiNama || []) {
    let masihDirujuk = false;

    for (const tapak of TAPAK_RUJUKAN) {
      try {
        const baris = await dbGet(
          `SELECT 1 AS ada FROM ${tapak.jadual} WHERE ${tapak.lajur} LIKE ? LIMIT 1`,
          [`%${nama}%`]
        );
        if (baris) { masihDirujuk = true; break; }
      } catch (e) {
        // Jadual/lajur tak wujud pada pemasangan ni, atau pertanyaan gagal — anggap MASIH
        // dirujuk (lihat falsafah kegagalan di atas), jangan padam.
        console.warn(`[Fail muat naik] Semakan rujukan ${tapak.jadual}.${tapak.lajur} gagal untuk "${nama}" — fail dikekalkan:`, e.message);
        masihDirujuk = true;
        break;
      }
    }

    if (masihDirujuk) { dikekalkan.push(nama); continue; }

    const laluan = path.resolve(DIR_MUAT_NAIK, nama);
    try {
      await fs.promises.unlink(laluan);
      dipadam.push(nama);
    } catch (e) {
      // ENOENT = fail memang dah tiada (dipadam manual, atau tak pernah wujud) — bukan ralat.
      if (e.code !== 'ENOENT') {
        console.warn(`[Fail muat naik] Gagal padam "${nama}" (${konteks}):`, e.message);
      }
      dikekalkan.push(nama);
    }
  }

  return { dipadam, dikekalkan };
}
