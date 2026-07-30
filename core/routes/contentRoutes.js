import express from 'express';
import { validateContentBudget, validateBidangTopik, validateMedanTambahan, TIER_SLOTS } from '../editorial/ContentBudget.js';
import { getAmSettings } from './slotAmRoutes.js';
import CategoryRegistry from '../category/CategoryRegistry.js';

// The Ticker (slotIndex -1) never writes to editorial_objects, in either Manual or AI Generated
// mode — it always lives as a single "---"-delimited text blob in system_settings.inTheNewsText
// (see EditorialPipeline.js's slotIndex===-1 branch, and the ticker save path in POST
// /api/system/slots). These mirror the client-side parseInTheNews()/serialization convention
// (Desk:/Title:/Brief:/Source:/Url: fields) so the content-review endpoints can read/write it too.
const parseTickerText = (text) => {
  if (!text) return [];
  const blocks = text.split(/\n?[-_—–―]{3,}\n?/);
  const items = [];
  for (const block of blocks) {
    let desk = '', title = '', brief = '', source = '', url = '', mode = '';
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (!url) url = trimmed;
        continue;
      }
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx <= 0) continue;
      const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
      const val = trimmed.slice(colonIdx + 1).trim();
      if (key === 'desk') desk = val;
      else if (key === 'title') title = val;
      else if (key === 'brief' || key === 'summary') brief = val;
      // 'sumber' accepted as an alias for legacy blocks written before the RSS-Direct fetch
      // handler's `sumber:` key typo (core/routes/slotRoutes.js) was fixed to write `source:` --
      // mirrors the client-side parseInTheNews() in src/utils.tsx, which already tolerated this.
      else if (key === 'source' || key === 'sumber') source = val;
      else if (key === 'url') url = val;
      // Mod Kandungan Ticker sebenar (Manual/AI Generated/RSS Direct) — lihat setiap penulis di
      // slotRoutes.js/slotsConfigRoutes.js/EditorialPipeline.js. Blok lama sebelum medan ni wujud
      // kekal '' (tak diketahui), bukan andaian salah.
      else if (key === 'mode') mode = val;
    }
    if (title) items.push({ desk, title, brief, source, url, mode });
  }
  return items;
};

const serializeTickerText = (items) => {
  return items
    .map(i => `Desk: ${i.desk || 'UMUM'}\nTitle: ${i.title}\nBrief: ${i.brief || ''}\nSource: ${i.source || ''}\nUrl: ${i.url || '#'}${i.mode ? `\nMode: ${i.mode}` : ''}`)
    .join('\n---\n');
};

const CONTENT_STATUSES = ['approved', 'pending', 'rejected', 'archived'];

export function createContentRoutes(db, dbAll, dbGet, dbRun) {
  const router = express.Router();

  // GET /api/system/content/all
  router.get('/content/all', async (req, res) => {
    try {
      // Admin index view: show the latest revision of every object regardless of status (approved,
      // pending, rejected, archived) — unlike the public-facing layout/active endpoint, which only
      // ever serves 'approved' rows. This is what lets Adjung Brief show and manage items the chief
      // editor has rejected/archived after the fact, without those items ever reappearing on the
      // public frontpage.
      const rows = await dbAll(`
        SELECT eo.id as objectId, eo.slotIndex, eo.categoryId, eo.createdAt as objectCreatedAt,
               er.id as revisionId, er.title, er.summary, er.status, er.createdBy,
               er.createdAt as revisionCreatedAt, er.updatedAt as revisionUpdatedAt
        FROM editorial_objects eo
        INNER JOIN editorial_revisions er ON er.objectId = eo.id
        INNER JOIN (
          SELECT objectId, MAX(version) as maxVersion FROM editorial_revisions GROUP BY objectId
        ) latest ON latest.objectId = er.objectId AND latest.maxVersion = er.version
        ORDER BY eo.slotIndex ASC, eo.createdAt ASC
      `);

      const objectIds = rows.map(r => r.objectId);
      let attrsByObject = {};
      if (objectIds.length > 0) {
        const placeholders = objectIds.map(() => '?').join(',');
        const attrRows = await dbAll(`SELECT * FROM editorial_attribute_values WHERE objectId IN (${placeholders})`, objectIds);
        for (const a of attrRows) {
          if (!attrsByObject[a.objectId]) attrsByObject[a.objectId] = {};
          attrsByObject[a.objectId][a.attributeId] = a.valueText;
        }
      }

      const slotRows = await dbAll("SELECT slotIndex, maxTitle, maxBrief, maxBriefLong, manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage'");
      const limitsBySlot = {};
      for (const s of slotRows) {
        limitsBySlot[s.slotIndex] = { maxTitle: s.maxTitle, maxBrief: s.maxBrief, maxBriefLong: s.maxBriefLong, slotCategory: s.manualDesk || '' };
      }

      // seriesIndex: 1-based position within its own slot, in the same createdAt-ASC order used to
      // render the carousel — this is what the "#slot-series" numbering in the bulk text view anchors to.
      const seriesCounter = {};
      const items = rows.map(r => {
        const attrs = attrsByObject[r.objectId] || {};
        seriesCounter[r.slotIndex] = (seriesCounter[r.slotIndex] || 0) + 1;
        const limits = limitsBySlot[r.slotIndex] || {};
        return {
          id: r.objectId,
          revisionId: r.revisionId,
          slotIndex: r.slotIndex,
          seriesIndex: seriesCounter[r.slotIndex],
          title: r.title,
          summary: r.summary,
          summaryLong: attrs.briefLong || '',
          note: attrs.note || '',
          originalDate: attrs.originalDate || '',
          desk: attrs.desk || r.categoryId || '',
          topik: attrs.topik || '',
          source: attrs.source || '',
          url: attrs.url || '#',
          imageUrl: attrs.imageUrl || attrs.coverImageId || '',
          maxTitle: limits.maxTitle !== undefined ? limits.maxTitle : null,
          maxBrief: limits.maxBrief !== undefined ? limits.maxBrief : null,
          maxBriefLong: limits.maxBriefLong !== undefined ? limits.maxBriefLong : null,
          slotCategory: limits.slotCategory || '',
          status: r.status || 'approved',
          createdBy: r.createdBy || '',
          editorName: attrs.editorName || '',
          createdAt: r.revisionCreatedAt,
          updatedAt: r.revisionUpdatedAt
        };
      });

      const tickerSettings = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
      const tickerLimits = limitsBySlot[-1] || {};
      const tickerParsed = parseTickerText(tickerSettings ? tickerSettings.inTheNewsText : '');
      const tickerItems = tickerParsed.map((t, idx) => ({
        id: `ticker-${idx}`,
        revisionId: null,
        slotIndex: -1,
        seriesIndex: idx + 1,
        title: t.title,
        summary: t.brief,
        desk: t.desk,
        source: t.source,
        url: t.url || '#',
        imageUrl: '',
        maxTitle: tickerLimits.maxTitle !== undefined ? tickerLimits.maxTitle : null,
        maxBrief: tickerLimits.maxBrief !== undefined ? tickerLimits.maxBrief : null,
        slotCategory: tickerLimits.slotCategory || '',
        status: 'approved',
        // Mod sebenar (Manual/AI Generated/RSS Direct) yang mencipta baris ni — BUKAN konstan
        // 'ticker' tetap macam dulu (tak bawa maklumat, lihat "Kaedah" audit di Indeks). Blok lama
        // sebelum medan Mode: wujud kekal '', papar sebagai "Tidak diketahui" di UI, bukan silap.
        createdBy: t.mode || '',
        createdAt: null,
        updatedAt: null
      }));

      const allItems = [...tickerItems, ...items];
      res.json({ items: allItems, count: allItems.length });
    } catch (err) {
      console.error('Fetch aggregate content error:', err);
      res.status(500).json({ error: 'Failed to fetch aggregate content. ' + (err.message || '') });
    }
  });

  // PATCH /api/system/content/:id
  router.patch('/content/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title, summary, desk, source, url, status, topik, slotIndex, briefLong, originalDate, note } = req.body;
      if (status !== undefined && !CONTENT_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Status tidak sah. Guna salah satu: ${CONTENT_STATUSES.join(', ')}.` });
      }

      if (id.startsWith('ticker-')) {
        if (status !== undefined) {
          return res.status(400).json({ error: 'Item ticker tiada status boleh-ubah — buang baris tu terus daripada tetapan ticker untuk menariknya balik.' });
        }
        const idx = parseInt(id.slice('ticker-'.length), 10);
        const settingsRow = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
        const tickerItems = parseTickerText(settingsRow ? settingsRow.inTheNewsText : '');
        if (idx < 0 || idx >= tickerItems.length) {
          return res.status(404).json({ error: 'Item ticker tidak dijumpai.' });
        }
        // Same hard-block as every other content path: an edit can never push this tier's
        // title+brief over its budget, no matter which screen the edit came from.
        const nextTitle = title !== undefined ? title : tickerItems[idx].title;
        const nextBrief = summary !== undefined ? summary : tickerItems[idx].brief;
        const tickerBudgetCheck = validateContentBudget(-1, nextTitle, nextBrief);
        if (!tickerBudgetCheck.isValid) {
          return res.status(400).json({ error: tickerBudgetCheck.reason });
        }
        if (title !== undefined) tickerItems[idx].title = title;
        if (summary !== undefined) tickerItems[idx].brief = summary;
        if (desk !== undefined) tickerItems[idx].desk = desk;
        if (source !== undefined) tickerItems[idx].source = source;
        if (url !== undefined) tickerItems[idx].url = url;
        await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [serializeTickerText(tickerItems)]);
        return res.json({ success: true });
      }

      const { imageUrl } = req.body;
      // Look up the latest revision regardless of current status — a previously rejected/archived
      // item must still be reachable here so the chief editor can flip it back to 'approved'.
      const rev = await dbGet("SELECT * FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1", [id]);
      if (!rev) {
        return res.status(404).json({ error: 'Item tidak dijumpai.' });
      }

      // Same hard-block as every other content path: an edit can never push a slot's title+brief
      // over its tier's budget, no matter which screen the edit came from.
      const objRow = await dbGet("SELECT slotIndex, categoryId FROM editorial_objects WHERE id = ?", [id]);
      if (objRow) {
        // Sasaran slot: slot BAHARU kalau kandungan sedang dipindah (siar-semula kandungan
        // archived ke slot lain), jika tidak slot sedia ada.
        const targetSlotIndex = slotIndex !== undefined ? slotIndex : objRow.slotIndex;

        const nextTitle = title !== undefined ? title : rev.title;
        const nextSummary = summary !== undefined ? summary : rev.summary;
        const budgetCheck = validateContentBudget(targetSlotIndex, nextTitle, nextSummary);
        if (!budgetCheck.isValid) {
          return res.status(400).json({ error: budgetCheck.reason });
        }

        // Had aksara medan bukan-kad (Tetapan Am Slot). Hanya medan yang benar-benar dihantar
        // disemak — kemas kini separa tak boleh ditolak kerana medan yang tak disentuh.
        const medanCheck = validateMedanTambahan({ summaryLong: briefLong, source, topik, note });
        if (!medanCheck.isValid) {
          return res.status(400).json({ error: medanCheck.reason });
        }

        // Bidang terkunci per-slot, Topik wajib — bila tajuk/huraian diedit, kandungan dipindah
        // ke slot lain, ATAU kandungan sedang diaktifkan semula (archived/rejected -> approved/
        // pending, cth "Siarkan Semula" di Indeks). Bukan tindakan status-sahaja lain (Tolak/
        // Arkib pada kandungan lama tak perlu sepadan Bidang). Kecuali slot BAR.
        const reactivating = status !== undefined
          && ['approved', 'pending'].includes(status)
          && ['archived', 'rejected'].includes(rev.status);
        const mustValidateBidangTopik = title !== undefined || summary !== undefined || slotIndex !== undefined || reactivating;
        if (mustValidateBidangTopik && !TIER_SLOTS.BAR.includes(targetSlotIndex)) {
          const slotRow = await dbGet("SELECT manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [targetSlotIndex]);
          const existingAttrs = await dbGet(
            "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'desk'",
            [id, rev.id]
          );
          const nextDesk = desk !== undefined ? desk : (existingAttrs ? existingAttrs.valueText : objRow.categoryId);
          const existingTopikRow = await dbGet(
            "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'topik'",
            [id, rev.id]
          );
          const nextTopik = topik !== undefined ? topik : (existingTopikRow ? existingTopikRow.valueText : '');
          const bidangTopikCheck = validateBidangTopik({
            slotBidang: slotRow ? slotRow.manualDesk : null,
            itemBidang: nextDesk,
            topik: nextTopik,
            requireTopik: true,
            slotIndex: targetSlotIndex,
          });
          if (!bidangTopikCheck.isValid) {
            return res.status(400).json({ error: bidangTopikCheck.reason });
          }
        }

        if (slotIndex !== undefined && slotIndex !== objRow.slotIndex) {
          await dbRun("UPDATE editorial_objects SET slotIndex = ? WHERE id = ?", [slotIndex, id]);
        }
      }

      const setClauses = [];
      const params = [];
      if (title !== undefined) { setClauses.push('title = ?'); params.push(title); }
      if (summary !== undefined) { setClauses.push('summary = ?'); params.push(summary); }
      if (status !== undefined) { setClauses.push('status = ?'); params.push(status); }
      if (setClauses.length > 0) {
        setClauses.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(rev.id);
        await dbRun(`UPDATE editorial_revisions SET ${setClauses.join(', ')} WHERE id = ?`, params);
      }

      if (desk !== undefined && desk.trim() !== '') {
        try {
          await CategoryRegistry.incrementCategoryUsage(db, desk);
        } catch (e) {
          console.warn("Failed to register category:", e.message);
        }
      }

      const attrCandidates = { desk, source, url, imageUrl, topik, briefLong, originalDate, note };
      for (const [key, val] of Object.entries(attrCandidates)) {
        if (val === undefined) continue;
        const existing = await dbGet(
          "SELECT id FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = ?",
          [id, rev.id, key]
        );
        if (existing) {
          await dbRun("UPDATE editorial_attribute_values SET valueText = ? WHERE id = ?", [val, existing.id]);
        } else {
          await dbRun(
            "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, ?, ?)",
            [id, rev.id, key, val]
          );
        }
      }

      await dbRun("UPDATE editorial_objects SET updatedAt = ? WHERE id = ?", [new Date().toISOString(), id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Patch content item error:', err);
      res.status(500).json({ error: 'Failed to update item. ' + (err.message || '') });
    }
  });

  // POST /api/system/content/:id/reject-to-draft — "Tolak" di Indeks (2026-07-29, permintaan
  // pemilik projek). Alur kerja Draf/Terbit: kandungan "Terbitkan" masuk Indeks sebagai Pending,
  // menunggu Ketua Editor. Tolak BUKAN sekadar tanda status='rejected' — ia betul-betul
  // PULANGKAN kandungan tu jadi draf peribadi semula (rekod editorial_objects diarkib untuk
  // jejak audit, kandungan penuh disalin balik jadi blok draf dalam slots_config.manualSummary
  // slot asal supaya editor boleh sambung sunting dalam modal Tulis Kandungan). Draf tak pernah
  // muncul di Indeks — lihat nota di server.js/ManualBlockFormat.js.
  router.post('/content/:id/reject-to-draft', async (req, res) => {
    try {
      const { id } = req.params;
      if (id.startsWith('ticker-')) {
        return res.status(400).json({ error: 'Ticker tidak menyokong Tolak-ke-Draf.' });
      }

      const objRow = await dbGet("SELECT slotIndex, categoryId FROM editorial_objects WHERE id = ?", [id]);
      if (!objRow) {
        return res.status(404).json({ error: 'Item tidak dijumpai.' });
      }
      if (TIER_SLOTS.BAR.includes(objRow.slotIndex)) {
        return res.status(400).json({ error: 'Slot Bar belum menyokong alur kerja Draf/Terbit.' });
      }

      const rev = await dbGet("SELECT * FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1", [id]);
      if (!rev) {
        return res.status(404).json({ error: 'Item tidak dijumpai.' });
      }

      const attrRows = await dbAll("SELECT attributeId, valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ?", [id, rev.id]);
      const attrs = {};
      for (const a of attrRows) attrs[a.attributeId] = a.valueText;

      const draftBlock = [
        `UUID: object-manual-slot${objRow.slotIndex}-${Date.now()}-reject`,
        `Status: draf`,
        `Tajuk: ${rev.title || ''}`,
        `Topik: ${attrs.topik || ''}`,
        `Huraian ringkas: ${rev.summary || ''}`,
        `Huraian panjang: ${attrs.briefLong || ''}`,
        `Sumber: ${attrs.source || ''}`,
        `URL: ${attrs.url || ''}`,
        `Tarikh sumber: ${attrs.originalDate || ''}`,
        `Imej: ${attrs.image || ''}`,
        `Nota: ${attrs.note || ''}`,
      ].join('\n');
      const DRAFT_SEPARATOR = '\n\n________________________________________\n\n';

      const slotRow = await dbGet("SELECT manualSummary FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [objRow.slotIndex]);
      const existingSummary = (slotRow && slotRow.manualSummary) || '';
      const nextSummary = existingSummary.trim() ? `${existingSummary}${DRAFT_SEPARATOR}${draftBlock}` : draftBlock;

      await dbRun("UPDATE slots_config SET manualSummary = ? WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [nextSummary, objRow.slotIndex]);
      await dbRun("UPDATE editorial_revisions SET status = 'archived', updatedAt = ? WHERE id = ?", [new Date().toISOString(), rev.id]);

      res.json({ success: true });
    } catch (err) {
      console.error('Reject-to-draft error:', err);
      res.status(500).json({ error: 'Failed to reject to draft. ' + (err.message || '') });
    }
  });

  // DELETE /api/system/content/:id
  router.delete('/content/:id', async (req, res) => {
    try {
      const { id } = req.params;

      if (id.startsWith('ticker-')) {
        const idx = parseInt(id.slice('ticker-'.length), 10);
        const settingsRow = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
        const tickerItems = parseTickerText(settingsRow ? settingsRow.inTheNewsText : '');
        if (idx < 0 || idx >= tickerItems.length) {
          return res.status(404).json({ error: 'Item ticker tidak dijumpai.' });
        }
        tickerItems.splice(idx, 1);
        await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [serializeTickerText(tickerItems)]);
        return res.json({ success: true });
      }

      await dbRun("DELETE FROM editorial_attribute_values WHERE objectId = ?", [id]);
      await dbRun("DELETE FROM editorial_revisions WHERE objectId = ?", [id]);
      const result = await dbRun("DELETE FROM editorial_objects WHERE id = ?", [id]);
      if (!result.changes) {
        return res.status(404).json({ error: 'Item tidak dijumpai.' });
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Delete content item error:', err);
      res.status(500).json({ error: 'Failed to delete item. ' + (err.message || '') });
    }
  });

  // POST /api/system/content
  router.post('/content', async (req, res) => {
    try {
      const { slotIndex, title, summary, desk, source, url, imageUrl, topik } = req.body;
      if (slotIndex === undefined || slotIndex === null) {
        return res.status(400).json({ error: 'Missing slotIndex.' });
      }
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Tajuk diperlukan.' });
      }

      if (slotIndex === -1) {
        // Same hard-block as every other tier — Ticker is not an exception. Previously this
        // branch returned before ever reaching the validateContentBudget call below, so a manually
        // added ticker item could be any length at all.
        const tickerBudgetCheck = validateContentBudget(-1, title.trim(), (summary || '').trim());
        if (!tickerBudgetCheck.isValid) {
          return res.status(400).json({ error: tickerBudgetCheck.reason });
        }
        const settingsRow = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
        const tickerItems = parseTickerText(settingsRow ? settingsRow.inTheNewsText : '');
        tickerItems.push({
          desk: (desk || 'UMUM').trim().toUpperCase(),
          title: title.trim(),
          brief: (summary || '').trim(),
          source: source || '',
          url: url || '#'
        });
        await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [serializeTickerText(tickerItems)]);
        return res.json({ success: true, id: `ticker-${tickerItems.length - 1}` });
      }

      // Same hard-block as every other content-creation path: this slot's tier's budget rule applies
      // no matter which screen the content came from (core/editorial/ContentBudget.js).
      const budgetCheck = validateContentBudget(slotIndex, title.trim(), (summary || '').trim());
      if (!budgetCheck.isValid) {
        return res.status(400).json({ error: budgetCheck.reason });
      }

      const medanCheck = validateMedanTambahan({ source, topik });
      if (!medanCheck.isValid) {
        return res.status(400).json({ error: medanCheck.reason });
      }

      // Had bilangan kandungan seslot (Tetapan Am Slot; 0 = tiada had). Dikira daripada kandungan
      // yang masih hidup sahaja — kandungan arkib tidak mengambil ruang slot.
      const { hadKandunganSlot } = getAmSettings();
      if (hadKandunganSlot > 0) {
        const kiraan = await dbGet(`
          SELECT COUNT(*) AS n FROM editorial_objects o
          JOIN editorial_revisions r ON r.objectId = o.id
          WHERE o.slotIndex = ? AND r.status IN ('approved', 'pending')
            AND r.version = (SELECT MAX(version) FROM editorial_revisions WHERE objectId = o.id)
        `, [slotIndex]);
        if (kiraan && kiraan.n >= hadKandunganSlot) {
          return res.status(400).json({
            error: `Slot ${slotIndex + 1} sudah ada ${kiraan.n} kandungan — had maksimum ialah ${hadKandunganSlot} (Tetapan Am Slot). Arkibkan kandungan sedia ada dahulu.`,
          });
        }
      }

      const timestamp = new Date().toISOString();
      const finalCategory = (desk || 'UMUM').trim().toUpperCase();

      // Bidang terkunci per-slot, Topik wajib untuk kandungan baharu — kecuali slot BAR. Checked
      // against finalCategory (not raw desk) so an omitted desk — which defaults to 'UMUM' — still
      // gets caught if the slot has a different locked Bidang, instead of silently bypassing the check.
      if (!TIER_SLOTS.BAR.includes(slotIndex)) {
        const slotRow = await dbGet("SELECT manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [slotIndex]);
        const bidangTopikCheck = validateBidangTopik({
          slotBidang: slotRow ? slotRow.manualDesk : null,
          itemBidang: finalCategory,
          topik,
          requireTopik: true,
          slotIndex,
        });
        if (!bidangTopikCheck.isValid) {
          return res.status(400).json({ error: bidangTopikCheck.reason });
        }
      }
      try {
        await CategoryRegistry.incrementCategoryUsage(db, finalCategory);
      } catch (e) {
        console.warn("Failed to register category:", e.message);
      }
      const objectId = `object-manual-slot${slotIndex}-${Date.now()}-new`;

      await dbRun(
        `INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, createdAt, updatedAt)
         VALUES (?, 'Brief', ?, 'Medium', ?, ?, ?)`,
        [objectId, finalCategory, slotIndex, timestamp, timestamp]
      );
      const rev = await dbRun(
        `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
         VALUES (?, 1.0, 'ms', ?, ?, 'approved', 'content-review', ?, ?)`,
        [objectId, title.trim(), (summary || '').trim(), timestamp, timestamp]
      );
      const revisionId = rev.lastID;

      const attrs = [
        { key: 'desk', val: finalCategory },
        { key: 'url', val: url || '#' },
        { key: 'source', val: source || '' },
        { key: 'topik', val: topik || '' },
      ];
      if (imageUrl) attrs.push({ key: 'imageUrl', val: imageUrl });
      for (const a of attrs) {
        await dbRun(
          "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, ?, ?)",
          [objectId, revisionId, a.key, a.val]
        );
      }

      res.json({ success: true, id: objectId });
    } catch (err) {
      console.error('Create content item error:', err);
      res.status(500).json({ error: 'Failed to create item. ' + (err.message || '') });
    }
  });

  return router;
}
