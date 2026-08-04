import express from 'express';
import { BRAND } from '../../src/config/brand.ts';
import { getOrCreateUrlKod } from './articleUrlRoutes.js';
import { slugBidang } from '../editorial/UrlSlug.js';

// Fasa 10 — Suapan RSS KELUAR (bukan ingest). Adjung sudah ada mesin ingest RSS penuh
// (core/sources/RssDirectEngine.js membaca suapan LUAR masuk ke rss_ticker_items), tapi tiada
// suapan RSS 2.0 standard yang Adjung sendiri SIARKAN untuk portal/pembaca lain langgan. Route
// ni bina suapan tu — hanya kandungan editorial berstatus 'approved' (= "Aktif", lihat
// src/config/istilah.ts) yang disiarkan, definisi sama seperti ulasan di /api/system/content/all
// ("laluan awam layout/active hanya sentiasa hidangkan baris 'approved'").

// Elak XML pecah bila tajuk/huraian sebenar ada aksara istimewa (&, <, >, kuasa dua, kuasa
// tunggal) — templat-string mentah TIDAK selamat untuk kandungan editorial sebenar.
export const escapeXml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

export const toRfc822 = (isoString) => {
  const d = isoString ? new Date(isoString) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
};

// Fungsi tulen — dipisahkan supaya boleh diuji terus (lihat tests/rssFeed.test.js) tanpa perlu
// akses DB sebenar.
export const buildRssXml = (items, { siteUrl }) => {
  const channelTitle = escapeXml(BRAND.name);
  const channelDesc = escapeXml(BRAND.description);
  const nowRfc822 = toRfc822(new Date().toISOString());

  const itemsXml = items.map((it) => {
    // `link` disediakan oleh pemanggil (kod pendek URL kanonikal sebenar, Fasa 9 2026-08-05) bila
    // ada; jatuh balik ke corak parameter slot/item lama kalau tiada (cth ujian unit fungsi tulen
    // ni tanpa DB — lihat tests/rssFeed.test.js).
    const link = it.link || `${siteUrl}/?slot=${encodeURIComponent(it.slotIndex)}&item=${encodeURIComponent(it.id)}`;
    const guid = `adjung-${it.id}`;
    return `    <item>
      <title>${escapeXml(it.title)}</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(it.summary)}</description>
      <pubDate>${toRfc822(it.createdAt)}</pubDate>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${channelTitle}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${channelDesc}</description>
    <language>ms-MY</language>
    <lastBuildDate>${nowRfc822}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`;
};

const CACHE_TTL_MS = 12 * 60 * 1000; // 12 minit — cukup segar tanpa hentam DB setiap capaian.
let cache = { xml: null, builtAt: 0 };

export function createRssFeedRoutes(dbAll, dbGet, dbRun) {
  const router = express.Router();

  // GET /rss.xml — suapan RSS 2.0 kandungan editorial hidup (approved) Adjung. Laluan awam,
  // tiada auth (tujuannya memang untuk pembaca/portal luar langgan).
  router.get('/rss.xml', async (req, res) => {
    try {
      const now = Date.now();
      if (cache.xml && (now - cache.builtAt) < CACHE_TTL_MS) {
        res.set('Content-Type', 'application/rss+xml; charset=utf-8');
        return res.send(cache.xml);
      }

      const rows = await dbAll(`
        SELECT eo.id as objectId, eo.slotIndex, eo.categoryId, er.title, er.summary, er.createdAt as revisionCreatedAt
        FROM editorial_objects eo
        INNER JOIN editorial_revisions er ON er.objectId = eo.id
        INNER JOIN (
          SELECT objectId, MAX(version) as maxVersion FROM editorial_revisions GROUP BY objectId
        ) latest ON latest.objectId = er.objectId AND latest.maxVersion = er.version
        WHERE er.status = 'approved' AND eo.slotIndex >= 0
        ORDER BY er.createdAt DESC
        LIMIT 50
      `);

      const siteUrl = `${req.protocol}://${req.get('host')}`;
      // Pautan kanonikal sebenar (Fasa 9, 2026-08-05) — skema /:bidangSlug/kandungan/:kodPendek
      // kini wujud, gantikan corak parameter slot/item lama (yang tak boleh dicecah sebagai
      // laluan sebenar).
      const items = [];
      for (const r of rows) {
        // eslint-disable-next-line no-await-in-loop
        const kod = await getOrCreateUrlKod(dbGet, dbRun, r.objectId).catch(() => null);
        items.push({
          id: r.objectId,
          slotIndex: r.slotIndex,
          title: r.title || '',
          summary: r.summary || '',
          createdAt: r.revisionCreatedAt,
          link: kod ? `${siteUrl}/${slugBidang(r.categoryId)}/kandungan/${kod}` : undefined,
        });
      }

      const xml = buildRssXml(items, { siteUrl });

      cache = { xml, builtAt: now };
      res.set('Content-Type', 'application/rss+xml; charset=utf-8');
      res.send(xml);
    } catch (err) {
      console.error('RSS feed generation error:', err);
      res.status(500).set('Content-Type', 'text/plain; charset=utf-8').send('Gagal jana suapan RSS.');
    }
  });

  return router;
}
