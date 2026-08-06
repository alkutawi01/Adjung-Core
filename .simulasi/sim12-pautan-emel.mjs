// SIMULASI 12 — PEMBINAAN PAUTAN EMEL (sahkan pembetulan password-reset poisoning).
//
// Pautan set-semula/jemputan dahulu dibina daripada header Host permintaan. Dengan
// `trust proxy` aktif, penyerang boleh memalsukan Host semasa memohon set-semula bagi emel
// ORANG LAIN — emel sah yang sampai kepada editor itu kemudian membawa token sah ke domain
// penyerang. Simulasi ini menghantar Host palsu dan mengesahkan pautan TIDAK mengikutnya.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, pelapor, bukaDb } from './sim-lib.mjs';

const PORT = 5211;
const DBF = path.join(os.tmpdir(), 'sim-adjung-emel.db');
const lap = pelapor('SIM 12 — PAUTAN EMEL');
const BASE_SAH = `http://localhost:${PORT}`;

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  await ciptaPentadbir(DBF);
  const db = bukaDb(DBF);

  // Mohon set-semula dengan header Host DIPALSUKAN.
  const r = await fetch(`${BASE_SAH}/api/auth/lupa-kata-laluan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Host': 'domain-penyerang.test',
      'X-Forwarded-Host': 'domain-penyerang.test',
    },
    body: JSON.stringify({ email: 'sim-admin@sim.test' }),
  });

  if (!r.ok) {
    lap.gagal('permintaan lupa-kata-laluan gagal', `HTTP ${r.status}`);
  } else {
    lap.lulus(`permintaan diterima (HTTP ${r.status}, balasan generik)`);
  }

  // Token dijana? (emel tak dihantar tanpa RESEND_API_KEY, tapi token tetap disimpan)
  const baris = await new Promise((res, rej) =>
    db.get("SELECT resetToken FROM users WHERE email='sim-admin@sim.test'", (e, x) => e ? rej(e) : res(x)));

  if (!baris?.resetToken) {
    lap.gagal('token set-semula tidak dijana', 'tidak dapat mengesahkan pembinaan pautan');
  } else {
    lap.lulus('token set-semula dijana & disimpan');
  }

  // Sahkan BASE_URL (bukan header) yang menentukan pautan. Pelayan simulasi dihidupkan dengan
  // BASE_URL = localhost:PORT, jadi log/pautan mesti merujuk itu, BUKAN domain-penyerang.test.
  const log = srv.dapatLog();
  if (/domain-penyerang\.test/.test(log)) {
    lap.gagal('PAUTAN EMEL MENGIKUT HEADER PALSU', 'domain penyerang muncul dalam laluan emel — password-reset poisoning masih boleh berlaku');
  } else {
    lap.lulus('domain palsu TIDAK muncul di mana-mana laluan emel');
  }

  // Amaran BASE_URL hilang mesti muncul bila ia tak ditetapkan (jaring keselamatan deploy).
  // Di sini BASE_URL DITETAPKAN, jadi amaran TIDAK sepatutnya muncul.
  if (/AMARAN: BASE_URL tiada/.test(log)) {
    lap.gagal('amaran BASE_URL muncul walaupun ia ditetapkan', 'logik sandaran tersilap');
  } else {
    lap.lulus('BASE_URL dihormati (tiada amaran sandaran)');
  }

  await new Promise(r2 => db.close(r2));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
