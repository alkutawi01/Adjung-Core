// SIMULASI 5 — KEBENARAN AKSES (penjelakan peranan).
//
// Akaun EDITOR biasa cuba capai setiap laluan yang sepatutnya terkunci kepada Pentadbir/Ketua
// Editor. Setiap satu MESTI ditolak di PELAYAN — bukan sekadar disorok di UI, kerana sesiapa
// boleh panggil API terus. Turut menguji akses TANPA sesi langsung.
import path from 'node:path';
import os from 'node:os';
import sqlite3 from 'sqlite3';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, hashPassword, dbRun, dbGet, bukaDb } from './sim-lib.mjs';

const PORT = 5203;
const DBF = path.join(os.tmpdir(), 'sim-adjung-izin.db');
const lap = pelapor('SIM 5 — KEBENARAN AKSES');

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  await ciptaPentadbir(DBF);

  // Akaun EDITOR biasa (bukan pentadbir, bukan ketua editor).
  const db = bukaDb(DBF);
  const now = new Date().toISOString();
  const PASS = 'EditorUjian!2026';
  await dbRun(db, `INSERT OR REPLACE INTO users (id,username,email,role,password,penName,createdAt,updatedAt)
    VALUES ('sim-editor','sim-editor','sim-editor@sim.test','EDITOR',?,'Sim Editor',?,?)`, [hashPassword(PASS), now, now]);
  await dbRun(db, "INSERT OR IGNORE INTO user_roles (userId,roleId) VALUES ('sim-editor','editor')");
  await new Promise(r => db.close(r));

  const cookieEditor = await login(srv.base, 'sim-editor', PASS);
  const editor = buatKlien(srv.base, cookieEditor);
  const tanpaSesi = buatKlien(srv.base, '');

  // Laluan yang EDITOR biasa TIDAK sepatutnya boleh capai.
  const TERLARANG_UTK_EDITOR = [
    ['GET', '/api/system/users', undefined, 'senarai akaun (manageAccounts)'],
    ['POST', '/api/system/users', { username: 'x', email: 'x@x.test', penName: 'X', roles: ['editor'] }, 'cipta akaun'],
    ['PATCH', '/api/system/users/sim-admin/roles', { roles: ['pentadbir'] }, 'naikkan peranan sendiri/orang lain'],
    ['PATCH', '/api/system/users/sim-admin/status', { isSuspended: true }, 'gantung akaun lain'],
    ['POST', '/api/auth/reset-password', { email: 'sim-admin@sim.test', password: 'RampasAkaun!2026' }, 'set semula kata laluan orang lain'],
    ['POST', '/api/system/settings', { rolePermissions: '[]' }, 'tulis tetapan sistem'],
    ['POST', '/api/pages/tentang', { title: 'X', content: 'Y' }, 'tulis halaman awam'],
    ['POST', '/api/system/ui-labels', { 'status.aktif': 'X' }, 'tulis label sistem'],
    ['POST', '/api/system/sponsors', { nama: 'X', bulan: '2026-08' }, 'cipta penaja'],
    ['POST', '/api/ai/providers', { id: 'x', name: 'x' }, 'tulis konfigurasi AI'],
    ['POST', '/api/ai/prompts', { id: 'x', name: 'x', templateText: 'x' }, 'tulis templat prompt AI'],
    ['PATCH', '/api/system/editor-publish-policy', { benarkanSelfPublish: true }, 'tukar dasar terbit sendiri'],
    ['POST', '/api/system/categories/activate', { name: 'BidangHaram' }, 'cipta Bidang'],
    ['POST', '/api/system/categories/unify-colors', { color: '#000000' }, 'selaraskan warna Bidang'],
    ['POST', '/api/system/categories/diversify-colors', {}, 'pelbagaikan warna Bidang'],
  ];

  for (const [m, l, b, nota] of TERLARANG_UTK_EDITOR) {
    const r = await editor(m, l, b);
    if (r.status === 403 || r.status === 401) lap.lulus(`Editor disekat: ${nota} -> ${r.status}`);
    else lap.gagal(`PENJELAKAN PERANAN: Editor boleh ${nota}`, `${m} ${l} -> ${r.status} ${r.teks.slice(0, 140)}`);
  }

  // Laluan sensitif TANPA sesi langsung.
  const PERLU_SESI = [
    ['GET', '/api/system/users', 'senarai akaun'],
    ['GET', '/api/system/content/all', 'himpunan kandungan (medan dalaman)'],
    ['GET', '/api/system/editor-notes', 'nota editorial dalaman'],
    ['GET', '/api/system/audit-log', 'log audit'],
    ['POST', '/api/system/slots', 'tulis konfigurasi slot'],
    ['POST', '/api/system/categories/assign-slot', 'tetapkan Bidang slot'],
    ['POST', '/api/media/upload', 'muat naik fail'],
  ];
  for (const [m, l, nota] of PERLU_SESI) {
    const r = await tanpaSesi(m, l, m === 'GET' ? undefined : {});
    if (r.status === 401 || r.status === 403) lap.lulus(`Tanpa sesi disekat: ${nota} -> ${r.status}`);
    else lap.gagal(`TERBUKA TANPA SESI: ${nota}`, `${m} ${l} -> ${r.status} ${r.teks.slice(0, 140)}`);
  }

  // Laluan AWAM mesti KEKAL terbuka (regresi arah bertentangan).
  const MESTI_AWAM = [
    ['GET', '/api/system/layout/active', 'susun atur frontpage'],
    ['GET', '/api/public/editor-notes?type=pengumuman', 'pengumuman awam'],
    ['GET', '/api/public/sponsors/semasa', 'penaja semasa'],
    ['GET', '/api/system/health', 'semakan kesihatan'],
  ];
  for (const [m, l, nota] of MESTI_AWAM) {
    const r = await tanpaSesi(m, l);
    if (r.ok) lap.lulus(`Awam kekal terbuka: ${nota}`);
    else lap.gagal(`LALUAN AWAM TERSEKAT: ${nota}`, `${m} ${l} -> ${r.status} — pembaca portal akan nampak halaman rosak`);
  }

} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
