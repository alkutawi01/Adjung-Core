// sim70 -- CategoryRegistry.activateCategory() (POST /categories/activate, "+ Tambah Bidang" di
// Taksonomi) tak sekat pertindihan `name` semasa AKTIFKAN semula Bidang sedia ada ikut slug,
// tak macam setActiveStatus (pulih) dan renameActiveCategory yang KEDUA-DUANYA sudah dibaiki
// untuk invariant SAMA (2026-09-03/08 -- lihat komen di CategoryRegistry.js): "tiada dua baris
// CategoryRegistry AKTIF boleh berkongsi `name` (case-insensitive)".
//
// Senario: Bidang A dicipta dgn nama "Sukan", KEMUDIAN dinamakan semula (renameActiveCategory)
// jadi "Ekonomi" -- slug KEKAL "sukan" (rename sengaja tak sentuh slug, lihat komen fungsi tu),
// tapi `name` sekarang "Ekonomi". Bidang B dicipta berasingan dgn nama "Sukan" (slug "sukan-2"
// sebab slug "sukan" dah diambil A), kemudian diarkibkan. Pentadbir klik "+ Tambah Bidang" dan
// taip "Ekonomi" -- slug dikira drpd nama tu ialah "ekonomi", TAK padan mana2 row sedia ada,
// jadi row BAHARU dicipta... itu selamat. Path bermasalah sebenar: taip nama YANG SAMA PERSIS
// dgn `name` A semasa TAPI slug lookup jumpa row LAIN kerana slug A sendiri dah "sukan" (bukan
// "ekonomi") -- activateCategory cari ikut SLUG(name baharu), bukan NAME. Jadi untuk timbulkan
// perlanggaran, kita perlukan row C yang slugnya = slug(nama ditaip) TAPI row itu berbeza
// row drpd row yang sudah pegang nama tu skrg.
//
// Skema konkrit: Bidang A slug="sukan" name="Sukan" (aktif). Bidang A2 dicipta drpd auto-daftar
// dgn nama tepat "Sukan" lagi -- registerCategory() akan pulangkan A sedia ada (slug sama), jadi
// tak boleh terus. Sebaliknya: A slug="ekonomi" DIRENAME jadi name="Sukan" (slug KEKAL
// "ekonomi") -- sekarang A ialah row AKTIF bernama "Sukan" tapi slug "ekonomi". Bidang B dicipta
// berasingan dgn nama asal "Sukan Lama" (slug "sukan-lama"), kemudian DIARKIBKAN, KEMUDIAN
// dinamakan semula (melalui laluan lain / terus DB, memandangkan tiada laluan API rename utk
// Bidang tak aktif) -- lebih mudah: guna terus CategoryRegistry.renameActiveCategory tak boleh
// (perlu isActive semasa semak, tapi row target semasa dinamakan semula tak perlu aktif -- fungsi
// tu tak semak status row SENDIRI, cuma row LAIN). Jadi:
//   1. Daftar+aktifkan Bidang A ("Alpha-<ts>"), lalu renameActiveCategory(A, "Sukan-<ts>").
//      Slug A kekal "alpha-<ts>", name A jadi "Sukan-<ts>".
//   2. Daftar+aktifkan Bidang B dgn nama TEPAT "Sukan-<ts>" pun -- TAK BOLEH terus (registerCategory
//      slug lookup akan collide dgn... tidak, slug B = slug("Sukan-<ts>") = "sukan-<ts>", BEZA drpd
//      slug A "alpha-<ts>". registerCategory cuma tolak kalau SLUG sama, jadi B berjaya didaftar
//      SEBAGAI ROW BAHARU dgn name "Sukan-<ts>" jugak -- INI SENDIRI dah patut ditolak oleh
//      activateCategory kalau A aktif, tapi mari uji lubang activateCategory tepat: guna
//      activateCategory (bukan registerCategory) utk cipta B julung kali, isActive=1 terus --
//      activateCategory PATH "cipta row baharu" (row tak wujud ikut slug) TAK SEMAK pertindihan
//      nama pun. Row baharu terus isActive=1 tanpa collision check.
//
// Jadi bug SEBENAR yg plg mudah direalisasikan: activateCategory() cipta Bidang BAHARU (path
// row-tak-wujud) TANPA collision check langsung -- setActiveStatus/renameActiveCategory kedua2
// tolak eksplisit, activateCategory (dua path -- cipta baharu ATAU reaktifkan sedia ada ikut
// slug) TAK PERNAH tolak. Ujian ni buktikan DUA Bidang aktif berakhir dgn `name` IDENTIK selepas
// panggilan /categories/activate berturut-turut dgn nama yg sama persis (huruf besar/kecil beza).
import path from 'node:path';
import {
  REPO, bootServer, ciptaPentadbir, login, buatKlien, bukaDb, dbAll, pelapor,
} from './sim-lib.mjs';

const PORT = 4570;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim70.db');
const lapor = pelapor('sim70-aktifkan-bidang-nama-berlanggar');

async function utama() {
  const { proc, base, dapatLog } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
    const klien = buatKlien(base, cookie);

    const TS = Date.now();
    const NAMA_ASAL = `Foo Ujian ${TS}`;
    const NAMA_SELEPAS_RENAME = `Bar Ujian ${TS}`;

    // 1. Cipta Bidang A ("+ Tambah Bidang") -- slug dikunci drpd nama ASAL ni buat selama-lamanya.
    const r1 = await klien('POST', '/api/system/categories/activate', { name: NAMA_ASAL, color: '#ff0000' });

    // 2. Namakan semula A -- renameActiveCategory TUKAR `name` SAHAJA, `slug` KEKAL slug(NAMA_ASAL)
    //    (dikunci sengaja, lihat komen fungsi tu). A kini: slug=slug(NAMA_ASAL), name=NAMA_SELEPAS_RENAME.
    const idA = r1.json?.category?.id;
    const r2 = await klien('POST', '/api/system/categories/rename-active', { id: idA, newName: NAMA_SELEPAS_RENAME });

    // 3. "+ Tambah Bidang" SEKALI LAGI, taip NAMA_SELEPAS_RENAME tepat -- slug dikira drpd nama
    //    BAHARU ni ialah slug(NAMA_SELEPAS_RENAME), BUKAN slug(NAMA_ASAL) yang A pegang. Row
    //    dgn slug ni TAK WUJUD lagi -- activateCategory() masuk path "cipta row BAHARU", yang
    //    terus isActive=1 TANPA sebarang semakan pertindihan `name` terhadap Bidang aktif lain
    //    (tak macam setActiveStatus/renameActiveCategory yang KEDUA-DUANYA tolak eksplisit).
    const r3 = await klien('POST', '/api/system/categories/activate', { name: NAMA_SELEPAS_RENAME, color: '#0000ff' });

    const db = bukaDb(DB_FILE);
    const aktifSamaNama = await dbAll(db,
      'SELECT id, slug, name, isActive FROM CategoryRegistry WHERE isActive = 1 AND LOWER(name) = LOWER(?)',
      [NAMA_SELEPAS_RENAME]);
    await new Promise((res) => db.close(res));

    if (aktifSamaNama.length > 1) {
      lapor.gagal(
        `${aktifSamaNama.length} baris CategoryRegistry AKTIF berkongsi name "${NAMA_SELEPAS_RENAME}" selepas rename + /categories/activate -- invariant "nama Bidang aktif unik" (dikuatkuasakan setActiveStatus/renameActiveCategory) DILANGGAR oleh activateCategory()`,
        JSON.stringify({ r1: r1.json, r2: r2.json, r3: r3.json, aktifSamaNama }, null, 2)
      );
    } else if (r3.status !== 400 || !/sudah wujud/i.test(r3.json?.error || '')) {
      lapor.gagal(
        `Panggilan ketiga sepatutnya ditolak 400 "...sudah wujud..." (pertindihan nama), dapat status ${r3.status}`,
        JSON.stringify({ r3: r3.json }, null, 2)
      );
    } else {
      lapor.lulus(`Panggilan ketiga ditolak 400 (pertindihan nama dikesan) -- cuma 1 baris aktif dgn name ni, tiada pertindihan`);
    }
  } catch (e) {
    lapor.gagal('Ralat semasa simulasi', e.stack || e.message);
  } finally {
    proc.kill();
  }
}

utama();
