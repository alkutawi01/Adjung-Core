// Regression: Dasar Aktif Editorial (tempoh 7/14/21 hari boleh laras, 2026-08-16).
//
// Izzat tanya "macam mana nak check dan adjust tempoh tu?" — sebelum ni tempoh gantung automatik
// editor PEMALAR KOD KERAS (server.js). Dipindah ke jadual `dasar_aktif_editorial` (satu baris
// id='main', corak IDENTIK slot_am_settings) supaya boleh dilaras di Direktori tanpa deploy kod.
// Ujian ni kunci: (1) lalai betul bila jadual kosong (pemasangan baharu), (2) cache dalam-memori
// baca baris DB dengan betul selepas simpan, (3) penukaran hari->ms untuk runSemakanTakAktif()
// server.js tepat, (4) senarai peranan tertakluk dasar ni (dikongsi server.js + userAdminRoutes.js)
// tidak senyap terpesong antara dua tempat.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import sqlite3 from 'sqlite3';
import {
  loadDasarAktifSettings,
  getDasarAktifSettings,
  getDasarAktifAmbangMs,
  DASAR_AKTIF_DEFAULTS,
  PERANAN_TERPAKAI_DASAR_AKTIF,
} from '../core/routes/dasarAktifRoutes.js';

function openMemoryDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(':memory:', (err) => (err ? reject(err) : resolve(db)));
  });
}
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
  });
}
function makeDbGet(db) {
  return (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

async function seedTable(db) {
  await run(db, `CREATE TABLE dasar_aktif_editorial (
    id TEXT PRIMARY KEY, amaranPertamaHari INTEGER, amaranKeduaHari INTEGER, notisPenamatanHari INTEGER, updatedAt TEXT
  )`);
}

test('loadDasarAktifSettings — jadual kosong (pemasangan baharu) jatuh balik ke lalai 7/14/21', async () => {
  const db = await openMemoryDb();
  await seedTable(db);
  const hasil = await loadDasarAktifSettings(makeDbGet(db));
  assert.deepEqual(hasil, DASAR_AKTIF_DEFAULTS);
  db.close();
});

test('loadDasarAktifSettings — baris tersimpan diguna pakai betul (Pentadbir laras tempoh)', async () => {
  const db = await openMemoryDb();
  await seedTable(db);
  await run(db, `INSERT INTO dasar_aktif_editorial (id, amaranPertamaHari, amaranKeduaHari, notisPenamatanHari, updatedAt) VALUES ('main', 10, 20, 30, '2026-08-16T00:00:00.000Z')`);
  const hasil = await loadDasarAktifSettings(makeDbGet(db));
  assert.deepEqual(hasil, { amaranPertamaHari: 10, amaranKeduaHari: 20, notisPenamatanHari: 30 });
  assert.deepEqual(getDasarAktifSettings(), hasil, 'cache dalam-memori mesti sepadan hasil load');
  db.close();
});

test('getDasarAktifAmbangMs — penukaran hari->ms tepat (dibaca server.js runSemakanTakAktif)', async () => {
  const db = await openMemoryDb();
  await seedTable(db);
  await run(db, `INSERT INTO dasar_aktif_editorial (id, amaranPertamaHari, amaranKeduaHari, notisPenamatanHari, updatedAt) VALUES ('main', 5, 15, 25, '2026-08-16T00:00:00.000Z')`);
  await loadDasarAktifSettings(makeDbGet(db));
  const HARI_MS = 24 * 60 * 60 * 1000;
  const ambang = getDasarAktifAmbangMs();
  assert.equal(ambang.amaranPertama, 5 * HARI_MS);
  assert.equal(ambang.amaranKedua, 15 * HARI_MS);
  assert.equal(ambang.notisPenamatan, 25 * HARI_MS);
  db.close();
});

test('PERANAN_TERPAKAI_DASAR_AKTIF — Pentadbir TIDAK termasuk (struktur RBAC tak boleh terbit kandungan)', () => {
  assert.ok(PERANAN_TERPAKAI_DASAR_AKTIF.includes('editor'));
  assert.ok(PERANAN_TERPAKAI_DASAR_AKTIF.includes('ketua_editor'));
  assert.ok(PERANAN_TERPAKAI_DASAR_AKTIF.includes('penolong_ketua_editor'));
  assert.ok(!PERANAN_TERPAKAI_DASAR_AKTIF.includes('pentadbir'), 'Pentadbir dikecualikan — akaun pemilik projek tak boleh menggantung dirinya sendiri');
});
