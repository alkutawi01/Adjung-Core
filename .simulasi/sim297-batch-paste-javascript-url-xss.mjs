// sim297 — POST /api/system/pipeline/batch_paste dengan JSON tampal yang bawa source_url skema
// bahaya ("javascript:...") pada cabang "1. Try direct JSON parsing" (pipelineRoutes.js). Sebelum
// pembetulan bug-hunt ni, `finalUrl = item.source_url || '#'` terus simpan rentetan tu sebagai
// atribut 'url' kandungan yang diterbitkan (Status: approved WAJIB, laluan ni Terbit Terus) —
// dipaparkan `<a href>` awam di FrontpageView.tsx/FocusView.tsx. Sama kelas pepijat kritikal
// isSafeHttpUrl yang sudah dibaiki di RssDirectEngine.js (2026-09-08) dan EditorialPipeline.js
// (2026-09-09), tapi terlepas laluan batch_paste ni sehingga sekarang.
import { bootServer, bukaDb, dbGet, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5297;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim297.db');
const lapor = pelapor('sim297-batch-paste-javascript-url-xss');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE, freshDb: true });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, username, pass);
    const klien = buatKlien(base, cookie);

    const rAkt = await klien('POST', '/api/system/categories/activate', { name: 'Ekonomi', color: '#802334', icon: 'TrendingUp' });
    if (!rAkt.ok) { lapor.gagal('Persediaan: cipta Bidang aktif gagal', JSON.stringify(rAkt.json)); process.exitCode = 1; return; }

    const huraianPanjangCukup = 'Perenggan huraian panjang untuk ujian sim297. '.repeat(10).trim();

    const payload = JSON.stringify([{
      slotIndex: 4,
      title: 'Sim297 Ujian URL Jahat',
      summary: 'Huraian ringkas ujian sim297',
      briefLong: huraianPanjangCukup,
      category: 'Ekonomi',
      topik: 'Kewangan',
      source_url: 'javascript:alert(document.cookie)',
    }]);

    const r = await klien('POST', '/api/system/pipeline/batch_paste', { text: payload });
    if (!r.ok) {
      lapor.gagal('Batch paste ditolak (mungkin sebab lain, semak validasi)', JSON.stringify(r.json));
      process.exitCode = 1;
      return;
    }

    const db = bukaDb(DB_FILE);
    const row = await dbGet(db, `
      SELECT av.valueText AS url FROM editorial_objects o
      JOIN editorial_attribute_values av ON av.objectId = o.id AND av.attributeId = 'url'
      WHERE o.slotIndex = 4
      ORDER BY o.createdAt DESC LIMIT 1
    `);
    db.close();

    if (!row) {
      lapor.gagal('Tiada baris kandungan/atribut url ditemui selepas batch_paste', '');
      process.exitCode = 1;
      return;
    }

    if (row.url === 'javascript:alert(document.cookie)') {
      lapor.gagal('PEPIJAT: URL "javascript:" tersimpan MENTAH dalam atribut url (stored XSS)', row.url);
      process.exitCode = 1;
      return;
    }

    if (row.url === '#') {
      lapor.lulus(`URL "javascript:" digerbang, jatuh balik ke '#' seperti dijangka (isSafeHttpUrl)`);
    } else {
      lapor.gagal('Nilai url tidak dijangka', row.url);
      process.exitCode = 1;
    }
  } finally {
    proc.kill();
  }
}

utama();
