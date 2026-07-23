/**
 * SlotGovernanceService.js - Spatial Slot Mandate & Governance Service
 * 
 * Manages spatial slot mandates (Slot 0..37), editor slot governance allocations,
 * temporary coverage delegations, and Chief Editor override powers.
 */

import { LEGACY_SLOT_MAP } from '../db/legacy_slot_mapping.js';

export class SlotGovernanceService {
  constructor(db, editorialUserService) {
    this.db = db;
    this.editorialUserService = editorialUserService;
    // In-memory slot mandates fallback for Phase 0
    this.inMemoryMandates = {
      0: { slotId: 'slot_0', slotIndex: 0, editorialUserId: 'usr_editor_chief', assignedByName: 'Chief Editor Izzat', scope: 'primary_owner' },
      1: { slotId: 'slot_1', slotIndex: 1, editorialUserId: 'usr_editor_chief', assignedByName: 'Chief Editor Izzat', scope: 'primary_owner' },
      2: { slotId: 'slot_2', slotIndex: 2, editorialUserId: 'usr_editor_chief', assignedByName: 'Chief Editor Izzat', scope: 'primary_owner' }
    };
  }

  getSlotMandates(collectionId = 'col_adjung_brief_my') {
    const slots = [];
    for (let i = 0; i <= 14; i++) {
      const mapping = LEGACY_SLOT_MAP[i] || { name: `Slot ${i}`, tier: 'KOMPAK' };
      const mandate = this.inMemoryMandates[i] || {
        slotId: `slot_${i}`,
        slotIndex: i,
        editorialUserId: 'usr_editor_chief',
        assignedByName: 'Chief Editor Izzat',
        scope: 'primary_owner'
      };

      slots.push({
        slotIndex: i,
        slotId: `slot_${i}`,
        slotName: mapping.slotName || mapping.name,
        tier: mapping.tier,
        maxTitleLength: mapping.maxTitleLength || 120,
        maxBriefLength: mapping.maxBriefLength || 200,
        mandateOwner: mandate
      });
    }
    return slots;
  }

  assignMandate(slotIndex, editorialUserId, assignedById = 'usr_editor_chief', scope = 'primary_owner') {
    this.inMemoryMandates[slotIndex] = {
      slotId: `slot_${slotIndex}`,
      slotIndex,
      editorialUserId,
      assignedById,
      assignedByName: 'Chief Editor Izzat',
      scope,
      assignedAt: new Date().toISOString()
    };
    return this.inMemoryMandates[slotIndex];
  }

  overrideSlotContent(slotIndex, contentId, chiefEditorId = 'usr_editor_chief') {
    const mandate = this.inMemoryMandates[slotIndex] || this.assignMandate(slotIndex, chiefEditorId);
    return {
      slotIndex,
      contentId,
      overriddenById: chiefEditorId,
      overriddenAt: new Date().toISOString(),
      status: 'OVERRIDDEN_SUCCESS'
    };
  }
}
