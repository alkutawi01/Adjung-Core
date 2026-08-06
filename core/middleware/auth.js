// Pengesahan sesi + kebenaran berasaskan peranan (2026-08-02, Fasa 1 → Fasa 3).
//
// Fasa 1: sesi sebenar di server (express-session, kuki httpOnly) — sebelum itu sesi hanya
// blob localStorage yang boleh diubah sendiri oleh pelanggan.
//
// Fasa 3 (RBAC berbilang peranan): Izzat nak EMPAT peranan (Pentadbir, Ketua Editor, Penolong/
// Timbalan Ketua Editor, Editor), SATU akaun boleh pegang BERBILANG peranan serentak, dan
// kebenaran setiap peranan mesti boleh diubah MELALUI KLIK (jadual "Kawalan Akses" di Tetapan,
// TetapanConsole.tsx), BUKAN dikodkan keras dalam fail ni. Jadi `requireRole('KETUA_EDITOR')`
// Fasa 1 (semakan identiti peranan tegar) digantikan sepenuhnya dengan `requirePermission(key)`
// — semak kebenaran SEBENAR daripada matriks tersimpan di `system_settings.rolePermissions`,
// dimuat semula dalam-memori setiap kali disimpan (corak sama seperti loadAmSettings/
// loadTierOverrides di core/routes/slotAmRoutes.js dan tierSettingsRoutes.js).

const isSafeMethod = (method) => method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

export function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Sesi anda telah tamat — sila log masuk semula.', message: 'Log masuk diperlukan.' });
  }
  next();
}

export function requireAuthForWrites(req, res, next) {
  if (isSafeMethod(req.method)) return next();
  return requireAuth(req, res, next);
}

// Lalai kebenaran (2026-08-02) — dipakai HANYA bila `system_settings.rolePermissions` masih
// kosong (pemasangan baharu, sebelum Izzat sempat sunting jadual Kawalan Akses). MESTI sepadan
// DEFAULT_RBAC_MATRIX di src/components/editorium/TetapanConsole.tsx — kalau salah satu diubah,
// ubah yang satu lagi.
const ROLE_IDS = ['pentadbir', 'ketua_editor', 'penolong_ketua_editor', 'editor'];
const DEFAULT_ROLE_PERMISSIONS = {
  pentadbir: {
    viewAll: true, editOwn: false, editAll: false, publish: false, reject: false,
    assignSlot: false, manageSettings: true, manageRbac: true,
    manageEditorial: false, manageAccounts: true, manageEditorNotes: false,
    viewAuditLog: true,
  },
  ketua_editor: {
    viewAll: true, editOwn: true, editAll: true, publish: true, reject: true,
    assignSlot: true, manageSettings: false, manageRbac: false,
    manageEditorial: true, manageAccounts: false, manageEditorNotes: true,
    viewAuditLog: true,
  },
  penolong_ketua_editor: {
    viewAll: true, editOwn: true, editAll: true, publish: true, reject: true,
    assignSlot: true, manageSettings: false, manageRbac: false,
    manageEditorial: true, manageAccounts: false, manageEditorNotes: false,
    viewAuditLog: true,
  },
  editor: {
    viewAll: true, editOwn: true, editAll: false, publish: true, reject: false,
    assignSlot: false, manageSettings: false, manageRbac: false,
    manageEditorial: false, manageAccounts: false, manageEditorNotes: false,
    viewAuditLog: false,
  },
};

// Cache dalam-memori — disegarkan semula bila matriks disimpan (lihat reloadRolePermissions()
// dipanggil dari systemRoutes.js selepas PATCH /api/system/settings). Pemeriksaan kebenaran
// (requirePermission) MESTI segerak (bukan tunggu DB setiap permintaan), sama corak seperti
// validateContentBudget baca cache had aksara tier dalam-memori.
let cachedPermissions = { ...DEFAULT_ROLE_PERMISSIONS };

const parseStoredMatrix = (rolePermissionsRaw) => {
  if (!Array.isArray(rolePermissionsRaw) || rolePermissionsRaw.length === 0) return null;
  const out = {};
  for (const row of rolePermissionsRaw) {
    if (!row || !row.roleId || !row.permissions) continue;
    out[row.roleId] = row.permissions;
  }
  // 2026-08-02 — matriks tersimpan boleh jadi LAPUK dua cara: (1) SATU BARIS peranan langsung
  // tiada (cth Pentadbir/Penolong Ketua Editor belum wujud lagi semasa disimpan kali terakhir),
  // (2) baris peranan WUJUD tapi KUNCI kebenaran baharu tiada di dalamnya (cth
  // manageEditorial/manageAccounts/manageEditorNotes ditambah Fasa 3 selepas matriks lama
  // disimpan — pepijat sebenar ditemui semasa ujian: Ketua Editor ditolak manageEditorial sebab
  // baris tersimpannya cuma ada 8 kunci lama, hilang terus 3 kunci baharu, jadi
  // permissions.manageEditorial === undefined, bukan false/true). Gabung KUNCI, bukan cuma
  // BARIS — setiap peranan dapat lalai kunci yang hilang, kunci sedia ada (ditanda/nyahtanda
  // Pentadbir) kekal dihormati.
  for (const roleId of ROLE_IDS) {
    out[roleId] = { ...DEFAULT_ROLE_PERMISSIONS[roleId], ...(out[roleId] || {}) };
  }
  return out;
};

export async function loadRolePermissions(dbGet) {
  try {
    const row = await dbGet("SELECT rolePermissions FROM system_settings WHERE id = 'settings-main'");
    const raw = row && row.rolePermissions ? JSON.parse(row.rolePermissions) : null;
    cachedPermissions = parseStoredMatrix(raw) || { ...DEFAULT_ROLE_PERMISSIONS };
  } catch (e) {
    console.error('Gagal memuatkan matriks kebenaran peranan, guna lalai:', e.message);
    cachedPermissions = { ...DEFAULT_ROLE_PERMISSIONS };
  }
}

// Adakah mana-mana peranan dalam senarai `roles` (satu pengguna boleh pegang berbilang) benarkan
// `permKey`? Dieksport (bukan cuma dalaman) sebab sesetengah laluan perlu logik bersyarat (cth
// "pemilik sendiri ATAU manageAccounts", lihat profileRoutes.js) — bukan sekadar gerbang tegar.
export const hasPermission = (roles, permKey) => {
  if (!Array.isArray(roles)) return false;
  return roles.some((roleId) => cachedPermissions[roleId] && cachedPermissions[roleId][permKey] === true);
};

export function requirePermission(permKey) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Sesi anda telah tamat — sila log masuk semula.', message: 'Log masuk diperlukan.' });
    }
    if (!hasPermission(req.session.user.roles, permKey)) {
      return res.status(403).json({ error: 'Anda tiada kebenaran untuk tindakan ini.', message: 'Tiada kebenaran untuk tindakan ini.' });
    }
    next();
  };
}

export function requirePermissionForWrites(permKey) {
  const gate = requirePermission(permKey);
  return (req, res, next) => {
    if (isSafeMethod(req.method)) return next();
    return gate(req, res, next);
  };
}
