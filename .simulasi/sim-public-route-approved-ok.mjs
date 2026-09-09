// Sim positif-kawalan bagi fix sim-public-route-title-leak.mjs -- pastikan kandungan APPROVED
// biasa (tiada revisi lebih baharu di atasnya) MASIH redirect 301 ke laluan kanonikal betul
// (regresi sengaja dielak: fix tak patut pecahkan kes biasa/paling kerap).
import { bukaDb, dbRun, bootServer, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const lapor = pelapor('public-route-approved-ok');
const PORT = 5993;
const DBFILE = path.join(REPO, '.simulasi', 'scratch-public-route-approved-ok.db');

const { proc, base } = await bootServer({ port: PORT, dbFile: DBFILE });
try {
  const db = bukaDb(DBFILE);
  const now = new Date().toISOString();
  const objId = 'obj-sim-ok-1';
  const kod = 'ab12cd';
  await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, slotIndex, urlKod, createdAt, updatedAt)
    VALUES (?, 'manual', 'ekonomi', 5, ?, ?, ?)`, [objId, kod, now, now]);
  await dbRun(db, `INSERT INTO editorial_revisions (objectId, version, title, summary, status, createdAt, updatedAt, createdBy)
    VALUES (?, 1, 'Tajuk Awam Sudah Diluluskan', 'Ringkasan awam sah.', 'approved', ?, ?, 'sim')`,
    [objId, now, now]);
  await new Promise((r) => db.close(r));

  const r = await fetch(`${base}/salah-slug-${kod}/kandungan/${kod}`, { redirect: 'manual' });
  const lokasi = r.headers.get('location') || '';
  console.log('status=', r.status, 'location=', lokasi);
  if (r.status === 301 && lokasi.includes('tajuk-awam-sudah-diluluskan') && lokasi.endsWith(kod)) {
    lapor.lulus('kandungan approved biasa masih redirect 301 ke laluan kanonikal betul');
  } else {
    lapor.gagal('kandungan approved biasa TAK redirect betul (regresi)', `status=${r.status} location=${lokasi}`);
  }
} finally {
  proc.kill();
}
lapor.ringkasan();
