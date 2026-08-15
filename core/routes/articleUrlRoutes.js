import express from 'express';
import { janaKodPendek, slugBidang, adalahUserAgentBot } from '../editorial/UrlSlug.js';

// Skema URL per-kandungan (2026-08-05, Fasa 9 — SEO & penemuan, keputusan Izzat):
//   brief.adjung.com/<bidang-slug>/kandungan/<kod-pendek>
//
// Dua tanggungjawab fail ni:
//   1. GET /api/system/content/:objectId/url-kod — API dalaman (dipanggil klien bila Focus View
//      dibuka) untuk dapatkan/jana kod pendek kanonikal kandungan tu, guna untuk meta URL
//      kanonikal (src/utils/seoMeta.ts) dan pautan kongsi.
//   2. GET /:bidangSlug/kandungan/:kodPendek — laluan AWAM (root, bukan /api) yang crawler/
//      pengguna sebenar cecah. Bot (User-Agent dikenali) dapat HTML pra-terap penuh (tajuk,
//      meta description, OG, JSON-LD, teks boleh baca) — TANPA JavaScript, terus dari pelayan.
//      Pengguna biasa dapat SPA seperti biasa (index.html); laluan client React Router
//      (src/App.tsx) yang uruskan buka Focus View selepas JS dimuatkan.

/** Dapatkan (atau jana kalau belum wujud) kod pendek kanonikal untuk SATU objek editorial.
 *  Jana MALAS (lazy) — bukan setiap kandungan perlu kod serta-merta semasa dicipta, cuma bila
 *  buat kali pertama diminta (Focus View dibuka / bot cecah URL lama sebelum kod wujud lagi). */
export async function getOrCreateUrlKod(dbGet, dbRun, objectId) {
  const obj = await dbGet('SELECT id, urlKod FROM editorial_objects WHERE id = ?', [objectId]);
  if (!obj) return null;
  if (obj.urlKod) return obj.urlKod;

  let kod = null;
  for (let cubaan = 0; cubaan < 20; cubaan += 1) {
    const calon = janaKodPendek();
    // eslint-disable-next-line no-await-in-loop
    const berlanggar = await dbGet('SELECT 1 FROM editorial_objects WHERE urlKod = ?', [calon]);
    if (!berlanggar) { kod = calon; break; }
  }
  if (!kod) {
    // Amat tak berkemungkinan (36^6 ≈ 2.2 bilion kombinasi) — jaring keselamatan sahaja.
    throw new Error('Gagal jana kod URL unik selepas 20 percubaan.');
  }
  // Semak `changes` (2026-08-06, audit "kegagalan senyap") — objek boleh dipadam antara SELECT di
  // atas dan tulisan ni. Tanpa semakan, kita pulangkan kod URL yang tak pernah tersimpan: pautan
  // dikongsi keluar, kemudian membawa ke halaman tiada.
  const hasil = await dbRun('UPDATE editorial_objects SET urlKod = ? WHERE id = ?', [kod, objectId]);
  if (!hasil || hasil.changes === 0) {
    throw new Error('Kandungan tidak dijumpai, kod URL tidak dapat disimpan.');
  }
  return kod;
}

/** Ambil data kandungan (tajuk/huraian/sumber/imej/tarikh/bidang) untuk SATU objectId — versi
 *  ringkas khusus perapan SEO/bot, bukan pipeline PresentationComposer penuh (yang uruskan
 *  carousel/glyph/profil persembahan tak relevan untuk satu artikel tunggal). */
async function ambilKandunganUntukSeo(dbGet, dbAll, objectId) {
  const obj = await dbGet('SELECT * FROM editorial_objects WHERE id = ?', [objectId]);
  if (!obj) return null;
  // "status='approved' ORDER BY version DESC LIMIT 1" alone matches the highest-versioned
  // APPROVED row even when a NEWER row of any status (e.g. archived) exists on top of it — a
  // stale pre-edit approved revision would resurface via this public article page after the
  // object was edited then archived (CONTENT-LIFECYCLE-005C, found 2026-08-13). The NOT EXISTS
  // guard requires this candidate to genuinely be the object's latest revision.
  const rev = await dbGet(
    `SELECT * FROM editorial_revisions er1
     WHERE er1.objectId = ? AND er1.status = 'approved'
       AND NOT EXISTS (SELECT 1 FROM editorial_revisions er2 WHERE er2.objectId = er1.objectId AND er2.version > er1.version)
     ORDER BY er1.version DESC LIMIT 1`,
    [objectId]
  );
  if (!rev) return null;
  const avs = await dbAll('SELECT attributeId, valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ?', [objectId, rev.id]);
  const cari = (id) => (avs.find((a) => a.attributeId === id) || {}).valueText || '';
  return {
    title: rev.title || '',
    summary: cari('briefLong') || rev.summary || '',
    desk: cari('desk') || obj.categoryId || 'Umum',
    topik: cari('topik') || '',
    source: cari('source') || '',
    sourceUrl: cari('url') || '',
    image: cari('image') || '',
    publishedAt: rev.createdAt || obj.createdAt || '',
  };
}

const escapeHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Bina HTML pra-terap ringkas untuk bot — tajuk, meta description, OG, JSON-LD NewsArticle,
 *  teks kandungan boleh dibaca terus (tanpa perlu jalankan JavaScript langsung). Bukan replika
 *  penuh SPA — cukup untuk crawler faham & indeks kandungan sebenar. */
function binaHtmlBot({ kandungan, url }) {
  const tajuk = escapeHtml(kandungan.title);
  const huraian = escapeHtml((kandungan.summary || '').slice(0, 300));
  const gambar = kandungan.image ? escapeHtml(kandungan.image) : '';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: kandungan.title,
    description: kandungan.summary,
    datePublished: kandungan.publishedAt,
    url,
    ...(gambar ? { image: [gambar] } : {}),
    ...(kandungan.source ? { publisher: { '@type': 'Organization', name: kandungan.source } } : {}),
  };
  return `<!DOCTYPE html>
<html lang="ms">
<head>
<meta charset="utf-8" />
<title>${tajuk} — Adjung Brief</title>
<meta name="description" content="${huraian}" />
<link rel="canonical" href="${escapeHtml(url)}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${tajuk}" />
<meta property="og:description" content="${huraian}" />
<meta property="og:url" content="${escapeHtml(url)}" />
${gambar ? `<meta property="og:image" content="${gambar}" />` : ''}
<meta name="twitter:card" content="${gambar ? 'summary_large_image' : 'summary'}" />
<meta name="twitter:title" content="${tajuk}" />
<meta name="twitter:description" content="${huraian}" />
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<article>
<h1>${tajuk}</h1>
<p>${escapeHtml(kandungan.summary)}</p>
${kandungan.source ? `<p>Sumber: ${escapeHtml(kandungan.source)}</p>` : ''}
</article>
</body>
</html>`;
}

export function createArticleUrlRoutes(dbAll, dbGet, dbRun) {
  const router = express.Router();

  // GET /api/system/content/by-kod/:kodPendek — laluan digunakan KLIEN (FrontpageView.tsx,
  // deepLinkKodPendek) bila pembaca mendarat terus pada /:bidangSlug/kandungan/:kodPendek, untuk
  // tahu slot mana nak buka Focus View automatik. Pulangkan `itemIndex: 0` sentiasa (usaha
  // terbaik) — slot dengan carousel berbilang item tiada susunan stabil dipetakan kepada satu
  // objectId tunggal dalam seni bina sedia ada (kandungan manual/RSS bercampur), jadi pembaca
  // mendarat pada SLOT yang betul walaupun mungkin bukan kedudukan carousel tepat kalau sudah
  // berputar. Cukup baik untuk pautan kongsi (kebanyakan slot satu kandungan sahaja).
  //
  // Pulangkan `objectId` SEKALI GUS (2026-08-13, PUBLIC-URL-001) — dahulu cuma `slotIndex`
  // dipulangkan, jadi klien padankan pembaca ikut SLOT sahaja (`focusAllLocations.find(l =>
  // l.slotIndex === data.slotIndex)`). Selepas kandungan asal kodPendek ni diarkib dan slot yang
  // sama diisi kandungan BAHARU, padanan-ikut-slot tu jumpa kandungan baharu itu dan buka ia
  // secara SENYAP di bawah URL lama — pautan kekal/dikongsi/diindeks enjin carian bertukar makna
  // tanpa notis. Slot cuma LOKASI paparan, bukan identiti kandungan; objectId itulah identiti
  // sebenar. Sahkan juga objek ni MASIH approved (guna semula pengesahan "revision terkini
  // sebenar" yang sama seperti resolveSlotContent()/searchRoutes.js, CONTENT-LIFECYCLE-005) —
  // pautan kandungan yang telah diarkib/dipadam kini pulangkan 404 dgn jelas, bukan terus
  // terbuka kandungan lain.
  router.get('/system/content/by-kod/:kodPendek', async (req, res) => {
    try {
      const obj = await dbGet('SELECT id, slotIndex FROM editorial_objects WHERE urlKod = ?', [req.params.kodPendek]);
      if (!obj) return res.status(404).json({ error: 'Kandungan tidak dijumpai.' });
      const revTerkini = await dbGet(
        `SELECT status FROM editorial_revisions er1
         WHERE er1.objectId = ?
           AND NOT EXISTS (SELECT 1 FROM editorial_revisions er2 WHERE er2.objectId = er1.objectId AND er2.version > er1.version)`,
        [obj.id]
      );
      if (!revTerkini || revTerkini.status !== 'approved') {
        return res.status(404).json({ error: 'Kandungan ni tidak lagi tersedia (mungkin diarkib atau dipadam).' });
      }
      res.json({ objectId: obj.id, slotIndex: obj.slotIndex, itemIndex: 0 });
    } catch (err) {
      console.error('GET content/by-kod error:', err);
      res.status(500).json({ error: 'Gagal cari kandungan. ' + err.message });
    }
  });

  router.get('/system/content/:objectId/url-kod', async (req, res) => {
    try {
      const obj = await dbGet('SELECT id, categoryId FROM editorial_objects WHERE id = ?', [req.params.objectId]);
      if (!obj) return res.status(404).json({ error: 'Kandungan tidak dijumpai.' });
      const kod = await getOrCreateUrlKod(dbGet, dbRun, req.params.objectId);
      res.json({ bidangSlug: slugBidang(obj.categoryId), kodPendek: kod, laluan: `/${slugBidang(obj.categoryId)}/kandungan/${kod}` });
    } catch (err) {
      console.error('GET url-kod error:', err);
      res.status(500).json({ error: 'Gagal jana kod URL. ' + err.message });
    }
  });

  return router;
}

/** Laluan AWAM /:bidangSlug/kandungan/:kodPendek — didaftar TERUS pada app (bukan di bawah
 *  /api), sebelum fallback SPA statik di server.js (lihat nota di situ). Mesti dipanggil
 *  berasingan daripada createArticleUrlRoutes() sebab laluan ni root-level, bukan /api/system. */
export function createPublicArticleRoute(dbAll, dbGet) {
  const router = express.Router();

  router.get('/:bidangSlug/kandungan/:kodPendek', async (req, res, next) => {
    try {
      const obj = await dbGet('SELECT id FROM editorial_objects WHERE urlKod = ?', [req.params.kodPendek]);
      if (!obj) {
        // Kod tak dijumpai. Manusia jatuh balik ke SPA (papar 404 bergaya Adjung di klien, status
        // 200 tak jadi masalah sebab pelayar akan render UI 404 sebenar). Bot (tak jalankan JS)
        // sebelum ni turut jatuh balik ke SPA — dpt shell KOSONG dgn status 200 ("soft 404"),
        // audit Launch Gate 2026-08-16 (curl -A Googlebot terus sahkan). Crawler boleh anggap
        // URL kod-lapuk/salah-taip ni kandungan SAH kosong, bukan tiada wujud — risiko diindeks.
        // Bot dapat status 404 SEBENAR di sini terus, sebelum sempat jatuh ke SPA.
        if (adalahUserAgentBot(req.headers['user-agent'])) {
          res.status(404).set('Content-Type', 'text/html; charset=utf-8');
          return res.send('<!DOCTYPE html><html lang="ms"><head><meta charset="utf-8" /><title>Halaman Tidak Dijumpai — Adjung Brief</title></head><body><h1>404 — Halaman Tidak Dijumpai</h1></body></html>');
        }
        return next();
      }

      if (!adalahUserAgentBot(req.headers['user-agent'])) return next(); // Manusia — SPA biasa.

      const kandungan = await ambilKandunganUntukSeo(dbGet, dbAll, obj.id);
      if (!kandungan) return next();

      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send(binaHtmlBot({ kandungan, url }));
    } catch (err) {
      console.error('GET public article route error:', err);
      next(); // Ralat — jatuh balik ke SPA, jangan tunjukkan ralat mentah kepada bot/pengguna.
    }
  });

  return router;
}
