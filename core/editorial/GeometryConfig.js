// Single source of truth for card geometry tiers, ratios, and slot mappings across Adjung Core.
// Used by both backend (ContentBudget.js) and frontend (FrontpageView.tsx).

export const GEOMETRY_RATIOS = {
  HERO: { maxTitleAlone: 115, maxBriefAlone: 350, ratio: 3.043 },
  MENEGAK: { maxTitleAlone: 168, maxBriefAlone: 429, ratio: 2.554 },
  STANDARD: { maxTitleAlone: 110, maxBriefAlone: 280, ratio: 2.545 },
  SEGI_EMPAT_MEDIUM: { maxTitleAlone: 94, maxBriefAlone: 126, ratio: 1.340 },
  SEGI_EMPAT_SMALL: { maxTitleAlone: 62, maxBriefAlone: 78, ratio: 1.258 },
  KOMPAK: { maxTitleAlone: 80, maxBriefAlone: 41, ratio: 0.512 },
  BAR: { maxTitleAlone: 95, maxBriefAlone: 0, ratio: 0 }, // BAR has no brief field at all -- 0/95 = 0, not the stale 0.850 this used to read.
  TICKER: { maxTitleAlone: 80, maxBriefAlone: 220, ratio: 2.750 },
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

// Canonical Malay tier labels -- single source of truth, imported by PerlembagaanConsole.tsx and
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
// tiada terjemahan Melayu rasmi setakat ini -- tandakan di sini supaya semua paparan (Perlembagaan,
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

// maxBriefLong: character budget for the "Huraian Panjang" field -- extra content not shown on
// the card itself, only in a not-yet-built "spotlight" detail view. There's no geometry-derived
// ceiling for it (it isn't rendered on the card), so it stays a manually curated per-tier value.
// Promoted here from two previously-independent copies (server.js, FrontpageView.tsx) that had
// already happened to agree on these exact numbers -- unifying them now so they can't drift apart.
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
