import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';

// Dasar Aktif Editorial — tempoh boleh laras (2026-08-16, permintaan Izzat) — peluasan kepada
// dasar aktif editorial sedia ada (server.js, ditambah 2026-08-05: editor wajib terbitkan
// kandungan dalam tempoh tertentu, kalau tidak digantung automatik). Tempoh 7/14/21 hari dahulu
// PEMALAR KOD KERAS (`AMBANG_TAK_AKTIF`, server.js) — Izzat tanya macam mana nak semak dan
// laraskan tempoh tu, jawapannya (sebelum modul ni) ialah "kena minta Claude edit kod". Modul ni
// jadikan tempoh tu DATA (jadual `dasar_aktif_editorial`, satu baris `id='main'`, corak IDENTIK
// slotAmRoutes.js) supaya Pentadbir/Ketua Editor boleh laras sendiri di Direktori, dan
// `runSemakanTakAktif()` (server.js) baca cache dalam-memori ni SETIAP kali ia jalan (sekali
// sehari) — bukan pemalar dibaca sekali semasa boot — jadi perubahan Pentadbir buat HARI NI
// terpakai pada semakan esok tanpa perlu restart pelayan.
export const DASAR_AKTIF_DEFAULTS = {
  amaranPertamaHari: 7,
  amaranKeduaHari: 14,
  notisPenamatanHari: 21,
};

// Peranan yang tertakluk dasar ni (Pentadbir DIKECUALIKAN — dia struktur RBAC tak boleh terbit
// kandungan langsung, lihat nota panjang di server.js runSemakanTakAktif). Satu sumber kebenaran
// dikongsi server.js (semakan/gantung sebenar) DAN userAdminRoutes.js (paparan status Direktori)
// supaya kedua-dua tempat tak boleh terpesong sesama sendiri tentang SIAPA tertakluk dasar ni.
export const PERANAN_TERPAKAI_DASAR_AKTIF = ['editor', 'ketua_editor', 'penolong_ketua_editor'];

let cache = { ...DASAR_AKTIF_DEFAULTS };

export const getDasarAktifSettings = () => ({ ...cache });

// Digunakan terus oleh server.js runSemakanTakAktif() — tukar hari->ms di SATU tempat ni sahaja.
const HARI_MS = 24 * 60 * 60 * 1000;
export const getDasarAktifAmbangMs = () => ({
  amaranPertama: cache.amaranPertamaHari * HARI_MS,
  amaranKedua: cache.amaranKeduaHari * HARI_MS,
  notisPenamatan: cache.notisPenamatanHari * HARI_MS,
});

export const loadDasarAktifSettings = async (dbGet) => {
  try {
    const row = await dbGet("SELECT * FROM dasar_aktif_editorial WHERE id = 'main'");
    if (row) {
      cache = {
        amaranPertamaHari: Number(row.amaranPertamaHari) || DASAR_AKTIF_DEFAULTS.amaranPertamaHari,
        amaranKeduaHari: Number(row.amaranKeduaHari) || DASAR_AKTIF_DEFAULTS.amaranKeduaHari,
        notisPenamatanHari: Number(row.notisPenamatanHari) || DASAR_AKTIF_DEFAULTS.notisPenamatanHari,
      };
    }
    return getDasarAktifSettings();
  } catch (err) {
    console.warn('Gagal memuatkan Dasar Aktif Editorial:', err.message);
    return getDasarAktifSettings();
  }
};

export const createDasarAktifRoutes = (dbGet, dbRun) => {
  const router = express.Router();

  // Sama gerbang keizinan macam laluan akaun lain (userAdminRoutes.js) — ni dasar yang boleh
  // menggantung akaun editor, bukan tetapan kosmetik.
  router.get('/dasar-aktif-editorial', requirePermission('manageAccounts'), async (req, res) => {
    try {
      await loadDasarAktifSettings(dbGet);
      res.json(getDasarAktifSettings());
    } catch (err) {
      console.error('GET dasar-aktif-editorial error:', err);
      res.status(500).json({ error: 'Gagal membaca Dasar Aktif Editorial. ' + (err.message || '') });
    }
  });

  router.post('/dasar-aktif-editorial', requirePermission('manageAccounts'), async (req, res) => {
    try {
      const b = req.body || {};
      const hari = (nilai, nama) => {
        const n = Number(nilai);
        if (!Number.isInteger(n) || n < 1) throw new Error(`${nama} mesti nombor bulat sekurang-kurangnya 1 hari.`);
        return n;
      };
      const baharu = {
        amaranPertamaHari: hari(b.amaranPertamaHari, 'Amaran pertama'),
        amaranKeduaHari: hari(b.amaranKeduaHari, 'Amaran kedua'),
        notisPenamatanHari: hari(b.notisPenamatanHari, 'Notis penamatan/gantung automatik'),
      };
      // Susunan menaik WAJIB — kalau tidak eskalasi tiga-tahap (runSemakanTakAktif, server.js)
      // jadi tak bermakna (cth amaran kedua pada hari-14 tapi gantung automatik pada hari-10).
      if (!(baharu.amaranPertamaHari < baharu.amaranKeduaHari && baharu.amaranKeduaHari < baharu.notisPenamatanHari)) {
        return res.status(400).json({ error: 'Tempoh mesti menaik: Amaran pertama < Amaran kedua < Notis penamatan.' });
      }

      await dbRun(`
        INSERT INTO dasar_aktif_editorial (id, amaranPertamaHari, amaranKeduaHari, notisPenamatanHari, updatedAt)
        VALUES ('main', ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          amaranPertamaHari = excluded.amaranPertamaHari,
          amaranKeduaHari = excluded.amaranKeduaHari,
          notisPenamatanHari = excluded.notisPenamatanHari,
          updatedAt = excluded.updatedAt
      `, [baharu.amaranPertamaHari, baharu.amaranKeduaHari, baharu.notisPenamatanHari, new Date().toISOString()]);

      await loadDasarAktifSettings(dbGet);

      // Log Audit — dasar ni boleh menggantung akaun automatik, patut ada jejak siapa ubah
      // tempoh bila (sama taraf keterukan macam kemas-kini-tetapan-am-slot).
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'kemas-kini-dasar-aktif-editorial',
        targetType: 'tetapan',
        targetId: 'dasar-aktif-editorial',
        detail: `Amaran ${baharu.amaranPertamaHari}/${baharu.amaranKeduaHari} hari, gantung automatik ${baharu.notisPenamatanHari} hari.`,
      });

      res.json({ success: true, ...getDasarAktifSettings() });
    } catch (err) {
      console.error('POST dasar-aktif-editorial error:', err);
      const kod = err.message && err.message.includes('mesti nombor') ? 400 : (err.message && err.message.includes('menaik') ? 400 : 500);
      res.status(kod).json({ error: err.message || 'Gagal menyimpan Dasar Aktif Editorial.' });
    }
  });

  return router;
};

export default createDasarAktifRoutes;
