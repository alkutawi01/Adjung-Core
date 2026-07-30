import express from 'express';
import { setMedanLimits } from '../editorial/ContentBudget.js';

// Tetapan Am Slot (2026-07-30, permintaan pemilik projek) — tetapan yang terpakai pada SEMUA slot
// bento sekali gus, bukan per-slot dan bukan per-tier. Ticker dan tier Bar tiada di sini; kedua-dua
// tu ada rumah sendiri di Modul Khas.
//
// Had aksara: 0 bermakna TIADA HAD. Ini sengaja — sehingga Ketua Editor benar-benar menetapkan
// nombor, tiada kandungan sedia ada tiba-tiba jadi tak sah.
export const AM_DEFAULTS = {
  mulaIkutMasa: 1,
  hadKandunganSlot: 0,
  jenisAnimasi: 'pudar',
  hadHuraianPanjang: 0,
  hadSumber: 0,
  hadTopik: 0,
  hadNotaEditor: 0,
};

// Satu-satunya jenis animasi yang benar-benar wujud dalam kod hari ini: pudar (opacity 1s
// ease-in-out, lihat CarouselStableBlock di FrontpageView.tsx). Senarai ni sengaja pendek —
// jangan tawarkan pilihan yang tak dilaksanakan.
export const JENIS_ANIMASI = [
  { nilai: 'pudar', label: 'Pudar (1 saat)' },
];

let cache = { ...AM_DEFAULTS };

export const getAmSettings = () => ({ ...cache });

export const loadAmSettings = async (dbGet) => {
  try {
    const row = await dbGet("SELECT * FROM slot_am_settings WHERE id = 'main'");
    if (row) {
      cache = {
        mulaIkutMasa: row.mulaIkutMasa ? 1 : 0,
        hadKandunganSlot: Number(row.hadKandunganSlot) || 0,
        jenisAnimasi: row.jenisAnimasi || 'pudar',
        hadHuraianPanjang: Number(row.hadHuraianPanjang) || 0,
        hadSumber: Number(row.hadSumber) || 0,
        hadTopik: Number(row.hadTopik) || 0,
        hadNotaEditor: Number(row.hadNotaEditor) || 0,
      };
    }
    // Pengesahan simpan (validateMedanTambahan) berjalan secara sync, jadi ia baca cache
    // dalam-memori ni dan bukan pangkalan data pada setiap semakan.
    setMedanLimits(cache);
    return getAmSettings();
  } catch (err) {
    console.warn('Gagal memuatkan Tetapan Am Slot:', err.message);
    return getAmSettings();
  }
};

export const createSlotAmRoutes = (dbGet, dbRun) => {
  const router = express.Router();

  router.get('/slot-am-settings', async (req, res) => {
    try {
      await loadAmSettings(dbGet);
      res.json({ ...getAmSettings(), jenisAnimasiPilihan: JENIS_ANIMASI });
    } catch (err) {
      console.error('GET slot-am-settings error:', err);
      res.status(500).json({ error: 'Gagal membaca Tetapan Am Slot. ' + (err.message || '') });
    }
  });

  router.post('/slot-am-settings', async (req, res) => {
    try {
      const b = req.body || {};
      const nombor = (nilai, nama) => {
        const n = Number(nilai);
        if (!Number.isInteger(n) || n < 0) throw new Error(`${nama} mesti nombor bulat 0 atau lebih (0 = tiada had).`);
        return n;
      };

      const baharu = {
        mulaIkutMasa: b.mulaIkutMasa ? 1 : 0,
        hadKandunganSlot: nombor(b.hadKandunganSlot, 'Had bilangan kandungan'),
        jenisAnimasi: JENIS_ANIMASI.some(j => j.nilai === b.jenisAnimasi) ? b.jenisAnimasi : 'pudar',
        hadHuraianPanjang: nombor(b.hadHuraianPanjang, 'Had huraian panjang'),
        hadSumber: nombor(b.hadSumber, 'Had sumber'),
        hadTopik: nombor(b.hadTopik, 'Had topik'),
        hadNotaEditor: nombor(b.hadNotaEditor, 'Had nota editor'),
      };

      await dbRun(`
        INSERT INTO slot_am_settings (
          id, mulaIkutMasa, hadKandunganSlot, jenisAnimasi,
          hadHuraianPanjang, hadSumber, hadTopik, hadNotaEditor, updatedAt
        ) VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          mulaIkutMasa = excluded.mulaIkutMasa,
          hadKandunganSlot = excluded.hadKandunganSlot,
          jenisAnimasi = excluded.jenisAnimasi,
          hadHuraianPanjang = excluded.hadHuraianPanjang,
          hadSumber = excluded.hadSumber,
          hadTopik = excluded.hadTopik,
          hadNotaEditor = excluded.hadNotaEditor,
          updatedAt = excluded.updatedAt
      `, [
        baharu.mulaIkutMasa, baharu.hadKandunganSlot, baharu.jenisAnimasi,
        baharu.hadHuraianPanjang, baharu.hadSumber, baharu.hadTopik, baharu.hadNotaEditor,
        new Date().toISOString(),
      ]);

      await loadAmSettings(dbGet);
      res.json({ success: true, ...getAmSettings() });
    } catch (err) {
      console.error('POST slot-am-settings error:', err);
      const kod = err.message && err.message.includes('mesti nombor') ? 400 : 500;
      res.status(kod).json({ error: err.message || 'Gagal menyimpan Tetapan Am Slot.' });
    }
  });

  return router;
};

export default createSlotAmRoutes;
