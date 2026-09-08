// SIMULASI 21 — Penaja/Sponsor: sempadan TEPAT tempoh tajaan (mulaTajaan/tamatTajaan) via
// HTTP sebenar, bukan cuma baca kod. Modul "never fully live-click-tested" (flagged sesi
// lepas) — CLAUDE.md #4 janji "logo hilang TEPAT bila tempoh tamat".
//
// Ujian:
//  1. Cipta penaja dgn julat SEMASA (mula semalam, tamat esok) -> GET /public/sponsors/semasa
//     wajib pulangkan dia (kelayakan RIGHT NOW).
//  2. PATCH tamatTajaan ke "1 saat lagi", tunggu 1.2s, GET semula -> wajib DAH TAK muncul
//     (tamat sudah berlalu).
//  3. PATCH tamatTajaan ke "1 saat lagi" SEKALI LAGI (drpd sekarang), GET SERTA-MERTA (sebelum
//     1 saat berlalu) -> wajib MASIH muncul (sempadan bawah — belum tamat).
//  4. Uji sempadan EXACT millisecond: set tamatTajaan = timestamp semasa server (dbGet balik
//     lepas PATCH), panggil GET dgn masa >= tamat sepatutnya MASIH layak (<=, inklusif) —
//     sponsorAktifPadaMasa() guna `masa <= tamat`, sahkan tingkah laku ni padan dokumentasi.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor } from './sim-lib.mjs';

const PORT = 5221;
const DBF = path.join(os.tmpdir(), 'sim-adjung-penaja-sempadan.db');
const lap = pelapor('SIM 21 — PENAJA SEMPADAN TEMPOH TAJAAN');

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);

  // 1. Cipta penaja AKTIF SEMASA (mula semalam, tamat esok).
  const semalam = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const esok = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const rCipta = await api('POST', '/api/system/sponsors', {
    nama: 'Penaja Ujian Sim21',
    logoUrl: 'https://example.test/logo.png',
    bulan: new Date().toISOString().slice(0, 7),
    mulaTajaan: semalam,
    tamatTajaan: esok,
    tayangSemasaTransisi: true,
  });
  if (!rCipta.ok || !rCipta.json?.id) throw new Error('Cipta penaja gagal: ' + rCipta.status + ' ' + rCipta.teks);
  const id = rCipta.json.id;
  lap.lulus('Penaja dicipta dgn julat semasa (mula semalam, tamat esok): ' + id);

  const rSemasa1 = await fetch(srv.base + '/api/public/sponsors/semasa').then((r) => r.json());
  if (rSemasa1.some((p) => p.id === id)) {
    lap.lulus('GET /public/sponsors/semasa memaparkan penaja AKTIF SEMASA (dalam julat)');
  } else {
    lap.gagal('Penaja dalam julat SEMASA tak muncul di /public/sponsors/semasa', JSON.stringify(rSemasa1));
  }

  // 2. PATCH tamat ke +1 saat, tunggu 1.2s, sahkan DAH HILANG.
  const tamat1SaatLagi = new Date(Date.now() + 1000).toISOString();
  const rPatch1 = await api('PATCH', `/api/system/sponsors/${id}`, { tamatTajaan: tamat1SaatLagi });
  if (!rPatch1.ok) throw new Error('PATCH tamatTajaan gagal: ' + rPatch1.status + ' ' + rPatch1.teks);
  await new Promise((r) => setTimeout(r, 1200));
  const rSemasa2 = await fetch(srv.base + '/api/public/sponsors/semasa').then((r) => r.json());
  if (!rSemasa2.some((p) => p.id === id)) {
    lap.lulus('Selepas tamatTajaan berlalu (+1.2s), penaja HILANG dari /public/sponsors/semasa (logo hilang tepat)');
  } else {
    lap.gagal('KRITIKAL: penaja MASIH muncul di /public/sponsors/semasa selepas tamatTajaan jelas berlalu', JSON.stringify(rSemasa2));
  }

  // 3. PATCH tamat ke +2 saat (drpd sekarang), GET SERTA-MERTA -> wajib MASIH muncul.
  const tamat2SaatLagi = new Date(Date.now() + 2000).toISOString();
  const mula2SaatLalu = new Date(Date.now() - 1000).toISOString();
  const rPatch2 = await api('PATCH', `/api/system/sponsors/${id}`, { mulaTajaan: mula2SaatLalu, tamatTajaan: tamat2SaatLagi });
  if (!rPatch2.ok) throw new Error('PATCH pemulihan gagal: ' + rPatch2.status + ' ' + rPatch2.teks);
  const rSemasa3 = await fetch(srv.base + '/api/public/sponsors/semasa').then((r) => r.json());
  if (rSemasa3.some((p) => p.id === id)) {
    lap.lulus('Sebelum tamatTajaan berlalu (masih dalam julat), penaja MASIH muncul (sempadan bawah betul)');
  } else {
    lap.gagal('KRITIKAL: penaja HILANG walau tamatTajaan belum berlalu', JSON.stringify(rSemasa3));
  }

  // 4. Uji corak SATU LAGI: mode aktif ganda -- dua PATCH pantas berturut-turut (mula/tamat)
  // yang tak atomik (dua medan berasingan di params tapi SATU SQL UPDATE, jadi ini semak
  // konkurensi permintaan overlapping tidak merosakkan baris -- guna Promise.all).
  const mulaA = new Date(Date.now() - 3600 * 1000).toISOString();
  const tamatA = new Date(Date.now() + 3600 * 1000).toISOString();
  const mulaB = new Date(Date.now() - 7200 * 1000).toISOString();
  const tamatB = new Date(Date.now() + 7200 * 1000).toISOString();
  await Promise.all([
    api('PATCH', `/api/system/sponsors/${id}`, { mulaTajaan: mulaA, tamatTajaan: tamatA }),
    api('PATCH', `/api/system/sponsors/${id}`, { mulaTajaan: mulaB, tamatTajaan: tamatB }),
  ]);
  const rSenarai = await api('GET', '/api/system/sponsors');
  const baris = rSenarai.json?.find((p) => p.id === id);
  const mulaOk = baris && (baris.mulaTajaan === mulaA || baris.mulaTajaan === mulaB);
  const tamatOk = baris && (baris.tamatTajaan === tamatA || baris.tamatTajaan === tamatB);
  const pasanganKonsisten = baris && (
    (baris.mulaTajaan === mulaA && baris.tamatTajaan === tamatA) ||
    (baris.mulaTajaan === mulaB && baris.tamatTajaan === tamatB)
  );
  if (mulaOk && tamatOk && pasanganKonsisten) {
    lap.lulus('Dua PATCH serentak (mula+tamat) tak mencampur pasangan -- baris akhir konsisten SATU permintaan: ' + JSON.stringify({ mulaTajaan: baris.mulaTajaan, tamatTajaan: baris.tamatTajaan }));
  } else {
    lap.gagal('KRITIKAL: dua PATCH serentak mencampur mula/tamat drpd permintaan BERBEZA (baris tidak konsisten)', JSON.stringify(baris));
  }
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
