import express from 'express';
import crypto from 'crypto';
import { requireAuth, requirePermission } from '../middleware/auth.js';

// Password hashing — scrypt via Node's built-in crypto. Format: "scrypt$<saltHex>$<hashHex>".
// Existing rows predate this and still hold plaintext; verifyPassword falls back to a direct
// comparison for those and the login route below transparently re-hashes on the next successful
// login (no forced reset, no lockout risk for the one account that already exists). Exported so
// server.js's DB seeding step can hash the initial Chief Editor account's random password too.
export const hashPassword = (plain) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
};

const verifyPassword = (plain, stored) => {
  if (typeof stored === 'string' && stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$');
    const candidate = crypto.scryptSync(plain, salt, 64).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(candidate, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  // Legacy plaintext row.
  return plain === stored;
};

export function createAuthRoutes(dbGet, dbRun, dbAll) {
  const router = express.Router();

  // POST /api/auth/login
  router.post('/login', async (req, res) => {
    try {
      const { usernameOrEmail, password } = req.body;
      if (!usernameOrEmail || !password) {
        return res.status(400).json({ error: 'Username/Email and Password are required.' });
      }

      const normalized = usernameOrEmail.trim().toLowerCase();
      const userRow = await dbGet(
        "SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?",
        [normalized, normalized]
      );

      if (!userRow) {
        return res.status(404).json({ error: 'UserNotFound', message: 'User not found. Please check your credentials.' });
      }

      if (userRow.isSuspended === 1) {
        return res.status(403).json({ error: 'AccountSuspended', message: 'This account has been suspended by the editorial board.' });
      }

      if (!verifyPassword(password, userRow.password)) {
        return res.status(401).json({ error: 'IncorrectPassword', message: 'Incorrect password.' });
      }

      // Transparent migration: a legacy plaintext row that just matched gets upgraded to a real
      // hash immediately, with the same password the user already knows — no reset required.
      if (typeof userRow.password !== 'string' || !userRow.password.startsWith('scrypt$')) {
        const upgraded = hashPassword(password);
        await dbRun("UPDATE users SET password = ? WHERE id = ?", [upgraded, userRow.id]);
        userRow.password = upgraded;
      }

      // 2026-08-02 (Fasa 3) — peranan SEBENAR ialah senarai daripada `user_roles` (satu akaun
      // boleh pegang berbilang), bukan lajur `role` tunggal lagi (dikekalkan untuk paparan lama
      // sahaja). Akaun tanpa baris user_roles langsung (tak patut berlaku selepas migrasi boot,
      // tapi jaring keselamatan) jatuh balik kepada senarai kosong — tiada kebenaran istimewa.
      const roleRows = await dbAll("SELECT roleId FROM user_roles WHERE userId = ?", [userRow.id]);
      const roles = (roleRows || []).map((r) => r.roleId);

      const { password: _omit, ...userWithoutPassword } = userRow;
      const authenticatedUser = {
        ...userWithoutPassword,
        roles,
        suspended: userRow.isSuspended === 1
      };

      // Sesi sebenar di SERVER (2026-08-02) — bukan sekadar blob localStorage yang boleh
      // diubah sendiri oleh pelanggan. Regenerate dahulu supaya ID sesi lama (sebelum log
      // masuk, mungkin sudah diketahui penyerang) tidak diwarisi (session fixation).
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regenerate error:', err);
          return res.status(500).json({ error: 'Login pipeline failed' });
        }
        req.session.user = {
          id: userRow.id,
          username: userRow.username,
          email: userRow.email,
          role: userRow.role,
          roles,
          penName: userRow.penName,
        };
        res.json({ user: authenticatedUser });
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login pipeline failed' });
    }
  });

  // GET /api/auth/me — bolehkan pelanggan sahkan sesi server MASIH hidup (localStorage sahaja
  // tak boleh dipercayai — ia boleh tersasar daripada sesi sebenar bila kuki luput).
  router.get('/me', (req, res) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({ user: req.session.user });
  });

  // POST /api/auth/logout
  router.post('/logout', (req, res) => {
    if (!req.session) return res.json({ success: true });
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.clearCookie('adjung.sid');
      res.json({ success: true });
    });
  });

  // POST /api/auth/change-password — tukar kata laluan SENDIRI, perlu tahu kata laluan lama.
  router.post('/change-password', requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Kata laluan semasa dan baharu diperlukan.' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Kata laluan baharu mesti sekurang-kurangnya 8 aksara.' });
      }
      const userRow = await dbGet("SELECT * FROM users WHERE id = ?", [req.session.user.id]);
      if (!userRow || !verifyPassword(currentPassword, userRow.password)) {
        return res.status(401).json({ error: 'Kata laluan semasa tidak tepat.' });
      }
      await dbRun("UPDATE users SET password = ? WHERE id = ?", [hashPassword(newPassword), userRow.id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ error: 'Gagal menukar kata laluan.' });
    }
  });

  // POST /api/auth/reset-password — DAHULU terbuka sepenuhnya (emel sahaja, tiada token,
  // tiada bukti pemilikan akaun — sesiapa yang tahu emel editor boleh tukar kata laluan
  // editor itu). Kini perlu kebenaran `manageAccounts` (domain Pentadbir, 2026-08-02 Fasa 3 —
  // urus akaun editor lain bukan lagi disamakan dengan identiti Ketua Editor), untuk set semula
  // kata laluan editor lain (akaun terkunci, editor lupa kata laluan). Ini penyelesaian interim:
  // penghantaran emel bertoken (jemputan/reset sebenar) belum ada infrastruktur SMTP — lihat
  // PELAN_PRA_LAUNCH.md Fasa 1.
  router.post('/reset-password', requirePermission('manageAccounts'), async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Kata laluan mesti sekurang-kurangnya 8 aksara.' });
      }

      const normalized = email.trim().toLowerCase();
      const userRow = await dbGet(
        "SELECT * FROM users WHERE LOWER(email) = ?",
        [normalized]
      );

      if (!userRow) {
        return res.status(404).json({ error: 'UserNotFound', message: 'User with this email was not found.' });
      }

      await dbRun(
        "UPDATE users SET password = ? WHERE id = ?",
        [hashPassword(password), userRow.id]
      );

      res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Reset password failed.' });
    }
  });

  return router;
}
