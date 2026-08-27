import express from 'express';
import {
  janaKodPendek, slugBidang, adalahUserAgentBot, binaLaluanKandungan, kodDaripadaParamLaluan,
} from '../editorial/UrlSlug.js';
import { janaOgImagePng } from '../editorial/OgImageRenderer.js';

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
    modifiedAt: rev.updatedAt || rev.createdAt || obj.createdAt || '',
    editorName: cari('editorName') || '',
  };
}

const escapeHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Potong ikut sempadan PERKATAAN (2026-08-27, dapatan audit SEO) — `.slice(n)` mentah boleh
// potong tengah perkataan, hasilkan serpihan janggal dalam pratonton carian/perkongsian sosial.
function potongIkutPerkataan(teks, had) {
  const t = String(teks || '').trim();
  if (t.length <= had) return t;
  const dipotong = t.slice(0, had);
  const ruangTerakhir = dipotong.lastIndexOf(' ');
  return `${(ruangTerakhir > had * 0.6 ? dipotong.slice(0, ruangTerakhir) : dipotong).trim()}…`;
}

/** Bina HTML pra-terap ringkas untuk bot — tajuk, meta description, OG, JSON-LD NewsArticle,
 *  teks kandungan boleh dibaca terus (tanpa perlu jalankan JavaScript langsung). Bukan replika
 *  penuh SPA — cukup untuk crawler faham & indeks kandungan sebenar. */
function binaHtmlBot({ kandungan, url, objectId }) {
  const tajuk = escapeHtml(kandungan.title);
  const huraian = escapeHtml(potongIkutPerkataan(kandungan.summary, 155));
  // Fallback ke kad OG DINAMIK per-artikel (2026-08-27, OgImageRenderer.js) bila kandungan sendiri
  // tiada imej terlampir — kebanyakan kandungan Adjung Brief memang tiada imej (portal berasaskan
  // teks). Kad ni papar TAJUK sebenar artikel (bukan kad jenama generik og-image.png lama yang
  // sama untuk SEMUA artikel — dikritik Izzat: "OG yg baik patut buat orang faham 'artikel ini
  // tentang apa' dlm 1-2 saat", yg lama cuma jawab "ini portal apa").
  const gambar = escapeHtml(kandungan.image || `https://brief.adjung.com/api/system/content/${objectId}/og.png`);
  // Dapatan audit SEO 2026-08-27 — DUA pembetulan pada JSON-LD ni:
  //   1. `publisher` dahulu guna kandungan.source (sumber ASAL berita, cth "The Star") — SALAH
  //      dari segi schema.org, `publisher` mesti entiti yang MENERBITKAN artikel di URL ni (Adjung
  //      Brief sendiri), bukan sumber asal. Sumber asal kekal dipaparkan berasingan di badan HTML
  //      (`<p>Sumber: ...</p>` di bawah) — itu cara betul rujuk sumber, bukan medan `publisher`.
  //   2. Tambah `dateModified`, `mainEntityOfPage` dan `author` — medan Google rekomen untuk
  //      kelayakan rich-result penuh, dahulu tiada langsung di laluan BOT ni (versi client-side
  //      seoMeta.ts sudah ada, jadi laluan yang crawler SEBENAR nampak — tanpa perlu jalankan JS —
  //      adalah yang lebih lemah, terbalik daripada keutamaan sepatutnya).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: kandungan.title,
    description: kandungan.summary,
    datePublished: kandungan.publishedAt,
    dateModified: kandungan.modifiedAt || kandungan.publishedAt,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    ...(gambar ? { image: [gambar] } : {}),
    author: kandungan.editorName
      ? { '@type': 'Person', name: kandungan.editorName }
      : { '@type': 'Organization', name: 'Adjung Brief' },
    publisher: {
      '@type': 'Organization',
      name: 'Adjung Brief',
      logo: { '@type': 'ImageObject', url: 'https://brief.adjung.com/og-image.png' },
    },
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
      // Parameter mungkin bawa slug tajuk di hadapan kod ("kapal-karam-rom-x7k2mq") sejak ciri
      // slug SEO ditambah 2026-08-24 — ekstrak 6 aksara kod sebenar dahulu. Selamat utk pautan
      // lama (kod kosong tanpa slug) juga — lihat nota kodDaripadaParamLaluan().
      const kodSebenar = kodDaripadaParamLaluan(req.params.kodPendek);
      const obj = await dbGet('SELECT id, slotIndex FROM editorial_objects WHERE urlKod = ?', [kodSebenar]);
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

  // GET /api/system/content/:objectId/og.png — kad OG dinamik PER-ARTIKEL (2026-08-27,
  // keputusan Izzat menggantikan og-image.png generik lama). Dipanggil oleh binaHtmlBot() di
  // bawah (crawler perkongsian sosial) DAN client (seoMeta.ts, Focus View semasa dibuka oleh
  // pembaca sebenar) — URL SAMA dua-dua tempat supaya crawler & pratonton langsung berlaku sama.
  // PNG dijana atas permintaan (bukan pra-jana/simpan) — kandungan portal ni jarang dikongsi
  // serentak dalam jumlah besar, jana sekali ambil beberapa saat tak jadi kesesakan; Cache-Control
  // biar CDN/pelayar/Facebook cache hasil, elak jana berulang bagi pautan sama yang sama.
  router.get('/system/content/:objectId/og.png', async (req, res) => {
    try {
      const kandungan = await ambilKandunganUntukSeo(dbGet, dbAll, req.params.objectId);
      if (!kandungan) return res.status(404).end();
      const kod = await getOrCreateUrlKod(dbGet, dbRun, req.params.objectId);
      const laluan = binaLaluanKandungan(kandungan.title, kandungan.desk, kod);
      const articleUrl = `${req.protocol}://${req.get('host')}${laluan}`;
      // Ikon Bidang (SVG tersuai ATAU nama ikon lucide-react — lihat selesaikanIkonDataUrl()
      // dalam OgImageRenderer.js, kebanyakan Bidang guna lucide, minoriti ada SVG tersuai) —
      // dibaca "usaha terbaik sahaja"; kegagalan cari kategori tak patut gagalkan seluruh kad OG.
      let iconSvg = null;
      let iconName = null;
      try {
        const kategoriRow = await dbGet('SELECT icon, iconSvg FROM CategoryRegistry WHERE slug = ?', [slugBidang(kandungan.desk)]);
        iconSvg = kategoriRow?.iconSvg || null;
        iconName = kategoriRow?.icon || null;
      } catch { /* ikon pilihan sahaja — kad OG tetap jana tanpanya */ }
      const png = await janaOgImagePng({
        title: kandungan.title, desk: kandungan.desk, articleUrl, topik: kandungan.topik, iconSvg, iconName,
      });
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(png);
    } catch (err) {
      console.error('GET content/og.png error:', err);
      res.status(500).end();
    }
  });

  router.get('/system/content/:objectId/url-kod', async (req, res) => {
    try {
      const obj = await dbGet(
        `SELECT eo.id as id, eo.categoryId as categoryId,
                (SELECT er.title FROM editorial_revisions er WHERE er.objectId = eo.id ORDER BY er.version DESC LIMIT 1) as title
         FROM editorial_objects eo WHERE eo.id = ?`,
        [req.params.objectId]
      );
      if (!obj) return res.status(404).json({ error: 'Kandungan tidak dijumpai.' });
      const kod = await getOrCreateUrlKod(dbGet, dbRun, req.params.objectId);
      res.json({ bidangSlug: slugBidang(obj.categoryId), kodPendek: kod, laluan: binaLaluanKandungan(obj.title, obj.categoryId, kod) });
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
      // Slug tajuk (2026-08-24) ditambah DEPAN kod dalam laluan BAHARU, tapi kod tetap 6 aksara
      // terakhir — ekstrak dahulu supaya carian DB tak pernah bergantung pada slug (yang boleh
      // lapuk/tak padan lepas tajuk disunting, itu okay, cuma kosmetik).
      const kodSebenar = kodDaripadaParamLaluan(req.params.kodPendek);
      const obj = await dbGet(
        `SELECT eo.id as id, eo.categoryId as categoryId,
                (SELECT er.title FROM editorial_revisions er WHERE er.objectId = eo.id ORDER BY er.version DESC LIMIT 1) as title
         FROM editorial_objects eo WHERE eo.urlKod = ?`,
        [kodSebenar]
      );
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

      // Kanonikal 301 ke laluan slug-tajuk (2026-08-24) — konsolidasi sinyal SEO ke SATU URL
      // sahaja per-kandungan (pautan lama tanpa slug, slug lapuk lepas tajuk disunting, atau
      // sesiapa taip terus kod tanpa slug semuanya pulangkan kandungan SAMA tanpa redirect ni,
      // yang enjin carian anggap kandungan pendua di URL berbeza). Redirect utk SEMUA (bot MAHU
      // manusia) — pautan lama terus berfungsi (302 tak perlu, kandungan takkan berpindah lagi
      // lepas kod pertama kali dijana), cuma browser/bot dihantar ke bentuk kanonikal.
      const laluanKanonikal = binaLaluanKandungan(obj.title, obj.categoryId, kodSebenar);
      if (`/${req.params.bidangSlug}/kandungan/${req.params.kodPendek}` !== laluanKanonikal) {
        const suku = req.originalUrl.split('?')[1];
        return res.redirect(301, suku ? `${laluanKanonikal}?${suku}` : laluanKanonikal);
      }

      if (!adalahUserAgentBot(req.headers['user-agent'])) return next(); // Manusia — SPA biasa.

      const kandungan = await ambilKandunganUntukSeo(dbGet, dbAll, obj.id);
      if (!kandungan) return next();

      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send(binaHtmlBot({ kandungan, url, objectId: obj.id }));
    } catch (err) {
      console.error('GET public article route error:', err);
      next(); // Ralat — jatuh balik ke SPA, jangan tunjukkan ralat mentah kepada bot/pengguna.
    }
  });

  return router;
}
