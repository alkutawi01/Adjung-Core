// sim326 — Nota Ketua Editor: gerbang "kandungan aktif tak boleh disunting" boleh dipintas
// melalui DUA panggilan PATCH berasingan (arkib+sunting, kemudian pulih semula tanpa medan
// kandungan), walaupun gerbang 2026-09-02 sudah menutup laluan SATU-panggilan (status+kandungan
// serentak). Lihat core/routes/editorNotesRoutes.js PATCH /system/editor-notes/:id.
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 4326;
const DB = path.join(REPO, '.simulasi', 'scratch-sim326.db');
const { gagal, lulus, ringkasan } = pelapor('sim326');

let proc;
try {
  ({ proc } = await bootServer({ port: PORT, dbFile: DB }));
  await ciptaPentadbir(DB);
  const cookie = await login(`http://localhost:${PORT}`, 'sim-admin', 'SimUjian!2026');
  const api = buatKlien(`http://localhost:${PORT}`, cookie);

  // 1. Cipta nota AKTIF (kategori 'am', skop 'dalaman' — semua nota lahir aktif).
  const cipta = await api('POST', '/api/system/editor-notes', {
    tajuk: 'Nota Asal', kandungan: 'Kandungan asal yang sudah tersiar.', kategori: 'am', skop: 'dalaman',
  });
  if (!cipta.ok) { gagal('Gagal cipta nota asal: ' + cipta.teks); }
  else {
    const id = cipta.json.nota.id;

    // 2. Sahkan gerbang SATU-panggilan (status+kandungan serentak) MASIH menyekat (regresi asal).
    const cubaLangsung = await api('PATCH', `/api/system/editor-notes/${id}`, { kandungan: 'cubaan terus' });
    if (cubaLangsung.status !== 400) {
      gagal('Gerbang asal (sunting terus nota aktif) tak lagi berfungsi — status ' + cubaLangsung.status);
    } else {
      lulus('Gerbang asal (satu panggilan) masih menyekat sunting terus nota aktif.');
    }

    // 3. Laluan DUA-panggilan: arkibkan + tukar kandungan SERENTAK (sasaran='arkib', jadi lulus
    //    gerbang semasa), kemudian pulihkan ke 'aktif' TANPA medan kandungan.
    const langkah1 = await api('PATCH', `/api/system/editor-notes/${id}`, {
      status: 'arkib', kandungan: 'KANDUNGAN DIPINTA — sepatutnya tak boleh berlaku selepas aktif',
    });
    if (!langkah1.ok) {
      lulus('Langkah 1 (arkib+sunting serentak) turut disekat — bagus, tiada pepijat.');
    } else {
      const langkah2 = await api('PATCH', `/api/system/editor-notes/${id}`, { status: 'aktif' });
      const semak = await api('GET', '/api/system/editor-notes?status=semua');
      const notaAkhir = (semak.json || []).find((n) => n.id === id);
      if (langkah2.ok && notaAkhir && notaAkhir.status === 'aktif' && notaAkhir.kandungan.includes('DIPINTA')) {
        gagal(
          'PEPIJAT DISAHKAN: nota AKTIF berjaya disunting via 2 panggilan (arkib+sunting, ' +
          'pulih semula) walaupun gerbang "nota aktif tak boleh disunting" wujud. Kandungan akhir: "' +
          notaAkhir.kandungan + '" (status: ' + notaAkhir.status + ')'
        );
      } else {
        lulus('Laluan dua-panggilan tidak berjaya memintas gerbang.');
      }
    }
  }
} catch (e) {
  gagal('Ralat simulasi: ' + (e?.message || e));
} finally {
  if (proc) proc.kill();
}
ringkasan();
