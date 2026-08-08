import express from 'express';
import { validateContentBudget, validateBidangTopik, TIER_SLOTS } from '../editorial/ContentBudget.js';
import CategoryRegistry from '../category/CategoryRegistry.js';
import { requirePermission } from '../middleware/auth.js';
import { getAmSettings } from './slotAmRoutes.js';

// Thin route wrappers around runEditorialPipeline/runAllScheduledSlots — those stay defined in
// server.js since the internal 5-minute scheduler also calls them directly, so they're passed in
// here rather than moved.
//
// 2026-08-07: kedua-dua laluan AI kini menolak 403 tanpa syarat (lihat saluranAiDimatikan di
// bawah), jadi parameter runEditorialPipeline/runAllScheduledSlots kekal dalam tandatangan
// semata-mata untuk memudahkan pengaktifan semula kelak — ia tidak lagi dipanggil di sini.
export function createPipelineRoutes(db, dbGet, dbRun, runEditorialPipeline, runAllScheduledSlots) {
  const router = express.Router();

  // POST /api/system/pipeline/batch_paste
  // Gerbang `publish` (2026-08-07, Pelan 02 #1, keputusan Izzat S1) — tampal pukal memang saluran
  // TERUS TERBIT (setiap item ditulis 'approved' tanpa singgah Menunggu), jadi ia alat pemegang
  // kunci terbit sahaja, bukan laluan editor biasa.
  router.post('/pipeline/batch_paste', requirePermission('publish'), async (req, res) => {
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
            // Kategori/Desk/Bidang are the same concept (locked category per slot); Topik is a
            // separate, unrelated free-text field — previously conflated as a synonym here.
            const categoryMatch = artBlock.match(/(?:Category|Kategori|Desk|Bidang)\s*[:=]?\s*([A-Za-z]+)/i);
            // Anchored to line-start with a required colon (unlike the other fields' looser
            // \s*[:=]?\s* pattern) — "Topik" is short enough to plausibly appear as an ordinary
            // word inside a title, and \s* crosses newlines, so a looser match risks bleeding into
            // the following line's content.
            const topikMatch = artBlock.match(/^\s*Topik\s*[:=]\s*(.+)$/im);
            const urlMatch = artBlock.match(/(?:Source|URL|Pautan)\s*[:=]?\s*(https?:\/\/[^\s\n]+)/i);

            if (titleMatch && slotNum >= 0 && slotNum < 38) {
              parsedItems.push({
                slotIndex: slotNum,
                title: titleMatch[1].trim(),
                summary: summaryMatch ? summaryMatch[1].trim().replace(/\s+/g, ' ').trim() : '',
                category: categoryMatch ? categoryMatch[1].trim().toUpperCase() : 'UMUM',
                topik: topikMatch ? topikMatch[1].trim() : '',
                source_url: urlMatch ? urlMatch[1].trim() : '#'
              });
            }
          }
        }
      }

      if (parsedItems.length === 0) {
        return res.status(400).json({ error: 'Tiada data slot berita yang sah dapat dihurai daripada teks yang ditampal.' });
      }

      // Same hard-block as the per-slot manual save: every slot of the same geometry tier is
      // validated by the exact same budget rule (core/editorial/ContentBudget.js). Validate the
      // whole batch before writing anything, so one oversized item doesn't leave a partial paste.
      // Bilangan item batch ini per slot — diperlukan untuk semakan hadKandunganSlot di bawah,
      // kerana satu batch boleh menambah beberapa kandungan ke slot yang sama sekali gus.
      const kiraanBatchSeslot = new Map();

      for (const item of parsedItems) {
        const slotIdx = item.slotIndex !== undefined ? parseInt(item.slotIndex, 10) : -1;
        // Item luar julat ditolak terang-terangan (Pelan 02 #13) — dahulu ia digugurkan senyap
        // dan pengguna tetap dapat success: true tanpa tahu item mana hilang.
        if (Number.isNaN(slotIdx) || slotIdx < 0 || slotIdx >= 38) {
          return res.status(400).json({
            error: `Nombor slot tidak sah untuk "${(item.title || '(tanpa tajuk)').slice(0, 40)}". Guna nombor slot 1 hingga 38 sahaja.`,
          });
        }
        kiraanBatchSeslot.set(slotIdx, (kiraanBatchSeslot.get(slotIdx) || 0) + 1);
        const budgetCheck = validateContentBudget(slotIdx, item.title, item.summary);
        if (!budgetCheck.isValid) {
          return res.status(400).json({ error: `Slot ${slotIdx + 1}, "${(item.title || '').slice(0, 40)}...": ${budgetCheck.reason}` });
        }
        // Bidang terkunci per-slot, Topik wajib untuk kandungan baharu — kecuali slot BAR.
        if (!TIER_SLOTS.BAR.includes(slotIdx)) {
          const slotRow = await dbGet("SELECT manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [slotIdx]);
          const bidangTopikCheck = validateBidangTopik({
            slotBidang: slotRow ? slotRow.manualDesk : null,
            itemBidang: item.category,
            topik: item.topik,
            requireTopik: true,
            slotIndex: slotIdx,
          });
          if (!bidangTopikCheck.isValid) {
            return res.status(400).json({ error: `Slot ${slotIdx + 1}, "${(item.title || '').slice(0, 40)}...": ${bidangTopikCheck.reason}` });
          }
        }
      }

      // Had bilangan kandungan seslot (Tetapan Am Slot; 0 = tiada had) — dikuatkuasakan di sini
      // sama seperti POST /content (Pelan 02 #1). Dahulu tampal pukal ialah satu-satunya laluan
      // penciptaan yang boleh menolak slot melebihi hadnya.
      const { hadKandunganSlot } = getAmSettings();
      if (hadKandunganSlot > 0) {
        for (const [slotIdx, tambahan] of kiraanBatchSeslot) {
          const kiraan = await dbGet(`
            SELECT COUNT(*) AS n FROM editorial_objects o
            JOIN editorial_revisions r ON r.objectId = o.id
            WHERE o.slotIndex = ? AND r.status IN ('approved', 'pending')
              AND r.version = (SELECT MAX(version) FROM editorial_revisions WHERE objectId = o.id)
          `, [slotIdx]);
          const sedia = kiraan ? kiraan.n : 0;
          if (sedia + tambahan > hadKandunganSlot) {
            return res.status(400).json({
              error: `Slot ${slotIdx + 1} sudah ada ${sedia} kandungan dan tampalan ini menambah ${tambahan} lagi. Had maksimum ialah ${hadKandunganSlot} (Tetapan Am Slot). Arkibkan kandungan sedia ada dahulu.`,
            });
          }
        }
      }

      const timestamp = new Date().toISOString();
      const results = [];

      // Same transaction wrapping as syncManualObjectsForSlot: a whole batch of pasted items is one
      // multi-table write. If one item's INSERT throws partway through, roll back everything written
      // so far in this request instead of leaving a partial batch committed.
      await dbRun('BEGIN TRANSACTION');
      try {
        const asasTs = Date.now();
        for (let i = 0; i < parsedItems.length; i += 1) {
          const item = parsedItems[i];
          const slotIdx = item.slotIndex !== undefined ? parseInt(item.slotIndex, 10) : -1;
          if (slotIdx < 0 || slotIdx >= 38) continue;

          // Cap masa + indeks (corak sama seperti server.js) — dua item ke slot yang SAMA dalam
          // satu batch berkongsi milisaat yang sama, jadi `Date.now()` sahaja menghasilkan id
          // serupa dan INSERT kedua gagal UNIQUE, menggulung seluruh transaksi.
          const objectId = `object-manual-slot${slotIdx}-${asasTs + i}`;
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
            { key: 'source', val: 'ChatGPT/Gemini Manual Paste' },
            { key: 'topik', val: item.topik || '' }
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
      res.status(500).json({ error: 'Gagal memproses data tampal pukal. ' + err.message });
    }
  });

  // Saluran AI dimatikan (keputusan 2026-08-02, dikuatkuasakan 2026-08-07 — Pelan 02 #12,
  // keputusan Izzat S2). Penjanaan kandungan AI automatik BUKAN saluran yang dibenarkan; saluran
  // rasmi ialah Manual, API bukan-AI dan suapan RSS sahaja. Ditolak terus untuk SEMUA peranan —
  // bukan sekadar digerbang kebenaran — supaya tiada sesiapa boleh memicunya secara tidak sengaja.
  const saluranAiDimatikan = (req, res) => {
    res.status(403).json({ error: 'Saluran AI dimatikan.', message: 'Saluran AI dimatikan.' });
  };

  // POST /api/system/pipeline/run
  router.post('/pipeline/run', saluranAiDimatikan);

  // POST /api/system/slots/run-now
  router.post('/slots/run-now', saluranAiDimatikan);


  return router;
}
