// Sim: does renaming an active Bidang (rename-active) orphan existing approved content from
// its own /api/bidang/:slug/artikel listing?
import path from 'node:path';
import { bootServer, ciptaPentadbir, login, buatKlien, bukaDb, dbRun, dbGet } from './sim-lib.mjs';

const DB = path.join(process.cwd(), 'scratch-bidang-rename.db');
const PORT = 5951;

const { proc, base } = await bootServer({ port: PORT, dbFile: DB, freshDb: true });
try {
  await ciptaPentadbir(DB);
  const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
  const api = buatKlien(base, cookie);

  const db = bukaDb(DB);
  // Cari satu kategori aktif sedia ada (seed semasa boot)
  const cat = await dbGet(db, "SELECT id, name, slug FROM CategoryRegistry WHERE isActive = 1 LIMIT 1");
  console.log('Kategori ujian:', cat);

  // Cipta objek + revisi approved + attribute desk = nama SEMASA kategori tu.
  const objId = 'sim-obj-bidang-rename';
  const now = new Date().toISOString();
  await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)`,
    [objId, 'Note', cat.id, 'Medium', 5, now, now]);
  const rev = await dbRun(db, `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt) VALUES (?,1.0,'ms',?,?,'approved',?,?,?)`,
    [objId, 'Tajuk ujian rename Bidang', 'Ringkasan ujian.', 'sim', now, now]);
  const revId = rev.lastID;
  await dbRun(db, `INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?,?,?,?)`,
    [objId, revId, 'desk', cat.name]);
  await new Promise(r => db.close(r));

  // Sebelum rename: artikel patut kelihatan di /bidang/:slug/artikel
  const sebelum = await api('GET', `/api/bidang/${cat.slug}/artikel?page=1&perPage=10`);
  console.log('SEBELUM rename -> total:', sebelum.json?.total, 'artikel count:', sebelum.json?.artikel?.length);

  // Namakan semula Bidang (rename-active) — slug KEKAL sama.
  const newName = cat.name + ' Baharu';
  const renameRes = await api('POST', '/api/system/categories/rename-active', { id: cat.id, newName });
  console.log('rename-active status:', renameRes.status, renameRes.json);

  const selepas = await api('GET', `/api/bidang/${cat.slug}/artikel?page=1&perPage=10`);
  console.log('SELEPAS rename -> total:', selepas.json?.total, 'artikel count:', selepas.json?.artikel?.length);

  if ((sebelum.json?.total || 0) > 0 && (selepas.json?.total || 0) === 0) {
    console.log('BUG DISAHKAN: kandungan lama hilang dari Halaman Bidang selepas rename-active walau slug KEKAL sama.');
  } else {
    console.log('Tiada bug ditemui pada laluan ni.');
  }
} finally {
  proc.kill();
}
