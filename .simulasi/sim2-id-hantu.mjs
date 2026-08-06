// SIMULASI 2 — ID HANTU pada SETIAP laluan tulis yang menyasar satu baris.
//
// Kelas pepijat yang diburu: laluan menjalankan UPDATE/DELETE terhadap id yang TIDAK WUJUD,
// SQLite ubah sifar baris tanpa ralat, dan laluan tetap membalas kejayaan. Pengguna nampak
// "tersimpan"/"dipadam" sedangkan tiada apa berlaku. Ini punca sebenar laporan Izzat
// "tak boleh save bidang untuk slot tertentu".
//
// Lulus = balasan BUKAN kejayaan (4xx). Gagal = balasan kejayaan untuk baris yang tak wujud.
import path from 'node:path';
import os from 'node:os';
import sqlite3 from 'sqlite3';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, dbAll, dbRun, bukaDb } from './sim-lib.mjs';

const PORT = 5200;
const DBF = path.join(os.tmpdir(), 'sim-adjung-hantu.db');
const lap = pelapor('SIM 2 — ID HANTU');

const SVG_SAH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>';
const SVG_PLAT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M8 8h240v240H8z"/></svg>';
const H = 'ID-HANTU-TIDAK-WUJUD-12345';

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  // Prasyarat minimum supaya validasi awal laluan lulus dan kita betul-betul sampai ke tulisan.
  await api('POST', '/api/system/categories/activate', { name: 'Ekonomi', color: '#802334', icon: 'TrendingUp' });

  const KES = [
    // --- Bidang (CategoryRegistry) ---
    ['POST', '/api/system/categories/set-icon', { id: H, icon: 'Star' }],
    ['POST', '/api/system/categories/set-icon-svg', { id: H, svg: SVG_SAH }],
    ['POST', '/api/system/categories/set-color', { id: H, color: '#123456' }],
    ['POST', '/api/system/categories/set-illustration-svg', { id: H, svg: SVG_PLAT }],
    ['POST', '/api/system/categories/clear-illustration-svg', { id: H }],
    ['POST', '/api/system/categories/set-active', { id: H, isActive: false }],
    ['POST', '/api/system/categories/rename-active', { id: H, newName: 'Nama Hantu' }],

    // --- Kandungan ---
    ['PATCH', `/api/system/content/${H}`, { status: 'approved' }],
    ['DELETE', `/api/system/content/${H}`, undefined],
    ['POST', `/api/system/content/${H}/reject-to-draft`, {}],
    ['POST', `/api/system/content/${H}/revisions/999999/restore`, {}],

    // --- Akaun ---
    ['PATCH', `/api/system/users/${H}/roles`, { roles: ['editor'] }],
    ['PATCH', `/api/system/users/${H}/status`, { isSuspended: true }],
    ['PATCH', `/api/system/profile/${H}`, { penName: 'Hantu' }],

    // --- RSS / Ticker / Tipografi ---
    ['DELETE', `/api/system/rss-sources/${H}`, undefined],
    ['DELETE', `/api/system/rss-desk-rules/${H}`, undefined],
    ['DELETE', `/api/system/rss-text-rules/${H}`, undefined],
    ['DELETE', `/api/system/rss-blocked-categories/${H}`, undefined],
    ['DELETE', `/api/system/adjung-typography-rules/${H}`, undefined],
    ['DELETE', `/api/system/adjung-desks/${H}`, undefined],
    ['POST', '/api/system/ticker/review-action', { itemId: H, action: 'approve' }],
    ['POST', '/api/system/editorial-memory/promote', { memoryId: H, phrase: 'ujian', deskId: H }],

    // --- Rujukan editorial ---
    ['DELETE', `/api/system/ejaan/${H}`, undefined],
    ['DELETE', `/api/system/glosari/${H}`, undefined],

    // --- Nota / Penaja / Terjemahan ---
    ['DELETE', `/api/system/editor-notes/${H}`, undefined],
    ['PATCH', `/api/system/editor-notes/${H}`, { tajuk: 'Hantu' }],
    ['PATCH', `/api/system/sponsors/${H}`, { nama: 'Penaja Hantu' }],
    ['DELETE', `/api/translation/configs/${H}`, undefined],
  ];

  for (const [method, laluan, body] of KES) {
    let r;
    try {
      r = await api(method, laluan, body);
    } catch (e) {
      lap.gagal(`${method} ${laluan}`, 'ralat rangkaian: ' + e.message);
      continue;
    }
    const label = `${method} ${laluan.replace(H, '<hantu>')}`;
    const lapor2xx = r.status >= 200 && r.status < 300;
    const badanKataBerjaya = r.json && (r.json.success === true);

    if (lapor2xx || badanKataBerjaya) {
      lap.gagal(label, `balas ${r.status} ${r.teks.slice(0, 160)} — sepatutnya 404/400 untuk id yang tak wujud (kejayaan palsu)`);
    } else {
      lap.lulus(`${label} -> ${r.status}`);
    }
  }

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
