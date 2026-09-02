import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';

export function createAIRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  // GET /api/ai/providers — DAHULU tiada requireAuth langsung (2026-08-08, dapatan audit
  // keselamatan ChatGPT P2-02) — laluan POST bersebelahan dah dikunci (nota di bawah) tapi GET
  // ni terlepas, dedah secretName/model/budget/status kepada sesiapa tanpa log masuk.
  router.get('/providers', requirePermission('manageSettings'), async (req, res) => {
    try {
      const providers = await dbAll("SELECT id, name, secretName, model, monthlyBudget, dailyBudget, status, lastTest, enabled FROM ai_providers");
      res.json(providers);
    } catch (err) {
      console.error('Fetch providers error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai penyedia AI.' });
    }
  });

  // POST /api/ai/providers — DAHULU tiada langsung requireAuth/requirePermission (2026-08-06,
  // ditemui semasa audit log audit), berbeza daripada hampir semua laluan tulis lain dalam
  // sistem — sesiapa yang tahu URL boleh tulis-ganti konfigurasi provider AI (termasuk pointer
  // secretName API key) tanpa log masuk langsung. Kini dikunci sama seperti tetapan lain.
  router.post('/providers', requirePermission('manageSettings'), async (req, res) => {
    try {
      const p = req.body;
      await dbRun(`
        INSERT OR REPLACE INTO ai_providers (id, name, secretName, model, monthlyBudget, dailyBudget, status, lastTest, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [p.id, p.name, p.secretName, p.model, p.monthlyBudget, p.dailyBudget, p.status, p.lastTest, p.enabled ? 1 : 0]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'kemas-kini-ai-provider',
        targetType: 'ai-provider',
        targetId: p.id,
        detail: p.name,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Save provider error:', err);
      res.status(500).json({ error: 'Gagal menyimpan penyedia AI.' });
    }
  });

  // POST /api/ai/test-provider
  router.post('/test-provider', requirePermission('manageSettings'), async (req, res) => {
    try {
      const { id } = req.body;
      const prov = await dbGet("SELECT * FROM ai_providers WHERE id = ?", [id]);
      if (!prov) {
        return res.status(404).json({ error: 'Penyedia AI tidak dijumpai.' });
      }
      const apiKey = process.env[prov.secretName] || '';
      const success = apiKey.length > 0;
      const statusText = success ? 'Connected' : 'Missing API Key';
      const lastTest = new Date().toISOString();

      await dbRun("UPDATE ai_providers SET status = ?, lastTest = ? WHERE id = ?", [statusText, lastTest, id]);
      res.json({ success, status: statusText, lastTest });
    } catch (err) {
      console.error('Test provider error:', err);
      res.status(500).json({ error: 'Gagal menguji sambungan penyedia AI.' });
    }
  });

  // GET /api/ai/prompts — sama pembetulan seperti /providers di atas (2026-08-08, ChatGPT P2-02).
  router.get('/prompts', requirePermission('manageSettings'), async (req, res) => {
    try {
      const prompts = await dbAll("SELECT * FROM prompt_templates");
      res.json(prompts);
    } catch (err) {
      console.error('Fetch prompts error:', err);
      res.status(500).json({ error: 'Gagal membaca templat prompt.' });
    }
  });

  // POST /api/ai/prompts — sama gerbang keselamatan seperti /providers di atas.
  router.post('/prompts', requirePermission('manageSettings'), async (req, res) => {
    try {
      const p = req.body;
      await dbRun(`
        INSERT OR REPLACE INTO prompt_templates (id, name, templateText, version, updatedAt)
        VALUES (?, ?, ?, ?, ?)
      `, [p.id, p.name, p.templateText, p.version, new Date().toISOString()]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'kemas-kini-templat-prompt-ai',
        targetType: 'prompt-ai',
        targetId: p.id,
        detail: p.name,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Save prompt error:', err);
      res.status(500).json({ error: 'Gagal menyimpan templat prompt.' });
    }
  });

  // GET /api/ai/logs — sama kelas pepijat seperti /providers dan /prompts di atas (2026-08-08,
  // ChatGPT P2-02), tapi terlepas pandang semasa pembetulan asal tu (dapatan bug-hunt 2026-09-01).
  // Tanpa gerbang ni, sesiapa di internet boleh baca pipeline_logs (mesej/status setiap larian AI
  // per slot) tanpa log masuk.
  router.get('/logs', requirePermission('manageSettings'), async (req, res) => {
    try {
      const logs = await dbAll("SELECT * FROM pipeline_logs ORDER BY createdAt DESC LIMIT 100");
      res.json(logs);
    } catch (err) {
      console.error('Fetch pipeline logs error:', err);
      res.status(500).json({ error: 'Gagal membaca log pipeline.' });
    }
  });

  // GET /api/ai/logs/:slotIndex — sama pepijat, sama pembetulan seperti /logs di atas. Jadual
  // ai_usage_logs bawa `promptText`/`responseText` PENUH (prompt & jawapan AI sebenar) dan
  // estimatedCost — data operasi dalaman, bukan untuk paparan awam.
  router.get('/logs/:slotIndex', requirePermission('manageSettings'), async (req, res) => {
    try {
      const slotIdx = parseInt(req.params.slotIndex, 10);
      const logs = await dbAll(`
        SELECT l.*, p.slotIndex
        FROM ai_usage_logs l
        JOIN pipeline_logs p ON l.runId = p.runId
        WHERE p.slotIndex = ?
        ORDER BY l.createdAt DESC
        LIMIT 5
      `, [slotIdx]);
      res.json(logs);
    } catch (err) {
      console.error('Fetch slot AI logs error:', err);
      res.status(500).json({ error: 'Gagal membaca log AI bagi slot ini.' });
    }
  });

  return router;
}
