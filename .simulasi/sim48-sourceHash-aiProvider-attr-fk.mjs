// sim48 — sahkan attributeId 'sourceHash' dan 'aiProvider' didaftar dalam editorial_attributes
// (bug-hunt 2026-09-09). EditorialPipeline.js runSlotPipeline() menulis KEDUA-DUA attributeId ni
// ke editorial_attribute_values (attributesToSave, ~baris 640) untuk SETIAP kandungan slot bukan-
// Ticker dijana AI — tapi server.js TAK PERNAH mendaftarkan 'sourceHash'/'aiProvider' dalam jadual
// editorial_attributes (FOREIGN KEY attributeId REFERENCES editorial_attributes(id), PRAGMA
// foreign_keys=ON aktif). Sama corak PERSIS macam pepijat 'desk'/'url'/'source'/'sourceType'/
// 'topik'/'editorName' yang telah dibaiki sebelum ni (lihat komen server.js ~baris 2713-2793) --
// tapi dua attributeId BAHARU ni (ditambah kemudian utk cache sumber + atribusi provider) terlepas
// pendaftaran yang sama.
//
// Kesan sebenar: attributesToSave ialah SATU gelung tanpa try/catch per-item (EditorialPipeline.js
// ~baris 652) -- 'sourceHash' ialah ITEM PERTAMA dalam senarai, jadi kegagalan FK padanya
// menggagalkan SELURUH gelung serta-merta (unhandled rejection), bermakna 'desk'/'source'/'url'/
// 'aiProvider'/'topik'/'originalDate' turut TIDAK PERNAH tersimpan untuk kandungan slot bukan-
// Ticker dijana AI -- dan SourceCache.isHashUnchanged() (penjimat kos AI utama modul, lihat komen
// buildContentPool) sentiasa pulang `false` sebab tiada baris 'sourceHash' pernah wujud utk
// dibandingkan, jadi setiap larian berjadual panggil AI walau pool sumber tak berubah langsung.
//
// Sim ni bina skema sub-set SEBENAR (sama definisi editorial_attributes/editorial_attribute_values
// macam server.js) dalam DB buangan, uji tingkah laku SEBELUM (attributeId tak berdaftar) vs
// SELEPAS (attributeId didaftar) bagi INSERT sebenar dan gelung attributesToSave penuh.
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'scratch-sim48.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = new sqlite3.Database(dbPath);
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));

async function buatSkema() {
  await dbRun("PRAGMA foreign_keys = ON;");
  await dbRun(`CREATE TABLE editorial_objects (
    id TEXT PRIMARY KEY, type TEXT, categoryId TEXT, priority TEXT, slotIndex INTEGER,
    createdAt TEXT, updatedAt TEXT
  )`);
  await dbRun(`CREATE TABLE editorial_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, objectId TEXT, version REAL, language TEXT,
    title TEXT, summary TEXT, status TEXT, createdBy TEXT, createdAt TEXT, updatedAt TEXT,
    FOREIGN KEY(objectId) REFERENCES editorial_objects(id) ON DELETE CASCADE
  )`);
  await dbRun(`CREATE TABLE editorial_attributes (
    id TEXT PRIMARY KEY, name TEXT, valueType TEXT
  )`);
  await dbRun(`CREATE TABLE editorial_attribute_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT, objectId TEXT, revisionId INTEGER, attributeId TEXT,
    valueText TEXT,
    FOREIGN KEY(objectId) REFERENCES editorial_objects(id) ON DELETE CASCADE,
    FOREIGN KEY(attributeId) REFERENCES editorial_attributes(id) ON DELETE CASCADE
  )`);
  // Sama seed macam server.js SEBELUM pembetulan sim ni -- 'sourceHash'/'aiProvider' TIADA.
  const attrsSediaAda = ['desk', 'url', 'source', 'imageUrl', 'briefLong', 'originalDate',
    'sourceType', 'topik', 'editorName'];
  for (const id of attrsSediaAda) {
    await dbRun("INSERT INTO editorial_attributes (id, name, valueType) VALUES (?, ?, 'text')", [id, id]);
  }
}

// Tiru gelung attributesToSave EditorialPipeline.js ~baris 640-657 PERSIS (tiada try/catch
// per-item -- kegagalan mana-mana satu item menggagalkan seluruh gelung serta-merta).
async function simpanAtribut(objectId, revisionId, attributesToSave) {
  const disimpan = [];
  for (const attr of attributesToSave) {
    await dbRun(
      `INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, ?, ?)`,
      [objectId, revisionId, attr.key, attr.val]
    );
    disimpan.push(attr.key);
  }
  return disimpan;
}

async function main() {
  await buatSkema();
  const now = new Date().toISOString();
  await dbRun("INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)",
    ['object-brief-slot2-1', 'Brief', 'EKONOMI', 'Medium', 2, now, now]);
  const rev = await dbRun("INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt) VALUES (?,1.0,'ms',?,?,'approved',?,?,?)",
    ['object-brief-slot2-1', 'Tajuk Ujian', 'Ringkasan ujian', 'pipeline-slot-2', now, now]);

  const attributesToSave = [
    { key: 'sourceHash', val: 'abc123hash' },
    { key: 'desk', val: 'EKONOMI' },
    { key: 'source', val: 'Gemini AI' },
    { key: 'url', val: 'https://contoh.my/berita' },
    { key: 'aiProvider', val: 'Gemini AI' },
    { key: 'topik', val: 'Kewangan' },
    { key: 'originalDate', val: '2026-09-08' },
  ];

  console.log('=== SEBELUM PEMBETULAN (sourceHash/aiProvider tak berdaftar) ===');
  let ralatSebelum = null;
  let disimpanSebelum = [];
  try {
    disimpanSebelum = await simpanAtribut('object-brief-slot2-1', 1, attributesToSave);
  } catch (e) {
    ralatSebelum = e.message;
  }
  console.log('Ralat:', ralatSebelum || '(tiada)');
  console.log('Atribut berjaya disimpan sebelum ralat:', JSON.stringify(disimpanSebelum));

  const kiraSebelum = await dbGet("SELECT COUNT(*) as n FROM editorial_attribute_values WHERE objectId = ?", ['object-brief-slot2-1']);
  console.log('Jumlah baris tersimpan (patut 7 kalau betul):', kiraSebelum.n);

  // Cache-skip SourceCache.isHashUnchanged bergantung baris 'sourceHash' -- sahkan ia hilang.
  const bariSourceHashSebelum = await dbGet("SELECT valueText FROM editorial_attribute_values WHERE objectId LIKE ? AND attributeId = 'sourceHash' ORDER BY id DESC LIMIT 1", ['object-%-slot2-%']);
  console.log('Baris sourceHash utk cache-skip wujud?', bariSourceHashSebelum ? 'YA' : 'TIDAK (cache-skip senyap tak pernah terpakai)');

  // ---- PEMBETULAN: daftar attributeId yang hilang, sama corak macam desk/url/source dahulu ----
  console.log('\n=== SELEPAS PEMBETULAN (daftar sourceHash + aiProvider) ===');
  await dbRun("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('sourceHash', 'Cincang Sumber (Cache)', 'text')");
  await dbRun("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('aiProvider', 'Pembekal AI', 'text')");

  await dbRun("INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)",
    ['object-brief-slot2-2', 'Brief', 'EKONOMI', 'Medium', 2, now, now]);

  let ralatSelepas = null;
  let disimpanSelepas = [];
  try {
    disimpanSelepas = await simpanAtribut('object-brief-slot2-2', 1, attributesToSave);
  } catch (e) {
    ralatSelepas = e.message;
  }
  console.log('Ralat:', ralatSelepas || '(tiada)');
  console.log('Atribut berjaya disimpan:', JSON.stringify(disimpanSelepas));

  const kiraSelepas = await dbGet("SELECT COUNT(*) as n FROM editorial_attribute_values WHERE objectId = ?", ['object-brief-slot2-2']);
  console.log('Jumlah baris tersimpan (patut 7):', kiraSelepas.n);

  const bariSourceHashSelepas = await dbGet("SELECT valueText FROM editorial_attribute_values WHERE objectId LIKE ? AND attributeId = 'sourceHash' ORDER BY id DESC LIMIT 1", ['object-%-slot2-%']);
  console.log('Baris sourceHash utk cache-skip wujud?', bariSourceHashSelepas ? `YA (${bariSourceHashSelepas.valueText})` : 'TIDAK');

  const bariAiProvider = await dbGet("SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND attributeId = 'aiProvider'", ['object-brief-slot2-2']);
  console.log('Baris aiProvider tersimpan?', bariAiProvider ? `YA (${bariAiProvider.valueText})` : 'TIDAK');

  const lulus = !!ralatSebelum && disimpanSebelum.length === 0 && kiraSebelum.n === 0 && !bariSourceHashSebelum
    && !ralatSelepas && disimpanSelepas.length === 7 && kiraSelepas.n === 7 && !!bariSourceHashSelepas && !!bariAiProvider;
  console.log('\n=== KEPUTUSAN:', lulus ? 'LULUS -- pepijat sahih direproduce & pembetulan disahkan menutupnya' : 'GAGAL', '===');
  process.exit(lulus ? 0 : 1);
}

main().catch((e) => { console.error('Ralat sim:', e); process.exit(1); });
