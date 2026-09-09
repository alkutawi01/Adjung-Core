// Sahkan pepijat: PATCH /api/system/users/:id/roles ganti SELURUH set baris `user_roles` bagi
// satu akaun (DELETE FROM user_roles WHERE userId = ? diikuti gelung INSERT), TANPA sebarang
// kunci — sibling pepijat corak yang dibaiki di permohonanPenajaRoutes.js (#195)/sponsorRoutes.js
// (#196). Dua permintaan PATCH .../roles hampir serentak bagi akaun SAMA (roles berbeza) boleh
// berselang-seli DELETE/INSERT dan menghasilkan set peranan yang bukan salah satu daripada dua
// set yang dihantar (peranan hilang senyap), walaupun kedua-dua respons HTTP pulangkan 200 OK.
import path from 'node:path';
import { REPO, bootServer, bukaDb, dbRun, dbAll, ciptaPentadbir, login, buatKlien } from './sim-lib.mjs';

const PORT = 5965;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim65.db');

async function main() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    // Cipta akaun editor sasaran, secara langsung dalam DB (elak laluan pendaftaran e-mel).
    const targetId = 'sim-target-user';
    const db = bukaDb(DB_FILE);
    const now = new Date().toISOString();
    await dbRun(db, `INSERT OR REPLACE INTO users (id,username,email,role,password,penName,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?)`, [targetId, 'sasaran-ujian', 'sasaran@sim.test', 'EDITOR', 'x', 'Sasaran Ujian', now, now]);
    await dbRun(db, 'INSERT OR IGNORE INTO user_roles (userId,roleId) VALUES (?,?)', [targetId, 'editor']);
    await new Promise((r) => db.close(r));

    // Dua set peranan BERBEZA (masing-masing 2 peranan sah, tiada 'pentadbir' supaya tak
    // tersentuh sekatan "pentadbir aktif terakhir"). N permintaan berselang-seli antara dua set.
    const setA = ['ketua_editor', 'editor'];
    const setB = ['penolong_ketua_editor', 'editor'];
    const N = 10;
    const hasil = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        api('PATCH', `/api/system/users/${targetId}/roles`, { roles: i % 2 === 0 ? setA : setB })
      )
    );

    const berjaya = hasil.filter((h) => h.status === 200 && h.json?.success);
    console.log(`Permintaan serentak: ${N}, berjaya (200): ${berjaya.length}`);

    const db2 = bukaDb(DB_FILE);
    const baris = await dbAll(db2, 'SELECT roleId FROM user_roles WHERE userId = ? ORDER BY roleId', [targetId]);
    await new Promise((r) => db2.close(r));
    const rolesAkhir = baris.map((b) => b.roleId).sort();
    console.log('Peranan akhir dalam DB:', rolesAkhir);

    const sepadanA = JSON.stringify(rolesAkhir) === JSON.stringify([...setA].sort());
    const sepadanB = JSON.stringify(rolesAkhir) === JSON.stringify([...setB].sort());

    if (!sepadanA && !sepadanB) {
      console.log('PEPIJAT DISAHKAN: set peranan akhir bukan salah satu set yang dihantar — peranan hilang/bercampur akibat DELETE/INSERT berselang-seli.');
      process.exitCode = 1;
    } else {
      console.log(`PASS: set peranan akhir tepat sepadan salah satu set yang dihantar (${sepadanA ? 'setA' : 'setB'}), setiap PATCH bersiri dengan bersih.`);
    }
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
