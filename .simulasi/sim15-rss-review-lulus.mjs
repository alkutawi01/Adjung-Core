// SIMULASI 15 — RSS Review Queue: kelulusan manual serta-merta pada Ticker awam (bug-hunt 2026-09-08).
//
// CLAUDE.md/komen slotRoutes.js dakwa /ticker/review-action 'approve' menjana semula ticker
// SERTA-MERTA (bukan tunggu 3 jam), dan item yang diluluskan secara MANUAL dikecualikan drpd
// purge automatik seterusnya. Tiada simulasi sedia ada menguji laluan ni hujung-ke-hujung dengan
// klik sebenar (HTTP) + semak system_settings.inTheNewsText SEBENAR. Ujian ni buktikan dakwaan tu.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbRun, dbGet, bukaDb } from './sim-lib.mjs';

const PORT = 5215;
const DBF = path.join(os.tmpdir(), 'sim-adjung-rss-review.db');
const lap = pelapor('SIM 15 — RSS REVIEW QUEUE LULUS');

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  const now = new Date().toISOString();
  const TAJUK = 'Berita RSS Sim15 Menunggu Semakan Unik';
  await dbRun(db, `INSERT INTO rss_ticker_items
    (id, rssGuid, title, formattedBrief, source, originalUrl, category, publishedAt, score, decision, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['sim15-item-1', 'sim15-guid-1', TAJUK, 'Ringkasan ujian sim15.', 'Bernama', 'https://bernama.test/sim15', 'SEMASA', now, 65, 'EDITOR_REVIEW', 'pending', now]);

  // A. Sebelum lulus — item TIDAK patut ada dalam ticker awam
  const tickerSebelum = (await dbGet(db, "SELECT inTheNewsText FROM system_settings WHERE id='settings-main'"))?.inTheNewsText || '';
  if (tickerSebelum.includes(TAJUK)) {
    lap.gagal('Item pending sudah ada dalam ticker SEBELUM diluluskan (fixture rosak)', tickerSebelum.slice(0, 200));
  } else {
    lap.lulus('Item pending memang belum dalam ticker (baseline betul)');
  }

  // B. Klik "Lulus" (POST /ticker/review-action) — laluan sebenar Review Queue
  const rLulus = await api('POST', '/api/system/ticker/review-action', { itemId: 'sim15-item-1', action: 'approve' });
  if (!rLulus.ok) {
    lap.gagal('POST /ticker/review-action approve gagal', `HTTP ${rLulus.status} ${rLulus.teks.slice(0, 200)}`);
  } else {
    lap.lulus('POST /ticker/review-action approve pulang 200');
  }

  const barisSelepasLulus = await dbGet(db, "SELECT status, decision FROM rss_ticker_items WHERE id='sim15-item-1'");
  if (barisSelepasLulus?.status !== 'approved' || barisSelepasLulus?.decision !== 'MANUAL_APPROVED') {
    lap.gagal('status/decision DB tidak betul selepas Lulus', JSON.stringify(barisSelepasLulus));
  } else {
    lap.lulus('status=approved, decision=MANUAL_APPROVED tersimpan betul');
  }

  // C. Ticker AWAM MESTI papar item ni SERTA-MERTA (bukan tunggu kitaran 3 jam)
  const tickerSelepas = (await dbGet(db, "SELECT inTheNewsText FROM system_settings WHERE id='settings-main'"))?.inTheNewsText || '';
  if (!tickerSelepas.includes(TAJUK)) {
    lap.gagal('KRITIKAL: item diluluskan TAPI TIDAK muncul serta-merta dalam Ticker awam', tickerSelepas.slice(0, 300) || '(kosong)');
  } else {
    lap.lulus('Item muncul SERTA-MERTA dalam Ticker awam selepas Lulus');
  }

  // D. (Ticker awam sebenar disajikan via GET /api/system/db-state, bukan /layout/active —
  //    /layout/active cuma kad bento; sudah disahkan di langkah C melalui inTheNewsText.)

  // E. Simulasi tik purge usia (POST /rss-settings, maxNewsAgeHours ketat) TIDAK patut
  //    membatalkan kelulusan manual (decision='MANUAL_APPROVED' dikecualikan, per komen slotRoutes.js).
  //    publishedAt item ni ialah "now" jadi ia MASIH baharu -- letak had usia sangat ketat (1 jam
  //    tak relevan sebab item baru sahaja dicipta), jadi guna item KEDUA yang sengaja lapuk untuk
  //    sahkan pengecualian tu benar2 berfungsi.
  const lapuk = new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(); // 50 jam lalu
  await dbRun(db, `INSERT INTO rss_ticker_items
    (id, rssGuid, title, formattedBrief, source, originalUrl, category, publishedAt, score, decision, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['sim15-item-2', 'sim15-guid-2', 'Berita RSS Sim15 Lapuk Tapi Lulus Manual', 'Ringkasan.', 'Bernama', 'https://bernama.test/sim15-b', 'SEMASA', lapuk, 65, 'MANUAL_APPROVED', 'approved', lapuk]);

  const rSettings = await api('POST', '/api/system/rss-settings', {
    autoLiveThreshold: 80, reviewThreshold: 60, priorityKeywords: '', blockedKeywords: '',
    priorityBonus: 15, blockedPenalty: 40, maxNewsAgeHours: 24, tickerMaxItems: 20, tickerTitleMinChars: 0,
  });
  if (!rSettings.ok) throw new Error('rss-settings gagal: ' + rSettings.status + ' ' + rSettings.teks.slice(0, 300) + '\n\nLOG:\n' + srv.dapatLog().slice(-3000));

  const barisLapukSelepas = await dbGet(db, "SELECT status FROM rss_ticker_items WHERE id='sim15-item-2'");
  if (barisLapukSelepas?.status !== 'approved') {
    lap.gagal('Purge usia MEMBATALKAN kelulusan manual (MANUAL_APPROVED patut dikecualikan)', `status=${barisLapukSelepas?.status}`);
  } else {
    lap.lulus('Purge usia menghormati pengecualian MANUAL_APPROVED (kelulusan manual kekal)');
  }

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
