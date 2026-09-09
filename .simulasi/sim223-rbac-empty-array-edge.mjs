// sim223 — bug-hunt 2026-09-09. Susulan #220/sim222: sahkan kes TEPI array kosong/semua-palsu
// bagi risSah (filter kepada ROLE_IDS SAH di systemRoutes.js ~baris 369) TIDAK cipta pintasan
// baharu. Dua senario:
//  (a) rolePermissions = [] (array kosong terus) — risSah = [], .some() atas array kosong
//      MESTI pulangkan false utk KETIGA-TIGA kunci (manageRbac/manageSettings/manageAccounts),
//      jadi laluan MESTI tolak 400 (bukan lulus 200 sbb "tiada apa nak semak").
//  (b) rolePermissions = [baris roleId palsu sahaja, tiada satu pun 4 peranan sebenar] — risSah
//      selepas tapis jadi [] juga (sama kesan macam (a)), MESTI tolak 400 jua.
import path from 'node:path';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien } from './sim-lib.mjs';

const PORT = 5742;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim223.db');

async function main() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-a', username: 'admin-a' });
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    // (a) array kosong terus
    const r1 = await api('POST', '/api/system/settings', { rolePermissions: [] });
    console.log('(a) rolePermissions=[]:', r1.status, r1.json?.error);
    if (r1.status !== 400) {
      throw new Error('DIJANGKA 400 utk rolePermissions=[] (risSah kosong -> .some() kosong -> false -> tolak). Got: ' + r1.status + ' ' + JSON.stringify(r1.json));
    }

    // (b) cuma baris roleId palsu (bukan satu pun 4 peranan sebenar)
    const matriksSemuaPalsu = [
      { roleId: 'peranan_hantu_1', roleName: 'Hantu 1', permissions: { manageRbac: true, manageSettings: true, manageAccounts: true } },
      { roleId: 'peranan_hantu_2', roleName: 'Hantu 2', permissions: { manageRbac: true, manageSettings: true, manageAccounts: true } },
    ];
    const r2 = await api('POST', '/api/system/settings', { rolePermissions: matriksSemuaPalsu });
    console.log('(b) rolePermissions=[semua roleId palsu]:', r2.status, r2.json?.error);
    if (r2.status !== 400) {
      throw new Error('DIJANGKA 400 utk rolePermissions cuma roleId palsu (risSah tapis jadi kosong). Got: ' + r2.status + ' ' + JSON.stringify(r2.json));
    }

    console.log('\nSEMUA SEMAKAN LULUS — sim223 OK (kes tepi array kosong/semua-palsu tiada pintasan baharu)');
  } catch (e) {
    console.log('--- server log tail ---');
    console.log(dapatLog().slice(-3000));
    throw e;
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error('GAGAL:', e); process.exit(1); });
