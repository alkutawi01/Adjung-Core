import express from 'express';

export function createContentRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  // GET /api/system/content/all
  router.get('/content/all', async (req, res) => {
    try {
      const rows = await dbAll(`
        SELECT 
          o.id as objectId,
          o.type,
          o.categoryId,
          o.priority,
          o.slotIndex,
          o.createdAt as objectCreatedAt,
          r.id as revisionId,
          r.version,
          r.language,
          r.title,
          r.summary,
          r.status,
          r.createdBy,
          r.createdAt as revisionCreatedAt
        FROM editorial_objects o
        JOIN editorial_revisions r ON o.id = r.objectId
        ORDER BY o.createdAt DESC
      `);

      const items = await Promise.all(rows.map(async (row) => {
        const attrs = await dbAll(
          "SELECT attributeId, valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ?",
          [row.objectId, row.revisionId]
        );
        const attrMap = {};
        for (const a of attrs) {
          attrMap[a.attributeId] = a.valueText;
        }
        return {
          id: row.objectId,
          revisionId: row.revisionId,
          type: row.type,
          category: row.categoryId,
          priority: row.priority,
          slotIndex: row.slotIndex,
          title: row.title,
          summary: row.summary,
          status: row.status,
          language: row.language,
          desk: attrMap.desk || row.categoryId,
          source: attrMap.source || '',
          url: attrMap.url || '#',
          publishedAt: row.objectCreatedAt
        };
      }));

      res.json(items);
    } catch (err) {
      console.error('Fetch content all error:', err);
      res.status(500).json({ error: 'Failed to fetch content.' });
    }
  });

  // POST /api/system/content
  router.post('/content', async (req, res) => {
    try {
      const { title, summary, desk, source, url, slotIndex } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required.' });

      const objectId = `object-manual-${Date.now()}`;
      const now = new Date().toISOString();
      const finalCategory = (desk || 'UMUM').trim().toUpperCase();

      await dbRun(
        "INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, createdAt, updatedAt) VALUES (?, 'Brief', ?, 'Medium', ?, ?, ?)",
        [objectId, finalCategory, slotIndex !== undefined ? slotIndex : -1, now, now]
      );

      const rev = await dbRun(
        "INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt) VALUES (?, 1.0, 'ms', ?, ?, 'approved', 'manual-user', ?, ?)",
        [objectId, title, summary || '', now, now]
      );
      const revisionId = rev.lastID;

      const attrs = [
        { key: 'desk', val: finalCategory },
        { key: 'source', val: source || '' },
        { key: 'url', val: url || '#' }
      ];
      for (const a of attrs) {
        await dbRun(
          "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, ?, ?)",
          [objectId, revisionId, a.key, a.val]
        );
      }

      res.json({ success: true, id: objectId });
    } catch (err) {
      console.error('Create content error:', err);
      res.status(500).json({ error: 'Failed to create content.' });
    }
  });

  // DELETE /api/system/content/:id
  router.delete('/content/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await dbRun("DELETE FROM editorial_attribute_values WHERE objectId = ?", [id]);
      await dbRun("DELETE FROM editorial_revisions WHERE objectId = ?", [id]);
      await dbRun("DELETE FROM editorial_objects WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Delete content error:', err);
      res.status(500).json({ error: 'Failed to delete content.' });
    }
  });

  return router;
}
