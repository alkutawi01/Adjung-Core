import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getOrCreateUrlKod } from './articleUrlRoutes.js';
import { slugBidang } from '../editorial/UrlSlug.js';
import CategoryRegistry from '../category/CategoryRegistry.js';

// posterRoutes.js (2026-08-23, permintaan Izzat — "reka poster yg boleh dijana automatik oleh
// sistem utk memasukkan 5 kandungan ... terbaharu utk media sosial"). Skop dikunci selepas
// tanya balik: muat turun MANUAL sahaja (editor klik butang di Editorium, dia pos sendiri ke
// media sosial — BUKAN OG image dinamik automatik), 5 kandungan TERBAHARU sahaja (tiada UI
// "tanda sebagai pilihan" tambahan), segi empat 1080x1080. Poster itu sendiri dilukis client-side
// (Canvas, lihat PosterGenerator.tsx) — laluan ni cuma bekalkan DATA 5 kandungan (tajuk, Bidang +
// warnanya, URL kanonikal), bukan imej siap.

export function createPosterRoutes(db, dbAll, dbGet, dbRun) {
  const router = express.Router();

  router.get('/system/poster/latest', requireAuth, async (req, res) => {
    try {
      // Kandungan hidup (revisi TERKINI SEBENAR approved) — corak sama persis searchRoutes.js
      // (MAX(version) merentasi semua status, papar HANYA jika revisi terkini tu approved).
      // Ticker (slotIndex -1) dikecualikan — sama seperti sitemap/rss, bukan kandungan boleh
      // dibuka di Focus View / ada URL sendiri.
      const rows = await dbAll(`
        SELECT eo.id as objectId, eo.categoryId, er.id as revisionId, er.title, er.summary, er.createdAt
        FROM editorial_objects eo
        INNER JOIN editorial_revisions er ON er.objectId = eo.id
        INNER JOIN (
          SELECT objectId, MAX(version) as maxVersion FROM editorial_revisions GROUP BY objectId
        ) latest ON latest.objectId = er.objectId AND latest.maxVersion = er.version
        WHERE eo.slotIndex >= 0 AND er.status = 'approved'
        ORDER BY er.createdAt DESC
        LIMIT 5
      `);

      const items = [];
      for (const r of rows) {
        const kodPendek = await getOrCreateUrlKod(dbGet, dbRun, r.objectId).catch(() => null);
        const warna = await CategoryRegistry.getCategoryColor(db, r.categoryId || 'Umum');
        items.push({
          objectId: r.objectId,
          title: r.title || '',
          // Konteks satu-baris di bawah tajuk (2026-08-24, dapatan Izzat — "pembaca tidak tahu
          // kenapa artikel itu penting") — guna huraian ringkas sedia ada (bukan medan baharu),
          // dipangkas ke SATU baris oleh PosterGenerator.tsx sendiri (bukan di sini — lebar
          // sebenar bergantung fon/kanvas, elak pangkas dua kali dgn nombor berbeza).
          summary: r.summary || '',
          desk: r.categoryId || 'Umum',
          warna,
          url: kodPendek ? `https://brief.adjung.com/${slugBidang(r.categoryId || 'Umum')}/kandungan/${kodPendek}` : 'https://brief.adjung.com/',
        });
      }
      res.json({ items });
    } catch (err) {
      console.error('GET /system/poster/latest error:', err);
      res.status(500).json({ error: 'Gagal mendapatkan kandungan terbaharu utk poster. ' + err.message });
    }
  });

  return router;
}
