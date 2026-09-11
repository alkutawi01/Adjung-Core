// sim313 — POST/PATCH /system/sponsors lawan tarikh mulaTajaan/tamatTajaan MUSTAHIL.
//
// Pepijat ASAL (dapatan bug-hunt 2026-09-12, round #313): sahIso() (core/routes/sponsorRoutes.js)
// cuma semak `!Number.isNaN(new Date(v).getTime())` — regex/parse JS Date SAHAJA, tak sahkan
// tarikh kalendar SEBENAR wujud. new Date('2026-02-30T14:30:00+08:00') pulangkan Date SAH (2 Mac
// 2026, JS gelongsor senyap), BUKAN NaN. Sama corak pepijat yang dibaiki di
// validateTarikhSumber() (ContentBudget.js) dan formatSatuTarikh() (EventDateValidator.js)
// 2026-09-09/2026-08-16 (rounds #230-231). Editor Editorium (PenajaConsole.tsx, <input
// type="datetime-local">) boleh taip/pilih "30 Februari" untuk mulaTajaan/tamatTajaan penaja
// tanpa sebarang ralat 400 — julat tajaan sebenar tersimpan silap secara senyap.
//
// DIBAIKI: sahIso() kini ekstrak komponen tahun/bulan/hari daripada rentetan dan sahkan
// round-trip Date.UTC (elak anjak zon waktu) SEBELUM terima rentetan tu sebagai tarikh sah.
import { bootServer, bukaDb, dbAll, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5931;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim313.db');
const lapor = pelapor('sim313-sponsor-tarikh-invalid');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
    const klien = buatKlien(base, cookie);

    {
      const dbSemak = bukaDb(DB_FILE);
      const mula = Date.now();
      while (Date.now() - mula < 15000) {
        const cols = await dbAll(dbSemak, "PRAGMA table_info(sponsors)");
        if (cols.some((c) => c.name === 'mulaTajaan')) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      await new Promise((r) => dbSemak.close(r));
    }

    // 1. POST cipta penaja dengan mulaTajaan/tamatTajaan MUSTAHIL (30 Februari) — mesti
    // ditolak 400, TIADA baris sponsors tercipta.
    const rCiptaSalah = await klien('POST', '/api/system/sponsors', {
      nama: 'Sim313 Penaja Salah', bulan: '2026-09',
      mulaTajaan: '2026-02-30T00:00:00+08:00',
      tamatTajaan: '2026-03-05T00:00:00+08:00',
    });
    console.log('  [maklumat] POST tarikh mustahil:', rCiptaSalah.status, JSON.stringify(rCiptaSalah.json));

    const db1 = bukaDb(DB_FILE);
    const semuaSalah = await dbAll(db1, "SELECT id FROM sponsors WHERE name = 'Sim313 Penaja Salah'");
    await new Promise((r) => db1.close(r));

    if (rCiptaSalah.status === 400 && semuaSalah.length === 0) {
      lapor.lulus('POST /system/sponsors dengan mulaTajaan="30 Februari" (mustahil) ditolak 400 bersih, tiada baris tercipta');
    } else {
      lapor.gagal(
        'POST dengan tarikh mustahil (30 Februari) diterima / tercipta walaupun sepatutnya ditolak',
        `status=${rCiptaSalah.status} json=${JSON.stringify(rCiptaSalah.json)} baris=${JSON.stringify(semuaSalah)}`
      );
    }

    // 2. Kes kawalan: tarikh SAH mesti masih diterima (regresi negatif).
    const rCiptaSah = await klien('POST', '/api/system/sponsors', {
      nama: 'Sim313 Penaja Sah', bulan: '2026-09',
      mulaTajaan: '2026-02-27T00:00:00+08:00',
      tamatTajaan: '2026-03-05T00:00:00+08:00',
    });
    console.log('  [maklumat] POST tarikh sah:', rCiptaSah.status, JSON.stringify(rCiptaSah.json));
    if (rCiptaSah.ok && rCiptaSah.json?.id) {
      lapor.lulus('POST /system/sponsors dengan tarikh SAH (27 Feb - 5 Mac) tetap diterima (tiada regresi palsu-positif)');
    } else {
      lapor.gagal('POST dengan tarikh SAH ditolak — sahIso() baharu terlalu ketat (regresi)', JSON.stringify(rCiptaSah.json));
    }
    const idSah = rCiptaSah.json?.id;

    // 3. PATCH penaja sedia ada dengan tamatTajaan MUSTAHIL (31 April) — mesti ditolak 400,
    // tarikh sedia ada KEKAL tak berubah.
    if (idSah) {
      const rPatchSalah = await klien('PATCH', `/api/system/sponsors/${idSah}`, {
        tamatTajaan: '2026-04-31T00:00:00+08:00',
      });
      console.log('  [maklumat] PATCH tamat mustahil:', rPatchSalah.status, JSON.stringify(rPatchSalah.json));

      const db2 = bukaDb(DB_FILE);
      const rowSelepas = await dbAll(db2, 'SELECT mulaTajaan, tamatTajaan FROM sponsors WHERE id = ?', [idSah]);
      await new Promise((r) => db2.close(r));

      if (rPatchSalah.status === 400 && rowSelepas[0]?.tamatTajaan === '2026-03-05T00:00:00+08:00') {
        lapor.lulus('PATCH /system/sponsors/:id dengan tamatTajaan="31 April" (mustahil) ditolak 400 bersih, tarikh sedia ada KEKAL utuh');
      } else {
        lapor.gagal(
          'PATCH dengan tarikh mustahil (31 April) diterima / mengubah tarikh sedia ada walaupun sepatutnya ditolak',
          `status=${rPatchSalah.status} row=${JSON.stringify(rowSelepas[0])}`
        );
      }
    }

    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
