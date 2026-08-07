import express from 'express';
import { setMedanLimits } from '../editorial/ContentBudget.js';
import { setMedanLimitOverrides, MIN_BRIEF_LONG_CHARS } from '../editorial/GeometryConfig.js';
import { requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';

// Tetapan Am Slot (2026-07-30, permintaan pemilik projek) — tetapan yang terpakai pada SEMUA slot
// bento sekali gus, bukan per-slot dan bukan per-tier. Ticker dan tier Bar tiada di sini; kedua-dua
// tu ada rumah sendiri di Modul Khas.
//
// Had aksara: 0 bermakna TIADA HAD. Ini sengaja — sehingga Ketua Editor benar-benar menetapkan
// nombor, tiada kandungan sedia ada tiba-tiba jadi tak sah.
export const AM_DEFAULTS = {
  mulaIkutMasa: 1,
  hadKandunganSlot: 0,
  jenisAnimasi: 'colophon',
  arahAnimasi: 'kanan',
  // Togol aktif/nyahaktif + kelajuan (2026-08-07, permintaan Izzat eksplisit — "modul Slot-
  // Tetapan Am hanya untuk mengaktifkan atau menyahaktifkan pilihan animasi serta menetapkan
  // tetapan am seperti kelajuan dan sebagainya. jangan campur adukkan tetapan animasi dengan
  // tetapan lain"). `animasiAktif=0` paksa SEMUA slot guna 'pudar' (kelakuan asal tanpa panel),
  // tak kira jenis dipilih per-slot/global. `kelajuanAnimasi` pendarab tempoh animasi (1 = lalai,
  // dipakai pada Colophon/Sapuan Lajur/Gerak Susun — lihat CarouselStableBlock).
  animasiAktif: 1,
  kelajuanAnimasi: 1,
  hadHuraianPanjang: 0,
  hadSumber: 0,
  hadTopik: 0,
  hadNotaEditor: 0,
  // Had MINIMUM (2026-08-07, permintaan Izzat — "sepatutnya ada juga had minimum"). Sama corak
  // 0 = tiada had minimum.
  hadHuraianPanjangMin: 0,
  hadSumberMin: 0,
  hadTopikMin: 0,
  hadNotaEditorMin: 0,
  // Logo penaja lama (2026-08-04, satu logo manual GLOBAL) — DIGANTIKAN 2026-08-05 oleh giliran
  // logo Adjung/penaja automatik (nisbahPenajaTransisi di bawah, sumber penaja dari jadual
  // `sponsors` sebenar, medan tayangSemasaTransisi). Medan/lajur DB dikekalkan supaya tak hilang
  // nilai lama, tapi tidak lagi dibaca oleh overlay panel (lihat FrontpageView.tsx).
  logoPenaja: '',
  warnaPanelTransisi: '#802334',
  // Nisbah logo Adjung : logo penaja dalam panel transisi (2026-08-05, permintaan Izzat — "penaja
  // mungkin lebih daripada satu, jadi Ketua Editor boleh laraskan"). 0 = logo Adjung SAHAJA
  // (lalai — selamat, tak bergantung pada penaja langsung). N>0 = bagi setiap 1 giliran logo
  // Adjung, N giliran seterusnya logo penaja (round-robin merentasi SEMUA penaja bertanda
  // tayangSemasaTransisi bulan semasa). Jatuh balik ke Adjung sahaja bila tiada penaja layak,
  // supaya panel tak pernah kosong.
  nisbahPenajaTransisi: 0,
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
  // Gerak Susun (2026-08-07, permintaan Izzat eksplisit) — BERBEZA drpd Colophon/Sapuan Lajur:
  // kandungan SEBENAR bergerak (bukan panel menutup+kandungan bertukar senyap di sebalik panel).
  // Kandungan lama bergerak keluar, diekori logo Adjung/penaja, diekori kandungan baharu — satu
  // regangan bergerak berterusan, arah kanan/kiri sahaja (tiada atas/bawah, ikut spesifikasi).
  { nilai: 'gerak_susun', label: 'Gerak Susun (kandungan+logo bergerak berturutan)' },
];

// Arah panel Colophon/Sapuan Lajur (2026-08-05, permintaan Izzat) — terpakai pada KEDUA-DUA jenis
// animasi berpanel (bukan 'pudar', yang tiada panel/arah langsung). Panel MASUK dari arah yang
// dipilih, KELUAR ke arah bertentangan (sapuan semula jadi, bukan pantul balik ke arah sama).
export const ARAH_ANIMASI = [
  { nilai: 'kanan', label: 'Kanan (masuk dari kanan, keluar ke kiri)' },
  { nilai: 'kiri', label: 'Kiri (masuk dari kiri, keluar ke kanan)' },
  { nilai: 'atas', label: 'Atas (masuk dari atas, keluar ke bawah)' },
  { nilai: 'bawah', label: 'Bawah (masuk dari bawah, keluar ke atas)' },
];

// Nisbah logo Adjung : logo penaja dalam panel transisi (2026-08-05, permintaan Izzat). Bilangan
// giliran penaja BERTURUT-TURUT selepas setiap 1 giliran logo Adjung. Sumber penaja: jadual
// `sponsors`, medan tayangSemasaTransisi (lihat core/routes/sponsorRoutes.js).
export const NISBAH_PENAJA_TRANSISI = [
  { nilai: 0, label: 'Logo Adjung sahaja (tiada logo penaja)' },
  { nilai: 1, label: '1 Adjung : 1 penaja' },
  { nilai: 2, label: '1 Adjung : 2 penaja' },
  { nilai: 3, label: '1 Adjung : 3 penaja' },
];

// Kelajuan animasi (2026-08-07) — pendarab tempoh, tangga terhad sama sebab macam TITLE_SCALE_SAH
// (elak nilai pelik yang buat animasi terlalu pantas/lambat tak sengaja).
export const KELAJUAN_ANIMASI = [
  { nilai: 0.5, label: 'Pantas (0.5×)' },
  { nilai: 1, label: 'Sederhana (lalai)' },
  { nilai: 1.5, label: 'Perlahan (1.5×)' },
  { nilai: 2, label: 'Sangat perlahan (2×)' },
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
        jenisAnimasi: row.jenisAnimasi || 'colophon',
        arahAnimasi: row.arahAnimasi || 'kanan',
        animasiAktif: row.animasiAktif === 0 ? 0 : 1,
        kelajuanAnimasi: KELAJUAN_ANIMASI.some(k => k.nilai === Number(row.kelajuanAnimasi)) ? Number(row.kelajuanAnimasi) : 1,
        hadHuraianPanjang: Number(row.hadHuraianPanjang) || 0,
        hadSumber: Number(row.hadSumber) || 0,
        hadTopik: Number(row.hadTopik) || 0,
        hadNotaEditor: Number(row.hadNotaEditor) || 0,
        hadHuraianPanjangMin: Number(row.hadHuraianPanjangMin) || 0,
        hadSumberMin: Number(row.hadSumberMin) || 0,
        hadTopikMin: Number(row.hadTopikMin) || 0,
        hadNotaEditorMin: Number(row.hadNotaEditorMin) || 0,
        logoPenaja: row.logoPenaja || '',
        warnaPanelTransisi: row.warnaPanelTransisi || '#802334',
        nisbahPenajaTransisi: NISBAH_PENAJA_TRANSISI.some(n => n.nilai === Number(row.nisbahPenajaTransisi)) ? Number(row.nisbahPenajaTransisi) : 0,
        focusViewTitleScale: Number(row.focusViewTitleScale) || 1,
        focusViewBodySize: Number(row.focusViewBodySize) || 15,
      };
    }
    // Pengesahan simpan (validateMedanTambahan) berjalan secara sync, jadi ia baca cache
    // dalam-memori ni dan bukan pangkalan data pada setiap semakan.
    setMedanLimits(cache);
    // Sambung SATU medan Tetapan Am Slot ni ke had geometri sebenar juga (2026-08-07, permintaan
    // Izzat) — bukan lagi cuma semakan tambahan senyap, had yang dipapar di modal Urus Slot/prompt
    // AI turut ikut nombor ni bila diisi.
    setMedanLimitOverrides({ maxBriefLong: cache.hadHuraianPanjang, maxTopik: cache.hadTopik, minBriefLong: cache.hadHuraianPanjangMin });
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
      res.json({ ...getAmSettings(), jenisAnimasiPilihan: JENIS_ANIMASI, arahAnimasiPilihan: ARAH_ANIMASI, nisbahPenajaTransisiPilihan: NISBAH_PENAJA_TRANSISI, kelajuanAnimasiPilihan: KELAJUAN_ANIMASI });
    } catch (err) {
      console.error('GET slot-am-settings error:', err);
      res.status(500).json({ error: 'Gagal membaca Tetapan Am Slot. ' + (err.message || '') });
    }
  });

  // Tetapan Am Slot mengawal had medan, animasi dan panel transisi SEMUA slot sekali gus —
  // kawalan editorial, jadi digerbang sama seperti Tetapan Tier.
  router.post('/slot-am-settings', requirePermission('manageEditorial'), async (req, res) => {
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
        jenisAnimasi: JENIS_ANIMASI.some(j => j.nilai === b.jenisAnimasi) ? b.jenisAnimasi : 'colophon',
        arahAnimasi: ARAH_ANIMASI.some(a => a.nilai === b.arahAnimasi) ? b.arahAnimasi : 'kanan',
        animasiAktif: b.animasiAktif ? 1 : 0,
        kelajuanAnimasi: KELAJUAN_ANIMASI.some(k => k.nilai === Number(b.kelajuanAnimasi)) ? Number(b.kelajuanAnimasi) : 1,
        hadHuraianPanjang: (() => {
          const n = nombor(b.hadHuraianPanjang, 'Had huraian panjang');
          // Nombor ni kini turut jadi had MAKSIMUM geometri sebenar (setMedanLimitOverrides di
          // atas), bukan cuma semakan tambahan — mesti sekurang-kurangnya minimum huraian panjang
          // sedia ada (MIN_BRIEF_LONG_CHARS), kalau tidak mustahil simpan APA-APA kandungan (min >
          // max). 0 (tiada had) sentiasa dibenarkan.
          if (n > 0 && n < MIN_BRIEF_LONG_CHARS) {
            throw new Error(`Had huraian panjang mesti sekurang-kurangnya ${MIN_BRIEF_LONG_CHARS} aksara (had minimum sedia ada), atau 0 untuk tiada had.`);
          }
          return n;
        })(),
        hadSumber: nombor(b.hadSumber, 'Had sumber'),
        hadTopik: nombor(b.hadTopik, 'Had topik'),
        hadNotaEditor: nombor(b.hadNotaEditor, 'Had nota editor'),
        // Had MINIMUM (2026-08-07, permintaan Izzat). silangSah: 0 = tiada minimum sentiasa
        // dibenarkan; kalau kedua-dua min DAN max ditetapkan, min mesti <= max (kalau tidak
        // mustahil simpan APA-APA kandungan untuk medan tu — julat sah kosong).
        hadHuraianPanjangMin: nombor(b.hadHuraianPanjangMin, 'Had minimum huraian panjang'),
        hadSumberMin: nombor(b.hadSumberMin, 'Had minimum sumber'),
        hadTopikMin: nombor(b.hadTopikMin, 'Had minimum topik'),
        hadNotaEditorMin: nombor(b.hadNotaEditorMin, 'Had minimum nota editor'),
        logoPenaja: typeof b.logoPenaja === 'string' ? b.logoPenaja.slice(0, 500) : '',
        warnaPanelTransisi: warnaSah(b.warnaPanelTransisi) ? b.warnaPanelTransisi : '#802334',
        nisbahPenajaTransisi: NISBAH_PENAJA_TRANSISI.some(n => n.nilai === Number(b.nisbahPenajaTransisi)) ? Number(b.nisbahPenajaTransisi) : 0,
        focusViewTitleScale: TITLE_SCALE_SAH.includes(Number(b.focusViewTitleScale)) ? Number(b.focusViewTitleScale) : 1,
        focusViewBodySize: BODY_SIZE_SAH.includes(Number(b.focusViewBodySize)) ? Number(b.focusViewBodySize) : 15,
      };

      // Silang sah min <= max (2026-08-07) — kedua-dua ditetapkan (bukan 0) mesti julat SAH,
      // kalau tidak mustahil simpan APA-APA kandungan untuk medan tu.
      const pasanganMinMax = [
        ['Huraian panjang', baharu.hadHuraianPanjangMin, baharu.hadHuraianPanjang],
        ['Sumber', baharu.hadSumberMin, baharu.hadSumber],
        ['Topik', baharu.hadTopikMin, baharu.hadTopik],
        ['Nota editor', baharu.hadNotaEditorMin, baharu.hadNotaEditor],
      ];
      for (const [nama, min, maks] of pasanganMinMax) {
        if (min > 0 && maks > 0 && min > maks) {
          throw new Error(`${nama}: had minimum (${min}) tak boleh lebih besar daripada had maksimum (${maks}).`);
        }
      }

      await dbRun(`
        INSERT INTO slot_am_settings (
          id, mulaIkutMasa, hadKandunganSlot, jenisAnimasi, arahAnimasi, animasiAktif, kelajuanAnimasi,
          hadHuraianPanjang, hadSumber, hadTopik, hadNotaEditor,
          hadHuraianPanjangMin, hadSumberMin, hadTopikMin, hadNotaEditorMin,
          logoPenaja, warnaPanelTransisi, nisbahPenajaTransisi, focusViewTitleScale, focusViewBodySize, updatedAt
        ) VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          mulaIkutMasa = excluded.mulaIkutMasa,
          hadKandunganSlot = excluded.hadKandunganSlot,
          jenisAnimasi = excluded.jenisAnimasi,
          arahAnimasi = excluded.arahAnimasi,
          animasiAktif = excluded.animasiAktif,
          kelajuanAnimasi = excluded.kelajuanAnimasi,
          hadHuraianPanjang = excluded.hadHuraianPanjang,
          hadSumber = excluded.hadSumber,
          hadTopik = excluded.hadTopik,
          hadNotaEditor = excluded.hadNotaEditor,
          hadHuraianPanjangMin = excluded.hadHuraianPanjangMin,
          hadSumberMin = excluded.hadSumberMin,
          hadTopikMin = excluded.hadTopikMin,
          hadNotaEditorMin = excluded.hadNotaEditorMin,
          logoPenaja = excluded.logoPenaja,
          warnaPanelTransisi = excluded.warnaPanelTransisi,
          nisbahPenajaTransisi = excluded.nisbahPenajaTransisi,
          focusViewTitleScale = excluded.focusViewTitleScale,
          focusViewBodySize = excluded.focusViewBodySize,
          updatedAt = excluded.updatedAt
      `, [
        baharu.mulaIkutMasa, baharu.hadKandunganSlot, baharu.jenisAnimasi, baharu.arahAnimasi,
        baharu.animasiAktif, baharu.kelajuanAnimasi,
        baharu.hadHuraianPanjang, baharu.hadSumber, baharu.hadTopik, baharu.hadNotaEditor,
        baharu.hadHuraianPanjangMin, baharu.hadSumberMin, baharu.hadTopikMin, baharu.hadNotaEditorMin,
        baharu.logoPenaja, baharu.warnaPanelTransisi, baharu.nisbahPenajaTransisi,
        baharu.focusViewTitleScale, baharu.focusViewBodySize,
        new Date().toISOString(),
      ]);

      await loadAmSettings(dbGet);

      // Log Audit (2026-08-06, pembetulan audit) — dahulu tetapan sistem (Tetapan Am Slot, Tier
      // Kad, Polisi/Halaman Awam) langsung tak dicatat, cuma tindakan editorial (terbit/tolak/
      // arkib) dan pentadbiran akaun yang direkod. Perubahan sini boleh jejas SEMUA slot bento
      // sekali gus (jenis/arah animasi, had aksara, giliran logo penaja) — patut ada jejak siapa
      // ubah bila, sama macam tindakan lain.
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'kemas-kini-tetapan-am-slot',
        targetType: 'tetapan',
        targetId: 'slot-am-settings',
      });

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
