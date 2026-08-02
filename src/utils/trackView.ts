// Jejak pengunjung & populariti (Fasa 14) — panggilan terlepas-pandang (fire-and-forget) ke
// POST /api/system/track-view. Dibina sendiri, tiada pihak ketiga, tiada cookie, tiada
// IP/user-agent — cuma "berapa kali X dilihat hari ini", agregat anonim, dalam adjung.db.
//
// MESTI tidak pernah pecahkan pengalaman pembaca: tiada await menyekat UI, tiada ralat
// dipaparkan, kegagalan rangkaian/pelayan diabaikan senyap.
export function trackView(targetType: 'homepage' | 'slot', targetId: string | number): void {
  try {
    fetch('/api/system/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId: String(targetId) }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // senyap — penjejakan tak boleh pecahkan pembacaan
  }
}
