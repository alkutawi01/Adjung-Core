// Single source of truth for "does this title+brief fit the card" for every code path that can
// create or edit editorial content (manual paste, AI pipeline generation, content-review edits).
// Mirrors GEOMETRY_RATIOS in src/components/portal/FrontpageView.tsx -- keep both in sync if the
// underlying card geometry ever changes (measured empirically per tier, see that file's comments).
//
// Title and brief share one fixed space budget per card, not two independent caps: a card can fit
// a long title with a short brief, or a short title with a long brief, but not both maxed out at
// once. maxTitleAlone/maxBriefAlone are each field's length limit when the OTHER field is empty;
// the fraction of that solo budget a field actually uses (length / soloMax) must sum to <= 1.
const GEOMETRY_RATIOS = {
  MENEGAK: { maxTitleAlone: 168, maxBriefAlone: 429 },
  SEGI_EMPAT_MEDIUM: { maxTitleAlone: 94, maxBriefAlone: 126 },
  SEGI_EMPAT_SMALL: { maxTitleAlone: 62, maxBriefAlone: 78 },
  KOMPAK: { maxTitleAlone: 80, maxBriefAlone: 41 },
};

// Tiers with no measured ratio yet -- fall back to independent per-field ceilings until one is
// derived (see project memory: this is a known, separate gap from the budget-line tiers above).
const FALLBACK_CEILINGS = {
  HERO: { maxTitle: 115, maxBrief: 350 },
  STANDARD: { maxTitle: 110, maxBrief: 280 },
  BAR: { maxTitle: 40, maxBrief: 0 },
  TICKER: { maxTitle: 80, maxBrief: 220 },
  DEFAULT: { maxTitle: 70, maxBrief: 100 },
};

const TIER_SLOTS = {
  HERO: [0],
  MENEGAK: [1, 12, 15, 26, 29, 37],
  STANDARD: [2, 6, 19, 20, 33, 34],
  SEGI_EMPAT_MEDIUM: [13, 14, 27, 28],
  SEGI_EMPAT_SMALL: [3, 11, 16, 25, 30, 35, 36],
  KOMPAK: [4, 5, 17, 18, 31, 32],
  BAR: [7, 8, 9, 10, 21, 22, 23, 24],
};

const tierForSlot = (slotIndex) => {
  if (slotIndex === -1) return 'TICKER';
  for (const key of Object.keys(TIER_SLOTS)) {
    if (TIER_SLOTS[key].includes(slotIndex)) return key;
  }
  return null;
};

// Every slot of the same tier gets the exact same rule -- there is no per-slot special-casing.
const validateContentBudget = (slotIndex, title, summary) => {
  const tier = tierForSlot(slotIndex);
  const titleLen = (title || '').length;
  const briefLen = (summary || '').length;
  const ratioDef = tier ? GEOMETRY_RATIOS[tier] : null;

  if (ratioDef) {
    const budgetUsed = (titleLen / ratioDef.maxTitleAlone) + (briefLen / ratioDef.maxBriefAlone);
    if (budgetUsed > 1) {
      return {
        isValid: false,
        reason: `Tajuk (${titleLen} aksara) dan huraian (${briefLen} aksara) bersama melebihi bajet ruang kad ${tier} ` +
          `(${Math.round(budgetUsed * 100)}% digunakan). Pendekkan salah satu atau kedua-duanya.`,
      };
    }
    return { isValid: true };
  }

  const ceiling = FALLBACK_CEILINGS[tier] || FALLBACK_CEILINGS.DEFAULT;
  if (ceiling.maxTitle && titleLen > ceiling.maxTitle) {
    return { isValid: false, reason: `Tajuk melebihi had ${ceiling.maxTitle} aksara (semasa: ${titleLen}).` };
  }
  if (ceiling.maxBrief && briefLen > ceiling.maxBrief) {
    return { isValid: false, reason: `Huraian melebihi had ${ceiling.maxBrief} aksara (semasa: ${briefLen}).` };
  }
  return { isValid: true };
};

export { GEOMETRY_RATIOS, FALLBACK_CEILINGS, TIER_SLOTS, tierForSlot, validateContentBudget };
