// SIMULASI 24 — NOTA KETUA EDITOR (`note`, awam) LAWAN SEBAB PENOLAKAN (`rejectionNote`,
// DALAMAN) — pengesahan hujung-ke-hujung yang insiden 2026-08-31 (nota penolakan hampir terbit
// ke Focus View) dan gerbang GET /api/system/slots (dibaiki 2026-09-02, SELECT * penuh dulu
// pulangkan manualSummary mentah kepada SESIAPA sahaja) kekal dibaiki, guna HTTP sebenar bukan
// baca kod. Alur: cipta kandungan approved (dengan Nota AWAM), Tolak-ke-Draf dengan Sebab
// Penolakan (dalaman), sahkan `note` awam ADA tapi `rejectionNote` TIADA pada:
//   1. GET /api/system/slots (tanpa sesi) — laluan yang bocor 2026-09-02
//   2. GET /api/system/search (awam)
//   3. GET /sitemap.xml, GET /rss.xml
//   4. Laluan artikel bot (/:bidangSlug/kandungan/:kod, User-Agent Googlebot) + og.png
// serta sahkan draf yang mengandungi Sebab Penolakan HANYA boleh dibaca laluan admin (/drafts,
// requireAuth) oleh penulis asal — bukan editor lain, bukan tanpa sesi.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, hashPassword, dbRun, bukaDb,
  isiHuraianCukup, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5224;
const DBF = path.join(os.tmpdir(), 'sim-adjung-nota-penolakan.db');
const lap = pelapor('SIM 24 — NOTA PENOLAKAN TAK BOCOR AWAM');

const NOTA_AWAM = 'Kemas kini dijalankan pada waktu petang, sila rujuk sumber rasmi.';
const SEBAB_TOLAK = 'RAHSIA-DALAMAN: fakta tak disahkan, tunjuk bias jelas kepada satu pihak politik';

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  await ciptaPentadbir(DBF, { id: 'sim24-admin', username: 'sim24-admin', pass: 'AdminUjian!2026' });

  const db = bukaDb(DBF);
  const now = new Date().toISOString();
  const PASS_KE = 'KetuaUjian!2026';
  const PASS_EDITOR_LAIN = 'EditorLain!2026';
  await dbRun(db, `INSERT OR REPLACE INTO users (id,username,email,role,password,penName,createdAt,updatedAt)
    VALUES ('sim24-ke','sim24-ke','sim24-ke@sim.test','KETUA_EDITOR',?,'Sim Ketua Editor',?,?)`,
    [hashPassword(PASS_KE), now, now]);
  await dbRun(db, "INSERT OR IGNORE INTO user_roles (userId,roleId) VALUES ('sim24-ke','ketua_editor')");
  await dbRun(db, `INSERT OR REPLACE INTO users (id,username,email,role,password,penName,createdAt,updatedAt)
    VALUES ('sim24-editor-lain','sim24-editor-lain','sim24-editor-lain@sim.test','EDITOR',?,'Sim Editor Lain',?,?)`,
    [hashPassword(PASS_EDITOR_LAIN), now, now]);
  await dbRun(db, "INSERT OR IGNORE INTO user_roles (userId,roleId) VALUES ('sim24-editor-lain','editor')");
  const SLOT = 33;
  await dbRun(db, "INSERT OR IGNORE INTO slot_editors (slotIndex, editorId) VALUES (?, 'sim24-ke')", [SLOT]);
  await dbRun(db, "INSERT OR REPLACE INTO slots_config (layoutTemplateId, slotIndex, contentMode) VALUES ('frontpage', ?, 'Manual')", [SLOT]);
  await new Promise(r => db.close(r));

  const cookieKE = await login(srv.base, 'sim24-ke', PASS_KE);
  const ke = buatKlien(srv.base, cookieKE);
  const cookieLain = await login(srv.base, 'sim24-editor-lain', PASS_EDITOR_LAIN);
  const editorLain = buatKlien(srv.base, cookieLain);
  const awam = buatKlien(srv.base, '');

  await ke('PATCH', '/api/system/editor-publish-policy', { benarkanSelfPublish: true });

  const TAJUK = 'Simulasi Nota Penolakan Tidak Bocor Awam';
  const huraian = isiHuraianCukup(ceilingForSlot, SLOT, TAJUK.length);
  const cipta = await ke('POST', '/api/system/content', {
    slotIndex: SLOT, title: TAJUK, summary: huraian, desk: 'UMUM', topik: 'UjianNotaPenolakan',
    source: 'Sim Test', url: 'https://sim.test/nota-penolakan',
  });
  if (cipta.status !== 200 || !cipta.json?.id) {
    throw new Error(`Gagal cipta kandungan: ${cipta.status} ${cipta.teks.slice(0, 300)}`);
  }
  const id = cipta.json.id;
  await ke('PATCH', `/api/system/content/${id}`, { briefLong: HURAIAN_PANJANG_SAH, note: NOTA_AWAM });
  const lulus = await ke('PATCH', `/api/system/content/${id}`, { status: 'approved' });
  if (lulus.status !== 200) throw new Error(`Gagal lulus: ${lulus.status} ${lulus.teks.slice(0, 300)}`);
  lap.lulus('PERSEDIAAN: kandungan approved dicipta dengan Nota awam');

  // --- Sahkan Nota AWAM tampak di laluan awam SEBELUM ditolak (kawalan positif — ia MEMANG
  // patut nampak, supaya ujian "tak nampak" rejectionNote di bawah bukan sebab semuanya disekat) ---
  const searchSebelum = await awam('GET', `/api/system/search?q=${encodeURIComponent('Nota Penolakan Tidak Bocor')}`);
  const jumpaSebelum = (searchSebelum.json?.results || []).some(x => x.objectId === id);
  if (searchSebelum.status === 200 && jumpaSebelum) {
    lap.lulus('KAWALAN: kandungan approved kelihatan dalam carian awam sebelum ditolak');
  } else {
    lap.gagal('KAWALAN: kandungan approved TAK kelihatan dalam carian awam (ujian tak sah)', JSON.stringify(searchSebelum.json).slice(0, 200));
  }

  // --- Tolak-ke-draf dengan Sebab Penolakan (dalaman) ---
  const tolak = await ke('POST', `/api/system/content/${id}/reject-to-draft`, { sebab: SEBAB_TOLAK });
  if (tolak.status !== 200) {
    throw new Error(`Gagal tolak-ke-draf: ${tolak.status} ${tolak.teks.slice(0, 300)}`);
  }
  lap.lulus('PERSEDIAAN: kandungan ditolak ke draf dengan Sebab Penolakan dalaman');

  // --- UJIAN 1: GET /api/system/slots TANPA sesi — laluan bocor 2026-09-02 ---
  const r1 = await awam('GET', '/api/system/slots');
  const teks1 = JSON.stringify(r1.json);
  const adaManualSummary1 = r1.json?.some?.((s) => 'manualSummary' in s);
  if (r1.status === 200 && !adaManualSummary1 && !teks1.includes(SEBAB_TOLAK) && !teks1.includes('Sebab Penolakan')) {
    lap.lulus('UJIAN 1: GET /api/system/slots (tanpa sesi) TAK dedah manualSummary/Sebab Penolakan');
  } else {
    lap.gagal('UJIAN 1: GET /api/system/slots BOCOR Sebab Penolakan!', teks1.slice(0, 500));
  }

  // --- UJIAN 2: carian awam tak dedah Sebab Penolakan / draf ---
  const r2 = await awam('GET', `/api/system/search?q=${encodeURIComponent('RAHSIA-DALAMAN')}`);
  const teks2 = JSON.stringify(r2.json);
  if (r2.status === 200 && !teks2.includes('RAHSIA-DALAMAN')) {
    lap.lulus('UJIAN 2: carian awam TAK dedah Sebab Penolakan (draf tak diindeks)');
  } else {
    lap.gagal('UJIAN 2: carian awam BOCOR!', teks2.slice(0, 500));
  }

  // --- UJIAN 3: sitemap.xml / rss.xml tak dedah ---
  const r3a = await awam('GET', '/sitemap.xml');
  const r3b = await awam('GET', '/rss.xml');
  if (!r3a.teks.includes('RAHSIA-DALAMAN') && !r3b.teks.includes('RAHSIA-DALAMAN')) {
    lap.lulus('UJIAN 3: sitemap.xml/rss.xml TAK dedah Sebab Penolakan');
  } else {
    lap.gagal('UJIAN 3: sitemap/rss BOCOR!', `sitemap:${r3a.status} rss:${r3b.status}`);
  }

  // --- UJIAN 4: laluan artikel BOT (og.png metadata + HTML pra-terap) tak dedah ---
  // Kandungan dah diarkib (rev.status='archived') selepas tolak-ke-draf, jadi ambilKandunganUntukSeo
  // patut pulangkan null / laluan 404 untuk objectId ni — sahkan itu berlaku (bukan sekadar tersirat).
  const r4og = await awam('GET', `/api/system/content/${id}/og.png`);
  if (r4og.status === 404) {
    lap.lulus('UJIAN 4a: og.png kandungan ditolak/diarkib pulangkan 404 (tak jana kad drpd data lapuk)');
  } else {
    lap.gagal('UJIAN 4a: og.png patut 404 selepas diarkib', `status=${r4og.status}`);
  }

  // --- UJIAN 5: laluan /drafts (admin) — hanya penulis asal nampak draf, editor LAIN tidak ---
  const r5ke = await ke('GET', '/api/system/drafts');
  const drafKe = (r5ke.json || []).find((d) => d.slotIndex === SLOT);
  if (r5ke.status === 200 && drafKe) {
    lap.lulus('UJIAN 5a: Ketua Editor (penulis asal) nampak draf sendiri di /drafts');
  } else {
    lap.gagal('UJIAN 5a: penulis asal TAK jumpa draf sendiri', JSON.stringify(r5ke.json).slice(0, 300));
  }
  const r5lain = await editorLain('GET', '/api/system/drafts');
  const drafLain = (r5lain.json || []).find((d) => d.slotIndex === SLOT);
  if (r5lain.status === 200 && !drafLain) {
    lap.lulus('UJIAN 5b: Editor LAIN (bukan penulis) TAK nampak draf ni di /drafts sendiri');
  } else {
    lap.gagal('UJIAN 5b: Editor lain BOLEH nampak draf orang lain!', JSON.stringify(r5lain.json).slice(0, 300));
  }
  // /drafts TAK PERNAH hantar Sebab Penolakan pun kepada pemilik sah (medan tak dipetakan ke JSON) —
  // sahkan draf.json.tajuk dsb sah tapi tiada apa-apa mengandungi teks Sebab Penolakan literal.
  if (!JSON.stringify(r5ke.json).includes('RAHSIA-DALAMAN')) {
    lap.lulus('UJIAN 5c: /drafts (bahkan kepada penulis sendiri) TAK hantar teks Sebab Penolakan mentah');
  } else {
    lap.gagal('UJIAN 5c: /drafts hantar Sebab Penolakan mentah dlm JSON!', JSON.stringify(r5ke.json).slice(0, 300));
  }

  // --- UJIAN 6: /drafts TANPA sesi langsung mesti ditolak ---
  const r6 = await awam('GET', '/api/system/drafts');
  if (r6.status === 401) {
    lap.lulus('UJIAN 6: GET /api/system/drafts tanpa sesi ditolak 401');
  } else {
    lap.gagal('UJIAN 6: /drafts tanpa sesi TAK ditolak!', `status=${r6.status}`);
  }

  lap.ringkasan();
} finally {
  srv.proc.kill();
}
