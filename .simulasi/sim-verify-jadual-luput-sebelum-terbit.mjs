// Sahkan pembetulan bug-hunt 2026-09-11: PATCH /api/system/content/:id (contentRoutes.js) kini
// menolak Jadual Luput (scheduledExpiresAt) yang <= Jadual Terbit (scheduledPublishAt) bila
// KEDUA-DUA dihantar/berkesan serentak. Sebelum pembetulan, tiada semakan ni langsung — editor
// boleh tetapkan Jadual Terbit 5 hari lagi + Jadual Luput 2 hari lagi (terbalik/tersilap), dan
// kandungan akan diarkibkan semula SERTA-MERTA (tik 90 saat lepas terbit) tanpa amaran.
//
// Tiga senario: (A) Luput SEBELUM Terbit -> ditolak 400. (B) Luput SELEPAS Terbit -> diterima.
// (C) Cuma satu medan dihantar (batal jadual sedia ada) -> semakan silang dilangkau, tak sekat
// operasi sah yang tak berkaitan.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, bukaDb, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5312;
const DBF = path.join(os.tmpdir(), 'sim-adjung-jadual-luput-sebelum-terbit.db');
const lap = pelapor('SIM VERIFY — Jadual Luput mesti selepas Jadual Terbit');

const BIDANG = 'Ekonomi';

const isiHuraian = (slotIndex, sudahDipakai) => {
  const { maxTitle, maxBrief } = ceilingForSlot(slotIndex);
  const bakiFraction = Math.max(0, 0.86 - sudahDipakai / maxTitle);
  const sasaran = Math.min(maxBrief, Math.max(20, Math.round(bakiFraction * maxBrief)));
  let huraian = 'Ujian jadual luput. ';
  while (huraian.length < sasaran) huraian += 'Tambah teks. ';
  return huraian.slice(0, sasaran).trim();
};

const blok = (uuid, tajuk, slotIndex) => [
  `UUID: ${uuid}`, `Tajuk: ${tajuk}`, 'Huraian ringkas: ' + isiHuraian(slotIndex, tajuk.length),
  'Huraian panjang: ' + HURAIAN_PANJANG_SAH,
  'Bidang: ' + BIDANG, 'Topik: Kewangan', 'Sumber: Adjung Editorial', 'Status: terbit',
].join('\n');

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  await api('POST', '/api/system/categories/activate', { name: BIDANG, color: '#802334', icon: 'TrendingUp' });
  await api('POST', '/api/system/categories/assign-slot', { slotIndex: 1, bidangName: BIDANG });

  await api('POST', '/api/system/slots', [{ slotIndex: 1, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok('kandungan-1', 'Kandungan Ujian Jadual', 1) }]);
  const obj = await dbGet(db, "SELECT id FROM editorial_objects WHERE slotIndex=1 ORDER BY createdAt DESC LIMIT 1");
  await api('PATCH', `/api/system/content/${obj.id}`, { status: 'approved' });

  // Kandungan GANTIAN dalam slot sama (Keputusan Izzat #1, hasReplacementForExpiry) — bukan
  // fokus ujian ni, cuma prasyarat supaya gerbang "satu-satunya kandungan slot" tak menyekat
  // dahulu sebelum semakan susunan tarikh sempat diuji.
  await api('POST', '/api/system/slots', [{ slotIndex: 1, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok('kandungan-2-gantian', 'Kandungan Gantian', 1) }]);

  const terbit5Hari = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const luput2Hari = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const luput7Hari = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // --- SENARIO A: Luput (2 hari) SEBELUM Terbit (5 hari) -> MESTI ditolak ---------------
  const senarioA = await api('PATCH', `/api/system/content/${obj.id}`, {
    scheduledPublishAt: terbit5Hari, scheduledExpiresAt: luput2Hari,
  });
  if (senarioA.status === 400 && /Jadual Luput mesti selepas Jadual Terbit/.test(senarioA.json?.error || '')) {
    lap.lulus('Senario A: Jadual Luput sebelum Jadual Terbit DITOLAK dengan mesej yang jelas');
  } else {
    lap.gagal('Senario A GAGAL', `status=${senarioA.status}, body=${JSON.stringify(senarioA.json)}`);
  }
  const revSelepasA = await dbGet(db, "SELECT scheduledPublishAt, scheduledExpiresAt FROM editorial_revisions WHERE objectId=? ORDER BY version DESC LIMIT 1", [obj.id]);
  if (!revSelepasA.scheduledPublishAt && !revSelepasA.scheduledExpiresAt) {
    lap.lulus('Senario A: DB TIDAK tersentuh selepas PATCH ditolak (tiada tulisan separa)');
  } else {
    lap.gagal('Senario A GAGAL (kesan sampingan)', JSON.stringify(revSelepasA));
  }

  // --- SENARIO B: Luput (7 hari) SELEPAS Terbit (5 hari) -> MESTI diterima -------------
  const senarioB = await api('PATCH', `/api/system/content/${obj.id}`, {
    scheduledPublishAt: terbit5Hari, scheduledExpiresAt: luput7Hari,
  });
  if (senarioB.ok) {
    lap.lulus('Senario B: Jadual Luput selepas Jadual Terbit (susunan betul) DITERIMA');
  } else {
    lap.gagal('Senario B GAGAL', `status=${senarioB.status}, body=${JSON.stringify(senarioB.json)}`);
  }

  // --- SENARIO C: Batal Jadual Luput sahaja (hantar scheduledExpiresAt='' , tiada
  // scheduledPublishAt) -> semakan silang MESTI dilangkau (tiada dua tarikh utk dibanding).
  const senarioC = await api('PATCH', `/api/system/content/${obj.id}`, { scheduledExpiresAt: '' });
  if (senarioC.ok) {
    lap.lulus('Senario C: batal Jadual Luput sahaja (satu medan) tidak disekat oleh semakan susunan');
  } else {
    lap.gagal('Senario C GAGAL', `status=${senarioC.status}, body=${JSON.stringify(senarioC.json)}`);
  }

  db.close();
} finally {
  srv.proc.kill();
}
