import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { hashPassword } from './authRoutes.js';
import { logAudit } from '../audit/AuditLog.js';
import { notify, notifyMany } from '../notifications/Notify.js';

// Direktori (2026-08-02, Fasa 3) — dahulu `staffList` konsol client array kosong berkod keras,
// "+ Tambah Anggota" hiasan, tindakan status hanya state React (hilang bila muat semula). Laluan
// ni jadikan Direktori sebenar: baca/tulis jadual `users` + `user_roles` sebenar. Domain
// Pentadbir sepenuhnya (kebenaran `manageAccounts`) — lihat matriks di core/middleware/auth.js.
const STATUS_SAH = ['Aktif', 'Cuti', 'Tidak Aktif', 'Ditamatkan'];
const ROLE_IDS_SAH = ['pentadbir', 'ketua_editor', 'penolong_ketua_editor', 'editor'];

export function createUserAdminRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  // GET /api/system/users — senarai penuh anggota + peranan + kiraan aktiviti ringkas.
  router.get('/users', requirePermission('manageAccounts'), async (req, res) => {
    try {
      const users = await dbAll(
        `SELECT id, username, email, penName, status, isSuspended, createdAt, updatedAt FROM users ORDER BY createdAt ASC`
      );
      const roleRows = await dbAll(`SELECT userId, roleId FROM user_roles`);
      const rolesByUser = {};
      for (const r of roleRows || []) {
        (rolesByUser[r.userId] = rolesByUser[r.userId] || []).push(r.roleId);
      }

      // Kiraan aktiviti (2026-08-02) — anggaran terbaik daripada atribut `editorName` yang
      // dicap semasa terbit (lihat server.js syncManualObjectsForSlot) — bukan kiraan sempurna
      // (satu sesi Simpan/Terbit = satu nama editor untuk SEMUA item dalam sesi tu, lihat nota
      // sedia ada di server.js), tapi lebih jujur daripada angka rekaan yang wujud dulu.
      const staff = await Promise.all((users || []).map(async (u) => {
        const countRow = await dbGet(
          `SELECT COUNT(DISTINCT eav.objectId) AS cnt
           FROM editorial_attribute_values eav
           WHERE eav.attributeId = 'editorName' AND eav.valueText = ?`,
          [u.penName || '']
        );
        return {
          id: u.id,
          username: u.username,
          email: u.email,
          penName: u.penName || u.username,
          status: STATUS_SAH.includes(u.status) ? u.status : 'Aktif',
          suspended: u.isSuspended === 1,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          roles: rolesByUser[u.id] || [],
          countPublished: countRow ? countRow.cnt : 0,
        };
      }));

      res.json(staff);
    } catch (err) {
      console.error('GET users error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai anggota. ' + (err.message || '') });
    }
  });

  // POST /api/system/users — cipta akaun editor baharu.
  router.post('/users', requirePermission('manageAccounts'), async (req, res) => {
    try {
      const { username, email, penName, password, roles } = req.body || {};
      const u = (username || '').trim().toLowerCase();
      const e = (email || '').trim().toLowerCase();
      const pn = (penName || '').trim();
      if (!u || !e || !pn || !password) {
        return res.status(400).json({ error: 'Username, emel, nama pena dan kata laluan diperlukan.' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Kata laluan mesti sekurang-kurangnya 8 aksara.' });
      }
      const rolesToAssign = Array.isArray(roles) ? roles.filter((r) => ROLE_IDS_SAH.includes(r)) : [];
      if (rolesToAssign.length === 0) {
        return res.status(400).json({ error: 'Pilih sekurang-kurangnya satu peranan.' });
      }

      const existing = await dbGet('SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?', [u, e]);
      if (existing) {
        return res.status(409).json({ error: 'Username atau emel sudah digunakan.' });
      }

      const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const kini = new Date().toISOString();
      await dbRun(
        `INSERT INTO users (id, username, email, role, penName, isSuspended, status, password, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 0, 'Aktif', ?, ?, ?)`,
        // `role` legasi diisi ikut peranan tertinggi yang dipilih, sekadar untuk paparan lama —
        // sumber kebenaran sebenar ialah user_roles di bawah.
        [id, u, e, rolesToAssign.includes('ketua_editor') ? 'KETUA_EDITOR' : 'EDITOR', pn, hashPassword(password), kini, kini]
      );
      for (const roleId of rolesToAssign) {
        await dbRun('INSERT OR IGNORE INTO user_roles (userId, roleId) VALUES (?, ?)', [id, roleId]);
      }

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'cipta-akaun',
        targetType: 'akaun',
        targetId: id,
        detail: `${pn} (${u}) — peranan: ${rolesToAssign.join(', ')}`,
      });

      res.json({ success: true, id });
    } catch (err) {
      console.error('POST users error:', err);
      res.status(500).json({ error: 'Gagal mencipta akaun. ' + (err.message || '') });
    }
  });

  // PATCH /api/system/users/:id/status — Aktif/Cuti/Tidak Aktif/Ditamatkan.
  router.patch('/users/:id/status', requirePermission('manageAccounts'), async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body || {};
      if (!STATUS_SAH.includes(status)) {
        return res.status(400).json({ error: `Status tidak sah. Guna salah satu: ${STATUS_SAH.join(', ')}.` });
      }
      const sedia = await dbGet('SELECT id, penName, username, status AS statusLama FROM users WHERE id = ?', [id]);
      if (!sedia) return res.status(404).json({ error: 'Akaun tidak dijumpai.' });

      // isSuspended (disemak semasa log masuk, authRoutes.js) diselaraskan ikut status — Tidak
      // Aktif/Ditamatkan menyekat log masuk, Aktif/Cuti tidak.
      const isSuspended = (status === 'Tidak Aktif' || status === 'Ditamatkan') ? 1 : 0;
      await dbRun('UPDATE users SET status = ?, isSuspended = ?, updatedAt = ? WHERE id = ?', [status, isSuspended, new Date().toISOString(), id]);

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: `status-akaun:${status}`,
        targetType: 'akaun',
        targetId: id,
      });

      // Notifikasi Sistem (Fasa 6b) — akaun digantung/diaktifkan semula. Keputusan Izzat: setiap
      // editor terima notis akaun-SENDIRI, Ketua Editor/Pentadbir terima notis akaun-LAIN.
      const digantung = isSuspended === 1;
      await notify(dbRun, {
        userId: id,
        type: digantung ? 'sistem_akaun_digantung' : 'sistem_akaun_diaktifkan',
        title: digantung ? 'Akaun anda telah digantung' : 'Akaun anda telah diaktifkan semula',
        detail: `Status akaun kini: ${status}`,
        targetType: 'akaun',
        targetId: id,
      });
      const pentadbirRows = await dbAll("SELECT DISTINCT userId FROM user_roles WHERE roleId IN ('pentadbir', 'ketua_editor')");
      const penerimaLain = (pentadbirRows || [])
        .map((r) => r.userId)
        .filter((uid) => uid !== id && uid !== req.session?.user?.id);
      await notifyMany(dbRun, penerimaLain, {
        type: digantung ? 'sistem_akaun_digantung' : 'sistem_akaun_diaktifkan',
        title: `${sedia.penName || sedia.username}: status akaun ditukar ke ${status}`,
        detail: `Ditukar oleh ${req.session?.user?.penName || req.session?.user?.username || 'sistem'}.`,
        targetType: 'akaun',
        targetId: id,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('PATCH user status error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini status. ' + (err.message || '') });
    }
  });

  // PATCH /api/system/users/:id/roles — ganti SELURUH set peranan akaun (satu akaun boleh
  // pegang berbilang — cth Izzat Pentadbir + Ketua Editor serentak).
  router.patch('/users/:id/roles', requirePermission('manageAccounts'), async (req, res) => {
    try {
      const { id } = req.params;
      const { roles } = req.body || {};
      if (!Array.isArray(roles) || roles.some((r) => !ROLE_IDS_SAH.includes(r))) {
        return res.status(400).json({ error: `Peranan tidak sah. Guna gabungan: ${ROLE_IDS_SAH.join(', ')}.` });
      }
      if (roles.length === 0) {
        return res.status(400).json({ error: 'Akaun mesti pegang sekurang-kurangnya satu peranan.' });
      }
      const sedia = await dbGet('SELECT id FROM users WHERE id = ?', [id]);
      if (!sedia) return res.status(404).json({ error: 'Akaun tidak dijumpai.' });

      await dbRun('DELETE FROM user_roles WHERE userId = ?', [id]);
      for (const roleId of roles) {
        await dbRun('INSERT OR IGNORE INTO user_roles (userId, roleId) VALUES (?, ?)', [id, roleId]);
      }
      // `role` legasi diselaraskan sekali untuk paparan lama (Indeks dsb.) — bukan sumber
      // kebenaran, cuma elak label ketinggalan zaman.
      await dbRun('UPDATE users SET role = ?, updatedAt = ? WHERE id = ?', [roles.includes('ketua_editor') ? 'KETUA_EDITOR' : 'EDITOR', new Date().toISOString(), id]);

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'ubah-peranan',
        targetType: 'akaun',
        targetId: id,
        detail: `peranan baharu: ${roles.join(', ')}`,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('PATCH user roles error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini peranan. ' + (err.message || '') });
    }
  });

  return router;
}

export default createUserAdminRoutes;
