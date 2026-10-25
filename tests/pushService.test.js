import { test } from 'node:test';
import assert from 'node:assert/strict';
import sqlite3 from 'sqlite3';
import webpush from 'web-push';
import {
  dalamWaktuSenyap, minitMYT, slotLayak, pilihTindakan, binaPayload, sahkanLangganan,
  pastikanSkema, jalankanSekali, simpanLangganan, JEDA_MIN_MS, FRESH_MS, HAD_HARIAN, TENANG_MS,
} from '../core/push/PushService.js';

// ---- fungsi tulen --------------------------------------------------------------------------

// Waktu Malaysia = UTC+8. 2026-10-25T15:00Z ialah 23:00 MYT; 22:29Z ialah 06:29 MYT.
const utc = (s) => Date.parse(s);

test('waktu senyap: 23:00 hingga 06:30 waktu Malaysia, sempadan tepat', () => {
  assert.equal(minitMYT(utc('2026-10-25T15:00:00Z')), 23 * 60);
  assert.equal(dalamWaktuSenyap(utc('2026-10-25T14:59:00Z')), false); // 22:59 MYT
  assert.equal(dalamWaktuSenyap(utc('2026-10-25T15:00:00Z')), true);  // 23:00 MYT
  assert.equal(dalamWaktuSenyap(utc('2026-10-25T18:00:00Z')), true);  // 02:00 MYT
  assert.equal(dalamWaktuSenyap(utc('2026-10-25T22:29:00Z')), true);  // 06:29 MYT
  assert.equal(dalamWaktuSenyap(utc('2026-10-25T22:30:00Z')), false); // 06:30 MYT
  assert.equal(dalamWaktuSenyap(utc('2026-10-25T04:00:00Z')), false); // 12:00 MYT
});

test('slot layak: bukan Ticker (-1) dan bukan Bar', () => {
  assert.equal(slotLayak(-1), false);
  for (const bar of [7, 8, 9, 10, 21, 22, 23, 24]) assert.equal(slotLayak(bar), false, 'bar ' + bar);
  for (const biasa of [0, 1, 2, 11, 12, 29, 37]) assert.equal(slotLayak(biasa), true, 'slot ' + biasa);
  assert.equal(slotLayak(undefined), false);
  assert.equal(slotLayak(null), false);
});

test('pilihTindakan: semua sebab tunggu/tiada dan keadaan hantar', () => {
  const siang = utc('2026-10-25T04:00:00Z');
  const asas = { calon: [{ id: 'a' }], sekarang: siang, hantarTerakhirMs: null, bilHantarHariIni: 0, aktif: true };
  assert.equal(pilihTindakan(asas).tindakan, 'hantar');
  assert.equal(pilihTindakan({ ...asas, aktif: false }).tindakan, 'tiada');
  assert.equal(pilihTindakan({ ...asas, calon: [] }).tindakan, 'tiada');
  assert.equal(pilihTindakan({ ...asas, sekarang: utc('2026-10-25T18:00:00Z') }).tindakan, 'tunggu');
  assert.equal(pilihTindakan({ ...asas, hantarTerakhirMs: siang - (JEDA_MIN_MS - 1000) }).tindakan, 'tunggu');
  assert.equal(pilihTindakan({ ...asas, hantarTerakhirMs: siang - JEDA_MIN_MS }).tindakan, 'hantar');
  assert.equal(pilihTindakan({ ...asas, bilHantarHariIni: HAD_HARIAN }).tindakan, 'tunggu');
});

test('binaPayload: satu kandungan tunjuk Bidang + tajuk + laluan; banyak dilipat jadi satu', () => {
  const satu = binaPayload([{ id: 'x1', title: 'Penemuan baharu', bidang: 'Sains', laluan: '/sains/kandungan/abc' }]);
  assert.deepEqual([satu.title, satu.body, satu.url], ['Sains', 'Penemuan baharu', '/sains/kandungan/abc']);
  const banyak = binaPayload([1, 2, 3, 4, 5].map((n) => ({ id: 'x' + n, title: 'Tajuk ' + n, bidang: 'Sains', laluan: '/x' + n })));
  assert.equal(banyak.title, '5 berita baharu');
  assert.equal(banyak.url, '/');
  assert.ok(banyak.body.includes('Tajuk 1') && banyak.body.includes('dan 2 lagi'));
  const panjang = binaPayload([{ id: 'p', title: 'a '.repeat(200), bidang: '', laluan: null }]);
  assert.ok(panjang.body.length <= 141);
  assert.equal(panjang.url, '/');
  assert.equal(panjang.title, 'Adjung Brief');
});

test('sahkanLangganan: terima perkhidmatan pelayar sebenar, tolak SSRF dan kunci rosak', () => {
  const kunci = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) };
  const ok = (endpoint) => sahkanLangganan({ endpoint, keys: kunci }).ok;
  assert.equal(ok('https://fcm.googleapis.com/fcm/send/abc'), true);
  assert.equal(ok('https://updates.push.services.mozilla.com/wpush/v2/abc'), true);
  assert.equal(ok('https://web.push.apple.com/abc'), true);
  assert.equal(ok('https://wns2-par02p.notify.windows.com/w/?token=abc'), true);
  assert.equal(ok('http://fcm.googleapis.com/fcm/send/abc'), false);
  assert.equal(ok('https://127.0.0.1/x'), false);
  assert.equal(ok('https://169.254.169.254/latest/meta-data'), false);
  assert.equal(ok('https://evil.example.com/fcm.googleapis.com'), false);
  assert.equal(ok('https://fcm.googleapis.com.evil.example.com/x'), false);
  assert.equal(ok('https://user:pw@fcm.googleapis.com/x'), false);
  assert.equal(ok('https://fcm.googleapis.com:8443/x'), false);
  assert.equal(ok('bukan url'), false);
  assert.equal(sahkanLangganan({ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'pendek', auth: kunci.auth } }).ok, false);
  assert.equal(sahkanLangganan({ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: kunci.p256dh, auth: '<script>' } }).ok, false);
  assert.equal(sahkanLangganan(null).ok, false);
});

// ---- pusingan penuh dengan pangkalan data dalam memori ----------------------------------

function bukaDb() {
  const db = new sqlite3.Database(':memory:');
  const dbRun = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));
  const dbGet = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
  const dbAll = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
  return { db, dbRun, dbGet, dbAll };
}

async function sediakanPangkalan() {
  const d = bukaDb();
  await d.dbRun(`CREATE TABLE editorial_objects (id TEXT PRIMARY KEY, slotIndex INTEGER, categoryId TEXT)`);
  await d.dbRun(`CREATE TABLE editorial_revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, objectId TEXT, version REAL, language TEXT DEFAULT 'ms', title TEXT, status TEXT, updatedAt TEXT)`);
  await d.dbRun(`CREATE TABLE editorial_attribute_values (id INTEGER PRIMARY KEY AUTOINCREMENT, objectId TEXT, revisionId INTEGER, attributeId TEXT, valueText TEXT)`);
  await pastikanSkema(d.dbRun, d.dbGet, webpush);
  return d;
}

async function terbit(d, id, slotIndex, tajuk, masaIso, status = 'approved', bidang = 'SAINS') {
  await d.dbRun(`INSERT INTO editorial_objects (id, slotIndex, categoryId) VALUES (?, ?, ?)`, [id, slotIndex, bidang]);
  await d.dbRun(`INSERT INTO editorial_revisions (objectId, version, language, title, status, updatedAt) VALUES (?, 1, 'ms', ?, ?, ?)`, [id, tajuk, status, masaIso]);
}

const KUNCI = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) };
async function langgan(d, n) {
  for (let i = 0; i < n; i++) await simpanLangganan(d.dbGet, d.dbRun, { endpoint: `https://fcm.googleapis.com/fcm/send/${i}`, ...KUNCI });
}
const penghantar = (log, balas = () => ({ ok: true })) => async (l, payload) => { log.push({ endpoint: l.endpoint, payload }); return balas(l); };
const binaLaluan = async (id) => '/sains/kandungan/' + id;
const SIANG = utc('2026-10-25T04:00:00Z'); // 12:00 MYT

test('pastikanSkema: kunci VAPID dijana sekali dan kekal sama', async () => {
  const d = await sediakanPangkalan();
  const t1 = await d.dbGet(`SELECT vapidPublic, vapidPrivate FROM push_tetapan WHERE id='main'`);
  assert.ok(t1.vapidPublic.length > 60 && t1.vapidPrivate.length > 30);
  const t2 = await pastikanSkema(d.dbRun, d.dbGet, webpush);
  assert.equal(t2.vapidPublic, t1.vapidPublic);
});

test('pusingan pertama menyemai senyap: kandungan sedia ada TIDAK dihantar', async () => {
  const d = await sediakanPangkalan();
  await langgan(d, 3);
  await terbit(d, 'lama1', 3, 'Artikel lama', new Date(SIANG - 60000).toISOString());
  await terbit(d, 'lama2', 4, 'Artikel lama dua', new Date(SIANG - 120000).toISOString());
  const log = [];
  const h1 = await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: SIANG });
  assert.equal(h1.tindakan, 'tiada');
  assert.equal(log.length, 0);
  const h2 = await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: SIANG + 60000 });
  assert.equal(h2.tindakan, 'tiada');
  assert.equal(log.length, 0);
});

test('kandungan baharu dihantar kepada semua pelanggan, SEKALI sahaja', async () => {
  const d = await sediakanPangkalan();
  await langgan(d, 3);
  await jalankanSekali({ ...d, hantar: penghantar([]), binaLaluan, sekarang: SIANG }); // semai
  await terbit(d, 'baru1', 3, 'Penemuan baharu tentang karang', new Date(SIANG + 30000).toISOString());
  const log = [];
  const h = await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: SIANG + 6 * 60000 });
  assert.equal(h.tindakan, 'hantar');
  assert.equal(log.length, 3);
  assert.equal(log[0].payload.body, 'Penemuan baharu tentang karang');
  assert.equal(log[0].payload.url, '/sains/kandungan/baru1');
  assert.equal(log[0].payload.title, 'Sains');
  const lagi = await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: SIANG + 20 * 60000 });
  assert.equal(lagi.tindakan, 'tiada');
  assert.equal(log.length, 3, 'tidak dihantar semula');
});

test('Ticker, Bar, draf dan kandungan basi TIDAK menjadi notifikasi', async () => {
  const d = await sediakanPangkalan();
  await langgan(d, 1);
  await jalankanSekali({ ...d, hantar: penghantar([]), binaLaluan, sekarang: SIANG });
  const segar = new Date(SIANG + 10000).toISOString();
  await terbit(d, 'ticker1', -1, 'Berita ticker', segar);
  await terbit(d, 'bar1', 7, 'Acara bar', segar);
  await terbit(d, 'draf1', 3, 'Masih draf', segar, 'pending');
  await terbit(d, 'basi1', 3, 'Terlalu lama', new Date(SIANG - FRESH_MS - 3600000).toISOString());
  await terbit(d, 'arkib1', 3, 'Diarkibkan', segar, 'archived');
  const log = [];
  const h = await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: SIANG + 6 * 60000 });
  assert.equal(h.tindakan, 'tiada');
  assert.equal(log.length, 0);
});

test('banyak kandungan serentak dilipat jadi SATU notifikasi', async () => {
  const d = await sediakanPangkalan();
  await langgan(d, 2);
  await jalankanSekali({ ...d, hantar: penghantar([]), binaLaluan, sekarang: SIANG });
  const slotBiasa = [0, 1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37];
  for (let i = 0; i < 30; i++) await terbit(d, 'n' + i, slotBiasa[i], 'Berita ' + i, new Date(SIANG + 1000 * i).toISOString());
  const log = [];
  const h = await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: SIANG + 7 * 60000 });
  assert.equal(h.tindakan, 'hantar');
  assert.equal(h.bilCalon, 30);
  assert.equal(log.length, 2, 'dua pelanggan, satu notifikasi setiap seorang');
  assert.equal(log[0].payload.title, '30 berita baharu');
  const baki = await d.dbGet(`SELECT COUNT(*) n FROM push_dihantar WHERE jenis = 'hantar'`);
  assert.equal(baki.n, 30);
});

test('waktu senyap menahan penghantaran; pagi esok baru dihantar', async () => {
  const d = await sediakanPangkalan();
  await langgan(d, 1);
  await jalankanSekali({ ...d, hantar: penghantar([]), binaLaluan, sekarang: SIANG });
  const malam = utc('2026-10-25T16:00:00Z'); // 00:00 MYT
  await terbit(d, 'malam1', 3, 'Terbit lewat malam', new Date(malam - 10 * 60000).toISOString());
  const log = [];
  const tahan = await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: malam });
  assert.equal(tahan.tindakan, 'tunggu');
  assert.equal(log.length, 0);
  const pagi = utc('2026-10-25T23:00:00Z'); // 07:00 MYT, masih dalam tempoh segar
  const h = await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: pagi });
  assert.equal(h.tindakan, 'hantar');
  assert.equal(log.length, 1);
});

test('jeda antara notifikasi dan had harian dihormati', async () => {
  const d = await sediakanPangkalan();
  await langgan(d, 1);
  await jalankanSekali({ ...d, hantar: penghantar([]), binaLaluan, sekarang: SIANG });
  const log = [];
  await terbit(d, 'a', 3, 'Pertama', new Date(SIANG + 1000).toISOString());
  assert.equal((await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: SIANG + 6 * 60000 })).tindakan, 'hantar');
  await terbit(d, 'b', 4, 'Kedua', new Date(SIANG + 120000).toISOString());
  const awal = await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: SIANG + 7 * 60000 });
  assert.equal(awal.tindakan, 'tunggu');
  assert.equal(log.length, 1);
  const lepas = await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: SIANG + 6 * 60000 + JEDA_MIN_MS + 1000 });
  assert.equal(lepas.tindakan, 'hantar');
  assert.equal(log.length, 2);
});

test('masa tenang: kandungan baharu menunggu 5 minit; yang ditarik balik dalam tempoh itu tidak pernah dihantar', async () => {
  const d = await sediakanPangkalan();
  await langgan(d, 1);
  await jalankanSekali({ ...d, hantar: penghantar([]), binaLaluan, sekarang: SIANG });
  await terbit(d, 'tenang1', 3, 'Akan dibetulkan', new Date(SIANG).toISOString());
  await terbit(d, 'tarik1', 4, 'Akan ditarik balik', new Date(SIANG).toISOString());
  const log = [];
  const awal = await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: SIANG + TENANG_MS - 1000 });
  assert.equal(awal.tindakan, 'tiada', 'belum cukup tenang');
  assert.equal(log.length, 0);
  // editor menarik balik satu artikel dan membetulkan tajuk yang lain dalam tempoh tenang
  await d.dbRun(`UPDATE editorial_revisions SET status = 'archived' WHERE objectId = 'tarik1'`);
  await d.dbRun(`UPDATE editorial_revisions SET title = 'Tajuk sudah dibetulkan' WHERE objectId = 'tenang1'`);
  const lepas = await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: SIANG + TENANG_MS + 1000 });
  assert.equal(lepas.tindakan, 'hantar');
  assert.equal(log.length, 1);
  assert.equal(log[0].payload.body, 'Tajuk sudah dibetulkan');
  const ditandaTarik = await d.dbGet(`SELECT 1 AS n FROM push_dihantar WHERE objectId = 'tarik1'`);
  assert.equal(ditandaTarik, undefined, 'artikel ditarik tidak pernah dihantar');
});

test('suis padam menghentikan semua penghantaran', async () => {
  const d = await sediakanPangkalan();
  await langgan(d, 1);
  await jalankanSekali({ ...d, hantar: penghantar([]), binaLaluan, sekarang: SIANG });
  await d.dbRun(`UPDATE push_tetapan SET aktif = 0 WHERE id='main'`);
  await terbit(d, 'x', 3, 'Tidak dihantar', new Date(SIANG + 1000).toISOString());
  const log = [];
  const h = await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: SIANG + 6 * 60000 });
  assert.equal(h.tindakan, 'tiada');
  assert.equal(log.length, 0);
  await d.dbRun(`UPDATE push_tetapan SET aktif = 1 WHERE id='main'`);
  assert.equal((await jalankanSekali({ ...d, hantar: penghantar(log), binaLaluan, sekarang: SIANG + 7 * 60000 })).tindakan, 'hantar');
});

test('langganan mati (410) dibuang; kegagalan sementara dikira dan dibuang selepas 5 kali', async () => {
  const d = await sediakanPangkalan();
  await langgan(d, 2);
  await jalankanSekali({ ...d, hantar: penghantar([]), binaLaluan, sekarang: SIANG });
  await terbit(d, 'm1', 3, 'Satu', new Date(SIANG + 1000).toISOString());
  const balas = (l) => (l.endpoint.endsWith('/0') ? { ok: false, gone: true } : { ok: false, gone: false });
  await jalankanSekali({ ...d, hantar: penghantar([], balas), binaLaluan, sekarang: SIANG + 6 * 60000 });
  let baki = await d.dbAll(`SELECT endpoint, gagalBerturut FROM push_langganan`);
  assert.equal(baki.length, 1, 'yang 410 dibuang serta-merta');
  assert.equal(baki[0].gagalBerturut, 1);
  let masa = SIANG + 6 * 60000;
  for (let i = 2; i <= 5; i++) {
    masa += JEDA_MIN_MS + 1000;
    await terbit(d, 'm' + i, 3, 'Berita ' + i, new Date(masa - 6 * 60000).toISOString());
    await jalankanSekali({ ...d, hantar: penghantar([], balas), binaLaluan, sekarang: masa });
  }
  baki = await d.dbAll(`SELECT * FROM push_langganan`);
  assert.equal(baki.length, 0, 'dibuang selepas 5 kegagalan berturut-turut');
});

test('simpanLangganan: endpoint sama dikemas kini, bukan digandakan', async () => {
  const d = await sediakanPangkalan();
  const a = await simpanLangganan(d.dbGet, d.dbRun, { endpoint: 'https://fcm.googleapis.com/fcm/send/z', ...KUNCI });
  const b = await simpanLangganan(d.dbGet, d.dbRun, { endpoint: 'https://fcm.googleapis.com/fcm/send/z', p256dh: 'C'.repeat(87), auth: KUNCI.auth });
  assert.equal(a.baharu, true);
  assert.equal(b.baharu, false);
  const semua = await d.dbAll(`SELECT * FROM push_langganan`);
  assert.equal(semua.length, 1);
  assert.equal(semua[0].p256dh, 'C'.repeat(87));
});
