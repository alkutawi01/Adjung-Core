import express from 'express';
import { logAudit } from '../audit/AuditLog.js';

export function createTranslationRoutes(dbAll, dbRun) {
  const router = express.Router();

  // GET /api/translation/configs
  router.get('/configs', async (req, res) => {
    try {
      let configs = await dbAll("SELECT * FROM translation_configs");
      if (configs.length === 0) {
        const providers = await dbAll("SELECT id FROM ai_providers");
        const defaultProviderId = providers.length > 0 ? providers[0].id : 'gemini-1';

        const defaultLangs = [
          { code: 'zh', name: 'Cina', provider: defaultProviderId },
          { code: 'ar', name: 'Arab', provider: defaultProviderId },
          { code: 'en', name: 'Inggeris', provider: defaultProviderId }
        ];

        for (const dl of defaultLangs) {
          await dbRun(`
            INSERT INTO translation_configs (languageCode, languageName, providerId, isEnabled, createdAt, updatedAt)
            VALUES (?, ?, ?, 0, ?, ?)
          `, [dl.code, dl.name, dl.provider, new Date().toISOString(), new Date().toISOString()]);
        }
        configs = await dbAll("SELECT * FROM translation_configs");
      }
      res.json(configs);
    } catch (err) {
      console.error('Fetch translation configs error:', err);
      res.status(500).json({ error: 'Gagal membaca konfigurasi terjemahan.' });
    }
  });

  // POST /api/translation/configs
  router.post('/configs', async (req, res) => {
    try {
      const list = req.body;
      for (const item of list) {
        await dbRun(`
          INSERT OR REPLACE INTO translation_configs (languageCode, languageName, providerId, isEnabled, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [item.languageCode, item.languageName, item.providerId, item.isEnabled ? 1 : 0, item.createdAt || new Date().toISOString(), new Date().toISOString()]);
      }
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'kemas-kini-konfigurasi-terjemahan',
        targetType: 'terjemahan',
        detail: list.map((i) => i.languageCode).join(', '),
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Save translation configs error:', err);
      res.status(500).json({ error: 'Gagal menyimpan konfigurasi terjemahan.' });
    }
  });

  // DELETE /api/translation/configs/:code
  router.delete('/configs/:code', async (req, res) => {
    try {
      const { code } = req.params;
      const hasil = await dbRun("DELETE FROM translation_configs WHERE languageCode = ?", [code]);
      if (!hasil || hasil.changes === 0) {
        return res.status(404).json({ error: 'Konfigurasi bahasa tidak dijumpai.' });
      }
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'padam-konfigurasi-terjemahan',
        targetType: 'terjemahan',
        targetId: code,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Delete translation config error:', err);
      res.status(500).json({ error: 'Gagal memadam konfigurasi terjemahan.' });
    }
  });

  return router;
}
