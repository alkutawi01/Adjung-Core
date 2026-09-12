// sim330 — bug-hunt round #330. Fresh lead from round #329 (selesaikanMenungguKelulusan missed
// the DELETE soft-delete trigger point) prompted a full audit of Notify.js trigger-point coverage.
//
// Finding: when runSchedulingTick() (1) Terbit berjadual (contentRoutes.js ~baris 404) finds a
// scheduled item whose publish time has arrived but the slot is FULL, it drops the item to
// status='pending'/sebabMenunggu='slot_penuh' and notifies the SLOT EDITORS ("menunggu slot
// kosong") — but never calls beritahuPelulusKandungan() to tell Ketua Editor/Penolong Ketua
// Editor that a 'pending' item now needs their attention. The MANUAL publish path that produces
// the exact same state (syncManualObjectsForSlot, server.js ~baris 4144-4185) DOES call
// beritahuPelulusKandungan() for every item landing in 'pending' — including the 'slot_penuh'
// reason, not just 'semakan' — per its own comment: "Keputusan terbit DAH dibuat... punca pending
// ni SEMATA-MATA slot penuh, bukan menunggu kelulusan manusia" yet it STILL notifies pelulus,
// because the pelulus is the one person who can manually publish straight through to skip the
// 24h rotation queue. The scheduled-tick path produces the identical DB state (status='pending',
// sebabMenunggu='slot_penuh') but silently skips that pelulus notification — the approver has no
// idea the item is waiting, unlike the manual-publish case.
//
// This sim: hadKandunganSlot=1, slot already has one 'approved' item; a 'scheduled' item with
// scheduledPublishAt in the past is seeded in the same slot. Wait for the real 90s tick. Expect
// the scheduled item to land in status='pending' + sebabMenunggu='slot_penuh', AND a
// 'kandungan_menunggu_kelulusan' notification to appear for the ketua_editor role (the fix under
// test) alongside the existing 'kandungan_terbit_berjadual' notification to the slot editor.
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien, dbRun, dbGet, dbAll } from './sim-lib.mjs';

const PORT = 5911;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim330.db');
const SLOT = 19; // STANDARD tier, bukan BAR/Ticker (slot 8 salah - sebenarnya BAR, dibetulkan)

async function main() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-330', username: 'admin-330' });
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    // 1) hadKandunganSlot=1 supaya slot dikira PENUH sebaik satu item approved sedia ada.
    const sediaAda = await api('GET', '/api/system/slot-am-settings');
    const r0 = await api('POST', '/api/system/slot-am-settings', { ...sediaAda.json, hadKandunganSlot: 1 });
    console.log('1) tetapkan hadKandunganSlot=1:', r0.status);
    if (r0.status !== 200) throw new Error('Gagal tetapkan Tetapan Am Slot: ' + JSON.stringify(r0.json));

    const db = new sqlite3.Database(DB_FILE);
    const now = new Date().toISOString();
    const laluIso = new Date(Date.now() - 60 * 1000).toISOString(); // scheduledPublishAt sudah matang

    // 2) Item APPROVED sedia ada — mengisi slot penuh.
    const objApproved = 'object-sim330-approved';
    await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, slotIndex, createdAt, updatedAt)
      VALUES (?, 'kad', 'UMUM', ?, ?, ?)`, [objApproved, SLOT, now, now]);
    await dbRun(db, `INSERT INTO editorial_revisions
      (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
      VALUES (?, 1, 'ms', 'Kandungan approved sedia ada sim330', 'Huraian kandungan approved sim330 yang mengisi slot penuh.', 'approved', 'sim-seed', ?, ?)`,
      [objApproved, now, now]);

    // 3) Item SCHEDULED, scheduledPublishAt sudah lalu — tik pertama patut cuba terbitkannya,
    //    dapati slot penuh, jatuhkan ke pending/slot_penuh.
    const objMenunggu = 'object-sim330-scheduled';
    await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, slotIndex, createdAt, updatedAt)
      VALUES (?, 'kad', 'UMUM', ?, ?, ?)`, [objMenunggu, SLOT, now, now]);
    await dbRun(db, `INSERT INTO editorial_revisions
      (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt, scheduledPublishAt)
      VALUES (?, 1, 'ms', 'Kandungan berjadual sim330 (matang, slot penuh)', 'Huraian kandungan berjadual sim330 yang scheduledPublishAt sudah matang tapi slot penuh.', 'scheduled', 'sim-seed', ?, ?, ?)`,
      [objMenunggu, now, now, laluIso]);

    // 4) Daftar seorang editor slot (utk notis 'kandungan_terbit_berjadual' sedia ada).
    await dbRun(db, `INSERT INTO users (id,username,email,role,password,penName,createdAt,updatedAt)
      VALUES ('editor-slot-330','editor-slot-330','editor-slot-330@sim.test','EDITOR','x','Editor Slot 330',?,?)`, [now, now]);
    await dbRun(db, `INSERT INTO slot_editors (slotIndex, editorId) VALUES (?, ?)`, [SLOT, 'editor-slot-330']);
    await new Promise((res) => db.close(res));
    console.log('2)+3)+4) suntik: 1 approved (isi slot) + 1 scheduled (matang) + 1 editor slot');

    // admin-330 sendiri sudah ada peranan ketua_editor (ciptaPentadbir) — itulah pelulus ujian ni.

    console.log('5) menunggu tik pertama (~95s)...');
    await new Promise((r) => setTimeout(r, 95000));

    const dbCheck = new sqlite3.Database(DB_FILE);
    const revSelepas = await dbGet(dbCheck, 'SELECT status FROM editorial_revisions WHERE objectId = ?', [objMenunggu]);
    const sebabRow = await dbGet(dbCheck, `SELECT valueText FROM editorial_attribute_values
      WHERE objectId = ? AND attributeId = 'sebabMenunggu'`, [objMenunggu]);
    const notisPelulus = await dbAll(dbCheck, `SELECT userId, type, title, targetId FROM notifications
      WHERE type = 'kandungan_menunggu_kelulusan' AND targetId = ?`, [objMenunggu]);
    const notisEditorSlot = await dbAll(dbCheck, `SELECT userId, type FROM notifications
      WHERE type = 'kandungan_terbit_berjadual' AND targetId = ?`, [`${SLOT}:${objMenunggu}`]);
    await new Promise((res) => dbCheck.close(res));

    console.log('   status selepas tik:', revSelepas?.status, '| sebabMenunggu:', sebabRow?.valueText);
    console.log('   notis kandungan_menunggu_kelulusan (pelulus):', JSON.stringify(notisPelulus));
    console.log('   notis kandungan_terbit_berjadual (editor slot):', JSON.stringify(notisEditorSlot));

    if (revSelepas?.status !== 'pending' || sebabRow?.valueText !== 'slot_penuh') {
      throw new Error('Persediaan sim gagal — item scheduled tak jatuh ke pending/slot_penuh macam dijangka. Status: ' + JSON.stringify(revSelepas) + ' sebab: ' + JSON.stringify(sebabRow));
    }
    if (notisEditorSlot.length !== 1) {
      throw new Error('Regresi — notis kandungan_terbit_berjadual sedia ada kepada editor slot hilang/berganda: ' + JSON.stringify(notisEditorSlot));
    }
    // >=1 (bukan ===1) — boot seed sistem turut cipta satu akaun Chief Editor lalai, jadi DUA
    // pelulus (admin-330 + akaun seed) sah-sah menerima notis ni, bukan cuma satu.
    if (notisPelulus.length === 0 || !notisPelulus.some((n) => n.userId === 'admin-330')) {
      throw new Error('BUG: pelulus (ketua_editor) TIDAK diberitahu bila kandungan berjadual jatuh ke pending/slot_penuh via tik — beritahuPelulusKandungan() tak dipanggil di runSchedulingTick(). Notis dijumpai: ' + JSON.stringify(notisPelulus));
    }

    console.log('\nBERSIH — pembetulan disahkan: pelulus (ketua_editor) diberitahu apabila kandungan berjadual jatuh ke pending/slot_penuh via tik, sama macam laluan terbit manual.');
  } catch (e) {
    console.log('--- server log tail ---');
    console.log(dapatLog().slice(-3000));
    throw e;
  } finally {
    proc.kill();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('GAGAL:', e); process.exit(1); });
