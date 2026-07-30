import express from 'express';

export function createEditorNotesRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  // GET /api/system/editor-notes (Semua nota untuk Editorium — Awam + Dalaman)
  router.get('/system/editor-notes', async (req, res) => {
    try {
      const { type, category, status, limit = 50, offset = 0 } = req.query;
      let sql = 'SELECT * FROM editor_notes WHERE 1=1';
      const params = [];

      if (type) {
        sql += ' AND type = ?';
        params.push(type);
      }
      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }
      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      } else {
        sql += " AND status = 'aktif'";
      }

      sql += ' ORDER BY is_pinned DESC, created_at DESC LIMIT ? OFFSET ?';
      params.push(Number(limit) || 50, Number(offset) || 0);

      const rows = await dbAll(sql, params);
      res.json({ success: true, notes: rows || [] });
    } catch (err) {
      console.error('Error fetching editor notes:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/public/editor-notes (Nota Awam sahaja untuk Frontpage)
  router.get('/public/editor-notes', async (req, res) => {
    try {
      const sql = "SELECT id, title, content, category, author_name, created_at FROM editor_notes WHERE type = 'awam' AND status = 'aktif' ORDER BY created_at DESC";
      const rows = await dbAll(sql, []);
      res.json({ success: true, notes: rows || [] });
    } catch (err) {
      console.error('Error fetching public editor notes:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/system/editor-notes (Cipta nota baharu)
  router.post('/system/editor-notes', async (req, res) => {
    try {
      const { title, content, type = 'dalaman', category = 'khas', authorId = 'system', authorName = 'Ketua Editor' } = req.body;

      if (!title || !title.trim() || !content || !content.trim()) {
        return res.status(400).json({ success: false, error: 'Tajuk dan kandungan nota wajib diisi.' });
      }

      if (title.trim().length > 150) {
        return res.status(400).json({ success: false, error: 'Tajuk nota tidak boleh melebihi 150 aksara.' });
      }

      if (content.trim().length > 5000) {
        return res.status(400).json({ success: false, error: 'Kandungan nota tidak boleh melebihi 5000 aksara.' });
      }

      const sql = `
        INSERT INTO editor_notes (title, content, type, category, status, author_id, author_name)
        VALUES (?, ?, ?, ?, 'aktif', ?, ?)
      `;
      const result = await dbRun(sql, [title.trim(), content.trim(), type, category, authorId, authorName]);
      res.json({ success: true, id: result.lastID, message: 'Nota Ketua Editor berjaya disimpan.' });
    } catch (err) {
      console.error('Error creating editor note:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT /api/system/editor-notes/:id/status (Tukar status aktif/arkib)
  router.put('/system/editor-notes/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['aktif', 'arkib'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Status tidak sah.' });
      }

      const sql = 'UPDATE editor_notes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      await dbRun(sql, [status, id]);
      res.json({ success: true, message: `Status nota #${id} dikemaskini kepada ${status}.` });
    } catch (err) {
      console.error('Error updating note status:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT /api/system/editor-notes/:id/pin (Semat/Batal semat nota)
  router.put('/system/editor-notes/:id/pin', async (req, res) => {
    try {
      const { id } = req.params;
      const { isPinned } = req.body;

      const pinnedVal = isPinned ? 1 : 0;
      const sql = 'UPDATE editor_notes SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      await dbRun(sql, [pinnedVal, id]);
      res.json({ success: true, message: `Nota #${id} ${pinnedVal ? 'disemat' : 'dibatal sematan'}.` });
    } catch (err) {
      console.error('Error toggling note pin status:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
