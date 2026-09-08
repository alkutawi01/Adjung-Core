// sim55 — Glosari Sense: bidangIds berpendua tak dikendalikan (2026-09-09, dapatan bug-hunt)
//
// sahkanInvariantSense() (glosariRoutes.js) sahkan kewujudan Bidang dengan
// `bidangSah.length !== bidangIds.length` -- tapi bidangSah datang dari
// "SELECT ... WHERE id IN (?,?,...)" yang SQL sendiri nyahpendua (satu baris
// setiap id UNIK), manakala bidangIds ialah array MENTAH badan permintaan
// (tiada nyahpendua). Kalau editor (atau bug UI pemilih berbilang) hantar
// categoryId SAMA dua kali, bidangSah.length (1) != bidangIds.length (2) --
// laluan tersasar terus ke ralat "Bidang ... tidak wujud" walaupun Bidang tu
// SAH wujud. Kalau semakan ni disasarkan lulus (cth bidangIds unik tapi ada
// satu id berulang tersembunyi selepas pemeriksaan pertindihan Sense lain),
// INSERT INTO glosari_sense_bidang (PRIMARY KEY senseId+categoryId) akan
// gagal SQLITE_CONSTRAINT dalam transaksi -- ditangkap sebagai 500 mentah.
//
// Ujian ni hantar SATU Bidang sah, DIULANG DUA KALI dalam bidangIds, ke
// POST /glosari/:istilahId/sense dan sahkan sama ada respons 400 palsu
// "tidak wujud" muncul walaupun Bidang tu sememangnya wujud.
import path from 'node:path';
import {
  REPO, bootServer, ciptaPentadbir, login, buatKlien, pelapor,
} from './sim-lib.mjs';

const PORT = 4555;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim55.db');
const lapor = pelapor('sim55-glosari-sense-bidang-duplikat');

async function utama() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
    const klien = buatKlien(base, cookie);

    // 1. Cipta satu Bidang sah.
    const namaBidang = 'Sim55 Bidang ' + Date.now();
    const rBidang = await klien('POST', '/api/system/categories/register', { name: namaBidang });
    if (!rBidang.ok) {
      lapor.gagal('Persediaan: cipta Bidang', JSON.stringify(rBidang.json));
      return lapor.ringkasan();
    }
    const idBidang = rBidang.json.category.id;

    // 2. Cipta satu istilah Glosari (tanpa Sense, guna `maksud` fallback).
    const istilah = 'Sim55Istilah' + Date.now();
    const rIstilah = await klien('POST', '/api/system/glosari', {
      istilah, maksud: 'Fallback am tidak relevan untuk ujian ini.',
    });
    if (!rIstilah.ok) {
      lapor.gagal('Persediaan: cipta istilah', JSON.stringify(rIstilah.json));
      return lapor.ringkasan();
    }
    const istilahId = rIstilah.json.entri.id;

    // 3. Cuba cipta Sense KHUSUS Bidang, hantar categoryId SAH tapi BERPENDUA.
    const rSense = await klien('POST', `/api/system/glosari/${istilahId}/sense`, {
      definisi: 'Makna khusus Bidang, ujian bidangIds berpendua.',
      amSense: false,
      bidangIds: [idBidang, idBidang],
    });

    console.log('  [maklumat] Respons POST sense (bidangIds berpendua):', rSense.status, JSON.stringify(rSense.json));

    if (rSense.status === 400 && /tidak wujud/i.test(rSense.json?.error || '')) {
      lapor.gagal(
        'Bidang SAH ditolak sebagai "tidak wujud" semata-mata kerana id sama dihantar dua kali dalam bidangIds -- sahkanInvariantSense() bandingkan panjang array MENTAH (tak dinyahpendua) lawan hasil SQL IN (...) yang SQL sendiri nyahpendua',
        JSON.stringify(rSense.json)
      );
    } else if (rSense.status === 500) {
      lapor.gagal(
        'bidangIds berpendua menembusi pengesahan dan tersasar ke ralat 500 mentah (kemungkinan SQLITE_CONSTRAINT pada PRIMARY KEY glosari_sense_bidang)',
        JSON.stringify(rSense.json)
      );
    } else if (rSense.ok) {
      lapor.lulus('bidangIds berpendua dikendalikan dengan baik (dinyahpendua sebelum sah/INSERT), Sense berjaya dicipta dgn SATU perkaitan Bidang');
    } else {
      lapor.gagal('Keadaan tak dijangka', JSON.stringify(rSense.json));
    }

    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  } catch (e) {
    lapor.gagal('Ralat semasa simulasi', e.stack || e.message);
    console.log('--- log pelayan (baki) ---\n' + dapatLog().slice(-2000));
    process.exitCode = 1;
  } finally {
    proc.kill();
  }
}

utama();
