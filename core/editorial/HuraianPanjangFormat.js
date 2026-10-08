// Subtajuk dalam Huraian panjang (2026-10-06, keputusan Izzat — "artikel semata-mata tanpa
// subtajuk, bosan, pembaca langkau je"). SATU baris yang bermula dengan "## " ialah subtajuk;
// baris lain kekal perenggan biasa (satu baris = satu perenggan, sama seperti sebelum ini).
// Tiada medan baharu dan tiada perubahan skema — huraian panjang kekal SATU rentetan teks.
//
// Modul TULEN (tiada kebergantungan DOM/Node), diimport terus oleh pelayan (ContentBudget.js,
// server.js, articleUrlRoutes.js) DAN klien (FocusView.tsx, SlotManagerModal.tsx) — corak sama
// seperti GeometryConfig.js. JANGAN salin regex/peraturan ini ke tempat lain; import dari sini.

// Had bilangan subtajuk seartikel (keputusan Izzat: 5).
export const MAKS_SUBTAJUK = 5;
// Had panjang SATU subtajuk. Subtajuk dikecualikan daripada kiraan aksara huraian panjang
// (keputusan Izzat), jadi tanpa had ini satu "subtajuk" boleh menyeludup perenggan penuh keluar
// daripada kiraan. 80 aksara cukup untuk subtajuk berita yang panjang.
export const MAKS_AKSARA_SUBTAJUK = 80;

const POLA_SUBTAJUK = /^##(?!#)\s*(.*)$/;

/** Teks subtajuk (tanpa tanda "##") jika baris ini subtajuk, atau null jika perenggan biasa. */
export function teksSubtajuk(baris) {
  const m = String(baris || '').trim().match(POLA_SUBTAJUK);
  return m ? m[1].trim() : null;
}

/** Pecahkan huraian panjang kepada blok berturutan: [{ jenis: 'subtajuk' | 'perenggan', teks }]. */
export function pecahHuraianPanjang(teks) {
  return String(teks || '')
    .split(/\n+/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const sub = teksSubtajuk(b);
      return sub === null ? { jenis: 'perenggan', teks: b } : { jenis: 'subtajuk', teks: sub };
    });
}

/** Huraian panjang TANPA baris subtajuk — untuk kiraan aksara dan huraian SEO/carian. */
export function buangSubtajuk(teks) {
  const s = String(teks || '');
  // Tiada subtajuk langsung: pulangkan rentetan ASAL tanpa disentuh, supaya kiraan aksara
  // kandungan sedia ada (semuanya tanpa subtajuk) kekal TEPAT sama seperti sebelum ciri ini.
  if (!/^[ \t]*##(?!#)/m.test(s)) return s;
  return s.split('\n').filter((b) => teksSubtajuk(b) === null).join('\n');
}

/** Bilangan aksara huraian panjang yang dikira terhadap had minimum/maksimum (subtajuk dikecualikan). */
export function panjangHuraianDikira(teks) {
  return buangSubtajuk(teks).length;
}

/**
 * Semak peraturan susunan subtajuk. Nyatakan FAKTA sahaja (pemanggil tambah ayat akibat, lihat
 * CLAUDE.md "modul pengesahan nyatakan FAKTA sahaja").
 */
export function validateSubtajuk(teks) {
  if (typeof teks !== 'string') return { isValid: true };
  const blok = pecahHuraianPanjang(teks);
  const gagal = (reason) => ({ isValid: false, bolehSalinAI: true, reason });
  const bilangan = blok.filter((b) => b.jenis === 'subtajuk').length;
  if (bilangan === 0) return { isValid: true };
  if (bilangan > MAKS_SUBTAJUK) {
    return gagal(`Huraian panjang mengandungi ${bilangan} subtajuk. Maksimum ${MAKS_SUBTAJUK} subtajuk.`);
  }
  for (let i = 0; i < blok.length; i++) {
    const b = blok[i];
    if (b.jenis !== 'subtajuk') continue;
    if (!b.teks) return gagal('Huraian panjang mengandungi subtajuk kosong (baris "##" tanpa teks).');
    if (b.teks.length > MAKS_AKSARA_SUBTAJUK) {
      return gagal(`Subtajuk "${b.teks.slice(0, 30)}..." (${b.teks.length} aksara) terlalu panjang. Maksimum ${MAKS_AKSARA_SUBTAJUK} aksara.`);
    }
    if (i === 0) return gagal('Huraian panjang tidak boleh bermula dengan subtajuk. Mulakan dengan perenggan pembuka.');
    if (i === blok.length - 1) return gagal(`Subtajuk "${b.teks.slice(0, 30)}" berada di hujung huraian panjang tanpa perenggan di bawahnya.`);
    if (blok[i + 1].jenis === 'subtajuk') return gagal(`Subtajuk "${b.teks.slice(0, 30)}" diikuti terus oleh subtajuk lain tanpa perenggan di antaranya.`);
  }
  return { isValid: true };
}
