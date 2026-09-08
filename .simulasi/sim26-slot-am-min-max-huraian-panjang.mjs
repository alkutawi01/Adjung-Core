// SIMULASI 26 — Tetapan Am Slot: had MAKSIMUM Huraian Panjang ditolak salah bila had MINIMUM
// turut diturunkan dalam PATCH SAMA.
//
// Punca disyaki (core/routes/slotAmRoutes.js, pembinaan `baharu.hadHuraianPanjang`): pengesahan
// "maks >= MIN_BRIEF_LONG_CHARS" guna PEMALAR HARDCODE (400) sebagai lantai, bukan
// `hadHuraianPanjangMin` yang SEDANG ditetapkan dalam PATCH yang SAMA. Semakan silang min<=maks
// yang betul WUJUD berasingan (baris ~379-391) — tapi ia berjalan SELEPAS pengesahan hardcode ni,
// jadi kombinasi sah (cth min=100, maks=250) tetap ditolak 400 walau logik silang sendiri
// membenarkannya, sebab pengesahan awal dahulu sudah lempar ralat pasal maks < 400.
//
// Ujian: PATCH { hadHuraianPanjangMin: 100, hadHuraianPanjang: 250 } (kombinasi SAH — min <= maks,
// kedua-dua > 0) -- WAJIB diterima (200), bukan ditolak sebab maks(250) < MIN_BRIEF_LONG_CHARS(400)
// hardcode.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor } from './sim-lib.mjs';

const PORT = 5226;
const DBF = path.join(os.tmpdir(), 'sim-adjung-slot-am-min-max.db');
const lap = pelapor('SIM 26 — TETAPAN AM SLOT: MIN/MAKS HURAIAN PANJANG BAWAH 400');

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);

  // Baca tetapan sedia ada supaya field lain yang wajib (cth carouselJedaPertama) hantar nilai sah.
  const rSedia = await api('GET', '/api/system/slot-am-settings');
  const asas = rSedia.json || {};

  const badan = {
    ...asas,
    hadHuraianPanjangMin: 100,
    hadHuraianPanjang: 250, // < MIN_BRIEF_LONG_CHARS (400) hardcode, TAPI >= min baharu (100) -- sah.
  };

  const r = await api('POST', '/api/system/slot-am-settings', badan);
  if (r.ok) {
    lap.lulus('PATCH min=100/maks=250 (bawah 400 hardcode, tapi julat sah sendiri) DITERIMA (200)');
  } else {
    lap.gagal(
      'KRITIKAL: PATCH min=100/maks=250 (kombinasi SAH ikut logik silang sendiri) DITOLAK secara salah',
      JSON.stringify(r.json || r.teks)
    );
  }

  // Sahkan juga: kombinasi TAK sah (min > maks) masih ditolak macam biasa (regresi negatif).
  const rTakSah = await api('POST', '/api/system/slot-am-settings', {
    ...asas,
    hadHuraianPanjangMin: 500,
    hadHuraianPanjang: 450,
  });
  if (rTakSah.status === 400) {
    lap.lulus('PATCH min=500/maks=450 (min > maks, tak sah) tetap ditolak 400 (regresi negatif OK)');
  } else {
    lap.gagal('KRITIKAL: PATCH min > maks tidak ditolak', JSON.stringify(rTakSah));
  }
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
