// Single source of truth for "does this title+brief fit the card" for every code path that can
// create or edit editorial content (manual paste, AI pipeline generation, content-review edits).
// Mirrors GEOMETRY_RATIOS in src/components/portal/FrontpageView.tsx -- keep both in sync if the
// underlying card geometry ever changes (measured empirically per tier, see that file's comments).
//
// Title and brief share one fixed space budget per card, not two independent caps: a card can fit
// a long title with a short brief, or a short title with a long brief, but not both maxed out at
// once. maxTitleAlone/maxBriefAlone are each field's length limit when the OTHER field is empty;
// the fraction of that solo budget a field actually uses (length / soloMax) must sum to <= 1.
import { GEOMETRY_RATIOS, FALLBACK_CEILINGS, TIER_SLOTS, tierForSlot } from './GeometryConfig.js';

// Every slot of the same tier gets the exact same rule -- there is no per-slot special-casing.
const validateContentBudget = (slotIndex, title, summary) => {
  const tier = tierForSlot(slotIndex);
  const titleLen = (title || '').length;
  const briefLen = (summary || '').length;
  const ratioDef = tier ? GEOMETRY_RATIOS[tier] : null;

  if (ratioDef) {
    if (ratioDef.maxTitleAlone && titleLen > ratioDef.maxTitleAlone) {
      return {
        isValid: false,
        reason: `Tajuk (${titleLen} aksara) melebihi had maksima ruang kad ${tier} (${ratioDef.maxTitleAlone} aksara).`,
      };
    }
    if (ratioDef.maxBriefAlone === 0 && briefLen > 0) {
      return {
        isValid: false,
        reason: `Kad ${tier} tidak menyokong huraian ringkas. Sila kosongkan huraian.`,
      };
    }
    if (ratioDef.maxBriefAlone > 0 && briefLen > ratioDef.maxBriefAlone) {
      return {
        isValid: false,
        reason: `Huraian (${briefLen} aksara) melebihi had maksima ruang kad ${tier} (${ratioDef.maxBriefAlone} aksara).`,
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
