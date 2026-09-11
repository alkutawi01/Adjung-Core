// sim299 — POST /api/system/pipeline/batch_paste TANPA Tarikh Sumber.
// Laluan manual biasa (syncManualObjectsForSlot, server.js ~baris 3869) sudah kunci KERAS setiap
// sumber dgn validateTarikhSumber(s.date, s.name) sejak dasar "kewajipan Tarikh Sumber" 2026-09-04
// (kandungan bersumber LUAR tanpa Tarikh Sumber tak boleh disiarkan). batch_paste hardcode
// source='ChatGPT/Gemini Manual Paste' (BUKAN 'Adjung Editorial'), jadi Tarikh Sumber WAJIB bagi
// setiap item laluan ni tanpa pengecualian — tapi laluan ni sebelum ni langsung tak panggil
// validateTarikhSumber DAN tak pernah simpan atribut originalDate. Kandungan bersumber luar
// Terbit Terus (tiada semakan manusia) tanpa Tarikh Sumber = pembaca tak tahu bila fakta asal
// sumber luar itu diterbitkan, sama seperti pepijat 2026-09-04 asal tapi laluan berbeza.
import { bootServer, bukaDb, dbGet, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5299;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim299.db');
const lapor = pelapor('sim299-batch-paste-tarikh-sumber-wajib');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE, freshDb: true });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, username, pass);
    const klien = buatKlien(base, cookie);

    const rAkt = await klien('POST', '/api/system/categories/activate', { name: 'Ekonomi', color: '#802334', icon: 'TrendingUp' });
    if (!rAkt.ok) { lapor.gagal('Persediaan: cipta Bidang aktif gagal', JSON.stringify(rAkt.json)); process.exitCode = 1; return; }

    // Slot 4 ialah KOMPAK (maxTitleAlone=80, maxBriefAlone=41, lihat sim298). Tajuk 65 aksara +
    // huraian pendek lulus validateContentBudget/EditorialValidator dgn selesa supaya ujian ni
    // khusus menyasar gerbang validateTarikhSumber, bukan tersadung gerbang lain dahulu.
    const tajuk65 = 'Tajuk enam puluh lima aksara sengaja panjang untuk ujian sim299 aa';
    if (tajuk65.length < 64) throw new Error(`Tajuk ujian terlalu pendek: ${tajuk65.length}`);
    const huraianPendek = 'Ok.';

    // --- Bahagian 1: TANPA originalDate langsung -> mesti ditolak 400 ---
    const payloadTiadaTarikh = JSON.stringify([{
      slotIndex: 4,
      title: tajuk65,
      summary: huraianPendek,
      category: 'Ekonomi',
      topik: 'Kewangan',
      source_url: 'https://contoh.my/berita-tanpa-tarikh',
    }]);

    const r1 = await klien('POST', '/api/system/pipeline/batch_paste', { text: payloadTiadaTarikh });

    if (r1.ok) {
      const db = bukaDb(DB_FILE);
      const row = await dbGet(db, `
        SELECT r.id FROM editorial_objects o
        JOIN editorial_revisions r ON r.objectId = o.id
        WHERE o.slotIndex = 4 AND r.status = 'approved'
        ORDER BY o.createdAt DESC LIMIT 1
      `);
      db.close();
      lapor.gagal('PEPIJAT: kandungan tanpa Tarikh Sumber tersimpan status approved (Terbit Terus tanpa semakan)', JSON.stringify({ resp: r1.json, row }));
      process.exitCode = 1;
      return;
    }

    if (!(r1.json && typeof r1.json.error === 'string' && r1.json.error.includes('Tarikh sumber wajib diisi'))) {
      lapor.gagal('Ditolak tapi sebab tidak dijangka (bukan validateTarikhSumber)', JSON.stringify(r1.json));
      process.exitCode = 1;
      return;
    }

    // --- Bahagian 2: originalDate format TAK SAH -> mesti ditolak 400 (bukan diterima senyap) ---
    const payloadTarikhTakSah = JSON.stringify([{
      slotIndex: 4,
      title: tajuk65,
      summary: huraianPendek,
      category: 'Ekonomi',
      topik: 'Kewangan',
      source_url: 'https://contoh.my/berita-tarikh-tak-sah',
      originalDate: '2026-13-45',
    }]);
    const r2 = await klien('POST', '/api/system/pipeline/batch_paste', { text: payloadTarikhTakSah });
    if (r2.ok || !(r2.json && r2.json.error && r2.json.error.includes('bukan tarikh kalendar sebenar'))) {
      lapor.gagal('Format tarikh tak sah (2026-13-45) sepatutnya ditolak dgn mesej kalendar, dapat', JSON.stringify(r2.json));
      process.exitCode = 1;
      return;
    }

    // --- Bahagian 3: originalDate SAH -> mesti diterima DAN atribut originalDate tersimpan ---
    const payloadSah = JSON.stringify([{
      slotIndex: 4,
      title: tajuk65,
      summary: huraianPendek,
      category: 'Ekonomi',
      topik: 'Kewangan',
      source_url: 'https://contoh.my/berita-sah',
      originalDate: '2026-08-17',
    }]);
    const r3 = await klien('POST', '/api/system/pipeline/batch_paste', { text: payloadSah });
    if (!r3.ok) {
      lapor.gagal('Item dengan Tarikh Sumber SAH sepatutnya diterima, ditolak', JSON.stringify(r3.json));
      process.exitCode = 1;
      return;
    }

    const db2 = bukaDb(DB_FILE);
    const attrRow = await dbGet(db2, `
      SELECT av.valueText FROM editorial_objects o
      JOIN editorial_revisions r ON r.objectId = o.id
      JOIN editorial_attribute_values av ON av.objectId = o.id AND av.revisionId = r.id AND av.attributeId = 'originalDate'
      WHERE o.slotIndex = 4 AND r.status = 'approved'
      ORDER BY o.createdAt DESC LIMIT 1
    `);
    db2.close();
    if (!attrRow || attrRow.valueText !== '2026-08-17') {
      lapor.gagal('Atribut originalDate tak tersimpan betul selepas terbit', JSON.stringify(attrRow));
      process.exitCode = 1;
      return;
    }

    lapor.lulus('Tarikh Sumber kini WAJIB + disahkan format + tersimpan sebagai atribut originalDate, sepadan laluan manual (syncManualObjectsForSlot)');
  } finally {
    proc.kill();
  }
}

utama();
