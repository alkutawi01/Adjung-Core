// sim39 — matriks Kawalan Akses (system_settings.rolePermissions) boleh disimpan dalam keadaan
// yang mengunci SELURUH sistem: satu Pentadbir (dengan manageRbac) hantar POST /system/settings
// dengan rolePermissions yang menyahaktifkan manageRbac untuk SEMUA peranan termasuk pentadbir
// sendiri. Selepas simpan, TIADA sesiapa (walau Pentadbir lain, walau akaun baharu dilantik) lagi
// boleh manageRbac — satu-satunya gerbang laluan PATCH ni (systemRoutes.js, dapatan 2026-09-08)
// — laluan pulih SATU-SATUNYA ialah edit terus adjung.db. Ini beza daripada sim38 (akaun
// Pentadbir AKTIF terakhir dilindungi daripada digantung/ditarik peranan) — di sini AKAUN
// pentadbir kekal aktif & berperanan pentadbir, tapi KAPASITI manageRbac itu sendiri dipadam
// daripada seluruh matriks, jadi lantik pentadbir baharu pun tak membantu (peranan tu sendiri
// dah tak bawa manageRbac lagi).
import path from 'node:path';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien } from './sim-lib.mjs';

const PORT = 5739;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim39.db');

async function main() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-a', username: 'admin-a' });
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    // Matriks baharu: SEMUA 4 peranan, manageRbac=false merentasi semua (silap konfigurasi yang
    // munasabah berlaku — cth borang Kawalan Akses hantar objek gabungan penuh dan Pentadbir
    // tersilap nyahtanda kotak manageRbac miliknya sendiri, fikir ia kawalan biasa).
    const matriksKunciDiri = ['pentadbir', 'ketua_editor', 'penolong_ketua_editor', 'editor'].map((roleId) => ({
      roleId,
      roleName: roleId,
      permissions: { manageRbac: false, manageSettings: roleId === 'pentadbir', manageAccounts: roleId === 'pentadbir' },
    }));

    const r1 = await api('POST', '/api/system/settings', { rolePermissions: matriksKunciDiri });
    console.log('1) simpan matriks manageRbac=false semua peranan:', r1.status, r1.json?.error);

    // Cuba PATCH RBAC lagi (cth nak pulihkan manageRbac) — kalau sistem betul-betul terkunci,
    // laluan ni sendiri ditolak 403 sebab akaun admin-a (masih pentadbir) tiada lagi manageRbac.
    const r2 = await api('POST', '/api/system/settings', {
      rolePermissions: matriksKunciDiri.map((r) => r.roleId === 'pentadbir'
        ? { ...r, permissions: { ...r.permissions, manageRbac: true } }
        : r),
    });
    console.log('2) cuba pulihkan manageRbac selepas dikunci:', r2.status, r2.json?.error);

    // Selepas pembetulan: r1 (matriks manageRbac=false SEMUA peranan) MESTI ditolak 400 di
    // titik simpan — sistem tak boleh terjebak sampai r2 langsung.
    if (r1.status !== 400) {
      throw new Error('DIJANGKA 400 — sistem patut tolak matriks yang buang manageRbac drpd SEMUA peranan. Got: ' + r1.status + ' ' + JSON.stringify(r1.json));
    }

    // Matriks sah (sekurang-kurangnya SATU peranan kekal manageRbac) mesti tetap diterima.
    const matriksSah = matriksKunciDiri.map((r) => r.roleId === 'pentadbir'
      ? { ...r, permissions: { ...r.permissions, manageRbac: true } }
      : r);
    const r3 = await api('POST', '/api/system/settings', { rolePermissions: matriksSah });
    console.log('3) simpan matriks sah (pentadbir kekal manageRbac):', r3.status, r3.json?.error);
    if (r3.status !== 200) throw new Error('DIJANGKA 200 — matriks sah patut diterima. Got: ' + r3.status + ' ' + JSON.stringify(r3.json));

    console.log('\nSEMUA SEMAKAN LULUS — sim39 OK (pepijat kunci-diri RBAC dibaiki)');
  } catch (e) {
    console.log('--- server log tail ---');
    console.log(dapatLog().slice(-3000));
    throw e;
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error('GAGAL:', e); process.exit(1); });
