// Menjana ikon PNG untuk manifes aplikasi web + notifikasi tolak (2026-10-25).
// Simbol Adjung rasmi = segi empat tegak nisbah 1:2, sudut 0px, maron #802334 (lihat
// public/adjung-symbol.svg dan Sistem Identiti Visual v1.0) — dilukis semula di sini tanpa ubah
// bentuk/nisbah, hanya diletak di tengah kanvas segi empat sama.
//   node scripts/jana-ikon-pwa.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

const akar = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
await initWasm(readFileSync(path.join(akar, 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm')));
const keluar = path.join(akar, 'public', 'icons');
mkdirSync(keluar, { recursive: true });

// `tinggiNisbah` = tinggi simbol sebagai pecahan kanvas. Maskable perlu zon selamat (~80% tengah
// boleh dipotong bulat/squircle oleh OS) jadi simbol dikecilkan.
function svg(saiz, { latar, warna, tinggiNisbah }) {
  const t = saiz * tinggiNisbah;
  const l = t / 2;
  const x = (saiz - l) / 2;
  const y = (saiz - t) / 2;
  const bg = latar ? `<rect width="${saiz}" height="${saiz}" fill="${latar}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${saiz}" height="${saiz}" viewBox="0 0 ${saiz} ${saiz}">${bg}<rect x="${x}" y="${y}" width="${l}" height="${t}" fill="${warna}"/></svg>`;
}
const tulis = (nama, saiz, pilihan) => {
  const png = new Resvg(svg(saiz, pilihan), { fitTo: { mode: 'width', value: saiz } }).render().asPng();
  writeFileSync(path.join(keluar, nama), png);
  console.log(nama, png.length, 'bait');
};

tulis('ikon-192.png', 192, { latar: '#FDFDFD', warna: '#802334', tinggiNisbah: 0.56 });
tulis('ikon-512.png', 512, { latar: '#FDFDFD', warna: '#802334', tinggiNisbah: 0.56 });
tulis('ikon-maskable-512.png', 512, { latar: '#FDFDFD', warna: '#802334', tinggiNisbah: 0.42 });
tulis('apple-touch-icon.png', 180, { latar: '#FDFDFD', warna: '#802334', tinggiNisbah: 0.56 });
// Lencana bar status Android: monokrom putih pada lut sinar (OS mewarnakan sendiri).
tulis('lencana-96.png', 96, { latar: null, warna: '#FFFFFF', tinggiNisbah: 0.7 });
