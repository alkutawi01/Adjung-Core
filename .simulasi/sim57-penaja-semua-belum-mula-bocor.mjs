// sim57 — pepijat baharu (2026-09-09, bug-hunt). GET /api/public/sponsors/semua (laluan AWAM
// halaman /penaja, HalamanPenaja.tsx) memulangkan SEMUA penaja status='aktif' TANPA tapis
// sponsorAktifPadaMasa() langsung — tak macam /public/sponsors/semasa (footer) yang sudah betul
// tapis. Kesan sebenar: penaja julat-tarikh yang mulaTajaan MASIH DI MASA HADAPAN (cth kempen
// disediakan awal untuk minggu depan, belum sepatutnya tayang) terus dipaparkan nama+logo+URL
// pautan klik di halaman /penaja AWAM sebaik dicipta — mendedahkan penaja sebelum tempoh
// bermula, bertentangan falsafah ciri julat-tarikh (logo patut TEPAT ikut tempoh, "hilang
// TEPAT bila tamat" — sepatutnya juga "muncul TEPAT bila mula", bukan awal).
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 8643;
const DB = path.join(REPO, '.simulasi', 'scratch-sim57.db');
const lapor = pelapor('sim57');

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

  // Penaja masa hadapan sepenuhnya (mula lusa, tamat minggu depan) — belum sepatutnya tayang
  // di mana-mana laluan awam.
  const rBelumMula = await klien('POST', '/api/system/sponsors', {
    nama: 'Penaja Belum Mula Sim57',
    bulan: '2026-10',
    mulaTajaan: new Date(kini + 2 * 86400000).toISOString(),
    tamatTajaan: new Date(kini + 9 * 86400000).toISOString(),
  });
  semak('cipta penaja belum-mula berjaya', rBelumMula.status === 200 && rBelumMula.json?.success, JSON.stringify(rBelumMula.json));

  // Penaja lama tamatTajaan sudah lepas (kononnya nak muncul sbg sejarah di /semua — sengaja
  // TAK disentuh oleh fix, kekal tampil sbg arkib/sejarah).
  const rTamat = await klien('POST', '/api/system/sponsors', {
    nama: 'Penaja Sudah Tamat Sim57',
    bulan: '2026-08',
    mulaTajaan: new Date(kini - 20 * 86400000).toISOString(),
    tamatTajaan: new Date(kini - 5 * 86400000).toISOString(),
  });
  semak('cipta penaja sudah-tamat berjaya', rTamat.status === 200 && rTamat.json?.success, JSON.stringify(rTamat.json));

  const semua = await klien('GET', '/api/public/sponsors/semua');
  semak('GET /public/sponsors/semua berjaya', semua.status === 200, JSON.stringify(semua.json));

  const adaBelumMula = (semua.json || []).some((p) => p.nama === 'Penaja Belum Mula Sim57');
  semak('FIX: /semua TAK papar penaja belum-mula (masa hadapan)', !adaBelumMula, JSON.stringify(semua.json));

  const adaSudahTamat = (semua.json || []).some((p) => p.nama === 'Penaja Sudah Tamat Sim57');
  semak('/semua MASIH papar penaja sudah-tamat (sejarah/arkib, sengaja tak disentuh)', adaSudahTamat, JSON.stringify(semua.json));

  const penemuan = lapor.ringkasan();
  process.exitCode = penemuan.length ? 1 : 0;
} finally {
  if (proc) proc.kill();
}
