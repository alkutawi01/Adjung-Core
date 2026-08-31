// Regression: notis "kandungan menunggu kelulusan" mesti diselesaikan (isRead=1) sebaik
// kandungan tinggalkan status 'pending' (2026-08-28, laporan Izzat: Peti Makluman papar 8 notis
// Editorial "menunggu kelulusan" sedangkan Indeks Kandungan sebenar cuma ada 4 item Menunggu
// benar — 4 lagi sudah lama disiar/ditolak/diarkib tapi notisnya tak pernah dibersihkan).
//
// selesaikanMenungguKelulusan() ialah satu-satunya laluan baharu yang menutup jurang ni, dipanggil
// dari contentRoutes.js pada setiap tapak yang membawa kandungan keluar dari 'pending' (Siar
// terus, naik taraf slot-berkosong, Tolak-ke-draf). Ujian ni kunci fungsi TULEN tu sahaja (bukan
// laluan HTTP penuh) — tanda dibaca, bukan padam (konsisten corak Padam eksplisit di
// MaklumanDrawer.tsx), padan `type` + `targetId` tepat, dan notis LAIN (jenis/targetId berbeza)
// tak sepatutnya tersentuh.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import sqlite3 from 'sqlite3';
import { selesaikanMenungguKelulusan } from '../core/notifications/Notify.js';

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
function makeDbRun(db) {
  return (sql, params = []) => run(db, sql, params);
}

async function seedTable(db) {
  await run(db, `CREATE TABLE notifications (
    id TEXT PRIMARY KEY, userId TEXT, type TEXT, title TEXT, detail TEXT,
    targetType TEXT, targetId TEXT, isRead INTEGER DEFAULT 0, createdAt TEXT
  )`);
}

test('selesaikanMenungguKelulusan — tanda SEMUA notis pelulus (berbilang userId) bagi objectId ni dibaca', async () => {
  const db = await openMemoryDb();
  await seedTable(db);
  await run(db, `INSERT INTO notifications VALUES ('n1','ketua1','kandungan_menunggu_kelulusan','t','d','kandungan','obj-1',0,'2026-08-20T00:00:00.000Z')`);
  await run(db, `INSERT INTO notifications VALUES ('n2','penolong1','kandungan_menunggu_kelulusan','t','d','kandungan','obj-1',0,'2026-08-20T00:00:00.000Z')`);
  await selesaikanMenungguKelulusan(makeDbRun(db), 'obj-1');
  const rows = await all(db, 'SELECT isRead FROM notifications WHERE targetId = ?', ['obj-1']);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.isRead === 1), 'kedua-dua notis pelulus mesti isRead=1');
  db.close();
});

test('selesaikanMenungguKelulusan — TIDAK sentuh notis jenis lain atau objectId lain', async () => {
  const db = await openMemoryDb();
  await seedTable(db);
  await run(db, `INSERT INTO notifications VALUES ('n1','ketua1','kandungan_menunggu_kelulusan','t','d','kandungan','obj-1',0,'2026-08-20T00:00:00.000Z')`);
  await run(db, `INSERT INTO notifications VALUES ('n2','ketua1','kandungan_disiar','t','d','kandungan','obj-1',0,'2026-08-20T00:00:00.000Z')`);
  await run(db, `INSERT INTO notifications VALUES ('n3','ketua1','kandungan_menunggu_kelulusan','t','d','kandungan','obj-2',0,'2026-08-20T00:00:00.000Z')`);
  await selesaikanMenungguKelulusan(makeDbRun(db), 'obj-1');
  const rows = await all(db, 'SELECT id, isRead FROM notifications ORDER BY id');
  const byId = Object.fromEntries(rows.map((r) => [r.id, r.isRead]));
  assert.equal(byId.n1, 1, 'notis menunggu kelulusan utk obj-1 mesti dibaca');
  assert.equal(byId.n2, 0, 'notis jenis lain (kandungan_disiar) tak patut disentuh');
  assert.equal(byId.n3, 0, 'notis obj-2 (objectId lain) tak patut disentuh');
  db.close();
});

test('selesaikanMenungguKelulusan — targetId kosong/null selamat (tiada apa berlaku, tiada ralat)', async () => {
  const db = await openMemoryDb();
  await seedTable(db);
  await run(db, `INSERT INTO notifications VALUES ('n1','ketua1','kandungan_menunggu_kelulusan','t','d','kandungan','obj-1',0,'2026-08-20T00:00:00.000Z')`);
  await selesaikanMenungguKelulusan(makeDbRun(db), null);
  await selesaikanMenungguKelulusan(makeDbRun(db), undefined);
  const rows = await all(db, 'SELECT isRead FROM notifications WHERE id = ?', ['n1']);
  assert.equal(rows[0].isRead, 0, 'notis sedia ada tak patut terjejas oleh panggilan targetId kosong');
  db.close();
});
