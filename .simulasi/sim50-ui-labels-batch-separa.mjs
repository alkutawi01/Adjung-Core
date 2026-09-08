// sim50 — POST /api/system/ui-labels dengan >1 kunci dalam SATU permintaan, kunci KEDUA
// bernilai kosong/ruang kosong (ditolak).
//
// Corak sama seperti #126 (slotsConfigRoutes.js) dan sim49 (batch slot Bidang) — semakan
// "nilai tak boleh kosong" berada DALAM gelung yang sama yang juga menulis dbRun() INSERT/
// UPDATE. Kalau kunci pertama dalam badan permintaan SAH (ditulis) dan kunci KEDUA tak sah
// (kosong), pelayan patut pulangkan 400 keseluruhan TANPA menulis kunci pertama pun — tapi
// sebelum pembetulan, kunci pertama SUDAH pun tersimpan ke DB sebelum semakan kunci kedua
// sempat gagal.
import { bootServer, bukaDb, dbGet, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5950;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim50.db');
const lapor = pelapor('sim50-ui-labels-batch-separa');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE, freshDb: true });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, username, pass);
    const klien = buatKlien(base, cookie);

    const db = bukaDb(DB_FILE);
    const kunciA = 'sim50.label.a';
    const kunciB = 'sim50.label.b';

    const sebelumA = await dbGet(db, 'SELECT value FROM ui_labels WHERE key = ?', [kunciA]);
    console.log('  [maklumat] kunci A SEBELUM panggilan:', JSON.stringify(sebelumA));

    // Hantar SATU permintaan pukal: kunci A (nilai sah), kunci B (nilai kosong/ruang kosong,
    // MESTI ditolak 400 mengikut komen kod "label tak boleh disimpan kosong").
    const rSimpan = await klien('POST', '/api/system/ui-labels', {
      [kunciA]: 'Nilai Sah Sim50',
      [kunciB]: '   ',
    });
    console.log('  [maklumat] Respons POST /ui-labels:', rSimpan.status, JSON.stringify(rSimpan.json));

    const selepasA = await dbGet(db, 'SELECT value FROM ui_labels WHERE key = ?', [kunciA]);
    const selepasB = await dbGet(db, 'SELECT value FROM ui_labels WHERE key = ?', [kunciB]);
    console.log('  [maklumat] kunci A SELEPAS panggilan:', JSON.stringify(selepasA));
    console.log('  [maklumat] kunci B SELEPAS panggilan:', JSON.stringify(selepasB));
    await new Promise((r) => db.close(r));

    const aTertulis = selepasA && selepasA.value === 'Nilai Sah Sim50';
    const bTertulis = !!selepasB;

    if (!rSimpan.ok && aTertulis && !bTertulis) {
      lapor.gagal(
        'Simpanan PUKAL menolak permintaan (400) SEBAB kunci B kosong — tapi kunci A SUDAH ' +
          'tertulis ke DB sebelum semakan kunci B sempat gagal. Ini simpanan SEPARA, bercanggah ' +
          'dengan niat "semua-atau-tiada" laluan pukal ni.',
        `status=${rSimpan.status} A=${JSON.stringify(selepasA)} B=${JSON.stringify(selepasB)}`
      );
    } else if (!rSimpan.ok && !aTertulis && !bTertulis) {
      lapor.lulus('Permintaan ditolak (400) DAN tiada satu pun kunci tertulis — invariant semua-atau-tiada dipegang');
    } else if (rSimpan.ok) {
      lapor.gagal('Permintaan dengan nilai kosong SEPATUTNYA ditolak tapi malah berjaya (200)', JSON.stringify(rSimpan.json));
    } else {
      lapor.gagal('Keadaan tak dijangka', JSON.stringify({ rSimpan: rSimpan.json, selepasA, selepasB }));
    }

    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
