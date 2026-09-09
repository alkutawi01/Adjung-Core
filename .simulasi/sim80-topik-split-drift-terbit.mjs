// Verifikasi pembetulan: server.js parseManualSummaryTemplate (laluan TERBIT SEBENAR) guna
// MANUAL_BLOCK_SPLIT_REGEX kongsi (dgn lookbehind Topik:) selepas fix, bukan salinan usang tanpa
// lookbehind. Blok tunggal dgn baris kosong SELEPAS "Topik:" (corak AI luaran sebenar, gaya
// ChatGPT tampal) TIDAK PATUT belah dua.
import { bootServer, ciptaPentadbir, login, buatKlien, HURAIAN_PANJANG_SAH, isiHuraianCukup, pelapor } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5299;
const DB = process.env.TEMP ? `${process.env.TEMP}/scratch-simTopikSplit.db` : '/tmp/scratch-simTopikSplit.db';
const lapor = pelapor('sim-topik-split-drift');

const slotIndexUjian = 5;
const tajukUjian = 'Ujian Pepijat Belah Topik';
const huraianRingkasUjian = isiHuraianCukup(ceilingForSlot, slotIndexUjian, tajukUjian.length);

const blokSatu = [
  'UUID: uuid-topik-test-1',
  'Status: terbit',
  'Topik: Logo Baharu Instagram',
  '',
  `Tajuk: ${tajukUjian}`,
  `Huraian ringkas: ${huraianRingkasUjian}`,
  `Huraian panjang: ${HURAIAN_PANJANG_SAH}`,
  'Bidang: Teknologi',
  'Sumber: Sumber Ujian',
  'URL: https://contoh.test/artikel',
  'Tarikh sumber: 2026-09-01',
].join('\n');

(async () => {
  const { proc } = await bootServer({ port: PORT, dbFile: DB });
  try {
    const base = `http://localhost:${PORT}`;
    const { username, pass } = await ciptaPentadbir(DB);
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    // Bidang "Teknologi" mesti aktif dulu (gerbang Bidang aktif di slotsConfigRoutes.js)
    const regCat = await api('POST', '/api/system/categories/activate', { name: 'Teknologi', color: '#123456' });
    if (!regCat.ok) lapor.gagal('Daftar Bidang Teknologi', JSON.stringify(regCat.json || regCat.teks));

    const slotIndex = slotIndexUjian; // slot bento biasa, bukan Ticker/BAR
    const r = await api('POST', '/api/system/slots', [{
      slotIndex,
      layoutTemplateId: 'frontpage',
      contentMode: 'Manual',
      manualSummary: blokSatu,
      manualDesk: 'Teknologi',
    }]);

    if (!r.ok) {
      lapor.gagal('Simpan slot manual', `status=${r.status} body=${JSON.stringify(r.json || r.teks).slice(0,500)}`);
    } else {
      const items = (r.json && r.json.savedItems) || null;
      // Baca balik terus dari editorial_objects/editorial_revisions via API awam count kandungan
      const cek = await api('GET', `/api/system/slots`);
      lapor.lulus('Slot disimpan tanpa ralat (status ' + r.status + ')');
      console.log('  Respons penuh POST /slots:', JSON.stringify(r.json).slice(0, 800));
    }

    // Sahkan bilangan objek editorial yang dicipta untuk slot ni — MESTI 1 (bukan 2 sebab
    // belah palsu pada baris kosong selepas "Topik:")
    const { bukaDb, dbAll } = await import('./sim-lib.mjs');
    const db = bukaDb(DB);
    const objek = await dbAll(db, `SELECT eo.id FROM editorial_objects eo
      WHERE eo.slotIndex = ?`, [slotIndex]);
    if (objek.length === 1) {
      lapor.lulus(`Tepat SATU objek editorial dicipta untuk slot ${slotIndex} (bukan 2 akibat belah palsu)`);
    } else {
      lapor.gagal('Bilangan objek editorial salah', `dijangka 1, dapat ${objek.length}`);
    }
    const rev = objek.length ? await dbAll(db, 'SELECT title FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1', [objek[0].id]) : [];
    if (rev.length && rev[0].title === tajukUjian) {
      lapor.lulus(`Tajuk sepadan penuh (Topik tidak "mencuri" blok berasingan): "${rev[0].title}"`);
    } else {
      lapor.gagal('Tajuk tidak sepadan / hilang', JSON.stringify(rev));
    }
    // Semak juga Topik tersimpan betul (bukti blok TIDAK belah — kalau belah, Topik hilang dari
    // blok Tajuk kerana ia berada dalam blok "1" yang berasingan/dibuang sbb tiada Tajuk).
    const attrTopik = objek.length ? await dbAll(db,
      `SELECT eav.valueText FROM editorial_attribute_values eav
       JOIN editorial_attributes ea ON ea.id = eav.attributeId
       WHERE eav.objectId = ? AND ea.id = 'topik'`, [objek[0].id]) : [];
    if (attrTopik.length && attrTopik[0].valueText === 'Logo Baharu Instagram') {
      lapor.lulus(`Topik tersimpan bersama Tajuk dalam SATU blok: "${attrTopik[0].valueText}"`);
    } else {
      lapor.gagal('Topik hilang/tidak sepadan (bukti blok masih belah)', JSON.stringify(attrTopik));
    }
    await new Promise(res => db.close(res));
  } finally {
    proc.kill();
  }
  lapor.ringkasan();
})();
