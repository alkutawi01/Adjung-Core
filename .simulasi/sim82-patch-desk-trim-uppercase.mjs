// SIMULASI 82 — PATCH /content/:id: nilai `desk` mesti trim+uppercase sebelum simpan
// (bug-hunt round 250, dapatan dijangka daripada nota "theoretical gap" sesi lalu).
//
// POST /content (laluan cipta baharu) sentiasa `finalCategory = (desk||'UMUM').trim().toUpperCase()`
// sebelum tulis ke editorial_attribute_values. PATCH /content/:id (laluan edit) dahulu terus
// guna `desk` MENTAH terus daripada req.body — validateBidangTopik() sendiri trim+uppercase
// SEBELUM banding (jadi PATCH lulus gerbang sepadan Bidang slot), tapi nilai yang benar-benar
// DISIMPAN kekal ada ruang/kes asal. Ini pecahkan LOWER(av.valueText)=LOWER(?) di bidangRoutes.js
// (LOWER tak trim ruang) dan bocor ruang/kes janggal terus ke label awam (articleUrlRoutes.js).
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, bukaDb, isiHuraianCukup, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5282;
const DBF = path.join(os.tmpdir(), 'sim-adjung-patch-desk-trim.db');
const lap = pelapor('SIM 82 — PATCH desk trim+uppercase');

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

  const TAJUK_UNIK = 'Sim82 Ujian Trim Bidang PATCH Desk';
  const blok = [
    'UUID: sim82-uuid-0001',
    `Tajuk: ${TAJUK_UNIK}`,
    'Huraian ringkas: ' + isiHuraianCukup(ceilingForSlot, SLOT, TAJUK_UNIK.length),
    'Huraian panjang: ' + HURAIAN_PANJANG_SAH,
    'Bidang: ' + BIDANG,
    'Topik: Kewangan',
    'Sumber: Berita Harian',
    'URL: https://www.bharian.com.my/sim82-ujian',
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

  // PATCH desk dengan ruang belakang + huruf kecil bercampur — MESTI lulus gerbang
  // validateBidangTopik (ia trim+uppercase sebelum banding), tapi nilai TERSIMPAN mestilah
  // trim+uppercase juga (sama macam finalCategory laluan POST) — bukan " ekonomi " mentah.
  const deskKotor = ' ekonomi ';
  const rPatch = await api('PATCH', `/api/system/content/${OBJ}`, { desk: deskKotor, topik: 'Kewangan' });
  if (!rPatch.ok) throw new Error('PATCH desk gagal: HTTP ' + rPatch.status + ' ' + rPatch.teks.slice(0, 300));

  const revRow = await dbGet(db, 'SELECT id FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1', [OBJ]);
  const attrRow = await dbGet(db,
    "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'desk'",
    [OBJ, revRow.id]);

  console.log('  Nilai desk tersimpan selepas PATCH:', JSON.stringify(attrRow ? attrRow.valueText : null));

  if (!attrRow || attrRow.valueText !== 'EKONOMI') {
    lap.gagal('PATCH desk TIDAK dinormalisasi (trim+uppercase)', `valueText tersimpan = ${JSON.stringify(attrRow && attrRow.valueText)}`);
  } else {
    lap.lulus('PATCH desk dinormalisasi trim+uppercase sebelum simpan ("EKONOMI")');
  }

  // Sahkan padanan bidangRoutes.js (LOWER(valueText)=LOWER(name)) masih berfungsi selepas fix —
  // ini SEBAB SEBENAR normalisasi ni penting (kandungan mesti kekal kelihatan di Halaman Bidang).
  const rBidang = await fetch(`${srv.base}/api/bidang/${encodeURIComponent(BIDANG.toLowerCase())}/artikel?page=1`).then(r => r.json()).catch(() => null);
  const bidangJson = JSON.stringify(rBidang || {});
  if (rBidang && bidangJson.includes(TAJUK_UNIK)) {
    lap.lulus('Kandungan kekal kelihatan di Halaman Bidang selepas PATCH desk berruang');
  } else {
    lap.gagal('Kandungan HILANG daripada Halaman Bidang selepas PATCH desk berruang (LOWER() tak trim ruang)', bidangJson.slice(0, 300));
  }

  lap.ringkasan();
} finally {
  srv.proc.kill();
}
