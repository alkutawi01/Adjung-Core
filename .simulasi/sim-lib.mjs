// Rangka simulasi kongsi — hidupkan pelayan SEBENAR terhadap pangkalan data BUANGAN.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'node:url';

// Dikira relatif kepada lokasi fail ni (sama corak seperti liputan.mjs), BUKAN laluan mutlak
// dikod keras (2026-09-02, dapatan bug-hunt) — nilai lama `C:/Users/alkut/Downloads/Adjung Mini
// Main` ialah laluan pada mesin lain, tak wujud langsung di persekitaran ni atau mana-mana klon
// projek masa depan. Kesan senyap: bootServer() spawn `node ... server.js` dengan cwd yang tak
// wujud, proses gagal serta-merta (ENOENT) sebelum sempat cuba /api/system/health, jadi SEMUA 13
// simulasi (termasuk semakan keselamatan/race-condition kritikal) gagal dengan cara yang kelihatan
// macam pepijat aplikasi sedangkan sebenarnya cuma laluan silap — berisiko disalahtafsir atau
// diabaikan oleh sesiapa yang cuba jalankan suite ni pada mesin/klon baharu.
export const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const hashPassword = (plain) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
};

export const dbRun = (db, sql, p = []) => new Promise((res, rej) =>
  db.run(sql, p, function (e) { e ? rej(e) : res(this); }));
export const dbGet = (db, sql, p = []) => new Promise((res, rej) =>
  db.get(sql, p, (e, r) => e ? rej(e) : res(r)));
export const dbAll = (db, sql, p = []) => new Promise((res, rej) =>
  db.all(sql, p, (e, r) => e ? rej(e) : res(r || [])));

// Buka sambungan pengesahan ke DB simulasi. `busy_timeout` WAJIB: pelayan sedang memegang fail
// yang sama (penjadual, backup automatik, tulisan permintaan), jadi tanpa tempoh menunggu,
// bacaan simulasi kadangkala ranap dengan SQLITE_BUSY — itu artifak rangka ujian, bukan pepijat
// aplikasi, tetapi ia menutup keputusan simulasi sebenar.
export function bukaDb(dbFile) {
  const db = new sqlite3.Database(dbFile);
  db.run('PRAGMA busy_timeout = 10000');
  return db;
}

export async function bootServer({ port, dbFile, freshDb = true }) {
  if (freshDb && fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  const proc = spawn('node', ['--import', 'tsx', 'server.js'], {
    cwd: REPO,
    env: {
      ...process.env,
      PORT: String(port),
      ADJUNG_DB_PATH: dbFile,
      SESSION_SECRET: 'simulasi-rahsia-tetap-supaya-sesi-kekal',
      NODE_ENV: 'development',
      BASE_URL: 'http://localhost:' + port,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  proc.stdout.on('data', d => { log += d.toString(); });
  proc.stderr.on('data', d => { log += d.toString(); });

  const base = `http://localhost:${port}`;
  const mula = Date.now();
  while (Date.now() - mula < 60000) {
    try {
      const r = await fetch(`${base}/api/system/health`);
      if (r.ok) return { proc, base, dapatLog: () => log };
    } catch { /* belum sedia */ }
    await new Promise(r => setTimeout(r, 400));
  }
  proc.kill();
  throw new Error('Pelayan tak sedia dalam 60s. Log:\n' + log.slice(-3000));
}

export async function ciptaPentadbir(dbFile, { id = 'sim-admin', username = 'sim-admin', pass = 'SimUjian!2026' } = {}) {
  const db = new sqlite3.Database(dbFile);
  const now = new Date().toISOString();
  await dbRun(db, `INSERT OR REPLACE INTO users (id,username,email,role,password,penName,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?)`, [id, username, `${username}@sim.test`, 'KETUA_EDITOR', hashPassword(pass), 'Sim Admin', now, now]);
  for (const r of ['pentadbir', 'ketua_editor']) {
    await dbRun(db, 'INSERT OR IGNORE INTO user_roles (userId,roleId) VALUES (?,?)', [id, r]);
  }
  await new Promise(r => db.close(r));
  return { username, pass };
}

export async function login(base, username, pass) {
  const r = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: username, password: pass }),
  });
  if (!r.ok) throw new Error('Log masuk gagal: ' + r.status + ' ' + await r.text());
  const raw = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')];
  return raw.filter(Boolean).map(c => c.split(';')[0]).join('; ');
}

export function buatKlien(base, cookie) {
  return async (method, laluan, body) => {
    const r = await fetch(base + laluan, {
      method,
      headers: { 'Content-Type': 'application/json', cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const teks = await r.text();
    let json = null;
    try { json = teks ? JSON.parse(teks) : null; } catch { /* bukan json */ }
    return { status: r.status, ok: r.ok, json, teks };
  };
}

// Isi huraian ringkas yang cukup panjang utk lulus had MINIMUM 80% bajet kad (ContentBudget.js,
// keputusan Izzat 2026-08-08) -- fixture lama guna teks pendek tetap yang gagal lulus peraturan
// ni, menggagalkan simulasi di langkah PERSEDIAAN sebelum sempat sampai bahagian yg sebenarnya
// diuji (2026-08-14, ditemui semasa siasat sim10). Panjang dikira ikut tier fizikal slot sebenar
// (ceilingForSlot), bukan nilai tetap -- tier berbeza (MENEGAK vs KOMPAK) ada had sangat berbeza.
export function isiHuraianCukup(ceilingForSlot, slotIndex, tajukLen) {
  const { maxTitle, maxBrief } = ceilingForSlot(slotIndex);
  const bakiFraction = Math.max(0, 0.86 - tajukLen / maxTitle);
  const sasaran = Math.min(maxBrief, Math.max(20, Math.round(bakiFraction * maxBrief)));
  let huraian = 'Ujian simulasi bagi kandungan editorial. ';
  while (huraian.length < sasaran) huraian += 'Tambah teks. ';
  return huraian.slice(0, sasaran).trim();
}

// Huraian Panjang SAH — >= MIN_BRIEF_LONG_CHARS (400 aksara, core/editorial/GeometryConfig.js) —
// dikongsi (2026-09-02, dapatan bug-hunt) supaya SETIAP simulasi yang menerbitkan kandungan
// "sah" tak tercicir medan ni lagi. Sebelum ni setiap fixture blok() simulasi tulis Huraian Panjang
// sendiri (atau LANGSUNG TAK sertakan langsung) — sejak gerbang wajib >=400 aksara dikuatkuasakan
// (2026-08-07, diperketat 2026-08-28 supaya kosong pun ditolak), MANA-MANA fixture tanpa medan ni
// gagal pada langkah PERSEDIAAN, sebelum sempat sampai ke peraturan sebenar yang simulasi tu mahu
// uji — kesan sebenar ditemui merentasi sim6/sim8/sim11 serentak. Guna pemalar SAMA di semua
// tempat supaya pembetulan akan datang (kalau had 400 berubah) cukup di SATU tempat.
export const HURAIAN_PANJANG_SAH = 'Ujian simulasi ini menyediakan Huraian Panjang yang cukup '
  + 'panjang supaya gerbang had minimum 400 aksara tidak tercetus, membolehkan ujian menyasarkan '
  + 'peraturan lain yang sebenarnya mahu diuji. Teks ini sengaja neutral dan tidak menyentuh '
  + 'kandungan editorial sebenar, cuma memenuhi keperluan panjang minimum yang ditetapkan di '
  + 'Tetapan Am Slot. Ayat tambahan ini semata-mata untuk memastikan jumlah aksara mencukupi ambang.';

export function pelapor(namaSim) {
  const penemuan = [];
  return {
    lulus: (t) => console.log(`  ok    ${t}`),
    gagal: (t, butiran) => { penemuan.push({ t, butiran }); console.log(`  GAGAL ${t}\n        ${butiran}`); },
    ringkasan: () => {
      console.log(`\n=== ${namaSim}: ${penemuan.length} penemuan ===`);
      penemuan.forEach((p, i) => console.log(` ${i + 1}. ${p.t}\n    ${p.butiran}`));
      return penemuan;
    },
  };
}
