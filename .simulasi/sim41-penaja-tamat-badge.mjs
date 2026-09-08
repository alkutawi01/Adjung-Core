// sim41 — GET /api/system/sponsors mesti tandakan tajaanTamat=true untuk penaja julat-tarikh yang
// tamatTajaan sudah berlalu (walau status DB kekal 'aktif', tiada cron kemas kini). Lihat komen
// sponsorRoutes.js barisKepadaPenaja (2026-09-09, bug-hunt).
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 8641;
const DB = path.join(REPO, '.simulasi', 'scratch-sim41.db');
const lapor = pelapor('sim41');

const semak = (t, ok, butiran = '') => (ok ? lapor.lulus(t) : lapor.gagal(t, butiran));

let proc;
try {
  const server = await bootServer({ port: PORT, dbFile: DB });
  proc = server.proc;
  const { base } = server;
  const { username, pass } = await ciptaPentadbir(DB);
  const cookie = await login(base, username, pass);
  const klien = buatKlien(base, cookie);

  const kini = Date.now();

  // Penaja A: julat tarikh SUDAH TAMAT (tamat semalam) — status DB kekal 'aktif' (tiada cron).
  const rTamat = await klien('POST', '/api/system/sponsors', {
    nama: 'Penaja Tamat Sim41',
    bulan: '2026-08',
    mulaTajaan: new Date(kini - 7 * 86400000).toISOString(),
    tamatTajaan: new Date(kini - 1 * 86400000).toISOString(),
  });
  semak('cipta penaja tamat berjaya', rTamat.status === 200 && rTamat.json?.success, JSON.stringify(rTamat.json));

  // Penaja B: julat tarikh MASIH AKTIF (tamat esok).
  const rAktif = await klien('POST', '/api/system/sponsors', {
    nama: 'Penaja Aktif Sim41',
    bulan: '2026-09',
    mulaTajaan: new Date(kini - 1 * 86400000).toISOString(),
    tamatTajaan: new Date(kini + 1 * 86400000).toISOString(),
  });
  semak('cipta penaja aktif berjaya', rAktif.status === 200 && rAktif.json?.success, JSON.stringify(rAktif.json));

  // Penaja C: penaja LAMA gaya bulanan (tiada julat ISO langsung) — mesti TAK tertanda tamat.
  const rBulanan = await klien('POST', '/api/system/sponsors', {
    nama: 'Penaja Bulanan Sim41',
    bulan: new Date().toISOString().slice(0, 7),
  });
  semak('cipta penaja bulanan berjaya', rBulanan.status === 200 && rBulanan.json?.success, JSON.stringify(rBulanan.json));

  const senarai = await klien('GET', '/api/system/sponsors');
  semak('GET sponsors berjaya', senarai.status === 200, JSON.stringify(senarai.json));

  const cariNama = (n) => (senarai.json || []).find((p) => p.nama === n);
  const pTamat = cariNama('Penaja Tamat Sim41');
  const pAktif = cariNama('Penaja Aktif Sim41');
  const pBulanan = cariNama('Penaja Bulanan Sim41');

  semak('penaja tamat: status DB masih "aktif" (tiada cron)', pTamat?.status === 'aktif', JSON.stringify(pTamat));
  semak('penaja tamat: tajaanTamat=true (PEPIJAT dibaiki)', pTamat?.tajaanTamat === true, JSON.stringify(pTamat));
  semak('penaja aktif sebenar: tajaanTamat=false', pAktif?.tajaanTamat === false, JSON.stringify(pAktif));
  semak('penaja bulanan (tiada julat ISO): tajaanTamat=false', pBulanan?.tajaanTamat === false, JSON.stringify(pBulanan));

  // Sahkan laluan awam /semasa TAK terjejas (masih guna sponsorAktifPadaMasa, tak papar yg tamat).
  const awam = await klien('GET', '/api/public/sponsors/semasa');
  const adaTamatDalamAwam = (awam.json || []).some((p) => p.nama === 'Penaja Tamat Sim41');
  semak('laluan awam /semasa TAK papar penaja tamat', !adaTamatDalamAwam, JSON.stringify(awam.json));
  const adaAktifDalamAwam = (awam.json || []).some((p) => p.nama === 'Penaja Aktif Sim41');
  semak('laluan awam /semasa papar penaja aktif sebenar', adaAktifDalamAwam, JSON.stringify(awam.json));

  const penemuan = lapor.ringkasan();
  process.exitCode = penemuan.length ? 1 : 0;
} finally {
  if (proc) proc.kill();
}
