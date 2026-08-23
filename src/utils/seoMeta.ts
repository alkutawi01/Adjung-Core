// seoMeta.ts (Fasa 9 — SEO & penemuan)
//
// Kemas kini tajuk/meta/OG/Twitter/JSON-LD di <head> secara client-side apabila Focus View
// dibuka. Ini SPA tanpa SSR (lihat PELAN_PRA_LAUNCH.md Fasa 9), jadi ini TIDAK membantu
// crawler yang tidak jalankan JavaScript — tapi ia MEMBANTU:
//   - pratonton perkongsian sosial yang jalankan JS sebelum ambil snapshot (kebanyakan platform
//     moden buat begini bila pautan dikongsi secara langsung dari pelayar, bukan crawler bot)
//   - Googlebot untuk JSON-LD khususnya — Google mengesahkan ia jalankan JS semasa index dan
//     baca structured data selepas render, jadi suntikan JSON-LD ni berkemungkinan berguna
//     walaupun tanpa SSR penuh.
//
// Guna satu fungsi terap() + satu fungsi buangSemula() supaya Focus View boleh panggil terap()
// bila dibuka dan buangSemula() (cleanup useEffect) bila ditutup — pulihkan tajuk/meta laman
// asal, bukan biarkan meta kandungan terakhir tersangkut selepas Focus View ditutup.

const META_NAME_KEYS = ['description', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'] as const;
const META_PROPERTY_KEYS = ['og:type', 'og:title', 'og:description', 'og:image', 'og:url'] as const;
const JSONLD_ID = 'adjung-focus-jsonld';

let originalTitle: string | null = null;
let originalMeta: Record<string, string | null> | null = null;

function getMetaEl(attr: 'name' | 'property', key: string): HTMLMetaElement | null {
  return document.head.querySelector(`meta[${attr}="${key}"]`);
}

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = getMetaEl(attr, key);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

export interface FocusSeoInput {
  title: string;
  description: string;
  imageUrl?: string;
  /** URL kandungan sebenar — kosong apabila tiada skema URL per-kandungan tersedia lagi
   *  (lihat nota "canonical URL" dalam PELAN_PRA_LAUNCH.md Fasa 9). Bila kosong, og:url/
   *  JSON-LD `url` jatuh balik ke URL laman semasa (`window.location.href`). */
  url?: string;
  publishedDate?: string;
  authorName?: string;
  desk?: string;
}

/** Terap meta/JSON-LD kandungan Focus View semasa ke <head>. Simpan nilai asal sekali sahaja
 *  (panggilan pertama) supaya buangSemula() boleh pulihkan meta lalai laman, bukan meta
 *  kandungan sebelumnya kalau pengguna navigasi Sebelum/Seterusnya berkali-kali. */
export function terapFocusSeo(input: FocusSeoInput): void {
  if (typeof document === 'undefined') return;

  if (originalTitle === null) {
    originalTitle = document.title;
    originalMeta = {};
    for (const k of META_NAME_KEYS) originalMeta[`name:${k}`] = getMetaEl('name', k)?.getAttribute('content') ?? null;
    for (const k of META_PROPERTY_KEYS) originalMeta[`property:${k}`] = getMetaEl('property', k)?.getAttribute('content') ?? null;
  }

  const title = input.title.trim() || 'Adjung Brief';
  const description = input.description.trim().slice(0, 300);
  // Fallback ke og-image.png jenama (2026-08-23) — bukan SVG (Facebook/Twitter tak sokong SVG
  // untuk og:image/twitter:image, lihat nota sama di articleUrlRoutes.js binaHtmlBot()). URL
  // MUTLAK, bukan laluan relatif — sepadan sebab di index.html (crawler perkongsian sosial tak
  // selesaikan URL relatif dgn boleh dipercayai).
  const image = input.imageUrl || 'https://brief.adjung.com/og-image.png';
  const url = input.url || window.location.href;

  document.title = `${title} — Adjung Brief`;

  setMeta('name', 'description', description);
  setMeta('property', 'og:type', 'article');
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:image', image);
  setMeta('property', 'og:url', url);
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', image);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    description,
    image: image ? [image] : undefined,
    url,
    datePublished: input.publishedDate || undefined,
    author: input.authorName ? { '@type': 'Person', name: input.authorName } : undefined,
    articleSection: input.desk || undefined,
    publisher: {
      '@type': 'Organization',
      name: 'Adjung Brief',
      logo: { '@type': 'ImageObject', url: '/adjung-symbol.svg' },
    },
  };

  let script = document.getElementById(JSONLD_ID) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = JSONLD_ID;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(jsonLd);
}

/** Pulihkan tajuk/meta laman asal dan buang JSON-LD. Panggil dalam cleanup useEffect Focus
 *  View (bila `focusLoc` jadi null / komponen unmount) — bukan biar meta kandungan terakhir
 *  tersangkut untuk pelawat yang teruskan layar frontpage. */
export function buangSemulaFocusSeo(): void {
  if (typeof document === 'undefined') return;
  if (originalTitle !== null) {
    document.title = originalTitle;
    originalTitle = null;
  }
  if (originalMeta) {
    for (const k of META_NAME_KEYS) {
      const v = originalMeta[`name:${k}`];
      if (v !== null) setMeta('name', k, v as string);
    }
    for (const k of META_PROPERTY_KEYS) {
      const v = originalMeta[`property:${k}`];
      if (v !== null) setMeta('property', k, v as string);
    }
    originalMeta = null;
  }
  const script = document.getElementById(JSONLD_ID);
  if (script) script.remove();
}
