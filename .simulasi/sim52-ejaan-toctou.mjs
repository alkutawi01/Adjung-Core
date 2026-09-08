// sim52 — Penyelarasan Ejaan TOCTOU (2026-09-09, dapatan bug-hunt)
//
// ejaanRoutes.js POST/PATCH /ejaan guna corak baca-semak-tulis ("SELECT WHERE LOWER(betul)=?"
// kemudian INSERT/UPDATE) tanpa kunci ATAU kekangan unik peringkat DB — sama corak persis yang
// dibaiki utk pemenggalan_pengecualian (idx_pemenggalan_perkataan_unik, 2026-08-16). Ujian ni
// hantar N POST serentak bentuk "betul" SAMA dan sahkan HANYA SATU baris tercipta selepas
// pembetulan (idx_ejaan_betul_unik + tangkap UNIQUE constraint di ejaanRoutes.js).
import path from 'node:path';
import {
  REPO, bootServer, ciptaPentadbir, login, buatKlien, bukaDb, dbAll, pelapor,
} from './sim-lib.mjs';

const PORT = 4552;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim52.db');
const lapor = pelapor('sim52-ejaan-toctou');

async function utama() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
    const klien = buatKlien(base, cookie);

    // /api/system/health sedia SEBELUM rantaian CREATE TABLE/INDEX bersarang (server.js) siap
    // sepenuhnya (corak "boot-time race" yang sama seperti dasar_aktif_editorial, CLAUDE.md) --
    // tunggu idx_ejaan_betul_unik BENAR-BENAR wujud dalam sqlite_master dahulu, bukan cuma
    // pelayan sudah "sedia" secara HTTP, supaya ujian ni sendiri tak silap lapor TOCTOU sebab
    // indeks belum sempat dicipta.
    {
      const dbSemak = bukaDb(DB_FILE);
      const mula = Date.now();
      let ada = false;
      while (Date.now() - mula < 15000) {
        const baris = await dbAll(dbSemak, "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_ejaan_betul_unik'");
        if (baris.length > 0) { ada = true; break; }
        await new Promise((r) => setTimeout(r, 200));
      }
      await new Promise((res) => dbSemak.close(res));
      if (!ada) throw new Error('idx_ejaan_betul_unik tidak wujud selepas 15s -- boot tak lengkap');
    }

    const BETUL = 'kerana-sim52-' + Date.now();
    const N = 8;
    const hasil = await Promise.all(
      Array.from({ length: N }, () => klien('POST', '/api/system/ejaan', {
        betul: BETUL, elakkan: 'kerena', catatan: 'ujian race',
      }))
    );

    const berjaya = hasil.filter((r) => r.status === 200 && r.json?.success);
    const ditolak409atau400 = hasil.filter((r) => r.status === 400);

    if (berjaya.length !== 1) {
      lapor.gagal(
        `Tepat SATU permintaan patut berjaya (dapat ${berjaya.length} berjaya, ${ditolak409atau400.length} ditolak 400)`,
        JSON.stringify(hasil.map((r) => ({ status: r.status, ralat: r.json?.error })), null, 2)
      );
    } else {
      lapor.lulus(`Tepat 1/${N} permintaan serentak berjaya, ${ditolak409atau400.length} ditolak 400 dengan mesej "sudah ada"`);
    }

    const db = bukaDb(DB_FILE);
    const barisDb = await dbAll(db, 'SELECT id, betul FROM ejaan_piawai WHERE LOWER(betul) = LOWER(?)', [BETUL]);
    await new Promise((res) => db.close(res));

    if (barisDb.length !== 1) {
      lapor.gagal(
        `Jadual ejaan_piawai patut ada TEPAT 1 baris utk "${BETUL}" (dapat ${barisDb.length}) -- pendua bermakna TOCTOU masih wujud`,
        JSON.stringify(barisDb, null, 2)
      );
    } else {
      lapor.lulus(`Jadual ejaan_piawai ada tepat 1 baris utk "${BETUL}" -- kekangan unik+tangkapan ralat berfungsi`);
    }
  } catch (e) {
    lapor.gagal('Ralat semasa simulasi', e.stack || e.message);
    console.log('--- log pelayan (baki) ---\n' + dapatLog().slice(-2000));
  } finally {
    proc.kill();
  }
  const penemuan = lapor.ringkasan();
  process.exit(penemuan.length > 0 ? 1 : 0);
}

utama();
