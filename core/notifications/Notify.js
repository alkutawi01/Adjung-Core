// Notify (2026-08-02, Fasa 6b) — bekas sejawat `core/audit/AuditLog.js`'s logAudit(): satu fungsi
// kongsi supaya setiap laluan yang patut memberitahu editor (kandungan disiar/ditolak, penugasan
// slot, RSS/cuaca gagal, kata laluan ditukar, akaun digantung/diaktifkan) menulis SATU baris
// konsisten ke jadual `notifications` PER-EDITOR — bukan setiap laluan reka format sendiri.
//
// Beza dengan logAudit(): logAudit ialah jejak audit sistem (satu baris, semua orang boleh
// lihat di Log Audit). Notify() ialah PER-PENGGUNA — satu baris SATU pengguna, status baca/belum
// baca sendiri, untuk Peti Makluman. Sesuatu tindakan selalunya panggil KEDUA-DUANYA.
//
// Kumpul (dbGet, opsyenal, 2026-08-16, permintaan Izzat + audit ChatGPT "notification hygiene")
// — kegagalan berulang (cth RSS sumber sama gagal setiap 5 minit) SEBELUM ni cipta SATU baris
// baharu SETIAP kali, banjir Peti Makluman dgn "kejadian" yang sebenarnya SATU insiden berterusan.
// Bila `kumpul: true` dihantar, cari notifikasi jenis+sasaran SAMA yang masih belum dibaca —
// kalau jumpa, KEMASKINI baris tu (naikkan kiraan + tarikh terkini) drpd INSERT baris baharu.
// Bila editor tanda dibaca (isRead=1), kejadian SETERUSNYA akan mula baris baharu (insiden baharu
// selepas editor dah nampak yang lama) — bukan skema/lajur baharu, guna corak carian sedia ada.
const padanKiraan = (detail) => (detail || '').match(/\((\d+) kali sejak ([^)]+)\)$/);

export async function notify(dbRun, dbGetOrPayload, payloadArg) {
  // Keserasian belakang — panggilan lama notify(dbRun, payload) tanpa dbGet (tiada kumpul)
  // terus berfungsi macam biasa.
  const ada3Argumen = payloadArg !== undefined;
  const dbGet = ada3Argumen ? dbGetOrPayload : null;
  const payload = ada3Argumen ? payloadArg : dbGetOrPayload;
  const { userId, type, title, detail, targetType, targetId, kumpul } = payload;
  if (!userId || !type || !title) return;
  try {
    const kiniIso = new Date().toISOString();
    if (kumpul && dbGet && targetId) {
      const sedia = await dbGet(
        `SELECT id, detail, createdAt FROM notifications
         WHERE userId = ? AND type = ? AND targetId = ? AND isRead = 0
         ORDER BY createdAt DESC LIMIT 1`,
        [userId, type, targetId]
      );
      if (sedia) {
        const padanan = padanKiraan(sedia.detail);
        const kiraanBaharu = padanan ? parseInt(padanan[1], 10) + 1 : 2;
        const mulaSejak = padanan ? padanan[2] : new Date(sedia.createdAt).toLocaleString('ms-MY');
        await dbRun(
          `UPDATE notifications SET detail = ?, createdAt = ? WHERE id = ?`,
          [`${detail || title} (${kiraanBaharu} kali sejak ${mulaSejak})`, kiniIso, sedia.id]
        );
        return;
      }
    }
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
        kiniIso,
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
// dbGet opsyenal (2026-08-16) — diteruskan terus ke notify() untuk sokong `kumpul`.
export async function notifyMany(dbRun, userIds, payload, dbGet) {
  const unik = [...new Set((userIds || []).filter(Boolean))];
  for (const userId of unik) {
    if (dbGet) await notify(dbRun, dbGet, { ...payload, userId });
    else await notify(dbRun, { ...payload, userId });
  }
}

// Beritahu PELULUS kandungan (2026-08-08, audit aliran penerbitan) — Ketua Editor dan Penolong
// Ketua Editor, iaitu peranan yang benar-benar boleh meluluskan kandungan Menunggu. SENGAJA bukan
// beritahuPentadbirDanKetuaEditor() (slotRoutes.js/systemRoutes.js): Pentadbir tiada kebenaran
// `manageEditorial` (lihat DEFAULT_ROLE_PERMISSIONS, core/middleware/auth.js), jadi memberitahunya
// tentang giliran kelulusan cuma bunyi bising — dia tak boleh bertindak ke atasnya.
//
// Sebelum ni notifikasi kandungan HANYA pergi kepada editor slot dan penulis asal, jadi kandungan
// boleh duduk dalam giliran Menunggu tanpa had sehingga Ketua Editor terfikir untuk semak Indeks
// sendiri — tiada isyarat langsung yang ada kerja menunggu keputusan dia.
export async function beritahuPelulusKandungan(dbAll, dbRun, payload) {
  const rows = await dbAll(
    "SELECT DISTINCT userId FROM user_roles WHERE roleId IN ('ketua_editor', 'penolong_ketua_editor')"
  );
  await notifyMany(dbRun, (rows || []).map((r) => r.userId), payload);
}

export default notify;
