// sim30 — POST/PATCH /system/sponsors lawan slotIndexes berduplikat.
//
// Pepijat ASAL (dapatan bug-hunt 2026-09-08): sahSenaraiSlot() (core/routes/sponsorRoutes.js)
// cuma semak setiap elemen integer & julat -1..37, TAK tolak nilai BERULANG (cth [3,3]).
// tulisSlotUntukSponsor() (dipanggil dari POST /system/sponsors DAN PATCH /system/sponsors/:id)
// DELETE FROM sponsor_slots WHERE sponsorId=? dahulu, lalu INSERT satu-satu ikut slotIndexes —
// TANPA transaksi BEGIN/COMMIT. sponsor_slots ada PRIMARY KEY (sponsorId, slotIndex), jadi
// INSERT kedua bagi nilai pendua langgar PK dan throw. Route PATCH memanggil UPDATE sponsors
// (nama/dsb.) DAHULU (berjaya, commit), kemudian tulisSlotUntukSponsor() gagal separa — DELETE
// sedia commit, sebahagian INSERT sempat jalan, permintaan pulang 500 tapi skop slot penaja
// sudah rosak/berkurang berbanding sebelum panggilan (bukan rollback ke keadaan asal).
//
// DIBAIKI: sahSenaraiSlot() kini turut tolak senarai yang ada duplikat (`new Set(arr).size ===
// arr.length`) — permintaan pendua ditolak 400 BERSIH sebelum sebarang tulisan DB berlaku,
// tiada lagi keadaan separa.
import { bootServer, bukaDb, dbAll, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5930;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim30.db');
const lapor = pelapor('sim30-sponsor-slot-duplikat');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
    const klien = buatKlien(base, cookie);

    // Tunggu skema penuh sedia (ALTER TABLE anonymousNo/mulaTajaan/tamatTajaan pada `sponsors`
    // berjalan async selepas CREATE TABLE asal).
    {
      const dbSemak = bukaDb(DB_FILE);
      const mula = Date.now();
      while (Date.now() - mula < 15000) {
        const cols = await dbAll(dbSemak, "PRAGMA table_info(sponsors)");
        if (cols.some((c) => c.name === 'anonymousNo')) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      await new Promise((r) => dbSemak.close(r));
    }

    // 1. CIPTA penaja dengan slotIndexes SAH ([2, 5]) — kes asas, mesti berjaya.
    const rCipta = await klien('POST', '/api/system/sponsors', {
      nama: 'Sim30 Penaja', bulan: '2026-09', slotIndexes: [2, 5],
    });
    console.log('  [maklumat] POST cipta:', rCipta.status, JSON.stringify(rCipta.json));
    if (!rCipta.ok || !rCipta.json?.id) {
      lapor.gagal('Persediaan gagal — cipta penaja asas tak berjaya', JSON.stringify(rCipta.json));
      throw new Error('persediaan gagal');
    }
    const id = rCipta.json.id;

    const dbSelepasCipta = bukaDb(DB_FILE);
    const slotsAwal = await dbAll(dbSelepasCipta, 'SELECT slotIndex FROM sponsor_slots WHERE sponsorId = ? ORDER BY slotIndex', [id]);
    await new Promise((r) => dbSelepasCipta.close(r));
    lapor.lulus(`Persediaan: penaja dicipta dengan slot sah [${slotsAwal.map((s) => s.slotIndex).join(',')}]`);

    // 2. POST cipta penaja BAHARU dengan slotIndexes BERDUPLIKAT — mesti ditolak 400 bersih,
    // tiada baris sponsors/sponsor_slots dicipta langsung.
    const rDupCipta = await klien('POST', '/api/system/sponsors', {
      nama: 'Sim30 Penaja Dup', bulan: '2026-09', slotIndexes: [7, 7],
    });
    console.log('  [maklumat] POST duplikat:', rDupCipta.status, JSON.stringify(rDupCipta.json));

    const db2 = bukaDb(DB_FILE);
    const semuaSponsorDup = await dbAll(db2, "SELECT id FROM sponsors WHERE name = 'Sim30 Penaja Dup'");
    await new Promise((r) => db2.close(r));

    if (rDupCipta.status === 400 && semuaSponsorDup.length === 0) {
      lapor.lulus('POST /system/sponsors dengan slotIndexes berduplikat ditolak 400 bersih, tiada baris sponsors tercipta');
    } else if (!rDupCipta.ok && semuaSponsorDup.length > 0) {
      lapor.gagal('Keadaan separa: POST gagal (bukan 400 bersih) tapi baris sponsors tetap tercipta', JSON.stringify({ status: rDupCipta.status, sponsors: semuaSponsorDup }));
    } else {
      lapor.gagal('Keadaan tak dijangka pada ujian cipta duplikat', JSON.stringify({ rDupCipta: rDupCipta.json, sponsors: semuaSponsorDup }));
    }

    // 3. PATCH penaja SEDIA ADA (dari langkah 1) dengan slotIndexes BERDUPLIKAT — mesti ditolak
    // 400 bersih, slot SEDIA ADA [2,5] KEKAL tak berubah (bukan dipadam separa).
    const rDupPatch = await klien('PATCH', `/api/system/sponsors/${id}`, { slotIndexes: [9, 9] });
    console.log('  [maklumat] PATCH duplikat:', rDupPatch.status, JSON.stringify(rDupPatch.json));

    const db3 = bukaDb(DB_FILE);
    const slotsSelepasPatch = await dbAll(db3, 'SELECT slotIndex FROM sponsor_slots WHERE sponsorId = ? ORDER BY slotIndex', [id]);
    await new Promise((r) => db3.close(r));
    const slotSelepasSet = slotsSelepasPatch.map((s) => s.slotIndex);

    if (rDupPatch.status === 400 && slotSelepasSet.length === 2 && slotSelepasSet[0] === 2 && slotSelepasSet[1] === 5) {
      lapor.lulus('PATCH /system/sponsors/:id dengan slotIndexes berduplikat ditolak 400 bersih, slot sedia ada [2,5] KEKAL utuh (tiada DELETE separa)');
    } else {
      lapor.gagal(
        'PATCH duplikat merosakkan/mengubah slot sedia ada penaja walau patut ditolak bersih',
        `status=${rDupPatch.status} slotSelepas=[${slotSelepasSet.join(',')}] (jangka [2,5])`
      );
    }

    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
