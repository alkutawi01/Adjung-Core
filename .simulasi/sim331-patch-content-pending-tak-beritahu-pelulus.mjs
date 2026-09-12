// sim331 — bug-hunt round #331. Sambungan penemuan sim330 (tik Jadual Terbit tak beritahu pelulus
// bila kandungan berjadual jatuh ke pending/slot_penuh) — audit dilanjutkan ke SEMUA laluan yang
// boleh hasilkan status='pending' selepas kandungan sedia ada, bukan cuma tik penjadual.
//
// Finding: PATCH /api/system/content/:id (laluan PALING kerap dipakai editor — butang Terbit/
// Siarkan Semula dalam Indeks, IndeksConsole.tsx handleUpdateStatus/handleReactivate) turut boleh
// jatuhkan kandungan ke status='pending' (had slot penuh ATAU editor tiada kunci `publish`), tapi
// SEBELUM pembetulan ni langsung tiada panggilan beritahuPelulusKandungan() — cuma editor slot yang
// nampak toast "menunggu slot kosong" (notifyMany 'kandungan_disiar' TAK jalan sebab status bukan
// 'approved'). Ketua Editor/Penolong Ketua Editor (pelulus) tak pernah tahu kandungan ni menunggu
// tindakan mereka, walhal laluan cipta baharu (syncManualObjectsForSlot, server.js) dan tik Jadual
// Terbit (runSchedulingTick, dibetulkan sim330) kedua-duanya SUDAH beritahu pelulus utk SETIAP
// kandungan yang mendarat 'pending' tak kira sebab.
//
// Sim ni: hadKandunganSlot=1, slot sudah ada SATU 'approved'. Seed SATU lagi kandungan 'archived'
// (draf sedia terbit) dalam slot sama, cuba PATCH status='approved' (macam butang "Siarkan
// Semula"/"Terbit" di Indeks) — slot penuh, jangka jatuh ke 'pending'/slot_penuh, DAN pelulus
// (ketua_editor) patut terima notis 'kandungan_menunggu_kelulusan'.
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien, dbRun, dbGet, dbAll } from './sim-lib.mjs';

const PORT = 5912;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim331.db');
const SLOT = 19; // STANDARD tier, bukan BAR/Ticker

async function main() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-331', username: 'admin-331' });
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    const sediaAda = await api('GET', '/api/system/slot-am-settings');
    const r0 = await api('POST', '/api/system/slot-am-settings', { ...sediaAda.json, hadKandunganSlot: 1 });
    console.log('1) tetapkan hadKandunganSlot=1:', r0.status);
    if (r0.status !== 200) throw new Error('Gagal tetapkan Tetapan Am Slot: ' + JSON.stringify(r0.json));

    const db = new sqlite3.Database(DB_FILE);
    const now = new Date().toISOString();

    const objApproved = 'object-sim331-approved';
    await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, slotIndex, createdAt, updatedAt)
      VALUES (?, 'kad', 'UMUM', ?, ?, ?)`, [objApproved, SLOT, now, now]);
    await dbRun(db, `INSERT INTO editorial_revisions
      (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
      VALUES (?, 1, 'ms', 'Kandungan approved sedia ada sim331', 'Huraian kandungan approved sim331 yang mengisi slot penuh.', 'approved', 'sim-seed', ?, ?)`,
      [objApproved, now, now]);

    const objArkib = 'object-sim331-arkib';
    await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, slotIndex, createdAt, updatedAt)
      VALUES (?, 'kad', 'UMUM', ?, ?, ?)`, [objArkib, SLOT, now, now]);
    await dbRun(db, `INSERT INTO editorial_revisions
      (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
      VALUES (?, 1, 'ms', 'Kandungan arkib sim331 (nak Siarkan Semula)', 'Huraian kandungan arkib sim331 yang cuba disiarkan semula tapi slot penuh.', 'archived', 'sim-seed', ?, ?)`,
      [objArkib, now, now]);
    const revArkib = await dbGet(db, 'SELECT id FROM editorial_revisions WHERE objectId = ?', [objArkib]);
    await dbRun(db, `INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText)
      VALUES (?, ?, 'topik', 'Topik Ujian Sim331')`, [objArkib, revArkib.id]);
    await new Promise((res) => db.close(res));
    console.log('2)+3) suntik: 1 approved (isi slot) + 1 archived (calon Siarkan Semula)');

    // admin-331 (ketua_editor) sendiri ialah pelulus ujian ni — PATCH sebagai dirinya sendiri,
    // jadi beritahuPelulusKandungan(...,excludeUserId) MESTI kecualikan dia; kalau ada akaun
    // ketua_editor seed lain, notis tetap sampai kepada akaun tu.
    const rPatch = await api('PATCH', `/api/system/content/${encodeURIComponent(objArkib)}`, { status: 'approved' });
    console.log('4) PATCH status=approved (Siarkan Semula, slot penuh):', rPatch.status, JSON.stringify(rPatch.json));
    if (rPatch.status !== 200) throw new Error('PATCH gagal: ' + JSON.stringify(rPatch.json));
    if (rPatch.json.slotPenuh !== true) throw new Error('Persediaan sim gagal — slotPenuh tak dilaporkan true: ' + JSON.stringify(rPatch.json));

    const dbCheck = new sqlite3.Database(DB_FILE);
    const revSelepas = await dbGet(dbCheck, 'SELECT status FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1', [objArkib]);
    const notisPelulus = await dbAll(dbCheck, `SELECT userId, type, title, targetId FROM notifications
      WHERE type = 'kandungan_menunggu_kelulusan' AND targetId = ?`, [objArkib]);
    await new Promise((res) => dbCheck.close(res));

    console.log('   status selepas PATCH:', revSelepas?.status);
    console.log('   notis kandungan_menunggu_kelulusan (pelulus):', JSON.stringify(notisPelulus));

    if (revSelepas?.status !== 'pending') {
      throw new Error('Persediaan sim gagal — kandungan tak jatuh ke pending macam dijangka. Status: ' + JSON.stringify(revSelepas));
    }
    // admin-331 ialah actor yang klik PATCH ni sendiri — DIKECUALIKAN drpd notisnya sendiri
    // (excludeUserId, corak "notification hygiene" sedia ada). Akaun ketua_editor SEED lalai
    // (dicipta boot server, bukan admin-331) patut tetap terima notis ni.
    if (notisPelulus.length === 0) {
      throw new Error('BUG: TIADA pelulus diberitahu bila PATCH /content/:id jatuhkan kandungan ke pending/slot_penuh — beritahuPelulusKandungan() tak dipanggil. Notis dijumpai: ' + JSON.stringify(notisPelulus));
    }
    if (notisPelulus.some((n) => n.userId === 'admin-331')) {
      throw new Error('REGRESI notification-hygiene — actor yang sendiri klik PATCH turut menerima notis pelulus (patut dikecualikan): ' + JSON.stringify(notisPelulus));
    }

    console.log('\nBERSIH — pembetulan disahkan: pelulus diberitahu apabila PATCH /content/:id (Terbit/Siarkan Semula) jatuhkan kandungan ke pending/slot_penuh, dan actor sendiri dikecualikan drpd notis tu.');
  } catch (e) {
    console.log('--- server log tail ---');
    console.log(dapatLog().slice(-3000));
    throw e;
  } finally {
    proc.kill();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('GAGAL:', e); process.exit(1); });
