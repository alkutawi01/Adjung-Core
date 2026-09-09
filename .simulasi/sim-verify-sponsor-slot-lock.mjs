// VERIFIKASI AD-HOC — kunci penggantian slot penaja (sponsor_slots), bug-hunt 2026-09-09.
//
// Dua PATCH /system/sponsors/:id BERSELANG-SELI pada PENAJA SAMA (masing-masing minta
// senarai slot BERBEZA) sepatutnya hasilkan HANYA senarai salah SATU permintaan tu selepas
// keduanya selesai (bukan gabungan kedua-dua, yang menandakan lost-update race pada
// DELETE+INSERT tanpa kunci).
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbAll, bukaDb } from './sim-lib.mjs';

const PORT = 5299;
const DBF = path.join(os.tmpdir(), 'sim-adjung-sponsor-slot-lock.db');
const lap = pelapor('VERIFIKASI — KUNCI SLOT PENAJA');

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  const cipta = await api('POST', '/api/system/sponsors', {
    nama: 'Penaja Ujian Kunci', bulan: '2026-09', slotIndexes: [1, 2],
  });
  if (!cipta.ok) throw new Error('gagal cipta penaja: ' + JSON.stringify(cipta.json));
  const id = cipta.json.id;

  // 20 pusingan bagi keyakinan tinggi (window race ni sangat singkat kalau tiada kunci).
  let gabungan = 0;
  for (let i = 0; i < 20; i++) {
    await Promise.all([
      api('PATCH', `/api/system/sponsors/${id}`, { slotIndexes: [10, 11, 12] }),
      api('PATCH', `/api/system/sponsors/${id}`, { slotIndexes: [20, 21, 22] }),
    ]);
    const rows = (await dbAll(db, 'SELECT slotIndex FROM sponsor_slots WHERE sponsorId=? ORDER BY slotIndex', [id]))
      .map(r => r.slotIndex);
    const ialahA = JSON.stringify(rows) === JSON.stringify([10, 11, 12]);
    const ialahB = JSON.stringify(rows) === JSON.stringify([20, 21, 22]);
    if (!ialahA && !ialahB) {
      gabungan++;
      console.log(`  pusingan ${i}: HASIL BERCAMPUR ${JSON.stringify(rows)}`);
    }
  }

  if (gabungan > 0) {
    lap.gagal('KUNCI TIDAK BERFUNGSI', `${gabungan}/20 pusingan hasil bercampur (lost-update race sahih)`);
  } else {
    lap.lulus('kunci berfungsi: 20/20 pusingan hasil BERSIH (salah satu permintaan menang penuh, tiada gabungan)');
  }

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
