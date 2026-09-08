// sim44 — susulan sim41/sim42 (2026-09-09). tajaanSudahLepas() (sponsorRoutes.js) yang
// dibaiki hari ni HANYA tangani penaja julat-tarikh (mulaTajaan+tamatTajaan) — cabang penaja
// BULANAN lama (guna `bulan`, tiada julat ISO) tercicir drpd pembetulan asal, kembali `false`
// serta-merta bila julat ISO tiada. sponsorAktifPadaMasa() (gerbang SEBENAR laluan awam) sudah
// betul menyembunyikan penaja bulanan yang `bulan`-nya BUKAN bulan semasa, tapi Editorium
// (GET /api/system/sponsors) terus label ia "Aktif" (tajaanTamat=false) walau logo penaja tu
// sudah lama tak tayang di laman awam.
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 8643;
const DB = path.join(REPO, '.simulasi', 'scratch-sim44.db');
const lapor = pelapor('sim44');

const semak = (t, ok, butiran = '') => (ok ? lapor.lulus(t) : lapor.gagal(t, butiran));

let proc;
try {
  const server = await bootServer({ port: PORT, dbFile: DB });
  proc = server.proc;
  const { base } = server;
  const { username, pass } = await ciptaPentadbir(DB);
  const cookie = await login(base, username, pass);
  const klien = buatKlien(base, cookie);

  // Penaja bulanan LAPUK — `bulan` = "2026-01" (bulan lama), TIADA julat ISO langsung
  // (mulaTajaan/tamatTajaan tak dihantar), status akan default 'aktif' semasa cipta.
  const rLapuk = await klien('POST', '/api/system/sponsors', {
    nama: 'Penaja Bulanan Lapuk Sim44',
    bulan: '2026-01',
  });
  semak('cipta penaja bulanan lapuk berjaya', rLapuk.status === 200 && rLapuk.json?.success, JSON.stringify(rLapuk.json));

  const senarai = await klien('GET', '/api/system/sponsors');
  semak('GET sponsors berjaya', senarai.status === 200, JSON.stringify(senarai.json));
  const pLapuk = (senarai.json || []).find((p) => p.nama === 'Penaja Bulanan Lapuk Sim44');

  semak('penaja bulanan lapuk: status DB "aktif"', pLapuk?.status === 'aktif', JSON.stringify(pLapuk));
  semak('penaja bulanan lapuk: tajaanTamat=true (SEBELUM fix: false walau bulan lapuk)', pLapuk?.tajaanTamat === true, JSON.stringify(pLapuk));

  // Sahkan laluan awam /semasa memang TAK papar ia (bulan lapuk) — buktikan Editorium
  // tercicir drpd realiti awam SEBELUM fix.
  const awam = await klien('GET', '/api/public/sponsors/semasa');
  const adaDalamAwam = (awam.json || []).some((p) => p.nama === 'Penaja Bulanan Lapuk Sim44');
  semak('laluan awam /semasa TAK papar penaja bulanan lapuk', !adaDalamAwam, JSON.stringify(awam.json));

  // Kawalan negatif: penaja bulanan SEMASA (bulan = bulan ni) tak sepatutnya label "Tamat".
  const bulanSemasaStr = new Date().toISOString().slice(0, 7);
  const rSemasa = await klien('POST', '/api/system/sponsors', {
    nama: 'Penaja Bulanan Semasa Sim44',
    bulan: bulanSemasaStr,
  });
  semak('cipta penaja bulanan semasa berjaya', rSemasa.status === 200 && rSemasa.json?.success, JSON.stringify(rSemasa.json));
  const senarai2 = await klien('GET', '/api/system/sponsors');
  const pSemasa = (senarai2.json || []).find((p) => p.nama === 'Penaja Bulanan Semasa Sim44');
  semak('penaja bulanan semasa: tajaanTamat=false (tak terjejas fix)', pSemasa?.tajaanTamat === false, JSON.stringify(pSemasa));

  const penemuan = lapor.ringkasan();
  process.exitCode = penemuan.length ? 1 : 0;
} finally {
  if (proc) proc.kill();
}
