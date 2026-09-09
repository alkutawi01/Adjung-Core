// Sahkan pepijat: POST /api/public/permohonan-penaja "satu permohonan terbuka per e-mel" boleh
// dipintas oleh dua hantaran serentak e-mel sama — semakan `sediaAda` (baca) berlaku SEBELUM
// denganKunciRujukanPenaja (kunci), jadi dua permintaan kedua-duanya baca "tiada permohonan
// terbuka" sebelum mana-mana sempat INSERT. Sama corak TOCTOU yang dibaiki di
// permohonanEditorRoutes.js (denganKunciEmelPermohonan) — sibling ni terlepas.
import path from 'node:path';
import { REPO, bootServer, bukaDb, dbAll } from './sim-lib.mjs';

const PORT = 5953;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim53.db');

const borang = (emel) => ({
  jenisPemohon: 'individu',
  namaSebenar: 'Ahmad Bin Test',
  emel,
  aktivitiUtama: 'Ujian',
  pilihanPaparan: 'nama',
});

async function main() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    const emel = 'race-sponsor@test.com';
    const N = 8;
    const hasil = await Promise.all(
      Array.from({ length: N }, () =>
        fetch(`${base}/api/public/permohonan-penaja`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(borang(emel)),
        }).then(async (r) => ({ status: r.status, body: await r.json() }))
      )
    );

    const berjaya = hasil.filter((h) => h.status === 200 && h.body.success);
    const ditolak409 = hasil.filter((h) => h.status === 409);

    const db = bukaDb(DB_FILE);
    const baris = await dbAll(db, "SELECT id, status FROM permohonan_penaja WHERE LOWER(emel) = ?", [emel]);
    await new Promise((r) => db.close(r));

    console.log(`Hantaran serentak: ${N}, berjaya (200): ${berjaya.length}, ditolak (409): ${ditolak409.length}`);
    console.log(`Baris DB terhasil untuk e-mel sama: ${baris.length}`, baris.map((b) => b.id));

    if (baris.length > 1) {
      console.log('PEPIJAT DISAHKAN: >1 permohonan "terbuka" tercipta bagi e-mel sama serentak.');
      process.exitCode = 1;
    } else {
      console.log('PASS: tepat 1 baris tercipta, selebihnya ditolak 409.');
    }
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
