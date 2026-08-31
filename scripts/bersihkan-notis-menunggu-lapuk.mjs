// Pembersihan SEKALI SAHAJA (2026-08-28) — notis 'kandungan_menunggu_kelulusan' lapuk yang
// tercipta SEBELUM pembetulan (contentRoutes.js kini panggil selesaikanMenungguKelulusan() pada
// setiap laluan yang bawa kandungan keluar dari 'pending'). Notis LAMA yang tercipta sebelum
// pembetulan ni tak pernah lalui laluan baharu tu, jadi kekal isRead=0 walau kandungan dah lama
// disiar/ditolak/diarkib — script ni cuma tanda notis MACAM TU dibaca (bukan padam), sekali sahaja.
//
// Jalankan (CLAUDE.md prinsip 4 — tiada backup DB boleh dipercayai, backup dulu):
//   cp adjung.db adjung.db.backup-$(date +%s)
//   node scripts/bersihkan-notis-menunggu-lapuk.mjs           # dry-run, papar sahaja
//   node scripts/bersihkan-notis-menunggu-lapuk.mjs --tulis   # tulis sebenar

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'adjung.db');
const tulisSebenar = process.argv.includes('--tulis');

const db = new sqlite3.Database(dbPath);
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
});

const stale = await all(`
  SELECT n.id, n.targetId, n.detail, n.createdAt
  FROM notifications n
  WHERE n.type = 'kandungan_menunggu_kelulusan'
    AND n.isRead = 0
    AND NOT EXISTS (
      SELECT 1 FROM editorial_revisions r
      WHERE r.objectId = n.targetId AND r.status = 'pending'
        AND r.version = (SELECT MAX(version) FROM editorial_revisions WHERE objectId = n.targetId)
    )
`);

console.log(`${stale.length} notis "menunggu kelulusan" lapuk (kandungan dah bukan 'pending' lagi):`);
stale.forEach((r) => console.log(`  ${r.id} targetId=${r.targetId} createdAt=${r.createdAt} — ${r.detail}`));

if (!tulisSebenar) {
  console.log('\nDry-run sahaja. Jalankan semula dengan --tulis untuk tanda notis ni dibaca.');
  db.close();
} else {
  const ids = stale.map((r) => r.id);
  if (ids.length) {
    await run(`UPDATE notifications SET isRead = 1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    console.log(`\n${ids.length} notis ditanda dibaca.`);
  } else {
    console.log('\nTiada apa perlu dibersihkan.');
  }
  db.close();
}
