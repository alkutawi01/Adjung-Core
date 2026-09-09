// sim222 — bug-hunt 2026-09-09. Tiga sekatan kunci-diri di POST /api/system/settings
// (systemRoutes.js ~baris 357-404: masihAdaManageRbac/masihAdaManageSettings/
// masihAdaManageAccounts) semak `s.rolePermissions.some(r => r.permissions?.xxx === true)`
// TANPA menapis roleId kepada set peranan SAH (ROLE_IDS_SAH di userAdminRoutes.js —
// pentadbir/ketua_editor/penolong_ketua_editor/editor). Baris rolePermissions dengan roleId
// PALSU (bukan salah satu 4 peranan sebenar) yang menanda xxx=true akan LULUS semakan
// walaupun KESEMUA 4 peranan SEBENAR nyahtanda xxx — sebab tiada pengguna sebenar boleh
// pernah pegang peranan palsu ni (user_roles.roleId dikawal ROLE_IDS_SAH di laluan
// PATCH /users/:id/roles), kunci-diri berlaku SENYAP walaupun laluan "sepatutnya" menolak.
import path from 'node:path';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien } from './sim-lib.mjs';

const PORT = 5741;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim222.db');

async function main() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-a', username: 'admin-a' });
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    // Matriks: KESEMUA 4 peranan sebenar buang manageRbac, tapi satu baris roleId PALSU
    // ("peranan_hantu") pegang manageRbac=true.
    const matriksBocor = [
      ...['pentadbir', 'ketua_editor', 'penolong_ketua_editor', 'editor'].map((roleId) => ({
        roleId, roleName: roleId,
        permissions: { manageRbac: false, manageSettings: roleId === 'pentadbir', manageAccounts: roleId === 'pentadbir' },
      })),
      { roleId: 'peranan_hantu', roleName: 'Peranan Hantu', permissions: { manageRbac: true, manageSettings: true, manageAccounts: true } },
    ];

    const r1 = await api('POST', '/api/system/settings', { rolePermissions: matriksBocor });
    console.log('1) simpan matriks manageRbac=false semua peranan SEBENAR (roleId palsu true):', r1.status, r1.json?.error);

    if (r1.status !== 400) {
      throw new Error('DIJANGKA 400 — sistem patut tolak matriks yang buang manageRbac drpd SEMUA peranan SEBENAR (roleId palsu tak patut diselamatkan). Got: ' + r1.status + ' ' + JSON.stringify(r1.json));
    }

    console.log('\nSEMUA SEMAKAN LULUS — sim222 OK (pepijat pintasan roleId palsu dibaiki)');
  } catch (e) {
    console.log('--- server log tail ---');
    console.log(dapatLog().slice(-3000));
    throw e;
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error('GAGAL:', e); process.exit(1); });
