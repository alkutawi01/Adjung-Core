// sim326b — sahkan pembetulan sim326 TIDAK sekat aliran SAH: (1) arkib nota aktif tanpa ubah
// kandungan, (2) semat/nyahsemat nota aktif, (3) pulih nota arkib ke aktif tanpa ubah kandungan,
// (4) sunting kandungan nota yang KEKAL arkib (tiada tukar status).
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 4327;
const DB = path.join(REPO, '.simulasi', 'scratch-sim326b.db');
const { gagal, lulus, ringkasan } = pelapor('sim326b');

let proc;
try {
  ({ proc } = await bootServer({ port: PORT, dbFile: DB }));
  await ciptaPentadbir(DB);
  const cookie = await login(`http://localhost:${PORT}`, 'sim-admin', 'SimUjian!2026');
  const api = buatKlien(`http://localhost:${PORT}`, cookie);

  const cipta = await api('POST', '/api/system/editor-notes', {
    tajuk: 'Nota Sah', kandungan: 'Kandungan asal sah.', kategori: 'am', skop: 'dalaman',
  });
  if (!cipta.ok) { gagal('Setup gagal: ' + cipta.teks); }
  else {
    const id = cipta.json.nota.id;

    const semat = await api('PATCH', `/api/system/editor-notes/${id}`, { disemat: true });
    if (semat.ok) lulus('Semat nota aktif dibenarkan (tiada ubah kandungan).');
    else gagal('Semat nota aktif TERSEKAT tanpa sebab — regresi.', semat.teks);

    const arkib = await api('PATCH', `/api/system/editor-notes/${id}`, { status: 'arkib' });
    if (arkib.ok) lulus('Arkibkan nota aktif (tanpa ubah kandungan) dibenarkan.');
    else gagal('Arkib nota aktif TERSEKAT tanpa sebab — regresi.', arkib.teks);

    const suntingArkib = await api('PATCH', `/api/system/editor-notes/${id}`, { kandungan: 'Sunting semasa arkib — dibenarkan.' });
    if (suntingArkib.ok) lulus('Sunting kandungan nota yang KEKAL arkib dibenarkan.');
    else gagal('Sunting kandungan nota arkib TERSEKAT tanpa sebab — regresi.', suntingArkib.teks);

    const pulih = await api('PATCH', `/api/system/editor-notes/${id}`, { status: 'aktif' });
    if (pulih.ok) lulus('Pulih nota arkib ke aktif (tanpa ubah kandungan serentak) dibenarkan.');
    else gagal('Pulih nota arkib ke aktif TERSEKAT tanpa sebab — regresi.', pulih.teks);
  }
} catch (e) {
  gagal('Ralat simulasi: ' + (e?.message || e));
} finally {
  if (proc) proc.kill();
}
ringkasan();
