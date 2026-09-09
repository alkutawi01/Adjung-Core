// Sahkan pepijat: PATCH /api/system/users/:id/status TIADA sebarang kunci mutasi
// (denganKunciKandungan/denganKunciPeranananPengguna) membalut keseluruhan laluan, walhal ia
// buat corak baca-semak-tulis (TOCTOU) atas invariant KRITIKAL "pentadbir aktif terakhir" —
// adaPentadbirAktifLain(dbGet, id) SELECT bilangan pentadbir lain yang isSuspended=0, KEMUDIAN
// (selepas jurang async) UPDATE users SET status/isSuspended bagi akaun INI. PATCH .../roles
// (fungsi sibling yang guna invariant SAMA) sudah dikunci (#197, denganKunciPeranananPengguna)
// khusus sebab bahaya ni, tapi PATCH .../status — laluan LAIN yang boleh gugurkan status
// pentadbir (Tidak Aktif/Ditamatkan) — terlepas pembetulan yang sama.
//
// Senario: DUA akaun Pentadbir aktif (A, B) — cuma DUA dalam seluruh sistem. Kedua-dua PATCH
// .../status ke 'Ditamatkan' dihantar HAMPIR SERENTAK (A menamatkan B, B menamatkan A serentak
// -- atau lebih realistik, dua Ketua Editor menamatkan A dan B pada masa yang sama). Tingkah
// laku BETUL: TEPAT SATU daripada dua permintaan patut ditolak 400 ("...satu-satunya akaun
// Pentadbir aktif yang tinggal"), sebab lepas permintaan PERTAMA berjaya, tinggal cuma SATU
// pentadbir aktif dan sepatutnya digantung drpd penamatan seterusnya. Kalau kedua-dua permintaan
// baca snapshot "pentadbir lain masih aktif" SEBELUM mana-mana UPDATE komited, kedua-dua akan
// LULUS semakan dan kedua-dua 200 OK — sistem tertinggal SIFAR akaun Pentadbir aktif, TIADA
// SESIAPA lagi boleh urus akaun/kebenaran (kesan tepat yang komen kod fail ni sendiri amarankan,
// baris ~25-34 userAdminRoutes.js).
import path from 'node:path';
import { REPO, bootServer, bukaDb, dbRun, dbAll, ciptaPentadbir, login, buatKlien } from './sim-lib.mjs';

const PORT = 5968;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim68.db');

async function main() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    // ciptaPentadbir cipta akaun pentadbir/ketua_editor PERTAMA ('sim-admin') — kita guna akaun
    // ni sebagai pemanggil (session), dan cipta SATU LAGI akaun pentadbir tulen kedua sebagai
    // sasaran B. A = 'sim-admin' (pemanggil, akan cuba tamatkan B DAN dirinya sendiri serentak).
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-a', username: 'admin-a' });
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    const db = bukaDb(DB_FILE);
    const now = new Date().toISOString();
    await dbRun(db, `INSERT OR REPLACE INTO users (id,username,email,role,status,isSuspended,password,penName,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?)`, ['admin-b', 'admin-b', 'admin-b@sim.test', 'PENTADBIR', 'Aktif', 0, 'x', 'Admin B', now, now]);
    await dbRun(db, 'INSERT OR IGNORE INTO user_roles (userId,roleId) VALUES (?,?)', ['admin-b', 'pentadbir']);
    // Pastikan admin-a status='Aktif' (ciptaPentadbir tak set lajur `status` eksplisit).
    await dbRun(db, "UPDATE users SET status = 'Aktif', isSuspended = 0 WHERE id = 'admin-a'");
    // Gantung akaun 'user-chief-editor' (pentadbir DEFAULT yang server.js sedia semai pada DB
    // kosong, baris ~1647) — kalau tidak, ia jadi pentadbir aktif KETIGA yang buat semakan
    // "pentadbir aktif lain" sentiasa lulus tanpa mengira race, menutup pepijat yang diuji.
    await dbRun(db, "UPDATE users SET status = 'Tidak Aktif', isSuspended = 1 WHERE id = 'user-chief-editor'");

    const semakSebelum = await dbAll(db, `SELECT u.id, u.status, u.isSuspended FROM users u
      INNER JOIN user_roles ur ON ur.userId = u.id WHERE ur.roleId = 'pentadbir'`);
    console.log('Sebelum:', semakSebelum);
    await new Promise((r) => db.close(r));

    // Dua PATCH .../status ke 'Ditamatkan' SERENTAK — admin-a tamatkan admin-b, admin-b (guna
    // sesi admin-a jua, sebab kita cuma perlu uji laluan pelayan/DB, bukan kebenaran sesi
    // berasingan) tamatkan admin-a. Kedua-dua akaun ni cuma DUA pentadbir aktif dlm sistem.
    const p1 = api('PATCH', '/api/system/users/admin-b/status', { status: 'Ditamatkan' });
    const p2 = api('PATCH', '/api/system/users/admin-a/status', { status: 'Ditamatkan' });
    const [r1, r2] = await Promise.all([p1, p2]);
    console.log('Respons tamatkan admin-b:', r1.status, r1.json);
    console.log('Respons tamatkan admin-a:', r2.status, r2.json);

    const db2 = bukaDb(DB_FILE);
    const selepas = await dbAll(db2, `SELECT u.id, u.status, u.isSuspended FROM users u
      INNER JOIN user_roles ur ON ur.userId = u.id WHERE ur.roleId = 'pentadbir'`);
    await new Promise((r) => db2.close(r));
    console.log('Selepas:', selepas);

    const pentadbirAktifTinggal = selepas.filter((u) => u.isSuspended === 0).length;
    const keduaBerjaya = r1.status === 200 && r1.json?.success && r2.status === 200 && r2.json?.success;

    if (pentadbirAktifTinggal === 0) {
      console.log(`PEPIJAT DISAHKAN: ${pentadbirAktifTinggal} akaun Pentadbir aktif tertinggal selepas dua PATCH .../status serentak (kedua-dua berjaya: ${keduaBerjaya}) — TIADA SESIAPA lagi boleh urus akaun/kebenaran, mesti pulih terus DB.`);
      process.exitCode = 1;
    } else {
      console.log(`PASS: ${pentadbirAktifTinggal} akaun Pentadbir aktif kekal — sekurang-kurangnya satu permintaan ditolak betul (sekatan pentadbir terakhir berfungsi walau serentak).`);
    }
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
