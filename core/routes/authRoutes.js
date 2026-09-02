import express from 'express';
import crypto from 'crypto';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { notify } from '../notifications/Notify.js';
import { hantarEmel } from '../email/MailSender.js';
import { semakStatusToken, janaTokenTamatTempoh, STATUS_TOKEN, perluTetapkanIdentiti } from '../auth/TokenLaluan.js';
import { logAudit } from '../audit/AuditLog.js';
import { baseUrlEmel } from '../utils/baseUrl.js';
import { padamSesiPengguna } from '../auth/SesiPengguna.js';

// Password hashing — scrypt via Node's built-in crypto. Format: "scrypt$<saltHex>$<hashHex>".
// Exported so server.js's DB seeding step can hash the initial Chief Editor account's random
// password too.
//
// 2026-08-02 (Fasa 1 cleanup): plaintext-row fallback removed — confirmed via direct DB query
// that every existing account is already scrypt-hashed, and both account-creation paths (seed
// in server.js, POST /api/system/users in userAdminRoutes.js) already call hashPassword()
// unconditionally, so a plaintext row can no longer be created going forward either. If this
// ever needs reintroducing (e.g. a raw DB import), diff against git history for the old fallback.
export const hashPassword = (plain) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
};

const verifyPassword = (plain, stored) => {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false;
  const [, salt, hash] = stored.split('$');
  const candidate = crypto.scryptSync(plain, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(candidate, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export function createAuthRoutes(dbGet, dbRun, dbAll) {
  const router = express.Router();

  // POST /api/auth/login
  router.post('/login', async (req, res) => {
    try {
      const { usernameOrEmail, password } = req.body;
      if (!usernameOrEmail || !password) {
        return res.status(400).json({ error: 'Nama pengguna/emel dan kata laluan diperlukan.' });
      }

      const normalized = usernameOrEmail.trim().toLowerCase();
      const userRow = await dbGet(
        "SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?",
        [normalized, normalized]
      );

      // Anti-enumerasi akaun (2026-08-07, Pelan 02 #10) — dahulu akaun tidak wujud pulangkan 404
      // "Pengguna tidak dijumpai" manakala kata laluan salah pulangkan 401, jadi sesiapa boleh
      // menyenaraikan emel/nama pengguna yang berdaftar. Kini KEDUA-DUA kes pulangkan mesej dan
      // kod status yang SAMA (selaras falsafah sedia ada di /lupa-kata-laluan). Status penggantungan
      // pula hanya didedahkan SELEPAS kata laluan betul — jika tidak, ia bocor kewujudan akaun juga.
      const gagalLogMasuk = () => res.status(401).json({
        error: 'Butiran log masuk tidak tepat',
        message: 'Butiran log masuk tidak tepat. Sila semak nama pengguna/emel dan kata laluan anda.',
      });

      if (!userRow) {
        return gagalLogMasuk();
      }

      if (!verifyPassword(password, userRow.password)) {
        return gagalLogMasuk();
      }

      if (userRow.isSuspended === 1) {
        return res.status(403).json({ error: 'Akaun digantung', message: 'Akaun ini telah digantung oleh sidang editorial.' });
      }

      // 2026-08-02 (Fasa 3) — peranan SEBENAR ialah senarai daripada `user_roles` (satu akaun
      // boleh pegang berbilang), bukan lajur `role` tunggal lagi (dikekalkan untuk paparan lama
      // sahaja). Akaun tanpa baris user_roles langsung (tak patut berlaku selepas migrasi boot,
      // tapi jaring keselamatan) jatuh balik kepada senarai kosong — tiada kebenaran istimewa.
      const roleRows = await dbAll("SELECT roleId FROM user_roles WHERE userId = ?", [userRow.id]);
      const roles = (roleRows || []).map((r) => r.roleId);

      // 2026-09-02 (bug-hunt) — dahulu cuma `password` ditapis drpd baris `SELECT *` penuh,
      // jadi `resetToken`/`resetTokenExpiresAt` (token set-semula kata laluan sebenar, jika
      // akaun ada permohonan "lupa kata laluan" belum digunakan) turut terikut ke respons JSON
      // /login — dibaca sesiapa yang buka Network tab pelanggan sendiri. Sama corak kebocoran
      // yang sudah dibaiki di db-state.js ("tutup kebocoran resetToken di db-state") tapi
      // terlepas di sini; disahkan grep `src/` kosong — tiada kod klien pernah baca medan ni.
      const { password: _omit, resetToken: _rt, resetTokenExpiresAt: _rte, ...userWithoutPassword } = userRow;
      const authenticatedUser = {
        ...userWithoutPassword,
        roles,
        suspended: userRow.isSuspended === 1,
        // autoTerbit (2026-08-28) — dibaca client-side sahaja utk keputusan "Simpan sebagai
        // draf" vs terbit terus (SlotManagerModal.tsx); tiada gerbang kebenaran pelayan baharu.
        autoTerbit: userRow.autoTerbit === 1,
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
      return res.status(401).json({ error: 'Tidak dibenarkan' });
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
      // Usir semua sesi LAIN akaun ni (2026-08-07, Pelan 02 #11) — sesi semasa pengguna sendiri
      // dikecualikan supaya dia tidak dilog keluar oleh tindakannya sendiri.
      await padamSesiPengguna(userRow.id, req.sessionID);
      // Notifikasi Sistem (Fasa 6b) — editor sendiri patut tahu bila kata laluan akaunnya
      // ditukar, walaupun dia sendiri yang buat (jejak keselamatan mudah, bukan sekadar
      // andaian yang buat mesti ingat).
      await notify(dbRun, {
        userId: userRow.id,
        type: 'sistem_kata_laluan_ditukar',
        title: 'Kata laluan anda telah ditukar',
        detail: 'Kata laluan akaun anda berjaya dikemas kini.',
        targetType: 'akaun',
        targetId: userRow.id,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ error: 'Gagal menukar kata laluan.' });
    }
  });

  // POST /api/auth/change-username — tukar username SENDIRI (2026-08-02, Fasa 6b). Keputusan
  // Izzat: sama corak pengesahan macam change-password (kata laluan semasa wajib), wajib semak
  // keunikan (case-insensitive, sama corak carian log masuk `LOWER(username) = ?`) sebelum simpan.
  router.post('/change-username', requireAuth, async (req, res) => {
    try {
      const { currentPassword, newUsername } = req.body || {};
      if (!currentPassword || !newUsername) {
        return res.status(400).json({ error: 'Kata laluan semasa dan username baharu diperlukan.' });
      }
      const next = newUsername.trim().toLowerCase();
      if (next.length < 3) {
        return res.status(400).json({ error: 'Username mesti sekurang-kurangnya 3 aksara.' });
      }
      const userRow = await dbGet("SELECT * FROM users WHERE id = ?", [req.session.user.id]);
      if (!userRow || !verifyPassword(currentPassword, userRow.password)) {
        return res.status(401).json({ error: 'Kata laluan semasa tidak tepat.' });
      }
      if (next === (userRow.username || '').toLowerCase()) {
        return res.status(400).json({ error: 'Username baharu sama dengan username semasa.' });
      }
      // Semak MERENTASI username DAN email (2026-08-08, dapatan audit keselamatan ChatGPT) —
      // dahulu cuma semak lajur username, walhal log masuk padan `LOWER(username) = ? OR
      // LOWER(email) = ?` (satu ruang nama gabungan) dan POST /users (cipta akaun) dah pun semak
      // dua-dua. Tanpa ni, Editor B boleh tukar username kepada emel Editor A — log masuk lepas
      // ni jadi taksa (dua baris padan carian yang sama).
      const bertembung = await dbGet("SELECT id FROM users WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND id != ?", [next, next, userRow.id]);
      if (bertembung) {
        return res.status(409).json({ error: 'Username ini sudah digunakan akaun lain (sebagai username atau emel).' });
      }
      try {
        await dbRun("UPDATE users SET username = ?, updatedAt = ? WHERE id = ?", [next, new Date().toISOString(), userRow.id]);
      } catch (errUpdate) {
        // Lapisan pertahanan kedua (2026-08-08) — indeks UNIQUE username peringkat DB (jaring
        // terakhir) tangkap perlumbaan yang terlepas semakan di atas; pulangkan 409 mesra, bukan
        // 500 mentah.
        if (/UNIQUE constraint failed/i.test(errUpdate.message || '')) {
          return res.status(409).json({ error: 'Username ini sudah digunakan akaun lain.' });
        }
        throw errUpdate;
      }
      // Sesi server simpan salinan username untuk paparan header — segarkan serta-merta supaya
      // tak lapuk sehingga log masuk semula.
      if (req.session.user) req.session.user.username = next;
      res.json({ success: true, username: next });
    } catch (err) {
      console.error('Change username error:', err);
      res.status(500).json({ error: 'Gagal menukar username.' });
    }
  });

  // POST /api/auth/change-email — tukar emel SENDIRI (2026-08-02, Fasa 6b). Sama corak seperti
  // change-username.
  router.post('/change-email', requireAuth, async (req, res) => {
    try {
      const { currentPassword, newEmail } = req.body || {};
      if (!currentPassword || !newEmail) {
        return res.status(400).json({ error: 'Kata laluan semasa dan emel baharu diperlukan.' });
      }
      const next = newEmail.trim().toLowerCase();
      const emelSah = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next);
      if (!emelSah) {
        return res.status(400).json({ error: 'Format emel tidak sah.' });
      }
      const userRow = await dbGet("SELECT * FROM users WHERE id = ?", [req.session.user.id]);
      if (!userRow || !verifyPassword(currentPassword, userRow.password)) {
        return res.status(401).json({ error: 'Kata laluan semasa tidak tepat.' });
      }
      if (next === (userRow.email || '').toLowerCase()) {
        return res.status(400).json({ error: 'Emel baharu sama dengan emel semasa.' });
      }
      // Semak MERENTASI email DAN username — sama sebab macam change-username di atas.
      const bertembung = await dbGet("SELECT id FROM users WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND id != ?", [next, next, userRow.id]);
      if (bertembung) {
        return res.status(409).json({ error: 'Emel ini sudah digunakan akaun lain (sebagai emel atau username).' });
      }
      try {
        await dbRun("UPDATE users SET email = ?, updatedAt = ? WHERE id = ?", [next, new Date().toISOString(), userRow.id]);
      } catch (errUpdate) {
        // Lapisan pertahanan kedua (2026-08-08) — indeks UNIQUE email peringkat DB (ditambah
        // sesi ni) jaring terakhir; pulangkan 409 mesra, bukan 500 mentah.
        if (/UNIQUE constraint failed/i.test(errUpdate.message || '')) {
          return res.status(409).json({ error: 'Emel ini sudah digunakan akaun lain.' });
        }
        throw errUpdate;
      }
      if (req.session.user) req.session.user.email = next;
      res.json({ success: true, email: next });
    } catch (err) {
      console.error('Change email error:', err);
      res.status(500).json({ error: 'Gagal menukar emel.' });
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
        return res.status(400).json({ error: 'Emel dan kata laluan diperlukan.' });
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
        return res.status(404).json({ error: 'Pengguna tidak dijumpai', message: 'Pengguna dengan emel ini tidak dijumpai.' });
      }

      await dbRun(
        "UPDATE users SET password = ? WHERE id = ?",
        [hashPassword(password), userRow.id]
      );
      // Kata laluan editor lain ditetapkan semula oleh Pentadbir — SEMUA sesi akaun tu dibatalkan
      // (tiada pengecualian: sesi Pentadbir yang membuat tindakan ini bukan sesi akaun tersebut).
      await padamSesiPengguna(userRow.id);

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'set-semula-kata-laluan-editor',
        targetType: 'akaun',
        targetId: userRow.id,
        detail: userRow.email,
      });

      res.json({ success: true, message: 'Kata laluan berjaya dikemas kini.' });
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Set semula kata laluan gagal.' });
    }
  });

  // POST /api/auth/lupa-kata-laluan (2026-08-03, Fasa 1) — aliran SWADAYA (self-service) baharu,
  // BERBEZA daripada /reset-password di atas: di sini pengguna sendiri memohon (tiada sesi log
  // masuk), token bertempoh dihantar ke emel berdaftar akaun tu (bukan admin menaip kata laluan
  // baharu terus). /reset-password KEKAL sebagai laluan Pentadbir untuk editor terkunci tanpa
  // akses emel — dua laluan ni bersama, bukan gantian.
  //
  // Keselamatan: respons SAMA sama ada emel wujud atau tidak (anti-enumeration) — jangan sekali
  // -kali bocorkan status pendaftaran emel melalui mesej berlainan.
  router.post('/lupa-kata-laluan', async (req, res) => {
    const mesejGeneric = { message: 'Jika emel ini berdaftar, pautan set semula telah dihantar.' };
    try {
      const { email } = req.body || {};
      if (!email) return res.json(mesejGeneric);

      const normalized = email.trim().toLowerCase();
      const userRow = await dbGet("SELECT * FROM users WHERE LOWER(email) = ?", [normalized]);
      if (userRow) {
        const token = crypto.randomBytes(32).toString('hex');
        const tamatTempoh = janaTokenTamatTempoh(2); // 2 jam — lebih pendek drpd jemputan (48j)
        await dbRun(
          "UPDATE users SET resetToken = ?, resetTokenExpiresAt = ? WHERE id = ?",
          [token, tamatTempoh, userRow.id]
        );
        // URL PENUH diperlukan (bukan laluan relatif) — pautan ni dibuka daripada klien EMEL
        // (Gmail/Outlook dll), bukan pelayar yang sedang di brief.adjung.com, jadi tiada
        // konteks origin sedia ada untuk pautan relatif "menyambung" kepadanya. Corak sama
        // seperti sitemapRoutes.js punya baseUrl.
        const baseUrl = baseUrlEmel();
        const pautan = `${baseUrl}/tetapkan-kata-laluan?token=${token}`;
        await hantarEmel({
          to: userRow.email,
          subject: 'Set Semula Kata Laluan · Adjung Brief',
          html: `<p>Salam ${userRow.penName || userRow.username},</p>` +
            `<p>Kami menerima permohonan untuk menetapkan semula kata laluan akaun Adjung Brief anda. ` +
            `Klik pautan berikut (sah selama 2 jam):</p>` +
            `<p><a href="${pautan}">${pautan}</a></p>` +
            `<p>Jika anda tidak memohon set semula ini, abaikan sahaja emel ini. Kata laluan anda kekal tidak berubah.</p>`,
        });
      }
      res.json(mesejGeneric);
    } catch (err) {
      console.error('Lupa kata laluan error:', err);
      res.json(mesejGeneric);
    }
  });

  // GET /api/auth/token-info (2026-08-16, permintaan Izzat — username/nama pena kini ditetapkan
  // editor sendiri, bukan Ketua Editor) — laluan AWAM, dipanggil oleh /tetapkan-kata-laluan
  // SEBELUM borang dipapar supaya klien tahu SAMA ADA nak tunjukkan medan Nama Pena/ID Pengguna
  // (jemputan editor baharu) atau tidak (set semula kata laluan akaun sedia ada). Tak dedah
  // apa-apa maklumat akaun (bukan email/penName sedia ada) — cuma dua boolean.
  router.get('/token-info', async (req, res) => {
    try {
      const token = (req.query.token || '').toString();
      const userRow = await dbGet("SELECT username, penName, resetToken, resetTokenExpiresAt FROM users WHERE resetToken = ?", [token]);
      const status = semakStatusToken(userRow);
      if (status !== STATUS_TOKEN.SAH) {
        return res.json({ valid: false, requiresIdentity: false });
      }
      res.json({ valid: true, requiresIdentity: perluTetapkanIdentiti(userRow) });
    } catch (err) {
      console.error('Token info error:', err);
      res.status(500).json({ valid: false, requiresIdentity: false });
    }
  });

  // POST /api/auth/aktifkan-akaun (2026-08-03, Fasa 1) — laluan AWAM (tiada sesi log masuk),
  // dipakai oleh DUA aliran: tetapkan kata laluan buat pertama kali (jemputan editor baharu,
  // lihat POST /api/system/users di userAdminRoutes.js) DAN set semula kata laluan sendiri
  // (POST /lupa-kata-laluan di atas). Kedua guna token+kata laluan sahaja — token itu sendiri
  // yang membuktikan pemilikan akaun, disahkan oleh semakStatusToken().
  //
  // username/penName pilihan (2026-08-16) — HANYA diminta/disemak bila perluTetapkanIdentiti()
  // kata akaun ni jemputan baharu (username sementara/penName kosong, lihat TokenLaluan.js).
  // Akaun sedia ada (aliran lupa-kata-laluan) tak sentuh identiti langsung walaupun body ada
  // medan ni — elak identiti sedia ada tertindih tanpa sengaja oleh permintaan tersasar/lapuk.
  router.post('/aktifkan-akaun', async (req, res) => {
    try {
      const { token, password, username, penName } = req.body || {};
      if (!token || !password) {
        return res.status(400).json({ error: 'Token dan kata laluan diperlukan.' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Kata laluan mesti sekurang-kurangnya 8 aksara.' });
      }

      const userRow = await dbGet("SELECT * FROM users WHERE resetToken = ?", [token]);
      const status = semakStatusToken(userRow);
      if (status === STATUS_TOKEN.TIDAK_WUJUD) {
        return res.status(404).json({ error: 'Pautan tidak sah atau sudah digunakan.' });
      }
      if (status === STATUS_TOKEN.TAMAT_TEMPOH) {
        return res.status(410).json({ error: 'Pautan ini sudah tamat tempoh. Sila mohon pautan baharu.' });
      }

      if (perluTetapkanIdentiti(userRow)) {
        const u = (username || '').trim().toLowerCase();
        const pn = (penName || '').trim();
        if (!u || !pn) {
          return res.status(400).json({ error: 'ID pengguna dan nama pena diperlukan.' });
        }
        // Semakan pendua sama seperti dahulu di POST /api/system/users (userAdminRoutes.js) —
        // kini berlaku DI SINI sebab identiti sebenar baru wujud pada langkah ni. `!= ?` kecuali
        // baris sendiri, supaya kalau editor hantar semula/klik dua kali borang yang sama, ia
        // tak sengaja tolak diri sendiri sebagai "pendua".
        const usernameSedia = await dbGet('SELECT id FROM users WHERE LOWER(username) = ? AND id != ?', [u, userRow.id]);
        if (usernameSedia) {
          return res.status(409).json({ error: 'ID pengguna sudah digunakan akaun lain.' });
        }
        const penNameSedia = await dbGet('SELECT id FROM users WHERE LOWER(TRIM(penName)) = LOWER(?) AND id != ?', [pn, userRow.id]);
        if (penNameSedia) {
          return res.status(409).json({ error: `Nama pena "${pn}" sudah digunakan akaun lain. Pilih nama pena lain (dipakai sebagai identiti penulis kandungan, mesti unik).` });
        }
        await dbRun(
          "UPDATE users SET username = ?, penName = ?, password = ?, resetToken = NULL, resetTokenExpiresAt = NULL WHERE id = ?",
          [u, pn, hashPassword(password), userRow.id]
        );
      } else {
        await dbRun(
          "UPDATE users SET password = ?, resetToken = NULL, resetTokenExpiresAt = NULL WHERE id = ?",
          [hashPassword(password), userRow.id]
        );
      }
      // Laluan awam (tiada sesi log masuk) — batalkan SEMUA sesi akaun tu. Inilah kes paling
      // penting: kalau penceroboh sudah log masuk dengan kata laluan lama, pemilik sah yang
      // menetapkan semula kata laluannya mesti mengusir penceroboh itu serta-merta.
      await padamSesiPengguna(userRow.id);
      res.json({ success: true });
    } catch (err) {
      console.error('Aktifkan akaun error:', err);
      if (/UNIQUE constraint failed/i.test(err.message || '')) {
        return res.status(409).json({ error: 'ID pengguna sudah digunakan akaun lain.' });
      }
      res.status(500).json({ error: 'Gagal menetapkan kata laluan.' });
    }
  });

  return router;
}
