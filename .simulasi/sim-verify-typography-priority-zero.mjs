// Simulasi verifikasi ADHOC (bug-hunt, 2026-09-11) — mengesahkan pembetulan falsy-zero
// pada Number(priority) || 50 di POST /api/system/adjung-typography-rules (core/routes/slotRoutes.js),
// sama kelas pepijat yang dibaiki round #278/#279 pada rss-text-rules/adjung-desks/rss-desk-rules.
import path from 'node:path';
import { bootServer, ciptaPentadbir, login, buatKlien, bukaDb, dbGet, REPO } from './sim-lib.mjs';

const PORT = 5301;
const DB = path.join(REPO, '.simulasi', 'scratch-verify-typography-priority-zero.db');

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

    // 1) priority: 0 mesti kekal 0 (bukan ditukar 50)
    const r1 = await api('POST', '/api/system/adjung-typography-rules', {
      term: 'ujian-sifar-' + Date.now(), priority: 0,
    });
    check('POST adjung-typography-rules (priority=0) berjaya', r1.ok && r1.json?.id);
    const row1 = await dbGet(db, 'SELECT priority FROM adjung_typography_rules WHERE id = ?', [r1.json.id]);
    check('adjung_typography_rules.priority = 0 (bukan 50)', row1?.priority === 0);

    // 2) priority tak dihantar mesti default 50 (kes biasa tak terjejas)
    const r2 = await api('POST', '/api/system/adjung-typography-rules', {
      term: 'ujian-lalai-' + Date.now(),
    });
    check('POST adjung-typography-rules (tiada priority) berjaya', r2.ok && r2.json?.id);
    const row2 = await dbGet(db, 'SELECT priority FROM adjung_typography_rules WHERE id = ?', [r2.json.id]);
    check('adjung_typography_rules.priority lalai = 50 bila tak dihantar', row2?.priority === 50);

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
