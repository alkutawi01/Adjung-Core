// Glosari Berasaskan Bidang — logik resolusi Sense (2026-08-16, arahan Izzat, seni bina disahkan
// docs/glossary-architecture-proposal.md v3). Modul TULEN (tiada JSX/React) supaya boleh diuji
// terus (tests/glosariResolusi.test.js) DAN diimport client-side (IstilahGlosari.tsx) — corak
// SAMA seperti ContentBudget.js/GeometryConfig.js diimport terus oleh SlotManagerModal.tsx.
//
// Peraturan resolusi MUKTAMAD (Seksyen 3, docs v3): Sense KHUSUS sepadan Bidang kandungan >
// Sense AM > `maksud` lama (glosari_istilah) > tiada tooltip. Label "(Bidang)" HANYA dipaparkan
// bila definisi yang digunakan datang daripada Sense KHUSUS — Sense am dan `maksud` fallback
// KEDUA-DUANYA TIADA label (ini peraturan yang dibetulkan Izzat selepas draf pertama silap).

/**
 * Cermin `CategoryRegistry.getSlug()` (core/category/CategoryRegistry.js) — TULEN, tiada
 * panggilan DB/rangkaian. MESTI kekal seiras fungsi pelayan (audit 2026-08-16 sahkan tiada
 * laluan lain buat carian nama->id dalam sistem; jika logik pelayan berubah, kemas kini di sini
 * SERENTAK). Gotcha disahkan audit: nama kosong -> 'umum' (BUKAN rentetan kosong) — sebab tu
 * resolveDefinisiGlosari() semak kosong DAHULU sebelum panggil fungsi ni, jangan bergantung pada
 * fallback dalaman fungsi ni untuk kes "tiada Bidang".
 */
export function slugBidang(nama) {
  if (!nama) return 'umum';
  return nama.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Resolusi konteks MUKTAMAD — pulangkan `{ definisi, namaBidang }` atau `null` (tiada definisi
 * sah langsung bagi Bidang konteks ni). `entri` ialah `{ istilah, maksud, senses? }`, `senses`
 * ialah array `{ id, definisi, amSense, bidang: [{id, name, slug}] }` (bentuk balasan
 * GET /api/system/glosari, lihat core/routes/glosariRoutes.js).
 */
export function resolveDefinisiGlosari(entri, bidangKonteks) {
  const senses = entri.senses || [];

  // Nama Bidang kosong/falsy (Ticker, atau desk rosak) -> terus fallback, JANGAN panggil
  // slugBidang() (gotcha "umum" — lihat komen fungsi tu).
  const slugKonteks = bidangKonteks && String(bidangKonteks).trim() ? slugBidang(bidangKonteks) : '';

  if (slugKonteks) {
    const khusus = senses.find((s) => !s.amSense && (s.bidang || []).some((b) => b.slug === slugKonteks));
    if (khusus && khusus.definisi && khusus.definisi.trim()) {
      const bidangPadan = khusus.bidang.find((b) => b.slug === slugKonteks);
      return { definisi: khusus.definisi, namaBidang: bidangPadan.name };
    }
  }

  const am = senses.find((s) => s.amSense);
  if (am && am.definisi && am.definisi.trim()) return { definisi: am.definisi, namaBidang: null };

  if (entri.maksud && entri.maksud.trim()) return { definisi: entri.maksud, namaBidang: null };

  return null;
}
