// Sahkan gerbang PUT/POST parity baharu (2026-09-12): adjung-desks deskName + adjung-typography-rules term
// tak boleh ditulis kosong via PUT (sebelum ni cuma POST yang sekat).
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 4761;
const dbFile = path.join(REPO, '.simulasi', 'scratch-put-parity.db');
const { lulus, gagal, ringkasan } = pelapor('put-parity-check');
const catat = (t, ok, butiran) => ok ? lulus(t) : gagal(t, butiran);

let proc;
try {
  ({ proc } = await bootServer({ port: PORT, dbFile }));
  const base = `http://localhost:${PORT}`;
  const { username, pass } = await ciptaPentadbir(dbFile);
  const cookie = await login(base, username, pass);
  const k = buatKlien(base, cookie);

  // 1. Cipta desk sah dulu
  const cipta = await k('POST', '/api/system/adjung-desks', { deskName: 'Ujian Desk', description: 'x', displayOrder: 5 });
  catat('POST adjung-desks sah berjaya', cipta.status === 200 && !!cipta.json?.id, JSON.stringify(cipta.json));
  const deskId = cipta.json?.id;

  // 2. Cuba PUT deskName='' -> mesti ditolak 400
  const putKosong = await k('PUT', `/api/system/adjung-desks/${deskId}`, { deskName: '   ' });
  catat('PUT adjung-desks deskName kosong DITOLAK (400)', putKosong.status === 400, JSON.stringify(putKosong.json));

  // 3. Sahkan deskName TAK berubah dalam DB selepas percubaan ditolak
  const semak = await k('GET', '/api/system/adjung-desks');
  const deskSelepas = (semak.json || []).find(d => d.id === deskId);
  catat('deskName kekal "Ujian Desk" (tak tertulis kosong)', deskSelepas?.deskName === 'Ujian Desk', deskSelepas?.deskName);

  // 4. Typography rule: cipta sah, PUT term='' mesti ditolak
  const ciptaTypo = await k('POST', '/api/system/adjung-typography-rules', { term: 'ujian-istilah', style: 'italic' });
  catat('POST typography-rules sah berjaya', ciptaTypo.status === 200 && !!ciptaTypo.json?.id, JSON.stringify(ciptaTypo.json));
  const typoId = ciptaTypo.json?.id;

  const putTypoKosong = await k('PUT', `/api/system/adjung-typography-rules/${typoId}`, { term: '  ' });
  catat('PUT typography-rules term kosong DITOLAK (400)', putTypoKosong.status === 400, JSON.stringify(putTypoKosong.json));

  // 5. Pastikan edit SAH lain (bukan kosong) masih berfungsi normal (tiada regresi)
  const putSah = await k('PUT', `/api/system/adjung-desks/${deskId}`, { deskName: 'Ujian Desk Baharu' });
  catat('PUT adjung-desks nama sah masih berjaya', putSah.status === 200, JSON.stringify(putSah.json));
  const putTypoSah = await k('PUT', `/api/system/adjung-typography-rules/${typoId}`, { term: 'ujian-istilah-baharu' });
  catat('PUT typography-rules term sah masih berjaya', putTypoSah.status === 200, JSON.stringify(putTypoSah.json));

} finally {
  if (proc) proc.kill();
}

ringkasan();
