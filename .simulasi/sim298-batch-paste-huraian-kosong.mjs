// sim298 — POST /api/system/pipeline/batch_paste dengan `summary` KOSONG pada slot bukan-BAR.
// Laluan AI pipeline biasa (EditorialPipeline.js) WAJIB panggil EditorialValidator.validate()
// sebelum simpan, yang menolak huraian kosong untuk semua tier bukan-BAR. validateContentBudget()
// pula cuma tolak huraian yang MELEBIHI bajet (nisbah > 1) DAN huraian yang terlalu ringkas
// (nisbah keseluruhan < 0.8) — kalau tajuk SENDIRI sudah cukup panjang untuk capai 80% bajet
// solonya, huraian kosong (nisbah brief = 0) tetap LULUS validateContentBudget kerana nisbah
// KESELURUHAN (tajuk + huraian) masih >= 0.8. Slot KOMPAK (maxTitleAlone=80): tajuk 64+ aksara
// (64/80 = 0.8) + huraian kosong LULUS budget check sepenuhnya. batch_paste (Terbit Terus, tiada
// semakan manusia) tak pernah panggil EditorialValidator langsung — kandungan dgn huraian benar-
// benar kosong boleh terus disiarkan 'approved', sesuatu yang laluan AI biasa akan tolak serta-merta.
import { bootServer, bukaDb, dbGet, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5298;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim298.db');
const lapor = pelapor('sim298-batch-paste-huraian-kosong');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE, freshDb: true });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, username, pass);
    const klien = buatKlien(base, cookie);

    const rAkt = await klien('POST', '/api/system/categories/activate', { name: 'Ekonomi', color: '#802334', icon: 'TrendingUp' });
    if (!rAkt.ok) { lapor.gagal('Persediaan: cipta Bidang aktif gagal', JSON.stringify(rAkt.json)); process.exitCode = 1; return; }

    // Slot 4 ialah KOMPAK (maxTitleAlone=80). Tajuk 65 aksara -> 65/80 = 0.8125 >= 0.8 minimum
    // bajet KESELURUHAN, huraian terus kosong (0/41 = 0). Lulus validateContentBudget().
    const tajuk65 = 'Tajuk enam puluh lima aksara sengaja panjang untuk ujian sim298 aa';
    if (tajuk65.length < 64) throw new Error(`Tajuk ujian terlalu pendek: ${tajuk65.length}`);

    const payload = JSON.stringify([{
      slotIndex: 4,
      title: tajuk65,
      summary: '',
      category: 'Ekonomi',
      topik: 'Kewangan',
      source_url: 'https://contoh.my/berita',
    }]);

    const r = await klien('POST', '/api/system/pipeline/batch_paste', { text: payload });

    if (r.ok) {
      // Sahkan sama ada kandungan huraian-kosong sebenarnya tersimpan 'approved'.
      const db = bukaDb(DB_FILE);
      const row = await dbGet(db, `
        SELECT r.summary FROM editorial_objects o
        JOIN editorial_revisions r ON r.objectId = o.id
        WHERE o.slotIndex = 4 AND r.status = 'approved'
        ORDER BY o.createdAt DESC LIMIT 1
      `);
      db.close();
      if (row && (!row.summary || !row.summary.trim())) {
        lapor.gagal('PEPIJAT: kandungan huraian KOSONG tersimpan status approved (Terbit Terus tanpa semakan)', JSON.stringify(row));
        process.exitCode = 1;
        return;
      }
      lapor.gagal('Batch paste diterima tapi tiada baris huraian-kosong ditemui — semak semula andaian ujian', JSON.stringify(r.json));
      process.exitCode = 1;
      return;
    }

    if (r.json && typeof r.json.error === 'string' && r.json.error.includes('Ringkasan kandungan kosong')) {
      lapor.lulus('Huraian kosong ditolak dgn EditorialValidator, sama seperti laluan AI pipeline biasa');
    } else {
      lapor.gagal('Ditolak tapi sebab tidak dijangka (bukan EditorialValidator)', JSON.stringify(r.json));
      process.exitCode = 1;
    }
  } finally {
    proc.kill();
  }
}

utama();
