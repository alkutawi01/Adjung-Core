import express from 'express';
import crypto from 'crypto';

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

export function createAuthRoutes(dbGet, dbRun) {
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

      const { password: _omit, ...userWithoutPassword } = userRow;
      const authenticatedUser = {
        ...userWithoutPassword,
        suspended: userRow.isSuspended === 1
      };

      res.json({ user: authenticatedUser });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login pipeline failed' });
    }
  });

  // POST /api/auth/reset-password
  router.post('/reset-password', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
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
