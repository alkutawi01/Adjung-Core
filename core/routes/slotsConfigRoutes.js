import express from 'express';
import { ceilingForSlot as getGeometryCeilingForSlot } from '../editorial/GeometryConfig.js';
import { detectSourceType } from '../editorial/SourceDetector.js';
import CategoryRegistry from '../category/CategoryRegistry.js';

// syncManualObjectsForSlot stays defined in server.js (it's a large function with its own SQL
// transaction, see Phase 1 of this session's server.js cleanup) and is passed in here rather than
// moved, since moving it would also require moving parseManualSummaryTemplate, which
// resolveSlotContent (server.js's render-time path) also depends on.
export function createSlotsConfigRoutes(db, dbAll, dbRun, syncManualObjectsForSlot) {
  const router = express.Router();

  // GET /api/system/slots
  router.get('/slots', async (req, res) => {
    try {
      const slots = await dbAll("SELECT * FROM slots_config WHERE layoutTemplateId = 'frontpage' ORDER BY slotIndex ASC");
      res.json(slots);
    } catch (err) {
      console.error('Fetch slots config error:', err);
      res.status(500).json({ error: 'Failed to fetch slots configuration.' });
    }
  });

  // POST /api/system/slots
  router.post('/slots', async (req, res) => {
    try {
      const slots = Array.isArray(req.body) ? req.body : [req.body];
      for (const slot of slots) {
        const providerId = slot.providerId && typeof slot.providerId === 'string' && slot.providerId.trim() !== '' && slot.providerId !== 'undefined' && slot.providerId !== 'null' ? slot.providerId : null;
        console.log(`Slot ${slot.slotIndex}: raw providerId = "${slot.providerId}", mapped = ${providerId}`);

        // Hard ceiling: a slot's own had aksara can never exceed what its card geometry can
        // physically show, regardless of what the client sends -- clamp before it ever reaches
        // storage, so an oversized value can't sneak in and later get copied around on re-save.
        const ceiling = getGeometryCeilingForSlot(slot.slotIndex);
        if (typeof slot.maxTitle === 'number' && slot.maxTitle > ceiling.maxTitle) slot.maxTitle = ceiling.maxTitle;
        if (typeof slot.maxBrief === 'number' && slot.maxBrief > ceiling.maxBrief) slot.maxBrief = ceiling.maxBrief;
        if (typeof slot.maxBriefLong === 'number' && slot.maxBriefLong > ceiling.maxBriefLong) slot.maxBriefLong = ceiling.maxBriefLong;
        const resolvedSourceType = slot.sourceType || detectSourceType(slot.manualUrl, `${slot.manualTitle || ''} ${slot.manualSummary || ''}`);

        await dbRun(`
          INSERT OR REPLACE INTO slots_config (
            layoutTemplateId, slotIndex, contentMode, providerId, model, promptText, sourcesList, refreshRate, allowedContentTypes, priority, expiresAt, bgColor, borderColor, textColor,
            manualTitle, manualSummary, manualSource, manualUrl, manualImageUrl, manualDesk, activeObjectId, searchStrategy, carouselInterval, carouselDelay, generationLimit, maxTitle, maxBrief, maxBriefLong, refreshHour, refreshDay, eventExpiryFilter,
            aiPromptTopic, aiPromptRecency, aiPromptLanguage, aiPromptRegion, aiPromptSource, sourceType
          ) VALUES ('frontpage', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          slot.slotIndex, slot.contentMode, providerId, slot.model, slot.promptText, slot.sourcesList, slot.refreshRate, slot.allowedContentTypes, slot.priority, slot.expiresAt, slot.bgColor, slot.borderColor, slot.textColor,
          slot.manualTitle, slot.manualSummary, slot.manualSource, slot.manualUrl, slot.manualImageUrl, slot.manualDesk, slot.activeObjectId, slot.searchStrategy || 'Structured Sources Only', slot.carouselInterval || 10, slot.carouselDelay || 0, slot.generationLimit || 1, slot.maxTitle !== undefined ? slot.maxTitle : null, slot.maxBrief !== undefined ? slot.maxBrief : null, slot.maxBriefLong !== undefined ? slot.maxBriefLong : null, slot.refreshHour || '00:00', slot.refreshDay || 'Isnin', slot.eventExpiryFilter || '',
          slot.aiPromptTopic || '', slot.aiPromptRecency || '', slot.aiPromptLanguage || '', slot.aiPromptRegion || '', slot.aiPromptSource || '', resolvedSourceType
        ]);

        if (slot.manualDesk && slot.manualDesk.trim() !== '') {
          try {
            await CategoryRegistry.incrementCategoryUsage(db, slot.manualDesk);
          } catch (e) {
            console.warn("Failed to register category:", e.message);
          }
        }

        if (slot.contentMode === 'Manual' && slot.slotIndex >= 0) {
          try {
            await syncManualObjectsForSlot(slot.slotIndex, slot.manualSummary, slot);
          } catch (e) {
            if (e.isValidationError) {
              // Hard-block: abort the whole save (not just this slot) so the admin sees exactly
              // why nothing was published, instead of a silent partial save.
              return res.status(400).json({ error: e.message });
            }
            console.warn(`Failed to sync editorial_objects for slot ${slot.slotIndex}:`, e.message);
          }
        }

        if (slot.masterPrompt !== undefined && slot.masterPrompt !== null) {
          await dbRun("UPDATE system_settings SET masterPrompt = ? WHERE id = 'settings-main'", [slot.masterPrompt]);
        }

        if (slot.slotIndex === -1 && slot.contentMode === 'Manual') {
          await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [slot.manualSummary || '']);
        }
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Save slots config error:', err);
      res.status(500).json({ error: 'Failed to save slots configuration. ' + (err.message || '') });
    }
  });

  return router;
}
