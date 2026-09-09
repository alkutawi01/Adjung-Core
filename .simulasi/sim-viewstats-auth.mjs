// Sim: GET /api/system/view-stats mesti tolak permintaan tanpa sesi (#218 bug-hunt).
import path from 'node:path';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien, pelapor } from './sim-lib.mjs';

const PORT = 4599;
const DB = path.join(REPO, '.simulasi', 'scratch-viewstats-auth.db');
const lapor = pelapor('sim-viewstats-auth');

let proc;
try {
  const boot = await bootServer({ port: PORT, dbFile: DB });
  proc = boot.proc;
  const { base } = boot;

  // 1. Tanpa sesi langsung — mesti 401, bukan 200 + data.
  const rAwam = await fetch(`${base}/api/system/view-stats?days=7`);
  const jsonAwam = await rAwam.json().catch(() => null);
  if (rAwam.status === 401) {
    lapor.lulus('GET /view-stats tanpa sesi ditolak 401');
  } else {
    lapor.gagal('GET /view-stats tanpa sesi', `status=${rAwam.status} body=${JSON.stringify(jsonAwam)}`);
  }

  // 2. Dengan sesi sah (Ketua Editor) — mesti 200 + bentuk data yang betul.
  const { username, pass } = await ciptaPentadbir(DB);
  const cookie = await login(base, username, pass);
  const klien = buatKlien(base, cookie);
  const rSesi = await klien('GET', '/api/system/view-stats?days=7');
  if (rSesi.status === 200 && rSesi.json && typeof rSesi.json.hariIni === 'number') {
    lapor.lulus('GET /view-stats dengan sesi sah masih berfungsi (200 + hariIni)');
  } else {
    lapor.gagal('GET /view-stats dengan sesi sah', `status=${rSesi.status} body=${JSON.stringify(rSesi.json)}`);
  }

  // 3. POST /track-view kekal AWAM (tiada sesi) — regresi semak: fix ni tak sepatutnya sentuh laluan ni.
  const rTrack = await fetch(`${base}/api/system/track-view`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetType: 'homepage', targetId: 'utama' }),
  });
  if (rTrack.status === 204) {
    lapor.lulus('POST /track-view kekal awam (204) — tidak terjejas fix ni');
  } else {
    lapor.gagal('POST /track-view sepatutnya kekal awam', `status=${rTrack.status}`);
  }
} finally {
  if (proc) proc.kill();
}

const penemuan = lapor.ringkasan();
process.exit(penemuan.length > 0 ? 1 : 0);
