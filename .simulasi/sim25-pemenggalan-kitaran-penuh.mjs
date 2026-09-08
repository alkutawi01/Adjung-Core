// SIMULASI 25 — PEMENGGALAN SUKU KATA: KITARAN PENUH PENGECUALIAN EDITOR (HTTP sebenar +
// fungsi tulen client).
//
// Konteks: Pengecualian Pemenggalan (core/routes/pemenggalanRoutes.js +
// core/editorial/PemenggalSukuKata.js) ialah ciri "autocorrect" editor — CLAUDE.md sahkan
// resolusi sebenar (sisipan soft hyphen U+00AD) berlaku CLIENT-SIDE (FrontpageView.tsx muat
// senarai via GET awam SEKALI, hidrat peta dalam-modul via setPemenggalanPengecualian(), corak
// SAMA seperti Glosari Berasaskan Bidang). Jadi laluan awam kandungan (content API) TAK PERNAH
// menyisip sempang sendiri — mengharapkan U+00AD dalam respons content API silap seni bina.
// Ujian ni sebaliknya mengesahkan KEDUA-DUA bahagian kontrak sebenar:
//   1. Kitaran CRUD HTTP sebenar (POST/GET/DELETE) terhadap pelayan SEBENAR, DB buangan.
//   2. Fungsi TULEN client (core/editorial/PemenggalSukuKata.js, diimport terus macam
//      FrontpageView.tsx buat) diberi SENARAI SEBENAR yang GET pulangkan — sahkan
//      setPemenggalanPengecualian() + penggalSukuKata() hasilkan offset TEPAT ikut corak
//      tersimpan (bukan hasil algoritma automatik), dan sahkan ia PULIH balik ke algoritma
//      selepas DELETE (bukan tersekat sebagai override "hantu" dalam peta dalam-modul).
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor } from './sim-lib.mjs';
import { setPemenggalanPengecualian, penggalSukuKata, SOFT_HYPHEN, cariTitikPenggal } from '../core/editorial/PemenggalSukuKata.js';

const PORT = 5225;
const DBF = path.join(os.tmpdir(), 'sim-adjung-pemenggalan.db');
const lap = pelapor('SIM 25 — PEMENGGALAN SUKU KATA KITARAN PENUH');

const PERKATAAN = 'Pentadbiran';
const CORAK = 'pen-tad-bir-an'; // override: pen(3)-tad(3)-bir(3)-an(2) -> offset 3,6,9

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF, { id: 'sim25-admin', username: 'sim25-admin', pass: 'AdminUjian!2026' });
  const cookie = await login(srv.base, username, pass);
  const admin = buatKlien(srv.base, cookie);
  const awam = buatKlien(srv.base, '');

  // --- 0. Rangkaian algoritma automatik SEBELUM sebarang pengecualian wujud (nilai rujukan) ---
  setPemenggalanPengecualian([]);
  const teksAsal = penggalSukuKata(PERKATAAN);
  const titikAlgoritma = cariTitikPenggal(PERKATAAN);
  lap.lulus(`RUJUKAN: algoritma automatik "${PERKATAAN}" -> "${teksAsal.split(SOFT_HYPHEN).join('-')}" (offset ${JSON.stringify(titikAlgoritma)})`);

  // --- 1. POST — cipta pengecualian via HTTP sebenar ---
  const tambah = await admin('POST', '/api/system/pemenggalan-pengecualian', { perkataan: PERKATAAN, corak: CORAK });
  if (tambah.status === 200 && tambah.json?.success) {
    lap.lulus('UJIAN 1: POST pemenggalan-pengecualian berjaya (200, success:true)');
  } else {
    lap.gagal('UJIAN 1: POST pemenggalan-pengecualian gagal', `status=${tambah.status} ${JSON.stringify(tambah.json)}`);
  }

  // --- 2. GET awam (tiada sesi) — sahkan entri kelihatan, laluan yang FrontpageView.tsx guna ---
  const senarai1 = await awam('GET', '/api/system/pemenggalan-pengecualian');
  const entriBaharu = (senarai1.json || []).find((e) => e.perkataan.toLowerCase() === PERKATAAN.toLowerCase());
  if (senarai1.status === 200 && entriBaharu && entriBaharu.corak === CORAK) {
    lap.lulus('UJIAN 2: GET awam (tanpa sesi) papar entri baharu dengan corak tepat');
  } else {
    lap.gagal('UJIAN 2: entri tak kelihatan/tak tepat pada GET awam', JSON.stringify(senarai1.json).slice(0, 300));
  }

  // --- 3. Hidrat fungsi TULEN client dgn senarai SEBENAR drpd GET, sahkan offset TEPAT ikut corak ---
  setPemenggalanPengecualian(senarai1.json || []);
  const hasilOverride = penggalSukuKata(PERKATAAN);
  const offsetSebenar = [];
  for (let i = 0; i < hasilOverride.length; i++) if (hasilOverride[i] === SOFT_HYPHEN) offsetSebenar.push(i);
  // Offset dikira atas SEGMEN corak (pen=3, tad=3, bir=3, an=2) -> sempang selepas indeks 3,6,9
  // dalam rentetan ASAL (tanpa sempang) -- selepas sisipan berturutan, kedudukan sempang dalam
  // rentetan HASIL beralih +1 setiap kali (sempang sebelumnya menambah 1 aksara).
  const dijangka = [3, 7, 11]; // 3, 6+1, 9+2
  const sepadan = JSON.stringify(offsetSebenar) === JSON.stringify(dijangka);
  const hurufBesarKekal = hasilOverride.startsWith('Pen' + SOFT_HYPHEN);
  if (sepadan && hurufBesarKekal) {
    lap.lulus(`UJIAN 3: override diterapkan TEPAT ikut corak tersimpan -> "${hasilOverride.split(SOFT_HYPHEN).join('-')}" (huruf besar asal kekal)`);
  } else {
    lap.gagal('UJIAN 3: override TAK diterapkan tepat', `hasil="${hasilOverride.split(SOFT_HYPHEN).join('-')}" offset=${JSON.stringify(offsetSebenar)} dijangka=${JSON.stringify(dijangka)}`);
  }

  // Sahkan override BERBEZA drpd algoritma automatik (bukti sebenar override yg menang, bukan
  // kebetulan algoritma dah hasilkan corak sama)
  if (hasilOverride !== teksAsal) {
    lap.lulus('UJIAN 3b: hasil override berbeza drpd hasil algoritma automatik (override memang berkuasa)');
  } else {
    lap.gagal('UJIAN 3b: hasil override SAMA dgn algoritma automatik -- ujian tak sah/tak deterministik', hasilOverride);
  }

  // --- 4. DELETE via HTTP sebenar ---
  const padam = await admin('DELETE', `/api/system/pemenggalan-pengecualian/${entriBaharu.id}`);
  if (padam.status === 200 && padam.json?.success) {
    lap.lulus('UJIAN 4: DELETE pemenggalan-pengecualian berjaya');
  } else {
    lap.gagal('UJIAN 4: DELETE gagal', `status=${padam.status} ${JSON.stringify(padam.json)}`);
  }

  // --- 5. GET awam selepas padam -- entri mesti hilang ---
  const senarai2 = await awam('GET', '/api/system/pemenggalan-pengecualian');
  const masihAda = (senarai2.json || []).some((e) => e.perkataan.toLowerCase() === PERKATAAN.toLowerCase());
  if (senarai2.status === 200 && !masihAda) {
    lap.lulus('UJIAN 5: entri hilang drpd GET awam selepas DELETE');
  } else {
    lap.gagal('UJIAN 5: entri MASIH ada selepas DELETE', JSON.stringify(senarai2.json).slice(0, 300));
  }

  // --- 6. Hidrat semula peta client dgn senarai KOSONG (macam FrontpageView selepas re-fetch) --
  // -- sahkan PULIH balik ke algoritma automatik, bukan tersekat sbg override "hantu" dlm Map --
  setPemenggalanPengecualian(senarai2.json || []);
  const hasilSelepasPadam = penggalSukuKata(PERKATAAN);
  if (hasilSelepasPadam === teksAsal) {
    lap.lulus('UJIAN 6: selepas DELETE + muat semula, pemenggalan PULIH ke algoritma automatik (tiada override hantu)');
  } else {
    lap.gagal('UJIAN 6: pemenggalan TAK pulih ke algoritma selepas padam!', `hasil="${hasilSelepasPadam.split(SOFT_HYPHEN).join('-')}" dijangka="${teksAsal.split(SOFT_HYPHEN).join('-')}"`);
  }

  // --- 7. Kawalan negatif: corak tak sah (serpihan 1 huruf) mesti DITOLAK 400 -- pertahanan
  // pertama (pemenggalanRoutes.js) yg dibaiki 2026-09-08 sepatutnya masih berkuat kuasa ---
  const corakTakSah = await admin('POST', '/api/system/pemenggalan-pengecualian', { perkataan: 'entadbiran', corak: 'e-ntadbiran' });
  if (corakTakSah.status === 400) {
    lap.lulus('UJIAN 7: corak serpihan 1-huruf ("e-ntadbiran") ditolak 400 (pertahanan SERPIHAN_MIN kekal aktif)');
  } else {
    lap.gagal('UJIAN 7: corak serpihan 1-huruf TAK ditolak!', `status=${corakTakSah.status} ${JSON.stringify(corakTakSah.json)}`);
  }

  lap.ringkasan();
} finally {
  srv.proc.kill();
}
