import express from 'express';
import { requireAuth } from '../middleware/auth.js';

// Log Sistem (2026-08-02, Fasa 4) — dahulu SIFAR: `LogAuditConsole.tsx` cuma placeholder,
// `logs: []` berkod keras di dbStateRoutes.js, tiada jadual pun untuk direkodkan. Kini baca
// jadual `audit_log` sebenar (lihat core/audit/AuditLog.js untuk penulis).
export function createAuditLogRoutes(dbAll) {
  const router = express.Router();

  // GET /api/system/audit-log?limit=100&before=<id> — terkini dahulu, jumlah dihadkan (log
  // audit sepatutnya dilihat sebagai jejak semasa, bukan dimuat turun sekali gus).
  router.get('/audit-log', requireAuth, async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
      const before = req.query.before ? parseInt(req.query.before, 10) : null;
      const rows = before
        ? await dbAll('SELECT * FROM audit_log WHERE id < ? ORDER BY id DESC LIMIT ?', [before, limit])
        : await dbAll('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?', [limit]);
      res.json(rows || []);
    } catch (err) {
      console.error('GET audit-log error:', err);
      res.status(500).json({ error: 'Gagal membaca log audit. ' + (err.message || '') });
    }
  });

  return router;
}

export default createAuditLogRoutes;
