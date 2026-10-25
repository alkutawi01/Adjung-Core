// Notifikasi tolak (Web Push) kepada pembaca — 2026-10-25, permintaan Izzat (rujukan: amaran
// "Breaking Alert" aplikasi Monitor World di telefon pembaca).
//
// Keputusan Izzat (jawapan soalan 25/10):
//   - PENCETUS: mana-mana kandungan yang diterbitkan dalam mana-mana slot KECUALI Ticker (slotIndex -1)
//     dan tier BAR. Automatik, tiada butang "hantar" editor.
//   - PENERIMA: semua pelanggan, SATU saluran (tiada pilihan Bidang).
//   - SKOP: versi asas — tajuk dihantar, ketik terus ke artikel.
//
// SENI BINA: pengesan berkala (poller), BUKAN cangkuk pada setiap laluan terbit. Kandungan boleh
// menjadi 'approved' melalui banyak laluan (Terbit sekarang, kelulusan Ketua Editor, Jadual Terbit,
// Terbit semula daripada draf) dan memasang cangkuk di setiap satu terlalu rapuh. Pengesan cuma
// bertanya "objek mana yang kini aktif dan belum pernah diberitahu?" — apa pun laluan terbitnya.
//
// KESELAMATAN PEMBACA (kerana pencetus automatik, bukan manual):
//   - SEMAI SENYAP kali pertama: semua kandungan aktif ketika ciri ini mula berjalan ditanda
//     "sudah" tanpa dihantar — tanpa ini ratusan artikel sedia ada akan membanjiri pelanggan pertama.
//   - Setiap objek diberitahu SEKALI SAHAJA seumur hidup (suntingan tidak mencetuskan semula).
//   - Hanya kandungan SEGAR (revisi terkini dikemas kini dalam tempoh FRESH_MS) — kandungan lama yang
//     dipulihkan ke aktif tidak menjadi "berita baharu".
//   - MASA TENANG 5 minit selepas terbit sebelum diberitahu, supaya tajuk yang silap atau artikel yang
//     ditarik balik sejurus selepas terbit tidak sempat sampai ke telefon pembaca.
//   - JEDA minimum antara dua penghantaran; kandungan yang terkumpul dalam jeda dilipat jadi SATU
//     notifikasi ("N berita baharu"), bukan N notifikasi (cth Izzat terbit 30 artikel serentak).
//   - HAD HARIAN notifikasi supaya pembaca tidak jemu dan mematikan terus.
//   - WAKTU SENYAP (waktu Malaysia): tiada penghantaran 23:00 hingga 06:30; kandungan menunggu pagi.
//   - SUIS PADAM (push_tetapan.aktif) untuk Ketua Editor jika sesuatu tidak kena.
//
// Fungsi keputusan (dalamWaktuSenyap, pilihTindakan, binaPayload) TULEN dan diuji
// (tests/pushService.test.js); penghantaran sebenar disuntik (`hantar`) supaya ujian tak sentuh rangkaian.

import crypto from 'crypto';
import { tierForSlot } from '../editorial/GeometryConfig.js';

export const JEDA_MIN_MS = 10 * 60 * 1000;
export const FRESH_MS = 14 * 60 * 60 * 1000;
// Masa tenang: kandungan mesti sudah aktif sekurang-kurangnya TENANG_MS sebelum diberitahu. Editor
// lazimnya menyunting atau menarik balik sejurus selepas terbit (cth artikel ditarik beberapa saat
// kemudian); notifikasi yang sudah sampai ke telefon pembaca TIDAK boleh ditarik balik, jadi beri
// ruang untuk kesilapan dibetulkan DAHULU. Kandungan yang diarkib dalam tempoh ini tidak pernah dihantar.
export const TENANG_MS = 5 * 60 * 1000;
export const HAD_HARIAN = 10;
export const SENYAP_MULA_MIN = 23 * 60;        // 23:00 waktu Malaysia
export const SENYAP_TAMAT_MIN = 6 * 60 + 30;   // 06:30 waktu Malaysia
export const BATCH_PENERIMA = 25;
export const GAGAL_BERTURUT_BUANG = 5;
const UTC_OFFSET_MYT_MIN = 8 * 60;

/** Minit sejak tengah malam, waktu Malaysia (UTC+8, tiada waktu musim panas). */
export function minitMYT(tarikh) {
  const d = new Date(tarikh);
  const jumlah = d.getUTCHours() * 60 + d.getUTCMinutes() + UTC_OFFSET_MYT_MIN;
  return ((jumlah % 1440) + 1440) % 1440;
}

export function dalamWaktuSenyap(tarikh) {
  const m = minitMYT(tarikh);
  return m >= SENYAP_MULA_MIN || m < SENYAP_TAMAT_MIN;
}

/** Kandungan layak jadi notifikasi: slot biasa sahaja (bukan Ticker, bukan Bar). */
export function slotLayak(slotIndex) {
  if (typeof slotIndex !== 'number' || slotIndex < 0) return false;
  const tier = tierForSlot(slotIndex);
  return tier !== 'BAR' && tier !== 'TICKER';
}

/**
 * Keputusan penghantaran. `calon` = kandungan belum diberitahu (sudah ditapis layak + segar).
 * Pulangkan { tindakan: 'tiada' | 'tunggu' | 'hantar', sebab }.
 */
export function pilihTindakan({ calon, sekarang, hantarTerakhirMs, bilHantarHariIni, aktif }) {
  if (!aktif) return { tindakan: 'tiada', sebab: 'dimatikan' };
  if (!calon.length) return { tindakan: 'tiada', sebab: 'tiada kandungan baharu' };
  if (dalamWaktuSenyap(sekarang)) return { tindakan: 'tunggu', sebab: 'waktu senyap' };
  if (hantarTerakhirMs != null && sekarang - hantarTerakhirMs < JEDA_MIN_MS) {
    return { tindakan: 'tunggu', sebab: 'jeda antara notifikasi' };
  }
  if (bilHantarHariIni >= HAD_HARIAN) return { tindakan: 'tunggu', sebab: 'had harian dicapai' };
  return { tindakan: 'hantar', sebab: 'sedia' };
}

const potong = (teks, had) => {
  const t = String(teks || '').replace(/\s+/g, ' ').trim();
  if (t.length <= had) return t;
  const p = t.slice(0, had - 1);
  const ruang = p.lastIndexOf(' ');
  return (ruang > had * 0.6 ? p.slice(0, ruang) : p).replace(/[\s,;:.-]+$/, '') + '…';
};

/**
 * Isi notifikasi. Satu kandungan: tajuk = nama Bidang, badan = tajuk artikel, ketik -> artikel.
 * Banyak: "N berita baharu", badan = beberapa tajuk teratas, ketik -> halaman utama.
 * `calon` diisih terbaharu dahulu oleh pemanggil.
 */
export function binaPayload(calon) {
  if (calon.length === 1) {
    const c = calon[0];
    return {
      title: c.bidang || 'Adjung Brief',
      body: potong(c.title, 140),
      url: c.laluan || '/',
      tag: 'adjung-berita-' + c.id,
    };
  }
  const atas = calon.slice(0, 3).map((c) => potong(c.title, 70));
  const lebih = calon.length > 3 ? ` dan ${calon.length - 3} lagi` : '';
  return {
    title: `${calon.length} berita baharu`,
    body: atas.join(' • ') + lebih,
    url: '/',
    tag: 'adjung-berita-kelompok',
  };
}

// ---- Pangkalan data -------------------------------------------------------------------------

export async function pastikanSkema(dbRun, dbGet, webpush) {
  await dbRun(`CREATE TABLE IF NOT EXISTS push_langganan (
    id TEXT PRIMARY KEY, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
    createdAt TEXT, lastSeenAt TEXT, gagalBerturut INTEGER DEFAULT 0)`);
  await dbRun(`CREATE TABLE IF NOT EXISTS push_dihantar (
    objectId TEXT PRIMARY KEY, dihantarPada TEXT, jenis TEXT)`);
  await dbRun(`CREATE TABLE IF NOT EXISTS push_tetapan (
    id TEXT PRIMARY KEY, aktif INTEGER DEFAULT 1, vapidPublic TEXT, vapidPrivate TEXT,
    disemai INTEGER DEFAULT 0, hantarTerakhir TEXT)`);
  await dbRun(`CREATE TABLE IF NOT EXISTS push_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, masa TEXT, bilKandungan INTEGER, bilPenerima INTEGER,
    bilBerjaya INTEGER, ringkasan TEXT)`);
  let tetapan = await dbGet(`SELECT * FROM push_tetapan WHERE id = 'main'`);
  if (!tetapan) {
    await dbRun(`INSERT INTO push_tetapan (id, aktif, disemai) VALUES ('main', 1, 0)`);
    tetapan = await dbGet(`SELECT * FROM push_tetapan WHERE id = 'main'`);
  }
  if (!tetapan.vapidPublic || !tetapan.vapidPrivate) {
    const kunci = webpush.generateVAPIDKeys();
    await dbRun(`UPDATE push_tetapan SET vapidPublic = ?, vapidPrivate = ? WHERE id = 'main'`, [kunci.publicKey, kunci.privateKey]);
    tetapan = await dbGet(`SELECT * FROM push_tetapan WHERE id = 'main'`);
  }
  return tetapan;
}

const SQL_KANDUNGAN_AKTIF = `
  SELECT eo.id AS id, eo.slotIndex AS slotIndex, er.title AS title, er.updatedAt AS masa,
         COALESCE(
           (SELECT av.valueText FROM editorial_attribute_values av
              JOIN editorial_revisions r2 ON r2.id = av.revisionId
             WHERE av.objectId = eo.id AND av.attributeId = 'desk'
             ORDER BY r2.version DESC LIMIT 1),
           eo.categoryId) AS bidang
  FROM editorial_objects eo
  JOIN editorial_revisions er ON er.objectId = eo.id
   AND er.version = (SELECT MAX(r3.version) FROM editorial_revisions r3 WHERE r3.objectId = eo.id AND r3.language = 'ms')
  WHERE er.language = 'ms' AND er.status = 'approved'`;

/** Semai senyap: tanda semua kandungan aktif sedia ada sebagai "sudah" tanpa menghantar apa-apa. */
export async function semaiSenyap(dbAll, dbRun) {
  const semua = await dbAll(SQL_KANDUNGAN_AKTIF);
  const kini = new Date().toISOString();
  for (const k of semua) {
    await dbRun(`INSERT OR IGNORE INTO push_dihantar (objectId, dihantarPada, jenis) VALUES (?, ?, 'semai')`, [k.id, kini]);
  }
  await dbRun(`UPDATE push_tetapan SET disemai = 1 WHERE id = 'main'`);
  return semua.length;
}

const hurufBesarAwal = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Kandungan aktif, belum diberitahu, layak (slot) dan segar — terbaharu dahulu. */
export async function cariCalon(dbAll, sekarang) {
  const baris = await dbAll(`${SQL_KANDUNGAN_AKTIF}
    AND NOT EXISTS (SELECT 1 FROM push_dihantar p WHERE p.objectId = eo.id)`);
  return baris
    .filter((k) => slotLayak(k.slotIndex))
    .map((k) => ({ ...k, masaMs: Date.parse(k.masa) }))
    .filter((k) => Number.isFinite(k.masaMs) && sekarang - k.masaMs <= FRESH_MS && sekarang - k.masaMs >= TENANG_MS)
    .sort((a, b) => b.masaMs - a.masaMs)
    .map((k) => ({ ...k, bidang: hurufBesarAwal(String(k.bidang || '').toLowerCase()) }));
}

/**
 * Satu pusingan pengesan. Semua kebergantungan luar disuntik: `hantar(langganan, payload)` pulang
 * { ok: true } atau { ok: false, gone: boolean }, `binaLaluan(objectId)` pulang laluan artikel.
 */
export async function jalankanSekali({ dbAll, dbGet, dbRun, hantar, binaLaluan, sekarang = Date.now() }) {
  const tetapan = await dbGet(`SELECT * FROM push_tetapan WHERE id = 'main'`);
  if (!tetapan) return { tindakan: 'tiada', sebab: 'skema belum sedia' };
  if (!tetapan.disemai) {
    const n = await semaiSenyap(dbAll, dbRun);
    return { tindakan: 'tiada', sebab: `semai senyap ${n} kandungan` };
  }
  const calon = await cariCalon(dbAll, sekarang);
  const sejak = new Date(sekarang - 24 * 3600 * 1000).toISOString();
  const bilHariIni = (await dbGet(`SELECT COUNT(*) AS n FROM push_log WHERE masa >= ? AND bilBerjaya > 0`, [sejak]))?.n || 0;
  const keputusan = pilihTindakan({
    calon, sekarang, bilHantarHariIni: bilHariIni, aktif: !!tetapan.aktif,
    hantarTerakhirMs: tetapan.hantarTerakhir ? Date.parse(tetapan.hantarTerakhir) : null,
  });
  if (keputusan.tindakan !== 'hantar') return { ...keputusan, bilCalon: calon.length };

  for (const c of calon) c.laluan = await binaLaluan(c.id).catch(() => null);
  const payload = binaPayload(calon);
  const langganan = await dbAll(`SELECT * FROM push_langganan`);
  let berjaya = 0;
  for (let i = 0; i < langganan.length; i += BATCH_PENERIMA) {
    const kumpulan = langganan.slice(i, i + BATCH_PENERIMA);
    const hasil = await Promise.all(kumpulan.map((l) => hantar(l, payload).catch(() => ({ ok: false, gone: false }))));
    for (let j = 0; j < kumpulan.length; j++) {
      const l = kumpulan[j]; const h = hasil[j];
      if (h.ok) {
        berjaya++;
        if (l.gagalBerturut) await dbRun(`UPDATE push_langganan SET gagalBerturut = 0 WHERE id = ?`, [l.id]);
      } else if (h.gone || (l.gagalBerturut || 0) + 1 >= GAGAL_BERTURUT_BUANG) {
        await dbRun(`DELETE FROM push_langganan WHERE id = ?`, [l.id]);
      } else {
        await dbRun(`UPDATE push_langganan SET gagalBerturut = COALESCE(gagalBerturut, 0) + 1 WHERE id = ?`, [l.id]);
      }
    }
  }
  const kini = new Date(sekarang).toISOString();
  for (const c of calon) {
    await dbRun(`INSERT OR IGNORE INTO push_dihantar (objectId, dihantarPada, jenis) VALUES (?, ?, 'hantar')`, [c.id, kini]);
  }
  await dbRun(`UPDATE push_tetapan SET hantarTerakhir = ? WHERE id = 'main'`, [kini]);
  await dbRun(
    `INSERT INTO push_log (masa, bilKandungan, bilPenerima, bilBerjaya, ringkasan) VALUES (?, ?, ?, ?, ?)`,
    [kini, calon.length, langganan.length, berjaya, `${payload.title}: ${payload.body}`.slice(0, 300)]
  );
  return { tindakan: 'hantar', bilCalon: calon.length, penerima: langganan.length, berjaya, payload };
}

// ---- Pengesahan langganan masuk -------------------------------------------------------------

// Hanya perkhidmatan tolak pelayar sebenar. WAJIB: pelayan menghantar permintaan HTTP ke
// `endpoint` yang tersimpan — tanpa senarai putih, sesiapa boleh daftar endpoint ke alamat dalaman
// (SSRF) dan pelayan kita akan memanggilnya setiap kali ada berita.
const HOST_PUSH_DIBENARKAN = [
  /(^|\.)fcm\.googleapis\.com$/i,
  /(^|\.)push\.services\.mozilla\.com$/i,
  /(^|\.)push\.apple\.com$/i,
  /(^|\.)notify\.windows\.com$/i,
];
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

export function sahkanLangganan(badan) {
  const endpoint = badan?.endpoint;
  const p256dh = badan?.keys?.p256dh;
  const auth = badan?.keys?.auth;
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return { ok: false, ralat: 'Endpoint tidak sah.' };
  let url;
  try { url = new URL(endpoint); } catch { return { ok: false, ralat: 'Endpoint tidak sah.' }; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return { ok: false, ralat: 'Endpoint tidak sah.' };
  if (!HOST_PUSH_DIBENARKAN.some((r) => r.test(url.hostname))) return { ok: false, ralat: 'Perkhidmatan notifikasi pelayar ini tidak disokong.' };
  if (typeof p256dh !== 'string' || p256dh.length < 40 || p256dh.length > 200 || !BASE64URL.test(p256dh)) return { ok: false, ralat: 'Kunci tidak sah.' };
  if (typeof auth !== 'string' || auth.length < 8 || auth.length > 100 || !BASE64URL.test(auth)) return { ok: false, ralat: 'Kunci tidak sah.' };
  return { ok: true, endpoint, p256dh, auth };
}

export async function simpanLangganan(dbGet, dbRun, { endpoint, p256dh, auth }) {
  const kini = new Date().toISOString();
  const sedia = await dbGet(`SELECT id FROM push_langganan WHERE endpoint = ?`, [endpoint]);
  if (sedia) {
    await dbRun(`UPDATE push_langganan SET p256dh = ?, auth = ?, lastSeenAt = ?, gagalBerturut = 0 WHERE id = ?`, [p256dh, auth, kini, sedia.id]);
    return { baharu: false };
  }
  await dbRun(
    `INSERT INTO push_langganan (id, endpoint, p256dh, auth, createdAt, lastSeenAt, gagalBerturut) VALUES (?, ?, ?, ?, ?, ?, 0)`,
    ['psh-' + crypto.randomBytes(8).toString('hex'), endpoint, p256dh, auth, kini, kini]
  );
  return { baharu: true };
}

/** Penghantar sebenar menggunakan pustaka web-push. */
export function binaPenghantarSebenar(webpush, { vapidPublic, vapidPrivate }) {
  webpush.setVapidDetails('https://brief.adjung.com', vapidPublic, vapidPrivate);
  return async (langganan, payload) => {
    try {
      await webpush.sendNotification(
        { endpoint: langganan.endpoint, keys: { p256dh: langganan.p256dh, auth: langganan.auth } },
        JSON.stringify(payload),
        { TTL: 6 * 3600, urgency: 'normal' }
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, gone: err?.statusCode === 404 || err?.statusCode === 410 };
    }
  };
}
