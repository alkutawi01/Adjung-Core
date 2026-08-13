// SIMULASI 7 — INTEGRITI SKEMA PADA PEMASANGAN BAHARU (keselamatan deploy).
//
// Mengimbas SETIAP nama jadual yang kod benar-benar rujuk (INSERT/UPDATE/DELETE/FROM/JOIN)
// merentas server.js + core/, kemudian membandingkannya dengan jadual yang WUJUD selepas
// pelayan boot terhadap pangkalan data KOSONG.
//
// Kelas pepijat: jadual yang dirujuk kod tapi tak pernah dicipta oleh seedDatabase(). Pada
// adjung.db sedia ada ia tersembunyi (jadual diwarisi); pada pelayan BAHARU ia meletup atau
// gagal senyap. Ini yang akan berlaku kalau Izzat deploy ke Droplet baharu.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sqlite3 from 'sqlite3';
import { bootServer, pelapor, dbAll, REPO, bukaDb } from './sim-lib.mjs';

const PORT = 5205;
const DBF = path.join(os.tmpdir(), 'sim-adjung-skema.db');
const lap = pelapor('SIM 7 — INTEGRITI SKEMA');

// Kumpul nama jadual daripada kod.
const kumpulFail = (dir, senarai = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', '.git', 'dist'].includes(e.name)) kumpulFail(f, senarai); }
    else if (e.name.endsWith('.js')) senarai.push(f);
  }
  return senarai;
};

const fail = [...kumpulFail(path.join(REPO, 'core')), path.join(REPO, 'server.js')];
const dirujuk = new Set();
const CORAK = [
  /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
  /UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+SET/gi,
  /DELETE\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
  /\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
  /\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
];
// Perkataan yang tersilap tangkap oleh regex (bukan jadual sebenar).
// `sessions` SENGAJA dikecualikan (2026-08-14) -- jadual tu wujud dalam sessions.db BERASINGAN
// (connect-sqlite3 urus + cipta sendiri, lihat server.js baris ~99), bukan dalam adjung.db yang
// simulasi ni imbas. Rujukan kod (DELETE FROM sessions) sah, tapi jadual tu tak patut/tak
// pernah wujud dalam adjung.db -- pengesahan ni salah tempat, bukan gap skema sebenar.
const BUKAN_JADUAL = new Set(['sqlite_master', 'select', 'SELECT', 'pragma', 'dual', 'sessions']);

// Hanya imbas dalam RENTETAN (backtick/petikan) — bukan seluruh fail. Tanpa ini, corak `FROM x`
// tertangkap prosa Inggeris dalam komen ("apart FROM the ...") dan melaporkan puluhan "jadual"
// palsu. Buang juga baris komen sebelum mengekstrak.
const ekstrakRentetan = (kod) => {
  const tanpaKomen = kod
    .split('\n')
    .filter(b => !b.trim().startsWith('//') && !b.trim().startsWith('*'))
    .join('\n');
  const keluar = [];
  const re = /`([^`]*)`|'([^'\n]*)'|"([^"\n]*)"/g;
  let m;
  while ((m = re.exec(tanpaKomen)) !== null) keluar.push(m[1] ?? m[2] ?? m[3] ?? '');
  return keluar;
};

for (const f of fail) {
  const kod = fs.readFileSync(f, 'utf8');
  for (const rentetan of ekstrakRentetan(kod)) {
    // Hanya rentetan yang benar-benar nampak macam SQL.
    if (!/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/i.test(rentetan)) continue;
    for (const re of CORAK) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(rentetan)) !== null) {
        const nama = m[1];
        if (!BUKAN_JADUAL.has(nama)) dirujuk.add(nama);
      }
    }
  }
}

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  // Beri masa seedDatabase() menyiapkan semua CREATE TABLE.
  await new Promise(r => setTimeout(r, 3000));
  const db = bukaDb(DBF);
  const wujud = new Set((await dbAll(db, "SELECT name FROM sqlite_master WHERE type='table'")).map(r => r.name));

  const hilang = [...dirujuk].filter(t => !wujud.has(t)).sort();
  const tidakDigunakan = [...wujud].filter(t => !dirujuk.has(t) && !t.startsWith('sqlite_')).sort();

  console.log(`  jadual dirujuk kod : ${dirujuk.size}`);
  console.log(`  jadual wujud di DB : ${wujud.size}`);

  if (hilang.length) {
    lap.gagal('jadual DIRUJUK kod tapi TIDAK dicipta pada DB baharu', hilang.join(', ') + ' — pelayan baharu akan gagal/senyap pada laluan ini');
  } else {
    lap.lulus('setiap jadual yang dirujuk kod wujud pada pemasangan baharu');
  }

  if (tidakDigunakan.length) {
    console.log(`  (maklumat) jadual dicipta tapi tiada rujukan kod: ${tidakDigunakan.join(', ')}`);
  }

  // Semakan tambahan: baris seed penting mesti ada.
  const semakSeed = async (label, sql, minimum = 1) => {
    const r = await dbAll(db, sql);
    if (r.length >= minimum) lap.lulus(`seed: ${label} (${r.length} baris)`);
    else lap.gagal(`seed: ${label} TIADA pada DB baharu`, `dijangka >=${minimum} baris, dapat ${r.length}`);
  };
  await semakSeed('editorial_attributes (medan kandungan)', 'SELECT id FROM editorial_attributes', 18);
  await semakSeed('system_settings', "SELECT id FROM system_settings");
  await semakSeed('ui_labels (kamus label)', 'SELECT key FROM ui_labels', 10);
  await semakSeed('users (akaun awal)', 'SELECT id FROM users');

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
