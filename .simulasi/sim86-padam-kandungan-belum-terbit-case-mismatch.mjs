// SIMULASI 86 — POST /users/:id/kandungan-belum-terbit/padam guna padanan editorName KES-SENSITIF
// (eav.valueText = ?), sedangkan GET /users/:id/kandungan-belum-terbit (paparan "N draf, M
// menunggu" yang Pentadbir lihat SEBELUM menekan padam) guna LOWER(TRIM()) (cariKandunganBelumTerbit,
// baris ~78 userAdminRoutes.js). Bug-hunt round 318, susulan corak sama yang sudah dibaiki di
// cariKandunganBelumTerbit() (komen baris 151-162 userAdminRoutes.js) tapi TERLEPAS pada query
// SENDIRI dalam handler POST /padam (baris ~605-611) yang tidak memanggil helper sama.
//
// Senario sebenar (profileRoutes.js benarkan editor tukar kes huruf penName, cth "ahmad zaki" ->
// "Ahmad Zaki" tanpa dikira "tukar nama" sebenar): kandungan pending dicap editorName huruf kecil
// lama, penName semasa huruf besar baharu. GET tunjuk 1 "menunggu" (padanan LOWER/TRIM), Pentadbir
// nampak angka tu, sahkan padam — tapi POST /padam yang sebenar guna padanan tepat dan GAGAL jumpa
// baris tu, jadi 0 dipadam walau UI baru sahaja kata 1. Kandungan pending "menunggu" milik akaun
// yang ditamatkan itu tertinggal selama-lamanya walau Pentadbir ingat sudah dibersihkan.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, dbRun, bukaDb } from './sim-lib.mjs';

const PORT = 5286;
const DBF = path.join(os.tmpdir(), 'sim-adjung-padam-menunggu-case-mismatch.db');
const lap = pelapor('SIM 86 — POST padam kandungan-belum-terbit case mismatch editorName');

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const adminId = 'sim86-admin';
  const { username, pass } = await ciptaPentadbir(DBF, { id: adminId });
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  // 1. Cipta akaun editor dengan penName SEMASA huruf besar ("Ahmad Zaki").
  const editorId = 'sim86-editor-1';
  const now = new Date().toISOString();
  await dbRun(db,
    `INSERT INTO users (id, username, email, role, penName, isSuspended, status, password, createdAt, updatedAt)
     VALUES (?, 'sim86ahmadzaki', 'sim86@example.com', 'EDITOR', ?, 0, 'Aktif', 'x', ?, ?)`,
    [editorId, 'Ahmad Zaki', now, now]
  );

  // 2. Cipta SATU kandungan 'pending' dgn attribute editorName dicap dalam KES BERBEZA
  //    ("ahmad zaki", huruf kecil semua) — meniru kandungan lama diterbitkan SEBELUM editor
  //    tukar kes huruf nama pena (profileRoutes.js benarkan ni, lihat komen baris 151-162).
  const objectId = 'sim86-obj-pending-1';
  await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, slotIndex, createdAt, updatedAt) VALUES (?, 'article', NULL, 5, ?, ?)`, [objectId, now, now]);
  const revResult = await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO editorial_revisions (objectId, version, title, summary, status, createdBy, createdAt, updatedAt) VALUES (?, 1, 'Sim86 Tajuk Menunggu', 'Huraian ringkas ujian.', 'pending', 'manual-slot-save', ?, ?)`,
      [objectId, now, now],
      function (err) { if (err) reject(err); else resolve(this); }
    );
  });
  const revisionId = revResult.lastID;
  await dbRun(db, `INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, 'editorName', 'ahmad zaki')`, [objectId, revisionId]);

  // 3. GET kandungan-belum-terbit — apa yang Pentadbir NAMPAK sebelum tekan padam.
  const rGet = await api('GET', `/api/system/users/${editorId}/kandungan-belum-terbit`);
  if (!rGet.ok) throw new Error('GET kandungan-belum-terbit gagal: HTTP ' + rGet.status + ' ' + rGet.teks.slice(0, 300));
  const menungguDilihat = (rGet.json.menunggu || []).length;
  console.log('  GET kandungan-belum-terbit -> menunggu (dipaparkan Pentadbir):', menungguDilihat);

  // 4. POST padam — apa yang SEBENARNYA dipadam.
  const rPost = await api('POST', `/api/system/users/${editorId}/kandungan-belum-terbit/padam`, {});
  if (!rPost.ok) throw new Error('POST padam gagal: HTTP ' + rPost.status + ' ' + rPost.teks.slice(0, 300));
  const menungguDipadamSebenar = rPost.json.menungguDipadam;
  console.log('  POST padam -> menungguDipadam (dipadam sebenar):', menungguDipadamSebenar);

  // 5. Sahkan baris pending tu MASIH wujud dalam DB (bukti padam senyap gagal).
  const masihWujud = await dbGet(db, 'SELECT id FROM editorial_objects WHERE id = ?', [objectId]);

  if (menungguDilihat !== 1) {
    throw new Error(`Sim tak sah: GET patut tunjuk 1 menunggu (padanan LOWER/TRIM), dapat ${menungguDilihat}`);
  }
  if (menungguDipadamSebenar === menungguDilihat && !masihWujud) {
    console.log('  BERSIH: POST padam padan bilangan yang dipaparkan GET, baris pending sudah tiada.');
    lap.lulus('menungguDipadam konsisten dengan GET, tiada mismatch case-sensitivity ditemui.');
  } else {
    lap.gagal(`BUG DISAHKAN: GET tunjuk ${menungguDilihat} menunggu, tapi POST padam cuma padam ${menungguDipadamSebenar} — baris pending ${masihWujud ? 'MASIH WUJUD' : 'sudah dipadam'} dalam DB. Padanan editorName tak konsisten (kes huruf) antara GET dan POST padam.`);
  }
  lap.ringkasan();
} finally {
  srv.proc.kill();
}
