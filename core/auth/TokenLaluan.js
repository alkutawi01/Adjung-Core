// Pengesahan token set/reset kata laluan (2026-08-03, Fasa 1) — dipakai oleh DUA aliran:
// jemputan editor baharu (tetapkan kata laluan buat pertama kali) dan lupa-kata-laluan
// (set semula kata laluan sendiri). Logik tulen diasingkan daripada laluan HTTP supaya boleh
// diuji terus tanpa DB/rangkaian sebenar — sama corak seperti core/editorial/Scheduling.js's
// isDue()/hasReplacementForExpiry().

export const STATUS_TOKEN = {
  SAH: 'sah',
  TIDAK_WUJUD: 'tidak_wujud',
  TAMAT_TEMPOH: 'tamat_tempoh',
};

// userRow: baris `users` yang dijumpai melalui carian `WHERE resetToken = ?` (atau
// null/undefined jika langsung tiada padanan — token salah/sudah digunakan, sebab token
// dikosongkan (NULL) selepas berjaya dipakai).
export function semakStatusToken(userRow, nowMs = Date.now()) {
  if (!userRow || !userRow.resetToken) return STATUS_TOKEN.TIDAK_WUJUD;
  if (!userRow.resetTokenExpiresAt) return STATUS_TOKEN.TAMAT_TEMPOH;
  const tamat = new Date(userRow.resetTokenExpiresAt).getTime();
  if (Number.isNaN(tamat) || nowMs > tamat) return STATUS_TOKEN.TAMAT_TEMPOH;
  return STATUS_TOKEN.SAH;
}

// Jana cap masa tamat tempoh ISO, `jamTempoh` jam dari `fromMs` (lalai: sekarang).
export function janaTokenTamatTempoh(jamTempoh, fromMs = Date.now()) {
  return new Date(fromMs + jamTempoh * 60 * 60 * 1000).toISOString();
}
