// sim58 — Slot Bar (acara), julat tarikh terbalik (Tarikh tamat < Tarikh mula).
//
// BarSlotManagerModal.tsx (2026-09-02) sudah papar AMARAN client bila dateEnd < date, tapi
// SENGAJA amaran sahaja (bukan sekatan keras). Sebelum pembetulan bug-hunt #135 hari ni, laluan
// simpan SEBENAR (server.js validateAndPrepareManualItems, dipanggil oleh syncManualObjectsForSlot
// DAN slotsConfigRoutes.js POST /system/slots) TIADA semakan padanan langsung — julat terbalik
// terus tersimpan+tersiar. Simulasi ni panggil POST /api/system/slots TERUS (memintas UI/amaran
// client sepenuhnya) dengan blok "Event:" yang Tarikh tamat-nya lebih awal drpd Tarikh mula, sahkan
// pelayan kini menolak 400 DAN tiada baris editorial_objects tertulis untuk slot tu.
import { bootServer, bukaDb, dbGet, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5958;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim58.db');
const lapor = pelapor('sim58-bar-julat-tarikh-terbalik');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE, freshDb: true });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, username, pass);
    const klien = buatKlien(base, cookie);

    const SLOT_BAR = 7; // TIER_SLOTS.BAR = [7,8,9,10,21,22,23,24] — GeometryConfig.js

    // Blok acara: Tarikh mula 2026-09-20, Tarikh tamat 2026-09-10 — TERBALIK.
    const manualSummaryTerbalik = [
      'Event: Sim58 Kempen Terbalik',
      'Penganjur: Adjung Editorial',
      'Lokasi: Kuala Lumpur',
      'Akses: Terbuka',
      'Penerangan: Ujian simulasi julat tarikh terbalik.',
      'Tarikh mula: 2026-09-20',
      'Tarikh tamat: 2026-09-10',
      'Sumber: Adjung Editorial',
      'URL: #',
      'Status: approved',
    ].join('\n');

    const db = bukaDb(DB_FILE);
    const sebelum = await dbGet(db, 'SELECT COUNT(*) AS n FROM editorial_objects WHERE slotIndex = ?', [SLOT_BAR]);

    const rSimpan = await klien('POST', '/api/system/slots', [
      { slotIndex: SLOT_BAR, contentMode: 'Manual', manualSummary: manualSummaryTerbalik },
    ]);
    console.log('  [maklumat] Respons POST /slots (julat terbalik):', rSimpan.status, JSON.stringify(rSimpan.json));

    const selepas = await dbGet(db, 'SELECT COUNT(*) AS n FROM editorial_objects WHERE slotIndex = ?', [SLOT_BAR]);
    await new Promise(r => db.close(r));

    const tertulis = selepas && sebelum && selepas.n > sebelum.n;

    if (!rSimpan.ok && !tertulis) {
      lapor.lulus('Julat tarikh terbalik ditolak (400) DAN tiada baris editorial_objects tertulis — pelayan kini kuatkuasakan mula <= tamat untuk Slot Bar');
    } else if (rSimpan.ok) {
      lapor.gagal('Julat tarikh terbalik SEPATUTNYA ditolak tapi malah berjaya (200) — acara tersiar dgn "Tarikh tamat" lebih awal drpd "Tarikh mula"', JSON.stringify(rSimpan.json));
    } else {
      lapor.gagal('Ditolak (baik) tapi baris tetap tertulis — invariant separa', `sebelum=${JSON.stringify(sebelum)} selepas=${JSON.stringify(selepas)}`);
    }

    // Kawalan positif: julat BETUL (mula <= tamat) MESTI terus lulus seperti biasa.
    const manualSummaryBetul = [
      'Event: Sim58 Kempen Betul',
      'Penganjur: Adjung Editorial',
      'Lokasi: Kuala Lumpur',
      'Akses: Terbuka',
      'Penerangan: Ujian simulasi julat tarikh betul.',
      'Tarikh mula: 2026-09-10',
      'Tarikh tamat: 2026-09-20',
      'Sumber: Adjung Editorial',
      'URL: #',
      'Status: approved',
    ].join('\n');
    const rSimpanBetul = await klien('POST', '/api/system/slots', [
      { slotIndex: SLOT_BAR, contentMode: 'Manual', manualSummary: manualSummaryBetul },
    ]);
    console.log('  [maklumat] Respons POST /slots (julat betul):', rSimpanBetul.status, JSON.stringify(rSimpanBetul.json));
    if (rSimpanBetul.ok) {
      lapor.lulus('Julat tarikh BETUL (mula <= tamat) terus lulus seperti biasa — pembetulan tak sekat kes sah');
    } else {
      lapor.gagal('Julat tarikh BETUL sepatutnya lulus tapi ditolak — regresi', JSON.stringify(rSimpanBetul.json));
    }

    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
