import express from 'express';
import CategoryRegistry from '../category/CategoryRegistry.js';

// resolveSlotContent stays defined in server.js — it's the render-time function that resolves
// each slot's AI-Generated/Manual content (including the parseManualSummaryTemplate fallback for
// slots never migrated to real editorial_objects rows), passed in here as a parameter rather than
// moved.
export function createLayoutRoutes(db, dbAll, resolveSlotContent) {
  const router = express.Router();

  // GET /api/system/layout/active
  router.get('/layout/active', async (req, res) => {
    try {
      const lang = req.query.lang || 'ms';
      const slots = await dbAll("SELECT * FROM slots_config WHERE layoutTemplateId = 'frontpage' ORDER BY slotIndex ASC");
      const categories = await CategoryRegistry.getAllCategories(db);
      const resolvedSlots = [];

      for (const slot of slots) {
        // 2026-09-08 (dapatan bug-hunt, corak sama pepijat pubDate RSS) — dahulu `await
        // resolveSlotContent(slot, lang)` dipanggil terus dalam gelung TANPA try/catch
        // sendiri, dalam satu try/catch BESAR yang membalut KESELURUHAN 38 slot serta
        // pemetaan warna kategori. Satu slot dengan data rosak/luar-jangka (cth JSON tak
        // sah dalam editorial_attribute_values, blok manualSummary yang cacat, dsb — mana-
        // mana lontaran tak dijangka dalam resolveSlotContent()/PresentationComposer)
        // menggugurkan SELURUH respons GET /layout/active (500), iaitu laman awam
        // KESELURUHANNYA (bukan cuma satu kad) untuk SEMUA pelawat, sehingga data rosak tu
        // dibetulkan secara manual. Kini setiap slot diselesaikan dalam try/catch sendiri —
        // satu slot bermasalah dilangkau senyap (dicatat ke console), 37 slot LAIN yang sah
        // tetap terbit seperti biasa.
        let resolved;
        try {
          resolved = await resolveSlotContent(slot, lang);
        } catch (slotErr) {
          console.error(`[layout/active] Slot ${slot.slotIndex} gagal diselesaikan:`, slotErr);
          continue;
        }
        if (resolved) {
          // Map category colors & public category fallback to items
          if (resolved.items && Array.isArray(resolved.items)) {
            for (const item of resolved.items) {
              if (item.desk === 'BELUM DIKELASKAN') item.desk = 'SEMASA';
              const catSlug = CategoryRegistry.getSlug(item.desk || 'UMUM');
              const matched = categories.find(c => c.slug === catSlug);
              item.categoryColor = matched ? matched.color : '#802334';
            }
          }
          // Also map for the main resolved object properties
          if (resolved.desk === 'BELUM DIKELASKAN') resolved.desk = 'SEMASA';
          const catSlug = CategoryRegistry.getSlug(resolved.desk || 'UMUM');
          const matched = categories.find(c => c.slug === catSlug);
          resolved.categoryColor = matched ? matched.color : '#802334';

          resolvedSlots.push(resolved);
        }
      }

      res.json(resolvedSlots);
    } catch (err) {
      console.error('Resolve layout error:', err);
      res.status(500).json({ error: 'Gagal menyelesaikan susun atur slot.' });
    }
  });

  return router;
}
