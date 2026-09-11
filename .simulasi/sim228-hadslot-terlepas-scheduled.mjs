// sim228 — bug-hunt 2026-09-11. Continuing the "'scheduled' status introduced later but a
// pre-existing status filter/aggregate elsewhere never updated to include it" vein (rounds
// #302/#303). Scheduling.js's canonical STATUS_MASIH_HIDUP = ['approved','pending','scheduled']
// defines "still-alive" content for slot-capacity purposes. The comment directly above the
// hadKandunganSlot capacity check in POST /api/system/content (contentRoutes.js ~line 2359) says
// literally: "Dikira daripada kandungan yang masih hidup sahaja — kandungan arkib tidak mengambil
// ruang slot" (counted from still-alive content only — archived content does not take up slot
// space). But the actual SQL only checks `r.status IN ('approved', 'pending')` — 'scheduled' is
// missing, even though a scheduled item plainly still occupies the slot (it will become approved
// on its own once its publish time arrives, same as CLAUDE.md's "Dua laluan edit selepas terbit"
// section documents). The identical query (same string) also exists in pipelineRoutes.js
// (batch-paste), explicitly cross-referenced there as "sama seperti POST /content (Pelan 02 #1)".
//
// This sim proves the capacity gate can be defeated: with hadKandunganSlot=1 and slot 5 already
// holding ONE 'scheduled' item (a future-dated draft awaiting its publish time — very much
// "still alive"/reserving the slot), POST /api/system/content should refuse a second new item
// for the same slot (or defer it to 'pending'/slot_penuh) but instead lets it straight through
// as 'approved', because the capacity COUNT query silently ignores 'scheduled' rows.
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien, dbRun, dbGet, HURAIAN_PANJANG_SAH, isiHuraianCukup } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5901;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim228.db');
const SLOT = 2; // STANDARD tier, bukan BAR, bukan Ticker — ruang bajet lebih lapang drpd KOMPAK

async function main() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE, { id: 'admin-228', username: 'admin-228' });
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    // 1) Hadkan slot kepada 1 kandungan sahaja (baca tetapan sedia ada dahulu, POST perlukan
    //    badan PENUH kerana ia tulis-ganti seluruh baris, bukan PATCH separa).
    const sediaAda = await api('GET', '/api/system/slot-am-settings');
    const r0 = await api('POST', '/api/system/slot-am-settings', { ...sediaAda.json, hadKandunganSlot: 1 });
    console.log('1) tetapkan hadKandunganSlot=1:', r0.status);
    if (r0.status !== 200) throw new Error('Gagal tetapkan Tetapan Am Slot: ' + JSON.stringify(r0.json));

    // 2) Suntik satu kandungan SEDIA ADA berstatus 'scheduled' (bakal terbit) terus ke slot 5,
    //    melangkau API (mensimulasikan kandungan yang telah wujud daripada laluan Jadual Terbit).
    const db = new sqlite3.Database(DB_FILE);
    const now = new Date().toISOString();
    const futurePublish = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const objectId = 'object-sim228-scheduled';
    await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, slotIndex, createdAt, updatedAt)
      VALUES (?, 'kad', 'UMUM', ?, ?, ?)`, [objectId, SLOT, now, now]);
    await dbRun(db, `INSERT INTO editorial_revisions
      (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt, scheduledPublishAt)
      VALUES (?, 1, 'ms', 'Kandungan sedia ada berjadual sim228', 'Huraian kandungan berjadual sim228 yang akan terbit esok.', 'scheduled', 'sim-seed', ?, ?, ?)`,
      [objectId, now, now, futurePublish]);
    await new Promise((res) => db.close(res));
    console.log('2) suntik kandungan status=scheduled ke slot', SLOT, '(scheduledPublishAt =', futurePublish + ')');

    // 3) Cuba cipta kandungan BAHARU pada slot yang SAMA. Slot 5 kini ada 1 kandungan "masih
    //    hidup" (scheduled) — dengan hadKandunganSlot=1, ni patut DITOLAK atau jatuh ke
    //    'pending'/slot_penuh, BUKAN terus jadi 'approved'.
    const tajukBaharu = 'Kandungan baharu sim228 sepatutnya disekat had slot';
    const r1 = await api('POST', '/api/system/content', {
      slotIndex: SLOT,
      title: tajukBaharu,
      summary: isiHuraianCukup(ceilingForSlot, SLOT, tajukBaharu.length),
      briefLong: HURAIAN_PANJANG_SAH,
      desk: 'UMUM',
      topik: 'Ujian',
      source: 'Sumber Ujian',
      url: 'https://contoh.test/artikel-sim228',
      status: 'approved',
    });
    console.log('3) POST /content kandungan kedua:', r1.status, r1.json?.error || r1.json?.id, r1.json?.status);
    if (r1.status === 200) {
      // Laluan lama (pra-pembetulan): terus lulus 200 sebagai 'approved' — buktikan pelanggaran had.
      const dbCheck = new sqlite3.Database(DB_FILE);
      const kiraan = await dbGet(dbCheck, `
        SELECT COUNT(*) AS n FROM editorial_objects o
        JOIN editorial_revisions r ON r.objectId = o.id
        WHERE o.slotIndex = ? AND r.status IN ('approved', 'pending', 'scheduled')
          AND r.version = (SELECT MAX(version) FROM editorial_revisions WHERE objectId = o.id)
      `, [SLOT]);
      const statusBaharu = await dbGet(dbCheck, `SELECT status FROM editorial_revisions WHERE objectId = ?`, [r1.json.id]);
      await new Promise((res) => dbCheck.close(res));
      console.log('4) jumlah kandungan masih-hidup dalam slot', SLOT, 'selepas cipta:', kiraan.n, '| status kandungan baharu:', statusBaharu.status);
      if (kiraan.n > 1 && statusBaharu.status === 'approved') {
        throw new Error(`BUG DISAHKAN: hadKandunganSlot=1 tapi slot ${SLOT} kini ada ${kiraan.n} kandungan masih-hidup (1 scheduled + 1 approved baharu) — gerbang capacity POST /content mengira status IN ('approved','pending') SAHAJA, terlepas 'scheduled', jadi langsung tak nampak kandungan sedia ada dan benarkan had dilanggar.`);
      }
    } else if (r1.status === 400 && /sudah ada 1 kandungan/.test(r1.json?.error || '')) {
      console.log('4) DITOLAK SEPERTI DIJANGKA — gerbang hadKandunganSlot nampak kandungan scheduled sedia ada.');
    } else {
      throw new Error('Status/respons tak dijangka: ' + r1.status + ' ' + JSON.stringify(r1.json));
    }

    console.log('\nBERSIH — gerbang hadKandunganSlot menghormati kandungan berstatus scheduled.');
  } catch (e) {
    console.log('--- server log tail ---');
    console.log(dapatLog().slice(-3000));
    throw e;
  } finally {
    proc.kill();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('GAGAL:', e); process.exit(1); });
