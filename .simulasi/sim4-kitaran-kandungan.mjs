// SIMULASI 4 — KITARAN HIDUP KANDUNGAN EDITORIAL (paling kritikal untuk launch).
//
// Menjejaki kandungan sebenar melalui alur kerja harian: Draf -> Terbitkan -> Menunggu ->
// Lulus -> Aktif -> Tolak/Arkib -> Pulih. Selepas SETIAP langkah, sahkan (a) kandungan masih
// wujud di suatu tempat, dan (b) medan tidak hilang senyap.
//
// Peraturan projek: kandungan editorial ialah tulisan SEBENAR — tiada satu pun langkah boleh
// memusnahkannya tanpa jejak. Simulasi ini yang membuktikannya, bukan andaian.
import path from 'node:path';
import os from 'node:os';
import sqlite3 from 'sqlite3';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, dbAll, dbRun, bukaDb, isiHuraianCukup, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5202;
const DBF = path.join(os.tmpdir(), 'sim-adjung-kitaran.db');
const lap = pelapor('SIM 4 — KITARAN KANDUNGAN');

const SLOT = 1;            // index 1 = "slot 2" (tier MENEGAK, ada huraian)
const BIDANG = 'Ekonomi';

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  await api('POST', '/api/system/categories/activate', { name: BIDANG, color: '#802334', icon: 'TrendingUp' });
  await api('POST', '/api/system/categories/assign-slot', { slotIndex: SLOT, bidangName: BIDANG });

  const kiraKandungan = async () => (await dbGet(db, 'SELECT COUNT(*) n FROM editorial_objects')).n;
  const statusTerkini = async (objectId) => (await dbGet(db,
    'SELECT status FROM editorial_revisions WHERE objectId=? ORDER BY version DESC LIMIT 1', [objectId]))?.status;

  // =====================================================================================
  // A. DRAF -> TERBITKAN (melalui POST /slots, laluan Urus Slot sebenar)
  // =====================================================================================
  const blokTerbit = [
    'UUID: sim-uuid-0001',
    'Tajuk: Dasar Fiskal Baharu Diumumkan',
    'Huraian ringkas: ' + isiHuraianCukup(ceilingForSlot, SLOT, 'Dasar Fiskal Baharu Diumumkan'.length),
    // Huraian Panjang WAJIB (2026-09-02, dapatan bug-hunt — lihat HURAIAN_PANJANG_SAH di
    // sim-lib.mjs); tanpanya langkah A ditolak 400 dan SELURUH kitaran B-F yang bergantung
    // padanya gagal berturutan.
    'Huraian panjang: ' + HURAIAN_PANJANG_SAH,
    'Bidang: ' + BIDANG,
    'Topik: Kewangan',
    'Sumber: Berita Harian',
    'URL: https://www.bharian.com.my/sim-ujian',
    'Status: terbit',
  ].join('\n');

  const rTerbit = await api('POST', '/api/system/slots', [{
    slotIndex: SLOT, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blokTerbit,
  }]);
  if (!rTerbit.ok) {
    lap.gagal('Terbitkan draf melalui POST /slots', `HTTP ${rTerbit.status} ${rTerbit.teks.slice(0, 250)}`);
  } else {
    const obj = await dbGet(db, 'SELECT id, slotIndex FROM editorial_objects ORDER BY createdAt DESC LIMIT 1');
    if (!obj) {
      lap.gagal('Terbitkan lapor berjaya tapi TIADA kandungan dicipta', 'editorial_objects kosong');
    } else {
      // ciptaPentadbir() sentiasa cipta akaun ketua_editor -- sejak pembetulan 2026-08-08
      // ("Ketua Editor pun kena tunggu luluskan kandungan sendiri!"), Ketua Editor/Penolong
      // dikecualikan drpd dasar semakan (bolehTerbitTerus di server.js), jadi Terbitkan sendiri
      // mendarat terus 'approved', BUKAN 'pending'/sebabMenunggu='semakan' (tu untuk Editor biasa
      // yg belum dibenarkan self-publish -- akaun ni bukan Editor biasa).
      const st = await statusTerkini(obj.id);
      if (st !== 'approved') lap.gagal('Terbitkan oleh Ketua Editor sepatutnya terus Aktif', `status=${st}`);
      else lap.lulus('Terbitkan oleh Ketua Editor terus Aktif (dasar self-publish 2026-08-08)');

      const attrs = Object.fromEntries((await dbAll(db,
        'SELECT attributeId, valueText FROM editorial_attribute_values WHERE objectId=?', [obj.id]))
        .map(a => [a.attributeId, a.valueText]));
      const hilang = ['desk', 'topik', 'source', 'url'].filter(k => !attrs[k]);
      if (hilang.length) lap.gagal('medan hilang selepas Terbitkan', hilang.join(', '));
      else lap.lulus('semua medan bertahan selepas Terbitkan');

      globalThis.OBJ1 = obj.id;
    }
  }

  // =====================================================================================
  // B. LULUS -> AKTIF
  // =====================================================================================
  if (globalThis.OBJ1) {
    const r = await api('PATCH', `/api/system/content/${globalThis.OBJ1}`, { status: 'approved' });
    const st = await statusTerkini(globalThis.OBJ1);
    if (!r.ok || st !== 'approved') lap.gagal('Luluskan kandungan', `HTTP ${r.status}, status DB=${st}`);
    else lap.lulus('Luluskan -> Aktif');
  }

  // =====================================================================================
  // C. HAD KAPASITI — kandungan kedua sepatutnya BERATUR, bukan hilang
  // =====================================================================================
  const amSet = await api('POST', '/api/system/slot-am-settings', {
    mulaIkutMasa: false, hadKandunganSlot: 1, jenisAnimasi: 'colophon', arahAnimasi: 'kanan',
    hadHuraianPanjang: 0, hadSumber: 0, hadTopik: 0, hadNotaEditor: 0,
    hadHuraianPanjangMin: 0, hadSumberMin: 0, hadTopikMin: 0, hadNotaEditorMin: 0, logoPenaja: '',
    warnaPanelTransisi: '#802334', nisbahPenajaTransisi: 0, focusViewTitleScale: 1, focusViewBodySize: 15,
    // Medan wajib ditambah kemudian, fixture ni tak pernah dikemas kini — lihat nota panjang di
    // sim3-tulisan-sah.mjs (dapatan bug-hunt 2026-09-02).
    petikanTempohPutaranSaat: 10, petikanKuantitiHarianMaksimum: 12,
    carouselJedaPertama: 15, carouselTempohLalai: 10, hadJamRotasiSlotPenuh: 24,
  });
  if (!amSet.ok) throw new Error('slot-am-settings gagal ditetapkan: ' + JSON.stringify(amSet.json));

  // Guna laluan SEBENAR editor (Terbitkan melalui POST /slots) — bukan POST /content, yang
  // disahkan TIDAK pernah dipanggil mana-mana skrin (laluan API sahaja).
  const blokKedua = [
    'UUID: sim-uuid-0002',
    'Tajuk: Kandungan Kedua Menunggu Ruang',
    'Huraian ringkas: ' + isiHuraianCukup(ceilingForSlot, SLOT, 'Kandungan Kedua Menunggu Ruang'.length),
    'Huraian panjang: ' + HURAIAN_PANJANG_SAH,
    'Bidang: ' + BIDANG,
    'Topik: Perbankan',
    'Sumber: Utusan',
    'URL: https://utusan.test/dua',
    'Status: terbit',
  ].join('\n');
  const r2 = await api('POST', '/api/system/slots', [{
    slotIndex: SLOT, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blokKedua,
  }]);
  const objKedua = await dbGet(db, "SELECT id FROM editorial_objects WHERE id != ? ORDER BY createdAt DESC LIMIT 1", [globalThis.OBJ1 || '']);
  const OBJ2 = objKedua?.id;
  if (!r2.ok || !OBJ2) {
    lap.gagal('Terbitkan kandungan kedua', `HTTP ${r2.status} ${r2.teks.slice(0, 200)}`);
  } else {
    const r3 = await api('PATCH', `/api/system/content/${OBJ2}`, { status: 'approved' });
    const st2 = await statusTerkini(OBJ2);
    const sebab2 = (await dbGet(db, "SELECT valueText v FROM editorial_attribute_values WHERE objectId=? AND attributeId='sebabMenunggu' ORDER BY id DESC LIMIT 1", [OBJ2]))?.v;
    if (st2 === 'approved') {
      lap.gagal('had kapasiti DIPINTAS', `slot had=1 tapi kandungan kedua terus Aktif — melebihi had`);
    } else if (st2 === 'pending' && sebab2 === 'slot_penuh') {
      lap.lulus('kandungan kedua beratur (slot_penuh), tidak hilang');
    } else {
      lap.gagal('keadaan kandungan kedua tak dijangka', `status=${st2} sebab=${sebab2}`);
    }
    globalThis.OBJ2 = OBJ2;
  }

  // =====================================================================================
  // D. ARKIB kandungan pertama -> kandungan kedua NAIK TARAF AUTOMATIK
  // =====================================================================================
  if (globalThis.OBJ1 && globalThis.OBJ2) {
    await api('PATCH', `/api/system/content/${globalThis.OBJ1}`, { status: 'archived' });
    await new Promise(r => setTimeout(r, 500));
    const st2 = await statusTerkini(globalThis.OBJ2);
    if (st2 === 'approved') lap.lulus('kandungan beratur dinaikkan automatik bila ruang terbuka');
    else lap.gagal('naik taraf automatik TIDAK berlaku', `kandungan kedua masih ${st2} walau slot dah kosong`);
  }

  // =====================================================================================
  // E. TOLAK KE DRAF — kandungan MESTI selamat sebagai teks draf (tidak musnah)
  // =====================================================================================
  if (globalThis.OBJ2) {
    const tajukAsal = (await dbGet(db, 'SELECT title FROM editorial_revisions WHERE objectId=? ORDER BY version DESC LIMIT 1', [globalThis.OBJ2]))?.title;
    // `sebab` WAJIB sejak 2026-08-18 (dapatan bug-hunt 2026-09-02 — fixture ni tak pernah
    // dikemas kini selepas keputusan Izzat tu, contentRoutes.js ~baris 1661).
    const r = await api('POST', `/api/system/content/${globalThis.OBJ2}/reject-to-draft`, { sebab: 'Ujian simulasi: draf perlu semakan semula.' });
    if (!r.ok) {
      lap.gagal('Tolak ke draf', `HTTP ${r.status} ${r.teks.slice(0, 200)}`);
    } else {
      const slotRow = await dbGet(db, "SELECT manualSummary FROM slots_config WHERE layoutTemplateId='frontpage' AND slotIndex=?", [SLOT]);
      const teksDraf = slotRow?.manualSummary || '';
      const st = await statusTerkini(globalThis.OBJ2);
      if (!teksDraf.includes(tajukAsal)) {
        lap.gagal('KANDUNGAN MUSNAH semasa Tolak ke draf', `tajuk "${tajukAsal}" TIADA dalam teks draf slot, tapi revisi ditanda ${st}`);
      } else if (st !== 'archived') {
        lap.gagal('revisi tidak diarkibkan selepas Tolak', `status=${st}`);
      } else {
        lap.lulus('Tolak ke draf: kandungan selamat sebagai draf, revisi diarkibkan');
      }
    }
  }

  // =====================================================================================
  // F. PULIH VERSI — mesti hormati kapasiti, bukan pintas
  // =====================================================================================
  if (globalThis.OBJ1) {
    const revs = await dbAll(db, 'SELECT id, version, status FROM editorial_revisions WHERE objectId=? ORDER BY version ASC', [globalThis.OBJ1]);
    const revLama = revs.find(r => r.status === 'approved') || revs[0];
    if (revLama) {
      const r = await api('POST', `/api/system/content/${globalThis.OBJ1}/revisions/${revLama.id}/restore`, {});
      if (!r.ok) {
        lap.gagal('Pulih versi', `HTTP ${r.status} ${r.teks.slice(0, 200)}`);
      } else {
        const bilAktif = (await dbGet(db, `
          SELECT COUNT(*) n FROM editorial_objects o JOIN editorial_revisions r ON r.objectId=o.id
          WHERE o.slotIndex=? AND r.status='approved'
            AND r.version=(SELECT MAX(version) FROM editorial_revisions WHERE objectId=o.id)`, [SLOT])).n;
        if (bilAktif > 1) lap.gagal('Pulih versi PINTAS had kapasiti', `had=1 tapi ${bilAktif} kandungan Aktif`);
        else lap.lulus('Pulih versi menghormati had kapasiti');
      }
    }
  }

  // =====================================================================================
  // G. TIADA kandungan hilang sepanjang keseluruhan kitaran
  // =====================================================================================
  const jumlah = await kiraKandungan();
  if (jumlah < 2) lap.gagal('kandungan HILANG daripada DB', `dijangka >=2 objek, dapat ${jumlah}`);
  else lap.lulus(`kesemua ${jumlah} objek kandungan masih wujud selepas kitaran penuh`);

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
