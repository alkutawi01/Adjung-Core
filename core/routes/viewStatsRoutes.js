import express from 'express';

// Jejak pengunjung & populariti (Fasa 14) — dibina sendiri, tiada pihak ketiga, tiada cookie,
// tiada IP/user-agent. Kiraan HARIAN sahaja, agregat anonim, dalam jadual `daily_view_counts`
// (server.js). Dua sasaran disokong buat masa ini:
//   - targetType 'homepage', targetId 'utama'  — satu muatan frontpage
//   - targetType 'slot', targetId '<slotIndex 0-based>' — satu pembukaan Focus View bagi slot itu
// Panggilan penjejakan MESTI sentiasa terlepas-pandang (best-effort) — kegagalan di sini tidak
// pernah boleh pecahkan pengalaman pembaca; laluan ini sengaja bertolak-ansur (jarang gagal, dan
// bila gagal, senyap 200/204 di sisi klien fetch()).
const TARGET_TYPES = new Set(['homepage', 'slot']);

function todayStr() {
  // Tarikh tempatan Malaysia (Asia/Kuala_Lumpur), bukan UTC — supaya "kiraan harian" sepadan hari
  // kalendar sebenar pembaca Malaysia, bukan berpecah pada waktu tengah hari MYT (UTC+8).
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find(p => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function createViewStatsRoutes(dbAll, dbRun) {
  const router = express.Router();

  // POST /api/system/track-view { targetType, targetId }
  router.post('/track-view', async (req, res) => {
    try {
      const targetType = String(req.body?.targetType || '');
      const targetId = String(req.body?.targetId ?? '');
      if (!TARGET_TYPES.has(targetType) || !targetId) {
        return res.status(204).end(); // senyap — jangan risaukan klien pengunjung awam
      }
      const date = todayStr();
      await dbRun(
        `INSERT INTO daily_view_counts (date, targetType, targetId, viewCount)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(date, targetType, targetId) DO UPDATE SET viewCount = viewCount + 1`,
        [date, targetType, targetId]
      );
      res.status(204).end();
    } catch (err) {
      console.warn('track-view gagal (diabaikan, tidak kritikal):', err.message);
      res.status(204).end();
    }
  });

  // GET /api/system/view-stats?days=7 — ringkasan untuk Paparan Utama (Dashboard).
  router.get('/view-stats', async (req, res) => {
    try {
      const days = Math.min(30, Math.max(1, parseInt(req.query.days, 10) || 7));
      const date = todayStr();

      const hariIni = await dbAll(
        `SELECT COALESCE(SUM(viewCount), 0) AS jumlah FROM daily_view_counts WHERE date = ? AND targetType = 'homepage'`,
        [date]
      );

      const trenHarian = await dbAll(
        `SELECT date, SUM(viewCount) AS jumlah FROM daily_view_counts
         WHERE targetType = 'homepage' AND date >= date(?, '-' || ? || ' days')
         GROUP BY date ORDER BY date ASC`,
        [date, days - 1]
      );

      const kandunganPalingDiminati = await dbAll(
        `SELECT targetId AS slotIndex, SUM(viewCount) AS jumlah FROM daily_view_counts
         WHERE targetType = 'slot' AND date >= date(?, '-' || ? || ' days')
         GROUP BY targetId ORDER BY jumlah DESC LIMIT 8`,
        [date, days - 1]
      );

      res.json({
        hariIni: hariIni[0]?.jumlah || 0,
        trenHarian: trenHarian.map(r => ({ tarikh: r.date, jumlah: r.jumlah })),
        kandunganPalingDiminati: kandunganPalingDiminati.map(r => ({
          slotIndex: parseInt(r.slotIndex, 10),
          jumlah: r.jumlah,
        })),
      });
    } catch (err) {
      console.warn('view-stats gagal:', err.message);
      res.json({ hariIni: 0, trenHarian: [], kandunganPalingDiminati: [] });
    }
  });

  return router;
}
