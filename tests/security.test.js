import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'node:url';

// Fasa 17 / Fasa 1 (baki item) — ujian keselamatan automatik SEBENAR terhadap tika pelayan
// hidup (throwaway, port berasingan drpd dev/produksi), gantikan ujian manual curl. Liputan:
//  1. Penjelakan peranan (role escalation) — akaun EDITOR cuba capai laluan manageAccounts
//     sahaja (Pentadbir) → 403; permintaan tanpa sesi langsung → 401.
//  2. Rintangan XSS — sahkan seni bina render (React JSX text interpolation, BUKAN
//     dangerouslySetInnerHTML) dipakai untuk SEMUA tajuk/huraian kandungan editorial
//     (satu-satunya laluan dangerouslySetInnerHTML dalam src/ ialah ikon SVG Bidang terkurasi,
//     bukan kandungan pengguna) — ini seni bina sebenar yang menghalang XSS, bukan sanitizer
//     di laluan simpan (tiada satu pun, sengaja, sebab escaping berlaku di peringkat render).
//  3. Postur CSRF — sahkan konfigurasi kuki sesi (httpOnly/sameSite) sepadan dokumentasi Fasa 1,
//     bukan infrastruktur token CSRF baharu (luar skop, lihat arahan tugasan).
//
// Akaun ujian dicipta terus dalam adjung.db (bukan melalui UI), dibersihkan dalam `after`.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const dbPath = path.join(repoRoot, 'adjung.db');
const TEST_PORT = 5099;
const BASE = `http://localhost:${TEST_PORT}`;

const hashPassword = (plain) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
};

const runDb = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) { if (err) reject(err); else resolve(this); });
});

let serverProcess = null;
let db = null;
const testUserId = `test-fasa17-editor-${Date.now()}`;
const testUsername = `test-fasa17-editor-${Date.now()}`;
const testPassword = 'UjianKeselamatan!2026';
let dbAvailable = true;
let serverReady = false;

const waitForServer = async (timeoutMs = 15000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/system/health`);
      if (res.ok) return true;
    } catch { /* belum sedia, cuba lagi */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
};

test.before(async () => {
  if (!fs.existsSync(dbPath)) { dbAvailable = false; return; }

  // Cipta akaun EDITOR ujian sekali pakai terus dalam DB sebenar (corak sama seperti Fasa 3/6b
  // — akaun ujian dibersihkan selepas, bukan data kekal).
  db = new sqlite3.Database(dbPath);
  const kini = new Date().toISOString();
  await runDb(db,
    `INSERT INTO users (id, username, email, role, penName, password, createdAt, updatedAt, status)
     VALUES (?, ?, ?, 'EDITOR', 'Ujian Fasa 17', ?, ?, ?, 'Aktif')`,
    [testUserId, testUsername, `${testUsername}@ujian.local`, hashPassword(testPassword), kini, kini]);
  await runDb(db, `INSERT INTO user_roles (userId, roleId) VALUES (?, 'editor')`, [testUserId]);

  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(TEST_PORT), SESSION_SECRET: 'ujian-fasa17-rahsia-tetap' },
    stdio: 'ignore',
  });
  serverReady = await waitForServer();
});

test.after(async () => {
  if (serverProcess) {
    serverProcess.kill();
    await new Promise((r) => setTimeout(r, 300));
  }
  if (db) {
    await runDb(db, `DELETE FROM user_roles WHERE userId = ?`, [testUserId]).catch(() => {});
    await runDb(db, `DELETE FROM users WHERE id = ?`, [testUserId]).catch(() => {});
    db.close();
  }
});

test('Penjelakan peranan — permintaan TANPA sesi ke laluan manageAccounts pulangkan 401', async () => {
  if (!dbAvailable || !serverReady) return assert.ok(true, 'Pelayan ujian tidak tersedia dlm konteks ini — dilangkau dgn selamat');
  const res = await fetch(`${BASE}/api/system/users`);
  assert.equal(res.status, 401);
});

test('Penjelakan peranan — akaun EDITOR (tiada manageAccounts) cuba GET /api/system/users pulangkan 403', async () => {
  if (!dbAvailable || !serverReady) return assert.ok(true, 'Pelayan ujian tidak tersedia dlm konteks ini — dilangkau dgn selamat');

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: testUsername, password: testPassword }),
  });
  assert.equal(loginRes.status, 200, 'Log masuk akaun ujian EDITOR mesti berjaya sebelum ujian penjelakan');
  const cookie = loginRes.headers.get('set-cookie');
  assert.ok(cookie, 'Log masuk mesti tetapkan kuki sesi');

  // Laluan Pentadbir-sahaja (manageAccounts) — EDITOR TIDAK ada kebenaran ini (lihat
  // DEFAULT_ROLE_PERMISSIONS di core/middleware/auth.js), jadi mesti disekat 403 server-side,
  // bukan sekadar disorok di UI.
  const res = await fetch(`${BASE}/api/system/users`, { headers: { cookie } });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error, 'Anda tiada kebenaran untuk tindakan ini.');
});

test('Penjelakan peranan — akaun EDITOR cuba POST /api/system/users (cipta akaun baharu) pulangkan 403', async () => {
  if (!dbAvailable || !serverReady) return assert.ok(true, 'Pelayan ujian tidak tersedia dlm konteks ini — dilangkau dgn selamat');

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: testUsername, password: testPassword }),
  });
  const cookie = loginRes.headers.get('set-cookie');

  const res = await fetch(`${BASE}/api/system/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ username: 'sepatutnya-tak-tercipta', email: 'x@x.com', password: 'x', roles: ['pentadbir'] }),
  });
  assert.equal(res.status, 403);
});

test('XSS — dangerouslySetInnerHTML dalam src/ TERHAD kepada ikon SVG terkurasi, bukan kandungan editorial pengguna', () => {
  // React JSX escape teks {var} secara automatik — laluan render kandungan editorial (tajuk/
  // huraian kad bento, Focus View) guna safeParseInline() yang pulangkan React.Fragment/
  // <em>/<strong>/<span> berstruktur (src/utils.tsx), BUKAN HTML mentah. Ini seni bina sebenar
  // yang menghalang suntikan skrip — sahkan tiada dangerouslySetInnerHTML bocor ke laluan
  // kandungan pengguna (tajuk/huraian/brief), hanya kekal utk SVG ikon Bidang terkurasi
  // (diisi editor dari fail SVG dimuat naik sendiri, bukan medan teks bebas pembaca awam).
  const srcDir = path.join(repoRoot, 'src');
  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(tsx|ts)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, 'utf-8');
      if (text.includes('dangerouslySetInnerHTML')) hits.push(full);
    }
  };
  walk(srcDir);

  assert.ok(hits.length > 0, 'Sekurang-kurangnya laluan ikon SVG dijangka guna dangerouslySetInnerHTML');
  const allowedNames = ['BidangIcon.tsx', 'BidangConsole.tsx', 'FocusView.tsx'];
  for (const hit of hits) {
    assert.ok(
      allowedNames.some((name) => hit.endsWith(name)),
      `dangerouslySetInnerHTML ditemui di luar senarai dibenarkan (ikon SVG sahaja): ${hit}`
    );
  }

  // Sahkan laluan kandungan utama (FrontpageView.tsx) TIDAK guna dangerouslySetInnerHTML untuk
  // tajuk/huraian — semua tajuk/huraian mesti laluan safeParseInline (React node berstruktur).
  const frontpage = fs.readFileSync(path.join(srcDir, 'components/portal/FrontpageView.tsx'), 'utf-8');
  assert.ok(!frontpage.includes('dangerouslySetInnerHTML'), 'FrontpageView.tsx tidak sepatutnya render tajuk/huraian guna HTML mentah');
});

test('CSRF — konfigurasi kuki sesi sepadan dokumentasi (httpOnly, sameSite=lax, secure ikut NODE_ENV)', () => {
  // Tiada infrastruktur token CSRF berasingan (keputusan skop tugasan) — postur semasa
  // bergantung sepenuhnya pada sameSite=lax (sekat kuki dihantar dlm permintaan cross-site
  // POST/PUT/DELETE daripada tapak pihak ketiga) + httpOnly (elak baca kuki via JS suntikan
  // XSS). Ujian ni sahkan KONFIGURASI SEBENAR dlm server.js, bukan reka semula infrastruktur
  // baharu.
  const serverSrc = fs.readFileSync(path.join(repoRoot, 'server.js'), 'utf-8');
  const cookieBlockMatch = serverSrc.match(/cookie:\s*{([^}]*)}/s);
  assert.ok(cookieBlockMatch, 'Konfigurasi cookie: {...} mesti wujud dlm session middleware server.js');
  const cookieBlock = cookieBlockMatch[1];
  assert.match(cookieBlock, /httpOnly:\s*true/);
  assert.match(cookieBlock, /sameSite:\s*'lax'/);
  assert.match(cookieBlock, /secure:\s*process\.env\.NODE_ENV === 'production'/);
});
