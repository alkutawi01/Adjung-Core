// SIMULASI 23 — CARIAN AWAM (/api/system/search) HUJUNG-KE-HUJUNG.
//
// Fasa 11 punya laluan carian ringkas AWAM (tajuk/huraian/topik, status approved sahaja) dibaiki
// pagi 2026-09-08 (bug ESCAPE ganda-backslash bawa SQLITE_ERROR pada SETIAP carian). Simulasi ni
// buat pengesahan FUNGSIONAL PENUH terus lepas fix tu guna HTTP sebenar (bukan cuma "server tak
// ranap") — beberapa kandungan approved SEBENAR disemai, pelbagai corak carian diuji (padanan
// separa, tak kisah huruf besar/kecil, aksara khas LIKE % dan _, query kosong/terlalu pendek),
// serta semakan yang kandungan ARKIB/PENDING tak sepatutnya keluar dalam hasil carian awam.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, hashPassword, dbRun, bukaDb,
  isiHuraianCukup, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5223;
const DBF = path.join(os.tmpdir(), 'sim-adjung-carian-awam.db');
const lap = pelapor('SIM 23 — CARIAN AWAM HUJUNG-KE-HUJUNG');

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  await ciptaPentadbir(DBF, { id: 'sim-ke', username: 'sim-ke', pass: 'KetuaUjian!2026' });

  const db = bukaDb(DBF);
  const now = new Date().toISOString();
  const PASS_EDITOR = 'EditorUjian!2026';
  await dbRun(db, `INSERT OR REPLACE INTO users (id,username,email,role,password,penName,createdAt,updatedAt)
    VALUES ('sim-editor-c','sim-editor-c','sim-editor-c@sim.test','EDITOR',?,'Sim Editor C',?,?)`,
    [hashPassword(PASS_EDITOR), now, now]);
  await dbRun(db, "INSERT OR IGNORE INTO user_roles (userId,roleId) VALUES ('sim-editor-c','editor')");
  const SLOTS = [30, 31, 32];
  for (const s of SLOTS) {
    await dbRun(db, "INSERT OR IGNORE INTO slot_editors (slotIndex, editorId) VALUES (?, 'sim-editor-c')", [s]);
    await dbRun(db, "INSERT OR REPLACE INTO slots_config (layoutTemplateId, slotIndex, contentMode) VALUES ('frontpage', ?, 'Manual')", [s]);
  }
  await new Promise(r => db.close(r));

  const cookieKE = await login(srv.base, 'sim-ke', 'KetuaUjian!2026');
  const ke = buatKlien(srv.base, cookieKE);
  const cookieEditor = await login(srv.base, 'sim-editor-c', PASS_EDITOR);
  const editor = buatKlien(srv.base, cookieEditor);
  const awam = buatKlien(srv.base, '');

  await ke('PATCH', '/api/system/editor-publish-policy', { benarkanSelfPublish: false });

  // Sedia 3 kandungan approved dengan corak berbeza + 1 kandungan PENDING (tak diluluskan langsung).
  async function ciptaDanLulus(slot, tajuk, topik, desk = 'UMUM') {
    const huraian = isiHuraianCukup(ceilingForSlot, slot, tajuk.length);
    const cipta = await editor('POST', '/api/system/content', {
      slotIndex: slot, title: tajuk, summary: huraian, desk, topik,
      source: 'Sim Test', url: `https://sim.test/artikel-${slot}`,
    });
    if (cipta.status !== 200 || !cipta.json?.id) {
      throw new Error(`Gagal cipta draf slot ${slot}: ${cipta.status} ${cipta.teks.slice(0, 200)}`);
    }
    const id = cipta.json.id;
    await editor('PATCH', `/api/system/content/${id}`, { briefLong: HURAIAN_PANJANG_SAH });
    const lulus = await ke('PATCH', `/api/system/content/${id}`, { status: 'approved' });
    if (lulus.status !== 200) throw new Error(`Gagal lulus ${id}: ${lulus.status} ${lulus.teks.slice(0, 200)}`);
    return id;
  }

  const idDiskaun = await ciptaDanLulus(30, 'Promosi Diskaun 50% Untuk Semua Pembaca', 'Ekonomi', 'EKONOMI');
  const idKod = await ciptaDanLulus(31, 'Laporan Prestasi Model AI_90 Terkini', 'Teknologi');
  lap.lulus('PERSEDIAAN: 2 kandungan approved disemai (satu ada "%", satu ada "_" dalam tajuk)');

  // Kandungan PENDING (tak diluluskan) — mesti TIDAK muncul dalam carian awam.
  const huraianPending = isiHuraianCukup(ceilingForSlot, 32, 'Draf Belum Lulus Carian Rahsia Ujian'.length);
  const ciptaPending = await editor('POST', '/api/system/content', {
    slotIndex: 32, title: 'Draf Belum Lulus Carian Rahsia Ujian', summary: huraianPending,
    desk: 'UMUM', topik: 'RahsiaUjian', source: 'Sim Test', url: 'https://sim.test/artikel-32',
  });
  if (ciptaPending.status !== 200 || !ciptaPending.json?.id) {
    lap.gagal('PERSEDIAAN: gagal cipta draf pending', `${ciptaPending.status} ${ciptaPending.teks.slice(0, 200)}`);
  }
  const idPending = ciptaPending.json?.id;

  // --- UJIAN 1: padanan separa biasa pada tajuk ---
  const r1 = await awam('GET', '/api/system/search?q=Prestasi');
  const jumpa1 = (r1.json?.results || []).some(x => x.objectId === idKod);
  if (r1.status === 200 && jumpa1) lap.lulus('UJIAN 1: padanan separa tajuk ("Prestasi") jumpa kandungan betul');
  else lap.gagal('UJIAN 1: padanan separa tajuk GAGAL', `${r1.status} ${JSON.stringify(r1.json).slice(0, 300)}`);

  // --- UJIAN 2: tak kisah huruf besar/kecil ---
  const r2 = await awam('GET', '/api/system/search?q=promosi diskaun');
  const jumpa2 = (r2.json?.results || []).some(x => x.objectId === idDiskaun);
  if (r2.status === 200 && jumpa2) lap.lulus('UJIAN 2: carian huruf kecil jumpa tajuk huruf besar-kecil campur');
  else lap.gagal('UJIAN 2: carian tak kisah kes GAGAL', `${r2.status} ${JSON.stringify(r2.json).slice(0, 300)}`);

  // --- UJIAN 3: aksara "%" literal dalam query MESTI dianggap literal, bukan wildcard SQL ---
  // Jika tak dilepaskan betul, "%" ditafsir wildcard -> hasil terlalu luas TAPI dalam kes ni bukan
  // salah-positif senang dikesan; ujian sebenar: query dgn "%" mesti still tepat jumpa "50%" DAN
  // TIDAK menyebabkan SQLITE_ERROR (bug 2026-09-08 pagi tadi buat SETIAP carian gagal 500).
  const r3 = await awam('GET', '/api/system/search?q=50%25'); // %25 = literal '%' selepas URL-decode
  const jumpa3 = (r3.json?.results || []).some(x => x.objectId === idDiskaun);
  if (r3.status === 200 && jumpa3) lap.lulus('UJIAN 3: query dengan aksara "%" literal berfungsi (tiada SQLITE_ERROR, padanan tepat)');
  else lap.gagal('UJIAN 3: query dengan "%" GAGAL/ralat', `${r3.status} ${r3.teks.slice(0, 300)}`);

  // --- UJIAN 4: aksara "_" literal dalam query mesti literal, bukan wildcard single-char SQL ---
  const r4a = await awam('GET', '/api/system/search?q=AI_90'); // patut jumpa idKod
  const jumpa4a = (r4a.json?.results || []).some(x => x.objectId === idKod);
  const r4b = await awam('GET', '/api/system/search?q=AIX90'); // TAK patut jumpa (kalau "_" ialah wildcard SQL sebenar, ni pun jumpa -- salah)
  const jumpa4b = (r4b.json?.results || []).some(x => x.objectId === idKod);
  if (r4a.status === 200 && jumpa4a && r4b.status === 200 && !jumpa4b) {
    lap.lulus('UJIAN 4: "_" dianggap literal (AI_90 jumpa, AIX90 tak jumpa -- bukan wildcard SQL)');
  } else {
    lap.gagal('UJIAN 4: pengendalian "_" SALAH', `AI_90:${r4a.status}/${jumpa4a} AIX90:${r4b.status}/${jumpa4b}`);
  }

  // --- UJIAN 5: query < 2 aksara pulangkan senarai kosong (bukan ralat) ---
  const r5 = await awam('GET', '/api/system/search?q=a');
  if (r5.status === 200 && Array.isArray(r5.json?.results) && r5.json.results.length === 0) {
    lap.lulus('UJIAN 5: query 1 aksara pulangkan results:[] (bukan ralat/senarai penuh)');
  } else {
    lap.gagal('UJIAN 5: query pendek TAK dikendalikan betul', `${r5.status} ${JSON.stringify(r5.json).slice(0, 200)}`);
  }

  // --- UJIAN 6: query kosong pulangkan senarai kosong ---
  const r6 = await awam('GET', '/api/system/search?q=');
  if (r6.status === 200 && Array.isArray(r6.json?.results) && r6.json.results.length === 0) {
    lap.lulus('UJIAN 6: query kosong pulangkan results:[]');
  } else {
    lap.gagal('UJIAN 6: query kosong TAK dikendalikan betul', `${r6.status} ${JSON.stringify(r6.json).slice(0, 200)}`);
  }

  // --- UJIAN 7: padanan melalui medan Topik (bukan hanya tajuk/huraian) ---
  const r7 = await awam('GET', '/api/system/search?q=Ekonomi');
  const jumpa7 = (r7.json?.results || []).some(x => x.objectId === idDiskaun);
  if (r7.status === 200 && jumpa7) lap.lulus('UJIAN 7: padanan melalui medan Topik berfungsi');
  else lap.gagal('UJIAN 7: padanan Topik GAGAL', `${r7.status} ${JSON.stringify(r7.json).slice(0, 300)}`);

  // --- UJIAN 8: kandungan PENDING (belum lulus) TIDAK muncul dalam carian awam ---
  const r8 = await awam('GET', '/api/system/search?q=RahsiaUjian');
  const bocorPending = (r8.json?.results || []).some(x => x.objectId === idPending);
  if (r8.status === 200 && !bocorPending) {
    lap.lulus('UJIAN 8: kandungan PENDING betul-betul tersembunyi drpd carian awam');
  } else {
    lap.gagal('UJIAN 8: kandungan PENDING BOCOR ke carian awam!', `${r8.status} ${JSON.stringify(r8.json).slice(0, 300)}`);
  }

  // --- UJIAN 9: query tanpa padanan pulangkan senarai kosong (bukan ralat) ---
  const r9 = await awam('GET', '/api/system/search?q=TiadaLangsungPadanan9999');
  if (r9.status === 200 && Array.isArray(r9.json?.results) && r9.json.results.length === 0) {
    lap.lulus('UJIAN 9: query tanpa padanan pulangkan results:[] bersih');
  } else {
    lap.gagal('UJIAN 9: query tanpa padanan GAGAL', `${r9.status} ${JSON.stringify(r9.json).slice(0, 300)}`);
  }

  lap.ringkasan();
} finally {
  srv.proc.kill();
}
