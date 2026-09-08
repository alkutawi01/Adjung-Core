// SIMULASI 16 — ALIRAN EDITORIAL HUJUNG-KE-HUJUNG (draf -> lulus -> awam -> edit sendiri -> tolak).
//
// Uji kitaran PENUH sebagai SATU aliran HTTP sebenar berterusan (bukan fungsi terasing):
// Editor cipta draf -> Ketua Editor lihat baris menunggu -> Ketua Editor lulus -> semak API
// AWAM papar kandungan -> Editor ASAL sunting tajuk kandungan yang SUDAH aktif -> Ketua Editor
// tolak/arkib -> semak API awam TAK papar lagi (tiada lag cache, sebab resolveSlotContent()
// dikira SETIAP permintaan, bukan dicache).
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, hashPassword, dbRun, dbGet, bukaDb,
  isiHuraianCukup, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5216;
const DBF = path.join(os.tmpdir(), 'sim-adjung-aliran-editorial.db');
const lap = pelapor('SIM 16 — ALIRAN EDITORIAL HUJUNG-KE-HUJUNG');
const SLOT = 20; // STANDARD, bukan slot yang dipakai fixture lain

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
  // Editor mesti ditugaskan slot ni dahulu (gerbang penugasan slot, POST /content).
  await dbRun(db, "INSERT OR IGNORE INTO slot_editors (slotIndex, editorId) VALUES (?, 'sim-editor-a')", [SLOT]);
  // slots_config baris mesti wujud (layoutTemplateId='frontpage') supaya GET /layout/active
  // (SELECT * FROM slots_config WHERE layoutTemplateId='frontpage') sertakan slot ni langsung —
  // pada DB buangan kosong takda satu baris pun wujud sebelum ni.
  await dbRun(db, "INSERT OR REPLACE INTO slots_config (layoutTemplateId, slotIndex, contentMode) VALUES ('frontpage', ?, 'Manual')", [SLOT]);
  await new Promise(r => db.close(r));

  const cookieKE = await login(srv.base, 'sim-ke', 'KetuaUjian!2026');
  const ke = buatKlien(srv.base, cookieKE);
  const cookieEditor = await login(srv.base, 'sim-editor-a', PASS_EDITOR);
  const editor = buatKlien(srv.base, cookieEditor);
  const awam = buatKlien(srv.base, '');

  // LANGKAH 0 — Ketua Editor kuatkuasakan dasar "Editor perlu kelulusan" (bukan lalai self-publish)
  // supaya aliran draf->menunggu->lulus sebenar-benar teruji, bukan terus 'approved'.
  const dasar = await ke('PATCH', '/api/system/editor-publish-policy', { benarkanSelfPublish: false });
  if (dasar.status === 200) lap.lulus('LANGKAH 0: Dasar Terbit Sendiri Editor dimatikan');
  else lap.gagal('LANGKAH 0: GAGAL matikan dasar terbit sendiri', `${dasar.status} ${dasar.teks.slice(0, 200)}`);

  // LANGKAH 1 — Editor cipta draf baharu (slot kosong, huraian panjang cukup gerbang, Topik wajib).
  const { maxTitle } = ceilingForSlot(SLOT);
  const tajuk = 'Draf Ujian Aliran Editorial Hujung ke Hujung';
  const huraian = isiHuraianCukup(ceilingForSlot, SLOT, tajuk.length);
  const cipta = await editor('POST', '/api/system/content', {
    slotIndex: SLOT, title: tajuk, summary: huraian, desk: 'UMUM', topik: 'Ujian Aliran',
    source: 'Sim Test', url: 'https://sim.test/artikel',
  });
  if (cipta.status !== 200 || !cipta.json?.id) {
    lap.gagal('LANGKAH 1: Editor gagal cipta draf', `${cipta.status} ${cipta.teks.slice(0, 300)}`);
    throw new Error('Tak boleh teruskan tanpa draf.');
  }
  const objectId = cipta.json.id;
  lap.lulus(`LANGKAH 1: Editor cipta draf ${objectId}`);

  // Sertakan Huraian Panjang (medan berasingan, PATCH) supaya lulus gerbang minimum 400 aksara
  // apabila diluluskan/disemak nanti.
  const isiHuraianPanjang = await editor('PATCH', `/api/system/content/${objectId}`, {
    briefLong: HURAIAN_PANJANG_SAH,
  });
  if (isiHuraianPanjang.status !== 200) {
    lap.gagal('LANGKAH 1b: Editor gagal isi Huraian Panjang', `${isiHuraianPanjang.status} ${isiHuraianPanjang.teks.slice(0, 300)}`);
  } else {
    lap.lulus('LANGKAH 1b: Huraian Panjang diisi');
  }

  // Sahkan status lahir sebagai 'pending' (Editor biasa, tiada kunci publish/manageEditorial).
  const semakStatusAwal = await dbGet2(DBF, objectId);
  if (semakStatusAwal === 'pending') lap.lulus('LANGKAH 1c: Draf lahir status pending (bukan terus aktif)');
  else lap.gagal('LANGKAH 1c: Draf TIDAK lahir pending', `status sebenar: ${semakStatusAwal}`);

  // LANGKAH 2 — Ketua Editor lihat baris menunggu (GET /content/all, tapis pending).
  const senaraiSemua = await ke('GET', '/api/system/content/all');
  const senaraiItems = senaraiSemua.json?.items || [];
  const adaDalamSenarai = senaraiItems.some((it) => it.id === objectId && it.status === 'pending');
  if (senaraiSemua.status === 200 && adaDalamSenarai) {
    lap.lulus('LANGKAH 2: Ketua Editor nampak draf berstatus pending dalam /content/all');
  } else {
    lap.gagal('LANGKAH 2: Draf TIADA/status salah dalam /content/all', `${senaraiSemua.status} ada=${adaDalamSenarai}`);
  }

  // LANGKAH 3 — Ketua Editor lulus draf (PATCH status=approved).
  const lulus = await ke('PATCH', `/api/system/content/${objectId}`, { status: 'approved' });
  if (lulus.status === 200) lap.lulus('LANGKAH 3: Ketua Editor lulus draf -> approved');
  else lap.gagal('LANGKAH 3: Ketua Editor GAGAL lulus draf', `${lulus.status} ${lulus.teks.slice(0, 300)}`);

  // LANGKAH 4 — Semak API AWAM papar kandungan (layout/active), medan tajuk/huraian betul.
  const layoutSelepasLulus = await awam('GET', '/api/system/layout/active');
  const slotDalamLayout = layoutSelepasLulus.json?.slots?.find?.((s) => s.slotIndex === SLOT)
    || layoutSelepasLulus.json?.find?.((s) => s.slotIndex === SLOT);
  const kandunganAwam = cariKandunganDalamSlot(layoutSelepasLulus.json, SLOT, objectId);
  if (kandunganAwam && kandunganAwam.title === tajuk) {
    lap.lulus('LANGKAH 4: Kandungan terpapar di API awam layout/active dengan tajuk betul');
  } else {
    lap.gagal('LANGKAH 4: Kandungan TIDAK terpapar / medan salah di API awam',
      `dijumpai=${!!kandunganAwam} tajukSepadan=${kandunganAwam ? kandunganAwam.title === tajuk : 'n/a'}\n` +
      `Cebisan layout slot ${SLOT}: ${JSON.stringify(slotDalamLayout || null).slice(0, 400)}\n` +
      `Bentuk respons awam (kunci top-level): ${Object.keys(layoutSelepasLulus.json || {}).slice(0, 20)}`);
  }

  // LANGKAH 5 — Editor ASAL sunting tajuk kandungan SENDIRI yang SUDAH aktif/lulus.
  const tajukBaharu = 'Draf Ujian Aliran Editorial (Disunting Selepas Aktif)';
  const suntingSendiri = await editor('PATCH', `/api/system/content/${objectId}`, { title: tajukBaharu });
  if (suntingSendiri.status === 200) {
    lap.lulus('LANGKAH 5: Editor ASAL berjaya sunting tajuk kandungan sendiri yang sudah aktif');
  } else {
    lap.gagal('LANGKAH 5: GERBANG editOwn/pemilikan SALAH menyekat penulis sebenar menyunting kandungan sendiri yang sudah aktif',
      `${suntingSendiri.status} ${suntingSendiri.teks.slice(0, 300)}`);
  }

  // Sahkan perubahan tajuk sebenar terpapar semula di API awam (bukan cuma 200 OK kosong).
  const layoutSelepasSunting = await awam('GET', '/api/system/layout/active');
  const kandunganSelepasSunting = cariKandunganDalamSlot(layoutSelepasSunting.json, SLOT, objectId);
  if (kandunganSelepasSunting && kandunganSelepasSunting.title === tajukBaharu) {
    lap.lulus('LANGKAH 5b: Tajuk baharu selepas edit-sendiri terpapar betul di API awam');
  } else {
    lap.gagal('LANGKAH 5b: Tajuk baharu TAK terpapar/tak sepadan di API awam selepas edit-sendiri',
      `dijumpai=${!!kandunganSelepasSunting} tajuk=${kandunganSelepasSunting?.title}`);
  }

  // LANGKAH 6 — Ketua Editor tolak/arkib kandungan (reject-to-draft ATAU PATCH status archived).
  const tolak = await ke('POST', `/api/system/content/${objectId}/reject-to-draft`, {});
  let statusTolakOk = tolak.status === 200;
  if (!statusTolakOk) {
    // Kalau reject-to-draft tak sesuai (cth. objek jenis lain), cuba PATCH status=archived terus.
    const arkib = await ke('PATCH', `/api/system/content/${objectId}`, { status: 'archived' });
    statusTolakOk = arkib.status === 200;
    if (!statusTolakOk) {
      lap.gagal('LANGKAH 6: Ketua Editor GAGAL tolak/arkib kandungan',
        `reject-to-draft=${tolak.status} ${tolak.teks.slice(0, 150)} | PATCH archived=${arkib.status} ${arkib.teks.slice(0, 150)}`);
    }
  }
  if (statusTolakOk) lap.lulus('LANGKAH 6: Ketua Editor berjaya tolak/arkib kandungan');

  // LANGKAH 7 — Semak API AWAM TAK papar lagi kandungan (tiada lag cache).
  const layoutSelepasTolak = await awam('GET', '/api/system/layout/active');
  const kandunganSelepasTolak = cariKandunganDalamSlot(layoutSelepasTolak.json, SLOT, objectId);
  if (!kandunganSelepasTolak) {
    lap.lulus('LANGKAH 7: Kandungan yang ditolak/diarkib SERTA-MERTA hilang daripada API awam (tiada lag cache)');
  } else {
    lap.gagal('LANGKAH 7: Kandungan yang ditolak/diarkib MASIH terpapar di API awam',
      JSON.stringify(kandunganSelepasTolak).slice(0, 300));
  }

} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);

// --- pembantu ---
async function dbGet2(dbFile, objectId) {
  const db = bukaDb(dbFile);
  const row = await dbGet(db, "SELECT status FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1", [objectId]);
  await new Promise(r => db.close(r));
  return row ? row.status : null;
}

function cariKandunganDalamSlot(layoutJson, slotIndex, objectId) {
  if (!layoutJson) return null;
  // GET /api/system/layout/active pulangkan ARRAY terus, setiap unsur satu slot dengan `rawIndex`
  // (BUKAN `slotIndex`) + `objectId`/`title` pada peringkat teratas DAN diulang dalam `items[]`
  // (bentuk carousel), disahkan via cetakan DEBUG mentah semasa bina simulasi ni.
  // `rawIndex` di respons awam ialah slotIndex+1 (server.js ~baris 4395: `rawIndex: slot.slotIndex
  // + 1`) — bukan slotIndex mentah. Disahkan semasa bina simulasi ni (nampak macam anomali "off by
  // one" pada mulanya, sebenarnya konvensyen API sedia ada).
  const senaraiSlot = Array.isArray(layoutJson) ? layoutJson : (layoutJson.slots || layoutJson.layout || []);
  const slot = senaraiSlot.find?.((s) => s.rawIndex === slotIndex + 1 || s.slotIndex === slotIndex || s.index === slotIndex);
  if (!slot) return null;
  const kandidat = [];
  if (slot.id === objectId || slot.objectId === objectId) kandidat.push(slot);
  if (Array.isArray(slot.items)) kandidat.push(...slot.items.filter((it) => it.id === objectId || it.objectId === objectId));
  if (Array.isArray(slot.carousel)) kandidat.push(...slot.carousel.filter((it) => it.id === objectId || it.objectId === objectId));
  return kandidat[0] || null;
}
