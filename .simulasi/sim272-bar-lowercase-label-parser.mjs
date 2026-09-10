// sim272 — Slot Bar (acara), label huruf kecil (penganjur:/lokasi:/akses:/penerangan:) dahulu
// senyap gugur walaupun Perlembagaan (PerlembagaanConsole.tsx, seksyen "04 — Peraturan Khas Slot
// Bar") mendakwa parser ni "case-insensitive". Puncanya: ADA_LABEL_DIKENALI() (ManualBlockFormat.js)
// memang case-insensitive (guna .toLowerCase() untuk KENAL sempadan baris label), tapi rantaian
// else-if SEBENAR yang mengekstrak nilai (server.js parseManualSummaryTemplate DAN client
// parseManualBlockFields di ManualBlockFormat.js) guna `trimmed.startsWith('Penganjur:')` —
// perbandingan CASE-SENSITIVE. Kesan: editor taip "penganjur:" (huruf kecil, gaya santai biasa
// dalam Bahasa Melayu tak formal) — baris tu DIKENALI sebagai sempadan label (jadi tak tersasar
// jadi teks sambungan medan sebelum), tapi TIDAK PADAN mana-mana cabang else-if, jadi nilai
// tersebut hilang senyap tanpa ralat. Dibaiki: 4 cabang (Penganjur/Lokasi/Akses/Penerangan) di
// KEDUA-DUA fail kini guna /^Label:/i.test(trimmed) supaya padan tanpa mengira kes, selaras
// dengan dakwaan Perlembagaan.
import { bootServer, bukaDb, dbGet, dbAll, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5972;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim272.db');
const lapor = pelapor('sim272-bar-lowercase-label-parser');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE, freshDb: true });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, username, pass);
    const klien = buatKlien(base, cookie);

    const SLOT_BAR = 7; // TIER_SLOTS.BAR = [7,8,9,10,21,22,23,24] — GeometryConfig.js

    // Blok acara dengan label huruf KECIL sepenuhnya bagi 4 medan yang didakwa case-insensitive.
    const manualSummaryHurufKecil = [
      'Event: Sim272 Kempen Label Huruf Kecil Untuk Ujian Parser Slot Bar Adjung Editorial',
      'penganjur: Dewan Bahasa dan Pustaka',
      'lokasi: Kuala Lumpur',
      'akses: Tertutup',
      'penerangan: Huraian ujian label huruf kecil untuk pengesahan case-insensitive.',
      'Tarikh mula: 2026-09-10',
      'Tarikh tamat: 2026-09-20',
      'Sumber: Adjung Editorial',
      'URL: #',
      'Status: approved',
    ].join('\n');

    const rSimpan = await klien('POST', '/api/system/slots', [
      { slotIndex: SLOT_BAR, contentMode: 'Manual', manualSummary: manualSummaryHurufKecil },
    ]);
    console.log('  [maklumat] Respons POST /slots (label huruf kecil):', rSimpan.status, JSON.stringify(rSimpan.json));

    if (!rSimpan.ok) {
      lapor.gagal('POST /slots gagal sepenuhnya, tak dapat sahkan pengekstrakan medan', JSON.stringify(rSimpan.json));
    } else {
      const db = bukaDb(DB_FILE);
      const objek = await dbGet(db, 'SELECT id FROM editorial_objects WHERE slotIndex = ? ORDER BY rowid DESC LIMIT 1', [SLOT_BAR]);
      const atribut = objek ? await dbAll(db,
        `SELECT ea.name AS nama, eav.valueText AS nilai FROM editorial_attribute_values eav
         JOIN editorial_attributes ea ON ea.id = eav.attributeId WHERE eav.objectId = ?`, [objek.id]) : [];
      await new Promise(r => db.close(r));

      const peta = Object.fromEntries(atribut.map(a => [a.nama, a.nilai]));
      console.log('  [maklumat] Atribut tersimpan:', JSON.stringify(peta));

      const semua = peta.Penganjur === 'Dewan Bahasa dan Pustaka'
        && peta.Lokasi === 'Kuala Lumpur'
        && peta.Akses === 'Tertutup'
        && (peta.Penerangan || '').includes('label huruf kecil');

      if (semua) {
        lapor.lulus('Kesemua 4 medan huruf kecil (penganjur/lokasi/akses/penerangan) tersimpan betul — parser kini benar-benar case-insensitive seperti dakwaan Perlembagaan');
      } else {
        lapor.gagal('Sekurang-kurangnya satu medan huruf kecil hilang/salah — parser masih case-sensitive walau label dikenali sebagai sempadan', JSON.stringify(peta));
      }
    }

    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
