// Sim32 (2026-09-08, bug-hunt): had panjang penName (HAD_PEN_NAME=60, profileRoutes.js) kuat
// kuasa di PATCH /profile/:id (tukar nama pena akaun SEDIA ADA) tapi tidak langsung disemak di
// POST /aktifkan-akaun (satu-satunya laluan penName BUAT PERTAMA KALI dicipta bagi editor
// jemputan baharu). Sim ni bina keadaan "jemputan baharu" (penName kosong, resetToken sah) terus
// dalam DB (macam POST /api/system/users buat), lalu panggil /aktifkan-akaun dgn penName > 60
// aksara — sepatutnya ditolak 400 sama seperti PATCH /profile/:id, sebelum pembetulan ia diterima
// 200 dan terus tersimpan tanpa had, berpotensi pecahkan kad editorial (nama panjang dipaparkan
// di byline/eyebrow kandungan, lihat CLAUDE.md falsafah "kad tak boleh overflow").
import path from 'node:path';
import crypto from 'node:crypto';
import { bootServer, bukaDb, dbRun, dbGet, pelapor, REPO } from './sim-lib.mjs';

const PORT = 4432;
const DB = path.join(REPO, '.simulasi', 'scratch-sim32.db');
const r = pelapor('sim32-penname-panjang-aktifkan');

const { proc, base } = await bootServer({ port: PORT, dbFile: DB, freshDb: true });
try {
  const db = bukaDb(DB);
  const now = new Date().toISOString();
  const token = crypto.randomBytes(32).toString('hex');
  const tamat = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const id = 'sim32-editor';
  // Tiru corak POST /api/system/users (userAdminRoutes.js ~244): username sementara, penName
  // kosong, resetToken sah — inilah keadaan "jemputan baharu" yang perluTetapkanIdentiti() kesan.
  await dbRun(db, `INSERT INTO users (id, username, email, role, penName, isSuspended, status, password, resetToken, resetTokenExpiresAt, createdAt, updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, `sementara-${id}`, 'sim32@sim.test', 'EDITOR', '', 0, 'active', '', token, tamat, now, now]);
  await new Promise((res) => db.close(res));

  const namaPanjang = 'A'.repeat(120); // > HAD_PEN_NAME (60)
  const resp = await fetch(`${base}/api/auth/aktifkan-akaun`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password: 'KataLaluanUjian1', username: 'ejtr32', penName: namaPanjang }),
  });
  const json = await resp.json().catch(() => null);

  if (resp.status === 400) {
    r.lulus(`aktifkan-akaun tolak penName 120 aksara (400): ${JSON.stringify(json)}`);
  } else {
    r.gagal('aktifkan-akaun MESTI tolak penName > 60 aksara (sepadan HAD_PEN_NAME profileRoutes.js)',
      `Dapat status ${resp.status}, respons: ${JSON.stringify(json)}`);
    // Sahkan ia benar2 tersimpan dalam DB tanpa had
    const db2 = bukaDb(DB);
    const baris = await dbGet(db2, 'SELECT penName FROM users WHERE id = ?', [id]);
    await new Promise((res) => db2.close(res));
    r.gagal('Panjang penName tersimpan dalam DB', `panjang=${(baris?.penName || '').length}`);
  }
} finally {
  proc.kill();
  r.ringkasan();
}
