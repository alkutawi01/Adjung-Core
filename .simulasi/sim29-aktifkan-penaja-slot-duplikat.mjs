// sim29 — POST /system/permohonan-penaja/:id/aktifkan lawan slotIndexes berduplikat.
//
// Pepijat ASAL (dapatan bug-hunt 2026-09-08, dibaiki dalam sesi yang sama): laluan aktifkan
// (permohonanPenajaRoutes.js) jalankan siri dbRun() berasingan TANPA transaksi
// BEGIN/COMMIT/ROLLBACK: (1) UPDATE/INSERT jadual `sponsors` (status='aktif'), (2) DELETE FROM
// sponsor_slots WHERE sponsorId=?, (3) INSERT INTO sponsor_slots satu-satu ikut slotIndexes
// daripada req.body, (4) UPDATE permohonan_penaja SET status='aktif'. Jadual sponsor_slots ada
// PRIMARY KEY (sponsorId, slotIndex) — req.body.slotIndexes dengan nilai BERULANG (typo
// klien/manipulasi request terus ke API) langgar PK pada INSERT kedua dan throw. Disahkan
// reproduce SEBENAR sebelum pembetulan: DELETE sponsor_slots + UPDATE/INSERT sponsors
// (status='aktif') dah COMMIT (bukan transaksi), permohonan_penaja.status TAK PERNAH capai
// 'aktif' — percanggahan status merentasi tiga jadual walau HTTP pulangkan 500.
//
// DIBAIKI: (1) slotIndexes dinyahduplikat (`[...new Set(...)]`) sebelum ditulis — punca paling
// realistik dielakkan terus; (2) SEMUA langkah dibungkus SATU transaksi BEGIN/COMMIT/ROLLBACK
// (corak sama mergeCategories(), CategoryRegistry.js) — kalau langkah manapun gagal selepas ni
// (cth constraint lain di masa depan), SEMUA batal bersama, tiada lagi keadaan separa. Ujian ni
// kini SAHKAN tingkah laku BAHARU: slotIndexes berduplikat TIDAK LAGI menyebabkan kegagalan
// separa — sama ada berjaya penuh (duplikat ditapis) dengan permohonan_penaja.status='aktif'
// DAN sponsors.status='aktif' SERENTAK, atau gagal PENUH (tiada satu pun jadual tersentuh).
import { bootServer, bukaDb, dbRun, dbGet, dbAll, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5929;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim29.db');
const lapor = pelapor('sim29-aktifkan-penaja-slot-duplikat');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
    const klien = buatKlien(base, cookie);

    // Tunggu skema penuh sedia (ALTER TABLE anonymousNo/mulaTajaan/tamatTajaan pada `sponsors`
    // berjalan async selepas CREATE TABLE asal — pada DB baharu ada tempoh singkat lumba, bukan
    // bahagian hipotesis ujian ni, cuma artifak permulaan pelayan segar).
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

    // 1. Suntik terus SATU rekod permohonan_penaja pada peringkat 'dibayar' (langkau seluruh
    // aliran borang awam + kelulusan — bukan fokus ujian ni), jenisPemohon 'individu' supaya
    // gerbang logoUrl organisasi tak menyekat.
    const idPermohonan = 'PEN-SIM29-0001';
    const kini = new Date().toISOString();
    const db = bukaDb(DB_FILE);
    await dbRun(db, `
      INSERT INTO permohonan_penaja
        (id, jenisPemohon, namaSebenar, emel, pilihanPaparan, status, jumlahDipersetujui, dibayarPada, createdAt, updatedAt)
      VALUES (?, 'individu', 'Sim29 Penaja', 'sim29@ujian.test', 'guna_nama', 'dibayar', 500, ?, ?, ?)
    `, [idPermohonan, kini, kini, kini]);
    await new Promise(r => db.close(r));
    lapor.lulus('Persediaan: rekod permohonan_penaja disuntik terus pada status dibayar');

    // 2. Panggil laluan aktifkan SEBENAR dengan slotIndexes BERDUPLIKAT (permintaan tercacat
    // sekali gus dua kali/klien silap gabung senarai) — pencetus realistik bug ni.
    const rAktif = await klien('POST', `/api/system/permohonan-penaja/${idPermohonan}/aktifkan`, {
      slotIndexes: [3, 3],
    });
    console.log('  [maklumat] Respons /aktifkan:', rAktif.status, JSON.stringify(rAktif.json));

    // 3. Semak keadaan DB SEBENAR selepas panggilan.
    const db2 = bukaDb(DB_FILE);
    const rekodSelepas = await dbGet(db2, 'SELECT status, sponsorId FROM permohonan_penaja WHERE id = ?', [idPermohonan]);
    const sponsors = await dbAll(db2, "SELECT * FROM sponsors WHERE status = 'aktif'");
    const slotsForAny = sponsors.length ? await dbAll(db2, 'SELECT * FROM sponsor_slots WHERE sponsorId = ?', [sponsors[0].id]) : [];
    await new Promise(r => db2.close(r));

    console.log('  [maklumat] permohonan_penaja selepas panggilan:', JSON.stringify(rekodSelepas));
    console.log('  [maklumat] baris sponsors berstatus aktif dicipta:', sponsors.length);
    console.log('  [maklumat] baris sponsor_slots bagi sponsor tu:', JSON.stringify(slotsForAny));

    const sponsorTercipta = sponsors.length > 0;
    const permohonanMasihDibayar = rekodSelepas && rekodSelepas.status === 'dibayar';
    const permohonanAktif = rekodSelepas && rekodSelepas.status === 'aktif';

    if (!rAktif.ok && sponsorTercipta && permohonanMasihDibayar) {
      lapor.gagal(
        'Pengaktifan penaja gagal SEPARA — baris `sponsors` sudah tercipta/aktif dan sponsor_slots ' +
        'sudah dipadam (tiada transaksi), tetapi permohonan_penaja.status TAK PERNAH capai \'aktif\' ' +
        'walau HTTP pulangkan ralat. Percubaan semula (tanpa sponsorSediaAdaId) akan cipta baris ' +
        '`sponsors` KEDUA untuk penaja yang sama.',
        `status=${rAktif.status} body=${JSON.stringify(rAktif.json)} rekodSelepas=${JSON.stringify(rekodSelepas)} sponsors=${sponsors.length}`
      );
    } else if (rAktif.ok && permohonanAktif && sponsorTercipta && slotsForAny.length === 1 && slotsForAny[0].slotIndex === 3) {
      lapor.lulus('Duplikat slotIndex dinyahduplikat & ditulis penuh dalam SATU transaksi — sponsors + permohonan_penaja + sponsor_slots(1 baris unik) konsisten serentak, tiada keadaan separa');
    } else if (!rAktif.ok && !sponsorTercipta && permohonanMasihDibayar) {
      lapor.lulus('Transaksi rollback penuh apabila gagal — tiada satu pun jadual (sponsors/sponsor_slots/permohonan_penaja) tersentuh, tiada keadaan separa');
    } else {
      lapor.gagal('Keadaan tak dijangka selepas pembetulan — semak semula andaian ujian', JSON.stringify({ rAktif: rAktif.json, rekodSelepas, sponsors: sponsors.length, slotsForAny }));
    }

    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
