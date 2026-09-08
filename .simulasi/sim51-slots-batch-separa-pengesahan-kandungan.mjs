// sim51 — POST /api/system/slots dengan >1 slot Manual dalam SATU permintaan, slot KEDUA
// membawa item manualSummary yang gagal pengesahan KANDUNGAN (Topik kosong, wajib untuk
// kandungan baharu — validateBidangTopik(), server.js/ContentBudget.js), bukan Bidang tak aktif
// (itu bug #126, sudah dibaiki).
//
// syncManualObjectsForSlot() (server.js) sendiri betul — semua semakan isValidationError berlaku
// SEBELUM `BEGIN TRANSACTION` fungsi tu, jadi SATU slot sentiasa semua-atau-tiada. Tapi
// slotsConfigRoutes.js POST /slots menulis setiap slot dalam tatasusunan SATU PADA SATU MASA
// dalam gelung yang sama (INSERT OR REPLACE slots_config + panggilan syncManualObjectsForSlot).
// Kalau slot PERTAMA lulus (sudah tertulis, transaksi dalamannya sendiri sudah COMMIT) dan slot
// KEDUA gagal pengesahan kandungan, laluan pulangkan 400 keseluruhan tapi slot pertama KEKAL
// tertulis — simpanan pukal SEPARA, sama corak pepijat #126 (Bidang) tapi pada pengesahan
// kandungan yang berada di fungsi lain (server.js), bukan di slotsConfigRoutes.js sendiri.
import { bootServer, bukaDb, dbGet, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5951;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim51.db');
const lapor = pelapor('sim51-slots-batch-separa-pengesahan-kandungan');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE, freshDb: true });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, username, pass);
    const klien = buatKlien(base, cookie);

    const rAkt = await klien('POST', '/api/system/categories/activate', { name: 'Ekonomi', color: '#802334', icon: 'TrendingUp' });
    if (!rAkt.ok) { lapor.gagal('Persediaan: cipta Bidang aktif gagal', JSON.stringify(rAkt.json)); process.exitCode = 1; return; }
    lapor.lulus('Persediaan: Bidang "Ekonomi" aktif dicipta');

    // Slot 5 (SAH): Tajuk/Huraian ringkas pendek, Bidang + Topik penuh diisi.
    // Huraian panjang WAJIB minimum (Tetapan Am Slot lalai 400 aksara) — diisi cukup panjang
    // pada KEDUA-DUA slot supaya beza SATU-SATUNYA antara slot 5/6 ialah Topik.
    const huraianPanjangCukup = 'Perenggan huraian panjang untuk ujian sim51. '.repeat(10).trim();

    const manualSummarySlot5 = [
      'Tajuk: Sim51 Lima Ujian Kandungan Pukal',
      'Huraian ringkas: Huraian ringkas ujian',
      `Huraian panjang: ${huraianPanjangCukup}`,
      'Bidang: Ekonomi',
      'Topik: Kewangan',
      'Sumber: Adjung Editorial',
      'URL: #',
      'Status: approved',
    ].join('\n');

    // Slot 6 (TAK SAH): Bidang diisi tapi Topik KOSONG — validateBidangTopik() tolak
    // (requireTopik: true) sebab kandungan BAHARU wajib ada Topik.
    const manualSummarySlot6 = [
      'Tajuk: Sim51 Enam Ujian Kandungan Pukal',
      'Huraian ringkas: Huraian ringkas ujian',
      `Huraian panjang: ${huraianPanjangCukup}`,
      'Bidang: Ekonomi',
      'Sumber: Adjung Editorial',
      'URL: #',
      'Status: approved',
    ].join('\n');

    const db = bukaDb(DB_FILE);
    const sebelumSlot5 = await dbGet(db, "SELECT COUNT(*) AS n FROM editorial_objects WHERE slotIndex = 4");
    console.log('  [maklumat] bilangan editorial_objects slot 5 SEBELUM:', JSON.stringify(sebelumSlot5));

    const rSimpan = await klien('POST', '/api/system/slots', [
      { slotIndex: 4, contentMode: 'Manual', manualDesk: 'Ekonomi', manualSummary: manualSummarySlot5 },
      { slotIndex: 5, contentMode: 'Manual', manualDesk: 'Ekonomi', manualSummary: manualSummarySlot6 },
    ]);
    console.log('  [maklumat] Respons POST /slots:', rSimpan.status, JSON.stringify(rSimpan.json));

    const selepasSlot5Objek = await dbGet(db, "SELECT COUNT(*) AS n FROM editorial_objects WHERE slotIndex = 4");
    const selepasSlot5Revisi = await dbGet(db,
      `SELECT r.title FROM editorial_objects o JOIN editorial_revisions r ON r.objectId = o.id
       WHERE o.slotIndex = 4 ORDER BY r.id DESC LIMIT 1`);
    const selepasSlot6Objek = await dbGet(db, "SELECT COUNT(*) AS n FROM editorial_objects WHERE slotIndex = 5");
    console.log('  [maklumat] editorial_objects slot 5 SELEPAS:', JSON.stringify(selepasSlot5Objek), JSON.stringify(selepasSlot5Revisi));
    console.log('  [maklumat] editorial_objects slot 6 SELEPAS:', JSON.stringify(selepasSlot6Objek));
    await new Promise(r => db.close(r));

    const slot5Tertulis = selepasSlot5Objek && selepasSlot5Objek.n > (sebelumSlot5?.n || 0)
      && selepasSlot5Revisi && selepasSlot5Revisi.title === 'Sim51 Lima Ujian Kandungan Pukal';
    const slot6Tertulis = selepasSlot6Objek && selepasSlot6Objek.n > 0;

    if (!rSimpan.ok && slot5Tertulis && !slot6Tertulis) {
      lapor.gagal(
        'Simpanan PUKAL menolak permintaan (400) sebab slot 6 gagal pengesahan Topik — tapi slot 5 ' +
        'SUDAH tertulis (editorial_objects + revisi BAHARU) sebelum slot 6 sempat gagal. Simpanan ' +
        'SEPARA, bercanggah dengan invariant "semua-atau-tiada" yang didokumenkan pada laluan ni.',
        `status=${rSimpan.status} error=${rSimpan.json?.error} slot5Tertulis=${slot5Tertulis} slot6Tertulis=${slot6Tertulis}`
      );
    } else if (!rSimpan.ok && !slot5Tertulis && !slot6Tertulis) {
      lapor.lulus('Permintaan ditolak (400, sebab Topik slot 6 kosong) DAN tiada satu pun slot tertulis — invariant semua-atau-tiada dipegang');
    } else if (rSimpan.ok) {
      lapor.gagal('Permintaan dengan Topik kosong SEPATUTNYA ditolak tapi malah berjaya (200)', JSON.stringify(rSimpan.json));
    } else {
      lapor.gagal('Keadaan tak dijangka', JSON.stringify({ rSimpan: rSimpan.json, selepasSlot5Objek, selepasSlot6Objek }));
    }

    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
