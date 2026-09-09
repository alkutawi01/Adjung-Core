// Sim regresi: kandungan 'approved' KEKAL berfungsi penuh di /url-kod selepas gerbang status
// ditambah (sim-urlkod-leak.mjs menguji kandungan PENDING ditolak; ni pastikan approved TAK
// terjejas -- pembetulan gerbang mesti simetri dgn /by-kod, bukan sekat semua).
import { bukaDb, dbRun, bootServer, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const lapor = pelapor('urlkod-approved-ok');
const PORT = 5992;
const DBFILE = path.join(REPO, '.simulasi', 'scratch-urlkod-approved-ok.db');

const { proc, base } = await bootServer({ port: PORT, dbFile: DBFILE });
try {
  const db = bukaDb(DBFILE);
  const now = new Date().toISOString();
  const objId = 'obj-sim-urlkod-ok-1';
  await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, slotIndex, createdAt, updatedAt)
    VALUES (?, 'manual', 'ekonomi', 5, ?, ?)`, [objId, now, now]);
  await dbRun(db, `INSERT INTO editorial_revisions (objectId, version, title, summary, status, createdAt, updatedAt, createdBy)
    VALUES (?, 1, ?, 'Ringkasan kandungan sah yang sudah diluluskan.', 'approved', ?, ?, 'sim')`,
    [objId, 'Kandungan Sah Sudah Diterbitkan', now, now]);
  await new Promise((r) => db.close(r));

  const r = await fetch(`${base}/api/system/content/${objId}/url-kod`);
  const body = await r.json().catch(() => null);
  if (r.status === 200 && body && body.kodPendek && body.laluan) lapor.lulus(`kandungan approved terus dpt kod+laluan: ${JSON.stringify(body)}`);
  else lapor.gagal('kandungan approved sepatutnya 200 + kodPendek + laluan', `status=${r.status} body=${JSON.stringify(body)}`);

  if (body && body.kodPendek) {
    const r2 = await fetch(`${base}/api/system/content/by-kod/${body.kodPendek}`);
    if (r2.ok) lapor.lulus('laluan awam by-kod padan semula utk kod yg dijana');
    else lapor.gagal('by-kod sepatutnya berjaya utk kandungan approved', `status=${r2.status}`);
  }
} finally {
  proc.kill();
}
lapor.ringkasan();
