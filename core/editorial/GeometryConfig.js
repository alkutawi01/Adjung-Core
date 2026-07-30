// Single source of truth for card geometry tiers, ratios, and slot mappings across Adjung Core.
// Used by both backend (ContentBudget.js) and frontend (FrontpageView.tsx).

export const GEOMETRY_RATIOS = {
  HERO: { maxTitleAlone: 115, maxBriefAlone: 350, ratio: 3.043 },
  MENEGAK: { maxTitleAlone: 168, maxBriefAlone: 429, ratio: 2.554 },
  STANDARD: { maxTitleAlone: 110, maxBriefAlone: 280, ratio: 2.545 },
  SEGI_EMPAT_MEDIUM: { maxTitleAlone: 94, maxBriefAlone: 126, ratio: 1.340 },
  SEGI_EMPAT_SMALL: { maxTitleAlone: 62, maxBriefAlone: 78, ratio: 1.258 },
  KOMPAK: { maxTitleAlone: 80, maxBriefAlone: 41, ratio: 0.512 },
  BAR: { maxTitleAlone: 95, maxBriefAlone: 0, ratio: 0 }, // BAR has no brief field at all — 0/95 = 0, not the stale 0.850 this used to read.
  TICKER: { maxTitleAlone: 80, maxBriefAlone: 220, ratio: 2.750 },
};

// ---------------------------------------------------------------------------------------------
// PINDAAN HAD AKSARA TIER (2026-07-30, permintaan pemilik projek)
//
// GEOMETRY_RATIOS di atas kekal sebagai nilai LALAI — diukur daripada saiz fizikal kad. Ketua
// Editor boleh menindihnya per-tier melalui Editorium → Slot → Tier Kad (disimpan dalam jadual
// `tier_settings`; server memuatkannya semasa boot dan memanggil setTierOverrides()).
//
// Peraturan tak berubah: pindaan dibuat pada peringkat TIER, tidak pernah per-slot. Semua slot
// yang sebentuk sentiasa berkongsi had yang sama.
//
// Guna ratiosForTier(tier) — BUKAN GEOMETRY_RATIOS[tier] terus — di mana-mana kod yang
// mengesahkan atau memaparkan had, supaya pindaan Ketua Editor benar-benar berkuat kuasa.
const TIER_OVERRIDES = {};

export const setTierOverrides = (map) => {
  for (const key of Object.keys(TIER_OVERRIDES)) delete TIER_OVERRIDES[key];
  for (const [tier, nilai] of Object.entries(map || {})) {
    if (!GEOMETRY_RATIOS[tier] || !nilai) continue;
    const pindaan = {};
    if (Number.isFinite(nilai.maxTitleAlone)) pindaan.maxTitleAlone = nilai.maxTitleAlone;
    if (Number.isFinite(nilai.maxBriefAlone)) pindaan.maxBriefAlone = nilai.maxBriefAlone;
    if (Object.keys(pindaan).length) TIER_OVERRIDES[tier] = pindaan;
  }
};

export const getTierOverrides = () => ({ ...TIER_OVERRIDES });

export const ratiosForTier = (tier) => {
  const asas = GEOMETRY_RATIOS[tier];
  if (!asas) return null;
  return { ...asas, ...(TIER_OVERRIDES[tier] || {}) };
};

export const TIER_SLOTS = {
  HERO: [0],
  MENEGAK: [1, 12, 15, 26, 29, 37],
  STANDARD: [2, 6, 19, 20, 33, 34],
  SEGI_EMPAT_MEDIUM: [13, 14, 27, 28],
  SEGI_EMPAT_SMALL: [3, 11, 16, 25, 30, 35, 36],
  KOMPAK: [4, 5, 17, 18, 31, 32],
  BAR: [7, 8, 9, 10, 21, 22, 23, 24],
};

export const FALLBACK_CEILINGS = {
  HERO: { maxTitle: 115, maxBrief: 350 },
  STANDARD: { maxTitle: 110, maxBrief: 280 },
  BAR: { maxTitle: 95, maxBrief: 0 },
  TICKER: { maxTitle: 80, maxBrief: 220 },
  DEFAULT: { maxTitle: 70, maxBrief: 100 },
};

// Canonical Malay tier labels — single source of truth, imported by PerlembagaanConsole.tsx and
// IndeksConsole.tsx (no local copies). Derived from the Fasa 0 shape illustration (Full
// horizontal/Vertical/Horizontal/Square/Compact/Bar) translated to Malay per project owner's
// explicit instruction: "Horizontal" -> "Melintang", "Square" -> "Kiub", with Besar/Kecil added
// to split SEGI_EMPAT_MEDIUM/SMALL since the illustration only had one "Square" label for what is
// now two distinct tiers.
export const TIER_LABELS = {
  HERO: 'Melintang Penuh',
  MENEGAK: 'Menegak',
  STANDARD: 'Melintang',
  SEGI_EMPAT_MEDIUM: 'Kiub Besar',
  SEGI_EMPAT_SMALL: 'Kiub Kecil',
  KOMPAK: 'Kompak',
  BAR: 'Bar',
  TICKER: 'Ticker',
};

// Peraturan Perlembagaan: label mesti 100% Bahasa Melayu; Bahasa Inggeris hanya dibenarkan
// bertulis condong (italic) bila tiada padanan Melayu yang diluluskan lagi. "Bar" dan "Ticker"
// tiada terjemahan Melayu rasmi setakat ini — tandakan di sini supaya semua paparan (Perlembagaan,
// Indeks, dll.) condongkan kedua-dua label ini secara konsisten dari satu tempat.
export const TIER_LABEL_IS_ENGLISH = {
  BAR: true,
  TICKER: true,
};

export const tierForSlot = (slotIndex) => {
  if (slotIndex === -1) return 'TICKER';
  for (const key of Object.keys(TIER_SLOTS)) {
    if (TIER_SLOTS[key].includes(slotIndex)) return key;
  }
  return null;
};

// maxBriefLong: character budget for the "Huraian Panjang" field — extra content not shown on
// the card itself, only in a not-yet-built "spotlight" detail view. There's no geometry-derived
// ceiling for it (it isn't rendered on the card), so it stays a manually curated per-tier value.
// Promoted here from two previously-independent copies (server.js, FrontpageView.tsx) that had
// already happened to agree on these exact numbers — unifying them now so they can't drift apart.
export const MAX_BRIEF_LONG_BY_TIER = {
  HERO: 800,
  MENEGAK: 800,
  STANDARD: 600,
  SEGI_EMPAT_MEDIUM: 500,
  SEGI_EMPAT_SMALL: 400,
  KOMPAK: 400,
  BAR: 0,
  TICKER: 0,
  DEFAULT: 600,
};

// Had aksara label eyebrow kad — string "Bidang | Topik" yang dipapar di atas tajuk.
//
// KENAPA INI WUJUD: bajet tajuk+huraian (GEOMETRY_RATIOS) diukur dengan andaian eyebrow
// mengambil SATU baris. Eyebrow sendiri tak pernah termasuk dalam bajet tu, dan tiada
// truncate/line-clamp pada mana-mana 30 render eyebrow. Diukur hidup pada 2026-07-27:
// eyebrow yang membalut menolak tajuk+huraian ke bawah 1:1 (eyebrow +94px -> kandungan
// +94px) sementara kad TIDAK membesar. Jadi Topik panjang memakan ruang kad secara
// senyap — tiada ralat, cuma huraian terkeluar/terpotong pada kad yang kandungannya padat.
//
// CARA NOMBOR INI DIPEROLEH: eyebrow guna JetBrains Mono (monospace), jadi muatan satu
// baris = floor(lebar / lebar-aksara), diukur terus dari DOM setiap tier pada viewport
// 1024px, ambil MINIMUM setiap tier (slot tersempit menetapkan had seluruh tier), tolak
// ~10% margin untuk risiko font fallback kalau JetBrains Mono gagal dimuat dari Google Fonts.
//
// SKOP: bekas grid capped pada max-w-6xl (1152px), jadi >=1152px muatan tetap maksimum.
// Antara 768-1024px eyebrow boleh membalut ke 2 baris — diterima, sebab kad sempit ada
// 275-301px ruang menegak lebih (diukur) yang menyerapnya, dan susun atur skrin kecil
// memang belum direka (lihat "Open work" dalam sistem reka bentuk).
export const MAX_EYEBROW_CHARS_BY_TIER = {
  HERO: 95,
  MENEGAK: 36,
  STANDARD: 54,
  SEGI_EMPAT_MEDIUM: 59,
  SEGI_EMPAT_SMALL: 36,
  KOMPAK: 43,
  BAR: 36,     // tier ni tak papar Bidang/Topik, had konservatif kalau-kalau berubah
  TICKER: 36,  // sama
  DEFAULT: 36,
};

// Label eyebrow kad — SATU definisi, diimport oleh pengesahan simpan (ContentBudget.js)
// dan oleh render kad (FrontpageView.tsx). Kalau format ni bercabang dua, had aksara di
// atas akan mengesahkan string yang berbeza daripada yang benar-benar dipapar.
export const eyebrowLabel = (desk, topik) => {
  const d = (desk || '').trim();
  const t = (topik || '').trim();
  if (!d) return t;
  return t ? `${d} | ${t}` : d;
};

export const eyebrowCeilingForSlot = (slotIndex) => {
  const tier = tierForSlot(slotIndex) || 'DEFAULT';
  return MAX_EYEBROW_CHARS_BY_TIER[tier] ?? MAX_EYEBROW_CHARS_BY_TIER.DEFAULT;
};

// Berapa aksara yang TINGGAL untuk Topik pada slot ni, setelah Bidang terkunci slot dan
// pemisah " | " mengambil bahagiannya. Ini nombor yang editor (dan prom AI) perlu nampak —
// had eyebrow mentah tak berguna kepada mereka sebab mereka tak menaip bahagian Bidang.
export const topikCeilingForSlot = (slotIndex, bidang) => {
  const bidangLen = (bidang || '').trim().length;
  const pemisah = bidangLen > 0 ? 3 : 0; // ' | '
  return Math.max(0, eyebrowCeilingForSlot(slotIndex) - bidangLen - pemisah);
};

// Character budget for BAR's "Penerangan" field — the accordion detail panel body text (see
// BarCardExpandedPanel.tsx). BAR-only field, not part of MAX_BRIEF_LONG_BY_TIER above (that's
// keyed by tier for a field every tier could theoretically have; Penerangan only exists for BAR).
// Measured empirically once the panel was actually built: at the panel's real rendered width
// (~293px, the BAR cluster's column), a 458-character sample rendered as a legible ~13-line
// paragraph at ~348px tall — comfortable for an accordion, not excessive. Enforced at save time
// by ContentBudget.js's validateBarPeneranganBudget(), same as every other tier's ceiling.
export const MAX_PENERANGAN_CHARS = 460;

// Single source of truth for "what's the hard ceiling for this slot's title/brief/briefLong" --
// used both to validate/clamp admin-saved slot config (server.js) and to pre-fill the admin slot
// settings form's defaults (FrontpageView.tsx). Previously each of those kept its own hand-typed
// copy of these numbers, which drifted out of sync for 4 of 8 tiers.
export const ceilingForSlot = (slotIndex) => {
  const tier = tierForSlot(slotIndex) || 'DEFAULT';
  const ratioDef = GEOMETRY_RATIOS[tier];
  return {
    maxTitle: ratioDef ? ratioDef.maxTitleAlone : FALLBACK_CEILINGS.DEFAULT.maxTitle,
    maxBrief: ratioDef ? ratioDef.maxBriefAlone : FALLBACK_CEILINGS.DEFAULT.maxBrief,
    maxBriefLong: MAX_BRIEF_LONG_BY_TIER[tier] ?? MAX_BRIEF_LONG_BY_TIER.DEFAULT,
  };
};
