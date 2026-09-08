// SIMULASI 19 — TOCTOU: kelulusan manual (POST /ticker/review-action) LAWAN nilaiSemulaKeputusanSediaAda()
// (bug-hunt 2026-09-08, sudut segar diarah — "scheduled RSS fetch runs while an editor simultaneously
// approves/rejects the SAME item").
//
// nilaiSemulaKeputusanSediaAda() (slotRoutes.js) SELECT semua baris decision IN (...) DAHULU, kira
// keputusan baharu dalam gelung JS (sync), kemudian UPDATE setiap baris SATU PERSATU dalam SATU
// transaksi guna id sahaja (tiada semakan decision SEMASA pada masa tulis). POST /ticker/review-action
// pula menulis rss_ticker_items.status/decision (baris 333, slotRoutes.js) DI LUAR denganKunciTicker —
// hanya penjanaan semula rentetan ticker (janaSemulaTickerRssDirect) yang dikunci. Jadi antara SELECT
// dan UPDATE nilaiSemulaKeputusanSediaAda, klik "Lulus"/"Tolak" editor SEBENAR pada baris yang SAMA
// boleh senyap DITIMPA BALIK oleh nilai lapuk yang dikira daripada bacaan SEBELUM kelulusan manual tu.
//
// Ujian: cipta ~2000 baris "pengisi" (decision=EDITOR_REVIEW) supaya gelung nilaiSemulaKeputusanSediaAda
// (dicetuskan POST /rss-settings menukar reviewThreshold) ambil masa sebenar merentasi banyak await point
// SQLite, bukan cuma teori — kemudian tembak POST /ticker/review-action approve pada SATU item sasaran
// SERTA-MERTA selepas (tanpa menunggu) POST /rss-settings selesai, supaya kedua-dua permintaan HTTP
// benar-benar bertindih pada pelayan SEBENAR.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbRun, dbGet, bukaDb } from './sim-lib.mjs';

const PORT = 5219;
const DBF = path.join(os.tmpdir(), 'sim-adjung-toctou-review.db');
const lap = pelapor('SIM 19 — TOCTOU REVIEW-ACTION LAWAN NILAI SEMULA');

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  const now = new Date().toISOString();

  // Item sasaran: skor 65 (lulus reviewThreshold=60 lalai -> EDITOR_REVIEW/pending). Bila
  // reviewThreshold dinaikkan ke 70 lepas ni, 65 jatuh ke bawah -> patut jadi REJECT/rejected
  // MENURUT SKOR SAHAJA -- tapi editor sempat Lulus MANUAL sepanjang tempoh tu.
  await dbRun(db, `INSERT INTO rss_ticker_items
    (id, rssGuid, title, formattedBrief, source, originalUrl, category, publishedAt, score, decision, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['sim19-sasaran', 'sim19-guid-sasaran', 'Berita RSS Sim19 Sasaran TOCTOU', 'Ringkasan ujian sim19.', 'Bernama', 'https://bernama.test/sim19', 'SEMASA', now, 65, 'EDITOR_REVIEW', 'pending', now]);

  // ~2500 baris pengisi, skor turut 65 (sama nasib -- semua akan cuba jatuh ke REJECT bila
  // ambang dinaikkan), supaya gelung nilaiSemulaKeputusanSediaAda() betul-betul memproses
  // ribuan UPDATE dlm satu transaksi (bukan 1 baris kosong yang siap serta-merta).
  await dbRun(db, 'BEGIN TRANSACTION');
  for (let i = 0; i < 2500; i++) {
    await dbRun(db, `INSERT INTO rss_ticker_items
      (id, rssGuid, title, formattedBrief, source, originalUrl, category, publishedAt, score, decision, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`sim19-isi-${i}`, `sim19-guid-isi-${i}`, `Berita Pengisi ${i}`, 'Ringkasan pengisi.', 'Bernama', `https://bernama.test/isi-${i}`, 'SEMASA', now, 65, 'EDITOR_REVIEW', 'pending', now]);
  }
  await dbRun(db, 'COMMIT');
  lap.lulus('2501 baris (1 sasaran + 2500 pengisi) disediakan, semua EDITOR_REVIEW/skor 65');

  // Tembak DUA permintaan HAMPIR SERENTAK pada pelayan SEBENAR:
  //  (a) POST /rss-settings menaikkan reviewThreshold ke 70 -> mencetuskan nilaiSemulaKeputusanSediaAda()
  //      yang akan proses 2501 baris (SELECT semua, kira semula, UPDATE satu-satu dlm transaksi).
  //  (b) POST /ticker/review-action approve pada item SASARAN sahaja, ditembak serta-merta selepas (a)
  //      tanpa menunggu (a) selesai -- mensimulasikan editor SEBENAR klik Lulus semasa kitaran RSS
  //      berjadual/tetapan sedang diproses pelayan.
  const janjiTetapan = api('POST', '/api/system/rss-settings', {
    autoLiveThreshold: 80, reviewThreshold: 70, priorityKeywords: '', blockedKeywords: '',
    priorityBonus: 15, blockedPenalty: 40, maxNewsAgeHours: 9999, tickerMaxItems: 20, tickerTitleMinChars: 0,
  });
  const janjiLulus = api('POST', '/api/system/ticker/review-action', { itemId: 'sim19-sasaran', action: 'approve' });

  const [rTetapan, rLulus] = await Promise.all([janjiTetapan, janjiLulus]);
  if (!rTetapan.ok) throw new Error('rss-settings gagal: ' + rTetapan.status + ' ' + rTetapan.teks.slice(0, 300) + '\n\nLOG:\n' + srv.dapatLog().slice(-3000));
  if (!rLulus.ok) throw new Error('review-action gagal: ' + rLulus.status + ' ' + rLulus.teks.slice(0, 300));
  lap.lulus('Kedua-dua permintaan (rss-settings + review-action) pulang 200');

  const baris = await dbGet(db, "SELECT status, decision, score FROM rss_ticker_items WHERE id = 'sim19-sasaran'");
  if (baris?.status === 'approved' && baris?.decision === 'MANUAL_APPROVED') {
    lap.lulus('Kelulusan manual EDITOR KEKAL walau nilaiSemulaKeputusanSediaAda() jalan serentak (' + JSON.stringify(baris) + ')');
  } else {
    lap.gagal('KRITIKAL: kelulusan manual DITIMPA BALIK oleh kiraan semula backlog RSS serentak (TOCTOU)', JSON.stringify(baris));
  }

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
