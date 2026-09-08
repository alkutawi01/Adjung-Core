// sim64 — POST /system/permohonan-penaja/:id/aktifkan, pembaharuan penaja sedia ada (
// `sponsorSediaAdaId`) yang tukar skop slot lama -> portal KESELURUHAN (slotIndexes kosong).
//
// Pepijat ASAL (dapatan bug-hunt 2026-09-09): blok tulis sponsor_slots dalam laluan /aktifkan
// (permohonanPenajaRoutes.js) dahulu berbunyi `if (skopSlot.length > 0) { DELETE...; INSERT... }`
// — DELETE cuma jalan bila skop BAHARU tidak kosong. Bila Pentadbir pautkan permohonan pembaharuan
// ke penaja sedia ada yang SEBELUM ni terhad kepada slot tertentu (baris sponsor_slots wujud), dan
// kali ni sengaja tinggalkan senarai Slot kosong (niat: portal keseluruhan, tiada sekatan), DELETE
// tak pernah jalan — baris sponsor_slots LAMA kekal, penajaLayakUntukSlot() (PenajaEligibility.js)
// baca skop bukan-kosong tu dan TERUS sekat penaja ke slot lama walau borang admin nampak "Semua
// Slot". Ujian ni panggil laluan SEBENAR dua kali (aktif kali pertama dgn slotIndexes=[5], kemudian
// permohonan KEDUA dipautkan balik ke penaja sama via sponsorSediaAdaId dgn slotIndexes=[] kosong)
// dan sahkan baris sponsor_slots lama benar-benar dipadam selepas pembetulan.
import { bootServer, bukaDb, dbRun, dbGet, dbAll, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5964;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim64.db');
const lapor = pelapor('sim64-aktifkan-penaja-skop-lapuk');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
    const klien = buatKlien(base, cookie);

    // Tunggu skema penuh sedia (sama gotcha boot-race seperti sim29).
    {
      const dbSemak = bukaDb(DB_FILE);
      const mula = Date.now();
      while (Date.now() - mula < 15000) {
        const cols = await dbAll(dbSemak, "PRAGMA table_info(sponsors)");
        if (cols.some(c => c.name === 'anonymousNo')) break;
        await new Promise(r => setTimeout(r, 200));
      }
      await new Promise(r => dbSemak.close(r));
    }

    // 1. Permohonan PERTAMA: suntik terus pada peringkat 'dibayar', aktifkan dgn slotIndexes=[5]
    // (skop terhad, cth "Slot 6" sahaja) -- penaja BAHARU tercipta.
    const kini = new Date().toISOString();
    const db = bukaDb(DB_FILE);
    await dbRun(db, `
      INSERT INTO permohonan_penaja
        (id, jenisPemohon, namaSebenar, emel, pilihanPaparan, status, jumlahDipersetujui, dibayarPada, createdAt, updatedAt)
      VALUES ('PEN-SIM64-0001', 'individu', 'Sim64 Penaja', 'sim64@ujian.test', 'guna_nama', 'dibayar', 500, ?, ?, ?)
    `, [kini, kini, kini]);
    await new Promise(r => db.close(r));

    const rAktif1 = await klien('POST', '/api/system/permohonan-penaja/PEN-SIM64-0001/aktifkan', {
      slotIndexes: [5],
    });
    console.log('  [maklumat] Respons /aktifkan #1 (skop [5]):', rAktif1.status, JSON.stringify(rAktif1.json));
    if (!rAktif1.ok || !rAktif1.json?.sponsorId) {
      lapor.gagal('Pengaktifan PERTAMA sepatutnya berjaya (persediaan ujian gagal)', JSON.stringify(rAktif1.json));
      return finis();
    }
    const sponsorId = rAktif1.json.sponsorId;

    const dbCek1 = bukaDb(DB_FILE);
    const slotsSelepas1 = await dbAll(dbCek1, 'SELECT slotIndex FROM sponsor_slots WHERE sponsorId = ?', [sponsorId]);
    await new Promise(r => dbCek1.close(r));
    console.log('  [maklumat] sponsor_slots selepas #1:', JSON.stringify(slotsSelepas1));
    if (slotsSelepas1.length !== 1 || slotsSelepas1[0].slotIndex !== 5) {
      lapor.gagal('Persediaan tak sebagai dijangka: skop awal sepatutnya [5] tepat', JSON.stringify(slotsSelepas1));
      return finis();
    }

    // 2. Permohonan KEDUA (pembaharuan) dipautkan ke SPONSOR SAMA via sponsorSediaAdaId, kali ni
    // slotIndexes KOSONG (niat: portal keseluruhan, tiada sekatan).
    const db2 = bukaDb(DB_FILE);
    await dbRun(db2, `
      INSERT INTO permohonan_penaja
        (id, jenisPemohon, namaSebenar, emel, pilihanPaparan, status, jumlahDipersetujui, dibayarPada, createdAt, updatedAt)
      VALUES ('PEN-SIM64-0002', 'individu', 'Sim64 Penaja', 'sim64@ujian.test', 'guna_nama', 'dibayar', 500, ?, ?, ?)
    `, [kini, kini, kini]);
    await new Promise(r => db2.close(r));

    const rAktif2 = await klien('POST', '/api/system/permohonan-penaja/PEN-SIM64-0002/aktifkan', {
      sponsorSediaAdaId: sponsorId,
      slotIndexes: [],
    });
    console.log('  [maklumat] Respons /aktifkan #2 (pautkan sedia ada, skop []):', rAktif2.status, JSON.stringify(rAktif2.json));

    const dbCek2 = bukaDb(DB_FILE);
    const slotsSelepas2 = await dbAll(dbCek2, 'SELECT slotIndex FROM sponsor_slots WHERE sponsorId = ?', [sponsorId]);
    await new Promise(r => dbCek2.close(r));
    console.log('  [maklumat] sponsor_slots selepas #2 (skop baharu kosong):', JSON.stringify(slotsSelepas2));

    if (rAktif2.ok && slotsSelepas2.length === 0) {
      lapor.lulus('Pembaharuan ke skop portal-keseluruhan (slotIndexes kosong) memadam baris sponsor_slots LAMA — penaja tidak lagi terkunci ke slot lapuk');
    } else if (rAktif2.ok && slotsSelepas2.length > 0) {
      lapor.gagal('Baris sponsor_slots LAMA (skop [5]) masih wujud selepas pembaharuan ke skop kosong — penaja tersilap kekal terkunci ke slot lapuk walau borang admin nampak "Semua Slot"', JSON.stringify(slotsSelepas2));
    } else {
      lapor.gagal('Pengaktifan KEDUA (pembaharuan sah, sponsorSediaAdaId betul) sepatutnya berjaya', JSON.stringify(rAktif2.json));
    }

    finis();
  } finally {
    proc.kill();
  }

  function finis() {
    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
