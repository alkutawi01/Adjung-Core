// Pengesahan sesi (2026-08-02, Fasa 1) — sebelum ini SIFAR laluan API dilindungi; sesiapa
// yang boleh capai server boleh terbit/padam/ubah tetapan tanpa log masuk. Sesi kini disimpan
// di SERVER (express-session, kuki httpOnly) — bukan sekadar blob localStorage yang boleh
// diubah sendiri oleh pelanggan untuk menyamar sebagai KETUA_EDITOR.

// GET/HEAD/OPTIONS sentiasa dibenarkan tanpa sesi — Frontpage ialah portal AWAM, ia mesti
// terus boleh baca kandungan tanpa log masuk. Hanya kaedah yang MENGUBAH data disekat.
const isSafeMethod = (method) => method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

export function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Log masuk diperlukan.' });
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Log masuk diperlukan.' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Tiada kebenaran untuk tindakan ini.' });
    }
    next();
  };
}

// Untuk mount laluan yang perlu kekal AWAM pada GET (bacaan Frontpage) tetapi disekat pada
// tindakan mengubah data (POST/PUT/PATCH/DELETE).
export function requireAuthForWrites(req, res, next) {
  if (isSafeMethod(req.method)) return next();
  return requireAuth(req, res, next);
}

export function requireRoleForWrites(...roles) {
  const roleGate = requireRole(...roles);
  return (req, res, next) => {
    if (isSafeMethod(req.method)) return next();
    return roleGate(req, res, next);
  };
}
