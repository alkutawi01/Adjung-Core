// sim59 — Slot Bar (acara), sintaks gloss interlinear dalam Penerangan terlepas semakan.
//
// validateGlossLength() (ContentBudget.js) dikuatkuasakan validateAndPrepareManualItems()
// (server.js) sebagai kill switch GLOSS_AUTHORING_ENABLED=false — SEPATUTNYA tolak simpanan
// BAHARU apa-apa medan bertulis sintaks [label](gloss:makna). Sebelum pembetulan bug-hunt
// susulan #135/#136 hari ni, semakan tu cuma senaraikan Tajuk/Huraian ringkas/Huraian panjang
// (medan artikel biasa) — terlepas item.penerangan, medan SEBENAR Slot Bar (borang "Penerangan"
// BarSlotManagerModal.tsx). Kesan: sintaks gloss dalam Penerangan LULUS pengesahan, tersimpan,
// dan terpapar MENTAH (kurungan siku/bulat literal) di BarCardExpandedPanel.tsx (render
// `{item.penerangan}` terus, tiada tokenize()). Simulasi ni panggil POST /api/system/slots TERUS
// dengan blok "Event:" yang Penerangan-nya ada sintaks gloss, sahkan pelayan kini menolak 400 DAN
// tiada baris editorial_objects tertulis.
import { bootServer, bukaDb, dbGet, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5959;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim59.db');
const lapor = pelapor('sim59-bar-penerangan-gloss-terlepas');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE, freshDb: true });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, username, pass);
    const klien = buatKlien(base, cookie);

    const SLOT_BAR = 7; // TIER_SLOTS.BAR = [7,8,9,10,21,22,23,24] — GeometryConfig.js

    // Blok acara: Penerangan ada sintaks gloss interlinear [label](gloss:makna).
    const manualSummaryGloss = [
      'Event: Sim59 Kempen Gloss',
      'Penganjur: Adjung Editorial',
      'Lokasi: Kuala Lumpur',
      'Akses: Terbuka',
      'Penerangan: Majlis [ini](gloss:penerangan tersembunyi) akan berlangsung sepanjang hari.',
      'Tarikh mula: 2026-09-10',
      'Tarikh tamat: 2026-09-20',
      'Sumber: Adjung Editorial',
      'URL: #',
      'Status: approved',
    ].join('\n');

    const db = bukaDb(DB_FILE);
    const sebelum = await dbGet(db, 'SELECT COUNT(*) AS n FROM editorial_objects WHERE slotIndex = ?', [SLOT_BAR]);

    const rSimpan = await klien('POST', '/api/system/slots', [
      { slotIndex: SLOT_BAR, contentMode: 'Manual', manualSummary: manualSummaryGloss },
    ]);
    console.log('  [maklumat] Respons POST /slots (Penerangan ada gloss):', rSimpan.status, JSON.stringify(rSimpan.json));

    const selepas = await dbGet(db, 'SELECT COUNT(*) AS n FROM editorial_objects WHERE slotIndex = ?', [SLOT_BAR]);
    await new Promise(r => db.close(r));

    const tertulis = selepas && sebelum && selepas.n > sebelum.n;

    if (!rSimpan.ok && !tertulis) {
      lapor.lulus('Sintaks gloss dalam Penerangan ditolak (400) DAN tiada baris editorial_objects tertulis — semakan kini litupi medan Penerangan Slot Bar');
    } else if (rSimpan.ok) {
      lapor.gagal('Sintaks gloss dalam Penerangan SEPATUTNYA ditolak tapi malah berjaya (200) — kandungan gloss mentah akan terpapar tak diproses di BarCardExpandedPanel.tsx', JSON.stringify(rSimpan.json));
    } else {
      lapor.gagal('Ditolak (baik) tapi baris tetap tertulis — invariant separa', `sebelum=${JSON.stringify(sebelum)} selepas=${JSON.stringify(selepas)}`);
    }

    // Kawalan positif: Penerangan TANPA sintaks gloss mesti terus lulus seperti biasa.
    const manualSummaryBersih = [
      'Event: Sim59 Kempen Bersih',
      'Penganjur: Adjung Editorial',
      'Lokasi: Kuala Lumpur',
      'Akses: Terbuka',
      'Penerangan: Majlis biasa tanpa sintaks istimewa akan berlangsung sepanjang hari.',
      'Tarikh mula: 2026-09-10',
      'Tarikh tamat: 2026-09-20',
      'Sumber: Adjung Editorial',
      'URL: #',
      'Status: approved',
    ].join('\n');
    const rSimpanBersih = await klien('POST', '/api/system/slots', [
      { slotIndex: SLOT_BAR, contentMode: 'Manual', manualSummary: manualSummaryBersih },
    ]);
    console.log('  [maklumat] Respons POST /slots (Penerangan bersih):', rSimpanBersih.status, JSON.stringify(rSimpanBersih.json));
    if (rSimpanBersih.ok) {
      lapor.lulus('Penerangan tanpa sintaks gloss terus lulus seperti biasa — pembetulan tak sekat kes sah');
    } else {
      lapor.gagal('Penerangan bersih sepatutnya lulus tapi ditolak — regresi', JSON.stringify(rSimpanBersih.json));
    }

    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
