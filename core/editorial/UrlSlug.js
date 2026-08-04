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
