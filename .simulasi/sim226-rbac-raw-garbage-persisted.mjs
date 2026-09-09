// sim226 — bug-hunt 2026-09-09. POST /api/system/settings's three self-lockout guards
// (masihAdaManageRbac/Settings/Accounts) compute `risEfektif` — s.rolePermissions filtered to
// real ROLE_IDS and deduped last-write-wins per roleId — to DECIDE whether a save is safe. But
// the actual DB write (SETTINGS_SERIALIZER.rolePermissions) used to serialize `s.rolePermissions`
// UNTOUCHED (the raw request array), not `risEfektif`. So a fake-roleId row (already rejected by
// #220's filter) or a losing duplicate-roleId row (already deduped away by #222/#225's fix) still
// got persisted verbatim into system_settings.rolePermissions, even though it played no part in
// the safety decision that just approved the save.
//
// This test proves the stored JSON contained the raw garbage before the fix (documented below by
// asserting the FIXED behavior: stored rolePermissions must equal exactly `risEfektif`'s shape —
// no fake-roleId row, no losing duplicate row).
import path from 'node:path';
import Database from 'sqlite3';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien } from './sim-lib.mjs';

const PORT = 5745;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim226.db');

function dbGetRaw(dbFile, sql) {
  return new Promise((resolve, reject) => {
    const db = new Database.Database(dbFile);
    db.get(sql, (err, row) => {
      db.close();
      if (err) reject(err); else resolve(row);
    });
  });
}

async function main() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-a', username: 'admin-a' });
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    const matriks = [
      // Baris roleId PALSU — sepatutnya langsung tak wujud, ditapis keluar drpd risEfektif oleh
      // fix #220, tapi (sebelum fix ni) tetap tersimpan verbatim.
      { roleId: 'super-admin-hantu', roleName: 'Hantu', permissions: { manageRbac: true, manageSettings: true, manageAccounts: true } },
      // Baris DUPLIKAT roleId 'pentadbir' — versi KALAH last-write-wins (fix #222/#225 pastikan
      // baris ni tak disumbang kepada keputusan .some() sebab baris KEDUA di bawah menang, tapi
      // ia MASIH bahagian s.rolePermissions mentah sebelum fix ni).
      { roleId: 'pentadbir', roleName: 'Pentadbir (bayang lapuk)', permissions: { manageRbac: false, manageSettings: false, manageAccounts: false } },
      { roleId: 'pentadbir', roleName: 'Pentadbir', permissions: {
        viewAll: true, editOwn: false, publish: false, reject: false,
        assignSlot: false, manageSettings: true, manageRbac: true,
        manageEditorial: false, manageAccounts: true, manageEditorNotes: false, viewAuditLog: true,
      } },
      { roleId: 'ketua_editor', roleName: 'Ketua Editor', permissions: { manageRbac: false, manageSettings: false, manageAccounts: false } },
      { roleId: 'penolong_ketua_editor', roleName: 'Penolong Ketua Editor', permissions: { manageRbac: false, manageSettings: false, manageAccounts: false } },
      { roleId: 'editor', roleName: 'Editor', permissions: { manageRbac: false, manageSettings: false, manageAccounts: false } },
    ];

    const r1 = await api('POST', '/api/system/settings', { rolePermissions: matriks });
    console.log('1) simpan matriks (1 baris palsu + 1 baris pendua kalah):', r1.status, r1.json?.error || 'OK');
    if (r1.status !== 200) throw new Error('Jangka 200 (matriks efektif selamat) tapi dapat ' + r1.status);

    const row = await dbGetRaw(DB_FILE, "SELECT rolePermissions FROM system_settings WHERE id = 'settings-main'");
    const stored = JSON.parse(row.rolePermissions);
    console.log('2) rolePermissions TERSIMPAN (bilangan baris):', stored.length, stored.map((r) => r.roleId));

    const adaHantu = stored.some((r) => r.roleId === 'super-admin-hantu');
    const adaDuaPentadbir = stored.filter((r) => r.roleId === 'pentadbir').length > 1;
    const pentadbirTersimpan = stored.find((r) => r.roleId === 'pentadbir');

    if (adaHantu) throw new Error('BUG: baris roleId PALSU "super-admin-hantu" tersimpan verbatim walau ditapis keluar drpd pengesahan.');
    if (adaDuaPentadbir) throw new Error('BUG: DUA baris "pentadbir" tersimpan (baris kalah last-write-wins tak dibuang) — data tersimpan tak padan apa yg disahkan.');
    if (!pentadbirTersimpan || pentadbirTersimpan.permissions.manageRbac !== true) {
      throw new Error('BUG: baris "pentadbir" tersimpan tak sepadan nilai EFEKTIF (manageRbac patut true).');
    }
    if (stored.length !== 4) throw new Error(`BUG: jangka tepat 4 baris efektif (4 ROLE_IDS sebenar), dapat ${stored.length}.`);

    console.log('\nBERSIH — rolePermissions tersimpan == risEfektif tepat (tiada hantu, tiada pendua kalah).');

    // Sahkan permission runtime juga betul (cache reload guna nilai yg sama).
    const r2 = await api('GET', '/api/system/weather-status');
    console.log('3) GET /system/weather-status (gerbang manageSettings):', r2.status);
    if (r2.status !== 200) throw new Error('Pentadbir patut kekal manageSettings=true selepas simpan ni.');
  } catch (e) {
    console.log('--- server log tail ---');
    console.log(dapatLog().slice(-3000));
    throw e;
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error('GAGAL:', e); process.exit(1); });
