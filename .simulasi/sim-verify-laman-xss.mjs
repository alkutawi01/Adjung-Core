// Sahkan pembetulan: lamanRasmi (permohonan penaja) dgn skema berbahaya (javascript:) TAK
// disimpan mentah ke permohonan_penaja.laman -- disimpan NULL sebaliknya. URL http(s) sah
// KEKAL disimpan macam biasa (regresi tak berlaku).
import path from 'node:path';
import { REPO, bootServer, bukaDb, dbGet } from './sim-lib.mjs';

const PORT = 5991;
const dbFile = path.join(REPO, '.simulasi', 'scratch-verify-laman-xss.db');

const { proc, base } = await bootServer({ port: PORT, dbFile });
try {
  // Kes 1: skema javascript: berbahaya
  const r1 = await fetch(`${base}/api/public/permohonan-penaja`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jenisPemohon: 'individu',
      namaSebenar: 'Pemohon Ujian XSS',
      emel: 'xss-ujian@sim.test',
      lamanRasmi: 'javascript:alert(document.cookie)',
      aktivitiUtama: '',
    }),
  });
  const j1 = await r1.json();
  if (!r1.ok) throw new Error('Permohonan 1 gagal: ' + r1.status + ' ' + JSON.stringify(j1));

  const db = bukaDb(dbFile);
  const row1 = await dbGet(db, 'SELECT laman FROM permohonan_penaja WHERE id = ?', [j1.id]);
  console.log('Kes 1 (javascript:) -> laman tersimpan:', JSON.stringify(row1.laman));
  if (row1.laman !== null) {
    throw new Error('GAGAL: skema javascript: tersimpan mentah -> ' + row1.laman);
  }

  // Kes 2: URL https sah -- mesti KEKAL tersimpan (bukan regresi)
  const r2 = await fetch(`${base}/api/public/permohonan-penaja`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jenisPemohon: 'individu',
      namaSebenar: 'Pemohon Ujian Sah',
      emel: 'sah-ujian@sim.test',
      lamanRasmi: 'https://contoh-laman-sah.com',
      aktivitiUtama: '',
    }),
  });
  const j2 = await r2.json();
  if (!r2.ok) throw new Error('Permohonan 2 gagal: ' + r2.status + ' ' + JSON.stringify(j2));
  const row2 = await dbGet(db, 'SELECT laman FROM permohonan_penaja WHERE id = ?', [j2.id]);
  console.log('Kes 2 (https sah) -> laman tersimpan:', JSON.stringify(row2.laman));
  if (row2.laman !== 'https://contoh-laman-sah.com') {
    throw new Error('GAGAL (regresi): URL sah tak tersimpan betul -> ' + row2.laman);
  }

  // Kes 3: teks bebas "Tiada" -- mesti jadi NULL (bukan URL, bukan ralat)
  const r3 = await fetch(`${base}/api/public/permohonan-penaja`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jenisPemohon: 'individu',
      namaSebenar: 'Pemohon Ujian Tiada',
      emel: 'tiada-ujian@sim.test',
      lamanRasmi: 'Tiada',
      aktivitiUtama: '',
    }),
  });
  const j3 = await r3.json();
  if (!r3.ok) throw new Error('Permohonan 3 gagal: ' + r3.status + ' ' + JSON.stringify(j3));
  const row3 = await dbGet(db, 'SELECT laman FROM permohonan_penaja WHERE id = ?', [j3.id]);
  console.log('Kes 3 ("Tiada") -> laman tersimpan:', JSON.stringify(row3.laman));
  if (row3.laman !== null) {
    throw new Error('GAGAL: teks bebas "Tiada" patut jadi NULL -> ' + row3.laman);
  }

  await new Promise((res) => db.close(res));
  console.log('\nSEMUA UJIAN LULUS.');
} finally {
  proc.kill();
}
