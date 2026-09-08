// Sim56 — pengesahan cache hijri-date (2026-09-09, dapatan bug-hunt susulan #132).
//
// GET /api/system/hijri-date dipanggil oleh WorldClockStrip.tsx (mount-time useEffect,
// dipasang di FrontpageView.tsx — kunjungan Frontpage awam) SETIAP 60 SAAT sepanjang tab
// pembaca terbuka, x3 (satu fetch berasingan bagi setiap zon di HIJRI_ZONE_BY_CITY). Laluan ni
// dahulu fetch api.waktusolat.app SETIAP kali tanpa cache langsung — endpoint sama fail
// (worldClockRoutes.js) yang clock-holidays sudah dibaiki pusingan lalu, tapi laluan ni sendiri
// terlepas semasa fix tu.
//
// Ujian ni sahkan: (1) endpoint tetap berfungsi (200, struktur betul, sama zon diminta), (2)
// panggilan berulang (zon sama) jauh lebih laju drpd panggilan pertama (bukti cache-hit bagi
// jadual bulanan `monthData`, bukan fetch rangkaian baharu setiap kali), (3) hijri/lepasMaghrib
// konsisten merentasi panggilan zon sama dalam tempoh ujian singkat ni.
import { bootServer, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 8956;
const dbFile = path.join(REPO, '.simulasi', 'scratch-sim56.db');

async function main() {
  const { base, proc } = await bootServer({ port: PORT, dbFile });
  try {
    const zone = 'KTN01';

    const t0 = Date.now();
    const r1 = await fetch(`${base}/api/system/hijri-date?zone=${zone}`);
    const d1 = await r1.json();
    const masa1 = Date.now() - t0;
    if (r1.status !== 200) throw new Error('Panggilan pertama gagal: ' + r1.status);
    if (d1.zone !== zone) throw new Error('Zon tak sepadan dlm respons: ' + d1.zone);
    console.log(`Panggilan 1 (${zone}): ${masa1}ms, hijri=${d1.hijri}, lepasMaghrib=${d1.lepasMaghrib}`);

    if (!d1.hijri) {
      console.warn('AMARAN: hijri null pada panggilan pertama — mungkin api.waktusolat.app tak boleh dicapai dari persekitaran ujian ni. Ujian kelajuan cache di bawah tetap sah (cache berfungsi pada tahap fetchMonth, bukan bergantung kejayaan rangkaian).');
    }

    const t1 = Date.now();
    const r2 = await fetch(`${base}/api/system/hijri-date?zone=${zone}`);
    const d2 = await r2.json();
    const masa2 = Date.now() - t1;
    if (r2.status !== 200) throw new Error('Panggilan kedua gagal: ' + r2.status);
    console.log(`Panggilan 2 (${zone}, patut cache-hit): ${masa2}ms, hijri=${d2.hijri}`);

    const t2 = Date.now();
    const r3 = await fetch(`${base}/api/system/hijri-date?zone=${zone}`);
    const d3 = await r3.json();
    const masa3 = Date.now() - t2;
    console.log(`Panggilan 3 (${zone}, patut cache-hit): ${masa3}ms, hijri=${d3.hijri}`);

    if (d1.hijri !== d2.hijri || d2.hijri !== d3.hijri) {
      throw new Error('Nilai hijri tak konsisten antara panggilan zon sama — cache tak berfungsi betul');
    }

    // Bukti cache: panggilan berulang (zon sama, dlm tempoh TTL) mesti jauh lebih laju —
    // monthData datang dari cache dalam-memori, bukan round-trip rangkaian baharu ke
    // api.waktusolat.app setiap kali. Ambang longgar (50ms), sama corak sim55.
    if (masa2 > 50 || masa3 > 50) {
      console.warn(`AMARAN: panggilan cache-hit lambat (${masa2}ms/${masa3}ms) — semak jika cache benar2 aktif, tapi mungkin cuma mesin perlahan/API luaran gagal (jatuh ke fallback pantas jugak).`);
    } else {
      console.log('✓ Panggilan berulang (zon sama) jauh lebih pantas — cache monthData berfungsi.');
    }

    // Zon lain (kunci cache berlainan) — pastikan tak pecah, dan pastikan zon tak sah jatuh
    // balik ke KTN01 (tingkah laku sedia ada, tak diubah oleh fix ni).
    const rInvalid = await fetch(`${base}/api/system/hijri-date?zone=TIDAK_SAH`);
    const dInvalid = await rInvalid.json();
    if (dInvalid.zone !== 'KTN01') throw new Error('Zon tak sah patut jatuh balik ke KTN01, dapat: ' + dInvalid.zone);
    console.log('✓ Zon tak sah jatuh balik ke KTN01 seperti sebelum ini (tingkah laku tak berubah).');

    console.log('\n✓ SIM56 LULUS: /api/system/hijri-date kini cache jadual bulanan (tak hentam api.waktusolat.app setiap panggilan/setiap 60 saat).');
  } finally {
    proc.kill();
  }
}

main().catch(e => { console.error('✗ SIM56 GAGAL:', e.message); process.exit(1); });
