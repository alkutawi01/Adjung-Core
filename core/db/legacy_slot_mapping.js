/**
 * legacy_slot_mapping.js - Adjung Brief Canonical Bento Grid Slot Mapping (Slots 0 to 14)
 * 
 * Maps current Bento Grid Indices (0..14) to spatial tiers, max title/brief lengths,
 * and display rules to guarantee zero layout breakage during migration.
 */

export const LEGACY_SLOT_MAP = {
  0: { slotIndex: 0, slotName: 'Ticker Bar', tier: 'TICKER', maxTitleLength: 180, maxBriefLength: 0 },
  1: { slotIndex: 1, slotName: 'Hero Main Card', tier: 'HERO', maxTitleLength: 140, maxBriefLength: 250 },
  2: { slotIndex: 2, slotName: 'Feature Vertical Left', tier: 'MENEGAK', maxTitleLength: 100, maxBriefLength: 200 },
  3: { slotIndex: 3, slotName: 'Square Top Right 1', tier: 'KOMPAK', maxTitleLength: 90, maxBriefLength: 150 },
  4: { slotIndex: 4, slotName: 'Square Top Right 2', tier: 'KOMPAK', maxTitleLength: 90, maxBriefLength: 150 },
  5: { slotIndex: 5, slotName: 'Square Top Right 3', tier: 'KOMPAK', maxTitleLength: 90, maxBriefLength: 150 },
  6: { slotIndex: 6, slotName: 'Horizontal Mid Left', tier: 'HORIZONTAL', maxTitleLength: 110, maxBriefLength: 180 },
  7: { slotIndex: 7, slotName: 'Bar Strip 1', tier: 'BAR', maxTitleLength: 80, maxBriefLength: 0 },
  8: { slotIndex: 8, slotName: 'Bar Strip 2', tier: 'BAR', maxTitleLength: 80, maxBriefLength: 0 },
  9: { slotIndex: 9, slotName: 'Bar Strip 3', tier: 'BAR', maxTitleLength: 80, maxBriefLength: 0 },
  10: { slotIndex: 10, slotName: 'Bar Strip 4', tier: 'BAR', maxTitleLength: 80, maxBriefLength: 0 },
  11: { slotIndex: 11, slotName: 'Square Bottom Left', tier: 'KOMPAK', maxTitleLength: 90, maxBriefLength: 150 },
  12: { slotIndex: 12, slotName: 'Vertical Tall Right', tier: 'MENEGAK', maxTitleLength: 120, maxBriefLength: 220 },
  13: { slotIndex: 13, slotName: 'Half Horizontal 1', tier: 'HALF_HORIZONTAL', maxTitleLength: 100, maxBriefLength: 160 },
  14: { slotIndex: 14, slotName: 'Half Horizontal 2', tier: 'HALF_HORIZONTAL', maxTitleLength: 100, maxBriefLength: 160 }
};
