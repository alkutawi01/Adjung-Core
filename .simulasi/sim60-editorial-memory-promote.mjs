// sim60 — mengesahkan pembetulan POST /api/system/editorial-memory/promote (2026-09-09).
// Bug: memoryId tak sah/tak wujud/sudah 'promoted' dahulu tetap CIPTA baris rss_desk_rules
// (INSERT jalan SEBELUM UPDATE rss_editorial_memory disemak), walaupun respons keseluruhan 404.
import { bootServer, ciptaPentadbir, login, buatKlien, dbRun, dbGet, dbAll, bukaDb, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 4460;
const DB = path.join(REPO, '.simulasi', 'scratch-sim60.db');

const run = async () => {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB });
  try {
    await ciptaPentadbir(DB);
    const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
    const klien = buatKlien(base, cookie);

    const db = bukaDb(DB);
    // Sedia satu Desk sebenar (rujukan sedia ada dalam DB — pakai 'SEMASA' seed lalai).
    const desk = await dbGet(db, "SELECT * FROM adjung_desks LIMIT 1");
    if (!desk) throw new Error('Tiada adjung_desks seed — tak boleh uji.');

    const bilanganRuleSebelum = (await dbAll(db, "SELECT COUNT(*) as n FROM rss_desk_rules"))[0].n;

    // 1) memoryId yang LANGSUNG TAK WUJUD.
    const r1 = await klien('POST', '/api/system/editorial-memory/promote', {
      memoryId: 'memory-tak-wujud-xyz', deskName: desk.deskName, phrase: 'ujian frasa tak wujud',
    });
    const bilanganRuleSelepas1 = (await dbAll(db, "SELECT COUNT(*) as n FROM rss_desk_rules"))[0].n;
    console.log('Kes 1 (memoryId tak wujud): status =', r1.status, '| rules sebelum =', bilanganRuleSebelum, '| rules selepas =', bilanganRuleSelepas1);
    if (r1.status !== 404) throw new Error('DIJANGKA 404 utk memoryId tak wujud, dapat ' + r1.status);
    if (bilanganRuleSelepas1 !== bilanganRuleSebelum) {
      throw new Error(`GAGAL: baris rss_desk_rules TERCIPTA (${bilanganRuleSelepas1} > ${bilanganRuleSebelum}) walaupun respons 404 — bug pra-pembetulan reproduce.`);
    }

    // 2) memoryId SEDIA ADA tapi SUDAH 'promoted' (simulasi klik dua kali).
    await dbRun(db, "INSERT INTO rss_editorial_memory (id, phraseExtracted, suggestedDesk, status, createdAt) VALUES (?,?,?,?,?)",
      ['mem-ujian-1', 'frasa ujian', desk.deskName, 'promoted', new Date().toISOString()]);
    const r2 = await klien('POST', '/api/system/editorial-memory/promote', {
      memoryId: 'mem-ujian-1', deskName: desk.deskName, phrase: 'frasa ujian',
    });
    const bilanganRuleSelepas2 = (await dbAll(db, "SELECT COUNT(*) as n FROM rss_desk_rules"))[0].n;
    console.log('Kes 2 (memoryId sudah promoted): status =', r2.status, '| rules selepas =', bilanganRuleSelepas2);
    if (r2.status !== 404) throw new Error('DIJANGKA 404 utk memoryId sudah promoted, dapat ' + r2.status);
    if (bilanganRuleSelepas2 !== bilanganRuleSebelum) {
      throw new Error(`GAGAL: baris rss_desk_rules TERCIPTA (${bilanganRuleSelepas2} > ${bilanganRuleSebelum}) utk memoryId sudah-promoted — bug pra-pembetulan reproduce.`);
    }

    // 3) Laluan BAIK — memoryId sah, 'pending' — MESTI berjaya & cipta SATU baris.
    await dbRun(db, "INSERT INTO rss_editorial_memory (id, phraseExtracted, suggestedDesk, status, createdAt) VALUES (?,?,?,?,?)",
      ['mem-ujian-2', 'frasa sah', desk.deskName, 'pending', new Date().toISOString()]);
    const r3 = await klien('POST', '/api/system/editorial-memory/promote', {
      memoryId: 'mem-ujian-2', deskName: desk.deskName, phrase: 'frasa sah',
    });
    const bilanganRuleSelepas3 = (await dbAll(db, "SELECT COUNT(*) as n FROM rss_desk_rules"))[0].n;
    console.log('Kes 3 (memoryId sah/pending): status =', r3.status, r3.json, '| rules selepas =', bilanganRuleSelepas3);
    if (r3.status !== 200 || !r3.json?.success) throw new Error('DIJANGKA 200/success utk memoryId sah, dapat ' + r3.status + ' ' + JSON.stringify(r3.json));
    if (bilanganRuleSelepas3 !== bilanganRuleSebelum + 1) {
      throw new Error(`GAGAL: laluan baik sepatutnya cipta TEPAT satu baris baharu, dapat ${bilanganRuleSelepas3 - bilanganRuleSebelum}`);
    }
    const statusMem2 = (await dbGet(db, "SELECT status FROM rss_editorial_memory WHERE id = 'mem-ujian-2'")).status;
    if (statusMem2 !== 'promoted') throw new Error('GAGAL: status memori sepatutnya "promoted", dapat ' + statusMem2);

    console.log('\n✅ SEMUA KES LULUS — pembetulan sim60 disahkan.');
    db.close();
  } finally {
    proc.kill();
  }
};

run().catch((e) => { console.error('❌ SIM60 GAGAL:', e.message); process.exit(1); });
