// sim227 — bug-hunt 2026-09-09. Following up on #224 (desk) / #225 (topik) "validate-normalized-
// but-persist-raw" found TWICE in PATCH /content/:id, this round checked the OTHER content-write
// paths for the same shape. POST /api/system/content (new content creation, contentRoutes.js
// ~line 2284/2335) normalizes `desk` before persisting (`finalCategory = (desk||'UMUM').trim()
// .toUpperCase()`, used for BOTH the validateBidangTopik() check AND the persisted attribute),
// but `topik` is validated trimmed (validateBidangTopik -> topikTrimmed, ContentBudget.js ~line
// 477) while the RAW untrimmed `topik` from req.body is what actually gets written to
// editorial_attribute_values (contentRoutes.js line 2335: `{ key: 'topik', val: topik || '' }`).
//
// Effect: a topik like "  Ekonomi  " (leading/trailing whitespace) passes validation (checked
// trimmed, within char ceiling) but persists with the whitespace intact — unlike desk, which is
// always stored normalized. This corrupts the eyebrow label ("Bidang | Topik"), and later PATCH
// edits comparing topikSebelum (raw stored value, contentRoutes.js line 1261) against a
// freshly-trimmed topikNorm will see a spurious "Topik changed" diff even when the editor typed
// the exact same word, causing bogus audit-log entries / re-triggering the reactivation review
// gate for no real content change.
import path from 'node:path';
import Database from 'sqlite3';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien } from './sim-lib.mjs';

const PORT = 5746;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim227.db');

function dbGetRaw(dbFile, sql) {
  return new Promise((resolve, reject) => {
    const db = new Database.Database(dbFile);
    db.get(sql, (err, row) => {
      db.close();
      if (err) reject(err); else resolve(row);
    });
  });
}

async function main() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-b', username: 'admin-b' });
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    // Slot 5 (STANDARD tier, bukan BAR, bukan Ticker) — desk sengaja beri ruang putih juga utk
    // banding terus dgn topik (kedua-dua patut dilayan sama, tapi tidak).
    const r1 = await api('POST', '/api/system/content', {
      slotIndex: 2,
      title: 'Ujian normalisasi medan Topik pada laluan cipta kandungan baharu sim227',
      summary: 'Huraian ujian sim227 banding desk dan topik semasa cipta kandungan baharu.',
      desk: '  ekonomi  ',
      topik: '  Kewangan  ',
      source: 'Sumber Ujian',
      url: 'https://contoh.test/artikel',
    });
    console.log('1) POST /content:', r1.status, r1.json?.error || r1.json?.id);
    if (r1.status !== 200) throw new Error('Jangka 200 tapi dapat ' + r1.status + ' ' + JSON.stringify(r1.json));

    const objectId = r1.json.id;
    const deskRow = await dbGetRaw(DB_FILE, `SELECT valueText FROM editorial_attribute_values WHERE objectId = '${objectId}' AND attributeId = 'desk'`);
    const topikRow = await dbGetRaw(DB_FILE, `SELECT valueText FROM editorial_attribute_values WHERE objectId = '${objectId}' AND attributeId = 'topik'`);

    console.log('2) desk tersimpan :', JSON.stringify(deskRow.valueText));
    console.log('3) topik tersimpan:', JSON.stringify(topikRow.valueText));

    if (deskRow.valueText !== 'EKONOMI') {
      throw new Error(`Jangka desk dinormalisasi ke "EKONOMI", dapat ${JSON.stringify(deskRow.valueText)}`);
    }
    if (topikRow.valueText !== 'Kewangan') {
      throw new Error(`BUG: topik TIDAK dinormalisasi (trim) semasa persist — dapat ${JSON.stringify(topikRow.valueText)}, jangka "Kewangan". desk pula betul-betul di-trim (${JSON.stringify(deskRow.valueText)}), membuktikan dua medan yang sepatutnya dilayan sama tidak konsisten pada laluan cipta.`);
    }

    console.log('\nBERSIH — topik dinormalisasi (trim) sama seperti desk pada laluan cipta.');
  } catch (e) {
    console.log('--- server log tail ---');
    console.log(dapatLog().slice(-3000));
    throw e;
  } finally {
    proc.kill();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('GAGAL:', e); process.exit(1); });
