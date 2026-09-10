// Simulasi verifikasi ADHOC (bug-hunt round #279) — mengesahkan pembetulan falsy-zero
// pada Number(orderIndex/displayOrder) || 10 di tiga tempat cipta slotRoutes.js:
// rss-text-rules POST, adjung-desks POST, rss-desk-rules POST.
import path from 'node:path';
import { bootServer, ciptaPentadbir, login, buatKlien, bukaDb, dbGet, REPO } from './sim-lib.mjs';

const PORT = 5299;
const DB = path.join(REPO, '.simulasi', 'scratch-verify-orderindex-zero.db');

async function main() {
  const { proc } = await bootServer({ port: PORT, dbFile: DB, freshDb: true });
  try {
    await ciptaPentadbir(DB);
    const base = `http://localhost:${PORT}`;
    const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
    const api = buatKlien(base, cookie);
    const db = bukaDb(DB);

    let fails = 0;
    const check = (label, cond) => {
      console.log((cond ? 'LULUS' : 'GAGAL') + ' — ' + label);
      if (!cond) fails++;
    };

    // 1) rss-text-rules: orderIndex: 0 mesti kekal 0
    const r1 = await api('POST', '/api/system/rss-text-rules', {
      ruleName: 'Ujian Sifar', ruleType: 'substitute', scope: 'brief',
      pattern: 'a', replacement: 'b', orderIndex: 0,
    });
    check('POST rss-text-rules berjaya', r1.ok && r1.json?.id);
    const row1 = await dbGet(db, 'SELECT orderIndex FROM rss_text_rules WHERE id = ?', [r1.json.id]);
    check('rss_text_rules.orderIndex = 0 (bukan 10)', row1?.orderIndex === 0);

    // 1b) undefined orderIndex mesti default 10 (kes biasa tak terjejas)
    const r1b = await api('POST', '/api/system/rss-text-rules', {
      ruleName: 'Ujian Lalai', ruleType: 'substitute', scope: 'brief',
      pattern: 'c', replacement: 'd',
    });
    const row1b = await dbGet(db, 'SELECT orderIndex FROM rss_text_rules WHERE id = ?', [r1b.json.id]);
    check('rss_text_rules.orderIndex lalai = 10 bila tak dihantar', row1b?.orderIndex === 10);

    // 2) adjung-desks: displayOrder: 0 mesti kekal 0
    const r2 = await api('POST', '/api/system/adjung-desks', {
      deskName: 'Desk Ujian Sifar ' + Date.now(), displayOrder: 0,
    });
    check('POST adjung-desks berjaya', r2.ok && r2.json?.id);
    const row2 = await dbGet(db, 'SELECT displayOrder FROM adjung_desks WHERE id = ?', [r2.json.id]);
    check('adjung_desks.displayOrder = 0 (bukan 10)', row2?.displayOrder === 0);

    const r2b = await api('POST', '/api/system/adjung-desks', {
      deskName: 'Desk Ujian Lalai ' + Date.now(),
    });
    const row2b = await dbGet(db, 'SELECT displayOrder FROM adjung_desks WHERE id = ?', [r2b.json.id]);
    check('adjung_desks.displayOrder lalai = 10 bila tak dihantar', row2b?.displayOrder === 10);

    // 3) rss-desk-rules: orderIndex: 0 mesti kekal 0
    const r3 = await api('POST', '/api/system/rss-desk-rules', {
      deskId: r2.json.id, keyword: 'ujian-sifar', weight: 15, orderIndex: 0,
    });
    check('POST rss-desk-rules berjaya', r3.ok && r3.json?.id);
    const row3 = await dbGet(db, 'SELECT orderIndex FROM rss_desk_rules WHERE id = ?', [r3.json.id]);
    check('rss_desk_rules.orderIndex = 0 (bukan 10)', row3?.orderIndex === 0);

    const r3b = await api('POST', '/api/system/rss-desk-rules', {
      deskId: r2.json.id, keyword: 'ujian-lalai', weight: 15,
    });
    const row3b = await dbGet(db, 'SELECT orderIndex FROM rss_desk_rules WHERE id = ?', [r3b.json.id]);
    check('rss_desk_rules.orderIndex lalai = 10 bila tak dihantar', row3b?.orderIndex === 10);

    db.close();
    proc.kill();
    if (fails > 0) { console.error(`\n${fails} semakan GAGAL`); process.exit(1); }
    console.log('\nSemua semakan LULUS.');
  } catch (e) {
    proc.kill();
    throw e;
  }
}

main().catch(e => { console.error(e); process.exit(1); });
