import express from 'express';
import { TIER_SLOTS, tierForSlot } from '../editorial/GeometryConfig.js';

// Penugasan editor kepada slot (2026-07-30, permintaan pemilik projek).
//
// Peraturan yang ditetapkan pemilik projek: satu slot boleh diuruskan lebih seorang editor, dan
// seorang editor boleh menguruskan lebih satu slot — jadi hubungan ni banyak-ke-banyak, satu baris
// satu pasangan.
//
// Editor sesuatu BIDANG tidak disimpan berasingan: ia DIKIRA daripada slot yang dimiliki Bidang
// itu ("editor yang diamanahkan urus slot 1 secara automatik diamanahkan jaga Bidang slot 1, dan
// sebaliknya"). Menyimpan dua senarai berasingan bermakna kedua-duanya boleh bercanggah; di sini
// ia mustahil bercanggah kerana hanya ada satu senarai.
//
// Ticker (-1) dan tier BAR tiada di sini — kedua-duanya diuruskan di Modul Khas.
const BAR_SLOTS = new Set(TIER_SLOTS.BAR);

export const createSlotEditorRoutes = (dbAll, dbRun, dbGet) => {
  const router = express.Router();

  // Semua penugasan + nama editor, sedia untuk dipaparkan terus.
  router.get('/slot-editors', async (req, res) => {
    try {
      const rows = await dbAll(`
        SELECT a.slotIndex, a.editorId, u.penName, u.username, u.role
        FROM slot_editors a
        LEFT JOIN users u ON u.id = a.editorId
        ORDER BY a.slotIndex, u.penName
      `);
      res.json((rows || []).map(r => ({
        slotIndex: r.slotIndex,
        editorId: r.editorId,
        nama: r.penName || r.username || r.editorId,
        peranan: r.role || null,
      })));
    } catch (err) {
      console.error('GET slot-editors error:', err);
      res.status(500).json({ error: 'Gagal membaca penugasan editor. ' + (err.message || '') });
    }
  });

  // Ganti SELURUH senarai editor bagi satu slot sekali gus — bukan tambah/buang satu-satu.
  // Borangnya menghantar keadaan akhir yang dikehendaki, jadi tiada keadaan separuh siap kalau
  // satu daripada beberapa panggilan gagal di tengah jalan.
  router.post('/slot-editors', async (req, res) => {
    try {
      const { slotIndex, editorIds } = req.body || {};
      const slot = Number(slotIndex);
      if (!Number.isInteger(slot) || slot < 0 || slot > 37) {
        return res.status(400).json({ error: 'Nombor slot tidak sah.' });
      }
      if (BAR_SLOTS.has(slot)) {
        return res.status(400).json({ error: `Slot ${slot + 1} ialah kad Bar — diuruskan di Modul Khas, bukan di sini.` });
      }
      if (!Array.isArray(editorIds)) {
        return res.status(400).json({ error: 'editorIds mesti senarai.' });
      }

      // Sahkan setiap editor benar-benar wujud sebelum menulis apa-apa — id yatim dalam jadual ni
      // akan muncul sebagai baris tanpa nama dalam senarai slot, tanpa cara membetulkannya.
      const unik = [...new Set(editorIds.filter(Boolean))];
      for (const id of unik) {
        const ada = await dbGet('SELECT id FROM users WHERE id = ?', [id]);
        if (!ada) return res.status(400).json({ error: `Editor tidak dijumpai: ${id}` });
      }

      await dbRun('DELETE FROM slot_editors WHERE slotIndex = ?', [slot]);
      const now = new Date().toISOString();
      for (const id of unik) {
        await dbRun(
          'INSERT OR IGNORE INTO slot_editors (slotIndex, editorId, createdAt) VALUES (?, ?, ?)',
          [slot, id, now]
        );
      }
      res.json({ success: true, slotIndex: slot, editorIds: unik, tier: tierForSlot(slot) });
    } catch (err) {
      console.error('POST slot-editors error:', err);
      res.status(500).json({ error: 'Gagal menyimpan penugasan editor. ' + (err.message || '') });
    }
  });

  return router;
};

export default createSlotEditorRoutes;
