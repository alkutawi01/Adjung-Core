// sim38 — akaun Pentadbir AKTIF terakhir tak boleh digantung/ditamatkan atau ditarik balik
// peranan 'pentadbir', kalau tidak sistem terkunci sepenuhnya (tiada sesiapa lagi boleh
// manageAccounts/manageRbac — laluan pulih satu-satunya ialah edit terus adjung.db).
import path from 'node:path';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien, dbRun, dbGet, bukaDb, hashPassword } from './sim-lib.mjs';

const PORT = 5738;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim38.db');

async function main() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-a', username: 'admin-a' });
    const db = bukaDb(DB_FILE);
    const now = new Date().toISOString();
    // Pelayan sentiasa sedia-semai SATU akaun 'izzat' (Pentadbir+Ketua Editor) semasa but DB
    // kosong (lihat server.js "Chief Editor pertama") — singkirkan ia daripada kiraan supaya
    // admin-a menjadi Pentadbir AKTIF SATU-SATUNYA untuk senario ujian ni (padam sepenuhnya,
    // bukan gantung — mudah, tak dipakai simulasi ni langsung).
    // Semaian 'izzat' berlaku dalam panggil balik CREATE TABLE tak segerak semasa but (corak
    // race sama yang didokumenkan CLAUDE.md "Dasar Aktif...boot-time races") — poll sehingga ia
    // wujud dahulu sebelum padam, kalau tidak DELETE ni mendahului INSERT dan izzat "hidup semula".
    for (let cuba = 0; cuba < 25; cuba++) {
      const r = await dbGet(db, "SELECT id FROM users WHERE id = 'user-chief-editor'");
      if (r) break;
      await new Promise((res) => setTimeout(res, 200));
    }
    await dbRun(db, "DELETE FROM user_roles WHERE userId = 'user-chief-editor'");
    await dbRun(db, "DELETE FROM users WHERE id = 'user-chief-editor'");
    // Kedua pentadbir SATU-SATUNYA pada mulanya — admin-a itu sendiri.
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    // 1) Cuba gantung diri sendiri (satu-satunya Pentadbir) via /status — MESTI ditolak.
    const r1 = await api('PATCH', '/api/system/users/admin-a/status', { status: 'Tidak Aktif' });
    console.log('1) gantung pentadbir terakhir (diri sendiri):', r1.status, r1.json?.error);
    if (r1.status !== 400) throw new Error('DIJANGKA 400 — sistem benarkan pentadbir terakhir digantung!');

    // 2) Cuba tarik balik peranan pentadbir daripada diri sendiri via /roles — MESTI ditolak.
    const r2 = await api('PATCH', '/api/system/users/admin-a/roles', { roles: ['ketua_editor'] });
    console.log('2) tarik peranan pentadbir terakhir:', r2.status, r2.json?.error);
    if (r2.status !== 400) throw new Error('DIJANGKA 400 — sistem benarkan peranan pentadbir terakhir ditarik!');

    // 3) Tambah SATU LAGI pentadbir aktif (admin-b) — sekarang gantung admin-a MESTI dibenarkan.
    await dbRun(db, `INSERT INTO users (id,username,email,role,password,penName,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?)`, ['admin-b', 'admin-b', 'admin-b@sim.test', 'PENTADBIR', hashPassword('SimUjian!2026b'), 'Sim Admin B', now, now]);
    await dbRun(db, "INSERT INTO user_roles (userId, roleId) VALUES ('admin-b', 'pentadbir')");
    await new Promise((res) => db.close(res));

    const r3 = await api('PATCH', '/api/system/users/admin-a/status', { status: 'Tidak Aktif' });
    console.log('3) gantung admin-a bila admin-b wujud:', r3.status);
    if (r3.status !== 200) throw new Error('DIJANGKA 200 — gantung patut dibenarkan bila pentadbir lain wujud. Got: ' + JSON.stringify(r3.json));

    // 4) admin-b kini pentadbir aktif SATU-SATUNYA — tarik peranan pentadbir daripadanya (guna
    // sesi admin-b sendiri, bukan admin-a yang sesinya sudah dipadam oleh gantungan di atas)
    // MESTI ditolak.
    const cookieB = await login(base, 'admin-b', 'SimUjian!2026b');
    const apiB = buatKlien(base, cookieB);
    const r4 = await apiB('PATCH', '/api/system/users/admin-b/roles', { roles: ['ketua_editor'] });
    console.log('4) tarik peranan pentadbir daripada admin-b (kini satu-satunya aktif):', r4.status, r4.json?.error);
    if (r4.status !== 400) throw new Error('DIJANGKA 400 — sistem benarkan pentadbir aktif TERAKHIR ditarik peranannya!');

    console.log('\nSEMUA SEMAKAN LULUS — sim38 OK');
  } catch (e) {
    console.log('--- server log tail ---');
    console.log(dapatLog().slice(-3000));
    throw e;
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error('GAGAL:', e); process.exit(1); });
