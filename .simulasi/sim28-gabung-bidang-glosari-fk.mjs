// sim28 — Gabung Bidang (merge) lawan Sense Glosari khusus-Bidang.
//
// Hipotesis: mergeCategories() (core/category/CategoryRegistry.js) memadam baris
// CategoryRegistry sumber SELEPAS memindahkan kandungan (editorial_objects/
// editorial_attribute_values) ke Bidang sasaran — tapi jadual glosari_sense_bidang
// (server.js ~baris 1053) rujuk CategoryRegistry(id) TANPA "ON DELETE CASCADE"
// (tak macam glosari_sense->glosari_istilah yang memang CASCADE). Dengan
// PRAGMA foreign_keys=ON aktif, DELETE FROM CategoryRegistry patut GAGAL dengan
// SQLITE_CONSTRAINT bila mana-mana Sense glosari khusus-Bidang masih rujuk Bidang
// sumber tu — dan sebab mergeCategories() bukan satu transaksi (siri dbRun berasingan),
// kegagalan pada langkah akhir (DELETE) akan tinggalkan keadaan SEPARA: usageCount
// sasaran dah naik + kandungan dah dipindah, tapi baris Bidang sumber MASIH wujud
// (nampak macam gabungan "berjaya sebahagian" walau laluan API pulangkan 500).
import { bootServer, bukaDb, dbRun, dbGet, dbAll, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5928;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim28.db');
const lapor = pelapor('sim28-gabung-bidang-glosari-fk');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
    const klien = buatKlien(base, cookie);

    // 1. Cipta dua Bidang: sumber (akan digabung) dan sasaran.
    const namaSumber = 'Sim28 Sumber ' + Date.now();
    const namaSasaran = 'Sim28 Sasaran ' + Date.now();
    const rSumber = await klien('POST', '/api/system/categories/register', { name: namaSumber });
    const rSasaran = await klien('POST', '/api/system/categories/register', { name: namaSasaran });
    if (!rSumber.ok || !rSasaran.ok) {
      lapor.gagal('Persediaan: cipta Bidang', JSON.stringify({ rSumber: rSumber.json, rSasaran: rSasaran.json }));
      return lapor.ringkasan();
    }
    const idSumber = rSumber.json.category.id;

    // 2. Cipta satu istilah Glosari dengan Sense KHUSUS-Bidang terikat kepada Bidang sumber.
    const istilah = 'Sim28Istilah' + Date.now();
    const rGlosari = await klien('POST', '/api/system/glosari', {
      istilah,
      maksud: 'Fallback am tidak relevan untuk ujian ini.',
      senseAwal: { definisi: 'Makna khusus Bidang sumber, untuk ujian gabung.', amSense: false, bidangIds: [idSumber] },
    });
    if (!rGlosari.ok) {
      lapor.gagal('Persediaan: cipta istilah+Sense khusus-Bidang', JSON.stringify(rGlosari.json));
      return lapor.ringkasan();
    }
    lapor.lulus('Persediaan: Bidang sumber/sasaran + Sense khusus-Bidang sumber dicipta');

    // 3. Panggil laluan gabung SEBENAR.
    const rGabung = await klien('POST', '/api/system/categories/merge', { sourceCategory: namaSumber, targetCategory: namaSasaran });

    // 4. Semak keadaan DB SEBENAR selepas panggilan (bukan cuma respons HTTP).
    const db = bukaDb(DB_FILE);
    const bidangSumberMasihWujud = await dbGet(db, 'SELECT * FROM CategoryRegistry WHERE id = ?', [idSumber]);
    const senseMasihTerikat = await dbAll(db, 'SELECT * FROM glosari_sense_bidang WHERE categoryId = ?', [idSumber]);
    await new Promise(r => db.close(r));

    console.log('  [maklumat] Respons /categories/merge:', rGabung.status, JSON.stringify(rGabung.json));
    console.log('  [maklumat] Baris CategoryRegistry sumber masih wujud selepas gabung?', !!bidangSumberMasihWujud);
    console.log('  [maklumat] Bilangan glosari_sense_bidang masih rujuk Bidang sumber:', senseMasihTerikat.length);

    if (!rGabung.ok && bidangSumberMasihWujud) {
      lapor.gagal(
        'Gabung Bidang gagal SEPARA — kandungan/usageCount mungkin dah dipindah tapi baris Bidang sumber tak terpadam (FK constraint glosari_sense_bidang), API pulangkan ralat generik tanpa maklumat sebenar',
        `status=${rGabung.status} body=${JSON.stringify(rGabung.json)} bidangSumberMasihWujud=${!!bidangSumberMasihWujud} senseMasihTerikat=${senseMasihTerikat.length}`
      );
    } else if (rGabung.ok && bidangSumberMasihWujud) {
      lapor.gagal(
        'Gabung Bidang "berjaya" (200) tapi baris Bidang sumber TIDAK terpadam daripada CategoryRegistry',
        JSON.stringify({ bidangSumberMasihWujud, senseMasihTerikat })
      );
    } else if (rGabung.ok && !bidangSumberMasihWujud) {
      lapor.lulus('Gabung Bidang berjaya sepenuhnya (Bidang sumber terpadam, Sense glosari tak jadi rujukan yatim)');
    } else {
      lapor.gagal('Keadaan tak dijangka', JSON.stringify({ rGabung: rGabung.json, bidangSumberMasihWujud }));
    }

    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
