// Sahkan putarSegeraJikaLayak() (contentRoutes.js) — dapatan Izzat 2026-09-11: bila editor
// terbitkan kandungan ke slot yang PENUH (approved >= hadKandunganSlot), sistem sepatutnya
// SEMAK DAHULU sama ada kandungan approved TERTUA dalam slot tu dah lepasi ambang rotasi
// (hadJamRotasiSlotPenuh) — kalau ya, arkibkan terus dan terbitkan kandungan baharu SERTA-MERTA
// (bukan 'pending'+toast "menunggu slot kosong"). Cuma jatuh ke 'pending' bila kandungan tertua
// BELUM lepasi ambang (kes yang MEMANG perlu tunggu sebenar).
//
// Dua senario diuji: (A) tertua > 24 jam -> terbit serta-merta, tertua diarkibkan.
// (B) tertua < 24 jam -> jatuh pending+slot_penuh macam sebelum ini (regresi tidak berlaku).
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, dbRun, bukaDb, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5311;
const DBF = path.join(os.tmpdir(), 'sim-adjung-putar-segera.db');
const lap = pelapor('SIM VERIFY — putarSegeraJikaLayak');

const BIDANG = 'Ekonomi';

const isiHuraian = (slotIndex, sudahDipakai) => {
  const { maxTitle, maxBrief } = ceilingForSlot(slotIndex);
  const bakiFraction = Math.max(0, 0.86 - sudahDipakai / maxTitle);
  const sasaran = Math.min(maxBrief, Math.max(20, Math.round(bakiFraction * maxBrief)));
  let huraian = 'Ujian putar segera. ';
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
  for (const s of [1, 2]) await api('POST', '/api/system/categories/assign-slot', { slotIndex: s, bidangName: BIDANG });

  const amSet = await api('POST', '/api/system/slot-am-settings', {
    mulaIkutMasa: false, hadKandunganSlot: 1, jenisAnimasi: 'colophon', arahAnimasi: 'kanan',
    hadHuraianPanjang: 0, hadSumber: 0, hadTopik: 0, hadNotaEditor: 0,
    hadHuraianPanjangMin: 0, hadSumberMin: 0, hadTopikMin: 0, hadNotaEditorMin: 0, logoPenaja: '',
    warnaPanelTransisi: '#802334', nisbahPenajaTransisi: 0, focusViewTitleScale: 1, focusViewBodySize: 15,
    petikanTempohPutaranSaat: 10, petikanKuantitiHarianMaksimum: 12,
    carouselJedaPertama: 15, carouselTempohLalai: 10, hadJamRotasiSlotPenuh: 24,
  });
  if (!amSet.ok) throw new Error('slot-am-settings gagal ditetapkan: ' + JSON.stringify(amSet.json));

  // --- SENARIO A: kandungan tertua dah lepasi 24 jam -> terbit serta-merta ---------------
  await api('POST', '/api/system/slots', [{ slotIndex: 1, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok('lama-a', 'Kandungan Lama A', 1) }]);
  const lamaA = await dbGet(db, "SELECT id FROM editorial_objects WHERE slotIndex=1 ORDER BY createdAt DESC LIMIT 1");
  await api('PATCH', `/api/system/content/${lamaA.id}`, { status: 'approved' });
  // Backdate 25 jam — lepasi ambang hadJamRotasiSlotPenuh=24.
  const jam25Lalu = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  await dbRun(db, "UPDATE editorial_objects SET createdAt = ? WHERE id = ?", [jam25Lalu, lamaA.id]);

  const simpanBaharuA = await api('POST', '/api/system/slots', [{ slotIndex: 1, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok('baharu-a', 'Kandungan Baharu A', 1) }]);
  if (!simpanBaharuA.ok) throw new Error('Simpan Senario A gagal: ' + JSON.stringify(simpanBaharuA.json));

  const baharuA = await dbGet(db, "SELECT o.id, r.status FROM editorial_objects o JOIN editorial_revisions r ON r.objectId=o.id WHERE o.slotIndex=1 AND o.id != ? ORDER BY o.createdAt DESC LIMIT 1", [lamaA.id]);
  const lamaAStatus = await dbGet(db, "SELECT status FROM editorial_revisions WHERE objectId=? ORDER BY version DESC LIMIT 1", [lamaA.id]);

  if (baharuA?.status === 'approved' && lamaAStatus?.status === 'archived') {
    lap.lulus(`Senario A (tertua >24j): kandungan baharu TERUS approved, kandungan lama diarkibkan automatik (tiada toast "menunggu" palsu)`);
  } else {
    lap.gagal('Senario A GAGAL', `baharu.status=${baharuA?.status} (jangka approved), lama.status=${lamaAStatus?.status} (jangka archived)`);
  }

  // --- SENARIO B: kandungan tertua MASIH < 24 jam -> genuine pending+slot_penuh ----------
  await api('POST', '/api/system/slots', [{ slotIndex: 2, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok('lama-b', 'Kandungan Lama B', 2) }]);
  const lamaB = await dbGet(db, "SELECT id FROM editorial_objects WHERE slotIndex=2 ORDER BY createdAt DESC LIMIT 1");
  await api('PATCH', `/api/system/content/${lamaB.id}`, { status: 'approved' });
  // TIADA backdate — createdAt kekal "baru sahaja" (< 24 jam).

  const simpanBaharuB = await api('POST', '/api/system/slots', [{ slotIndex: 2, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok('baharu-b', 'Kandungan Baharu B', 2) }]);
  if (!simpanBaharuB.ok) throw new Error('Simpan Senario B gagal: ' + JSON.stringify(simpanBaharuB.json));

  const baharuB = await dbGet(db, "SELECT o.id, r.status FROM editorial_objects o JOIN editorial_revisions r ON r.objectId=o.id WHERE o.slotIndex=2 AND o.id != ? ORDER BY o.createdAt DESC LIMIT 1", [lamaB.id]);
  const sebabMenungguB = await dbGet(db, "SELECT valueText FROM editorial_attribute_values WHERE objectId=? AND attributeId='sebabMenunggu'", [baharuB.id]);
  const lamaBStatus = await dbGet(db, "SELECT status FROM editorial_revisions WHERE objectId=? ORDER BY version DESC LIMIT 1", [lamaB.id]);

  if (baharuB?.status === 'pending' && sebabMenungguB?.valueText === 'slot_penuh' && lamaBStatus?.status === 'approved') {
    lap.lulus(`Senario B (tertua <24j): kandungan baharu BETUL jatuh 'pending'+slot_penuh (kena tunggu sebenar), kandungan lama KEKAL approved (tiada regresi)`);
  } else {
    lap.gagal('Senario B GAGAL (regresi)', `baharu.status=${baharuB?.status}, sebabMenunggu=${sebabMenungguB?.valueText}, lama.status=${lamaBStatus?.status}`);
  }

  db.close();
} finally {
  srv.proc.kill();
}
