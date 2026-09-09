// Sim: GET /:bidangSlug/kandungan/:kodPendek (createPublicArticleRoute, articleUrlRoutes.js) --
// laluan AWAM ni bina redirect 301 kanonikal drpd tajuk REVISI TERKINI (ORDER BY version DESC,
// TIADA tapisan status='approved') sebelum sebarang gerbang "approved" disemak. Kandungan yang
// pernah diluluskan (ada urlKod) tapi kini sedang disunting semula (Semakan Kandungan cipta
// revisi BAHARU berstatus 'pending' pada objectId SAMA, versi naik -- lihat CLAUDE.md "Dua
// laluan edit selepas terbit") akan bocorkan TAJUK DRAF (belum diluluskan) tu terus dalam header
// Location -- kepada SESIAPA (bot/pengguna, tanpa cookie langsung) yang tahu/simpan pautan lama
// kandungan tu. Ujian: cipta objek dgn v1 approved (ada urlKod) + v2 pending (tajuk berbeza),
// panggil laluan awam guna urlKod lama, sahkan redirect TAK bocorkan tajuk v2.
import { bukaDb, dbRun, bootServer, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const lapor = pelapor('public-route-title-leak');
const PORT = 5992;
const DBFILE = path.join(REPO, '.simulasi', 'scratch-public-route-title-leak.db');

const { proc, base } = await bootServer({ port: PORT, dbFile: DBFILE });
try {
  const db = bukaDb(DBFILE);
  const now = new Date().toISOString();
  const objId = 'obj-sim-leak-1';
  const kod = 'x9k2mq';
  await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, slotIndex, urlKod, createdAt, updatedAt)
    VALUES (?, 'manual', 'ekonomi', 5, ?, ?, ?)`, [objId, kod, now, now]);
  await dbRun(db, `INSERT INTO editorial_revisions (objectId, version, title, summary, status, createdAt, updatedAt, createdBy)
    VALUES (?, 1, 'Tajuk Awam Sudah Diluluskan', 'Ringkasan awam sah.', 'approved', ?, ?, 'sim')`,
    [objId, now, now]);
  await dbRun(db, `INSERT INTO editorial_revisions (objectId, version, title, summary, status, createdAt, updatedAt, createdBy)
    VALUES (?, 2, ?, 'Ringkasan draf belum disemak.', 'pending', ?, ?, 'sim')`,
    [objId, 'TAJUK DRAF SULIT BELUM DILULUSKAN SELEPAS SUNTING SEMULA', now, now]);
  await new Promise((r) => db.close(r));

  // Tiada cookie langsung -- pelawat awam/bot tanpa log masuk, guna pautan LAMA (slug lapuk tak
  // penting -- laluan ekstrak 6 aksara terakhir sahaja) supaya cetuskan cawangan redirect 301.
  const r = await fetch(`${base}/tajuk-awam-sudah-diluluskan-${kod}/kandungan/${kod}`, { redirect: 'manual' });
  const lokasi = r.headers.get('location') || '';
  console.log('status=', r.status, 'location=', lokasi);

  if (r.status >= 300 && r.status < 400) {
    if (lokasi.toLowerCase().includes('tajuk-draf-sulit')) {
      lapor.gagal('redirect 301 bocorkan tajuk DRAF (v2 pending) belum diluluskan', lokasi);
    } else {
      lapor.lulus('redirect tidak bocorkan tajuk draf (guna tajuk approved sahaja / tiada redirect)');
    }
  } else {
    lapor.lulus(`tiada redirect (status=${r.status}) -- tiada peluang bocor via Location`);
  }
} finally {
  proc.kill();
}
lapor.ringkasan();
