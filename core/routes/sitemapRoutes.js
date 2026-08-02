import express from 'express';

// sitemapRoutes.js (Fasa 9 — SEO & penemuan)
//
// GET /sitemap.xml — dijana daripada kandungan editorial hidup dalam DB, dicache dalam memori
// (TTL_MS di bawah) supaya crawler yang minta berulang kali tidak pukul DB setiap kali.
//
// NOTA PENTING — kekurangan skema URL per-kandungan: aplikasi ni SPA (React Router) yang buka
// kandungan sebagai overlay Focus View (state client-side `focusLoc`, lihat FrontpageView.tsx),
// BUKAN laluan URL (`/artikel/:slug` atau serupa). `generateCanonicalUrl()` di src/utils.tsx
// wujud tapi TIDAK disambungkan kepada penghalaan sebenar — ia jana URL subdomain-per-penulis
// rekaan (`https://<penname>.Adjung.com/...`) yang tidak wujud sebagai laluan React Router. Jadi
// sitemap ni HANYA senaraikan halaman depan buat masa ini — menambah entri per-kandungan dengan
// URL yang tidak boleh dicapai lebih teruk daripada tiada entri langsung (pautan mati dalam
// sitemap menjejaskan kredibiliti seluruh sitemap pada crawler). Bila skema URL per-kandungan
// sebenar diputuskan (keputusan penghalaan, bukan untuk agent putuskan sendiri — lihat
// PELAN_PRA_LAUNCH.md Fasa 9), sambung query kandungan hidup di bawah kepada entri <url> baharu.

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

export function createSitemapRoutes(dbAll) {
  const router = express.Router();

  router.get('/sitemap.xml', async (req, res) => {
    try {
      const now = Date.now();
      if (cache.xml && cache.expiresAt > now) {
        res.set('Content-Type', 'application/xml; charset=utf-8');
        return res.send(cache.xml);
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;

      // Kandungan hidup (status 'approved', versi terkini per objek) — diambil supaya cache DB
      // sedia untuk disambung kepada entri <url> sebenar bila skema laluan per-kandungan wujud
      // (lihat nota di atas). Tidak digunakan untuk jana entri sitemap buat masa ini.
      await dbAll(`
        SELECT eo.id
        FROM editorial_objects eo
        INNER JOIN editorial_revisions er ON er.objectId = eo.id
        INNER JOIN (
          SELECT objectId, MAX(version) as maxVersion FROM editorial_revisions GROUP BY objectId
        ) latest ON latest.objectId = er.objectId AND latest.maxVersion = er.version
        WHERE er.status = 'approved'
      `).catch(() => []);

      const urls = [
        { loc: `${baseUrl}/`, changefreq: 'hourly', priority: '1.0' },
      ];

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
