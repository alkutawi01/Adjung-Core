import express from 'express';
import { getOrCreateUrlKod } from './articleUrlRoutes.js';
import { binaLaluanKandungan } from '../editorial/UrlSlug.js';

// sitemapRoutes.js (Fasa 9 — SEO & penemuan)
//
// GET /sitemap.xml — dijana daripada kandungan editorial hidup dalam DB, dicache dalam memori
// (TTL_MS di bawah) supaya crawler yang minta berulang kali tidak pukul DB setiap kali.
//
// 2026-08-05 — skema URL per-kandungan sekarang wujud (/:bidangSlug/kandungan/:kodPendek,
// lihat core/routes/articleUrlRoutes.js, keputusan Izzat), jadi sitemap kini senaraikan SETIAP
// kandungan hidup dengan URL sebenar yang boleh dicecah (bukan cuma halaman depan macam
// sebelum ni). getOrCreateUrlKod() jana kod pendek malas (kalau belum wujud) semasa sitemap
// dijana — pertama kali sahaja perlahan sikit (bilangan kandungan × pertanyaan DB), keputusan
// dicache TTL_MS seperti biasa selepas itu.

const TTL_MS = 15 * 60 * 1000; // 15 minit
let cache = { xml: null, expiresAt: 0 };

export function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Fungsi tulen (boleh diuji tanpa Express/DB) — bina XML sitemap daripada senarai URL. */
export function buildSitemapXml(urls) {
  const body = (urls || [])
    .map((u) => {
      const parts = [`    <loc>${escapeXml(u.loc)}</loc>`];
      if (u.lastmod) parts.push(`    <lastmod>${escapeXml(u.lastmod)}</lastmod>`);
      if (u.changefreq) parts.push(`    <changefreq>${escapeXml(u.changefreq)}</changefreq>`);
      if (u.priority !== undefined) parts.push(`    <priority>${u.priority}</priority>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function createSitemapRoutes(dbAll, dbGet, dbRun) {
  const router = express.Router();

  router.get('/sitemap.xml', async (req, res) => {
    try {
      const now = Date.now();
      if (cache.xml && cache.expiresAt > now) {
        res.set('Content-Type', 'application/xml; charset=utf-8');
        return res.send(cache.xml);
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;

      // Kandungan hidup (status 'approved', versi terkini per objek), tak termasuk Ticker
      // (slotIndex -1, tiada laluan URL sendiri — lihat nota EAV Ticker di server.js).
      // eo.categoryId dibekukan pada MASA PENCIPTAAN objek — Bidang sebenar boleh ditukar
      // kemudian (contentRoutes.js PATCH /content/:id, medan `desk`) tanpa sekali-kali mengemas
      // kini eo.categoryId (corak sama seperti articleUrlRoutes.js/rssFeedRoutes.js — lihat nota
      // "AUAT-003"/bidangSebelum di contentRoutes.js). Sitemap ni sebelum ni bina <loc> terus atas
      // eo.categoryId BEKU — kandungan yang Bidangnya ditukar selepas terbit disenaraikan dgn URL
      // segmen Bidang LAMA, bercanggah dgn rel=canonical/og:url sebenar halaman tu (crawler
      // Google indeks URL 404/redirect-chain, bukan URL sebenar) — dapatan bug-hunt 2026-09-08,
      // vein sama yang dah dibaiki 5 kali di 2 fail lain. Dibaiki: sertakan atribut 'desk' revisi
      // terkini, guna itu dahulu (fallback categoryId hanya utk objek lama tiada atribut desk).
      const rows = await dbAll(`
        SELECT eo.id, eo.categoryId, er.createdAt, er.title,
               (SELECT av.valueText FROM editorial_attribute_values av
                WHERE av.objectId = eo.id AND av.revisionId = er.id AND av.attributeId = 'desk') as deskLive
        FROM editorial_objects eo
        INNER JOIN editorial_revisions er ON er.objectId = eo.id
        INNER JOIN (
          SELECT objectId, MAX(version) as maxVersion FROM editorial_revisions GROUP BY objectId
        ) latest ON latest.objectId = er.objectId AND latest.maxVersion = er.version
        WHERE er.status = 'approved' AND eo.slotIndex >= 0
      `).catch(() => []);

      const urls = [
        // lastmod ditambah (2026-08-27, dapatan audit SEO) — frontpage berubah setiap kali mana-
        // mana slot diterbit/dikemas kini, jadi "sekarang" ialah anggaran yang munasabah (tiada
        // satu cap masa "kemas kini terakhir" tersendiri untuk halaman komposit macam ni).
        { loc: `${baseUrl}/`, lastmod: new Date().toISOString().slice(0, 10), changefreq: 'hourly', priority: '1.0' },
      ];
      for (const row of rows) {
        // eslint-disable-next-line no-await-in-loop
        const kod = await getOrCreateUrlKod(dbGet, dbRun, row.id).catch(() => null);
        if (!kod) continue; // Jana gagal (amat jarang) — lompat entri ni, jangan pecahkan sitemap.
        urls.push({
          loc: `${baseUrl}${binaLaluanKandungan(row.title, row.deskLive || row.categoryId, kod)}`,
          lastmod: row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : undefined,
          changefreq: 'weekly',
          priority: '0.7',
        });
      }

      const xml = buildSitemapXml(urls);
      cache = { xml, expiresAt: now + TTL_MS };
      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.send(xml);
    } catch (err) {
      res.status(500).json({ error: 'Gagal jana sitemap. ' + (err.message || '') });
    }
  });

  return router;
}
