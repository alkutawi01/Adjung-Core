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
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, dbAll, bukaDb } from './sim-lib.mjs';

const PORT = 5204;
const DBF = path.join(os.tmpdir(), 'sim-adjung-pintas.db');
const lap = pelapor('SIM 6 — PINTAS PERATURAN');

const SLOT = 1;
const BIDANG = 'Ekonomi';
const PANJANG_GILA = 'A'.repeat(3000);

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
    `Bidang: ${o.bidang}`,
    ...(o.topik !== undefined ? [`Topik: ${o.topik}`] : []),
    'Sumber: Ujian',
    'URL: https://ujian.test/x',
    'Status: terbit',
  ].join('\n');

  const cubaTerbit = async (label, o, sebabDijangkaDitolak) => {
    const sebelum = await bilKandungan();
    const r = await api('POST', '/api/system/slots', [{
      slotIndex: SLOT, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok(o),
    }]);
    const selepas = await bilKandungan();
    if (r.ok && selepas > sebelum) {
      lap.gagal(`PERATURAN DIPINTAS: ${label}`, `pelayan TERIMA (${sebabDijangkaDitolak}) dan kandungan tersimpan`);
    } else if (r.ok && selepas === sebelum) {
      lap.lulus(`${label} — tiada kandungan tercipta`);
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
  await cubaTerbit('Bidang tak sepadan Bidang terkunci slot', {
    uuid: 'p4', tajuk: 'Tajuk Sah', huraian: 'Huraian sah.', bidang: 'Sukan', topik: 'Bola',
  }, `slot dikunci ${BIDANG}, dihantar Sukan`);

  await cubaTerbit('Topik tiada langsung', {
    uuid: 'p5', tajuk: 'Tajuk Sah', huraian: 'Huraian sah.', bidang: BIDANG,
  }, 'Topik wajib untuk kandungan baharu');

  await cubaTerbit('Bidang tidak wujud dalam Taksonomi', {
    uuid: 'p6', tajuk: 'Tajuk Sah', huraian: 'Huraian sah.', bidang: 'BidangRekaan', topik: 'X',
  }, 'Bidang bukan senarai aktif');

  // --- Laluan PATCH (edit terus) -------------------------------------------------------
  // Cipta satu kandungan SAH dahulu, kemudian cuba rosakkan melalui PATCH.
  await api('POST', '/api/system/slots', [{
    slotIndex: SLOT, contentMode: 'Manual', manualDesk: BIDANG,
    manualSummary: blok({ uuid: 'sah1', tajuk: 'Tajuk Sah Untuk Edit', huraian: 'Huraian sah.', bidang: BIDANG, topik: 'Kewangan' }),
  }]);
  const objSah = await dbGet(db, 'SELECT id FROM editorial_objects ORDER BY createdAt DESC LIMIT 1');
  if (!objSah) {
    lap.gagal('prasyarat: kandungan sah tak tercipta', 'tidak dapat menguji laluan PATCH');
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
