// SIMULASI 14 — API AWAM SELEPAS ARKIB/TOLAK (bug-hunt 2026-09-08).
//
// Tiada simulasi sedia ada (sim1-13) yang menyemak GET /api/system/layout/active (API AWAM
// sebenar yang FrontpageView.tsx panggil) SELEPAS kandungan diarkib/ditolak/dipadam — semuanya
// menyemak status DB sahaja. Kalau resolveSlotContent() (server.js) tersalah senarai putih
// status, kandungan yang Ketua Editor SANGKA sudah ditarik balik (arkib/tolak) mungkin kekal
// kelihatan kepada pembaca sebenar -- kesan paling teruk yang boleh berlaku pada projek ni.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, bukaDb, isiHuraianCukup, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5214;
const DBF = path.join(os.tmpdir(), 'sim-adjung-awam-arkib.db');
const lap = pelapor('SIM 14 — AWAM SELEPAS ARKIB/TOLAK');

const SLOT = 2; // STANDARD tier
const BIDANG = 'Sains';

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  await api('POST', '/api/system/categories/activate', { name: BIDANG, color: '#334455', icon: 'Atom' });
  await api('POST', '/api/system/categories/assign-slot', { slotIndex: SLOT, bidangName: BIDANG });

  const TAJUK_UNIK = 'Penemuan Zarah Sim14 Ujian Awam Unik';
  const blok = [
    'UUID: sim14-uuid-0001',
    `Tajuk: ${TAJUK_UNIK}`,
    'Huraian ringkas: ' + isiHuraianCukup(ceilingForSlot, SLOT, TAJUK_UNIK.length),
    'Huraian panjang: ' + HURAIAN_PANJANG_SAH,
    'Bidang: ' + BIDANG,
    'Topik: Fizik',
    'Sumber: Berita Harian',
    'URL: https://www.bharian.com.my/sim14-ujian',
    'Tarikh sumber: 2026-09-01',
    'Status: terbit',
  ].join('\n');

  const rTerbit = await api('POST', '/api/system/slots', [{
    slotIndex: SLOT, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok,
  }]);
  if (!rTerbit.ok) throw new Error('Terbitkan gagal: HTTP ' + rTerbit.status + ' ' + rTerbit.teks.slice(0, 200));

  const obj = await dbGet(db, 'SELECT id FROM editorial_objects ORDER BY createdAt DESC LIMIT 1');
  if (!obj) throw new Error('Tiada objek dicipta selepas terbit');
  const OBJ = obj.id;

  // A. Selepas Terbit — kandungan MESTI kelihatan pada API awam
  const layoutSelepasTerbit = await fetch(srv.base + '/api/system/layout/active').then(r => r.json());
  const slotTerbit = (layoutSelepasTerbit.slots || layoutSelepasTerbit).find?.(s => s.slotIndex === SLOT)
    || Object.values(layoutSelepasTerbit).find?.(() => false);
  const carianTajuk = JSON.stringify(layoutSelepasTerbit).includes(TAJUK_UNIK);
  if (!carianTajuk) {
    lap.gagal('Kandungan Aktif TIDAK kelihatan pada API awam selepas Terbit', 'tajuk unik tiada dalam /layout/active');
  } else {
    lap.lulus('Kandungan Aktif kelihatan pada API awam selepas Terbit');
  }

  // B. ARKIB kandungan — API awam MESTI berhenti memaparkannya SERTA-MERTA (tiada cache basi)
  const rArkib = await api('PATCH', `/api/system/content/${OBJ}`, { status: 'archived' });
  if (!rArkib.ok) throw new Error('Arkib gagal: HTTP ' + rArkib.status + ' ' + rArkib.teks.slice(0, 200));

  const layoutSelepasArkib = await fetch(srv.base + '/api/system/layout/active').then(r => r.json());
  const masihAdaSelepasArkib = JSON.stringify(layoutSelepasArkib).includes(TAJUK_UNIK);
  if (masihAdaSelepasArkib) {
    lap.gagal('KRITIKAL: kandungan diarkib TAPI MASIH kelihatan pada API awam', `objectId=${OBJ}, tajuk="${TAJUK_UNIK}"`);
  } else {
    lap.lulus('Kandungan hilang daripada API awam serta-merta selepas Arkib');
  }

  // C. TOLAK ke draf kandungan LAIN — sama pengesahan (draf pun tak patut nampak di awam)
  const TAJUK_DRAF = 'Kandungan Draf Sim14 Tak Patut Nampak';
  const blokDraf = [
    'UUID: sim14-uuid-0002',
    `Tajuk: ${TAJUK_DRAF}`,
    'Huraian ringkas: ' + isiHuraianCukup(ceilingForSlot, SLOT, TAJUK_DRAF.length),
    'Huraian panjang: ' + HURAIAN_PANJANG_SAH,
    'Bidang: ' + BIDANG,
    'Topik: Fizik',
    'Sumber: Utusan',
    'URL: https://utusan.test/sim14-draf',
    'Tarikh sumber: 2026-09-01',
    'Status: terbit',
  ].join('\n');
  const rTerbit2 = await api('POST', '/api/system/slots', [{
    slotIndex: SLOT, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blokDraf,
  }]);
  if (!rTerbit2.ok) throw new Error('Terbitkan kedua gagal: HTTP ' + rTerbit2.status);
  const obj2 = await dbGet(db, "SELECT id FROM editorial_objects WHERE id != ? ORDER BY createdAt DESC LIMIT 1", [OBJ]);
  const OBJ2 = obj2.id;

  const rTolak = await api('POST', `/api/system/content/${OBJ2}/reject-to-draft`, { sebab: 'Ujian sim14: semak semula.' });
  if (!rTolak.ok) throw new Error('Tolak ke draf gagal: HTTP ' + rTolak.status + ' ' + rTolak.teks.slice(0, 200));

  const layoutSelepasTolak = await fetch(srv.base + '/api/system/layout/active').then(r => r.json());
  const masihAdaSelepasTolak = JSON.stringify(layoutSelepasTolak).includes(TAJUK_DRAF);
  if (masihAdaSelepasTolak) {
    lap.gagal('KRITIKAL: kandungan ditolak ke draf TAPI MASIH kelihatan pada API awam', `objectId=${OBJ2}, tajuk="${TAJUK_DRAF}"`);
  } else {
    lap.lulus('Kandungan hilang daripada API awam serta-merta selepas Tolak ke draf');
  }

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
