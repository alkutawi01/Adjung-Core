// Sim bug #219: GET /api/system/categories/slot-usage tiada gerbang auth, sedangkan ia hanya
// digunakan oleh konsol admin (BidangConsole, DashboardConsole, EditoriumView, SenaraiSlotConsole)
// — corak sama macam bug #218 (viewStatsRoutes). Uji: permintaan TANPA sesi patut 401.
import { bootServer, ciptaPentadbir, login, buatKlien, REPO } from './sim-lib.mjs';
import path from 'node:path';

const dbFile = path.join(REPO, '.simulasi', 'scratch-sim219.db');
const port = 5719;

let srv;
try {
  srv = await bootServer({ port, dbFile });
  await ciptaPentadbir(dbFile);

  // 1. Tanpa sesi langsung
  const r1 = await fetch(`${srv.base}/api/system/categories/slot-usage`);
  console.log('TANPA SESI status:', r1.status);

  // 2. Dengan sesi pentadbir sah
  const cookie = await login(srv.base, 'sim-admin', 'SimUjian!2026');
  const klien = buatKlien(srv.base, cookie);
  const r2 = await klien('GET', '/api/system/categories/slot-usage');
  console.log('DENGAN SESI status:', r2.status, 'bilangan slot:', Array.isArray(r2.json) ? r2.json.length : r2.json);

  if (r1.status === 200) {
    console.log('\n>>> PEPIJAT DISAHKAN: laluan boleh diakses TANPA log masuk (status 200).');
  } else if (r1.status === 401 || r1.status === 403) {
    console.log('\n>>> BERSIH: laluan sudah digerbang (status', r1.status, ').');
  }
} finally {
  srv?.proc.kill();
}
