// Sim (round #295 bug-hunt): does the OLD POST /api/system/categories/rename route (backed by
// CategoryRegistry.renameCategory(), taking oldName/newName strings) reproduce the SAME two
// bugs that were already fixed on its sibling renameActiveCategory() (used by
// POST /categories/rename-active, the one BidangConsole.tsx actually calls)?
//
//   1. Slug policy violation — Izzat's locked decision (2026-09-02, CategoryRegistry.js comment
//      above renameActiveCategory): slug is a STABLE URL key, must NEVER change on rename, so
//      shared /bidang/{slug} links never 404. renameCategory() recomputes the slug from the new
//      name and moves it — this breaks that explicit policy for ANY caller of this route.
//   2. Missing desk/manualDesk cascade — renameActiveCategory() was fixed (2026-09-08/09-11) to
//      cascade slots_config.manualDesk and editorial_attribute_values.desk so existing content
//      keeps showing on its own Halaman Bidang after a rename. renameCategory() never got this
//      fix — content vanishes from /bidang/:slug/artikel exactly like the bug that was already
//      fixed on the sibling path.
//
// This route has ZERO frontend callers (grep confirmed: only BidangConsole.tsx exists and it
// calls rename-active, never rename) but IS live, reachable, and gated only by
// requirePermission('manageEditorial') — a real, exploitable regression surface, not a
// hypothetical.
import path from 'node:path';
import { bootServer, ciptaPentadbir, login, buatKlien, bukaDb, dbRun, dbGet } from './sim-lib.mjs';

const DB = path.join(process.cwd(), 'scratch-old-rename-route.db');
const PORT = 5952;

const { proc, base } = await bootServer({ port: PORT, dbFile: DB, freshDb: true });
try {
  await ciptaPentadbir(DB);
  const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
  const api = buatKlien(base, cookie);

  const db = bukaDb(DB);
  const cat = await dbGet(db, "SELECT id, name, slug FROM CategoryRegistry WHERE isActive = 1 LIMIT 1");
  console.log('Kategori ujian:', cat);

  const objId = 'sim-obj-old-rename-route';
  const now = new Date().toISOString();
  await dbRun(db, `INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)`,
    [objId, 'Note', cat.id, 'Medium', 6, now, now]);
  const rev = await dbRun(db, `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt) VALUES (?,1.0,'ms',?,?,'approved',?,?,?)`,
    [objId, 'Tajuk ujian old-rename', 'Ringkasan ujian.', 'sim', now, now]);
  const revId = rev.lastID;
  await dbRun(db, `INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?,?,?,?)`,
    [objId, revId, 'desk', cat.name]);
  // Slot ni juga peruntukan manualDesk aktif pada Bidang tu.
  await dbRun(db, `INSERT INTO slots_config (layoutTemplateId, slotIndex, manualDesk) VALUES ('frontpage', 6, ?) ON CONFLICT(layoutTemplateId, slotIndex) DO UPDATE SET manualDesk = excluded.manualDesk`, [cat.name]);
  await new Promise(r => db.close(r));

  const sebelum = await api('GET', `/api/bidang/${cat.slug}/artikel?page=1&perPage=10`);
  console.log('SEBELUM rename -> slug:', cat.slug, 'total:', sebelum.json?.total);

  const newName = cat.name + ' Baharu';
  const renameRes = await api('POST', '/api/system/categories/rename', { oldName: cat.name, newName });
  console.log('POST /categories/rename status:', renameRes.status, renameRes.json);

  const db2 = bukaDb(DB);
  const catSelepas = await dbGet(db2, "SELECT id, name, slug FROM CategoryRegistry WHERE id = ?", [cat.id]);
  const slotSelepas = await dbGet(db2, "SELECT manualDesk FROM slots_config WHERE layoutTemplateId='frontpage' AND slotIndex=6");
  await new Promise(r => db2.close(r));
  console.log('Bidang SELEPAS rename (row DB):', catSelepas);
  console.log('slots_config.manualDesk SELEPAS rename:', slotSelepas?.manualDesk);

  const slugBerubah = catSelepas.slug !== cat.slug;
  const selepasLamaUrl = await api('GET', `/api/bidang/${cat.slug}/artikel?page=1&perPage=10`);
  const selepasBaruUrl = await api('GET', `/api/bidang/${catSelepas.slug}/artikel?page=1&perPage=10`);
  console.log('GET /bidang/<slug LAMA>/artikel SELEPAS rename -> status', selepasLamaUrl.status, 'total:', selepasLamaUrl.json?.total);
  console.log('GET /bidang/<slug BAHARU>/artikel SELEPAS rename -> status', selepasBaruUrl.status, 'total:', selepasBaruUrl.json?.total);

  console.log('\n=== KEPUTUSAN ===');
  console.log('Slug berubah (melanggar dasar "slug dikunci")? ', slugBerubah);
  console.log('manualDesk slot terus nama LAMA (tak dicascade)?', slotSelepas?.manualDesk === cat.name);
  console.log('Kandungan hilang drpd Halaman Bidang (slug baharu)?', (sebelum.json?.total || 0) > 0 && (selepasBaruUrl.json?.total || 0) === 0);
} finally {
  proc.kill();
}
