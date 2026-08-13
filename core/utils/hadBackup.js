// Dasar had saiz backup (OPS-BACKUP-001, keputusan Izzat 2026-08-13: "harian dan sebelum
// migrasi, letak limit 5gb, selebihnya padam").
//
// KEPUTUSAN diasingkan daripada PELAKSANAAN dengan sengaja: fungsi ni tulen (tiada fs), jadi
// tingkah laku memadam boleh diuji tanpa menyentuh cakera. Kod yang MEMADAM FAIL ialah kelas
// kod paling berisiko dalam projek ni — `adjung.db` gitignored dan mengandungi kandungan
// editorial yang tak boleh dijana semula (CLAUDE.md #4), jadi salah padam bermakna kehilangan
// kekal. Ia patut diuji, bukan diandaikan betul.

/** Had lalai: 5GB, seperti ditetapkan pemilik projek. */
export const HAD_SAIZ_BACKUP_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * Tentukan salinan backup mana yang patut dibuang supaya jumlah saiz kembali dalam had.
 *
 * @param {Array<{nama: string, saiz: number, masa: number}>} senarai
 *        HANYA salinan yang dicipta SISTEM (`.backup-auto-` / `.backup-boot-`). Salinan MANUAL
 *        tidak sepatutnya sampai ke sini langsung — ia dicipta manusia dengan niat khusus
 *        sebelum operasi berisiko, dan memadamnya automatik boleh memusnahkan satu-satunya
 *        salinan yang seseorang sengaja simpan.
 * @param {number} hadBytes
 * @returns {string[]} nama fail untuk dibuang, paling lama dahulu.
 */
export function pilihBackupUntukDibuang(senarai, hadBytes = HAD_SAIZ_BACKUP_BYTES) {
  if (!Array.isArray(senarai) || senarai.length === 0) return [];
  if (typeof hadBytes !== 'number' || !Number.isFinite(hadBytes) || hadBytes <= 0) return [];

  const sah = senarai.filter(
    (s) => s && typeof s.nama === 'string' && Number.isFinite(s.saiz) && Number.isFinite(s.masa)
  );
  if (sah.length <= 1) return []; // satu salinan sahaja: jangan sekali-kali buang yang terakhir

  const ikutMasa = [...sah].sort((a, b) => a.masa - b.masa); // paling lama dahulu
  let jumlah = ikutMasa.reduce((n, s) => n + s.saiz, 0);
  if (jumlah <= hadBytes) return [];

  const dibuang = [];
  // `slice(0, -1)`: salinan TERBARU sentiasa dikekalkan, walaupun ia seorang diri melebihi had.
  // Lebih baik melebihi had daripada langsung tiada backup.
  for (const s of ikutMasa.slice(0, -1)) {
    if (jumlah <= hadBytes) break;
    dibuang.push(s.nama);
    jumlah -= s.saiz;
  }
  return dibuang;
}
