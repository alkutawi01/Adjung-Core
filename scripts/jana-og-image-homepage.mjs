// jana-og-image-homepage.mjs — jana public/og-image.png (kad OG statik utk homepage) guna
// OgImageRenderer.js SEDIA ADA (renderer per-artikel 2026-08-27), bukan reka bentuk baharu
// berasingan. Elak dua sumber kebenaran reka bentuk OG (poster lama QR besar dibuang terus).
import { writeFileSync } from 'fs';
import { janaOgImagePng } from '../core/editorial/OgImageRenderer.js';

const png = await janaOgImagePng({
  title: 'Portal berita dan ilmu bahasa Melayu bergaya majalah ilmiah',
  desk: 'Adjung Brief',
  articleUrl: 'https://brief.adjung.com/',
  topik: 'Berita, ilmu dan kebudayaan disunting oleh pasukan editorial',
});

writeFileSync(new URL('../public/og-image.png', import.meta.url), png);
console.log('og-image.png dijana:', png.length, 'bait');
