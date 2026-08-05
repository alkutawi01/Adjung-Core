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
      // `latest` mesti dikira HANYA daripada revisi 'approved' (bukan MAX(version) merentasi
      // SEMUA status) — kandungan yang pernah diedit lagi lepas Terbit (edit terbaharu masih
      // 'pending' semakan, atau ditolak/diarkibkan) akan ada version lebih tinggi yang BUKAN
      // approved; join terhadap MAX(version) tanpa syarat status tersalah padan ke revisi bukan
      // approved itu dan pulangkan SIFAR baris walaupun kandungan tu sebenarnya aktif/live.
      // Ditemui semasa ujian langsung ciri ni (2026-08-05) — carian pulangkan kosong untuk
      // tajuk yang disahkan wujud di DB sebelum dibetulkan ke bentuk di bawah.
      const rows = await dbAll(`
        SELECT eo.id as objectId, eo.slotIndex, eo.categoryId, er.title, er.summary,
               (SELECT valueText FROM editorial_attribute_values
                WHERE objectId = eo.id AND revisionId = er.id AND attributeId = 'topik') as topik
        FROM editorial_objects eo
        INNER JOIN editorial_revisions er ON er.objectId = eo.id AND er.status = 'approved'
        INNER JOIN (
          SELECT objectId, MAX(version) as maxVersion FROM editorial_revisions WHERE status = 'approved' GROUP BY objectId
        ) latest ON latest.objectId = er.objectId AND latest.maxVersion = er.version
        WHERE eo.slotIndex >= 0
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
