// sim42 — pepijat susulan sim41 (2026-09-09). `tajaanTamat` (sponsorRoutes.js barisKepadaPenaja)
// dikira sebagai `!sponsorAktifPadaMasa(...)` — tapi sponsorAktifPadaMasa() pulangkan FALSE bagi
// DUA sebab berbeza: (1) tamatTajaan sudah BERLALU (memang "Tamat", label betul), ATAU
// (2) mulaTajaan MASIH DI MASA HADAPAN (tajaan BELUM BERMULA, bukan "Tamat" — label SALAH).
// Penaja julat-tarikh masa hadapan (cth kempen minggu depan yang admin sediakan awal) akan terus
// dipaparkan dengan lencana amaran "Tamat" di Editorium sebaik ia dicipta — mengelirukan Pentadbir
// (nampak macam tajaan dah luput walhal ia belum pun bermula).
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 8642;
const DB = path.join(REPO, '.simulasi', 'scratch-sim42.db');
const lapor = pelapor('sim42');

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

  // Penaja D: julat tarikh MASA HADAPAN sepenuhnya (mula lusa, tamat minggu depan) — belum
  // bermula langsung, BUKAN "Tamat".
  const rBelumMula = await klien('POST', '/api/system/sponsors', {
    nama: 'Penaja Belum Mula Sim42',
    bulan: '2026-10',
    mulaTajaan: new Date(kini + 2 * 86400000).toISOString(),
    tamatTajaan: new Date(kini + 9 * 86400000).toISOString(),
  });
  semak('cipta penaja belum-mula berjaya', rBelumMula.status === 200 && rBelumMula.json?.success, JSON.stringify(rBelumMula.json));

  const senarai = await klien('GET', '/api/system/sponsors');
  semak('GET sponsors berjaya', senarai.status === 200, JSON.stringify(senarai.json));
  const pBelumMula = (senarai.json || []).find((p) => p.nama === 'Penaja Belum Mula Sim42');

  semak('penaja belum-mula: status DB "aktif"', pBelumMula?.status === 'aktif', JSON.stringify(pBelumMula));
  semak('penaja belum-mula: tajaanTamat=false (PEPIJAT: sebelum dibaiki ia true)', pBelumMula?.tajaanTamat === false, JSON.stringify(pBelumMula));

  // Sahkan laluan awam /semasa turut betul TAK papar ia (belum bermula, bukan sebab pepijat ni).
  const awam = await klien('GET', '/api/public/sponsors/semasa');
  const adaDalamAwam = (awam.json || []).some((p) => p.nama === 'Penaja Belum Mula Sim42');
  semak('laluan awam /semasa TAK papar penaja belum-mula', !adaDalamAwam, JSON.stringify(awam.json));

  const penemuan = lapor.ringkasan();
  process.exitCode = penemuan.length ? 1 : 0;
} finally {
  if (proc) proc.kill();
}
