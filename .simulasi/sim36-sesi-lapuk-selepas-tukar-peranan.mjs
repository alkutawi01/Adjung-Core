// Sim 36 — verifikasi dapatan bug-hunt #110: adakah sesi seorang editor kekal sah selepas
// Pentadbir menggantung akaunnya ATAU menurunkan peranannya semasa sesi masih hidup?
// (core/middleware/auth.js requireAuth/requirePermission cuma baca req.session.user yang
// dicap semasa log masuk -- persoalan ialah adakah ada mekanisme LAIN yang batalkan sesi tu
// bila DB berubah, cth padamSesiPengguna di userAdminRoutes.js).
import { bootServer, ciptaPentadbir, login, buatKlien, dbRun, bukaDb } from './sim-lib.mjs';
import path from 'node:path';
import os from 'node:os';
import sqlite3 from 'sqlite3';

const PORT = 8948;
const dbFile = path.join(os.tmpdir(), `sim36-${Date.now()}.db`);

async function main() {
  const server = await bootServer({ port: PORT, dbFile });
  try {
    const { username: adminUser, pass: adminPass } = await ciptaPentadbir(dbFile);
    const cookieAdmin = await login(server.base, adminUser, adminPass);
    const klienAdmin = buatKlien(server.base, cookieAdmin);

    // Cipta akaun editor biasa (peranan 'editor' sahaja) terus dalam DB.
    const db = new sqlite3.Database(dbFile);
    const now = new Date().toISOString();
    const editorId = 'sim-editor-36';
    const { hashPassword } = await import('./sim-lib.mjs');
    await dbRun(db, `INSERT OR REPLACE INTO users (id,username,email,role,password,penName,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?)`, [editorId, 'sim-editor-36', 'sim-editor-36@sim.test', 'EDITOR', hashPassword('EditorUjian!2026'), 'Sim Editor', now, now]);
    await dbRun(db, "INSERT OR IGNORE INTO user_roles (userId,roleId) VALUES (?, 'editor')", [editorId]);
    await new Promise(r => db.close(r));

    const cookieEditor = await login(server.base, 'sim-editor-36', 'EditorUjian!2026');
    const klienEditor = buatKlien(server.base, cookieEditor);

    const semakAwal = await klienEditor('GET', '/api/system/users');
    console.log('Editor sah sebelum apa-apa berlaku:', semakAwal.status);

    let lulus = true;

    // Kes A: Pentadbir GANTUNG akaun editor semasa sesi editor masih hidup.
    const gantung = await klienAdmin('PATCH', `/api/system/users/${editorId}/status`, { status: 'Tidak Aktif' });
    console.log('PATCH status -> Tidak Aktif:', gantung.status);
    const selepasGantung = await klienEditor('GET', '/api/system/users');
    console.log('Kuki editor LAMA selepas digantung:', selepasGantung.status);
    if (selepasGantung.status === 401) {
      console.log('OK: sesi lama dibatalkan serta-merta selepas gantung (padamSesiPengguna).');
    } else {
      console.log('GAGAL: sesi editor yang DIGANTUNG masih diterima -- kebenaran lapuk.');
      lulus = false;
    }

    // Kes B: aktifkan semula, log masuk baharu, kemudian TURUNKAN peranan (buang 'editor',
    // tukar ke set kosong tak dibenarkan -- guna set lain, cth cuma 'editor' -> ganti ke
    // set yang sama peranan tapi lucutkan kebenaran 'manageAccounts' tak relevan sini; ganti
    // terus ke senarai berbeza utk uji laluan /roles).
    await klienAdmin('PATCH', `/api/system/users/${editorId}/status`, { status: 'Aktif' });
    const cookieEditor2 = await login(server.base, 'sim-editor-36', 'EditorUjian!2026');
    const klienEditor2 = buatKlien(server.base, cookieEditor2);
    const semakSemula = await klienEditor2('GET', '/api/system/users');
    console.log('Editor sah selepas diaktifkan semula + log masuk baharu:', semakSemula.status);

    const tukarPeranan = await klienAdmin('PATCH', `/api/system/users/${editorId}/roles`, { roles: ['penolong_ketua_editor'] });
    console.log('PATCH roles -> penolong_ketua_editor:', tukarPeranan.status, JSON.stringify(tukarPeranan.json));
    const selepasTukar = await klienEditor2('GET', '/api/system/users');
    console.log('Kuki editor LAMA (peranan sebelum ditukar) selepas /roles:', selepasTukar.status);
    if (selepasTukar.status === 401) {
      console.log('OK: sesi lama dibatalkan serta-merta selepas tukar peranan (padamSesiPengguna).');
    } else {
      console.log('GAGAL: sesi lama masih diterima selepas peranan ditukar -- kebenaran lapuk.');
      lulus = false;
    }

    process.exitCode = lulus ? 0 : 1;
  } finally {
    server.proc.kill();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
