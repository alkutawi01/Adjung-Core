// sim54 — CategoryRegistry.mergeCategories() transaksi tak dikunci (2026-09-09, dapatan bug-hunt)
//
// POST /categories/merge (categoryRoutes.js) panggil CategoryRegistry.mergeCategories(), yang
// membuka `BEGIN TRANSACTION` SENDIRI atas sambungan sqlite3 DIKONGSI, TANPA sebarang kunci --
// SIBLING pepijat persis "POST /glosari" yang dibaiki sebelum ni (denganKunciSenseGlosari).
// Ujian ni hantar N permintaan /categories/merge SERENTAK (Bidang sumber berlainan, sasaran SAMA)
// -- sebelum pembetulan, permintaan kedua/seterusnya yang cuba BEGIN TRANSACTION semasa
// permintaan lain masih memegang transaksi terbuka akan gagal dgn ralat sqlite3 mentah
// ("cannot start a transaction within a transaction") sebagai 500 generik, bukan kejayaan bersih.
import path from 'node:path';
import {
  REPO, bootServer, ciptaPentadbir, login, buatKlien, bukaDb, dbAll, pelapor,
} from './sim-lib.mjs';

const PORT = 4554;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim54.db');
const lapor = pelapor('sim54-kategori-transaksi-serentak');

async function utama() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
    const klien = buatKlien(base, cookie);

    const TS = Date.now();
    const TARGET = `sim54-sasaran-${TS}`;
    const N = 8;
    const sumberList = Array.from({ length: N }, (_, i) => `sim54-sumber-${i}-${TS}`);

    // Daftar Bidang sasaran + semua Bidang sumber dahulu (berurutan -- fasa persediaan, bukan
    // bahagian yang diuji).
    await klien('POST', '/api/system/categories/register', { name: TARGET });
    for (const s of sumberList) {
      await klien('POST', '/api/system/categories/register', { name: s });
    }

    // Bahagian sebenar diuji: N permintaan /categories/merge SERENTAK, setiap satu gabung SATU
    // Bidang sumber berlainan ke Bidang sasaran SAMA -- mencetuskan overlap BEGIN TRANSACTION
    // pada sambungan dikongsi kalau tiada kunci.
    const hasil = await Promise.all(
      sumberList.map((s) => klien('POST', '/api/system/categories/merge', {
        sourceCategory: s, targetCategory: TARGET,
      }))
    );

    const ralat500Transaksi = hasil.filter((r) => r.status === 500
      && /transaction within a transaction|SQLITE_ERROR/i.test(r.json?.error || r.teks || ''));
    const berjaya = hasil.filter((r) => r.status === 200 && r.json?.success);

    if (ralat500Transaksi.length > 0) {
      lapor.gagal(
        `${ralat500Transaksi.length}/${N} permintaan gagal dgn ralat transaksi bertindih (500 generik)`,
        JSON.stringify(hasil.map((r) => ({ status: r.status, ralat: r.json?.error })), null, 2)
      );
    } else if (berjaya.length !== N) {
      lapor.gagal(
        `Semua ${N} permintaan patut berjaya (dapat ${berjaya.length} berjaya)`,
        JSON.stringify(hasil.map((r) => ({ status: r.status, ralat: r.json?.error })), null, 2)
      );
    } else {
      lapor.lulus(`Semua ${N} permintaan /categories/merge SERENTAK berjaya, tiada ralat transaksi bertindih`);
    }

    // Sahkan keadaan DB akhir konsisten: sasaran wujud dgn usageCount yang munasabah, SEMUA
    // Bidang sumber sudah dipadam (mergeCategories memadam baris sumber selepas gabung).
    const db = bukaDb(DB_FILE);
    const sasaranRow = await dbAll(db, 'SELECT * FROM CategoryRegistry WHERE name = ?', [TARGET]);
    const bakiSumber = await dbAll(db, `SELECT name FROM CategoryRegistry WHERE name IN (${sumberList.map(() => '?').join(',')})`, sumberList);
    await new Promise((res) => db.close(res));

    if (sasaranRow.length !== 1) {
      lapor.gagal(`Bidang sasaran "${TARGET}" patut ada TEPAT 1 baris selepas semua gabungan (dapat ${sasaranRow.length})`, JSON.stringify(sasaranRow, null, 2));
    } else if (bakiSumber.length !== 0) {
      lapor.gagal(`Semua ${N} Bidang sumber patut dipadam selepas gabung (${bakiSumber.length} masih tertinggal -- keadaan separa)`, JSON.stringify(bakiSumber, null, 2));
    } else {
      lapor.lulus(`Keadaan DB akhir konsisten: sasaran 1 baris, kesemua ${N} Bidang sumber dipadam bersih`);
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
