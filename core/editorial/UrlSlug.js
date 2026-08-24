// Skema URL per-kandungan (2026-08-05, Fasa 9 — SEO & penemuan). Bentuk keputusan Izzat:
// brief.adjung.com/<bidang-slug>/kandungan/<kod-pendek>
//
// `kod-pendek` SENGAJA kod rawak baharu (6 aksara), BUKAN potongan editorial_objects.id sedia
// ada — ID sedia ada (cth "object-manual-slot13-1784594087585-0") berkongsi awalan/akhiran
// panjang antara kandungan dalam slot/kelompok yang sama (timestamp cipta serupa, indeks
// tunggal di hujung), jadi potongan pendek pasti berlanggar kerap. Kod ni dijana berasingan,
// disahkan unik semasa jana (lihat getOrCreateUrlKod di server.js), disimpan dalam
// editorial_objects.urlKod.
export const KOD_PENDEK_PANJANG = 6;
const KOD_ABJAD = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function janaKodPendek() {
  let kod = '';
  for (let i = 0; i < KOD_PENDEK_PANJANG; i++) {
    kod += KOD_ABJAD[Math.floor(Math.random() * KOD_ABJAD.length)];
  }
  return kod;
}

// Slug URL daripada nama Bidang — huruf kecil, buang aksen/diakritik, ganti bukan-alfanumerik
// dengan sengkang. "Al-Quran dan Sunnah" -> "al-quran-dan-sunnah". Bidang kosong/tak diketahui
// jatuh balik ke "umum" (bukan slug kosong, yang akan pecahkan corak laluan /:bidang/kandungan/:kod).
export function slugBidang(bidang) {
  const slug = (bidang || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'umum';
}

// Slug SEO daripada tajuk kandungan (2026-08-24, dapatan Izzat — "setiap kandungan takde slug
// khas kan?"). Ditambah DEPAN kod pendek sedia ada ("kapal-karam-rom-x7k2mq"), BUKAN gantikan —
// kod pendek KEKAL sumber kebenaran identiti (unik, tak pernah berubah walau tajuk disunting).
// Had 70 aksara (dipotong pada sempadan perkataan, bukan tengah-tengah) — tajuk Adjung boleh
// sampai 250 aksara (lihat GeometryConfig.js HERO/MENEGAK), URL sepanjang itu janggal & sesetengah
// platform kongsi memotongnya secara hodoh.
const HAD_SLUG_TAJUK = 70;
export function slugTajuk(tajuk) {
  let slug = (tajuk || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length > HAD_SLUG_TAJUK) {
    slug = slug.slice(0, HAD_SLUG_TAJUK).replace(/-[^-]*$/, '');
  }
  return slug;
}

/** Laluan kanonikal SATU kandungan — SATU tempat, dipakai SEMUA pemanggil (url-kod API,
 *  posterRoutes.js, rssFeedRoutes.js, sitemapRoutes.js) supaya bentuk URL tidak sekali-kali
 *  menyimpang antara laluan (sejarah pepijat projek ni: nombor/penghurai disalin berulang kali
 *  lalu terpesong — lihat CLAUDE.md, 5 salinan had aksara 2026-07-25). Kod pendek KEKAL 6 aksara
 *  terakhir — sengaja, supaya ekstrakKodDaripadaLaluan() (di bawah) selamat guna `.slice(-6)`
 *  tanpa perlu tahu/parse slug tajuk di hadapannya. */
export function binaLaluanKandungan(tajuk, bidang, kod) {
  const ts = slugTajuk(tajuk);
  const bahagianKod = ts ? `${ts}-${kod}` : kod;
  return `/${slugBidang(bidang)}/kandungan/${bahagianKod}`;
}

/** Sebaliknya binaLaluanKandungan() — dapatkan kod pendek SEBENAR (6 aksara) drpd parameter
 *  laluan yang mungkin ada slug tajuk di hadapannya ("kapal-karam-rom-x7k2mq" -> "x7k2mq") ATAU
 *  kod kosong sahaja tanpa slug (pautan lama sebelum ciri ni wujud, "x7k2mq" -> "x7k2mq" —
 *  serasi ke belakang percuma sebab kod SENTIASA 6 aksara terakhir tak kira ada slug atau tidak). */
export function kodDaripadaParamLaluan(param) {
  const p = String(param || '');
  return p.length >= KOD_PENDEK_PANJANG ? p.slice(-KOD_PENDEK_PANJANG) : p;
}

// Senarai bot/crawler dikenali (2026-08-05) — substring User-Agent, huruf kecil. Terhad kepada
// bot enjin carian/pratonton sosial utama sahaja (bukan senarai lengkap sedunia) — cukup untuk
// tujuan "crawler nampak kandungan sebenar", risiko rendah untuk positif-palsu (klasifikasi
// pengguna sebagai bot secara silap) berbanding cuba liputi setiap bot niche yang wujud.
const BOT_UA_PATTERNS = [
  'googlebot', 'bingbot', 'duckduckbot', 'yandexbot', 'baiduspider', 'applebot',
  'facebookexternalhit', 'twitterbot', 'linkedinbot', 'slackbot', 'whatsapp',
  'telegrambot', 'discordbot', 'pinterest',
];

export function adalahUserAgentBot(userAgent) {
  const ua = (userAgent || '').toLowerCase();
  return BOT_UA_PATTERNS.some((p) => ua.includes(p));
}
