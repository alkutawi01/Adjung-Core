import express from 'express';
import webpush from 'web-push';
import { requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';
import { binaLaluanKandungan } from '../editorial/UrlSlug.js';
import { getOrCreateUrlKod } from './articleUrlRoutes.js';
import {
  pastikanSkema, sahkanLangganan, simpanLangganan, jalankanSekali, binaPenghantarSebenar,
} from '../push/PushService.js';

// Notifikasi tolak pembaca (2026-10-25). Lihat core/push/PushService.js untuk rasional penuh.
//
//   GET  /api/public/push/kunci     — kunci awam VAPID (pelayar perlukan untuk melanggan)
//   POST /api/public/push/langgan   — daftar langganan pelayar pembaca (tanpa sesi, dihadkan kadar di server.js)
//   POST /api/public/push/henti     — batal langganan
//   GET  /api/system/push/tetapan   — status untuk editor (manageEditorial)
//   PATCH /api/system/push/tetapan  — suis padam/hidup (manageEditorial)

const JEDA_PENGESAN_MS = 60 * 1000;
const HAD_LANGGANAN = 200000;

export function createPushRoutes(dbAll, dbGet, dbRun) {
  const router = express.Router();
  let sedia = null; // { penghantar, kunciAwam }

  const pastikanSedia = async () => {
    if (sedia) return sedia;
    const tetapan = await pastikanSkema(dbRun, dbGet, webpush);
    sedia = {
      kunciAwam: tetapan.vapidPublic,
      penghantar: binaPenghantarSebenar(webpush, { vapidPublic: tetapan.vapidPublic, vapidPrivate: tetapan.vapidPrivate }),
    };
    return sedia;
  };

  // Laluan artikel kanonikal — logik SAMA seperti GET /system/content/:id/url-kod (Bidang LIVE drpd
  // atribut desk revisi terkini dahulu, kemudian categoryId), supaya ketik notifikasi mendarat
  // tepat di URL yang dikongsi/diindeks.
  const binaLaluan = async (objectId) => {
    const obj = await dbGet(
      `SELECT eo.categoryId AS categoryId,
              (SELECT er.title FROM editorial_revisions er WHERE er.objectId = eo.id ORDER BY er.version DESC LIMIT 1) AS title,
              (SELECT av.valueText FROM editorial_attribute_values av
                 JOIN editorial_revisions er2 ON er2.id = av.revisionId
                WHERE av.objectId = eo.id AND av.attributeId = 'desk'
                ORDER BY er2.version DESC LIMIT 1) AS deskLive
       FROM editorial_objects eo WHERE eo.id = ?`, [objectId]);
    if (!obj) return null;
    const kod = await getOrCreateUrlKod(dbGet, dbRun, objectId);
    return binaLaluanKandungan(obj.title, obj.deskLive || obj.categoryId, kod);
  };

  router.get('/public/push/kunci', async (req, res) => {
    try {
      const s = await pastikanSedia();
      const t = await dbGet(`SELECT aktif FROM push_tetapan WHERE id = 'main'`);
      res.json({ kunci: s.kunciAwam, aktif: !!t?.aktif });
    } catch (err) {
      console.error('GET push/kunci error:', err);
      res.status(500).json({ error: 'Notifikasi tidak tersedia.' });
    }
  });

  router.post('/public/push/langgan', async (req, res) => {
    try {
      await pastikanSedia();
      const sah = sahkanLangganan(req.body);
      if (!sah.ok) return res.status(400).json({ error: sah.ralat });
      const jumlah = (await dbGet(`SELECT COUNT(*) AS n FROM push_langganan`))?.n || 0;
      if (jumlah >= HAD_LANGGANAN) return res.status(503).json({ error: 'Notifikasi tidak menerima pelanggan baharu buat masa ini.' });
      const hasil = await simpanLangganan(dbGet, dbRun, sah);
      res.json({ success: true, baharu: hasil.baharu });
    } catch (err) {
      console.error('POST push/langgan error:', err);
      res.status(500).json({ error: 'Gagal mendaftar notifikasi.' });
    }
  });

  router.post('/public/push/henti', async (req, res) => {
    try {
      await pastikanSedia();
      const endpoint = req.body?.endpoint;
      if (typeof endpoint === 'string' && endpoint.length <= 1000) {
        await dbRun(`DELETE FROM push_langganan WHERE endpoint = ?`, [endpoint]);
      }
      res.json({ success: true });
    } catch (err) {
      console.error('POST push/henti error:', err);
      res.status(500).json({ error: 'Gagal membatalkan notifikasi.' });
    }
  });

  router.get('/system/push/tetapan', requirePermission('manageEditorial'), async (req, res) => {
    try {
      await pastikanSedia();
      const t = await dbGet(`SELECT aktif, hantarTerakhir FROM push_tetapan WHERE id = 'main'`);
      const bil = (await dbGet(`SELECT COUNT(*) AS n FROM push_langganan`))?.n || 0;
      const log = await dbAll(`SELECT masa, bilKandungan, bilPenerima, bilBerjaya, ringkasan FROM push_log ORDER BY id DESC LIMIT 10`);
      res.json({ aktif: !!t?.aktif, hantarTerakhir: t?.hantarTerakhir || null, bilPelanggan: bil, log });
    } catch (err) {
      console.error('GET push/tetapan error:', err);
      res.status(500).json({ error: 'Gagal membaca tetapan notifikasi.' });
    }
  });

  router.patch('/system/push/tetapan', requirePermission('manageEditorial'), async (req, res) => {
    try {
      await pastikanSedia();
      if (typeof req.body?.aktif !== 'boolean') return res.status(400).json({ error: 'Nilai "aktif" mesti benar atau palsu.' });
      await dbRun(`UPDATE push_tetapan SET aktif = ? WHERE id = 'main'`, [req.body.aktif ? 1 : 0]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: req.body.aktif ? 'hidupkan-notifikasi-pembaca' : 'matikan-notifikasi-pembaca',
        targetType: 'push', targetId: 'main', detail: '',
      });
      res.json({ success: true, aktif: req.body.aktif });
    } catch (err) {
      console.error('PATCH push/tetapan error:', err);
      res.status(500).json({ error: 'Gagal menyimpan tetapan notifikasi.' });
    }
  });

  /** Mulakan pengesan berkala. Dipanggil sekali selepas pelayan mendengar. */
  router.mulakanPengesan = () => {
    const pusingan = async () => {
      try {
        const s = await pastikanSedia();
        const hasil = await jalankanSekali({ dbAll, dbGet, dbRun, hantar: s.penghantar, binaLaluan });
        if (hasil.tindakan === 'hantar') {
          console.log(`[Notifikasi] ${hasil.bilCalon} kandungan -> ${hasil.berjaya}/${hasil.penerima} penerima`);
        } else if (/semai/.test(hasil.sebab || '')) {
          console.log(`[Notifikasi] ${hasil.sebab}`);
        }
      } catch (err) {
        console.warn('[Notifikasi] Ralat pengesan:', err?.message);
      }
    };
    setTimeout(pusingan, 45 * 1000);
    setInterval(pusingan, JEDA_PENGESAN_MS);
    console.log(`Pengesan notifikasi pembaca aktif (semak setiap ${JEDA_PENGESAN_MS / 1000} saat).`);
  };

  return router;
}
