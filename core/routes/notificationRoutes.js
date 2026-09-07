import express from 'express';
import { requireAuth } from '../middleware/auth.js';

// Notifikasi (2026-08-02, Fasa 6b) — laluan BACA/tanda-dibaca untuk jadual `notifications`
// PER-EDITOR (lihat core/notifications/Notify.js untuk laluan TULIS/cipta). Peti Makluman
// (MaklumanDrawer.tsx) gabungkan senarai ni dengan `editor_notes` (Nota Ketua Editor, sedia ada)
// jadi satu senarai — laluan ni cuma pulangkan bahagian `notifications` sahaja.
export function createNotificationRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  const barisKepadaNotifikasi = (r) => ({
    id: r.id,
    jenis: r.type,
    tajuk: r.title,
    kandungan: r.detail || '',
    sasaranJenis: r.targetType,
    sasaranId: r.targetId,
    dibaca: r.isRead === 1,
    dibuatPada: r.createdAt,
  });

  // GET /api/system/notifications — senarai notifikasi PENGGUNA SEDANG LOG MASUK sahaja (bukan
  // milik akaun lain — setiap editor hanya nampak notisnya sendiri).
  router.get('/system/notifications', requireAuth, async (req, res) => {
    try {
      const rows = await dbAll(
        `SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 200`,
        [req.session.user.id]
      );
      res.json((rows || []).map(barisKepadaNotifikasi));
    } catch (err) {
      console.error('GET notifications error:', err);
      res.status(500).json({ error: 'Gagal membaca notifikasi. ' + (err.message || '') });
    }
  });

  // GET /api/system/notifications/unread-count — lencana header. PER-EDITOR (bukan kiraan
  // global) — inilah bug yang ditutup di Fasa 6b (lihat PELAN_PRA_LAUNCH.md Lampiran A).
  router.get('/system/notifications/unread-count', requireAuth, async (req, res) => {
    try {
      const row = await dbGet(
        `SELECT COUNT(*) AS cnt FROM notifications WHERE userId = ? AND isRead = 0`,
        [req.session.user.id]
      );
      res.json({ count: row ? row.cnt : 0 });
    } catch (err) {
      console.error('GET notifications unread-count error:', err);
      res.status(500).json({ error: 'Gagal membaca kiraan notifikasi. ' + (err.message || '') });
    }
  });

  // POST /api/system/notifications/mark-read — tanda SATU (id dihantar), SATU KUMPULAN
  // ('sistem'/'editorial', param `kumpulan`) atau SEMUA (tiada id/kumpulan) notis pengguna
  // semasa sebagai dibaca. Hanya baris milik SENDIRI boleh disentuh — WHERE userId sentiasa
  // ikut sesi, bukan medan dihantar pelanggan.
  //
  // `kumpulan` ditambah 2026-09-08 (dapatan bug-hunt) — Peti Makluman (MaklumanDrawer.tsx) ada
  // DUA tab (Editorial/Sistem) tapi laci cuma papar SATU pada satu masa; EditoriumView.tsx dahulu
  // panggil laluan ni TANPA `id` bila laci ditutup, menandakan SEMUA notis (kedua-dua tab)
  // dibaca — walau editor cuma sempat lihat SATU tab sebelum tutup. Ini melanggar kontrak "Lencana
  // = janji" (CLAUDE.md, Peti Makluman): lencana bell utk tab yang TAK dilihat hilang senyap tanpa
  // editor pernah nampak notis baharu tu. Klien kini hantar `kumpulan` ikut tab yang BENAR-BENAR
  // dilihat sepanjang laci terbuka (boleh satu atau kedua-dua); laluan ni tandakan SETEPAT itu.
  // `type` diawali `sistem_` utk kategori Sistem (lihat isNotifikasiSistem, MaklumanDrawer.tsx) —
  // `_` ialah wildcard LIKE, WAJIB escape (corak sama searchRoutes.js/failMuatNaik.js).
  router.post('/system/notifications/mark-read', requireAuth, async (req, res) => {
    try {
      const { id, kumpulan } = req.body || {};
      if (id) {
        await dbRun(`UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?`, [id, req.session.user.id]);
      } else if (kumpulan === 'sistem') {
        await dbRun(
          `UPDATE notifications SET isRead = 1 WHERE userId = ? AND isRead = 0 AND type LIKE 'sistem\\_%' ESCAPE '\\'`,
          [req.session.user.id]
        );
      } else if (kumpulan === 'editorial') {
        await dbRun(
          `UPDATE notifications SET isRead = 1 WHERE userId = ? AND isRead = 0 AND type NOT LIKE 'sistem\\_%' ESCAPE '\\'`,
          [req.session.user.id]
        );
      } else {
        await dbRun(`UPDATE notifications SET isRead = 1 WHERE userId = ? AND isRead = 0`, [req.session.user.id]);
      }
      res.json({ success: true });
    } catch (err) {
      console.error('POST notifications mark-read error:', err);
      res.status(500).json({ error: 'Gagal menanda notifikasi dibaca. ' + (err.message || '') });
    }
  });

  // DELETE /api/system/notifications/:id — padam SATU notifikasi (2026-08-16, Izzat: "inbox
  // saya masih belum dibersihkan... takde cara ke nak delete kandungan secara manual?").
  // Sebelum ni cuma tanda-dibaca wujud, tiada laluan buang baris terus. Hanya baris milik SENDIRI
  // boleh dipadam — WHERE userId sentiasa ikut sesi, sama corak macam mark-read di atas.
  router.delete('/system/notifications/:id', requireAuth, async (req, res) => {
    try {
      await dbRun(`DELETE FROM notifications WHERE id = ? AND userId = ?`, [req.params.id, req.session.user.id]);
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE notifications/:id error:', err);
      res.status(500).json({ error: 'Gagal memadam notifikasi. ' + (err.message || '') });
    }
  });

  return router;
}

export default createNotificationRoutes;
