import {
  REPO, bootServer, ciptaPentadbir, login, buatKlien, pelapor,
} from './sim-lib.mjs';
import path from 'path';

const lapor = pelapor('round317-post-users-roles');
const PORT = 5299;
const dbFile = path.join(REPO, '.simulasi', 'scratch-round317-post-users-roles.db');

const { proc, base: bootedBase } = await bootServer({ port: PORT, dbFile });
try {
  await ciptaPentadbir(dbFile);
  const base = `http://localhost:${PORT}`;
  const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
  const klien = buatKlien(base, cookie);

  // Sebelum fix: roles=['ketua_editor','tYpo-tak-wujud'] senyap ditapis jadi ['ketua_editor']
  // dan akaun tercipta (200) — Pentadbir yang niat bagi DUA peranan tak pernah tahu satu jatuh.
  const res = await klien('POST', '/api/system/users', {
    email: 'ujian-round317@example.com',
    roles: ['ketua_editor', 'peranan-tak-wujud'],
  });
  const body = res.json || {};

  const cek1 = res.status === 400 && !body.success;
  if (cek1) lapor.lulus('POST /users dengan peranan tak sah ditolak 400 (bukan senyap ditapis)');
  else lapor.gagal('POST /users dengan peranan tak sah ditolak 400', `status=${res.status} body=${JSON.stringify(body)}`);

  const cek2 = /tidak sah/i.test(body.error || '');
  if (cek2) lapor.lulus('Mesej ralat sebut peranan tidak sah');
  else lapor.gagal('Mesej ralat sebut peranan tidak sah', JSON.stringify(body));

  // Kawalan: semua peranan SAH masih berjaya (regresi tak patah)
  const res2 = await klien('POST', '/api/system/users', {
    email: 'ujian-round317-ok@example.com',
    roles: ['editor'],
  });
  const body2 = res2.json || {};
  const cek3 = res2.status === 200 && body2.success === true;
  if (cek3) lapor.lulus('POST /users dengan peranan sah tetap berjaya');
  else lapor.gagal('POST /users dengan peranan sah tetap berjaya', `status=${res2.status} body=${JSON.stringify(body2)}`);
} finally {
  proc.kill();
  lapor.ringkasan();
}
