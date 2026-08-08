import express from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { safeJsonParse } from '../utils/jsonUtils.js';

// Rupa Editorium (2026-08-08, permintaan pemilik projek — "buat satu tempat di mana pentadbir
// boleh laraskan saiz font dan UI lain di editorium supaya tak perlu bantuan awak selalu untuk
// laraskan"). SATU dokumen JSON global (bukan per-editor — keputusan Izzat), disuntik sebagai
// CSS custom properties pada `.editorium-root` (src/index.css) oleh EditoriumLayout.tsx. Laluan
// ni HANYA untuk kakitangan log masuk (bukan portal awam) — tiada sebab pelawat perlu tahu
// tetapan UI dalaman konsol pentadbiran.
const LALAI = {
  textMikro: 9, textKecil: 10, textLabel: 11, textBadan: 12, textMedan: 13,
  textSederhana: 15, textTajuk: 18, textTajukBesar: 20, textTajukUtama: 24,
  kepadatan: 1, lebarMaks: 'none',
};

export function createEditoriumUiPrefsRoutes(dbRun, dbGet) {
  const router = express.Router();

  router.get('/editorium-ui-prefs', requireAuth, async (req, res) => {
    try {
      const baris = await dbGet("SELECT json FROM editorium_ui_prefs WHERE id = 'global'");
      const prefs = baris ? { ...LALAI, ...safeJsonParse(baris.json, {}) } : LALAI;
      res.json(prefs);
    } catch (err) {
      console.error('GET editorium-ui-prefs error:', err);
      res.status(500).json({ error: 'Gagal membaca tetapan rupa Editorium.' });
    }
  });

  router.post('/editorium-ui-prefs', requirePermission('manageSettings'), async (req, res) => {
    try {
      const gabung = { ...LALAI, ...(req.body || {}) };
      await dbRun(
        `INSERT INTO editorium_ui_prefs (id, json, updatedAt) VALUES ('global', ?, ?)
         ON CONFLICT(id) DO UPDATE SET json = excluded.json, updatedAt = excluded.updatedAt`,
        [JSON.stringify(gabung), new Date().toISOString()]
      );
      res.json({ success: true, prefs: gabung });
    } catch (err) {
      console.error('POST editorium-ui-prefs error:', err);
      res.status(500).json({ error: 'Gagal menyimpan tetapan rupa Editorium.' });
    }
  });

  return router;
}

export default createEditoriumUiPrefsRoutes;
