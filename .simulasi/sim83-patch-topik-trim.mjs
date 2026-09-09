// SIMULASI 83 — PATCH /content/:id: nilai `topik` mesti trim sebelum simpan
// (bug-hunt round 251, susulan langsung dapatan #224 pada `desk` — semak SETIAP medan lain
// dalam handler PATCH untuk corak sama "validate normalizes internally but persist keeps raw").
//
// validateBidangTopik() (ContentBudget.js) SENDIRI `.trim()` Topik untuk semakan kosong dan had
// aksara eyebrow (`topikTrimmed`). Log audit taksonomi PATCH ni sendiri (contentRoutes.js
// ~baris 1341, `topikSelepas`) turut `.trim()` Topik SEBELUM banding lama-vs-baharu. Tapi
// sebelum pembetulan ni, nilai yang BENAR-BENAR ditulis ke editorial_attribute_values
// (attrCandidates) ialah `topik` MENTAH terus daripada req.body — sama corak persis seperti
// pepijat `desk` #224, cuma kesan berbeza: (1) log audit taksonomi SENYAP LANGKAU catat
// perubahan kalau bezanya cuma ruang hujung (nilai tersimpan sebenar BERUBAH tapi tak direkod);
// (2) articleUrlRoutes.js (ambilKandunganUntukSeo) papar Topik terus sebagai teks meta SEO awam
// TANPA trim — ruang hujung bocor terus ke HTML awam yang dibaca crawler/pratonton pautan.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, bukaDb, isiHuraianCukup, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5283;
const DBF = path.join(os.tmpdir(), 'sim-adjung-patch-topik-trim.db');
const lap = pelapor('SIM 83 — PATCH topik trim');

const SLOT = 2; // STANDARD tier
const BIDANG = 'Ekonomi';

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  await api('POST', '/api/system/categories/activate', { name: BIDANG, color: '#334455', icon: 'TrendingUp' });
  await api('POST', '/api/system/categories/assign-slot', { slotIndex: SLOT, bidangName: BIDANG });

  const TAJUK_UNIK = 'Sim83 Ujian Trim Topik PATCH';
  const blok = [
    'UUID: sim83-uuid-0001',
    `Tajuk: ${TAJUK_UNIK}`,
    'Huraian ringkas: ' + isiHuraianCukup(ceilingForSlot, SLOT, TAJUK_UNIK.length),
    'Huraian panjang: ' + HURAIAN_PANJANG_SAH,
    'Bidang: ' + BIDANG,
    'Topik: Kewangan',
    'Sumber: Berita Harian',
    'URL: https://www.bharian.com.my/sim83-ujian',
    'Tarikh sumber: 2026-09-01',
    'Status: terbit',
  ].join('\n');

  const rTerbit = await api('POST', '/api/system/slots', [{
    slotIndex: SLOT, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok,
  }]);
  if (!rTerbit.ok) throw new Error('Terbitkan gagal: HTTP ' + rTerbit.status + ' ' + rTerbit.teks.slice(0, 200));

  const obj = await dbGet(db, 'SELECT id FROM editorial_objects ORDER BY createdAt DESC LIMIT 1');
  if (!obj) throw new Error('Tiada objek dicipta selepas terbit');
  const OBJ = obj.id;

  // PATCH topik dengan ruang hujung — MESTI lulus gerbang validateBidangTopik (ia trim SEBELUM
  // semak kosong/had), tapi nilai TERSIMPAN mestilah bersih trim juga (sama macam `desk`).
  const topikKotor = '  Perbankan  ';
  const rPatch = await api('PATCH', `/api/system/content/${OBJ}`, { topik: topikKotor });
  if (!rPatch.ok) throw new Error('PATCH topik gagal: HTTP ' + rPatch.status + ' ' + rPatch.teks.slice(0, 300));

  const revRow = await dbGet(db, 'SELECT id FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1', [OBJ]);
  const attrRow = await dbGet(db,
    "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'topik'",
    [OBJ, revRow.id]);

  console.log('  Nilai topik tersimpan selepas PATCH:', JSON.stringify(attrRow ? attrRow.valueText : null));

  if (!attrRow || attrRow.valueText !== 'Perbankan') {
    lap.gagal('PATCH topik TIDAK dinormalisasi (trim)', `valueText tersimpan = ${JSON.stringify(attrRow && attrRow.valueText)}`);
  } else {
    lap.lulus('PATCH topik dinormalisasi trim sebelum simpan ("Perbankan")');
  }

  // Sahkan laluan SEO awam (articleUrlRoutes.js) tak lagi bocor ruang hujung Topik ke HTML awam —
  // ini SEBAB SEBENAR normalisasi ni penting untuk medan `topik`.
  const htmlAwam = await fetch(`${srv.base}/artikel/${encodeURIComponent(OBJ)}`).then(r => r.text()).catch(() => '');
  if (htmlAwam.includes('  Perbankan  ') || htmlAwam.includes('Perbankan  ') || htmlAwam.includes('  Perbankan')) {
    lap.gagal('Ruang hujung Topik bocor ke HTML halaman artikel awam', htmlAwam.slice(0, 300));
  } else {
    lap.lulus('Tiada ruang hujung Topik bocor ke HTML halaman artikel awam (atau laluan tak wujud/tak mengandungi Topik — semak manual jika perlu)');
  }

  lap.ringkasan();
} finally {
  srv.proc.kill();
}
