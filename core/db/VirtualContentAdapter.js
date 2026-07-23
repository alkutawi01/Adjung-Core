/**
 * VirtualContentAdapter.js - Phase 0 Migration Adapter (Zero Downtime)
 * 
 * Maps legacy rss_ticker_items, manual_objects, and rss_sources tables to virtual
 * Adjung Brief Content Objects v1.1 and Publication Assignments without breaking
 * existing database tables or live Frontpage presentation.
 */

import { LEGACY_SLOT_MAP } from './legacy_slot_mapping.js';

export function mapLegacyToVirtualContentObject(item, sourceName = 'RSS Direct') {
  if (!item) return null;

  const contentId = `cnt_virtual_${item.id || item.slotIndex || Math.random().toString(36).substr(2, 8)}`;
  
  return {
    id: contentId,
    substance: {
      contentType: 'NEWS',
      contentGenre: 'FACTUAL',
      title: item.title || '',
      brief: item.brief || item.formattedBrief || item.description || item.title || '',
      longDescription: item.description || item.brief || '',
      body: item.body || item.description || '',
      canonicalUrl: item.url || item.link || '#',
      language: item.language || 'ms-MY'
    },
    intelligence: {
      deskId: `desk_${(item.desk || 'SEMASA').toLowerCase().replace(/\s+/g, '_')}`,
      deskName: item.desk || 'SEMASA',
      sourceId: item.sourceId || 'src_rss_direct',
      sourceName: item.source || sourceName,
      deskConfidenceScore: item.confidenceScore || 100.0,
      editorialConfidence: 'NORMAL',
      extractedKeywords: item.matchedKeywords || [],
      namedEntities: [],
      relatedContentIds: []
    },
    assignments: [{
      assignmentId: `asg_virtual_${item.id || item.slotIndex}`,
      collectionId: 'col_adjung_brief_my',
      collectionName: 'Adjung Brief Malaysia',
      editionId: 'ed_current_live',
      slotId: `slot_${item.slotIndex !== undefined ? item.slotIndex : 0}`,
      slotInfo: LEGACY_SLOT_MAP[item.slotIndex] || LEGACY_SLOT_MAP[0],
      displayFormat: 'brief',
      orderIndex: item.carouselIndex || 0,
      carouselDelay: 10,
      visibility: 'active'
    }],
    presentation: {
      cardStyle: 'STANDARD_CREAM',
      theme: 'ADJUNG_EDITORIAL'
    },
    editorialTracking: {
      status: 'PUBLISHED',
      createdById: 'usr_editorial_system',
      createdByName: 'System Ingestion',
      approvedById: 'usr_editor_chief',
      publishedById: 'usr_editor_chief',
      createdAt: item.publishedAt || item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      publishedAt: item.publishedAt || new Date().toISOString()
    }
  };
}

export function getVirtualContentCoreList(db) {
  try {
    const legacyTickerItems = db.prepare('SELECT * FROM rss_ticker_items ORDER BY slotIndex ASC').all();
    return legacyTickerItems.map(item => mapLegacyToVirtualContentObject(item));
  } catch (err) {
    console.warn('[VirtualContentAdapter] Could not read legacy rss_ticker_items:', err.message);
    return [];
  }
}
