// SIMULASI 332 — POST /users/:id/kandungan-belum-terbit/padam memadam KEKAL kandungan 'pending'
// (bukan padam-lembut ke Tong Sampah) tanpa pernah panggil selesaikanMenungguKelulusan(), sama
// corak pepijat yang dibaiki round #329 (DELETE trash-path, contentRoutes.js) dan #331 (PATCH
// slot_penuh). Notis "Kandungan menunggu kelulusan anda" (dihantar bila kandungan jatuh ke
// 'pending') kekal belum-dibaca SELAMA-LAMANYA di Peti Makluman Ketua Editor/Penolong walau
// objek yang dirujuk sudah dipadam kekal (bukan cuma diarkib/dipulihkan) semasa pembersihan
// akaun editor yang ditamatkan.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, dbRun, bukaDb } from './sim-lib.mjs';

const PORT = 5332;
const DBF = path.join(os.tmpdir(), 'sim-adjung-padam-menunggu-notis-tersangkut.db');
const lap = pelapor('SIM 332 — POST padam kandungan-belum-terbit tak selesaikan notis pelulus');

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const adminId = 'sim332-admin';
  const { username, pass } = await ciptaPentadbir(DBF, { id: adminId });
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  const editorId = 'sim332-editor-1';
  const now = new Date().toISOString();
  await dbRun(db,
    `INSERT INTO users (id, username, email, role, penName, isSuspended, status, password, createdAt, updatedAt)
     VALUES (?, 'sim332editor', 'sim332@example.com', 'EDITOR', ?, 0, 'Aktif', 'x', ?, ?)`,
    [editorId, 'Sim332 Editor', now, now]
  );

  const pelulusId = 'sim332-pelulus-1';
  await dbRun(db,
    `INSERT INTO users (id, username, email, role, penName, isSuspended, status, password, createdAt, updatedAt)
     VALUES (?, 'sim332pelulus', 'sim332pelulus@example.com', 'KETUA_EDITOR', ?, 0, 'Aktif', 'x', ?, ?)`,
    [pelulusId, 'Sim332 Pelulus', now, now]
  );

  const objectId = 'sim332-obj-pending-1';
  await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, slotIndex, createdAt, updatedAt) VALUES (?, 'article', NULL, 6, ?, ?)`, [objectId, now, now]);
  const revResult = await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO editorial_revisions (objectId, version, title, summary, status, createdBy, createdAt, updatedAt) VALUES (?, 1, 'Sim332 Tajuk Menunggu', 'Huraian ringkas ujian.', 'pending', 'manual-slot-save', ?, ?)`,
      [objectId, now, now],
      function (err) { if (err) reject(err); else resolve(this); }
    );
  });
  const revisionId = revResult.lastID;
  await dbRun(db, `INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, 'editorName', 'Sim332 Editor')`, [objectId, revisionId]);

  // Notis "menunggu kelulusan" sedia ada untuk pelulus (dihantar oleh beritahuPelulusKandungan()
  // masa kandungan ni pertama kali jatuh 'pending' — dicipta terus di sini utk fokus ujian pada
  // laluan padam sahaja).
  await dbRun(db,
    `INSERT INTO notifications (userId, type, title, detail, targetType, targetId, isRead, createdAt) VALUES (?, 'kandungan_menunggu_kelulusan', 'Kandungan menunggu kelulusan anda', 'Slot 7: Sim332 Tajuk Menunggu', 'kandungan', ?, 0, ?)`,
    [pelulusId, objectId, now]
  );

  const rPost = await api('POST', `/api/system/users/${editorId}/kandungan-belum-terbit/padam`, {});
  if (!rPost.ok) throw new Error('POST padam gagal: HTTP ' + rPost.status + ' ' + rPost.teks.slice(0, 300));
  console.log('  POST padam ->', JSON.stringify(rPost.json));

  const objekMasihWujud = await dbGet(db, 'SELECT id FROM editorial_objects WHERE id = ?', [objectId]);
  const notisSelepas = await dbGet(db, "SELECT isRead FROM notifications WHERE type = 'kandungan_menunggu_kelulusan' AND targetId = ?", [objectId]);

  console.log('  Objek masih wujud selepas padam?', !!objekMasihWujud);
  console.log('  Status notis pelulus selepas padam: isRead =', notisSelepas ? notisSelepas.isRead : '(baris tiada)');

  if (objekMasihWujud) {
    lap.gagal('Sim tak sah: objek patut dipadam kekal (CASCADE), tapi masih wujud.');
  } else if (notisSelepas && notisSelepas.isRead === 1) {
    lap.lulus('BERSIH: kandungan pending dipadam kekal DAN notis pelulus turut diselesaikan (isRead=1).');
  } else {
    lap.gagal(`BUG: objek pending dipadam kekal tapi notis pelulus TAK diselesaikan (isRead=${notisSelepas ? notisSelepas.isRead : 'baris tiada'}) — kekal belum-dibaca selama-lamanya walau kandungan rujukan sudah lesap terus.`);
  }
  lap.ringkasan();
} finally {
  srv.proc.kill();
}
