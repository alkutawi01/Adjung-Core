// Verifikasi susulan (2026-09-09) selepas server.js berhenti simpan salinan literal berasingan
// LABEL_DIKENALI_SRV/nyahBungkusMarkdownLinkSrv, dan sebaliknya IMPORT terus
// LABEL_DIKENALI/ADA_LABEL_DIKENALI/nyahBungkusMarkdownLink drpd ManualBlockFormat.js (punca akar
// sama macam #213 — dua penghurai "MESTI kekal segerak" yg disiplin manusia gagal kuatkuasa).
// Ujian ni sahkan laluan TERBIT SEBENAR (parseManualSummaryTemplate) masih urai label bernombor
// ("URL 1:", "Sumber 1:") DAN nyahbungkus pautan Markdown "[url](url)" selepas import.
import { bootServer, ciptaPentadbir, login, buatKlien, HURAIAN_PANJANG_SAH, isiHuraianCukup, pelapor } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5298;
const DB = process.env.TEMP ? `${process.env.TEMP}/scratch-simSharedLabelImport.db` : '/tmp/scratch-simSharedLabelImport.db';
const lapor = pelapor('sim-shared-label-import-verify');

const slotIndexUjian = 6;
const tajukUjian = 'Ujian Label Bernombor Dan Pautan Markdown';
const huraianRingkasUjian = isiHuraianCukup(ceilingForSlot, slotIndexUjian, tajukUjian.length);

const blok = [
  `Tajuk: ${tajukUjian}`,
  `Huraian ringkas: ${huraianRingkasUjian}`,
  `Huraian panjang: ${HURAIAN_PANJANG_SAH}`,
  'Bidang: Teknologi',
  'Topik: Ujian Import',
  // Label bernombor gaya AI luaran (SALINAN KEDUA normalisasi regex ~server.js baris 3418)
  'Sumber 1: Sumber Ujian Bernombor',
  // Pautan dibungkus Markdown gaya "[teks](url)" DENGAN teks==url (kes sebenar Izzat 2026-08-16)
  'URL 1: [https://contoh.test/pautan-bernombor](https://contoh.test/pautan-bernombor)',
  'Tarikh sumber 1: 2026-09-01',
].join('\n');

(async () => {
  const { proc } = await bootServer({ port: PORT, dbFile: DB });
  try {
    const base = `http://localhost:${PORT}`;
    const { username, pass } = await ciptaPentadbir(DB);
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);

    const regCat = await api('POST', '/api/system/categories/activate', { name: 'Teknologi', color: '#123456' });
    if (!regCat.ok) lapor.gagal('Daftar Bidang Teknologi', JSON.stringify(regCat.json || regCat.teks));

    const r = await api('POST', '/api/system/slots', [{
      slotIndex: slotIndexUjian,
      layoutTemplateId: 'frontpage',
      contentMode: 'Manual',
      manualSummary: blok,
      manualDesk: 'Teknologi',
    }]);

    if (!r.ok) {
      lapor.gagal('Simpan slot manual', `status=${r.status} body=${JSON.stringify(r.json || r.teks).slice(0,800)}`);
    } else {
      lapor.lulus('Slot disimpan tanpa ralat (status ' + r.status + ')');
    }

    const { bukaDb, dbAll } = await import('./sim-lib.mjs');
    const db = bukaDb(DB);
    const objek = await dbAll(db, `SELECT eo.id FROM editorial_objects eo WHERE eo.slotIndex = ?`, [slotIndexUjian]);
    if (objek.length === 1) {
      lapor.lulus(`Tepat SATU objek editorial dicipta untuk slot ${slotIndexUjian}`);
    } else {
      lapor.gagal('Bilangan objek editorial salah', `dijangka 1, dapat ${objek.length}`);
    }

    const attrUrl = objek.length ? await dbAll(db,
      `SELECT eav.valueText FROM editorial_attribute_values eav
       JOIN editorial_attributes ea ON ea.id = eav.attributeId
       WHERE eav.objectId = ? AND ea.id = 'url'`, [objek[0].id]) : [];
    const urlTersimpan = attrUrl[0]?.valueText;
    if (urlTersimpan === 'https://contoh.test/pautan-bernombor') {
      lapor.lulus(`URL bernombor dinyahbungkus Markdown betul, tersimpan bersih: "${urlTersimpan}"`);
    } else {
      lapor.gagal('URL tidak bersih / label bernombor tidak dikenali', JSON.stringify(attrUrl));
    }

    const attrSource = objek.length ? await dbAll(db,
      `SELECT eav.valueText FROM editorial_attribute_values eav
       JOIN editorial_attributes ea ON ea.id = eav.attributeId
       WHERE eav.objectId = ? AND ea.id = 'source'`, [objek[0].id]) : [];
    if (attrSource[0]?.valueText === 'Sumber Ujian Bernombor') {
      lapor.lulus(`Label "Sumber 1:" bernombor dikenali betul: "${attrSource[0].valueText}"`);
    } else {
      lapor.gagal('Label "Sumber 1:" bernombor tidak dikenali', JSON.stringify(attrSource));
    }

    await new Promise(res => db.close(res));
  } finally {
    proc.kill();
  }
  lapor.ringkasan();
})();
