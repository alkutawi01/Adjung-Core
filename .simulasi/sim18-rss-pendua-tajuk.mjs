// SIMULASI 18 — Ambilan RSS Direct: pendua tajuk (guid berbeza) TIDAK ditapis (bug-hunt 2026-09-08).
//
// Liputan sim16/sim17 (aliran editorial hujung-ke-hujung + adversarial) tak pernah sentuh
// executeDirectRssFetch() (slotRoutes.js) — pipeline RSS->Ticker automatik. Ujian ni jalankan
// FUNGSI SEBENAR tu (bukan tiruan) terhadap pelayan RSS PALSU tempatan (HTTP sebenar, XML sebenar)
// + DB SQLite buangan sebenar, guna deduplicateRssItems() (RssDirectEngine.js) yang DIIMPORT tapi
// (dapatan siasatan) TAK PERNAH dipanggil dalam gelung ambilan sebenar.
//
// Nota seni bina: gerbang SSRF (sahkanUrlSelamatUntukFetch/fetchSelamat, core/utils/urlSafety.js)
// sengaja menyekat localhost/IP peribadi (audit keselamatan lepas, MASIH UTUH untuk laluan
// HTTP/pengeluaran sebenar). Sim ni panggil executeDirectRssFetch() TERUS (fungsi yang SAMA PERSIS
// dipanggil oleh POST /api/system/ticker/fetch-direct) dalam proses Node BERASINGAN yang
// dilancarkan dengan --loader sim18-loader-urlsafety-stub.mjs, supaya pelayan RSS palsu tempatan
// (127.0.0.1) boleh diuji tanpa melemahkan/mengubah kod sekatan SSRF sebenar itu sendiri.
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import sqlite3 from 'sqlite3';
import { bootServer, dbRun, dbGet, dbAll, bukaDb, pelapor, REPO } from './sim-lib.mjs';

const PORT = 5218;
const DBF = path.join(os.tmpdir(), 'sim-adjung-rss-pendua.db');
const lap = pelapor('SIM 18 — RSS DIRECT: PENDUA TAJUK (GUID BERBEZA)');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TAJUK_A = 'Kerajaan Umum Dasar Ekonomi Baharu Sim18 Unik A';
const TAJUK_B = 'Banjir Kilat Melanda Beberapa Kawasan Sim18 Unik B';
const now = new Date();

// Dua item BERBEZA SEPENUHNYA (tajuk lain, kandungan lain) tetapi KEDUA-DUA tiada tag <link> DAN
// tiada tag <guid> langsung — senario BENAR sesetengah suapan RSS sebenar (feed ringkas/separa,
// tiada enclosure per-item). parseRssXml() jatuh balik rssGuid ke `link` yang turut kosong bagi
// KEDUA-DUA item ni, jadi kedua-duanya kongsi rssGuid='' walaupun cerita LANGSUNG tak berkaitan.
function xmlPalsu() {
  const pub = now.toUTCString();
  return `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title><![CDATA[${TAJUK_A}]]></title>
    <description><![CDATA[Ringkasan berita ekonomi ujian sim18, cukup panjang untuk lulus pemeriksaan huraian ringkas ambilan RSS automatik ini.]]></description>
    <pubDate>${pub}</pubDate>
    <category>Semasa</category>
  </item>
  <item>
    <title><![CDATA[${TAJUK_B}]]></title>
    <description><![CDATA[Ringkasan berita banjir ujian sim18 yang LANGSUNG tak berkaitan cerita ekonomi di atas, cukup panjang untuk lulus pemeriksaan huraian ringkas.]]></description>
    <pubDate>${pub}</pubDate>
    <category>Semasa</category>
  </item>
</channel></rss>`;
}

async function jalankanFetchTerus(dbFile) {
  // Proses NODE BERASINGAN (bukan child bootServer/Express) — panggil executeDirectRssFetch()
  // (fungsi SEBENAR slotRoutes.js) terus, dengan gerbang SSRF disuntik-ganti via --loader HANYA
  // dalam proses sim ni (lihat nota fail loader).
  const skrip = `
    import sqlite3 from 'sqlite3';
    import { executeDirectRssFetch } from ${JSON.stringify(pathToFileUrl(path.join(REPO, 'core/routes/slotRoutes.js')))};
    const db = new sqlite3.Database(${JSON.stringify(dbFile)});
    db.run('PRAGMA busy_timeout = 10000');
    const dbAll = (q, p = []) => new Promise((res, rej) => db.all(q, p, (e, r) => e ? rej(e) : res(r || [])));
    const dbGet = (q, p = []) => new Promise((res, rej) => db.get(q, p, (e, r) => e ? rej(e) : res(r)));
    const dbRun = (q, p = []) => new Promise((res, rej) => db.run(q, p, function (e) { e ? rej(e) : res(this); }));
    const hasil = await executeDirectRssFetch(dbAll, dbGet, dbRun);
    console.log('HASIL_SIM18::' + JSON.stringify(hasil));
    db.close();
  `;
  const skripFail = path.join(REPO, '.simulasi', 'sim18-runner-tmp-' + Date.now() + '.mjs');
  const fs = await import('node:fs');
  fs.writeFileSync(skripFail, skrip);
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['--loader', pathToFileUrl(path.join(__dirname, 'sim18-loader-urlsafety-stub.mjs')), skripFail], {
      cwd: REPO,
      env: { ...process.env },
    });
    let out = '', err = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('close', (code) => {
      fs.unlinkSync(skripFail);
      if (code !== 0) return reject(new Error(`Runner sim18 keluar kod ${code}\n${err}\n${out}`));
      const baris = out.split('\n').find((l) => l.startsWith('HASIL_SIM18::'));
      resolve(baris ? JSON.parse(baris.slice('HASIL_SIM18::'.length)) : null);
    });
  });
}
function pathToFileUrl(p) { return 'file://' + p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:'); }

// 1. Cipta skema DB sebenar (guna pelayan sebenar sekali sahaja, tutup selepas siap).
const srvAwal = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
srvAwal.proc.kill();
await new Promise((r) => setTimeout(r, 500));

// 2. Pelayan RSS PALSU tempatan sebenar (HTTP sebenar, bukan tiruan dalam-proses).
const rssPort = 5219;
const rssServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
  res.end(xmlPalsu());
});
await new Promise((r) => rssServer.listen(rssPort, r));

try {
  const db = bukaDb(DBF);
  await dbRun(db, `INSERT INTO rss_sources_registry (id, sourceName, rssUrl, language, enabled, createdAt)
    VALUES (?, ?, ?, ?, 1, ?)`, ['sim18-src', 'Sim18 Sumber Ujian', `http://127.0.0.1:${rssPort}/feed.xml`, 'ms-MY', new Date().toISOString()]);
  await new Promise((r) => db.close(r));

  // 3. Jalankan executeDirectRssFetch() SEBENAR terhadap pelayan palsu di atas.
  const hasil = await jalankanFetchTerus(DBF);
  if (!hasil || !hasil.success) {
    lap.gagal('executeDirectRssFetch() tidak pulang berjaya', JSON.stringify(hasil));
  } else {
    lap.lulus(`executeDirectRssFetch() selesai — ${hasil.totalFetchedCount} item ditemui`);
  }

  const db2 = bukaDb(DBF);
  const barisA = await dbAll(db2, "SELECT id, rssGuid, title FROM rss_ticker_items WHERE title = ?", [TAJUK_A]);
  const barisB = await dbAll(db2, "SELECT id, rssGuid, title FROM rss_ticker_items WHERE title = ?", [TAJUK_B]);
  await new Promise((r) => db2.close(r));

  console.log(`  (maklumat) Tajuk A: ${barisA.length} baris. Tajuk B: ${barisB.length} baris.`);

  if (barisA.length === 1 && barisB.length === 1) {
    lap.lulus('Kedua-dua artikel BERBEZA (tanpa guid/link) tersimpan berasingan — tiada pendua palsu');
  } else if (barisA.length === 1 && barisB.length === 0) {
    lap.gagal(
      `Artikel KEDUA (tajuk berbeza sepenuhnya) HILANG senyap — deduplicateRssItems() (RssDirectEngine.js) menganggapnya pendua sebab rssGuid='' (fallback link kosong) SUDAH "seenGuids" daripada artikel PERTAMA, walaupun tajuk langsung tak sama`,
      `Logik semasa: item disimpan HANYA jika guid BELUM pernah dilihat DAN tajuk BELUM pernah dilihat (operator DAN) — bermakna guid kosong yang dikongsi ramai artikel (suapan tanpa <link>/<guid>) akan sengaja gugurkan artikel kedua dst walaupun tajuk sah berbeza. Ini kehilangan berita SENYAP, bukan pendua sebenar.`
    );
  } else {
    lap.gagal('Keputusan tidak dijangka', JSON.stringify({ barisA, barisB }));
  }
} finally {
  rssServer.close();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length > 0 ? 1 : 0);
