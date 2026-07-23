import express from 'express';

export function createAIRoutes(dbAll, dbRun) {
  const router = express.Router();

  // GET /api/ai/providers
  router.get('/providers', async (req, res) => {
    try {
      const providers = await dbAll("SELECT id, name, secretName, model, monthlyBudget, dailyBudget, status, lastTest, enabled FROM ai_providers");
      res.json(providers);
    } catch (err) {
      console.error('Fetch providers error:', err);
      res.status(500).json({ error: 'Failed to fetch providers.' });
    }
  });

  // POST /api/ai/providers
  router.post('/providers', async (req, res) => {
    try {
      const p = req.body;
      await dbRun(`
        INSERT OR REPLACE INTO ai_providers (id, name, secretName, model, monthlyBudget, dailyBudget, status, lastTest, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [p.id, p.name, p.secretName, p.model, p.monthlyBudget, p.dailyBudget, p.status, p.lastTest, p.enabled ? 1 : 0]);
      res.json({ success: true });
    } catch (err) {
      console.error('Save provider error:', err);
      res.status(500).json({ error: 'Failed to save provider.' });
    }
  });

  // GET /api/ai/logs
  router.get('/logs', async (req, res) => {
    try {
      const logs = await dbAll("SELECT * FROM pipeline_logs ORDER BY createdAt DESC LIMIT 100");
      res.json(logs);
    } catch (err) {
      console.error('Fetch pipeline logs error:', err);
      res.status(500).json({ error: 'Failed to fetch pipeline logs.' });
    }
  });

  // GET /api/ai/logs/:slotIndex
  router.get('/logs/:slotIndex', async (req, res) => {
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
      res.status(500).json({ error: 'Failed to fetch AI logs for slot.' });
    }
  });

  return router;
}
