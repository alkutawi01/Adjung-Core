// SIMULASI 11 — MATRIKS KETERLIHATAN STATUS (susulan kebocoran draf).
//
// Pepijat "draf terpapar kepada pembaca" (SIM 8) menunjukkan penapisan status boleh terlepas
// pada satu laluan render. Simulasi ini menutup SELURUH matriks: kandungan diletakkan dalam
// SETIAP status, melalui KEDUA-DUA laluan render (baris editorial_objects sebenar DAN laluan
// sandaran teks mentah), kemudian disemak pada SETIAP permukaan awam.
//
// Peraturan: HANYA 'approved' boleh dilihat pembaca. draf/menunggu/dijadualkan/arkib TIDAK.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, dbAll, bukaDb, isiHuraianCukup, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5210;
const DBF = path.join(os.tmpdir(), 'sim-adjung-status.db');
const lap = pelapor('SIM 11 — MATRIKS STATUS');

const BIDANG = 'Ekonomi';
const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const awam = buatKlien(srv.base, '');
  const db = bukaDb(DBF);

  await api('POST', '/api/system/categories/activate', { name: BIDANG, color: '#802334', icon: 'TrendingUp' });

  // Huraian Panjang WAJIB disertakan (2026-09-02, dapatan bug-hunt — lihat nota HURAIAN_PANJANG_SAH
  // di sim-lib.mjs). Tanpanya, KES_BARIS di bawah (yang benar-benar melalui POST /slots) ditolak
  // 400 pada penciptaan, `o` jadi undefined, PATCH status dilangkau senyap, dan ujian bahagian C
  // (kandungan aktif mesti kelihatan) melaporkan kandungan "hilang dari frontpage" — sedangkan ia
  // tidak pernah wujud pun langsung, bukan bocor/hilang di laluan render.
  const blok = (uuid, tajuk, status, slotIndex = 1) => [
    `UUID: ${uuid}`, `Tajuk: ${tajuk}`, 'Huraian ringkas: ' + isiHuraianCukup(ceilingForSlot, slotIndex, tajuk.length),
    'Huraian panjang: ' + HURAIAN_PANJANG_SAH,
    'Bidang: ' + BIDANG, 'Topik: Kewangan', `Status: ${status}`,
  ].join('\n');

  // ---------------------------------------------------------------------------------------
  // A. LALUAN SANDARAN (teks mentah, slot tiada baris editorial_objects)
  //    Setiap slot dapat SATU blok sahaja supaya sumber kebocoran jelas.
  // ---------------------------------------------------------------------------------------
  // PENTING: laluan sandaran hanya aktif bila slot TIADA baris editorial_objects langsung —
  // iaitu kandungan LEGASI (blob teks sebelum migrasi). Menyimpan melalui POST /slots akan
  // mencipta baris sebenar, jadi ia TIDAK menguji laluan ni. Teks ditulis TERUS ke slots_config
  // untuk meniru keadaan legasi sebenar.
  const KES_SANDARAN = [
    [11, 'SANDARAN-DRAF-RAHSIA', 'draf', false],
    [12, 'SANDARAN-MENUNGGU-RAHSIA', 'pending', false],
    [13, 'SANDARAN-TERBIT-AWAM', 'terbit', true],
  ];
  for (const [slot, tajuk, status] of KES_SANDARAN) {
    await api('POST', '/api/system/categories/assign-slot', { slotIndex: slot, bidangName: BIDANG });
    await new Promise((res, rej) => db.run(
      "UPDATE slots_config SET contentMode='Manual', manualSummary=? WHERE layoutTemplateId='frontpage' AND slotIndex=?",
      [blok(`sandaran-${slot}`, tajuk, status), slot], (e) => e ? rej(e) : res()));
  }

  // KESERASIAN KE BELAKANG — kandungan LEGASI tulen: TIADA baris "Status:" langsung (ditulis
  // sebelum medan Status wujud). Ia MESTI kekal terpapar. Penapis status pada laluan sandaran
  // tidak boleh menyembunyikan kandungan sebenar Izzat yang sedia ada di produksi.
  await api('POST', '/api/system/categories/assign-slot', { slotIndex: 18, bidangName: BIDANG });
  await new Promise((res, rej) => db.run(
    "UPDATE slots_config SET contentMode='Manual', manualSummary=? WHERE layoutTemplateId='frontpage' AND slotIndex=?",
    [['UUID: legasi-18', 'Tajuk: LEGASI-TANPA-STATUS-AWAM', 'Huraian ringkas: Kandungan lama.',
      'Bidang: ' + BIDANG, 'Topik: Kewangan'].join('\n'), 18], (e) => e ? rej(e) : res()));
  KES_SANDARAN.push([18, 'LEGASI-TANPA-STATUS-AWAM', '(tiada baris Status)', true]);

  // ---------------------------------------------------------------------------------------
  // B. LALUAN BARIS SEBENAR — terbitkan, kemudian tetapkan status melalui API.
  // ---------------------------------------------------------------------------------------
  const KES_BARIS = [
    [14, 'BARIS-MENUNGGU-RAHSIA', 'pending', false],
    [15, 'BARIS-ARKIB-RAHSIA', 'archived', false],
    [16, 'BARIS-AKTIF-AWAM', 'approved', true],
  ];
  for (const [slot, tajuk, status] of KES_BARIS) {
    await api('POST', '/api/system/categories/assign-slot', { slotIndex: slot, bidangName: BIDANG });
    await api('POST', '/api/system/slots', [{ slotIndex: slot, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok(`baris-${slot}`, tajuk, 'terbit', slot) }]);
    const o = await dbGet(db, 'SELECT id FROM editorial_objects WHERE slotIndex=? ORDER BY createdAt DESC LIMIT 1', [slot]);
    // Akaun ujian ialah ketua_editor -- Terbitkan sendiri mendarat terus 'approved' (dasar
    // self-publish 2026-08-08, sama penemuan spt sim4), jadi kes 'pending' pun MESTI di-PATCH
    // eksplisit turun semula, bukan diandaikan kekal 'pending' selepas cipta.
    if (o) await api('PATCH', `/api/system/content/${o.id}`, { status });
  }

  // Kandungan DIJADUALKAN (belum tiba masa) — tidak boleh dilihat awal.
  await api('POST', '/api/system/categories/assign-slot', { slotIndex: 17, bidangName: BIDANG });
  await api('POST', '/api/system/slots', [{ slotIndex: 17, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok('baris-17', 'BARIS-DIJADUALKAN-RAHSIA', 'terbit', 17) }]);
  const objJadual = await dbGet(db, 'SELECT id FROM editorial_objects WHERE slotIndex=17 ORDER BY createdAt DESC LIMIT 1');
  if (objJadual) {
    const esok = new Date(Date.now() + 86400000).toISOString();
    await api('PATCH', `/api/system/content/${objJadual.id}`, { status: 'scheduled', scheduledPublishAt: esok });
  }

  // ---------------------------------------------------------------------------------------
  // C. Semak SETIAP permukaan awam
  // ---------------------------------------------------------------------------------------
  const PERMUKAAN = [
    ['/api/system/layout/active', 'frontpage bento'],
    ['/rss.xml', 'suapan RSS'],
    ['/sitemap.xml', 'peta laman'],
    ['/api/system/search?q=RAHSIA', 'carian awam'],
  ];

  const SEMUA_KES = [...KES_SANDARAN, ...KES_BARIS, [17, 'BARIS-DIJADUALKAN-RAHSIA', 'scheduled', false]];

  for (const [laluan, nama] of PERMUKAAN) {
    const r = await awam('GET', laluan);
    if (!r.ok) { lap.lulus(`${nama} -> ${r.status} (tidak terbuka)`); continue; }
    const bocor = SEMUA_KES.filter(([, tajuk, , patutAwam]) => !patutAwam && r.teks.includes(tajuk));
    if (bocor.length) {
      lap.gagal(`KEBOCORAN STATUS pada ${nama}`, bocor.map(b => `${b[1]} (status ${b[2]})`).join(', '));
    } else {
      lap.lulus(`${nama}: tiada kandungan bukan-aktif bocor`);
    }
  }

  // Kandungan yang MEMANG patut awam mesti benar-benar muncul (bukan tersembunyi berlebihan).
  const rLayout = await awam('GET', '/api/system/layout/active');
  for (const [, tajuk, , patutAwam] of SEMUA_KES) {
    if (!patutAwam) continue;
    if (rLayout.ok && rLayout.teks.includes(tajuk)) lap.lulus(`kandungan aktif "${tajuk}" kelihatan kepada pembaca`);
    else lap.gagal(`kandungan AKTIF hilang dari frontpage`, `"${tajuk}" sepatutnya kelihatan tetapi tiada`);
  }

  // ---------------------------------------------------------------------------------------
  // D. Ticker awam — item ditolak/menunggu tidak boleh disiarkan
  // ---------------------------------------------------------------------------------------
  const rTicker = await awam('GET', '/api/system/layout/active');
  if (rTicker.ok && /RAHSIA/.test(JSON.stringify(rTicker.json).match(/"ticker[^,]*"/gi) || '')) {
    lap.gagal('Ticker menyiarkan kandungan rahsia', 'item bukan-aktif muncul dalam ticker');
  } else {
    lap.lulus('Ticker tiada kandungan bukan-aktif');
  }

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
