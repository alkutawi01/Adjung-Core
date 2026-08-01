import express from 'express';
import { requireAuth } from '../middleware/auth.js';

// Profil Editor (2026-08-01, spesifikasi pemilik projek — aksesori header, bukan destinasi
// sidebar) — editor yang log masuk boleh lihat/sunting IDENTITI DIA SENDIRI: nama pena,
// tandatangan, warna avatar, bio ringkas. Sengaja TIDAK termasuk email/username (identiti akaun,
// ditukar melalui proses lain) atau peranan (RBAC, bukan hak editor sendiri untuk ubah).
const HAD_PEN_NAME = 60;
const HAD_SIGNATURE = 40;
const HAD_BIO = 500;

export function createProfileRoutes(dbGet, dbRun) {
  const router = express.Router();

  // PATCH /api/system/profile/:id — 2026-08-02 (Fasa 1): dahulu sesiapa boleh tulis profil
  // MANA-MANA id dalam URL, tanpa semak siapa yang memanggil. Kini perlu sesi sah, dan hanya
  // pemilik akaun sendiri ATAU Ketua Editor boleh menyunting.
  router.patch('/profile/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      if (req.session.user.id !== id && req.session.user.role !== 'KETUA_EDITOR') {
        return res.status(403).json({ error: 'Hanya boleh sunting profil sendiri.' });
      }
      const sedia = await dbGet('SELECT id FROM users WHERE id = ?', [id]);
      if (!sedia) return res.status(404).json({ error: 'Akaun tidak dijumpai.' });

      const { penName, signature, avatarColor, bioSummary } = req.body || {};
      const set = [];
      const params = [];

      if (penName !== undefined) {
        const v = (penName || '').trim();
        if (!v) return res.status(400).json({ error: 'Nama pena tidak boleh kosong.' });
        if (v.length > HAD_PEN_NAME) return res.status(400).json({ error: `Nama pena tidak boleh melebihi ${HAD_PEN_NAME} aksara.` });
        set.push('penName = ?'); params.push(v);
      }
      if (signature !== undefined) {
        const v = (signature || '').trim();
        if (v.length > HAD_SIGNATURE) return res.status(400).json({ error: `Tandatangan tidak boleh melebihi ${HAD_SIGNATURE} aksara.` });
        set.push('signature = ?'); params.push(v);
      }
      if (avatarColor !== undefined) {
        const v = (avatarColor || '').trim();
        if (v && !/^#[0-9a-f]{6}$/i.test(v)) return res.status(400).json({ error: 'Warna avatar mesti kod hex 6 digit, cth #802334.' });
        set.push('avatarColor = ?'); params.push(v);
      }
      if (bioSummary !== undefined) {
        const v = (bioSummary || '').trim();
        if (v.length > HAD_BIO) return res.status(400).json({ error: `Bio ringkas tidak boleh melebihi ${HAD_BIO} aksara.` });
        set.push('bioSummary = ?'); params.push(v);
      }

      if (set.length === 0) return res.status(400).json({ error: 'Tiada medan untuk dikemas kini.' });

      set.push('updatedAt = ?'); params.push(new Date().toISOString());
      params.push(id);
      await dbRun(`UPDATE users SET ${set.join(', ')} WHERE id = ?`, params);

      const baris = await dbGet(
        'SELECT id, username, email, role, penName, signature, avatarColor, bioSummary FROM users WHERE id = ?',
        [id]
      );
      res.json({ success: true, user: baris });
    } catch (err) {
      console.error('PATCH profile error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini profil. ' + (err.message || '') });
    }
  });

  return router;
}

export default createProfileRoutes;
