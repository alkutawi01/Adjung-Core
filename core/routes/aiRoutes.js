import express from 'express';

export function createAIRoutes(dbAll, dbRun) {
  const router = express.Router();

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
