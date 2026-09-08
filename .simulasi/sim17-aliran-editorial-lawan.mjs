// SIMULASI 17 — ALIRAN EDITORIAL LAWAN (adversarial extension of sim16).
//
// Menguji dua senario TIDAK diliputi sim16 (yang cuma uji laluan JAYA/happy-path):
//
// SENARIO A — Editor B (BUKAN penulis, TIADA pemilikan) cuba PATCH tajuk draf Editor A yang
// MASIH 'pending' (belum lulus) — mesti ditolak 403 oleh gerbang pemilikan (contentRoutes.js
// ~baris 818), sama macam kes 'approved' yang sim16 dah sahkan. sim16 cuma uji kes SUDAH lulus;
// simulasi ni sahkan gerbang sama berkuat kuasa PALING AWAL (draf belum disemak KE langsung).
//
// SENARIO B — Ketua Editor tukar matriks RBAC (`POST /api/system/settings` dgn
// `rolePermissions`, gerbang `manageRbac`) matikan `editOwn` peranan 'editor' SEMASA Editor A
// sudah log masuk (sesi sedia ada, TIDAK log keluar). Editor A cuba PATCH tajuk kandungan
// SENDIRI yang sudah 'approved' -- WAJIB 403 SERTA-MERTA (tanpa perlu log keluar/masuk semula),
// sebab `hasPermission()` (core/middleware/auth.js) baca `cachedPermissions` modul SEGAR setiap
// permintaan, BUKAN nilai dicap dalam sesi. Ini uji gerbang `editOwn` bertindak balas hidup pada
// perubahan matriks, bukan cuma peranan ditarik (userAdminRoutes.js dah ada ujian sedia ada utk
// tukar PERANAN akaun -- ni tukar KEBENARAN peranan tu sendiri).
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, hashPassword, dbRun, dbGet, bukaDb,
  isiHuraianCukup, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5217;
const DBF = path.join(os.tmpdir(), 'sim-adjung-aliran-editorial-lawan.db');
const lap = pelapor('SIM 17 — ALIRAN EDITORIAL LAWAN (adversarial)');
const SLOT = 21; // STANDARD, lain drpd sim16 (elak perlanggaran fixture)

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  await ciptaPentadbir(DBF, { id: 'sim-ke', username: 'sim-ke', pass: 'KetuaUjian!2026' });

  const db = bukaDb(DBF);
  const now = new Date().toISOString();
  const PASS_EDITOR = 'EditorUjian!2026';
  await dbRun(db, `INSERT OR REPLACE INTO users (id,username,email,role,password,penName,createdAt,updatedAt)
    VALUES ('sim-editor-a','sim-editor-a','sim-editor-a@sim.test','EDITOR',?,'Sim Editor A',?,?)`,
    [hashPassword(PASS_EDITOR), now, now]);
  await dbRun(db, "INSERT OR IGNORE INTO user_roles (userId,roleId) VALUES ('sim-editor-a','editor')");
  await dbRun(db, `INSERT OR REPLACE INTO users (id,username,email,role,password,penName,createdAt,updatedAt)
    VALUES ('sim-editor-b','sim-editor-b','sim-editor-b@sim.test','EDITOR',?,'Sim Editor B',?,?)`,
    [hashPassword(PASS_EDITOR), now, now]);
  await dbRun(db, "INSERT OR IGNORE INTO user_roles (userId,roleId) VALUES ('sim-editor-b','editor')");
  await dbRun(db, "INSERT OR IGNORE INTO slot_editors (slotIndex, editorId) VALUES (?, 'sim-editor-a')", [SLOT]);
  await dbRun(db, "INSERT OR IGNORE INTO slot_editors (slotIndex, editorId) VALUES (?, 'sim-editor-b')", [SLOT]);
  await dbRun(db, "INSERT OR REPLACE INTO slots_config (layoutTemplateId, slotIndex, contentMode) VALUES ('frontpage', ?, 'Manual')", [SLOT]);
  await new Promise(r => db.close(r));

  const cookieKE = await login(srv.base, 'sim-ke', 'KetuaUjian!2026');
  const ke = buatKlien(srv.base, cookieKE);
  const cookieEditorA = await login(srv.base, 'sim-editor-a', PASS_EDITOR);
  const editorA = buatKlien(srv.base, cookieEditorA);
  const cookieEditorB = await login(srv.base, 'sim-editor-b', PASS_EDITOR);
  const editorB = buatKlien(srv.base, cookieEditorB);

  // Dasar Terbit Sendiri Editor dimatikan supaya draf lahir 'pending' (bukan terus 'approved').
  const dasar = await ke('PATCH', '/api/system/editor-publish-policy', { benarkanSelfPublish: false });
  if (dasar.status === 200) lap.lulus('PERSEDIAAN: Dasar Terbit Sendiri Editor dimatikan');
  else lap.gagal('PERSEDIAAN: GAGAL matikan dasar terbit sendiri', `${dasar.status} ${dasar.teks.slice(0, 200)}`);

  // ---- SENARIO A: PATCH oleh editor lain pada draf PENDING (belum lulus) ----
  const { maxTitle } = ceilingForSlot(SLOT);
  const tajuk = 'Draf Ujian Senario A Pemilikan Pending';
  const huraian = isiHuraianCukup(ceilingForSlot, SLOT, tajuk.length);
  const cipta = await editorA('POST', '/api/system/content', {
    slotIndex: SLOT, title: tajuk, summary: huraian, desk: 'UMUM', topik: 'Ujian Lawan',
    source: 'Sim Test', url: 'https://sim.test/artikel-a',
  });
  if (cipta.status !== 200 || !cipta.json?.id) {
    lap.gagal('A1: Editor A gagal cipta draf', `${cipta.status} ${cipta.teks.slice(0, 300)}`);
    throw new Error('Tak boleh teruskan tanpa draf.');
  }
  const objectId = cipta.json.id;
  lap.lulus(`A1: Editor A cipta draf ${objectId}`);

  const statusAwal = await dbGetStatus(DBF, objectId);
  if (statusAwal === 'pending') lap.lulus('A2: Draf lahir status pending (belum disemak KE)');
  else lap.gagal('A2: Draf TIDAK lahir pending', `status sebenar: ${statusAwal}`);

  // Editor B (assigned slot SAMA, ditugaskan SELEPAS Editor A) cuba sunting draf PENDING Editor A.
  const cubaanB = await editorB('PATCH', `/api/system/content/${objectId}`, { title: 'Dirampas Editor B (patut gagal)' });
  if (cubaanB.status === 403) {
    lap.lulus('A3: Editor B (bukan penulis) DITOLAK 403 menyunting draf PENDING Editor A -- gerbang pemilikan berkuat kuasa walau belum lulus');
  } else {
    lap.gagal('A3: GERBANG PEMILIKAN GAGAL sekat Editor B menyunting draf PENDING Editor A',
      `${cubaanB.status} ${cubaanB.teks.slice(0, 300)}`);
  }
  // Sahkan tajuk TAK berubah dalam DB (bukan cuma percaya kod status HTTP).
  const tajukSelepasCubaanB = await dbGetTajuk(DBF, objectId);
  if (tajukSelepasCubaanB === tajuk) {
    lap.lulus('A4: Tajuk draf KEKAL asal dalam DB selepas cubaan Editor B (tiada tulis senyap walau 403)');
  } else {
    lap.gagal('A4: Tajuk draf BERUBAH dalam DB walaupun respons 403', `tajuk sebenar: ${tajukSelepasCubaanB}`);
  }

  // ---- SENARIO B: matriks RBAC matikan editOwn 'editor' SEMASA Editor A sesi aktif ----
  // KE luluskan draf Editor A dulu supaya ada kandungan 'approved' sedia ada untuk diuji.
  const lulus = await ke('PATCH', `/api/system/content/${objectId}`, { status: 'approved' });
  if (lulus.status === 200) lap.lulus('B1: KE lulus draf Editor A -> approved (persediaan Senario B)');
  else lap.gagal('B1: KE GAGAL lulus draf (persediaan Senario B)', `${lulus.status} ${lulus.teks.slice(0, 300)}`);

  // Sahkan Editor A BOLEH sunting sebelum togol dimatikan (kawalan/baseline).
  const suntingSebelum = await editorA('PATCH', `/api/system/content/${objectId}`, { title: 'Tajuk Sebelum Togol Dimatikan' });
  if (suntingSebelum.status === 200) {
    lap.lulus('B2: Editor A boleh sunting kandungan sendiri SEBELUM editOwn dimatikan (baseline)');
  } else {
    lap.gagal('B2: Editor A GAGAL sunting sebelum togol dimatikan (baseline rosak)', `${suntingSebelum.status} ${suntingSebelum.teks.slice(0, 300)}`);
  }

  // KE matikan editOwn untuk peranan 'editor' via matriks RBAC penuh (manageRbac).
  const matriksBaharu = [
    { roleId: 'editor', roleName: 'Editor', permissions: { viewAll: true, editOwn: false, publish: true, reject: false, assignSlot: false, manageSettings: false, manageRbac: false, manageEditorial: false, manageAccounts: false, manageEditorNotes: false, viewAuditLog: false } },
  ];
  const togolRbac = await ke('POST', '/api/system/settings', { rolePermissions: matriksBaharu });
  if (togolRbac.status === 200) {
    lap.lulus('B3: KE matikan editOwn peranan editor via matriks RBAC (POST /system/settings)');
  } else {
    lap.gagal('B3: KE GAGAL matikan editOwn via matriks RBAC', `${togolRbac.status} ${togolRbac.teks.slice(0, 300)}`);
  }

  // Editor A (sesi SAMA, TIDAK log keluar/masuk semula) cuba sunting kandungan sendiri lagi.
  const suntingSelepas = await editorA('PATCH', `/api/system/content/${objectId}`, { title: 'Tajuk Selepas Togol Dimatikan (patut gagal)' });
  if (suntingSelepas.status === 403) {
    lap.lulus('B4: Editor A DITOLAK 403 SERTA-MERTA selepas editOwn dimatikan -- tiada log keluar/masuk diperlukan, gerbang baca kebenaran SEGAR setiap permintaan');
  } else {
    lap.gagal('B4: GERBANG editOwn GAGAL bertindak balas SERTA-MERTA pada perubahan matriks RBAC (sesi Editor A kekal ada kebenaran lama)',
      `${suntingSelepas.status} ${suntingSelepas.teks.slice(0, 300)}`);
  }
  const tajukSelepasTogol = await dbGetTajuk(DBF, objectId);
  if (tajukSelepasTogol === 'Tajuk Sebelum Togol Dimatikan') {
    lap.lulus('B5: Tajuk KEKAL versi sebelum togol dimatikan (tiada tulis senyap walau 403)');
  } else {
    lap.gagal('B5: Tajuk BERUBAH dalam DB walaupun respons 403 selepas togol dimatikan', `tajuk sebenar: ${tajukSelepasTogol}`);
  }

} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);

// --- pembantu ---
async function dbGetStatus(dbFile, objectId) {
  const db = bukaDb(dbFile);
  const row = await dbGet(db, "SELECT status FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1", [objectId]);
  await new Promise(r => db.close(r));
  return row ? row.status : null;
}
async function dbGetTajuk(dbFile, objectId) {
  const db = bukaDb(dbFile);
  const row = await dbGet(db, "SELECT title FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1", [objectId]);
  await new Promise(r => db.close(r));
  return row ? row.title : null;
}
