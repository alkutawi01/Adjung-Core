import express from 'express';
import { ceilingForSlot as getGeometryCeilingForSlot } from '../editorial/GeometryConfig.js';
import { detectSourceType } from '../editorial/SourceDetector.js';
import CategoryRegistry from '../category/CategoryRegistry.js';

// Ticker Manual mode is genuinely freeform text (the Chief Editor types the whole
// desk:/title:/brief:/source:/url: block directly into a plain textarea — no client-side template
// assembly to hook into, see TickerManagementModal.tsx). Stamping "Mode: Manual" per block here,
// server-side, is the only reliable place: every block saved through THIS handler (contentMode ===
// 'Manual') was, by construction, entered manually, so this is safe to add unconditionally rather
// than needing to parse per-block intent. Mirrors parseTickerText's tolerant block-separator regex
// (core/routes/contentRoutes.js) so re-serializing here can't desync from how it'll be re-parsed.
const stampManualModeOnTickerBlocks = (rawText) => {
  if (!rawText || !rawText.trim()) return rawText;
  const blocks = rawText.split(/\n?[-_—–―]{3,}\n?/).map(b => b.trim()).filter(Boolean);
  const stamped = blocks.map(block => {
    const hasMode = block.split('\n').some(line => line.trim().toLowerCase().startsWith('mode:'));
    return hasMode ? block : `${block}\nMode: Manual`;
  });
  return stamped.join('\n____\n');
};

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

        // Bidang kini senarai tertutup kurasi Ketua Editor — sekatan keras sama macam bajet
        // aksara, bukan cuma UI dropdown yang boleh dipintas terus dari API.
        const nextDesk = (slot.manualDesk || '').trim();
        if (nextDesk) {
          const activeBidang = await CategoryRegistry.getActiveCategories(db);
          const matchesActive = activeBidang.some(c => c.name.toLowerCase() === nextDesk.toLowerCase());
          if (!matchesActive) {
            return res.status(400).json({ error: `Bidang "${nextDesk}" bukan Bidang aktif. Pilih daripada senarai Taksonomi.` });
          }
        }
        const prevRow = await dbAll("SELECT manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [slot.slotIndex]);
        const prevDesk = (prevRow[0] && prevRow[0].manualDesk) || '';

        // Hard ceiling: a slot's own had aksara can never exceed what its card geometry can
        // physically show, regardless of what the client sends — clamp before it ever reaches
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

        // Bidang slot betul-betul berubah — kandungan live/pending lama dalam slot ni tak lagi
        // sepadan Bidang terkunci baharu, arkib (status flip, bukan padam — lihat
        // archiveLiveContentInSlot) supaya tak terus terpapar dengan Bidang yang tak sah.
        if (prevDesk.toLowerCase() !== nextDesk.toLowerCase()) {
          try {
            await CategoryRegistry.archiveLiveContentInSlot(db, slot.slotIndex);
          } catch (e) {
            console.warn(`Failed to archive live content for slot ${slot.slotIndex}:`, e.message);
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
          await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [stampManualModeOnTickerBlocks(slot.manualSummary || '')]);
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
