// OgImageRenderer.js (2026-08-27) — kad OG dinamik PER-ARTIKEL, keputusan Izzat selepas kad
// generik lama (satu og-image.png untuk SEMUA artikel, QR besar tak bernilai, tajuk artikel
// langsung tak kelihatan dalam imej) dikritik: "OG yang baik patut membuat orang faham 'artikel
// ini tentang apa?' dalam 1-2 saat". Tiada foto per-artikel (portal berasaskan teks, dasar projek
// larang AI jana gambar) — jadi kad ni fokus tajuk BESAR (bukan jenama besar), kategori, QR KECIL
// (kekal atas permintaan Izzat, tapi kini enkod URL ARTIKEL sebenar, bukan URL portal generik
// statik macam dahulu — QR jadi berguna, bukan hiasan).
//
// satori (JSX->SVG, css flexbox) + @resvg/resvg-wasm (SVG->PNG raster) — kedua-duanya WASM/JS
// tulen, TIADA native binding perlu dikompil (elak kerapuhan deploy sharp/canvas Node, sama
// falsafah seperti PosterGenerator.tsx).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import QRCode from 'qrcode';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as LucideIcons from 'lucide-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, '..', 'assets', 'fonts');

const MAROON = '#802334';
const CREAM = '#F7F4EC';

let wasmSedia = null;
function pastikanWasm() {
  if (!wasmSedia) {
    const wasmPath = path.join(
      __dirname, '..', '..', 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'
    );
    wasmSedia = initWasm(readFileSync(wasmPath));
  }
  return wasmSedia;
}

let fontDataCache = null;
function muatFont() {
  if (!fontDataCache) {
    fontDataCache = {
      serifBold: readFileSync(path.join(FONTS_DIR, 'SourceSerif4-Bold.ttf')),
      monoMedium: readFileSync(path.join(FONTS_DIR, 'JetBrainsMono-Medium.ttf')),
      monoBold: readFileSync(path.join(FONTS_DIR, 'JetBrainsMono-Bold.ttf')),
    };
  }
  return fontDataCache;
}

/** Bungkus tajuk maks 3 baris (satori tak sokong -webkit-line-clamp dalam SVG raster, jadi
 *  potong secara program sebelum hantar ke satori — anggaran aksara/baris pada saiz fon 56px,
 *  lebar kandungan ~980px). Konservatif (~24 aksara/baris) supaya tak overflow kad. */
function potongTajukBaris3(tajuk) {
  const MAKS_AKSARA = 82; // ~3 baris x ~27 aksara/baris pada 56px serif tebal
  if (tajuk.length <= MAKS_AKSARA) return tajuk;
  let t = tajuk.slice(0, MAKS_AKSARA);
  const ruangTerakhir = t.lastIndexOf(' ');
  if (ruangTerakhir > 40) t = t.slice(0, ruangTerakhir);
  return `${t}…`;
}

/** Selesaikan ikon Bidang jadi data URI SVG. DUA sumber mungkin (lihat CategoryRegistry.js):
 *  `iconSvg` (SVG tersuai — minoriti Bidang sahaja) diutamakan bila wujud; jatuh balik ke `icon`
 *  (nama komponen lucide-react, cth "Star" — kebanyakan Bidang guna ini) dirender ke markah SVG
 *  statik terus di pelayan (react-dom/server), sepadan warna maroon kad. Pulangkan null kalau
 *  dua-dua tiada/nama tak dikenali — ikon SENTIASA pilihan, tak patut gagalkan kad OG. */
function selesaikanIkonDataUrl({ iconSvg, iconName }) {
  if (iconSvg) return `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`;
  if (iconName && LucideIcons[iconName]) {
    const markah = renderToStaticMarkup(
      React.createElement(LucideIcons[iconName], { color: MAROON, size: 24, strokeWidth: 2.25 })
    );
    return `data:image/svg+xml;base64,${Buffer.from(markah).toString('base64')}`;
  }
  return null;
}

/** Jana PNG kad OG 1200x630 untuk SATU artikel. `desk` = nama kategori (cth "Teknologi"),
 *  `title` = tajuk penuh (dipotong 3 baris di sini), `articleUrl` = URL kanonikal artikel
 *  (dienkod terus ke QR — QR ni kini bawa pembaca KE ARTIKEL, bukan ke portal generik).
 *  `topik` = label ringkas kandungan (medan "Topik" sedia ada, cth "QS Ranking 2026") — konteks
 *  tambahan antara kategori dan tajuk (dapatan Izzat 2026-08-27). `iconSvg`/`iconName` = ikon
 *  Bidang (lihat selesaikanIkonDataUrl di atas) — kedua-dua Bidang DAN ikon dipaparkan bersama
 *  (dapatan Izzat), bukan salah satu sahaja. */
export async function janaOgImagePng({ title, desk, articleUrl, topik, iconSvg, iconName }) {
  await pastikanWasm();
  const font = muatFont();

  const qrDataUrl = await QRCode.toDataURL(articleUrl, {
    margin: 0,
    width: 240,
    color: { dark: MAROON, light: '#00000000' },
  });

  const tajukDipotong = potongTajukBaris3(String(title || '').trim());
  const kategori = String(desk || 'Umum').toUpperCase();
  const topikBersih = String(topik || '').trim();
  const ikonDataUrl = selesaikanIkonDataUrl({ iconSvg, iconName });

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: CREAM,
          padding: '72px',
          fontFamily: 'Source Serif 4',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' },
              children: [
                // Eyebrow kategori (+ ikon Bidang tersuai bila wujud) — label kecil, aksen
                // maroon, atas sekali (bukan jenama).
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      fontFamily: 'JetBrains Mono',
                      fontWeight: 700,
                      fontSize: '20px',
                      letterSpacing: '3px',
                      color: MAROON,
                    },
                    children: [
                      ...(ikonDataUrl
                        ? [{ type: 'img', props: { src: ikonDataUrl, width: 24, height: 24, style: { marginRight: '12px' } } }]
                        : []),
                      { type: 'span', props: { children: kategori } },
                    ],
                  },
                },
                // Topik — konteks ringkas antara kategori dan tajuk (medan "Topik" sedia ada).
                ...(topikBersih
                  ? [{
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          fontFamily: 'JetBrains Mono',
                          fontWeight: 500,
                          fontSize: '16px',
                          color: '#78716C',
                          marginTop: '14px',
                        },
                        children: topikBersih,
                      },
                    }]
                  : []),
              ],
            },
          },
          // Tajuk — elemen DOMINAN kad, bukan wordmark jenama (dapatan Izzat/codex: artikel
          // sebagai hero, bukan jenama).
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                fontFamily: 'Source Serif 4',
                fontWeight: 700,
                fontSize: '58px',
                lineHeight: 1.22,
                color: '#1C1917',
                maxWidth: '980px',
              },
              children: tajukDipotong,
            },
          },
          // Baris bawah — jenama KECIL kiri, QR KECIL kanan (kekal atas permintaan Izzat, tapi
          // enkod URL artikel sebenar — utiliti sebenar, bukan hiasan besar macam kad lama).
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'column' },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            fontFamily: 'Source Serif 4',
                            fontWeight: 700,
                            fontSize: '26px',
                            color: MAROON,
                          },
                          children: 'Adjung Brief',
                        },
                      },
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            fontFamily: 'JetBrains Mono',
                            fontWeight: 500,
                            fontSize: '15px',
                            color: '#78716C',
                            marginTop: '4px',
                          },
                          children: 'brief.adjung.com',
                        },
                      },
                    ],
                  },
                },
                {
                  type: 'img',
                  props: {
                    src: qrDataUrl,
                    width: 100,
                    height: 100,
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Source Serif 4', data: font.serifBold, weight: 700, style: 'normal' },
        { name: 'JetBrains Mono', data: font.monoMedium, weight: 500, style: 'normal' },
        { name: 'JetBrains Mono', data: font.monoBold, weight: 700, style: 'normal' },
      ],
    }
  );

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  const png = resvg.render();
  return Buffer.from(png.asPng());
}

export default { janaOgImagePng };
