// Sim 34 — POST /api/system/users (Ketua Editor CIPTA akaun baharu) tak pernah semak FORMAT
// emel, walhal POST /api/auth/change-email (tukar emel SENDIRI selepas aktif) semak format emel
// dengan regex sebelum terima. Corak sama seperti dapatan #106/#107/#108 (aktifkan-akaun) —
// peraturan dikuatkuasakan pada laluan TUKAR kemudian, tapi hilang pada laluan CIPTA.
// Kesan sebenar: Ketua Editor taip emel tersilap format (cth "bukan-emel", tiada domain), akaun
// tetap tercipta 200, hantarEmel() jemputan gagal ke alamat tak sah, DAN emel "rosak" tu terus
// menganggap dirinya "digunakan" -- POST semula (walau dieja betul kali ni) 409 sbb emel asal
// dah wujud dlm DB, tiada laluan UI pulihkan (lihat komen sedia ada di hantar-semula-jemputan).
import { bootServer, ciptaPentadbir, login, buatKlien } from './sim-lib.mjs';
import path from 'node:path';
import os from 'node:os';

const PORT = 8944;
const dbFile = path.join(os.tmpdir(), `sim34-${Date.now()}.db`);

async function main() {
  const { proc, base } = await bootServer({ port: PORT, dbFile });
  try {
    const { username, pass } = await ciptaPentadbir(dbFile);
    const cookie = await login(base, username, pass);
    const klien = buatKlien(base, cookie);

    const r = await klien('POST', '/api/system/users', {
      email: 'bukan-emel-yang-sah', roles: ['editor'],
    });
    console.log('Status cipta akaun (emel tak sah):', r.status, JSON.stringify(r.json));
    let lulus = true;
    if (r.status === 200) {
      console.log('GAGAL: emel tak sah diterima semasa cipta akaun.');
      lulus = false;
    } else if (r.status === 400) {
      console.log('OK: emel tak sah ditolak semasa cipta akaun.');
    } else {
      console.log('GAGAL: status tak dijangka.');
      lulus = false;
    }

    // Laluan positif -- emel sah tetap mesti diterima seperti biasa.
    const r2 = await klien('POST', '/api/system/users', {
      email: 'editor-sah@sim.test', roles: ['editor'],
    });
    console.log('Status cipta akaun (emel sah):', r2.status, JSON.stringify(r2.json));
    if (r2.status !== 200) {
      console.log('GAGAL: emel sah turut ditolak selepas pembetulan.');
      lulus = false;
    } else {
      console.log('OK: emel sah tetap diterima.');
    }
    process.exitCode = lulus ? 0 : 1;
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
