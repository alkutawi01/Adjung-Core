// Single source of truth for card geometry tiers, ratios, and slot mappings across Adjung Core.
// Used by both backend (ContentBudget.js) and frontend (FrontpageView.tsx).

export const GEOMETRY_RATIOS = {
  HERO: { maxTitleAlone: 115, maxBriefAlone: 350, ratio: 3.043 },
  MENEGAK: { maxTitleAlone: 168, maxBriefAlone: 429, ratio: 2.554 },
  STANDARD: { maxTitleAlone: 110, maxBriefAlone: 280, ratio: 2.545 },
  SEGI_EMPAT_MEDIUM: { maxTitleAlone: 94, maxBriefAlone: 126, ratio: 1.340 },
  SEGI_EMPAT_SMALL: { maxTitleAlone: 62, maxBriefAlone: 78, ratio: 1.258 },
  KOMPAK: { maxTitleAlone: 80, maxBriefAlone: 41, ratio: 0.512 },
  BAR: { maxTitleAlone: 95, maxBriefAlone: 0, ratio: 0.850 },
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

export const tierForSlot = (slotIndex) => {
  if (slotIndex === -1) return 'TICKER';
  for (const key of Object.keys(TIER_SLOTS)) {
    if (TIER_SLOTS[key].includes(slotIndex)) return key;
  }
  return null;
};
