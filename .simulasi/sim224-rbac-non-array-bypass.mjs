// sim224 — bug-hunt 2026-09-09. Ketiga-tiga sekatan kunci-diri di POST /api/system/settings
// (systemRoutes.js ~baris 357-417) semak `Array.isArray(s.rolePermissions)` DAHULU sebelum
// jalankan langsung SATU pun daripada tiga semakan invariant (masihAdaManageRbac/
// masihAdaManageSettings/masihAdaManageAccounts). Kalau `rolePermissions` DIHANTAR (bukan
// undefined, jadi gerbang manageRbac baris 340 tetap dilalui) tapi BUKAN array (cth objek
// `{}`, atau string), `Array.isArray()` pulang false — KESEMUA tiga sekatan kunci-diri
// DILANGKAU SEPENUHNYA (bukan ditolak 400), matriks bentuk salah ni terus disimpan
// (`JSON.stringify(v || {})` terima apa-apa jenis tanpa aduan). Kesan sebenar: RBAC matrix
// tersimpan jadi bentuk yang middleware baca (`core/middleware/auth.js` parseStoredMatrix,
// `Array.isArray` juga) TAK dapat fahami (bukan array = null), jadi SEMUA kebenaran jatuh
// balik ke DEFAULT_PERMISSIONS (auth.js baris 29) SENYAP tanpa jejak/amaran — persis kesan
// yang tiga sekatan kunci-diri tu direka untuk halang, cuma laluan (jenis salah, bukan
// roleId palsu/array kosong) yang terlepas.
import path from 'node:path';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien } from './sim-lib.mjs';

const PORT = 5742;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim224.db');

async function main() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-a', username: 'admin-a' });
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    // Hantar rolePermissions sebagai OBJEK (bukan array) — bentuk yang tak sepadan apa yang
    // middleware harap (Array.isArray di auth.js), jadi kalau diterima ia akan senyap-senyap
    // jatuhkan SEMUA kebenaran ke default selepas simpan.
    const r1 = await api('POST', '/api/system/settings', { rolePermissions: { bukanArray: true } });
    console.log('1) hantar rolePermissions sbg OBJEK (bukan array):', r1.status, r1.json?.error || JSON.stringify(r1.json));

    if (r1.status !== 400) {
      throw new Error('DIJANGKA 400 — rolePermissions bukan-array sepatutnya ditolak sama macam array yang gagal invariant (bukan senyap diterima). Got: ' + r1.status + ' ' + JSON.stringify(r1.json));
    }

    console.log('\nSEMUA SEMAKAN LULUS — sim224 OK (pintasan jenis-bukan-array dibaiki)');
  } catch (e) {
    console.log('--- server log tail ---');
    console.log(dapatLog().slice(-3000));
    throw e;
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error('GAGAL:', e); process.exit(1); });
