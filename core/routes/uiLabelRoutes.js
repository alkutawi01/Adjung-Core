import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';

// Kamus Label Sistem boleh sunting (2026-08-02, Fasa 6 "Editor label & tooltip").
//
// Jadual `ui_labels` menyimpan GANTIAN sahaja — nilai LALAI kekal satu-satunya sumber di
// src/config/istilah.ts (SEMUA_LABEL_LALAI), disemai ke jadual ni sekali semasa boot pelayan
// (server.js, seedDatabase()). GET pulangkan kamus penuh kunci→nilai (gantian ATAU lalai —
// sebab jadual disemai penuh, setiap kunci sah SENTIASA ada baris); klien (istilah.ts) baca
// terus kamus ni sebagai override, bukan bandingkan dengan lalai sendiri.
export function createUiLabelRoutes(dbAll, dbRun) {
  const router = express.Router();

  router.get('/ui-labels', async (req, res) => {
    try {
      const rows = await dbAll('SELECT key, value FROM ui_labels');
      const dict = {};
      for (const r of rows || []) {
        dict[r.key] = r.value;
      }
      res.json(dict);
    } catch (err) {
      console.error('GET ui-labels error:', err);
      res.status(500).json({ error: 'Gagal membaca kamus label. ' + (err.message || '') });
    }
  });

  // Terima peta separa/penuh { kunci: nilai }, upsert setiap satu. Nilai kosong/ruang kosong
  // ditolak di sini juga (bukan cuma di klien) — label tak boleh disimpan kosong.
  router.post('/ui-labels', requirePermission('manageSettings'), async (req, res) => {
    try {
      const patch = req.body || {};
      const kunciSenarai = Object.keys(patch);
      if (kunciSenarai.length === 0) {
        return res.status(400).json({ error: 'Tiada label dihantar.' });
      }
      const now = new Date().toISOString();
      for (const kunci of kunciSenarai) {
        const nilai = String(patch[kunci] ?? '').trim();
        if (!nilai) {
          return res.status(400).json({ error: `Nilai untuk "${kunci}" tidak boleh kosong.` });
        }
        await dbRun(
          `INSERT INTO ui_labels (key, value, category, updatedAt) VALUES (?, ?, COALESCE((SELECT category FROM ui_labels WHERE key = ?), ''), ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
          [kunci, nilai, kunci, now]
        );
      }
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'kemas-kini-label-ui',
        targetType: 'label',
        detail: kunciSenarai.join(', '),
      });
      res.json({ success: true });
    } catch (err) {
      console.error('POST ui-labels error:', err);
      res.status(500).json({ error: 'Gagal menyimpan kamus label. ' + (err.message || '') });
    }
  });

  // Kembalikan SATU kunci kepada nilai lalai — buang barisnya dan tulis semula guna nilai lalai
  // yang dihantar klien (istilah.ts ialah punca kebenaran lalai; pelayan tak simpan salinan
  // kedua supaya tak ada risiko dua sumber lalai bercanggah).
  router.post('/ui-labels/reset', requirePermission('manageSettings'), async (req, res) => {
    try {
      const { key, lalai, kategori } = req.body || {};
      if (!key || typeof lalai !== 'string' || !lalai.trim()) {
        return res.status(400).json({ error: 'Kunci dan nilai lalai wajib dihantar.' });
      }
      await dbRun(
        `INSERT INTO ui_labels (key, value, category, updatedAt) VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, category = excluded.category, updatedAt = excluded.updatedAt`,
        [key, lalai, kategori || '', new Date().toISOString()]
      );
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'set-semula-label-ui',
        targetType: 'label',
        targetId: key,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('POST ui-labels/reset error:', err);
      res.status(500).json({ error: 'Gagal mengembalikan nilai lalai. ' + (err.message || '') });
    }
  });

  return router;
}

export default createUiLabelRoutes;
