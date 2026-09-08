// sim49 — POST /api/system/slots dengan >1 slot dalam SATU permintaan, slot KEDUA membawa
// manualDesk yang BUKAN Bidang aktif.
//
// Komen sedia ada di slotsConfigRoutes.js (baris ~209-214, "Kawalan serentak Fasa 6") menyatakan
// eksplisit corak yang DIMAKSUDKAN: "SEMAK SEMUA slot dahulu sebelum tulis MANA-MANA satu (sama
// corak seperti batch_paste — semua-atau-tiada, bukan simpanan separa)". Semakan updatedAt
// (konkurensi) memang dibuat dalam gelung BERASINGAN sebelum sebarang dbRun() — tapi semakan
// Bidang terkunci (manualDesk mesti Bidang aktif, baris ~264-273) TIDAK dipindah gelung yang sama;
// ia berada DALAM gelung yang juga membuat INSERT OR REPLACE (baris ~401+). Ini bermakna kalau
// slot pertama dalam array SAH (INSERT berjaya) dan slot KEDUA tak sah (Bidang tak aktif), server
// pulangkan 400 keseluruhan tapi slot pertama SUDAH pun tersimpan dalam DB — melanggar invariant
// "semua-atau-tiada" yang didokumenkan sendiri dalam komen kod di atasnya.
import { bootServer, bukaDb, dbGet, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5949;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim49.db');
const lapor = pelapor('sim49-slots-batch-separa-bidang');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE, freshDb: true });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, username, pass);
    const klien = buatKlien(base, cookie);

    // Bidang aktif tunggal — slot 5 akan guna Bidang ni (SAH), slot 6 akan guna Bidang PALSU
    // yang tak pernah diaktifkan (TAK SAH).
    const rAkt = await klien('POST', '/api/system/categories/activate', { name: 'Ekonomi', color: '#802334', icon: 'TrendingUp' });
    if (!rAkt.ok) { lapor.gagal('Persediaan: cipta Bidang aktif gagal', JSON.stringify(rAkt.json)); process.exitCode = 1; return; }
    lapor.lulus('Persediaan: Bidang "Ekonomi" aktif dicipta');

    const db = bukaDb(DB_FILE);
    const sebelumSlot5 = await dbGet(db, "SELECT manualDesk FROM slots_config WHERE layoutTemplateId='frontpage' AND slotIndex=5");
    console.log('  [maklumat] slot 5 SEBELUM panggilan:', JSON.stringify(sebelumSlot5));

    // Hantar SATU permintaan pukal: slot 5 (Bidang sah "Ekonomi"), slot 6 (Bidang tak wujud
    // "BidangTakWujud123") — corak SAMA seperti Simpan Pukal/batch klien sebenar hantar array.
    const rSimpan = await klien('POST', '/api/system/slots', [
      { slotIndex: 5, contentMode: 'Manual', manualDesk: 'Ekonomi', manualTitle: 'Tajuk Slot 5 Sim49', manualSummary: '' },
      { slotIndex: 6, contentMode: 'Manual', manualDesk: 'BidangTakWujud123', manualTitle: 'Tajuk Slot 6 Sim49', manualSummary: '' },
    ]);
    console.log('  [maklumat] Respons POST /slots:', rSimpan.status, JSON.stringify(rSimpan.json));

    const selepasSlot5 = await dbGet(db, "SELECT manualDesk, manualTitle FROM slots_config WHERE layoutTemplateId='frontpage' AND slotIndex=5");
    const selepasSlot6 = await dbGet(db, "SELECT manualDesk, manualTitle FROM slots_config WHERE layoutTemplateId='frontpage' AND slotIndex=6");
    console.log('  [maklumat] slot 5 SELEPAS panggilan:', JSON.stringify(selepasSlot5));
    console.log('  [maklumat] slot 6 SELEPAS panggilan:', JSON.stringify(selepasSlot6));
    await new Promise(r => db.close(r));

    const slot5Tertulis = selepasSlot5 && selepasSlot5.manualTitle === 'Tajuk Slot 5 Sim49';
    const slot6Tertulis = selepasSlot6 && selepasSlot6.manualTitle === 'Tajuk Slot 6 Sim49';

    if (!rSimpan.ok && slot5Tertulis && !slot6Tertulis) {
      lapor.gagal(
        'Simpanan PUKAL menolak permintaan (400) SEBAB slot 6 bawa Bidang tak sah — tapi slot 5 ' +
        'SUDAH tertulis ke DB sebelum semakan slot 6 sempat gagal. Ini simpanan SEPARA, ' +
        'bercanggah terus dengan komen kod "semua-atau-tiada" pada laluan ni.',
        `status=${rSimpan.status} slot5=${JSON.stringify(selepasSlot5)} slot6=${JSON.stringify(selepasSlot6)}`
      );
    } else if (!rSimpan.ok && !slot5Tertulis && !slot6Tertulis) {
      lapor.lulus('Permintaan ditolak (400) DAN tiada satu pun slot tertulis — invariant semua-atau-tiada dipegang');
    } else if (rSimpan.ok) {
      lapor.gagal('Permintaan dengan Bidang tak sah SEPATUTNYA ditolak tapi malah berjaya (200)', JSON.stringify(rSimpan.json));
    } else {
      lapor.gagal('Keadaan tak dijangka', JSON.stringify({ rSimpan: rSimpan.json, selepasSlot5, selepasSlot6 }));
    }

    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
