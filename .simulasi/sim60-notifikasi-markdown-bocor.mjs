// SIMULASI 60 — MARKDOWN MENTAH DALAM TAJUK ARTIKEL TAK BOLEH BOCOR KE PETI MAKLUMAN
// (2026-09-09, sambungan vein bug-hunt: PosterGenerator.tsx canvas + OgImageRenderer.js satori
// sudah dibaiki buang sintaks markdown sebelum render plain-text; MaklumanDrawer.tsx (Peti
// Makluman) papar `n.tajuk`/`n.kandungan` sebagai teks JSX literal SAMA gaya — laluan lain yang
// terlepas. Ujian ni cipta kandungan bertajuk mengandungi *condong* mentah, tolak-ke-draf, lalu
// baca terus baris `notifications` sebenar di DB — sahkan medan title/detail TIDAK mengandungi
// asterisk mentah selepas pembetulan (stripMarkdownEsm dipanggil sebelum notify()).
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, hashPassword, dbRun, dbAll, bukaDb,
  isiHuraianCukup, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5260;
const DBF = path.join(os.tmpdir(), 'sim-adjung-notif-markdown.db');
const lap = pelapor('SIM 60 — MARKDOWN TAK BOCOR KE NOTIFIKASI');

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  await ciptaPentadbir(DBF, { id: 'sim60-admin', username: 'sim60-admin', pass: 'AdminUjian!2026' });

  const db = bukaDb(DBF);
  const now = new Date().toISOString();
  const PASS_KE = 'KetuaUjian!2026';
  await dbRun(db, `INSERT OR REPLACE INTO users (id,username,email,role,password,penName,createdAt,updatedAt)
    VALUES ('sim60-ke','sim60-ke','sim60-ke@sim.test','KETUA_EDITOR',?,'Sim Ketua Editor',?,?)`,
    [hashPassword(PASS_KE), now, now]);
  await dbRun(db, "INSERT OR IGNORE INTO user_roles (userId,roleId) VALUES ('sim60-ke','ketua_editor')");
  // Editor kedua diamanahkan slot sama (bukan penulis) — supaya notifikasi 'kandungan_ditolak'
  // ada PENERIMA sebenar; penolakan-sendiri oleh penulis asal sengaja DISENYAPKAN (elak
  // bertindih dgn toast, lihat komen contentRoutes.js ~baris 1969), jadi ujian perlu editor lain.
  const PASS_EDITOR2 = 'EditorDua!2026';
  await dbRun(db, `INSERT OR REPLACE INTO users (id,username,email,role,password,penName,createdAt,updatedAt)
    VALUES ('sim60-editor2','sim60-editor2','sim60-editor2@sim.test','EDITOR',?,'Sim Editor Dua',?,?)`,
    [hashPassword(PASS_EDITOR2), now, now]);
  await dbRun(db, "INSERT OR IGNORE INTO user_roles (userId,roleId) VALUES ('sim60-editor2','editor')");
  const SLOT = 34;
  await dbRun(db, "INSERT OR IGNORE INTO slot_editors (slotIndex, editorId) VALUES (?, 'sim60-ke')", [SLOT]);
  await dbRun(db, "INSERT OR IGNORE INTO slot_editors (slotIndex, editorId) VALUES (?, 'sim60-editor2')", [SLOT]);
  await dbRun(db, "INSERT OR REPLACE INTO slots_config (layoutTemplateId, slotIndex, contentMode) VALUES ('frontpage', ?, 'Manual')", [SLOT]);
  await new Promise(r => db.close(r));

  const cookieKE = await login(srv.base, 'sim60-ke', PASS_KE);
  const ke = buatKlien(srv.base, cookieKE);

  await ke('PATCH', '/api/system/editor-publish-policy', { benarkanSelfPublish: true });

  // Tajuk sengaja ada sintaks *condong* mentah (editor guna Ctrl/Cmd+I di medan Tajuk, sah
  // dibenarkan sejak 2026-08-16 — lihat CLAUDE.md).
  const TAJUK = 'Ekonomi *Digital* Malaysia Berkembang Pesat';
  const huraian = isiHuraianCukup(ceilingForSlot, SLOT, TAJUK.length);
  const cipta = await ke('POST', '/api/system/content', {
    slotIndex: SLOT, title: TAJUK, summary: huraian, desk: 'UMUM', topik: 'UjianMarkdownNotif',
    source: 'Sim Test', url: 'https://sim.test/markdown-notif',
  });
  if (cipta.status !== 200 || !cipta.json?.id) {
    throw new Error(`Gagal cipta kandungan: ${cipta.status} ${cipta.teks.slice(0, 300)}`);
  }
  const id = cipta.json.id;
  await ke('PATCH', `/api/system/content/${id}`, { briefLong: HURAIAN_PANJANG_SAH });
  const lulus = await ke('PATCH', `/api/system/content/${id}`, { status: 'approved' });
  if (lulus.status !== 200) throw new Error(`Gagal lulus: ${lulus.status} ${lulus.teks.slice(0, 300)}`);
  lap.lulus('PERSEDIAAN: kandungan approved dicipta dengan tajuk mengandungi *condong* mentah');

  // Timpa atribut `editorName` supaya "penulis asal" ialah EDITOR KEDUA (bukan sim60-ke yang
  // akan menolak) — laluan notify() 'kandungan_ditolak' (contentRoutes.js) hantar kepada penulis
  // asal DAHULU, jatuh balik slot_editors hanya kalau editorName kosong/tak sepadan. Tanpa ni,
  // KE (penulis DAN penolak dlm ujian ni) akan ditapis keluar sepenuhnya (notification hygiene,
  // 2026-08-16) dan tiada baris notifikasi langsung terhasil — bukan ujian yang bermakna.
  const dbMid = bukaDb(DBF);
  await dbRun(dbMid, "UPDATE editorial_attribute_values SET valueText = 'Sim Editor Dua' WHERE objectId = ? AND attributeId = 'editorName'", [id]);
  await new Promise(r => dbMid.close(r));

  // Tolak-ke-draf — contentRoutes.js notify() 'kandungan_ditolak' guna rev.title terus dalam
  // `title` (rantaian) DAN sunting semula terbit (PATCH status=approved semula) akan cetus laluan
  // 'kandungan_disiar' guna `detail`. Kedua-dua laluan disemak.
  const tolak = await ke('POST', `/api/system/content/${id}/reject-to-draft`, { sebab: 'Ujian semula' });
  if (tolak.status !== 200) {
    throw new Error(`Gagal tolak-ke-draf: ${tolak.status} ${tolak.teks.slice(0, 300)}`);
  }
  lap.lulus('PERSEDIAAN: kandungan ditolak ke draf');

  const db2 = bukaDb(DBF);
  const rows = await dbAll(db2, "SELECT type, title, detail FROM notifications WHERE type = 'kandungan_ditolak' ORDER BY createdAt DESC LIMIT 5");
  await new Promise(r => db2.close(r));

  if (rows.length === 0) {
    lap.gagal('Tiada baris notifikasi kandungan_ditolak dijumpai — ujian tak sah', '');
  } else {
    const baris = rows[0];
    const gabungan = `${baris.title || ''} ${baris.detail || ''}`;
    if (gabungan.includes('*Digital*') || gabungan.includes('*')) {
      lap.gagal('UJIAN: baris notifikasi MASIH mengandungi asterisk markdown mentah!', JSON.stringify(baris));
    } else if (gabungan.includes('Digital')) {
      lap.lulus('UJIAN: notifikasi kandungan_ditolak buang sintaks *condong* (teks "Digital" kekal, asterisk hilang)');
    } else {
      lap.gagal('UJIAN: tajuk tak dijumpai langsung dalam notifikasi (ujian mungkin tak sah)', JSON.stringify(baris));
    }
  }

  lap.ringkasan();
} finally {
  srv.proc.kill();
}
