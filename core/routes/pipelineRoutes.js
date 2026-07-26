import express from 'express';
import { validateContentBudget } from '../editorial/ContentBudget.js';
import CategoryRegistry from '../category/CategoryRegistry.js';

// Thin route wrappers around runEditorialPipeline/runAllScheduledSlots -- those stay defined in
// server.js since the internal 5-minute scheduler also calls them directly, so they're passed in
// here rather than moved.
export function createPipelineRoutes(db, dbGet, dbRun, runEditorialPipeline, runAllScheduledSlots) {
  const router = express.Router();

  // POST /api/system/pipeline/batch_paste
  router.post('/pipeline/batch_paste', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Text content is empty.' });
      }

      let parsedItems = [];

      // 1. Try direct JSON parsing
      try {
        const rawJson = text.trim();
        const data = JSON.parse(rawJson);
        parsedItems = Array.isArray(data) ? data : [data];
      } catch (e) {
        // 2. Try to extract JSON blocks
        const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
        let match;
        while ((match = jsonBlockRegex.exec(text)) !== null) {
          try {
            const data = JSON.parse(match[1].trim());
            if (Array.isArray(data)) parsedItems.push(...data);
            else parsedItems.push(data);
          } catch (e2) {}
        }
      }

      // 3. Fallback Regex Parsing (untuk teks biasa berbilang kandungan per slot)
      if (parsedItems.length === 0) {
        const slotBlocks = text.split(/(?:Slot\s*#?\s*|SlotIndex\s*[:=]?\s*)(\d+)/i);
        for (let idx = 1; idx < slotBlocks.length; idx += 2) {
          const slotNum = parseInt(slotBlocks[idx], 10) - 1; // Tukar kepada 0-based
          const blockContent = slotBlocks[idx + 1] || '';

          // Pecahkan mengikut pembahagi --- atau ___ atau lookahead "Tajuk"
          const articleBlocks = blockContent.split(/(?:---|___)+/).flatMap(b => b.split(/(?=Tajuk\s*[:=])/i));

          for (const artBlock of articleBlocks) {
            if (!artBlock.trim()) continue;

            const titleMatch = artBlock.match(/(?:Tajuk)\s*[:=]?\s*([^\n]+)/i);
            const summaryMatch = artBlock.match(/(?:Summary|Brief|Ringkasan|Huraian)\s*[:=]?\s*([\s\S]*?)(?:\n\n|\nTajuk|\nKategori|\nPautan|$)/i);
            const categoryMatch = artBlock.match(/(?:Category|Kategori|Desk|Topik)\s*[:=]?\s*([A-Za-z]+)/i);
            const urlMatch = artBlock.match(/(?:Source|URL|Pautan)\s*[:=]?\s*(https?:\/\/[^\s\n]+)/i);

            if (titleMatch && slotNum >= 0 && slotNum < 38) {
              parsedItems.push({
                slotIndex: slotNum,
                title: titleMatch[1].trim(),
                summary: summaryMatch ? summaryMatch[1].trim().replace(/\s+/g, ' ').trim() : '',
                category: categoryMatch ? categoryMatch[1].trim().toUpperCase() : 'UMUM',
                source_url: urlMatch ? urlMatch[1].trim() : '#'
              });
            }
          }
        }
      }

      if (parsedItems.length === 0) {
        return res.status(400).json({ error: 'Failed to parse any valid news slot data from the pasted text.' });
      }

      // Same hard-block as the per-slot manual save: every slot of the same geometry tier is
      // validated by the exact same budget rule (core/editorial/ContentBudget.js). Validate the
      // whole batch before writing anything, so one oversized item doesn't leave a partial paste.
      for (const item of parsedItems) {
        const slotIdx = item.slotIndex !== undefined ? parseInt(item.slotIndex, 10) : -1;
        if (slotIdx < 0 || slotIdx >= 38) continue;
        const budgetCheck = validateContentBudget(slotIdx, item.title, item.summary);
        if (!budgetCheck.isValid) {
          return res.status(400).json({ error: `Slot ${slotIdx + 1} -- "${(item.title || '').slice(0, 40)}...": ${budgetCheck.reason}` });
        }
      }

      const timestamp = new Date().toISOString();
      const results = [];

      // Same transaction wrapping as syncManualObjectsForSlot: a whole batch of pasted items is one
      // multi-table write. If one item's INSERT throws partway through, roll back everything written
      // so far in this request instead of leaving a partial batch committed.
      await dbRun('BEGIN TRANSACTION');
      try {
        for (const item of parsedItems) {
          const slotIdx = item.slotIndex !== undefined ? parseInt(item.slotIndex, 10) : -1;
          if (slotIdx < 0 || slotIdx >= 38) continue;

          const objectId = `object-manual-slot${slotIdx}-${Date.now()}`;
          const finalTitle = item.title ? item.title.trim() : '';
          const finalSummary = item.summary ? item.summary.trim() : '';
          const finalCategory = item.category ? item.category.trim().toUpperCase() : 'UMUM';
          const finalUrl = item.source_url || '#';

          if (!finalTitle) continue;

          try {
            await CategoryRegistry.incrementCategoryUsage(db, finalCategory);
          } catch (e) {
            console.warn("Failed to register category:", e.message);
          }

          await dbRun(`
            INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, createdAt, updatedAt)
            VALUES (?, 'Brief', ?, 'Medium', ?, ?, ?)
          `, [objectId, finalCategory, slotIdx, timestamp, timestamp]);

          const revResult = await dbRun(`
            INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
            VALUES (?, 1.0, 'ms', ?, ?, 'approved', 'batch-paste', ?, ?)
          `, [objectId, finalTitle, finalSummary, timestamp, timestamp]);
          const revisionId = revResult.lastID || 1;

          const attributes = [
            { key: 'desk', val: finalCategory },
            { key: 'url', val: finalUrl },
            { key: 'source', val: 'ChatGPT/Gemini Manual Paste' }
          ];

          for (const attr of attributes) {
            await dbRun(`
              INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText)
              VALUES (?, ?, ?, ?)
            `, [objectId, revisionId, attr.key, attr.val]);
          }

          await dbRun("UPDATE slots_config SET activeObjectId = ? WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [objectId, slotIdx]);

          results.push({ slotIndex: slotIdx, title: finalTitle });
        }
        await dbRun('COMMIT');
      } catch (e) {
        try {
          await dbRun('ROLLBACK');
        } catch (rollbackErr) {
          console.error('Rollback failed after batch_paste error:', rollbackErr.message);
        }
        throw e;
      }

      res.json({ success: true, count: results.length, items: parsedItems });
    } catch (err) {
      console.error('Batch paste error:', err);
      res.status(500).json({ error: 'Failed to process batch paste data. ' + err.message });
    }
  });

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
