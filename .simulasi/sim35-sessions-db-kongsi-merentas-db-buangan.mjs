// Sim 35 — sessions.db (stor sesi connect-sqlite3) dahulu HARDCODE ke __dirname/sessions.db,
// tak peduli ADJUNG_DB_PATH langsung (server.js ~baris 116, sebelum pembetulan). Ini melanggar
// janji eksplisit komen ADJUNG_DB_PATH sedia ada ("membolehkan pelayan dihidupkan terhadap
// pangkalan data BUANGAN untuk simulasi/ujian, TANPA MENYENTUH adjung.db sebenar") -- janji tu
// cuma betul untuk DATA, bukan SESI. Kesan sebenar: kuki sesi log masuk terhadap DB BUANGAN A
// (contoh sim bug-hunt lampau) diterima pelayan B yang dihidupkan terhadap DB BUANGAN LAIN --
// requireAuth()/requirePermission() (core/middleware/auth.js) tak pernah sahkan semula
// req.session.user lawan baris `users` SEBENAR DB semasa, cuma percaya cache sesi yang dibaca
// terus daripada sessions.db kongsi. Ujian ni hidupkan DUA pelayan (port berlainan, DB buangan
// berasingan) dan buktikan kuki daripada pelayan A masih log masuk pelayan B SEBELUM pembetulan.
import { bootServer, ciptaPentadbir, login, buatKlien } from './sim-lib.mjs';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const PORT_A = 8946;
const PORT_B = 8947;
const dbFileA = path.join(os.tmpdir(), `sim35a-${Date.now()}.db`);
const dbFileB = path.join(os.tmpdir(), `sim35b-${Date.now()}.db`);

async function main() {
  // Bersihkan session-db skop lama (kalau ada baki jalanan sebelum ni) supaya ujian bersih.
  for (const f of [dbFileA, dbFileB]) {
    const base = path.basename(f, path.extname(f));
    const p = path.join(path.dirname(f), `sessions-${base}.db`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const serverA = await bootServer({ port: PORT_A, dbFile: dbFileA });
  try {
    const { username, pass } = await ciptaPentadbir(dbFileA);
    const cookieA = await login(serverA.base, username, pass);
    const klienA = buatKlien(serverA.base, cookieA);
    const semakA = await klienA('GET', '/api/system/users');
    console.log('Sahkan kuki sah pada pelayan A (DB asal):', semakA.status);

    // Pelayan B: DB BUANGAN LAIN, akaun 'sim-admin' LANGSUNG TAK WUJUD di sini (DB baharu kosong).
    const serverB = await bootServer({ port: PORT_B, dbFile: dbFileB });
    try {
      const klienBDenganKukiA = buatKlien(serverB.base, cookieA);
      const r = await klienBDenganKukiA('GET', '/api/system/users');
      console.log('Status kuki pelayan A digunakan pada pelayan B (DB lain sepenuhnya):', r.status);

      let lulus = true;
      if (r.status === 200) {
        console.log('GAGAL: kuki sesi daripada DB BUANGAN A diterima pelayan B (DB buangan berasingan) -- sessions.db bocor merentas DB.');
        lulus = false;
      } else if (r.status === 401) {
        console.log('OK: kuki DB lain ditolak -- sessions.db kini diskop berasingan ikut ADJUNG_DB_PATH.');
      } else {
        console.log('GAGAL: status tak dijangka.', r.status, JSON.stringify(r.json));
        lulus = false;
      }
      process.exitCode = lulus ? 0 : 1;
    } finally {
      serverB.proc.kill();
    }
  } finally {
    serverA.proc.kill();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
