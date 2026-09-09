// Sahkan pepijat (dan pembetulan): POST /api/system/settings (simpan matriks RBAC) menyemak
// "sekurang-kurangnya satu peranan kekal dengan manageRbac" DAN "...manageSettings" (#197/#198
// susulan, 2026-09-08/09) tapi TERLEPAS kebenaran ketiga yang sama genting — `manageAccounts`.
// `manageAccounts` ialah gerbang PERSIS untuk PATCH /users/:id/status DAN PATCH /users/:id/roles
// (userAdminRoutes.js) — dua laluan yang membawa semakan "Pentadbir aktif terakhir"
// (adaPentadbirAktifLain()). Kalau matriks disimpan dengan SIFAR peranan memegang manageAccounts,
// akaun 'pentadbir' aktif BOLEH kekal wujud (invariant peringkat AKAUN kelihatan selamat) tapi
// TIADA SESIAPA — termasuk Pentadbir aktif tu sendiri — dapat capai laluan urus akaun (403 di
// gerbang requirePermission('manageAccounts') SEBELUM sempat capai apa-apa semakan dalaman).
//
// Senario: Pentadbir (pegang manageRbac) simpan matriks RBAC yang menanggalkan manageAccounts
// drpd SEMUA peranan (silap klik / borang gabungan penuh), sambil KEKALKAN manageRbac dan
// manageSettings pada sekurang-kurangnya satu peranan (supaya DUA semakan sedia ada lulus).
// Tingkah laku BETUL (selepas pembetulan): simpanan ni MESTI ditolak 400, sama macam semakan
// manageRbac/manageSettings sedia ada. Sebelum pembetulan: simpanan LULUS 200, dan PATCH
// /users/:id/status/roles selepas tu ditolak 403 walaupun akaun pentadbir aktif masih wujud.
import path from 'node:path';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien } from './sim-lib.mjs';

const PORT = 5969;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim69.db');

async function main() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-a', username: 'admin-a' });
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    // Matriks: 'pentadbir' kekal manageRbac+manageSettings=true (lulus dua semakan sedia ada)
    // tapi manageAccounts=false pada SEMUA 4 peranan — sifar peranan pegang manageAccounts.
    const rolePermissions = [
      { roleId: 'pentadbir', permissions: { viewAll: true, editOwn: false, publish: false, reject: false, assignSlot: false, manageSettings: true, manageRbac: true, manageEditorial: false, manageAccounts: false, manageEditorNotes: false, viewAuditLog: true } },
      { roleId: 'ketua_editor', permissions: { viewAll: true, editOwn: true, publish: true, reject: true, assignSlot: true, manageSettings: false, manageRbac: false, manageEditorial: true, manageAccounts: false, manageEditorNotes: true, viewAuditLog: true } },
      { roleId: 'penolong_ketua_editor', permissions: { viewAll: true, editOwn: true, publish: true, reject: true, assignSlot: true, manageSettings: false, manageRbac: false, manageEditorial: true, manageAccounts: false, manageEditorNotes: false, viewAuditLog: true } },
      { roleId: 'editor', permissions: { viewAll: true, editOwn: true, publish: true, reject: false, assignSlot: false, manageSettings: false, manageRbac: false, manageEditorial: false, manageAccounts: false, manageEditorNotes: false, viewAuditLog: false } },
    ];

    const rSimpan = await api('POST', '/api/system/settings', { rolePermissions });
    console.log('Respons simpan matriks (sifar manageAccounts):', rSimpan.status, rSimpan.json);

    // Cuba capai laluan urus akaun SELEPAS simpanan — sepatutnya STAY reachable (200/400 logik
    // dalaman, bukan 403) kalau matriks ditolak betul (pembetulan berfungsi); kalau matriks
    // tersimpan (pepijat), laluan ni akan 403 walaupun admin-a admin AKTIF SATU-SATUNYA.
    const rCuba = await api('PATCH', '/api/system/users/admin-a/status', { status: 'Cuti' });
    console.log('Respons cuba PATCH /users/:id/status selepas simpanan:', rCuba.status, rCuba.json);

    const matriksTersimpanTiadaManageAccounts = rSimpan.status === 200;
    const laluanUrusAkaunDisekat403 = rCuba.status === 403;

    if (matriksTersimpanTiadaManageAccounts && laluanUrusAkaunDisekat403) {
      console.log('PEPIJAT DISAHKAN: matriks RBAC sifar manageAccounts DITERIMA (200), dan PATCH /users/:id/status kemudiannya 403 walaupun akaun Pentadbir aktif masih wujud — sistem tak lagi boleh diurus walau invariant akaun (adaPentadbirAktifLain) sendiri lulus.');
      process.exitCode = 1;
    } else if (rSimpan.status === 400 && /manageAccounts|Urus Akaun/i.test(rSimpan.json?.error || '')) {
      console.log('PASS: simpanan matriks sifar manageAccounts ditolak 400 dengan mesej yang betul — invariant "boleh diurus" merentas laluan dikuatkuasakan.');
    } else {
      console.log('KEPUTUSAN TAK DIJANGKA — semak manual:', { rSimpan: rSimpan.json, rCuba: rCuba.json });
      process.exitCode = 1;
    }
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
