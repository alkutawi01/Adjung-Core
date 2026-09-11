// sim310 — bug-hunt 2026-09-11. Fresh angle: promosikanMenungguSlotKosongTanpaKunci()
// (contentRoutes.js ~baris 132) menaik taraf kandungan 'pending' (sebabMenunggu='slot_penuh')
// terus ke 'approved' bila slot kosong (selepas putaran 24 jam ATAU tindakan manual arkib/tolak),
// TANPA pernah menyentuh/menyemak lajur scheduledExpiresAt kandungan tu.
//
// Kandungan boleh masuk giliran 'slot_penuh' SAMBIL MEMBAWA scheduledExpiresAt sedia ada -- cth
// kandungan yang asalnya dijadualkan Terbit + Luput serentak (Jadual Terbit DAN Jadual Luput
// kedua-duanya ditetapkan), tapi pada SAAT scheduledPublishAt matang, slot didapati PENUH --
// runSchedulingTick() (1) jatuhkan status ke 'pending'/slot_penuh dan kosongkan scheduledPublishAt
// SAHAJA (lihat baris 430), scheduledExpiresAt KEKAL tidak disentuh. Giliran 'slot_penuh' TIADA HAD
// MASA (CLAUDE.md/komen (4) runSchedulingTick mengesahkan ni sengaja -- boleh beratur berjam-jam/
// berhari sehingga item lain dlm slot diarkibkan), jadi pada saat ia AKHIRNYA dipromosi, masa boleh
// sudah jauh melepasi scheduledExpiresAt asal.
//
// promosikanMenungguSlotKosongTanpaKunci() cuma UPDATE status='approved' -- tidak pernah membatal/
// menyemak semula scheduledExpiresAt yang sudah lapuk. Tik BERJADUAL SETERUSNYA (90 saat) terus
// nampak status='approved' + scheduledExpiresAt lapuk -> ARKIBKAN SERTA-MERTA. Kandungan yang
// akhirnya berjaya "keluar giliran" terbit-mati dalam masa < 90 saat, senyap, tiada kaitan nampak
// dengan sebab sebenar (giliran slot_penuh yang mengambil masa lebih lama drpd jangkaan Jadual Luput
// asal).
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien, dbRun, dbGet } from './sim-lib.mjs';

const PORT = 5910;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim310.db');
const SLOT = 6; // STANDARD tier, bukan BAR/Ticker

async function main() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-310', username: 'admin-310' });
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    // 1) Hadkan slot kepada 1 kandungan aktif sahaja, dan tetapkan hadJamRotasiSlotPenuh ke nilai
    //    kecil (1 jam) supaya putaran 24-jam automatik tercetus cepat dalam simulasi ni tanpa
    //    perlu tunggu 24 jam sebenar -- kita suntik createdAt "seolah-olah" 2 jam lalu terus di DB.
    const sediaAda = await api('GET', '/api/system/slot-am-settings');
    const r0 = await api('POST', '/api/system/slot-am-settings', { ...sediaAda.json, hadKandunganSlot: 1, hadJamRotasiSlotPenuh: 1 });
    console.log('1) tetapkan hadKandunganSlot=1, hadJamRotasiSlotPenuh=1 jam:', r0.status);
    if (r0.status !== 200) throw new Error('Gagal tetapkan Tetapan Am Slot: ' + JSON.stringify(r0.json));

    const db = new sqlite3.Database(DB_FILE);
    const now = new Date();
    const nowIso = now.toISOString();
    const duaJamLalu = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const satuJamLalu = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(); // scheduledExpiresAt LAPUK

    // 2) Kandungan APPROVED sedia ada, TERTUA dalam slot, createdAt 2 jam lalu (> hadJamRotasiSlotPenuh
    //    1 jam) -- ini akan diarkibkan automatik oleh putaran (4) runSchedulingTick().
    const objLama = 'object-sim310-lama';
    await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, slotIndex, createdAt, updatedAt)
      VALUES (?, 'kad', 'UMUM', ?, ?, ?)`, [objLama, SLOT, duaJamLalu, duaJamLalu]);
    await dbRun(db, `INSERT INTO editorial_revisions
      (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
      VALUES (?, 1, 'ms', 'Kandungan lama sim310 (akan diputar)', 'Huraian kandungan lama sim310 yang akan diarkibkan oleh putaran automatik 24 jam.', 'approved', 'sim-seed', ?, ?)`,
      [objLama, duaJamLalu, duaJamLalu]);

    // 3) Kandungan PENDING (sebabMenunggu='slot_penuh') menunggu giliran, MEMBAWA scheduledExpiresAt
    //    yang sudah LAPUK (1 jam lalu) -- mensimulasikan kandungan yang scheduledPublishAt-nya
    //    matang semasa slot penuh (dikosongkan oleh runSchedulingTick (1)), tapi scheduledExpiresAt
    //    asal (dijadualkan bersama) tidak pernah dikosongkan/disemak semula.
    const objMenunggu = 'object-sim310-menunggu';
    await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, slotIndex, createdAt, updatedAt)
      VALUES (?, 'kad', 'UMUM', ?, ?, ?)`, [objMenunggu, SLOT, nowIso, nowIso]);
    await dbRun(db, `INSERT INTO editorial_revisions
      (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt, scheduledExpiresAt)
      VALUES (?, 1, 'ms', 'Kandungan menunggu sim310 (giliran slot_penuh)', 'Huraian kandungan sim310 yang menunggu giliran slot kosong, membawa Jadual Luput lapuk dari cubaan terbit asal.', 'pending', 'sim-seed', ?, ?, ?)`,
      [objMenunggu, nowIso, nowIso, satuJamLalu]);
    const revMenungguRow = await dbGet(db, 'SELECT id FROM editorial_revisions WHERE objectId = ?', [objMenunggu]);
    await dbRun(db, `INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText)
      VALUES (?, ?, 'sebabMenunggu', 'slot_penuh')`, [objMenunggu, revMenungguRow.id]);
    await new Promise((res) => db.close(res));
    console.log('2)+3) suntik: kandungan lama (approved, createdAt -2j) + kandungan menunggu (pending/slot_penuh, scheduledExpiresAt -1j)');

    // 4) Tunggu SATU tik berjadual sebenar (90s + baki) -- putaran (4) sepatutnya arkibkan
    //    kandungan lama (>1j) DAN promosi kandungan menunggu terus ke 'approved' dalam tik YANG
    //    SAMA (promosikanMenungguSlotKosong dipanggil serta-merta selepas arkib, baris 494/629).
    console.log('4) menunggu tik pertama (~95s)...');
    await new Promise((r) => setTimeout(r, 95000));

    const dbCheck1 = new sqlite3.Database(DB_FILE);
    const lamaSelepasTik1 = await dbGet(dbCheck1, 'SELECT status FROM editorial_revisions WHERE objectId = ?', [objLama]);
    const menungguSelepasTik1 = await dbGet(dbCheck1, 'SELECT status, scheduledExpiresAt FROM editorial_revisions WHERE objectId = ?', [objMenunggu]);
    await new Promise((res) => dbCheck1.close(res));
    console.log('   kandungan lama selepas tik 1:', lamaSelepasTik1?.status);
    console.log('   kandungan menunggu selepas tik 1:', JSON.stringify(menungguSelepasTik1));

    if (lamaSelepasTik1?.status !== 'archived') {
      throw new Error('Persediaan gagal: kandungan lama sepatutnya sudah diputar-arkib selepas tik 1, tapi status=' + lamaSelepasTik1?.status + '. Log pelayan:\n' + dapatLog().slice(-3000));
    }
    if (menungguSelepasTik1?.status !== 'approved') {
      throw new Error('Persediaan gagal: kandungan menunggu sepatutnya dipromosi ke approved selepas slot kosong, tapi status=' + menungguSelepasTik1?.status + '. Log pelayan:\n' + dapatLog().slice(-3000));
    }
    if (!menungguSelepasTik1.scheduledExpiresAt) {
      console.log('\nBERSIH (tak dijangka) -- promosi sudah mengosongkan scheduledExpiresAt lapuk, pepijat tak reproduce.');
      return;
    }
    console.log('   >> disahkan: kandungan BARU SAHAJA dipromosi/terbit MASIH membawa scheduledExpiresAt LAPUK (' + menungguSelepasTik1.scheduledExpiresAt + '), tik luput seterusnya akan nampak ia "due".');

    // 5) Tunggu tik KEDUA -- kalau pepijat wujud, langkah (2) Luput/arkib berjadual akan terus
    //    mengarkibkan kandungan yang BARU SAHAJA terbit sebab scheduledExpiresAt lapuk tu.
    console.log('5) menunggu tik kedua (~95s)...');
    await new Promise((r) => setTimeout(r, 95000));

    const dbCheck2 = new sqlite3.Database(DB_FILE);
    const menungguSelepasTik2 = await dbGet(dbCheck2, 'SELECT status, scheduledExpiresAt FROM editorial_revisions WHERE objectId = ?', [objMenunggu]);
    await new Promise((res) => dbCheck2.close(res));
    console.log('   kandungan menunggu selepas tik 2:', JSON.stringify(menungguSelepasTik2));

    if (menungguSelepasTik2?.status === 'archived') {
      throw new Error('BUG DISAHKAN: kandungan sim310 dipromosi ke approved pada tik 1, tapi diarkibkan SEMULA secara AUTOMATIK pada tik 2 (< 90 saat lepas terbit) sebab scheduledExpiresAt lapuk yang dibawa dari giliran slot_penuh tidak pernah dikosongkan/disemak semula oleh promosikanMenungguSlotKosongTanpaKunci(). Kandungan yang berjaya "keluar giliran" hidup < 90 saat sebelum mati semula, senyap, tiada kaitan nampak dengan punca sebenar.');
    }

    console.log('\nBERSIH (tak dijangka) -- kandungan kekal approved selepas tik 2, pepijat tak reproduce macam dijangka.');
  } catch (e) {
    console.log('--- server log tail ---');
    console.log(dapatLog().slice(-3000));
    throw e;
  } finally {
    proc.kill();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('GAGAL:', e); process.exit(1); });
