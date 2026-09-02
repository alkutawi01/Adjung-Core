import express from 'express';
import { requirePermission } from '../middleware/auth.js';

export function createAiCostRoutes(dbAll, dbGet, dbRun) {
  const router = express.Router();

  // GET /api/system/ai/statistics — sama kelas pepijat seperti aiRoutes.js /logs (dapatan
  // bug-hunt 2026-09-01): TIADA gerbang kebenaran langsung pada laluan ni MAHUPUN pada
  // mount-level (server.js app.use('/api/system/ai', ...) tiada requireAuthForWrites pun,
  // tak macam kebanyakan router lain). /breakdown di bawah lagi teruk — ia pulangkan
  // ai_usage_logs.promptText/responseText PENUH bagi 10 panggilan terkini.
  router.get('/statistics', requirePermission('manageSettings'), async (req, res) => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      const todayStartIso = todayStart.toISOString();

      const usageStats = await dbGet(`
        SELECT
          COUNT(*) as totalCalls,
          SUM(promptTokens) as promptTokens,
          SUM(completionTokens) as completionTokens,
          SUM(estimatedCost) as estimatedCost
        FROM ai_usage_logs
        WHERE createdAt >= ? AND status = 'SUCCESS'
      `, [todayStartIso]);

      const schedulerSkipped = await dbGet(`
        SELECT COUNT(*) as count FROM pipeline_logs
        WHERE createdAt >= ? AND message LIKE '%Skipped by Scheduler%'
      `, [todayStartIso]);

      const sourceCacheSkipped = await dbGet(`
        SELECT COUNT(*) as count FROM pipeline_logs
        WHERE createdAt >= ? AND message LIKE '%Skipped because Source Cache%'
      `, [todayStartIso]);

      const aiCacheSkipped = await dbGet(`
        SELECT COUNT(*) as count FROM pipeline_logs
        WHERE createdAt >= ? AND (message LIKE '%Skipped because AI Cache%' OR message LIKE '%Cache HIT%')
      `, [todayStartIso]);

      // Calculate dynamic cost saved: estimate $0.005 per saved call (or prompts average)
      const totalCallsSaved = (schedulerSkipped.count || 0) + (sourceCacheSkipped.count || 0) + (aiCacheSkipped.count || 0);
      const estimatedCostSaved = totalCallsSaved * 0.0035;

      res.json({
        today: {
          totalCalls: usageStats.totalCalls || 0,
          schedulerSkipped: schedulerSkipped.count || 0,
          sourceCacheSkipped: sourceCacheSkipped.count || 0,
          aiCacheSkipped: aiCacheSkipped.count || 0,
          promptTokens: usageStats.promptTokens || 0,
          completionTokens: usageStats.completionTokens || 0,
          estimatedCost: parseFloat((usageStats.estimatedCost || 0).toFixed(4)),
          estimatedCostSaved: parseFloat(estimatedCostSaved.toFixed(4)),
          currency: 'USD'
        }
      });
    } catch (err) {
      console.error('Fetch AI statistics error:', err);
      res.status(500).json({ error: 'Gagal membaca statistik penggunaan AI.' });
    }
  });

  // GET /api/system/ai/breakdown — pulangkan `ai_usage_logs.*` (termasuk promptText/responseText
  // PENUH) bagi 10 panggilan terkini, plus kos per-pembekal/model/30-hari. Sama pembetulan
  // seperti /statistics di atas.
  router.get('/breakdown', requirePermission('manageSettings'), async (req, res) => {
    try {
      const providerBreakdown = await dbAll(`
        SELECT providerId as provider, COUNT(*) as calls, SUM(estimatedCost) as cost
        FROM ai_usage_logs
        WHERE status = 'SUCCESS'
        GROUP BY providerId
      `);

      const modelBreakdown = await dbAll(`
        SELECT providerId, modelName, COUNT(*) as calls, SUM(estimatedCost) as cost, SUM(totalTokens) as tokens, AVG(latencyMs) as avgLatency
        FROM ai_usage_logs
        WHERE status = 'SUCCESS'
        GROUP BY providerId, modelName
      `);

      const capabilityBreakdown = await dbAll(`
        SELECT capability, COUNT(*) as calls, SUM(estimatedCost) as cost, SUM(totalTokens) as tokens, AVG(latencyMs) as avgLatency
        FROM ai_usage_logs
        WHERE status = 'SUCCESS'
        GROUP BY capability
      `);

      const latestCalls = await dbAll(`
        SELECT * FROM ai_usage_logs
        ORDER BY createdAt DESC
        LIMIT 10
      `);

      const history30Days = await dbAll(`
        SELECT date(createdAt) as date, SUM(estimatedCost) as cost, COUNT(*) as calls, SUM(totalTokens) as tokens
        FROM ai_usage_logs
        WHERE status = 'SUCCESS'
        GROUP BY date(createdAt)
        ORDER BY date(createdAt) ASC
        LIMIT 30
      `);

      res.json({
        providerBreakdown,
        modelBreakdown,
        capabilityBreakdown,
        latestCalls,
        history30Days
      });
    } catch (err) {
      console.error('Fetch AI breakdown error:', err);
      res.status(500).json({ error: 'Gagal membaca pecahan data AI.' });
    }
  });

  // GET /api/system/ai/slot_costs — sama pembetulan seperti /statistics di atas.
  router.get('/slot_costs', requirePermission('manageSettings'), async (req, res) => {
    try {
      const rows = await dbAll(`
        SELECT
          COALESCE(p.slotIndex, -1) as slotIndex,
          COUNT(l.id) as aiCalls,
          SUM(l.promptTokens) as promptTokens,
          SUM(l.completionTokens) as completionTokens,
          SUM(l.estimatedCost) as tokenCost
        FROM ai_usage_logs l
        LEFT JOIN pipeline_logs p ON l.runId = p.runId AND p.slotIndex >= 0
        WHERE l.status = 'SUCCESS'
        GROUP BY p.slotIndex
        ORDER BY p.slotIndex ASC
      `);

      const slots = await dbAll("SELECT slotIndex, searchStrategy FROM slots_config WHERE layoutTemplateId = 'frontpage'");

      const breakdown = rows.map(r => {
        const slot = slots.find(s => s.slotIndex === r.slotIndex);
        const isGrounding = slot && (slot.searchStrategy === 'Search Only' || slot.searchStrategy === 'Structured Sources -> Search Fallback');

        const groundingCalls = isGrounding ? r.aiCalls : 0;
        const groundingCost = groundingCalls * 0.01;
        const totalCostUSD = r.tokenCost + groundingCost;

        return {
          slotIndex: r.slotIndex,
          aiCalls: r.aiCalls,
          groundingCalls,
          tokenCostUSD: r.tokenCost,
          groundingCostUSD: groundingCost,
          totalCostUSD
        };
      });

      res.json(breakdown);
    } catch (err) {
      console.error('Failed to fetch slot costs:', err);
      res.status(500).json({ error: 'Gagal membaca kos slot.' });
    }
  });

  // GET /api/system/ai/pricing — sama pembetulan seperti /statistics di atas (POST bersebelahan
  // sudah bergerbang, GET ni terlepas).
  router.get('/pricing', requirePermission('manageSettings'), async (req, res) => {
    try {
      const pricing = await dbAll("SELECT * FROM ai_model_pricing");
      res.json(pricing);
    } catch (err) {
      console.error('Fetch pricing error:', err);
      res.status(500).json({ error: 'Gagal membaca harga model AI.' });
    }
  });

  // POST /api/system/ai/pricing
  router.post('/pricing', requirePermission('manageSettings'), async (req, res) => {
    try {
      const items = req.body;
      const list = Array.isArray(items) ? items : [items];
      for (const item of list) {
        await dbRun(`
          INSERT OR REPLACE INTO ai_model_pricing (providerId, modelName, inputCostPerMillion, outputCostPerMillion, currency, updatedAt)
          VALUES (?, ?, ?, ?, 'USD', ?)
        `, [item.providerId, item.modelName, parseFloat(item.inputCostPerMillion || 0), parseFloat(item.outputCostPerMillion || 0), new Date().toISOString()]);
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Save pricing error:', err);
      res.status(500).json({ error: 'Gagal menyimpan harga model AI.' });
    }
  });

  return router;
}
