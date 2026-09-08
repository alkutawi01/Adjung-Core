// sim53 — Glosari (glosari_istilah) TOCTOU (2026-09-09, dapatan bug-hunt)
//
// glosariRoutes.js POST/PATCH /glosari guna corak baca-semak-tulis ("SELECT WHERE
// LOWER(istilah)=?" kemudian INSERT/UPDATE) -- sama corak persis yang dibaiki utk
// pemenggalan_pengecualian (2026-08-16) dan ejaan_piawai (sim52, 2026-09-09). Jadual
// glosari_istilah SAHAJA antara tiga jadual rujukan editorial ni yang terlepas index
// unik peringkat DB sehingga pembetulan ni (idx_glosari_istilah_unik). Ujian ni hantar
// N POST serentak istilah SAMA dan sahkan HANYA SATU baris tercipta.
import path from 'node:path';
import {
  REPO, bootServer, ciptaPentadbir, login, buatKlien, bukaDb, dbAll, pelapor,
} from './sim-lib.mjs';

const PORT = 4553;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim53.db');
const lapor = pelapor('sim53-glosari-toctou');

async function utama() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
    const klien = buatKlien(base, cookie);

    // Tunggu idx_glosari_istilah_unik BENAR-BENAR wujud dalam sqlite_master dahulu (corak
    // sama sim52) -- elak ujian ni sendiri silap lapor TOCTOU sebab indeks belum sempat
    // dicipta semasa rantaian CREATE TABLE/INDEX bersarang boot server.
    {
      const dbSemak = bukaDb(DB_FILE);
      const mula = Date.now();
      let ada = false;
      while (Date.now() - mula < 15000) {
        const baris = await dbAll(dbSemak, "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_glosari_istilah_unik'");
        if (baris.length > 0) { ada = true; break; }
        await new Promise((r) => setTimeout(r, 200));
      }
      await new Promise((res) => dbSemak.close(res));
      if (!ada) throw new Error('idx_glosari_istilah_unik tidak wujud selepas 15s -- boot tak lengkap');
    }

    const ISTILAH = 'sim53-istilah-' + Date.now();
    const N = 8;
    const hasil = await Promise.all(
      Array.from({ length: N }, () => klien('POST', '/api/system/glosari', {
        istilah: ISTILAH, maksud: 'maksud ujian race',
      }))
    );

    const berjaya = hasil.filter((r) => r.status === 200 && r.json?.success);
    const ditolak400 = hasil.filter((r) => r.status === 400);

    if (berjaya.length !== 1) {
      lapor.gagal(
        `Tepat SATU permintaan patut berjaya (dapat ${berjaya.length} berjaya, ${ditolak400.length} ditolak 400)`,
        JSON.stringify(hasil.map((r) => ({ status: r.status, ralat: r.json?.error })), null, 2)
      );
    } else {
      lapor.lulus(`Tepat 1/${N} permintaan serentak berjaya, ${ditolak400.length} ditolak 400 dengan mesej "sudah ada"`);
    }

    const db = bukaDb(DB_FILE);
    const barisDb = await dbAll(db, 'SELECT id, istilah FROM glosari_istilah WHERE LOWER(istilah) = LOWER(?)', [ISTILAH]);
    await new Promise((res) => db.close(res));

    if (barisDb.length !== 1) {
      lapor.gagal(
        `Jadual glosari_istilah patut ada TEPAT 1 baris utk "${ISTILAH}" (dapat ${barisDb.length}) -- pendua bermakna TOCTOU masih wujud`,
        JSON.stringify(barisDb, null, 2)
      );
    } else {
      lapor.lulus(`Jadual glosari_istilah ada tepat 1 baris utk "${ISTILAH}" -- kekangan unik+tangkapan ralat berfungsi`);
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
