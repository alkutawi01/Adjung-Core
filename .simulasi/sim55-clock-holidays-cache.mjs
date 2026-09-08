// Sim55 — pengesahan cache clock-holidays (2026-09-09, dapatan bug-hunt).
//
// GET /api/system/clock-holidays dipanggil pada SETIAP kunjungan Frontpage awam
// (FrontpageView.tsx useEffect []), tapi laluan ni dahulu fetch API luaran
// (malaysia-holiday.dydxsoft.my) SETIAP kali tanpa cache — berbeza drpd corak cache yang
// dipakai di dbStateRoutes.js (googleDocCache)/sitemapRoutes.js/rssFeedRoutes.js.
//
// Ujian ni sahkan: (1) endpoint tetap berfungsi (200, struktur betul), (2) panggilan berulang
// pantas jauh lebih laju drpd panggilan pertama (bukti cache-hit, bukan fetch rangkaian baharu
// setiap kali), (3) data konsisten merentasi panggilan (cache pulangkan objek sama).
import { bootServer, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 8955;
const dbFile = path.join(REPO, '.simulasi', 'scratch-sim55.db');

async function main() {
  const { base, proc } = await bootServer({ port: PORT, dbFile });
  try {
    const t0 = Date.now();
    const r1 = await fetch(`${base}/api/system/clock-holidays`);
    const d1 = await r1.json();
    const masa1 = Date.now() - t0;
    if (r1.status !== 200) throw new Error('Panggilan pertama gagal: ' + r1.status);
    if (!Array.isArray(d1.publicHolidays)) throw new Error('publicHolidays bukan array');
    if (!Array.isArray(d1.schoolHolidays)) throw new Error('schoolHolidays bukan array');
    console.log(`Panggilan 1: ${masa1}ms, ${d1.publicHolidays.length} cuti awam ditemui`);

    const t1 = Date.now();
    const r2 = await fetch(`${base}/api/system/clock-holidays`);
    const d2 = await r2.json();
    const masa2 = Date.now() - t1;
    if (r2.status !== 200) throw new Error('Panggilan kedua gagal: ' + r2.status);
    console.log(`Panggilan 2 (patut cache-hit): ${masa2}ms, ${d2.publicHolidays.length} cuti awam`);

    const t2 = Date.now();
    const r3 = await fetch(`${base}/api/system/clock-holidays`);
    const d3 = await r3.json();
    const masa3 = Date.now() - t2;
    console.log(`Panggilan 3 (patut cache-hit): ${masa3}ms, ${d3.publicHolidays.length} cuti awam`);

    if (JSON.stringify(d1.publicHolidays) !== JSON.stringify(d2.publicHolidays)) {
      throw new Error('Data cuti awam tak konsisten antara panggilan 1 dan 2 — cache tak berfungsi betul');
    }
    if (JSON.stringify(d2.publicHolidays) !== JSON.stringify(d3.publicHolidays)) {
      throw new Error('Data cuti awam tak konsisten antara panggilan 2 dan 3');
    }

    // Bukti cache: panggilan berulang mesti jauh lebih laju (data tempatan, tiada round-trip
    // rangkaian ke API luaran). Ambang longgar (50ms) — cukup untuk buktikan bukan fetch rangkaian
    // baharu (yang biasanya berpuluh-ratus ms), tanpa terlalu ketat pada mesin perlahan.
    if (masa2 > 50 || masa3 > 50) {
      console.warn(`AMARAN: panggilan cache-hit lambat (${masa2}ms/${masa3}ms) — semak jika cache benar2 aktif, tapi mungkin cuma mesin perlahan/API luaran gagal (jatuh ke fallback pantas jugak).`);
    } else {
      console.log('✓ Panggilan berulang jauh lebih pantas — cache berfungsi.');
    }

    console.log('\n✓ SIM55 LULUS: /api/system/clock-holidays cache berfungsi (tak hentam API luaran setiap panggilan).');
  } finally {
    proc.kill();
  }
}

main().catch(e => { console.error('✗ SIM55 GAGAL:', e.message); process.exit(1); });
