// Sim: GET /api/system/content/:objectId/url-kod TIADA requireAuth DAN TIADA semakan
// status='approved' -- bandingkan dgn by-kod (yg check approved) dan og.png. Ujian: cipta
// kandungan PENDING (belum lulus semakan editorial), panggil /url-kod TANPA cookie sesi
// langsung, sahkan ia (a) berjaya (bukan 401/403), (b) bocor tajuk draf sebenar, (c) tulis
// (jana+simpan) urlKod kekal utk kandungan yg belum pernah diluluskan.
import { bukaDb, dbRun, bootServer, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const lapor = pelapor('urlkod-leak');
const PORT = 5991;
const DBFILE = path.join(REPO, '.simulasi', 'scratch-urlkod-leak.db');

const { proc, base } = await bootServer({ port: PORT, dbFile: DBFILE });
try {
  const db = bukaDb(DBFILE);
  const now = new Date().toISOString();
  const objId = 'obj-sim-urlkod-1';
  await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, slotIndex, createdAt, updatedAt)
    VALUES (?, 'manual', 'ekonomi', 5, ?, ?)`, [objId, now, now]);
  await dbRun(db, `INSERT INTO editorial_revisions (objectId, version, title, summary, status, createdAt, updatedAt, createdBy)
    VALUES (?, 1, ?, 'Ringkasan draf rahsia belum disemak.', 'pending', ?, ?, 'sim')`,
    [objId, 'TAJUK DRAF SULIT BELUM DILULUSKAN', now, now]);
  await new Promise((r) => db.close(r));

  // Tiada cookie langsung -- pelawat awam/bot tanpa log masuk.
  const r = await fetch(`${base}/api/system/content/${objId}/url-kod`);
  const body = await r.json().catch(() => null);
  if (r.status === 200) lapor.lulus(`status HTTP tanpa auth = ${r.status} (dijangka 401/403 kalau digerbang)`);
  else lapor.gagal('status HTTP tanpa auth', `status=${r.status}`);

  if (body && body.laluan) lapor.gagal('bocor laluan/tajuk draf belum diluluskan', JSON.stringify(body));
  else lapor.lulus('tiada laluan dibocorkan');

  if (body && body.kodPendek) lapor.gagal('urlKod dijana+ditulis kekal utk kandungan PENDING', JSON.stringify(body));
  else lapor.lulus('urlKod tidak dijana utk kandungan belum lulus');

  // Bandingkan laluan awam by-kod -- patut 404 sbb bukan approved (pengesahan status WUJUD di situ).
  if (body && body.kodPendek) {
    const r2 = await fetch(`${base}/api/system/content/by-kod/${body.kodPendek}`);
    if (r2.status === 404) lapor.lulus('laluan awam by-kod (ada gerbang status) tolak 404 kandungan pending sama, mengesahkan asimetri');
    else lapor.gagal('laluan awam by-kod sepatutnya 404', `status=${r2.status}`);
  }
} finally {
  proc.kill();
}
lapor.ringkasan();
