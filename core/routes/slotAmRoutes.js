import express from 'express';
import { setMedanLimits } from '../editorial/ContentBudget.js';
import { requireAuth } from '../middleware/auth.js';

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
  // Logo penaja + warna panel animasi (2026-08-04) — satu logo GLOBAL (bukan per-slot/rotasi,
  // keputusan Izzat), dipaparkan di tengah panel Colophon/Sapuan Lajur. '' = tiada logo
  // (panel kosong, bukan ralat). warnaPanelTransisi lalai maroon jenama sedia ada.
  logoPenaja: '',
  warnaPanelTransisi: '#802334',
  // Saiz fon Focus View (2026-08-04, permintaan Izzat) — SATU tetapan GLOBAL untuk seluruh
  // Focus View, bukan per-Bidang/tier. focusViewTitleScale darab tangga saiz tajuk responsif
  // sedia ada (1 = lalai/tak berubah). focusViewBodySize nilai literal px huraian (15 = lalai).
  focusViewTitleScale: 1,
  focusViewBodySize: 15,
};

// Tiga jenis animasi carousel yang dilaksanakan sebenar dalam kod (2026-08-04, Fasa 7 — spesifikasi
// Izzat/Claude Design, design_handoff_carousel_transitions): pudar (opacity crossfade sedia ada),
// colophon (overlay maroon lalu menegak — versi disesuaikan drpd trek 3-kad fizikal asal untuk
// elak ubah struktur JSX renderItem yang fragile), sapuan_lajur (panel maroon sapu dua fasa).
// Senarai ni sengaja terhad — jangan tawarkan pilihan yang tak dilaksanakan (lihat
// CarouselStableBlock di FrontpageView.tsx untuk pelaksanaan sebenar setiap satu).
export const JENIS_ANIMASI = [
  { nilai: 'pudar', label: 'Pudar (1 saat)' },
  { nilai: 'colophon', label: 'Colophon (panel maroon menegak)' },
  { nilai: 'sapuan_lajur', label: 'Sapuan Lajur (panel maroon sapu)' },
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
        logoPenaja: row.logoPenaja || '',
        warnaPanelTransisi: row.warnaPanelTransisi || '#802334',
        focusViewTitleScale: Number(row.focusViewTitleScale) || 1,
        focusViewBodySize: Number(row.focusViewBodySize) || 15,
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

  router.post('/slot-am-settings', requireAuth, async (req, res) => {
    try {
      const b = req.body || {};
      const nombor = (nilai, nama) => {
        const n = Number(nilai);
        if (!Number.isInteger(n) || n < 0) throw new Error(`${nama} mesti nombor bulat 0 atau lebih (0 = tiada had).`);
        return n;
      };

      // Warna: terima terus rentetan hex #RGB/#RRGGBB — semak format ringkas sahaja (elak
      // suntikan/nilai sampah), bukan validasi warna penuh (nama warna CSS dsb sengaja tak
      // dibenarkan supaya nilai simpan konsisten untuk dibaca semula sebagai swatch).
      const warnaSah = (nilai) => typeof nilai === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(nilai);

      // Tangga terhad (bukan nombor bebas) — elak nilai pelik yang buat tajuk/huraian tak muat
      // dalam Focus View. Sepadan dgn pilihan dropdown di TetapanAmSlotConsole.tsx.
      const TITLE_SCALE_SAH = [0.85, 1, 1.15, 1.3];
      const BODY_SIZE_SAH = [13, 15, 17, 19];

      const baharu = {
        mulaIkutMasa: b.mulaIkutMasa ? 1 : 0,
        hadKandunganSlot: nombor(b.hadKandunganSlot, 'Had bilangan kandungan'),
        jenisAnimasi: JENIS_ANIMASI.some(j => j.nilai === b.jenisAnimasi) ? b.jenisAnimasi : 'pudar',
        hadHuraianPanjang: nombor(b.hadHuraianPanjang, 'Had huraian panjang'),
        hadSumber: nombor(b.hadSumber, 'Had sumber'),
        hadTopik: nombor(b.hadTopik, 'Had topik'),
        hadNotaEditor: nombor(b.hadNotaEditor, 'Had nota editor'),
        logoPenaja: typeof b.logoPenaja === 'string' ? b.logoPenaja.slice(0, 500) : '',
        warnaPanelTransisi: warnaSah(b.warnaPanelTransisi) ? b.warnaPanelTransisi : '#802334',
        focusViewTitleScale: TITLE_SCALE_SAH.includes(Number(b.focusViewTitleScale)) ? Number(b.focusViewTitleScale) : 1,
        focusViewBodySize: BODY_SIZE_SAH.includes(Number(b.focusViewBodySize)) ? Number(b.focusViewBodySize) : 15,
      };

      await dbRun(`
        INSERT INTO slot_am_settings (
          id, mulaIkutMasa, hadKandunganSlot, jenisAnimasi,
          hadHuraianPanjang, hadSumber, hadTopik, hadNotaEditor,
          logoPenaja, warnaPanelTransisi, focusViewTitleScale, focusViewBodySize, updatedAt
        ) VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          mulaIkutMasa = excluded.mulaIkutMasa,
          hadKandunganSlot = excluded.hadKandunganSlot,
          jenisAnimasi = excluded.jenisAnimasi,
          hadHuraianPanjang = excluded.hadHuraianPanjang,
          hadSumber = excluded.hadSumber,
          hadTopik = excluded.hadTopik,
          hadNotaEditor = excluded.hadNotaEditor,
          logoPenaja = excluded.logoPenaja,
          warnaPanelTransisi = excluded.warnaPanelTransisi,
          focusViewTitleScale = excluded.focusViewTitleScale,
          focusViewBodySize = excluded.focusViewBodySize,
          updatedAt = excluded.updatedAt
      `, [
        baharu.mulaIkutMasa, baharu.hadKandunganSlot, baharu.jenisAnimasi,
        baharu.hadHuraianPanjang, baharu.hadSumber, baharu.hadTopik, baharu.hadNotaEditor,
        baharu.logoPenaja, baharu.warnaPanelTransisi,
        baharu.focusViewTitleScale, baharu.focusViewBodySize,
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
