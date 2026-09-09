// sim225 — bug-hunt 2026-09-09. Ketiga-tiga sekatan kunci-diri di POST /api/system/settings
// (systemRoutes.js masihAdaManageRbac/masihAdaManageSettings/masihAdaManageAccounts) guna
// `risSah.some(...)` merentasi SEMUA baris roleId SAH dalam array yang dihantar — TANPA
// dedupe roleId. Tapi bila matriks disimpan dan dibaca SEMULA, `parseStoredMatrix()`
// (core/middleware/auth.js baris 67-87) buat `out[row.roleId] = row.permissions` di dalam
// gelung `for` — kalau roleId SAMA muncul BERULANG kali dalam array, baris TERAKHIR yang
// menang (overwrite), bukan gabungan/pertama. Ini bercanggah dengan `.some()` semakan
// kunci-diri, yang anggap MANA-MANA baris roleId tu cukup.
//
// Ekspoitasi: hantar DUA baris untuk roleId sama ('pentadbir') — baris PERTAMA
// manageRbac:true (lulus .some() semasa simpan), baris KEDUA (terakhir dalam array)
// manageRbac:false. `masihAdaManageRbac` = true (baris pertama lulus), jadi 200 OK,
// tersimpan. Tapi apabila dibaca semula oleh hasPermission() (auth.js), roleId 'pentadbir'
// cuma dapat baris KEDUA (overwrite) — manageRbac jatuh ke false. Kunci-diri BERLAKU
// walaupun semakan "tiada satu peranan pun..." kata ia selamat.
import path from 'node:path';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien } from './sim-lib.mjs';

const PORT = 5743;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim225.db');

async function main() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-a', username: 'admin-a' });
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    const matriksJahat = [
      {
        roleId: 'pentadbir', roleName: 'Pentadbir',
        permissions: {
          viewAll: true, editOwn: false, publish: false, reject: false,
          assignSlot: false, manageSettings: true, manageRbac: true,
          manageEditorial: false, manageAccounts: true, manageEditorNotes: false,
          viewAuditLog: true,
        },
      },
      // Baris DUPLIKAT roleId sama, letak SELEPAS baris pertama — tak sepadan apa-apa
      // roleId palsu (sim222) atau bentuk salah (sim224), roleId ni SAH (lulus filter
      // ROLE_IDS.includes). manageRbac/manageSettings/manageAccounts SEMUA false di sini.
      {
        roleId: 'pentadbir', roleName: 'Pentadbir (duplikat)',
        permissions: {
          viewAll: true, editOwn: false, publish: false, reject: false,
          assignSlot: false, manageSettings: false, manageRbac: false,
          manageEditorial: false, manageAccounts: false, manageEditorNotes: false,
          viewAuditLog: true,
        },
      },
      { roleId: 'ketua_editor', roleName: 'Ketua Editor', permissions: { manageRbac: false, manageSettings: false, manageAccounts: false } },
      { roleId: 'penolong_ketua_editor', roleName: 'Penolong Ketua Editor', permissions: { manageRbac: false, manageSettings: false, manageAccounts: false } },
      { roleId: 'editor', roleName: 'Editor', permissions: { manageRbac: false, manageSettings: false, manageAccounts: false } },
    ];

    const r1 = await api('POST', '/api/system/settings', { rolePermissions: matriksJahat });
    console.log('1) hantar matriks dgn roleId "pentadbir" DUPLIKAT (baris 1 true, baris 2 false):', r1.status, r1.json?.error || JSON.stringify(r1.json).slice(0, 150));

    if (r1.status !== 200) {
      console.log('\nSEKATAN LULUS (ditolak 400) — TIADA bypass, sim225 bersih (dibaiki).');
      return;
    }

    // Simpan berjaya (200) — sekarang uji SEBENAR: adakah pentadbir 'admin-a' sekarang
    // hilang manageSettings di RUNTIME (selepas cache reload dipanggil hujung route POST)?
    // /system/weather-status digerbang requirePermission('manageSettings') — gerbang PERSIS
    // yang sepatutnya dilindungi sekatan kunci-diri "masihAdaManageSettings".
    const r2 = await api('GET', '/api/system/weather-status');
    console.log('2) GET /system/weather-status (gerbang manageSettings) selepas simpan matriks jahat:', r2.status, JSON.stringify(r2.json).slice(0, 150));

    // Cuba juga POST /system/settings semula (route ni SENDIRI digerbang manageSettings
    // di peringkat luar) — kalau 403, pentadbir dah tak boleh baiki matriksnya sendiri.
    const r3 = await api('POST', '/api/system/settings', { someOtherField: true });
    console.log('3) POST /system/settings lagi (gerbang luar manageSettings):', r3.status, JSON.stringify(r3.json).slice(0, 200));

    if (r2.status === 403 || r3.status === 403) {
      throw new Error('BUG DISAHKAN: kunci-diri sebenar berlaku — pentadbir kehilangan manageSettings di runtime (403) walaupun semakan kunci-diri simpan-masa kata matriks ni SELAMAT (200 OK pada langkah 1). Punca: duplicate-roleId dalam array tak dedupe sebelum .some(), tapi parseStoredMatrix() overwrite ikut baris TERAKHIR.');
    }

    console.log('\nTiada 403 — sim225 tak dapat reproduce kunci-diri runtime, semak manual.');
  } catch (e) {
    console.log('--- server log tail ---');
    console.log(dapatLog().slice(-3000));
    throw e;
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error('GAGAL:', e); process.exit(1); });
