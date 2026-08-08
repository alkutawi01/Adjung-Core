// Skrip pembetulan sekali jalan (2026-08-06) — ikon SVG custom Bidang yang diupload SEBELUM fix
// currentColor (commit 94a19b0) tersimpan dengan warna literal (cth hitam), bukan currentColor.
// Fix di categoryRoutes.js cuma terpakai untuk muat naik BAHARU — skrip ni proses balik ikon
// yang DAH tersimpan supaya turut ikut warna Bidang tanpa perlu upload semula manual.
//
// Jalankan SEKALI di server (bukan tempatan — data sebenar ada di production adjung.db):
//   node scratch/baiki-warna-ikon-bidang.js
//
// SELAMAT untuk jalan berkali-kali (idempotent) — currentColor/none/transparent/inherit/url(#...)
// dikekalkan tanpa diubah, jadi ikon yang dah betul tak disentuh semula.

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'adjung.db');
const db = new sqlite3.Database(dbPath);

const KEKAL_WARNA = /^(?:none|transparent|inherit|currentColor|url\()/i;
function tukarWarnaKepadaCurrentColor(svg) {
  let warnaDitukar = 0;
  let hasil = svg.replace(/\s(fill|stroke|stop-color)\s*=\s*"([^"]*)"/gi, (padanan, atribut, nilai) => {
    if (KEKAL_WARNA.test(nilai.trim())) return padanan;
    warnaDitukar++;
    return ` ${atribut}="currentColor"`;
  });
  const akhirTagAkar = hasil.indexOf('>');
  const tagAkar = hasil.slice(0, akhirTagAkar + 1);
  if (!/\sfill\s*=/i.test(tagAkar)) {
    hasil = tagAkar.replace(/^<svg/i, '<svg fill="currentColor"') + hasil.slice(akhirTagAkar + 1);
    warnaDitukar++;
  }
  return { svg: hasil, warnaDitukar };
}

db.all("SELECT id, name, iconSvg FROM CategoryRegistry WHERE iconSvg IS NOT NULL AND TRIM(iconSvg) != ''", (err, rows) => {
  if (err) {
    console.error('Gagal baca CategoryRegistry:', err.message);
    db.close();
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log('Tiada Bidang dengan ikon SVG custom. Tiada apa untuk dibaiki.');
    db.close();
    return;
  }

  console.log(`Menyemak ${rows.length} Bidang dengan ikon custom...`);
  let dikemas = 0;
  let diperiksa = 0;

  const proses = (i) => {
    if (i >= rows.length) {
      console.log(`\nSelesai. ${dikemas} daripada ${rows.length} Bidang dikemas kini (warna literal -> currentColor).`);
      db.close();
      return;
    }
    const baris = rows[i];
    diperiksa++;
    const { svg: svgBaharu, warnaDitukar } = tukarWarnaKepadaCurrentColor(baris.iconSvg);
    if (warnaDitukar === 0) {
      proses(i + 1);
      return;
    }
    db.run('UPDATE CategoryRegistry SET iconSvg = ? WHERE id = ?', [svgBaharu, baris.id], (e) => {
      if (e) {
        console.error(`  GAGAL ${baris.name}: ${e.message}`);
      } else {
        dikemas++;
        console.log(`  ✓ ${baris.name} — ${warnaDitukar} warna ditukar`);
      }
      proses(i + 1);
    });
  };
  proses(0);
});
