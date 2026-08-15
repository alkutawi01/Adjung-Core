// Regression: resolveSlotContent() (server.js) mesti pulangkan SATU baris seobjek walau berapa
// banyak revisi 'approved' terkumpul.
//
// Pepijat asal (ditemui simulasi Slot 3 + Izzat tangkap sendiri, 2026-08-16): objek yang diedit
// >1 kali via Semakan Kandungan (version chain — ChatGPT audit LIFE-01/dst) terkumpul BERBILANG
// baris editorial_revisions berstatus 'approved' (version 1, 2, 3...) bagi SATU objectId. Query
// asal `INNER JOIN editorial_revisions er ON er.objectId = eo.id AND er.status = 'approved'`
// (server.js resolveSlotContent, mod AI Generated + Manual) TIADA had `version = MAX(version)`,
// jadi JOIN kena SETIAP baris approved — objectId SAMA pulang berulang kali. CarouselStableBlock
// (client) anggap N baris tu N kandungan berbeza, papar anak panah + titik carousel PALSU untuk
// kandungan yang sebenarnya SATU sahaja. Disahkan sebenar lawan DB pengeluaran: objek "HaramMute"
// (3 versi approved) pulangkan objectId sama 3 kali sebelum fix.
//
// Ujian ni kunci corak SQL (bukan panggil resolveSlotContent() terus — fungsi tu tak dieksport,
// terbenam dalam closure server.js dgn dbAll/dbGet modul, refactor besar tak wajar sekadar utk
// ujian) terhadap DB SQLite dalam-memori yang meniru skema sebenar (lihat CLAUDE.md: mana-mana
// query serupa MESTI ikut corak version=MAX(version) ni).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import sqlite3 from 'sqlite3';

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

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function seedVersionChain(db) {
  await run(db, `CREATE TABLE editorial_objects (id TEXT PRIMARY KEY, slotIndex INTEGER, createdAt TEXT)`);
  await run(db, `CREATE TABLE editorial_revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, objectId TEXT, version REAL, status TEXT, createdBy TEXT)`);
  await run(db, `INSERT INTO editorial_objects (id, slotIndex, createdAt) VALUES ('obj-A', 0, '2026-08-15T00:00:00.000Z')`);
  // Objek diedit 3 kali via Semakan Kandungan — SEMUA versi kekal 'approved' (bukan cuma yang
  // terkini, sama corak sebenar version chain).
  await run(db, `INSERT INTO editorial_revisions (objectId, version, status, createdBy) VALUES ('obj-A', 1, 'approved', 'manual-slot-save')`);
  await run(db, `INSERT INTO editorial_revisions (objectId, version, status, createdBy) VALUES ('obj-A', 2, 'approved', 'manual-slot-save')`);
  await run(db, `INSERT INTO editorial_revisions (objectId, version, status, createdBy) VALUES ('obj-A', 3, 'approved', 'manual-slot-save')`);
}

test('resolveSlotContent SQL corak — TANPA had version=MAX(version), objectId berulang (pepijat asal direplika)', async () => {
  const db = await openMemoryDb();
  await seedVersionChain(db);
  const rows = await all(db, `
    SELECT eo.id FROM editorial_objects eo
    INNER JOIN editorial_revisions er ON er.objectId = eo.id AND er.status = 'approved'
    WHERE eo.slotIndex = ? AND er.createdBy IN ('manual-slot-save', 'migration-manual-blob', 'content-review')
    ORDER BY eo.createdAt ASC
  `, [0]);
  // Corak PEPIJAT ASAL — pulangkan 3 baris (satu bagi setiap versi approved), bukan 1.
  assert.equal(rows.length, 3, 'corak lama sepatutnya replika pepijat: objectId sama 3 kali');
  db.close();
});

test('resolveSlotContent SQL corak — DENGAN had version=MAX(version), satu baris seobjek', async () => {
  const db = await openMemoryDb();
  await seedVersionChain(db);
  const rows = await all(db, `
    SELECT eo.id FROM editorial_objects eo
    INNER JOIN editorial_revisions er ON er.objectId = eo.id AND er.status = 'approved'
      AND er.version = (SELECT MAX(version) FROM editorial_revisions WHERE objectId = eo.id)
    WHERE eo.slotIndex = ? AND er.createdBy IN ('manual-slot-save', 'migration-manual-blob', 'content-review')
    ORDER BY eo.createdAt ASC
  `, [0]);
  assert.equal(rows.length, 1, 'fix mesti pulangkan TEPAT satu baris seobjek, tak kira berapa banyak versi approved');
  assert.equal(rows[0].id, 'obj-A');
  db.close();
});

test('resolveSlotContent SQL corak — objek dgn createdBy bukan token pipeline (cth pulih-versi rosak) tersekat senarai putih', async () => {
  const db = await openMemoryDb();
  await run(db, `CREATE TABLE editorial_objects (id TEXT PRIMARY KEY, slotIndex INTEGER, createdAt TEXT)`);
  await run(db, `CREATE TABLE editorial_revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, objectId TEXT, version REAL, status TEXT, createdBy TEXT)`);
  await run(db, `INSERT INTO editorial_objects (id, slotIndex, createdAt) VALUES ('obj-B', 0, '2026-08-15T00:00:00.000Z')`);
  await run(db, `INSERT INTO editorial_revisions (objectId, version, status, createdBy) VALUES ('obj-B', 1, 'approved', 'manual-slot-save')`);
  // Simulasi pepijat pulih-versi ASAL — createdBy=nama pengguna sesi, bukan token pipeline.
  await run(db, `INSERT INTO editorial_revisions (objectId, version, status, createdBy) VALUES ('obj-B', 2, 'approved', 'izzat')`);
  const rows = await all(db, `
    SELECT eo.id FROM editorial_objects eo
    INNER JOIN editorial_revisions er ON er.objectId = eo.id AND er.status = 'approved'
      AND er.version = (SELECT MAX(version) FROM editorial_revisions WHERE objectId = eo.id)
    WHERE eo.slotIndex = ? AND er.createdBy IN ('manual-slot-save', 'migration-manual-blob', 'content-review')
    ORDER BY eo.createdAt ASC
  `, [0]);
  // Menggambarkan KENAPA pulih-versi MESTI warisi createdBy asal — objek langsung TAK KELIHATAN
  // bila versi terkini createdBy bukan token pipeline yang dikenali.
  assert.equal(rows.length, 0, 'objek dgn createdBy sesi (bukan token pipeline) pada versi terkini hilang senyap drpd senarai putih Mod Manual');
  db.close();
});
