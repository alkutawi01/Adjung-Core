import express from 'express';
import CategoryRegistry from '../category/CategoryRegistry.js';
import { parseRssXml, filterByLanguage, deduplicateRssItems } from '../sources/RssDirectEngine.js';
import { calculateEditorialScore } from '../sources/EditorialScoreEngine.js';
import { processTextWithTrace, normalizeEditorialText } from '../sources/EditorialTextNormalizer.js';
import { calculateDeskScores, classifyDesk } from '../sources/DeskClassifier.js';
import { parseTypographyTokens } from '../sources/TypographyRulesEngine.js';
import { requirePermission } from '../middleware/auth.js';
import { gantiBlokModTicker } from './contentRoutes.js';
import { logAudit } from '../audit/AuditLog.js';
import { notifyMany } from '../notifications/Notify.js';

// Notifikasi Sistem (Fasa 6b) — RSS/cuaca gagal ditujukan kepada Pentadbir/Ketua Editor sahaja
// (mereka yang boleh bertindak ke atas kegagalan infrastruktur, bukan setiap editor biasa).
async function beritahuPentadbirDanKetuaEditor(dbAll, dbRun, payload) {
  const rows = await dbAll("SELECT DISTINCT userId FROM user_roles WHERE roleId IN ('pentadbir', 'ketua_editor')");
  await notifyMany(dbRun, (rows || []).map((r) => r.userId), payload);
}

// NOTE: this router used to also define GET/POST /slots and POST /slots/run-now, plus a whole
// "Slot Governance" section (SlotGovernanceService + 4 routes at /api/slot-governance*,
// /api/slot-ownerships). All of that was dead code: server.js registers its own (more complete,
// e.g. it actually clamps to the real geometry ceiling and updates activeObjectId) handlers for
// the same paths earlier in the file, so Express never reached any of these. The governance
// section was additionally backed entirely by mock data (a fake in-memory DB stub, hardcoded
// "Chief Editor Izzat" as every mandate owner) with zero real frontend callers. Removed rather
// than fixed — see core/db/legacy_slot_mapping.js removal in the same change.
export function createSlotRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  // GET /api/system/rss-sources
  router.get('/rss-sources', async (req, res) => {
    try {
      const sources = await dbAll("SELECT * FROM rss_sources_registry ORDER BY createdAt DESC");
      res.json(sources);
    } catch (err) {
      console.error('Fetch RSS sources error:', err);
      res.status(500).json({ error: 'Failed to fetch RSS sources.' });
    }
  });

  // POST /api/system/rss-sources
  router.post('/rss-sources', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id, sourceName, rssUrl, language, trustScore, edition, categoryMapping, enabled } = req.body;
      const sourceId = id || `rss-${Date.now()}`;
      await dbRun(`
        INSERT OR REPLACE INTO rss_sources_registry (id, sourceName, rssUrl, language, trustScore, edition, categoryMapping, enabled, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [sourceId, sourceName, rssUrl, language || 'ms-MY', trustScore || 80, edition || 'Malaysia', categoryMapping || 'BERITA', enabled !== undefined ? enabled : 1, new Date().toISOString()]);
      res.json({ success: true, id: sourceId });
    } catch (err) {
      console.error('Save RSS source error:', err);
      res.status(500).json({ error: 'Failed to save RSS source.' });
    }
  });

  // DELETE /api/system/rss-sources/:id
  router.delete('/rss-sources/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      await dbRun("DELETE FROM rss_sources_registry WHERE id = ?", [id]);
      res.json({ success: true, id });
    } catch (err) {
      console.error('Delete RSS source error:', err);
      res.status(500).json({ error: 'Failed to delete RSS source.' });
    }
  });

  // GET /api/system/ticker/review-queue
  router.get('/ticker/review-queue', async (req, res) => {
    try {
      const items = await dbAll("SELECT * FROM rss_ticker_items WHERE status = 'pending' ORDER BY publishedAt DESC LIMIT 50");
      res.json(items);
    } catch (err) {
      console.error('Fetch review queue error:', err);
      res.status(500).json({ error: 'Failed to fetch review queue.' });
    }
  });

  // GET /api/system/ticker/status
  router.get('/ticker/status', async (req, res) => {
    try {
      const activeSourcesRow = await dbGet("SELECT COUNT(*) as cnt FROM rss_sources_registry WHERE enabled = 1");
      const autoLiveRow = await dbGet("SELECT COUNT(*) as cnt FROM rss_ticker_items WHERE status = 'approved'");
      const pendingReviewRow = await dbGet("SELECT COUNT(*) as cnt FROM rss_ticker_items WHERE status = 'pending'");
      const totalFetchedRow = await dbGet("SELECT COUNT(*) as cnt FROM rss_ticker_items");

      res.json({
        success: true,
        activeSourcesCount: activeSourcesRow ? activeSourcesRow.cnt : 0,
        totalFetchedCount: totalFetchedRow ? totalFetchedRow.cnt : 0,
        autoLiveCount: autoLiveRow ? autoLiveRow.cnt : 0,
        pendingReviewCount: pendingReviewRow ? pendingReviewRow.cnt : 0
      });
    } catch (err) {
      console.error('Fetch ticker status error:', err);
      res.status(500).json({ error: 'Failed to fetch ticker status.' });
    }
  });

  // POST /api/system/ticker/review-action
  router.post('/ticker/review-action', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { itemId, action } = req.body; // action: 'approve' | 'reject'
      if (!itemId || !action) return res.status(400).json({ error: 'Missing itemId or action' });
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      await dbRun("UPDATE rss_ticker_items SET status = ? WHERE id = ?", [newStatus, itemId]);
      res.json({ success: true, itemId, status: newStatus });
    } catch (err) {
      console.error('Review action error:', err);
      res.status(500).json({ error: 'Failed to update item status.' });
    }
  });

  // GET /api/system/rss-settings
  router.get('/rss-settings', async (req, res) => {
    try {
      let settings = await dbGet("SELECT * FROM rss_editorial_settings WHERE id = 'main'");
      if (!settings) {
        settings = {
          id: 'main',
          autoLiveThreshold: 80,
          reviewThreshold: 60,
          priorityKeywords: 'dasar, belanjawan, ekonomi, pendidikan, menteri, kerajaan',
          blockedKeywords: 'gempar, viral, panas, terbongkar',
          priorityBonus: 15,
          blockedPenalty: 40,
          updatedAt: new Date().toISOString()
        };
      }
      res.json(settings);
    } catch (err) {
      console.error('Fetch RSS settings error:', err);
      res.status(500).json({ error: 'Failed to fetch RSS settings.' });
    }
  });

  // POST /api/system/rss-settings
  router.post('/rss-settings', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { autoLiveThreshold, reviewThreshold, priorityKeywords, blockedKeywords, priorityBonus, blockedPenalty, maxNewsAgeHours, tickerMaxItems } = req.body;
      const updatedAt = new Date().toISOString();
      const limitVal = Number(tickerMaxItems) || 20;

      await dbRun(`
        INSERT OR REPLACE INTO rss_editorial_settings (
          id, autoLiveThreshold, reviewThreshold, priorityKeywords, blockedKeywords, priorityBonus, blockedPenalty, maxNewsAgeHours, tickerMaxItems, updatedAt
        ) VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        Number(autoLiveThreshold) || 80,
        Number(reviewThreshold) || 60,
        priorityKeywords || '',
        blockedKeywords || '',
        Number(priorityBonus) || 15,
        Number(blockedPenalty) || 40,
        maxNewsAgeHours !== undefined ? Number(maxNewsAgeHours) : 48,
        limitVal,
        updatedAt
      ]);

      // Retroactive Purge & Filter of newly blocked keywords on existing approved ticker items
      const blockedList = (blockedKeywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      if (blockedList.length > 0) {
        const approvedItems = await dbAll("SELECT * FROM rss_ticker_items WHERE status = 'approved'");
        for (const item of approvedItems) {
          const textLower = `${item.title || ''} ${item.description || ''} ${item.formattedBrief || ''}`.toLowerCase();
          const isBlocked = blockedList.some(kw => textLower.includes(kw));
          if (isBlocked) {
            await dbRun("UPDATE rss_ticker_items SET status = 'rejected' WHERE id = ?", [item.id]);
          }
        }
      }

      // Re-generate live ticker string ordered by HIGHEST SCORE first!
      const newApproved = await dbAll(`SELECT * FROM rss_ticker_items WHERE status = 'approved' ORDER BY score DESC, publishedAt DESC LIMIT ${limitVal}`);
      // Kunci Title:/Brief: (bukan Tajuk:/Huraian ringkas:) padan parseTickerText & laluan RSS-Direct
      // yang lain (baris ~915 di fail ni) — kunci Melayu lama diam-diam gugurkan tajuk/huraian bila
      // dihurai. displayCategory padan pengiraan sama di laluan tu jugak (bukan Desk: SEMASA tegar).
      const blocks = newApproved.map(item => {
        const displayCategory = (item.category === 'BELUM DIKELASKAN' || !item.category) ? 'SEMASA' : item.category;
        return { desk: displayCategory, title: item.title, brief: item.formattedBrief || item.description || '', source: item.source, url: item.originalUrl, mode: 'RSS Direct' };
      });
      const settingsSemasa = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
      const formattedText = gantiBlokModTicker(settingsSemasa ? settingsSemasa.inTheNewsText : '', 'RSS Direct', blocks);
      await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [formattedText]);

      res.json({ success: true });
    } catch (err) {
      console.error('Save RSS settings error:', err);
      res.status(500).json({ error: 'Failed to save RSS settings.' });
    }
  });

  // GET /api/system/rss-text-rules
  router.get('/rss-text-rules', async (req, res) => {
    try {
      const rules = await dbAll("SELECT * FROM rss_text_rules ORDER BY orderIndex ASC, createdAt ASC");
      res.json(rules);
    } catch (err) {
      console.error('Fetch RSS text rules error:', err);
      res.status(500).json({ error: 'Failed to fetch RSS text rules.' });
    }
  });

  // POST /api/system/rss-text-rules
  router.post('/rss-text-rules', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { ruleName, ruleType, scope, sourceId, pattern, replacement, enabled, orderIndex } = req.body;
      const id = `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const createdAt = new Date().toISOString();

      await dbRun(`
        INSERT INTO rss_text_rules (
          id, ruleName, ruleType, scope, sourceId, pattern, replacement, enabled, locked, orderIndex, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `, [
        id,
        ruleName || 'Peraturan Baharu',
        ruleType || 'substitute',
        scope || 'brief',
        sourceId || null,
        pattern || '',
        replacement || '',
        enabled !== undefined ? (enabled ? 1 : 0) : 1,
        Number(orderIndex) || 10,
        createdAt
      ]);

      res.json({ success: true, id });
    } catch (err) {
      console.error('Create RSS text rule error:', err);
      res.status(500).json({ error: 'Failed to create RSS text rule.' });
    }
  });

  // PUT /api/system/rss-text-rules/:id
  router.put('/rss-text-rules/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const { ruleName, ruleType, scope, sourceId, pattern, replacement, enabled, orderIndex } = req.body;

      const existing = await dbGet("SELECT * FROM rss_text_rules WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Rule not found' });

      // If rule is locked, only allow reordering or enabling/disabling
      const isLocked = existing.locked === 1;

      await dbRun(`
        UPDATE rss_text_rules SET
          ruleName = ?,
          ruleType = ?,
          scope = ?,
          sourceId = ?,
          pattern = ?,
          replacement = ?,
          enabled = ?,
          orderIndex = ?
        WHERE id = ?
      `, [
        isLocked ? existing.ruleName : (ruleName !== undefined ? ruleName : existing.ruleName),
        isLocked ? existing.ruleType : (ruleType !== undefined ? ruleType : existing.ruleType),
        scope !== undefined ? scope : existing.scope,
        sourceId !== undefined ? sourceId : existing.sourceId,
        isLocked ? existing.pattern : (pattern !== undefined ? pattern : existing.pattern),
        isLocked ? existing.replacement : (replacement !== undefined ? replacement : existing.replacement),
        enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        orderIndex !== undefined ? Number(orderIndex) : existing.orderIndex,
        id
      ]);

      res.json({ success: true });
    } catch (err) {
      console.error('Update RSS text rule error:', err);
      res.status(500).json({ error: 'Failed to update RSS text rule.' });
    }
  });

  // DELETE /api/system/rss-text-rules/:id
  router.delete('/rss-text-rules/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await dbGet("SELECT * FROM rss_text_rules WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Rule not found' });
      if (existing.locked === 1) {
        return res.status(400).json({ error: 'Peraturan asas (System Rule) tidak boleh dipadam.' });
      }

      await dbRun("DELETE FROM rss_text_rules WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Delete RSS text rule error:', err);
      res.status(500).json({ error: 'Failed to delete RSS text rule.' });
    }
  });

  // POST /api/system/rss-text-rules/test (Transformation Trace Tester!)
  router.post('/rss-text-rules/test', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { testText, scope, sourceId, customRule } = req.body;
      let rules = await dbAll("SELECT * FROM rss_text_rules ORDER BY orderIndex ASC, createdAt ASC");
      
      if (customRule && customRule.ruleType) {
        rules = [...rules, { ...customRule, id: 'custom-temp', enabled: 1, orderIndex: 999 }];
      }

      const testResult = processTextWithTrace(testText || '', scope || 'brief', sourceId || null, rules);
      res.json({ success: true, ...testResult });
    } catch (err) {
      console.error('Test RSS text rules error:', err);
      res.status(500).json({ error: 'Failed to test RSS text rules.' });
    }
  });

  // --- ADJUNG DESKS REGISTRY ENDPOINTS ---

  // GET /api/system/adjung-desks
  router.get('/adjung-desks', async (req, res) => {
    try {
      const desks = await dbAll("SELECT * FROM adjung_desks ORDER BY displayOrder ASC, createdAt ASC");
      res.json(desks);
    } catch (err) {
      console.error('Fetch adjung desks error:', err);
      res.status(500).json({ error: 'Failed to fetch Adjung desks.' });
    }
  });

  // POST /api/system/adjung-desks
  router.post('/adjung-desks', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { deskName, description, displayOrder } = req.body;
      if (!deskName || !deskName.trim()) {
        return res.status(400).json({ error: 'Sila masukkan Nama Desk.' });
      }
      const id = `desk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const createdAt = new Date().toISOString();

      await dbRun(`
        INSERT INTO adjung_desks (id, deskName, description, displayOrder, enabled, locked, createdAt)
        VALUES (?, ?, ?, ?, 1, 0, ?)
      `, [id, deskName.trim(), description || '', Number(displayOrder) || 10, createdAt]);

      res.json({ success: true, id });
    } catch (err) {
      console.error('Create adjung desk error:', err);
      res.status(500).json({ error: err.message.includes('UNIQUE') ? 'Nama Desk ini sudah wujud.' : 'Failed to create Adjung desk.' });
    }
  });

  // PUT /api/system/adjung-desks/:id
  router.put('/adjung-desks/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const { deskName, description, displayOrder, enabled } = req.body;
      const existing = await dbGet("SELECT * FROM adjung_desks WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Desk not found' });

      await dbRun(`
        UPDATE adjung_desks SET
          deskName = ?,
          description = ?,
          displayOrder = ?,
          enabled = ?
        WHERE id = ?
      `, [
        deskName !== undefined ? deskName.trim() : existing.deskName,
        description !== undefined ? description : existing.description,
        displayOrder !== undefined ? Number(displayOrder) : existing.displayOrder,
        enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        id
      ]);

      res.json({ success: true });
    } catch (err) {
      console.error('Update adjung desk error:', err);
      res.status(500).json({ error: 'Failed to update Adjung desk.' });
    }
  });

  // DELETE /api/system/adjung-desks/:id
  router.delete('/adjung-desks/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await dbGet("SELECT * FROM adjung_desks WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Desk not found' });

      await dbRun("DELETE FROM adjung_desks WHERE id = ?", [id]);
      // Delete associated desk rules
      await dbRun("DELETE FROM rss_desk_rules WHERE deskId = ?", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Delete adjung desk error:', err);
      res.status(500).json({ error: 'Failed to delete Adjung desk.' });
    }
  });

  // --- RSS DESK RULES ENDPOINTS ---

  // GET /api/system/rss-desk-rules
  router.get('/rss-desk-rules', async (req, res) => {
    try {
      const rules = await dbAll("SELECT * FROM rss_desk_rules ORDER BY orderIndex ASC, createdAt ASC");
      res.json(rules);
    } catch (err) {
      console.error('Fetch RSS desk rules error:', err);
      res.status(500).json({ error: 'Failed to fetch RSS desk rules.' });
    }
  });

  // POST /api/system/rss-desk-rules
  router.post('/rss-desk-rules', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { deskId, keyword, weight, isNegative, enabled, orderIndex } = req.body;
      if (!deskId || !keyword || !keyword.trim()) {
        return res.status(400).json({ error: 'Sila pilih Desk dan masukkan Kata Kunci.' });
      }
      const id = `drule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const createdAt = new Date().toISOString();

      await dbRun(`
        INSERT INTO rss_desk_rules (id, deskId, keyword, weight, isNegative, enabled, orderIndex, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        deskId,
        keyword.trim(),
        Number(weight) || 15,
        isNegative ? 1 : 0,
        enabled !== undefined ? (enabled ? 1 : 0) : 1,
        Number(orderIndex) || 10,
        createdAt
      ]);

      res.json({ success: true, id });
    } catch (err) {
      console.error('Create RSS desk rule error:', err);
      res.status(500).json({ error: 'Failed to create RSS desk rule.' });
    }
  });

  // PUT /api/system/rss-desk-rules/:id
  router.put('/rss-desk-rules/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const { deskId, keyword, weight, isNegative, enabled, orderIndex } = req.body;
      const existing = await dbGet("SELECT * FROM rss_desk_rules WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Desk rule not found' });

      await dbRun(`
        UPDATE rss_desk_rules SET
          deskId = ?,
          keyword = ?,
          weight = ?,
          isNegative = ?,
          enabled = ?,
          orderIndex = ?
        WHERE id = ?
      `, [
        deskId !== undefined ? deskId : existing.deskId,
        keyword !== undefined ? keyword.trim() : existing.keyword,
        weight !== undefined ? Number(weight) : existing.weight,
        isNegative !== undefined ? (isNegative ? 1 : 0) : existing.isNegative,
        enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        orderIndex !== undefined ? Number(orderIndex) : existing.orderIndex,
        id
      ]);

      res.json({ success: true });
    } catch (err) {
      console.error('Update RSS desk rule error:', err);
      res.status(500).json({ error: 'Failed to update RSS desk rule.' });
    }
  });

  // DELETE /api/system/rss-desk-rules/:id
  router.delete('/rss-desk-rules/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      await dbRun("DELETE FROM rss_desk_rules WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Delete RSS desk rule error:', err);
      res.status(500).json({ error: 'Failed to delete RSS desk rule.' });
    }
  });

  // POST /api/system/rss-desk-rules/test (Desk Classifier Live Tester!)
  router.post('/rss-desk-rules/test', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { testTitle, testBrief, testCategory } = req.body;
      const desks = await dbAll("SELECT * FROM adjung_desks WHERE enabled = 1 ORDER BY displayOrder ASC");
      const rules = await dbAll("SELECT * FROM rss_desk_rules WHERE enabled = 1 ORDER BY orderIndex ASC");

      const combinedText = `${testTitle || ''} ${testBrief || ''}`;
      const classificationResult = calculateDeskScores(combinedText, testCategory || '', rules, desks);
      res.json({ success: true, ...classificationResult });
    } catch (err) {
      console.error('Test RSS desk rules error:', err);
      res.status(500).json({ error: 'Failed to test RSS desk rules.' });
    }
  });

  // PUT /api/system/ticker/override-desk/:id (Manual Editor Override with Passive Editorial Memory)
  router.put('/ticker/override-desk/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const { newDesk } = req.body;
      if (!newDesk || !newDesk.trim()) {
        return res.status(400).json({ error: 'Sila pilih Desk baharu.' });
      }

      const item = await dbGet("SELECT * FROM rss_ticker_items WHERE id = ?", [id]);
      if (item) {
        // Extract 2-3 key words from title for memory suggestion
        const titleWords = (item.title || '')
          .replace(/[^\w\s]/gi, '')
          .split(/\s+/)
          .filter(w => w.length > 4)
          .slice(0, 2)
          .join(' ')
          .toLowerCase();

        if (titleWords) {
          const memId = `mem-${Date.now()}`;
          const now = new Date().toISOString();
          await dbRun(`
            INSERT INTO rss_editorial_memory (id, rssItemId, phraseExtracted, suggestedDesk, occurrenceCount, status, createdAt)
            VALUES (?, ?, ?, ?, 1, 'pending', ?)
          `, [memId, id, titleWords, newDesk.trim(), now]);
        }
      }

      await dbRun("UPDATE rss_ticker_items SET category = ? WHERE id = ?", [newDesk.trim(), id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Override ticker desk error:', err);
      res.status(500).json({ error: 'Failed to override ticker desk.' });
    }
  });

  // GET /api/system/editorial-memory
  router.get('/editorial-memory', async (req, res) => {
    try {
      const memories = await dbAll("SELECT * FROM rss_editorial_memory WHERE status = 'pending' ORDER BY createdAt DESC LIMIT 20");
      res.json(memories);
    } catch (err) {
      console.error('Fetch editorial memory error:', err);
      res.status(500).json({ error: 'Failed to fetch editorial memory.' });
    }
  });

  // POST /api/system/editorial-memory/promote
  router.post('/editorial-memory/promote', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { memoryId, deskName, phrase } = req.body;
      if (!memoryId || !deskName || !phrase) {
        return res.status(400).json({ error: 'Sila lengkapkan maklumat memori.' });
      }

      const desk = await dbGet("SELECT * FROM adjung_desks WHERE deskName = ?", [deskName]);
      if (!desk) {
        return res.status(400).json({ error: 'Desk tidak wujud.' });
      }

      const ruleId = `rule-mem-${Date.now()}`;
      const now = new Date().toISOString();

      await dbRun(`
        INSERT INTO rss_desk_rules (id, deskId, keyword, weight, isNegative, enabled, orderIndex, createdAt)
        VALUES (?, ?, ?, 40, 0, 1, 10, ?)
      `, [ruleId, desk.id, phrase.trim().toLowerCase(), now]);

      await dbRun("UPDATE rss_editorial_memory SET status = 'promoted' WHERE id = ?", [memoryId]);

      res.json({ success: true, ruleId });
    } catch (err) {
      console.error('Promote memory error:', err);
      res.status(500).json({ error: 'Failed to promote memory suggestion.' });
    }
  });

  // GET /api/system/rss-blocked-categories
  router.get('/rss-blocked-categories', async (req, res) => {
    try {
      const categories = await dbAll("SELECT * FROM rss_blocked_categories ORDER BY createdAt DESC");
      res.json(categories);
    } catch (err) {
      console.error('Fetch blocked categories error:', err);
      res.status(500).json({ error: 'Failed to fetch blocked categories.' });
    }
  });

  // POST /api/system/rss-blocked-categories
  router.post('/rss-blocked-categories', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { categoryName } = req.body;
      if (!categoryName || !categoryName.trim()) {
        return res.status(400).json({ error: 'Sila masukkan nama Kategori.' });
      }

      const id = `blk-${Date.now()}`;
      const now = new Date().toISOString();
      await dbRun(`
        INSERT INTO rss_blocked_categories (id, categoryName, enabled, createdAt)
        VALUES (?, ?, 1, ?)
      `, [id, categoryName.trim(), now]);

      res.json({ success: true, id });
    } catch (err) {
      console.error('Add blocked category error:', err);
      res.status(500).json({ error: 'Failed to add blocked category.' });
    }
  });

  // DELETE /api/system/rss-blocked-categories/:id
  router.delete('/rss-blocked-categories/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      await dbRun("DELETE FROM rss_blocked_categories WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Delete blocked category error:', err);
      res.status(500).json({ error: 'Failed to delete blocked category.' });
    }
  });

  // GET /api/system/ticker/blocked-queue (Visual Audit Trail of Blocked News)
  router.get('/ticker/blocked-queue', async (req, res) => {
    try {
      const items = await dbAll("SELECT * FROM rss_ticker_items WHERE status = 'blocked_category' ORDER BY createdAt DESC LIMIT 50");
      res.json(items);
    } catch (err) {
      console.error('Fetch blocked queue error:', err);
      res.status(500).json({ error: 'Failed to fetch blocked queue.' });
    }
  });

  // GET /api/system/adjung-typography-rules
  router.get('/adjung-typography-rules', async (req, res) => {
    try {
      const rules = await dbAll("SELECT * FROM adjung_typography_rules ORDER BY priority DESC, term ASC");
      res.json(rules);
    } catch (err) {
      console.error('Fetch typography rules error:', err);
      res.status(500).json({ error: 'Failed to fetch typography rules.' });
    }
  });

  // POST /api/system/adjung-typography-rules
  router.post('/adjung-typography-rules', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { term, style, category, matchType, scope, language, caseSensitive, priority, status, excludeTerms } = req.body;
      if (!term || !term.trim()) {
        return res.status(400).json({ error: 'Sila masukkan Istilah.' });
      }

      const id = `typo-${Date.now()}`;
      const now = new Date().toISOString();
      const exclStr = Array.isArray(excludeTerms) ? JSON.stringify(excludeTerms) : (excludeTerms || null);

      await dbRun(`
        INSERT INTO adjung_typography_rules (
          id, term, style, category, matchType, scope, language, caseSensitive, priority, status, enabled, excludeTerms, ruleVersion, createdBy, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Chief Editor', ?, ?)
      `, [
        id, term.trim(), style || 'italic', category || 'foreign_term',
        matchType || 'word', scope || 'all', language || 'ms-MY',
        caseSensitive ? 1 : 0, Number(priority) || 50,
        status || 'active', (status === 'pending' || status === 'rejected' || status === 'archived') ? 0 : 1,
        exclStr, now, now
      ]);

      res.json({ success: true, id });
    } catch (err) {
      console.error('Create typography rule error:', err);
      res.status(500).json({ error: 'Failed to create typography rule. Pastikan istilah/bahasa/skop belum didaftarkan.' });
    }
  });

  // PUT /api/system/adjung-typography-rules/:id
  router.put('/adjung-typography-rules/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const { term, style, category, matchType, scope, language, caseSensitive, priority, status, enabled, excludeTerms } = req.body;
      const existing = await dbGet("SELECT * FROM adjung_typography_rules WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Typography rule not found' });

      const now = new Date().toISOString();
      const newVersion = (Number(existing.ruleVersion) || 1) + 1;
      const exclStr = Array.isArray(excludeTerms) ? JSON.stringify(excludeTerms) : (excludeTerms !== undefined ? excludeTerms : existing.excludeTerms);

      await dbRun(`
        UPDATE adjung_typography_rules SET
          term = ?, style = ?, category = ?, matchType = ?, scope = ?, language = ?,
          caseSensitive = ?, priority = ?, status = ?, enabled = ?, excludeTerms = ?,
          ruleVersion = ?, updatedAt = ?
        WHERE id = ?
      `, [
        term !== undefined ? term.trim() : existing.term,
        style !== undefined ? style : existing.style,
        category !== undefined ? category : existing.category,
        matchType !== undefined ? matchType : existing.matchType,
        scope !== undefined ? scope : existing.scope,
        language !== undefined ? language : existing.language,
        caseSensitive !== undefined ? (caseSensitive ? 1 : 0) : existing.caseSensitive,
        priority !== undefined ? Number(priority) : existing.priority,
        status !== undefined ? status : existing.status,
        enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        exclStr,
        newVersion, now, id
      ]);

      res.json({ success: true, id, newVersion });
    } catch (err) {
      console.error('Update typography rule error:', err);
      res.status(500).json({ error: 'Failed to update typography rule.' });
    }
  });

  // DELETE /api/system/adjung-typography-rules/:id
  router.delete('/adjung-typography-rules/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      await dbRun("DELETE FROM adjung_typography_rules WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Delete typography rule error:', err);
      res.status(500).json({ error: 'Failed to delete typography rule.' });
    }
  });

  // POST /api/system/adjung-typography-rules/preview (Live Typography Sandbox Preview)
  router.post('/adjung-typography-rules/preview', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { testText, scope, language } = req.body;
      const rules = await dbAll("SELECT * FROM adjung_typography_rules WHERE enabled = 1 AND status = 'active' ORDER BY priority DESC");
      const tokens = parseTypographyTokens(testText || '', rules, scope || 'all', language || 'ms-MY');
      res.json({ success: true, tokens });
    } catch (err) {
      console.error('Preview typography error:', err);
      res.status(500).json({ error: 'Failed to preview typography.' });
    }
  });

  // POST /api/system/ticker/fetch-direct
  router.post('/ticker/fetch-direct', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const result = await executeDirectRssFetch(dbAll, dbGet, dbRun);
      res.json(result);
    } catch (err) {
      console.error('Fetch direct RSS ticker error:', err);
      res.status(500).json({ error: 'Failed to fetch direct RSS ticker.' });
    }
  });

  // GET /api/system/editorial-calibration/export-txt (ACEF v1.0)
  router.get('/system/editorial-calibration/export-txt', async (req, res) => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const sampleItems = [
        { id: '10542', timestamp: '2026-07-23 08:22', source: 'Bernama', title: 'PDRM tahan tiga suspek pemalsuan pasport biometrik di KLIA', brief: 'Polis menahan tiga individu yang disyaki terlibat dalam sindiket pemalsuan dokumen perjalanan antarabangsa.', rssCategory: 'Semasa', proposedDesk: 'Nasional', score: 84, confidenceRating: 'HIGH', secondaryDesk: 'Politik', status: 'REVIEW' },
        { id: '10543', timestamp: '2026-07-23 09:15', source: 'Kosmo!', title: 'NASA menemui exoplanet mempunyai atmosfera air luar sistem suria', brief: 'Teleskop Angkasa James Webb merekodkan spektrum atmosfera planet ekstrasolar LHS 1140b.', rssCategory: 'Sains', proposedDesk: 'Sains & Teknologi', score: 92, confidenceRating: 'HIGH', secondaryDesk: 'Astronomi', status: 'REVIEW' },
        { id: '10544', timestamp: '2026-07-23 10:00', source: 'Sinar Harian', title: 'Bangunan MPKJ, INTI College berlaku gegaran luar biasa', brief: 'Laporan awal merekodkan pergerakan struktur di kawasan sekitar namun skop disiplin belum disahkan enjin.', rssCategory: 'Kultur', proposedDesk: 'BELUM DIKELASKAN', score: 41, confidenceRating: 'LOW', secondaryDesk: 'Pendidikan', status: 'REVIEW' },
        { id: '10545', timestamp: '2026-07-23 10:45', source: 'Utusan Malaysia', title: 'Arab Saudi perkenal visa umrah baharu kemudahan jemaah antarabangsa', brief: 'Kementerian Haji dan Umrah Arab Saudi mengumumkan pelancaran platform sistem visa umrah elektronik baharu.', rssCategory: 'Antarabangsa', proposedDesk: 'Pelancongan', score: 65, confidenceRating: 'MEDIUM', secondaryDesk: 'Ibadah', status: 'REVIEW' }
      ];

      const headerBanner = `ADJUNG CALIBRATION EXCHANGE FORMAT (ACEF) v1.0\nTarikh Penjanaan: ${new Date().toLocaleString()}\nJumlah Berita: ${sampleItems.length}\n\n`;

      const blocks = sampleItems.map(item => (
        `==================================================\n\n` +
        `RSS_ID          : ${item.id}\n` +
        `DATE            : ${item.timestamp}\n` +
        `SOURCE          : ${item.source}\n\n` +
        `TITLE           : ${item.title}\n\n` +
        `BRIEF           : ${item.brief}\n\n` +
        `RSS_CATEGORY    : ${item.rssCategory}\n\n` +
        `SYSTEM_DESK     : ${item.proposedDesk}\n` +
        `SYSTEM_SCORE    : ${item.score}\n` +
        `CONFIDENCE      : ${item.confidenceRating}\n` +
        `SECONDARY_DESK  : ${item.secondaryDesk}\n\n` +
        `STATUS          : ${item.status}\n`
      ));

      const fullTxt = headerBanner + blocks.join('\n') + `\n==================================================\n`;

      res.setHeader('Content-Type', 'text/plain;charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="adjung_editorial_calibration_dataset_${todayStr}.txt"`);
      res.send(fullTxt);
    } catch (err) {
      console.error('Export TXT error:', err);
      res.status(500).send('Export error');
    }
  });

  return router;
}

export async function executeDirectRssFetch(dbAll, dbGet, dbRun) {
  const activeSources = await dbAll("SELECT * FROM rss_sources_registry WHERE enabled = 1");
  const textRules = await dbAll("SELECT * FROM rss_text_rules WHERE enabled = 1 ORDER BY orderIndex ASC");
  const desks = await dbAll("SELECT * FROM adjung_desks WHERE enabled = 1 ORDER BY displayOrder ASC");
  const deskRules = await dbAll("SELECT * FROM rss_desk_rules WHERE enabled = 1 ORDER BY orderIndex ASC");
  const globalExclusions = await dbAll("SELECT * FROM rss_global_exclusion_rules WHERE enabled = 1");
  const blockedCategories = await dbAll("SELECT * FROM rss_blocked_categories WHERE enabled = 1");

  let editorialSettings = await dbGet("SELECT * FROM rss_editorial_settings WHERE id = 'main'");
  if (!editorialSettings) {
    editorialSettings = {
      autoLiveThreshold: 80,
      reviewThreshold: 60,
      priorityKeywords: 'dasar, belanjawan, ekonomi, pendidikan, menteri, kerajaan',
      blockedKeywords: 'gempar, viral, panas, terbongkar',
      priorityBonus: 15,
      blockedPenalty: 40
    };
  }

  await Promise.allSettled(activeSources.map(async (source) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s max wait per source

      const response = await fetch(source.rssUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) return;
      const xmlText = await response.text();
      const parsedItems = parseRssXml(xmlText);
      const maxAgeHours = editorialSettings.maxNewsAgeHours !== undefined ? Number(editorialSettings.maxNewsAgeHours) : 48;

      for (const item of parsedItems) {
        if (!filterByLanguage(item, source.language || 'ms-MY')) continue;

        // 1. Raw XML RSS Category Pre-Filter
        const rawCategory = (item.category || '').trim();
        const isCategoryBlocked = blockedCategories.some(b => {
          const bName = (b.categoryName || '').toLowerCase().trim();
          return bName && rawCategory.toLowerCase().includes(bName);
        });

        if (isCategoryBlocked) {
          const itemId = `item-blk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          try {
            await dbRun(`
              INSERT OR IGNORE INTO rss_ticker_items (
                id, rssGuid, title, formattedBrief, source, originalUrl, category, publishedAt, score, scoreBreakdown, deskBreakdown, decision, status, createdAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'BLOCKED_CATEGORY', 'blocked_category', ?)
            `, [
              itemId, item.rssGuid || itemId, item.title, item.formattedBrief || item.description || item.title,
              source.sourceName, item.link || '#', rawCategory || 'DISEKAT',
              item.publishedAt || new Date().toISOString(),
              JSON.stringify({ reason: `Kategori XML RSS '${rawCategory}' berada dalam senarai Kategori Tersekat Editor.` }),
              JSON.stringify({ winningDesk: 'DISEKAT', publicCategory: 'DISEKAT', explanation: `Kategori XML RSS '${rawCategory}' disekat secara automatik.` }),
              new Date().toISOString()
            ]);
          } catch (e) {}
          continue;
        }

        // 2. Freshness Filter
        if (maxAgeHours > 0 && item.publishedAt) {
          const itemTime = new Date(item.publishedAt).getTime();
          if (!isNaN(itemTime)) {
            const ageInHours = (Date.now() - itemTime) / (1000 * 60 * 60);
            if (ageInHours > maxAgeHours) {
              continue;
            }
          }
        }

        // 3. Editorial Text Rules Engine
        const cleanedTitle = normalizeEditorialText(item.title, 'title', source.id, textRules);
        const cleanedBrief = normalizeEditorialText(item.formattedBrief || item.description || item.title, 'brief', source.id, textRules);

        // 4. Desk Classification & Score Engine
        const scoreItem = { ...item, title: cleanedTitle, formattedBrief: cleanedBrief };
        const deskClassification = classifyDesk(scoreItem, deskRules, desks, globalExclusions);
        const assignedDesk = deskClassification.winningDesk || source.categoryMapping || 'SEMASA';

        const scoreResult = calculateEditorialScore(scoreItem, source, editorialSettings);
        const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        try {
          await dbRun(`
            INSERT OR IGNORE INTO rss_ticker_items (
              id, rssGuid, title, formattedBrief, briefTruncated, source, originalUrl, category, rawCategory, publishedAt, score, scoreBreakdown, deskBreakdown, secondaryDesk, secondaryScore, decision, status, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            itemId, item.rssGuid, cleanedTitle, cleanedBrief, item.briefTruncated ? 1 : 0,
            source.sourceName, item.link, assignedDesk, rawCategory || 'TIADA TAG',
            item.publishedAt, scoreResult.score, JSON.stringify(scoreResult.scoreBreakdown),
            JSON.stringify(deskClassification),
            deskClassification.secondaryDesk,
            deskClassification.secondaryScore || 0,
            scoreResult.decision, scoreResult.status, new Date().toISOString()
          ]);
          // Limpahan teks (2026-08-02, Fasa 8) — "tiada pemotongan mekanikal senyap" (Perlembagaan):
          // pemotongan 220 aksara KEKAL (Ticker satu baris, keputusan Izzat), tapi kini dicatat
          // supaya boleh disemak/dipanjangkan semula, bukan hilang senyap terus. Hanya log item
          // yang benar-benar AUTO_LIVE (bukan setiap item ditolak/disekat — bunyi bising tak
          // bermakna untuk item yang tak pernah siar pun).
          if (item.briefTruncated && scoreResult.decision === 'AUTO_LIVE') {
            await logAudit(dbRun, {
              actorName: 'RSS Direct (automatik)',
              action: 'rss-huraian-dipendekkan',
              targetType: 'rss_ticker_item',
              targetId: itemId,
              detail: `${source.sourceName}: "${cleanedTitle}" — huraian dipendekkan pada 220 aksara semasa auto-siar Ticker.`,
            });
          }
        } catch (dbErr) {
          console.error(`[RSS DB Insert Error] Source '${source.sourceName}':`, dbErr.message);
        }
      }
    } catch (fetchErr) {
      // 2026-08-02 (Fasa 4) — dahulu ralat ambilan RSS ditelan senyap sepenuhnya (komen "Gracefully
      // skip" di atas) — feed yang MATI tak dapat dibezakan langsung dengan feed yang memang
      // SUNYI (tiada berita baharu). Catat ke Log Audit supaya kegagalan berterusan kelihatan.
      await logAudit(dbRun, {
        action: 'ralat-ambilan-rss',
        targetType: 'rss_source',
        targetId: source.id,
        detail: `${source.sourceName}: ${fetchErr.message || fetchErr.name || 'ralat tidak diketahui'}`,
      });
      await beritahuPentadbirDanKetuaEditor(dbAll, dbRun, {
        type: 'sistem_rss_gagal',
        title: `Ambilan RSS gagal — ${source.sourceName}`,
        detail: fetchErr.message || fetchErr.name || 'Ralat tidak diketahui',
        targetType: 'rss_source',
        targetId: source.id,
      });
    }
  }));

  // Query total DB counts for actual statistics
  const autoLiveRow = await dbGet("SELECT COUNT(*) as cnt FROM rss_ticker_items WHERE status = 'approved'");
  const pendingReviewRow = await dbGet("SELECT COUNT(*) as cnt FROM rss_ticker_items WHERE status = 'pending'");
  const totalFetchedRow = await dbGet("SELECT COUNT(*) as cnt FROM rss_ticker_items");

  const autoLiveCount = autoLiveRow ? autoLiveRow.cnt : 0;
  const pendingReviewCount = pendingReviewRow ? pendingReviewRow.cnt : 0;
  const totalFetchedCount = totalFetchedRow ? totalFetchedRow.cnt : 0;

  // Query approved items ordered by HIGHEST SCORE first!
  const settingsRow = await dbGet("SELECT tickerMaxItems FROM rss_editorial_settings WHERE id = 'main'");
  const maxLimit = settingsRow && settingsRow.tickerMaxItems ? Number(settingsRow.tickerMaxItems) : 20;

  const approvedItems = await dbAll(`SELECT * FROM rss_ticker_items WHERE status = 'approved' ORDER BY score DESC, publishedAt DESC LIMIT ${maxLimit}`);
  let tickerBlocks = [];

  if (approvedItems.length > 0) {
    tickerBlocks = approvedItems.map((item) => {
      const displayCategory = (item.category === 'BELUM DIKELASKAN' || !item.category) ? 'SEMASA' : item.category;
      return { desk: displayCategory, title: item.title, brief: item.formattedBrief || item.title, source: item.source, url: item.originalUrl, mode: 'RSS Direct' };
    });
  }

  if (tickerBlocks.length > 0) {
    const settingsSemasa = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
    const formattedTickerText = gantiBlokModTicker(settingsSemasa ? settingsSemasa.inTheNewsText : '', 'RSS Direct', tickerBlocks);
    await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [formattedTickerText]);
  }

  const lastFetchedAt = new Date().toISOString();

  // Log Audit (Fasa 4) — satu baris ringkasan setiap larian, di atas kegagalan per-sumber yang
  // dicatat individu di atas — supaya "berapa sumber aktif, berapa item ditemui" boleh disemak
  // dari sejarah, bukan cuma keadaan semasa.
  await logAudit(dbRun, {
    action: 'ambilan-rss-selesai',
    targetType: 'rss',
    detail: `${activeSources.length} sumber aktif, ${totalFetchedCount} item ditemui, ${autoLiveCount} auto-live, ${pendingReviewCount} menunggu semakan`,
  });

  return {
    success: true,
    activeSourcesCount: activeSources.length,
    totalFetchedCount,
    autoLiveCount,
    pendingReviewCount,
    lastFetchedAt,
    approvedCount: approvedItems.length
  };
}

