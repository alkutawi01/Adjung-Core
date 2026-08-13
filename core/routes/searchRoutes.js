import express from 'express';

// Fasa 11 — Carian pengunjung (2026-08-05, keputusan Izzat: carian ringkas tajuk/topik).
// Laluan AWAM, tiada auth (pembaca portal, bukan Editorium) — carian ikut tajuk/huraian/topik
// kandungan berstatus 'approved' sahaja (definisi sama seperti /api/system/content/all dan
// rss.xml — "laluan awam layout/active hanya sentiasa hidangkan baris approved"). Ticker
// (slotIndex -1) dikecualikan, sama seperti sitemap/rss — bukan kandungan boleh dibuka di
// Focus View.

export function createSearchRoutes(dbAll) {
  const router = express.Router();

  router.get('/system/search', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (q.length < 2) {
        return res.json({ results: [] });
      }
      const like = `%${q}%`;
      // `latest` mesti dikira daripada MAX(version) MERENTASI SEMUA status (bukan hanya di
      // kalangan revisi 'approved') — join tadi (sebelum 2026-08-13) cari revisi berversi
      // tertinggi DALAM KALANGAN yang approved sahaja, jadi bila kandungan diedit lagi lepas
      // terbit lalu diarkib, revisi approved LAMA (yang dah digantikan) tetap sepadan syarat tu
      // dan terus terpapar dalam carian awam — CONTENT-LIFECYCLE-005B, ditemui 2026-08-13 semasa
      // simulasi #41 (kandungan archived kekal boleh dijumpai pembaca melalui carian). Baris asal
      // 2026-08-05 (join thd MAX(version) WHERE status='approved') sendiri fix bug bertentangan
      // (carian kosong sebab edit terbaharu belum approved dianggap versi "terkini") — bentuk di
      // bawah selesaikan KEDUA-DUA arah serentak: cari revisi TERKINI SEBENAR (version tertinggi
      // tanpa syarat status), papar HANYA jika revisi terkini SEBENAR itu approved.
      const rows = await dbAll(`
        SELECT eo.id as objectId, eo.slotIndex, eo.categoryId, er.title, er.summary,
               (SELECT valueText FROM editorial_attribute_values
                WHERE objectId = eo.id AND revisionId = er.id AND attributeId = 'topik') as topik
        FROM editorial_objects eo
        INNER JOIN editorial_revisions er ON er.objectId = eo.id
        INNER JOIN (
          SELECT objectId, MAX(version) as maxVersion FROM editorial_revisions GROUP BY objectId
        ) latest ON latest.objectId = er.objectId AND latest.maxVersion = er.version
        WHERE eo.slotIndex >= 0
          AND er.status = 'approved'
          AND (
            er.title LIKE ? OR er.summary LIKE ?
            OR EXISTS (
              SELECT 1 FROM editorial_attribute_values av
              WHERE av.objectId = eo.id AND av.revisionId = er.id AND av.attributeId = 'topik' AND av.valueText LIKE ?
            )
          )
        ORDER BY er.createdAt DESC
        LIMIT 20
      `, [like, like, like]);

      const results = rows.map((r) => ({
        objectId: r.objectId,
        slotIndex: r.slotIndex,
        title: r.title || '',
        summary: (r.summary || '').slice(0, 140),
        desk: r.categoryId || '',
        topik: r.topik || '',
      }));
      res.json({ results });
    } catch (err) {
      console.error('GET /system/search error:', err);
      res.status(500).json({ error: 'Gagal mencari kandungan. ' + err.message });
    }
  });

  return router;
}
