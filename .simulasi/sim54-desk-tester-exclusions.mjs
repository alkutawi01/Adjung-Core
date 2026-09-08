// Sim 54: "Live Tester" klasifikasi Desk (/api/system/rss-desk-rules/test) mesti terpakai
// peraturan Pengecualian Global SAMA seperti laluan RSS Direct sebenar — sebelum pembetulan ni,
// endpoint tester langsung tak baca rss_global_exclusion_rules, jadi pratonton editor tak jujur.
import { bootServer, ciptaPentadbir, login, buatKlien, dbRun, bukaDb, REPO } from './sim-lib.mjs';
import path from 'node:path';

const dbFile = path.join(REPO, '.simulasi', 'scratch-sim54.db');
const PORT = 8954;

const { pelapor } = await import('./sim-lib.mjs').then(m => ({ pelapor: m.pelapor }));
const lapor = pelapor('sim54-desk-tester-exclusions');

const { proc, base } = await bootServer({ port: PORT, dbFile });
try {
  const { username, pass } = await ciptaPentadbir(dbFile);
  const cookie = await login(base, username, pass);
  const k = buatKlien(base, cookie);

  const db = bukaDb(dbFile);
  const now = new Date().toISOString();
  // Desk "Ekonomi" (skor asas melalui keyword umum) — akan tersasar bila teks juga ada isyarat sukan.
  await dbRun(db, `INSERT INTO adjung_desks (id, deskName, enabled, displayOrder, createdAt)
    VALUES ('desk-sim-eko', 'Ekonomi Sim', 1, 1, ?)`, [now]);
  await dbRun(db, `INSERT INTO adjung_desks (id, deskName, enabled, displayOrder, createdAt)
    VALUES ('desk-sim-sukan', 'Sukan Sim', 1, 2, ?)`, [now]);
  await dbRun(db, `INSERT INTO rss_desk_rules (id, deskId, keyword, weight, isNegative, enabled, orderIndex, createdAt)
    VALUES ('rule-sim-1', 'desk-sim-eko', 'saham', 40, 0, 1, 1, ?)`, [now]);
  // Peraturan Pengecualian Global: kalau teks sebut "piala", tolak skor Ekonomi Sim.
  await dbRun(db, `INSERT INTO rss_global_exclusion_rules (id, keyword, penaltyWeight, targetDesksExcluded, enabled, createdAt)
    VALUES ('gex-sim-1', 'piala', 100, 'Ekonomi Sim', 1, ?)`, [now]);
  await new Promise((r) => db.close(r));

  const teksUjian = { testTitle: 'Saham dan piala', testBrief: 'Berita saham semasa piala berlangsung', testCategory: '' };
  const res = await k('POST', '/api/system/rss-desk-rules/test', teksUjian);
  if (!res.ok) {
    lapor.gagal('Panggilan tester gagal', JSON.stringify(res.json || res.teks));
  } else {
    const ekoScore = (res.json.scores || []).find((s) => s.desk === 'Ekonomi Sim');
    console.log('Keputusan tester:', JSON.stringify(res.json.scores));
    // Sebelum fix: skor Ekonomi Sim = round(40*1.5) = 60 (pengecualian TAK terpakai).
    // Selepas fix: skor mesti ditolak 100 (penaltyWeight) -> <= 0 (dipangkas Math.max(0, ...)).
    if (ekoScore && ekoScore.score > 0) {
      lapor.gagal('Peraturan Pengecualian Global TIDAK terpakai dalam tester',
        `Skor Ekonomi Sim = ${ekoScore.score}, patut 0 (60 - 100 penalti, dipangkas ke 0)`);
    } else {
      lapor.lulus(`Peraturan Pengecualian Global terpakai — skor Ekonomi Sim = ${ekoScore ? ekoScore.score : '(tiada)'}`);
    }
  }
} finally {
  proc.kill();
  lapor.ringkasan();
}
