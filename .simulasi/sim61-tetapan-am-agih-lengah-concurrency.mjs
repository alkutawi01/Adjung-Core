// sim61 — pengesahan pembetulan TetapanAmSlotConsole.tsx agihLengahBertingkat() (2026-09-09).
//
// Bug asal: agihLengahBertingkat() GET /api/system/slots, kemudian TERUS POST balik dengan
// `updatedAt` yang baru sahaja dibaca dalam panggilan YANG SAMA — gerbang konkurensi pelayan
// (slotsConfigRoutes.js, Fasa 6) banding token tu dgn DB SEMASA, yang sentiasa sepadan dirinya
// sendiri sebab ia BARU SAHAJA dibaca. Sim ni tak boleh panggil komponen React terus (bukan
// persekitaran DOM), jadi ia mensimulasikan DUA "editor" secara langsung terhadap HTTP API,
// mencerminkan tepat urutan client SEBELUM dan SELEPAS pembetulan:
//
//   SEBELUM (bug): token = GET baru-baru ini -> POST -> token SENTIASA sepadan -> tiada 409 walau
//                  editor B betul-betul dah simpan slot ni sejak editor A "buka" panel.
//   SELEPAS (fix): token = GET pada waktu PANEL DIMUATKAN (updatedAtAwalSlots) -> POST -> kalau
//                  editor lain simpan DI ANTARA waktu tu dgn POST, token dah tak sepadan -> 409.
//
// Nota persediaan: DB skrac baharu tiada baris `slots_config` langsung — GET /slots pulangkan
// senarai KOSONG (bukan nilai maya berupdatedAt=null macam disangka mula-mula; disahkan semasa
// tulis sim ni). Jadi baris disemai terus dgn POST minimum (corak sim49) supaya setiap slot ada
// `updatedAt` SEBENAR dalam DB sebelum senario konflik diuji.
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5961;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim61.db');
const lapor = pelapor('sim61-tetapan-am-agih-lengah-concurrency');

const JUMLAH_SLOT = 6; // cukup utk uji corak susunanLebarSamaRata, tak perlu 38 penuh.

function susunanLebarSamaRata(n) {
  const hasil = [];
  const baris = [[0, n - 1]];
  while (baris.length) {
    const [lo, hi] = baris.shift();
    if (lo > hi) continue;
    const tengah = Math.floor((lo + hi) / 2);
    hasil.push(tengah);
    baris.push([lo, tengah - 1], [tengah + 1, hi]);
  }
  return hasil;
}

function bacaTokenPeta(rows) {
  const peta = {};
  for (const r of rows) if (r && r.slotIndex >= 0) peta[r.slotIndex] = r.updatedAt || null;
  return peta;
}

// Cermin agihLengahBertingkat() TetapanAmSlotConsole.tsx: baca SEMUA slot fresh (elak timpa
// medan lain), kira carouselDelay ikut susunan lebar-sama-rata, override `updatedAt` ikut
// `tokenPeta` yang diberi (parameter — bukan bacaan fresh dalam fungsi ni, itulah TEPAT
// perbezaan fix vs bug).
async function bina(klien, tokenPeta) {
  const rFresh = await klien('GET', '/api/system/slots');
  const slotBerkaitan = rFresh.json.filter(s => s.slotIndex >= 0).sort((a, b) => a.slotIndex - b.slotIndex);
  const urutanLebar = susunanLebarSamaRata(slotBerkaitan.length);
  const peringkatUntukKedudukan = new Array(slotBerkaitan.length);
  urutanLebar.forEach((kedudukan, peringkat) => { peringkatUntukKedudukan[kedudukan] = peringkat; });
  return slotBerkaitan.map((s, i) => ({
    ...s,
    carouselDelay: peringkatUntukKedudukan[i],
    updatedAt: Object.prototype.hasOwnProperty.call(tokenPeta, s.slotIndex) ? tokenPeta[s.slotIndex] : s.updatedAt,
  }));
}

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE, freshDb: true });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, username, pass);
    const klien = buatKlien(base, cookie);

    // Persediaan: semai baris slots_config terus (tiada updatedAt dihantar — bacaan pertama,
    // gerbang konkurensi memang dilangkau bila token null, sama seperti simpanan PERTAMA
    // sebenar). Selepas ni SETIAP slot ada updatedAt sebenar dalam DB.
    const seedSlots = Array.from({ length: JUMLAH_SLOT }, (_, i) => ({
      slotIndex: i, contentMode: 'Manual', manualDesk: '', manualTitle: '', manualSummary: '',
    }));
    const rSeed = await klien('POST', '/api/system/slots', seedSlots);
    if (!rSeed.ok) { lapor.gagal('Persediaan: simpanan awal (seed) gagal', JSON.stringify(rSeed.json)); process.exitCode = 1; return; }
    const rCekSeed = await klien('GET', '/api/system/slots');
    if (!Array.isArray(rCekSeed.json) || rCekSeed.json.length < JUMLAH_SLOT || !rCekSeed.json[0]?.updatedAt) {
      lapor.gagal('Persediaan: semai gagal wujudkan baris slots_config dgn updatedAt sebenar', JSON.stringify(rCekSeed.json));
      process.exitCode = 1; return;
    }
    lapor.lulus(`Persediaan: ${rCekSeed.json.length} baris slots_config disemai, updatedAt sebenar wujud`);

    // --- Bahagian 1: SELEPAS FIX — dua "editor" (A, B) buka Tetapan Am Slot pada waktu hampir
    // sama (masing-masing GET /api/system/slots, cermin muatSlotsAwal() semasa panel dimuatkan).
    const tokenAwalA = bacaTokenPeta((await klien('GET', '/api/system/slots')).json);
    const tokenAwalB = bacaTokenPeta((await klien('GET', '/api/system/slots')).json);

    // B klik "Agih Lengah Bertingkat" DAHULU, guna token dari GET awal B — MESTI berjaya (200),
    // tiada sesiapa lagi simpan slot ni sejak B buka panel.
    const dikemasB = await bina(klien, tokenAwalB);
    const rSimpanB = await klien('POST', '/api/system/slots', dikemasB);
    console.log('  [maklumat] B simpan (token drpd GET awal B):', rSimpanB.status);
    if (!rSimpanB.ok) {
      lapor.gagal('Persediaan: simpanan B (editor pertama, token sah) sepatutnya BERJAYA tapi gagal', JSON.stringify(rSimpanB.json));
    } else {
      lapor.lulus('Persediaan: B (editor pertama) berjaya simpan guna token dari GET awalnya');
    }

    // A cuba simpan KEMUDIAN, guna token STALE (dibaca SEBELUM B simpan, iaitu tokenAwalA) —
    // MESTI 409 di bawah fix, sebab B sudah pun menukar updatedAt slot-slot ni.
    const dikemasA = await bina(klien, tokenAwalA);
    const rSimpanA = await klien('POST', '/api/system/slots', dikemasA);
    console.log('  [maklumat] A simpan (token STALE drpd GET awal A):', rSimpanA.status, JSON.stringify(rSimpanA.json));
    if (rSimpanA.status === 409) {
      lapor.lulus('FIX SAHIH: A (token stale, dibaca semasa panel dimuatkan sebelum B simpan) ditolak 409 — gerbang konkurensi kesan konflik sebenar');
    } else {
      lapor.gagal('FIX GAGAL: A sepatutnya ditolak 409 (token stale) tapi malah lulus', `status=${rSimpanA.status}`);
    }

    // --- Bahagian 2: kawalan negatif — cerminkan tingkah laku LAMA (bug) secara eksplisit: token
    // dibaca SEGAR (dalam panggilan yang sama, saat-saat sebelum POST) walau B (di atas) DAN A (di
    // atas, andai ia lulus/tak dikira) dah pun mengubah baris. Ni MESTI 200 (sentiasa lulus,
    // punca asal bug) — mengesahkan corak LAMA memang cacat, bukan cuma persediaan sim yg silap.
    const rSegarUntukToken = await klien('GET', '/api/system/slots');
    const tokenSegar = bacaTokenPeta(rSegarUntukToken.json);
    const dikemasSegar = await bina(klien, tokenSegar);
    const rSimpanSegar = await klien('POST', '/api/system/slots', dikemasSegar);
    console.log('  [maklumat] Kawalan negatif (corak LAMA, token dibaca segar sebelum POST):', rSimpanSegar.status);
    if (rSimpanSegar.ok) {
      lapor.lulus('Kawalan negatif sahih: corak LAMA (token dibaca segar sebelum POST) sentiasa lulus 200 — mengesahkan gerbang tu memang tak bermakna sebelum fix');
    } else {
      lapor.gagal('Kawalan negatif tak dijangka gagal (patut sentiasa 200 di bawah corak lama)', JSON.stringify(rSimpanSegar.json));
    }

    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
