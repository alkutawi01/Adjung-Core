// SIMULASI 27 — GET /api/system/poster/latest mencipta Bidang PALSU diam-diam bila nilai
// atribut 'desk' kandungan (dibekukan pada masa terbit) tak lagi padan mana-mana slug Bidang
// SEMASA dalam CategoryRegistry (Bidang lapuk/sudah digabung/data migrasi lama — corak yang
// dokumen projek ni sendiri catat berulang kali, cth "categoryId dibekukan pada masa
// penciptaan").
//
// Punca disyaki (core/routes/posterRoutes.js): laluan ni dahulu panggil
// CategoryRegistry.getCategoryColor(db, bidang) untuk cari warna label Bidang bagi setiap
// kandungan poster. getCategoryColor() SECARA DALAMAN memanggil registerCategory(), yang
// MENCIPTA baris CategoryRegistry BAHARU (dengan warna baharu daripada palet) bila slug nama tu
// tak jumpa -- tingkah laku BETUL untuk laluan TULIS (auto-daftar RSS/pipeline/"+ Tambah
// Bidang"), tapi SALAH untuk laluan ni yang sepatutnya cuma PAPAR/BACA data sedia ada. Kesan:
// setiap kali seorang editor buka/jana Poster untuk kandungan yang nilai 'desk'-nya lapuk, satu
// Bidang PALSU baharu tercipta dalam Taksonomi -- gema pepijat "dua jenis maroon" yang disebut
// dalam komen CategoryRegistry.js, punca berbeza.
//
// Ujian: terbitkan kandungan slot 2 dengan desk sah ('SUKAN'), kemudian TULIS TERUS ke DB
// (mensimulasikan data migrasi/lapuk sebenar -- bukan laluan API biasa, sengaja) supaya atribut
// 'desk' revisi terkini jadi 'BIDANG_HANTU_LAPUK', nama yang TAK PERNAH didaftar dalam
// CategoryRegistry. Panggil GET /system/poster/latest DUA KALI. WAJIB: bilangan baris
// CategoryRegistry tak berubah langsung selepas dua panggilan (tiada Bidang hantu tercipta).
import path from 'node:path';
import os from 'node:os';
import {
  bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, dbAll, dbRun, bukaDb,
  HURAIAN_PANJANG_SAH, isiHuraianCukup,
} from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5227;
const DBF = path.join(os.tmpdir(), 'sim-adjung-poster-bidang-lapuk.db');
const lap = pelapor('SIM 27 — POSTER: BIDANG LAPUK MENCIPTA BIDANG PALSU');

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  // 1. Cipta Bidang "Sukan", kunci slot 2 kepadanya.
  const rAktif = await api('POST', '/api/system/categories/activate', { name: 'Sukan', color: '#123456', icon: 'Trophy' });
  if (!rAktif.ok) throw new Error('Gagal cipta Bidang prasyarat: ' + JSON.stringify(rAktif.json));
  await api('POST', '/api/system/categories/assign-slot', { slotIndex: 2, bidangName: 'Sukan' });

  // 2. Terbitkan kandungan (manageEditorial => terus 'approved') dalam slot 2, desk='SUKAN'.
  const tajuk = 'Ujian simulasi kandungan sukan';
  const huraian = isiHuraianCukup(ceilingForSlot, 2, tajuk.length);
  const rCipta = await api('POST', '/api/system/content', {
    slotIndex: 2,
    title: tajuk,
    summary: huraian,
    desk: 'SUKAN',
    source: 'Sim Sukan',
    url: 'https://contoh.test/sukan',
    topik: 'Bola Sepak',
  });
  if (!rCipta.ok) throw new Error('Gagal cipta kandungan prasyarat: ' + JSON.stringify(rCipta.json));

  // Tambah Huraian Panjang (>=400 aksara) supaya kandungan sah sepenuhnya (bukan wajib utk ujian
  // ni, tapi elak sebarang kesan sampingan validasi tak berkaitan).
  await api('PATCH', `/content/${rCipta.json.id}`, { briefLong: HURAIAN_PANJANG_SAH });

  const kiraanSebelum = (await dbGet(db, 'SELECT COUNT(*) AS n FROM CategoryRegistry')).n;

  // 3. Simulasikan atribut 'desk' LAPUK (cth data migrasi lama/Bidang telah digabung/dipadam
  //    sejak, corak yang CLAUDE.md/komen kod projek ni sendiri catat berulang kali sebagai
  //    senario sebenar) -- tulis terus ke DB, bukan laluan API, sebab tiada laluan API SEDIA ADA
  //    membenarkan editor tetapkan desk kepada nama yang tak wujud dalam CategoryRegistry.
  const objectId = rCipta.json.id;
  await dbRun(db, `
    UPDATE editorial_attribute_values SET valueText = 'BIDANG_HANTU_LAPUK'
    WHERE objectId = ? AND attributeId = 'desk'
  `, [objectId]);
  const semakDesk = await dbGet(db, "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND attributeId = 'desk'", [objectId]);
  if (semakDesk?.valueText !== 'BIDANG_HANTU_LAPUK') throw new Error('Persediaan gagal: atribut desk tak berjaya ditukar ke nilai lapuk.');

  // 4. Panggil laluan poster DUA KALI (bukan sekali -- pepijat "cipta setiap panggilan" patut
  //    nampak jelas bila kiraan naik 2x, bukan cuma sekali kalau ada caching tersembunyi).
  const rPoster1 = await api('GET', '/api/system/poster/latest');
  const rPoster2 = await api('GET', '/api/system/poster/latest');
  if (!rPoster1.ok || !rPoster2.ok) {
    throw new Error('Laluan poster sendiri gagal: ' + JSON.stringify(rPoster1.json || rPoster1.teks) + ' / ' + JSON.stringify(rPoster2.json || rPoster2.teks));
  }

  const kiraanSelepas = (await dbGet(db, 'SELECT COUNT(*) AS n FROM CategoryRegistry')).n;
  const semuaBidang = await dbAll(db, 'SELECT slug, name FROM CategoryRegistry ORDER BY name');

  if (kiraanSelepas === kiraanSebelum) {
    lap.lulus(`Bilangan Bidang CategoryRegistry tak berubah selepas 2x GET poster (${kiraanSebelum} -> ${kiraanSelepas})`);
  } else {
    lap.gagal(
      'KRITIKAL: GET /system/poster/latest mencipta Bidang PALSU diam-diam bagi desk lapuk "BIDANG_HANTU_LAPUK"',
      `Sebelum=${kiraanSebelum}, selepas=${kiraanSelepas}. Senarai Bidang: ${JSON.stringify(semuaBidang)}`
    );
  }

  const bidangHantu = semuaBidang.find(b => b.slug === 'bidang-hantu-lapuk');
  if (!bidangHantu) {
    lap.lulus('Tiada baris CategoryRegistry slug="bidang-hantu-lapuk" tercipta');
  } else {
    lap.gagal('KRITIKAL: baris CategoryRegistry PALSU "bidang-hantu-lapuk" wujud', JSON.stringify(bidangHantu));
  }

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
