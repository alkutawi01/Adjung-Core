import test from 'node:test';
import assert from 'node:assert/strict';
import { binaHtmlBot } from '../core/routes/articleUrlRoutes.js';

// Regresi 2026-09-08 — dapatan bug-hunt: binaHtmlBot() (HTML pra-terap yang Googlebot/Facebook/
// Twitter SEBENAR baca, tiada JavaScript dijalankan) hantar title/summary MENTAH (asterisk
// */**/gloss:id) ke meta description, og:description, twitter:description, JSON-LD, dan badan
// HTML — corak SAMA seperti bug SEO-meta (FocusView.tsx, dibaiki) dan RSS feed (buildRssXml(),
// dibaiki) tapi laluan ni PALING TERUK sebab crawler sebenar tiada JS untuk urai sintaks tu.
// Kandungan ujian ni ditiru daripada rekod SEBENAR dalam DB (objectId
// object-manual-slot28-1787054404767-0, "Instagram ... *wordmark* baharu").

const kandunganUjian = {
  title: 'Instagram perkenal *logo* baharu selepas sedekad',
  summary: 'Instagram memperkenalkan *wordmark* baharu. [Lihat](gloss:123) juga contoh **penuh**.',
  desk: 'SENI VISUAL',
  source: 'The Star',
  image: '',
  publishedAt: '2026-09-01T00:00:00.000Z',
  modifiedAt: '2026-09-01T00:00:00.000Z',
  editorName: '',
};

test('binaHtmlBot - strips markdown syntax from title/summary in every bot-facing field', () => {
  const html = binaHtmlBot({
    kandungan: kandunganUjian,
    url: 'https://brief.adjung.com/seni-visual/kandungan/abc123',
    objectId: 'object-manual-slot28-1787054404767-0',
  });

  // Tiada asterisk mentah atau sintaks `[label](gloss:...)` di mana-mana bahagian output.
  assert.doesNotMatch(html, /\*/);
  assert.doesNotMatch(html, /gloss:/);
  assert.doesNotMatch(html, /\[Lihat\]/);

  // Tajuk (<title>, og:title, twitter:title, <h1>) bersih.
  assert.match(html, /<title>Instagram perkenal logo baharu selepas sedekad — Adjung Brief<\/title>/);
  assert.match(html, /<meta property="og:title" content="Instagram perkenal logo baharu selepas sedekad" \/>/);
  assert.match(html, /<meta name="twitter:title" content="Instagram perkenal logo baharu selepas sedekad" \/>/);
  assert.match(html, /<h1>Instagram perkenal logo baharu selepas sedekad<\/h1>/);

  // Huraian (meta description, og:description, twitter:description) bersih.
  assert.match(html, /<meta name="description" content="Instagram memperkenalkan wordmark baharu\. Lihat juga contoh penuh\."/);
  assert.match(html, /<meta property="og:description" content="Instagram memperkenalkan wordmark baharu\. Lihat juga contoh penuh\."/);
  assert.match(html, /<meta name="twitter:description" content="Instagram memperkenalkan wordmark baharu\. Lihat juga contoh penuh\."/);

  // Badan boleh-baca (<p>) bersih.
  assert.match(html, /<p>Instagram memperkenalkan wordmark baharu\. Lihat juga contoh penuh\.<\/p>/);

  // JSON-LD (headline + description) bersih.
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(jsonLdMatch, 'JSON-LD block should exist');
  const jsonLd = JSON.parse(jsonLdMatch[1]);
  assert.equal(jsonLd.headline, 'Instagram perkenal logo baharu selepas sedekad');
  assert.equal(jsonLd.description, 'Instagram memperkenalkan wordmark baharu. Lihat juga contoh penuh.');
});

test('binaHtmlBot - still HTML-escapes unsafe characters after markdown is stripped', () => {
  const html = binaHtmlBot({
    kandungan: {
      ...kandunganUjian,
      title: 'Untung & Rugi <Analisis>',
      summary: 'Dia kata "hebat" & \'ringkas\'',
    },
    url: 'https://brief.adjung.com/seni-visual/kandungan/abc123',
    objectId: 'obj-2',
  });
  assert.match(html, /<title>Untung &amp; Rugi &lt;Analisis&gt; — Adjung Brief<\/title>/);
  assert.match(html, /<h1>Untung &amp; Rugi &lt;Analisis&gt;<\/h1>/);
  // JSON-LD is a separate serialization context (valid JSON inside <script>, not HTML-escaped —
  // pre-existing, correct behaviour) so only the HTML-rendered fields are checked for escaping.
});

// Regresi 2026-09-08 — dapatan bug-hunt: JSON.stringify(jsonLd) mentah disisip terus dalam
// <script type="application/ld+json"> TANPA escape "</" — tajuk/huraian editorial yang mengandungi
// rentetan literal "</script>" (cth kandungan yang bincang/petik tag HTML) menutup blok JSON-LD
// lebih awal, dan apa-apa selepasnya terbit sebagai HTML/skrip SEBENAR pada halaman pra-terap bot
// ni (tiada JS/sanitizer pihak pembaca). Disahkan reproduce sebelum fix: `<script>alert(1)</script>`
// dalam tajuk terbit sebagai elemen HTML tulen, bukan teks JSON. Dibaiki (jsonLdKeSkripAman() —
// escape "<" jadi <, JSON.parse() pembaca tak terjejas).
test('binaHtmlBot - "</script>" literal dalam tajuk tidak menutup blok JSON-LD lebih awal', () => {
  const html = binaHtmlBot({
    kandungan: {
      ...kandunganUjian,
      title: 'Serangan </script><script>alert(1)</script> ujian',
      summary: 'ringkasan biasa',
    },
    url: 'https://brief.adjung.com/seni-visual/kandungan/abc123',
    objectId: 'obj-3',
  });

  // Tiada elemen <script> HTML tulen tambahan disisip (selain SATU blok JSON-LD asal).
  const bilanganTagScript = (html.match(/<script[ >]/g) || []).length;
  assert.equal(bilanganTagScript, 1, 'hanya SATU tag <script> (JSON-LD) patut wujud, bukan skrip terinjeksi');

  // <h1> (HTML-escaped) papar tajuk penuh yang selamat, BUKAN dipotong pada "</script>" pertama.
  assert.match(html, /<h1>Serangan &lt;\/script&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt; ujian<\/h1>/);

  // Blok JSON-LD tetap JSON sah dan headline penuh terpulih tepat selepas JSON.parse().
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(jsonLdMatch, 'JSON-LD block should exist and parse as valid JSON');
  const jsonLd = JSON.parse(jsonLdMatch[1]);
  assert.equal(jsonLd.headline, 'Serangan </script><script>alert(1)</script> ujian');
});
