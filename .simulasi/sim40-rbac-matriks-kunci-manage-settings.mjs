// sim40 — instans KEDUA vein kunci-diri RBAC (sambungan sim39/bug #113). Laluan POST
// /api/system/settings digerbang requirePermission('manageSettings') di PERINGKAT ROUTE (gerbang
// LUAR), dan cabang rolePermissions pula perlu manageRbac TAMBAHAN (gerbang DALAM, dibaiki
// sim39). Semakan sim39 cuma pastikan manageRbac tak dibuang drpd SEMUA peranan — tapi kalau
// matriks yang disimpan buang manageSettings drpd SEMUA peranan (walau manageRbac dikekalkan),
// gerbang LUAR sendiri akan tolak SESIAPA — termasuk pemegang manageRbac — sebelum sempat capai
// cabang rolePermissions langsung. Hasil sama seperti sim39 (satu-satunya pemulihan ialah edit
// terus adjung.db), laluan kuncinya cuma berbeza (gerbang luar, bukan cabang dalam).
import path from 'node:path';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien } from './sim-lib.mjs';

const PORT = 5740;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim40.db');

async function main() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-a', username: 'admin-a' });
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    // Matriks baharu: manageRbac dikekalkan (pentadbir), tapi manageSettings=false MERENTASI
    // SEMUA peranan (silap konfigurasi munasabah — Pentadbir nyahtanda kotak "Urus Tetapan
    // Sistem" miliknya sendiri, fikir cuma togol biasa, tak sedar ia gerbang laluan ni sendiri).
    const matriksKunciManageSettings = ['pentadbir', 'ketua_editor', 'penolong_ketua_editor', 'editor'].map((roleId) => ({
      roleId,
      roleName: roleId,
      permissions: { manageSettings: false, manageRbac: roleId === 'pentadbir', manageAccounts: roleId === 'pentadbir' },
    }));

    const r1 = await api('POST', '/api/system/settings', { rolePermissions: matriksKunciManageSettings });
    console.log('1) simpan matriks manageSettings=false semua peranan:', r1.status, r1.json?.error);

    // Selepas pembetulan: r1 MESTI ditolak 400 di titik simpan.
    if (r1.status !== 400) {
      throw new Error('DIJANGKA 400 — sistem patut tolak matriks yang buang manageSettings drpd SEMUA peranan. Got: ' + r1.status + ' ' + JSON.stringify(r1.json));
    }

    // Sahkan laluan /system/settings MASIH BOLEH DICAPAI selepas percubaan ditolak (bukti tiada
    // kerosakan sebenar berlaku — kalau r1 ditolak dgn betul di peringkat pengesahan, akaun admin-a
    // masih pegang manageSettings sepenuhnya, gerbang luar tetap terbuka).
    const r2 = await api('POST', '/api/system/settings', { frontpageTitle: 'Ujian Sim40' });
    console.log('2) laluan /system/settings masih boleh dicapai selepas percubaan ditolak:', r2.status, r2.json?.error);
    if (r2.status !== 200) throw new Error('DIJANGKA 200 — laluan patut kekal berfungsi normal. Got: ' + r2.status + ' ' + JSON.stringify(r2.json));

    // Matriks sah (sekurang-kurangnya SATU peranan kekal manageSettings DAN manageRbac) mesti
    // tetap diterima.
    const matriksSah = matriksKunciManageSettings.map((r) => r.roleId === 'pentadbir'
      ? { ...r, permissions: { ...r.permissions, manageSettings: true } }
      : r);
    const r3 = await api('POST', '/api/system/settings', { rolePermissions: matriksSah });
    console.log('3) simpan matriks sah (pentadbir kekal manageSettings + manageRbac):', r3.status, r3.json?.error);
    if (r3.status !== 200) throw new Error('DIJANGKA 200 — matriks sah patut diterima. Got: ' + r3.status + ' ' + JSON.stringify(r3.json));

    console.log('\nSEMUA SEMAKAN LULUS — sim40 OK (pepijat kunci-diri manageSettings dibaiki)');
  } catch (e) {
    console.log('--- server log tail ---');
    console.log(dapatLog().slice(-3000));
    throw e;
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error('GAGAL:', e); process.exit(1); });
