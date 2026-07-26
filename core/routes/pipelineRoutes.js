import express from 'express';

// Thin route wrappers around runEditorialPipeline/runAllScheduledSlots -- those stay defined in
// server.js since the internal 5-minute scheduler also calls them directly, so they're passed in
// here rather than moved.
export function createPipelineRoutes(dbGet, dbRun, runEditorialPipeline, runAllScheduledSlots) {
  const router = express.Router();

  // POST /api/system/pipeline/run
  router.post('/pipeline/run', async (req, res) => {
    const currentRunId = `run-${Date.now()}`;

    try {
      const { slotIndex, force = false } = req.body;

      if (slotIndex !== undefined) {
        const slot = await dbGet("SELECT * FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [slotIndex]);
        if (!slot) {
          return res.status(404).json({ error: 'Slot not found.' });
        }

        const result = await runEditorialPipeline(slotIndex, currentRunId);
        if (result && result.objectId) {
          await dbRun("UPDATE slots_config SET activeObjectId = ? WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [result.objectId, slotIndex]);
          return res.json({ success: true, objectId: result.objectId, status: result.status });
        } else {
          return res.status(400).json({ error: 'Failed to run pipeline (slot might be disabled).' });
        }
      } else {
        const { runId, results, stats } = await runAllScheduledSlots(force);
        return res.json({ success: true, runId, results, stats });
      }
    } catch (err) {
      console.error('Run pipeline error:', err);
      res.status(500).json({ error: 'Failed to run editorial pipeline. ' + (err.message || '') });
    }
  });

  // POST /api/system/slots/run-now
  router.post('/slots/run-now', async (req, res) => {
    const { slotIndex } = req.body;
    if (slotIndex === undefined || slotIndex === null) {
      return res.status(400).json({ error: 'Missing slotIndex parameter.' });
    }

    try {
      const currentRunId = `manual-run-${Date.now()}`;
      const result = await runEditorialPipeline(slotIndex, currentRunId, true);
      if (result) {
        if (result.status === 'CACHE_HIT' || result.status === 'SUCCESS') {
          if (result.objectId) {
            await dbRun("UPDATE slots_config SET activeObjectId = ? WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [result.objectId, slotIndex]);
          }
          return res.json({ success: true, status: result.status, message: 'Berjaya diaktifkan!' });
        } else {
          return res.status(400).json({ error: result.message || 'Penjanaan gagal.' });
        }
      }
      res.status(400).json({ error: 'Gagal menjalankan pipeline.' });
    } catch (err) {
      console.error('Run slot now error:', err);
      res.status(500).json({ error: err.message || 'Ralat pelayan.' });
    }
  });

  return router;
}
