// Notify (2026-08-02, Fasa 6b) — bekas sejawat `core/audit/AuditLog.js`'s logAudit(): satu fungsi
// kongsi supaya setiap laluan yang patut memberitahu editor (kandungan disiar/ditolak, penugasan
// slot, RSS/cuaca gagal, kata laluan ditukar, akaun digantung/diaktifkan) menulis SATU baris
// konsisten ke jadual `notifications` PER-EDITOR — bukan setiap laluan reka format sendiri.
//
// Beza dengan logAudit(): logAudit ialah jejak audit sistem (satu baris, semua orang boleh
// lihat di Log Audit). Notify() ialah PER-PENGGUNA — satu baris SATU pengguna, status baca/belum
// baca sendiri, untuk Peti Makluman. Sesuatu tindakan selalunya panggil KEDUA-DUANYA.
export async function notify(dbRun, { userId, type, title, detail, targetType, targetId }) {
  if (!userId || !type || !title) return;
  try {
    await dbRun(
      `INSERT INTO notifications (id, userId, type, title, detail, targetType, targetId, isRead, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        type,
        title,
        detail || null,
        targetType || null,
        targetId || null,
        new Date().toISOString(),
      ]
    );
  } catch (err) {
    // Kegagalan menulis notifikasi TIDAK BOLEH menggagalkan tindakan sebenar (terbit/tolak/dsb.) —
    // sama prinsip macam logAudit(), notifikasi ialah rekod sampingan.
    console.error('Gagal menulis notifikasi:', err.message);
  }
}

// Hantar notis SAMA kepada berbilang pengguna (cth semua editor sesuatu slot). Set() buang
// duplikat/kosong dahulu supaya seorang editor tak terima dua notis sama untuk satu tindakan.
export async function notifyMany(dbRun, userIds, payload) {
  const unik = [...new Set((userIds || []).filter(Boolean))];
  for (const userId of unik) {
    await notify(dbRun, { ...payload, userId });
  }
}

export default notify;
