// SIMULASI 6 — CUBA PINTAS PERATURAN KERAS EDITORIAL.
//
// CLAUDE.md: "Kad tak boleh overflow. Tiada pengecualian." dan Bidang terkunci per-slot + Topik
// wajib. Peraturan ni dikuatkuasakan di peringkat SIMPAN (server), bukan CSS. Simulasi ini
// menyerang setiap laluan simpan terus melalui API — memintas UI sepenuhnya — untuk membuktikan
// penguatkuasaan benar-benar di pelayan.
//
// Lulus = pelayan MENOLAK. Gagal = kandungan melanggar peraturan berjaya tersimpan.
import path from 'node:path';
import os from 'node:os';
import sqlite3 from 'sqlite3';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, dbAll, bukaDb, isiHuraianCukup, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5204;
const DBF = path.join(os.tmpdir(), 'sim-adjung-pintas.db');
const lap = pelapor('SIM 6 — PINTAS PERATURAN');

const SLOT = 1;
const BIDANG = 'Ekonomi';
const PANJANG_GILA = 'A'.repeat(3000);

// HURAIAN_PANJANG_SAH (sim-lib.mjs) — WAJIB disertakan pada mana-mana kes ujian yang bukan sengaja
// menguji had ni sendiri (2026-09-02, dapatan bug-hunt). Tanpanya, SETIAP percubaan terbit
// kandungan "sah" (tajuk+huraian ringkas munasabah) ditolak oleh gerbang Huraian Panjang wajib
// (ContentBudget.js validateHuraianPanjangWajib, lalai 400 aksara sejak 2026-08-07, dikuatkuasakan
// walau kosong sejak 2026-08-28) SEBELUM sempat sampai ke peraturan Bidang/Topik yang ujian ni
// sepatutnya sasarkan — lihat nota panjang di bawah pada setiap kes ujian terjejas.

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  await api('POST', '/api/system/categories/activate', { name: BIDANG, color: '#802334', icon: 'TrendingUp' });
  await api('POST', '/api/system/categories/activate', { name: 'Sukan', color: '#123456', icon: 'Trophy' });
  await api('POST', '/api/system/categories/assign-slot', { slotIndex: SLOT, bidangName: BIDANG });

  const bilKandungan = async () => (await dbGet(db, 'SELECT COUNT(*) n FROM editorial_objects')).n;

  const blok = (o) => [
    `UUID: ${o.uuid}`,
    `Tajuk: ${o.tajuk}`,
    `Huraian ringkas: ${o.huraian}`,
    ...(o.huraianPanjang !== undefined ? [`Huraian panjang: ${o.huraianPanjang}`] : []),
    `Bidang: ${o.bidang}`,
    ...(o.topik !== undefined ? [`Topik: ${o.topik}`] : []),
    'Sumber: Ujian',
    'URL: https://ujian.test/x',
    'Status: terbit',
  ].join('\n');

  // frasaDijangka (2026-09-02, dapatan bug-hunt) — sebelum ni cubaTerbit anggap MANA-MANA
  // penolakan 400 sebagai "lulus", tanpa semak SEBAB sebenar. Ujian Bidang/Topik di bawah dahulu
  // sentiasa "lulus" kerana fixture (`tajuk: 'Tajuk Sah', huraian: 'Huraian sah.'`) langsung tidak
  // sertakan Huraian Panjang (wajib >=400 aksara sejak 2026-08-07/dikuatkuasakan penuh sejak
  // 2026-08-28) DAN gagal had minimum 80% bajet kad (keputusan Izzat 2026-08-08) — kedua-dua
  // gerbang tu tercetus DAHULU dalam server.js (baris ~3419-3518), jadi peraturan Bidang/Topik yang
  // ujian ni sepatutnya sasarkan tidak pernah benar-benar tersentuh. Kalau `validateBidangTopik()`
  // rosak/dibuang esok, ujian ni akan terus lapor "lulus" tanpa perasan langsung. Parameter
  // `frasaDijangka` (pilihan) memaksa semakan mesej ralat SEBENAR mengandungi frasa yang disasarkan
  // — kalau ditolak atas sebab LAIN, lapor sebagai penemuan, bukan diam-diam anggap lulus.
  const cubaTerbit = async (label, o, sebabDijangkaDitolak, frasaDijangka) => {
    const sebelum = await bilKandungan();
    const r = await api('POST', '/api/system/slots', [{
      slotIndex: SLOT, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok(o),
    }]);
    const selepas = await bilKandungan();
    if (r.ok && selepas > sebelum) {
      lap.gagal(`PERATURAN DIPINTAS: ${label}`, `pelayan TERIMA (${sebabDijangkaDitolak}) dan kandungan tersimpan`);
    } else if (r.ok && selepas === sebelum) {
      lap.lulus(`${label} — tiada kandungan tercipta`);
    } else if (frasaDijangka && !(r.json?.error || '').toLowerCase().includes(frasaDijangka.toLowerCase())) {
      lap.gagal(`${label} — ditolak atas sebab LAIN, bukan yang disasarkan`, `dijangka mengandungi "${frasaDijangka}", sebenar: "${r.json?.error || ''}"`);
    } else {
      lap.lulus(`${label} -> ditolak ${r.status}`);
    }
  };

  // --- Bajet ruang kad (tajuk/huraian terlalu panjang) --------------------------------
  await cubaTerbit('tajuk melebihi had tier', {
    uuid: 'p1', tajuk: PANJANG_GILA, huraian: 'Pendek.', bidang: BIDANG, topik: 'Kewangan',
  }, 'tajuk 3000 aksara');

  await cubaTerbit('huraian melebihi had tier', {
    uuid: 'p2', tajuk: 'Tajuk Munasabah', huraian: PANJANG_GILA, bidang: BIDANG, topik: 'Kewangan',
  }, 'huraian 3000 aksara');

  await cubaTerbit('tajuk + huraian kedua-dua panjang (bajet dikongsi)', {
    uuid: 'p3', tajuk: 'A'.repeat(160), huraian: 'B'.repeat(400), bidang: BIDANG, topik: 'Kewangan',
  }, 'jumlah bajet melebihi 1.0');

  // --- Bidang & Topik ------------------------------------------------------------------
  // Huraian ringkas dijana via isiHuraianCukup() (lulus had minimum 80% bajet kad) + Huraian
  // Panjang SAH disertakan (lulus gerbang wajib 400 aksara) supaya SATU-SATUNYA sebab penolakan
  // yang mungkin ialah peraturan Bidang/Topik yang disasarkan — bukan "Huraian sah." pendek yang
  // sebelum ni ditolak oleh gerbang lain dahulu (lihat nota panjang di cubaTerbit() di atas).
  const tajukSah = 'Tajuk Sah';
  const huraianRingkasSah = isiHuraianCukup(ceilingForSlot, SLOT, tajukSah.length);

  await cubaTerbit('Bidang tak sepadan Bidang terkunci slot', {
    uuid: 'p4', tajuk: tajukSah, huraian: huraianRingkasSah, huraianPanjang: HURAIAN_PANJANG_SAH, bidang: 'Sukan', topik: 'Bola',
  }, `slot dikunci ${BIDANG}, dihantar Sukan`, 'tidak sepadan');

  await cubaTerbit('Topik tiada langsung', {
    uuid: 'p5', tajuk: tajukSah, huraian: huraianRingkasSah, huraianPanjang: HURAIAN_PANJANG_SAH, bidang: BIDANG,
  }, 'Topik wajib untuk kandungan baharu', 'topik diperlukan');

  await cubaTerbit('Bidang tidak wujud dalam Taksonomi', {
    uuid: 'p6', tajuk: tajukSah, huraian: huraianRingkasSah, huraianPanjang: HURAIAN_PANJANG_SAH, bidang: 'BidangRekaan', topik: 'X',
  }, 'Bidang bukan senarai aktif', 'tidak sepadan');

  // --- Laluan PATCH (edit terus) -------------------------------------------------------
  // Cipta satu kandungan SAH dahulu, kemudian cuba rosakkan melalui PATCH. Huraian Panjang SAH
  // WAJIB disertakan (2026-09-02, dapatan bug-hunt — lihat nota di cubaTerbit() di atas); tanpanya
  // prasyarat ni gagal senyap, jadi KEDUA-DUA ujian PATCH di bawah tidak pernah benar-benar jalan.
  const rSah = await api('POST', '/api/system/slots', [{
    slotIndex: SLOT, contentMode: 'Manual', manualDesk: BIDANG,
    manualSummary: blok({ uuid: 'sah1', tajuk: 'Tajuk Sah Untuk Edit', huraian: isiHuraianCukup(ceilingForSlot, SLOT, 'Tajuk Sah Untuk Edit'.length), huraianPanjang: HURAIAN_PANJANG_SAH, bidang: BIDANG, topik: 'Kewangan' }),
  }]);
  const objSah = await dbGet(db, 'SELECT id FROM editorial_objects ORDER BY createdAt DESC LIMIT 1');
  if (!objSah) {
    lap.gagal('prasyarat: kandungan sah tak tercipta', `tidak dapat menguji laluan PATCH (ralat pelayan: ${rSah.json?.error || rSah.status})`);
  } else {
    const rP = await api('PATCH', `/api/system/content/${objSah.id}`, { title: PANJANG_GILA });
    const tajukDb = (await dbGet(db, 'SELECT title FROM editorial_revisions WHERE objectId=? ORDER BY version DESC LIMIT 1', [objSah.id]))?.title;
    if (rP.ok && tajukDb === PANJANG_GILA) lap.gagal('PERATURAN DIPINTAS: PATCH menerima tajuk 3000 aksara', 'bajet tak dikuatkuasakan di laluan edit');
    else lap.lulus(`PATCH tajuk melampau -> ditolak ${rP.status}`);

    const rT = await api('PATCH', `/api/system/content/${objSah.id}`, { topik: '' });
    if (rT.ok) {
      const tp = (await dbGet(db, "SELECT valueText v FROM editorial_attribute_values WHERE objectId=? AND attributeId='topik' ORDER BY id DESC LIMIT 1", [objSah.id]))?.v;
      if (!tp) lap.gagal('PERATURAN DIPINTAS: PATCH membenarkan Topik dikosongkan', 'Topik wajib');
      else lap.lulus('PATCH tak berjaya mengosongkan Topik');
    } else lap.lulus(`PATCH kosongkan Topik -> ditolak ${rT.status}`);
  }

  // --- Ticker (slotIndex -1) juga tertakluk bajet --------------------------------------
  const rTicker = await api('POST', '/api/system/content', {
    slotIndex: -1, title: PANJANG_GILA, summary: 'x', desk: 'UMUM', source: 'X', url: 'https://x.test',
  });
  if (rTicker.ok) lap.gagal('PERATURAN DIPINTAS: Ticker terima tajuk 3000 aksara', 'Ticker bukan pengecualian bajet');
  else lap.lulus(`Ticker tajuk melampau -> ditolak ${rTicker.status}`);

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
