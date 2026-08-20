// Regresi: Padam -> Pulih -> Padam semula TIDAK boleh menyebabkan padam KEKAL pramatang
// (2026-08-20, dapatan audit).
//
// Pepijat asal: POST /content/:id/pulihkan-sampah (contentRoutes.js) menukar status revisi
// balik ke statusSebelumPadam, tapi TIDAK PERNAH membuang atribut 'dipadamPada'/
// 'statusSebelumPadam' yang disimpan semasa padam pertama. Kandungan yang dipadam SEMULA
// selepas dipulihkan mencipta baris KEDUA bagi attributeId yang SAMA (laluan DELETE sentiasa
// INSERT baharu, tak pernah UPSERT) — baris lama (dari padam pertama) kekal terbenam.
//
// Tik purge Tong Sampah (server.js, disalin corak SQL di sini — lihat nota
// tests/revisionChainSlotQuery.test.js kenapa ujian ni tak panggil fungsi tu terus) LEFT JOIN
// ikut objectId+revisionId+attributeId='dipadamPada'. Sebelum pembetulan, JOIN terus (tanpa
// GROUP BY subquery) fan-out kepada DUA baris hasil bagi SATU revisi bila ada dua baris atribut
// — dan baris yang bawa cap masa LAMA (padam pertama) turut dinilai terhadap ambang 30 hari.
// Kalau padam pertama itu sudah lama, padam KEDUA yang baru sahaja berlaku boleh terus layak
// dipadam KEKAL pada tik seterusnya. Disahkan sebenar lawan DB production 2026-08-20: dua objek
// ujian sedia ada memang ada baris pendua 'dipadamPada' (4 baris dan 2 baris) hasil kitaran
// padam/pulih berulang semasa ujian sesi lalu.
//
// Ujian ni kunci DUA lapisan pembetulan: (a) pulihkan-sampah kini membuang atribut lama semasa
// pulih (dieksport corak SQL, bukan panggil route terus — sama sebab seperti ujian version chain);
// (b) pertanyaan purge kini guna MAX(valueText) per objectId+revisionId supaya walau baris pendua
// SUDAH wujud (data lama sebelum pembetulan (a) dihantar), ia tak lagi fan-out atau tersalah nilai.

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
function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

async function seedSkema(db) {
  await run(db, `CREATE TABLE editorial_objects (id TEXT PRIMARY KEY)`);
  await run(db, `CREATE TABLE editorial_revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, objectId TEXT, version REAL, status TEXT, title TEXT)`);
  await run(db, `CREATE TABLE editorial_attribute_values (objectId TEXT, revisionId INTEGER, attributeId TEXT, valueText TEXT)`);
  await run(db, `INSERT INTO editorial_objects (id) VALUES ('obj-A')`);
  await run(db, `INSERT INTO editorial_revisions (objectId, version, status, title) VALUES ('obj-A', 1, 'approved', 'Kandungan Ujian')`);
}

// Salinan TEPAT logik pulihkan-sampah (contentRoutes.js) selepas pembetulan.
async function pulihkanSampah(db, objectId) {
  const rev = await get(db, "SELECT * FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1", [objectId]);
  const statusSebelumRow = await get(db,
    "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'statusSebelumPadam'",
    [objectId, rev.id]
  );
  const statusPulihan = statusSebelumRow ? statusSebelumRow.valueText : 'archived';
  await run(db, "UPDATE editorial_revisions SET status = ? WHERE id = ?", [statusPulihan, rev.id]);
  await run(db,
    "DELETE FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId IN ('dipadamPada', 'statusSebelumPadam')",
    [objectId, rev.id]
  );
}

// Salinan TEPAT laluan DELETE panggilan-pertama (contentRoutes.js) selepas pembetulan.
async function padamPertamaKali(db, objectId, capMasa) {
  const rev = await get(db, "SELECT * FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1", [objectId]);
  await run(db, "UPDATE editorial_revisions SET status = 'dipadam' WHERE id = ?", [rev.id]);
  await run(db, "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, 'statusSebelumPadam', ?)", [objectId, rev.id, 'approved']);
  await run(db, "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, 'dipadamPada', ?)", [objectId, rev.id, capMasa]);
}

// Salinan TEPAT pertanyaan purge (contentRoutes.js, runSchedulingTick) selepas pembetulan.
async function ambilCalonPurge(db) {
  return all(db, `
    SELECT er.id as revisionId, er.objectId, er.title, av.dipadamPada
    FROM editorial_revisions er
    INNER JOIN (SELECT objectId, MAX(version) as mv FROM editorial_revisions GROUP BY objectId) lv
      ON lv.objectId = er.objectId AND lv.mv = er.version
    LEFT JOIN (
      SELECT objectId, revisionId, MAX(valueText) as dipadamPada
      FROM editorial_attribute_values
      WHERE attributeId = 'dipadamPada'
      GROUP BY objectId, revisionId
    ) av ON av.objectId = er.objectId AND av.revisionId = er.id
    WHERE er.status = 'dipadam'
  `);
}

test('pulihkan-sampah membuang atribut dipadamPada/statusSebelumPadam lama', async () => {
  const db = await openMemoryDb();
  await seedSkema(db);
  const LAMA = '2026-01-01T00:00:00.000Z'; // jauh melepasi ambang 30 hari
  await padamPertamaKali(db, 'obj-A', LAMA);
  await pulihkanSampah(db, 'obj-A');

  const baki = await all(db, "SELECT * FROM editorial_attribute_values WHERE objectId = 'obj-A'");
  assert.equal(baki.length, 0, 'atribut dipadamPada/statusSebelumPadam lama mesti dibuang selepas pulih');
});

test('padam->pulih->padam semula TIDAK mencipta baris dipadamPada pendua', async () => {
  const db = await openMemoryDb();
  await seedSkema(db);
  const LAMA = '2026-01-01T00:00:00.000Z';
  const BAHARU = '2026-08-20T00:00:00.000Z';

  await padamPertamaKali(db, 'obj-A', LAMA);
  await pulihkanSampah(db, 'obj-A');
  await padamPertamaKali(db, 'obj-A', BAHARU);

  const baris = await all(db, "SELECT valueText FROM editorial_attribute_values WHERE objectId = 'obj-A' AND attributeId = 'dipadamPada'");
  assert.equal(baris.length, 1, 'hanya SATU baris dipadamPada patut wujud selepas kitaran padam-pulih-padam');
  assert.equal(baris[0].valueText, BAHARU, 'cap masa mesti daripada padam TERKINI, bukan padam pertama');
});

test('purge TIDAK memadam kandungan yang baru sahaja dipadam semula (ini bug SEBENAR yang ditemui)', async () => {
  const db = await openMemoryDb();
  await seedSkema(db);
  const LAMA = '2026-01-01T00:00:00.000Z'; // >30 hari lalu
  const BAHARU = new Date().toISOString(); // padam SEKARANG

  // Senario tepat yang ditemui audit: padam lama, pulih, padam SEKARANG.
  await padamPertamaKali(db, 'obj-A', LAMA);
  await pulihkanSampah(db, 'obj-A');
  await padamPertamaKali(db, 'obj-A', BAHARU);

  const calon = await ambilCalonPurge(db);
  assert.equal(calon.length, 1, 'satu revisi mesti hasilkan SATU baris calon (tiada fan-out)');
  assert.equal(calon[0].dipadamPada, BAHARU, 'cap masa yang dinilai purge mesti cap TERKINI, bukan cap lama yang sudah lepas ambang');

  const ambangIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  assert.ok(calon[0].dipadamPada > ambangIso, 'kandungan yang baru dipadam TIDAK boleh layak dipadam kekal serta-merta');
});

test('purge TETAP berfungsi normal (kandungan yang benar tamat tempoh masih dipadam)', async () => {
  const db = await openMemoryDb();
  await seedSkema(db);
  const LAMA = '2026-01-01T00:00:00.000Z';
  await padamPertamaKali(db, 'obj-A', LAMA);
  // Tiada pemulihan — laluan biasa, satu baris sahaja.

  const calon = await ambilCalonPurge(db);
  assert.equal(calon.length, 1);
  const ambangIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  assert.ok(calon[0].dipadamPada <= ambangIso, 'kandungan lama yang genuinely tamat tempoh mesti kekal layak dipadam');
});

test('purge kekal selamat walau baris pendua LAMA (data sedia ada sebelum pembetulan) masih wujud', async () => {
  // Meniru keadaan production SEBENAR yang ditemui semasa audit: baris pendua sudah wujud
  // (dicipta sebelum pembetulan pulihkan-sampah dihantar), pertanyaan purge sahaja yang dibaiki.
  const db = await openMemoryDb();
  await seedSkema(db);
  const rev = await get(db, "SELECT id FROM editorial_revisions WHERE objectId = 'obj-A'");
  await run(db, "UPDATE editorial_revisions SET status = 'dipadam' WHERE id = ?", [rev.id]);
  // EMPAT baris pendua, macam objek sebenar di production (slot17, 4 baris).
  const capMasa = ['2026-08-14T11:06:33.554Z', '2026-08-14T11:22:26.142Z', '2026-08-14T11:28:21.078Z', '2026-08-14T11:32:50.569Z'];
  for (const c of capMasa) {
    await run(db, "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES ('obj-A', ?, 'dipadamPada', ?)", [rev.id, c]);
  }

  const calon = await ambilCalonPurge(db);
  assert.equal(calon.length, 1, 'baris pendua sedia ada tidak boleh fan-out pertanyaan purge');
  assert.equal(calon[0].dipadamPada, capMasa[capMasa.length - 1], 'mesti ambil cap masa TERBARU antara baris pendua');
});
