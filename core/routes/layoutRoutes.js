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
        const resolved = await resolveSlotContent(slot, lang);
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
