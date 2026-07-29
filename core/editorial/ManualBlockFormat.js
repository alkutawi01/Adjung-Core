// Single source of truth for the "manual paste" text template used by Manual-mode bento slots:
// splitting a slotsConfig.manualSummary blob into per-item blocks, extracting each block's
// Label: value fields, and serializing structured items back into that same text format.
// Imported by both server.js (syncManualObjectsForSlot/resolveSlotContent, the read/write path
// for ALL bento tiers including BAR) and the client Urus Slot editor (SlotManagerModal.tsx, bento
// tiers other than BAR). Ticker (slotIndex -1) uses its own separate format (parseTickerText in
// core/routes/contentRoutes.js) and does not go through this module.

// Splits a manualSummary blob into per-item blocks. Tolerates several separator conventions the
// UI has used over time (____, ----, ====, or a blank-line boundary right before a new UUID:/
// Tajuk:/Event: line) so old and new content keep parsing the same way.
export const MANUAL_BLOCK_SPLIT_REGEX = /(?:\r?\n){2,}(?=UUID:|Tajuk:|Event:)|____+|----+|====+|___+/i;

// Canonical separator used when serializing a fresh block list back into one text blob.
export const MANUAL_BLOCK_SEPARATOR = '\n\n________________________________________\n\n';

// Editors see inline "(had N aksara)" hints baked into template placeholders as a budget
// reminder while typing directly into the raw textarea. This strips them wherever they land in
// the line (editors type on both sides of the hint, not just after it).
export const stripLimitHint = (s) =>
  (s || '')
    .replace(/\(\s*had\s*\d+\s*aksara\s*\)/gi, '')
    .replace(/^\([^)]+\)\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

// Extracts every recognized Label: value line from one block into a flat fields object. Mirrors
// the field set syncManualObjectsForSlot() persists to editorial_attribute_values, plus UUID
// (identity) and isEventBlock (BAR's Event: header sets a different default desk).
//
// Huraian ada DUA medan berasingan — "Huraian ringkas" (brief, dipapar pada kad) dan "Huraian
// panjang" (briefLong, hanya untuk mod spotlight akan datang, tidak dipapar pada kad). "Huraian:"
// tanpa kelayakan ringkas/panjang masih dikenali sebagai alias LEGASI untuk "Huraian ringkas:"
// supaya templat lama terus dihurai.
//
// "Tarikh sumber:" ialah label KANONIKAL untuk tarikh bahan asal (originalDate) — "Tarikh:" masih
// dikenali sebagai alias legasi.
export function parseManualBlockFields(block) {
  const lines = (block || '').split('\n');
  const fields = {
    uuid: '', title: '', brief: '', briefLong: '', desk: '', topik: '',
    date: '', source: '', url: '', sourceType: '',
    organizer: '', location: '', access: '', penerangan: '',
    note: '', image: '', isEventBlock: false,
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('UUID:')) {
      fields.uuid = trimmed.replace(/^UUID:\s*/i, '').trim();
    } else if (trimmed.startsWith('Tajuk:')) {
      fields.title = stripLimitHint(trimmed.replace(/^Tajuk:\s*/i, ''));
    } else if (trimmed.startsWith('Event:')) {
      fields.title = trimmed.replace(/^Event:\s*/i, '').trim();
      fields.desk = 'ACARA';
      fields.isEventBlock = true;
    } else if (trimmed.startsWith('Huraian panjang:')) {
      fields.briefLong = stripLimitHint(trimmed.replace(/^Huraian panjang:\s*/i, ''));
    } else if (trimmed.startsWith('Huraian ringkas:')) {
      fields.brief = stripLimitHint(trimmed.replace(/^Huraian ringkas:\s*/i, ''));
    } else if (trimmed.startsWith('Huraian:')) {
      fields.brief = stripLimitHint(trimmed.replace(/^Huraian:\s*/i, ''));
    } else if (trimmed.startsWith('Bidang:')) {
      fields.desk = trimmed.replace(/^Bidang:\s*/i, '').trim();
    } else if (trimmed.startsWith('Kategori:')) {
      fields.desk = trimmed.replace(/^Kategori:\s*/i, '').trim();
    } else if (trimmed.startsWith('Topik:')) {
      fields.topik = stripLimitHint(trimmed.replace(/^Topik:\s*/i, ''));
    } else if (trimmed.startsWith('Jenis sumber:')) {
      fields.sourceType = trimmed.replace(/^Jenis sumber:\s*/i, '').trim();
    } else if (trimmed.startsWith('Tarikh sumber:')) {
      fields.date = trimmed.replace(/^Tarikh sumber:\s*/i, '').trim();
    } else if (trimmed.startsWith('Tarikh:')) {
      fields.date = trimmed.replace(/^Tarikh:\s*/i, '').trim();
    } else if (trimmed.startsWith('Nota:')) {
      fields.note = trimmed.replace(/^Nota:\s*/i, '').trim();
    } else if (trimmed.startsWith('Imej:')) {
      fields.image = trimmed.replace(/^Imej:\s*/i, '').trim();
    } else if (trimmed.startsWith('Penganjur:')) {
      fields.organizer = trimmed.replace(/^Penganjur:\s*/i, '').trim();
    } else if (trimmed.startsWith('Lokasi:')) {
      fields.location = trimmed.replace(/^Lokasi:\s*/i, '').trim();
    } else if (trimmed.startsWith('Akses:')) {
      fields.access = trimmed.replace(/^Akses:\s*/i, '').trim();
    } else if (trimmed.startsWith('Penerangan:')) {
      fields.penerangan = trimmed.replace(/^Penerangan:\s*/i, '').trim();
    } else if (trimmed.startsWith('Sumber:')) {
      fields.source = trimmed.replace(/^Sumber:\s*/i, '').trim();
    } else if (trimmed.startsWith('URL:')) {
      fields.url = trimmed.replace(/^URL:\s*/i, '').trim();
    }
  }

  return fields;
}

// Splits + parses a full manualSummary blob into an ordered list of block field-sets, for the
// CLIENT's live queue editor (SlotManagerModal) — unlike server.js's parseManualSummaryTemplate
// (which drops title-less blocks since it's building the PUBLISHED carousel), this keeps every
// block including blank drafts. A freshly "+ Tambah kandungan"-ed item has no title yet; dropping
// it here would make it vanish from the editor the instant it's added (silently discarding
// anything typed into it, since patch() targets an index that no longer exists after re-derive).
// The "must have a title to publish" rule still applies server-side at actual save time.
export function parseManualSummaryBlocks(summaryText) {
  if (!summaryText || (!summaryText.includes('Tajuk:') && !summaryText.includes('Event:'))) return [];
  return (summaryText || '')
    .split(MANUAL_BLOCK_SPLIT_REGEX)
    // MANUAL_BLOCK_SPLIT_REGEX's alternatives overlap on the standard "\n\n____...____\n\n"
    // separator: the underscore run matches `___+` AND the blank line immediately before the
    // next block's "UUID:" independently matches the lookahead alternative, so split() finds TWO
    // adjacent delimiters back-to-back and emits a genuinely empty string as the "content" between
    // them. That empty fragment is not a block — it never contained a UUID:/Tajuk: line at all —
    // so it must be dropped here, distinct from a legitimate blank DRAFT item (which still has
    // real "UUID: ...\nTajuk: \n..." lines, just empty values, and must be kept — see below).
    .filter((block) => block.trim().length > 0)
    .map(parseManualBlockFields);
}

// Serializes one bento (non-BAR) item back into the Label: value block format, including a UUID:
// header line so re-parsing recovers the same identity. Uses the CANONICAL labels (Huraian
// ringkas/panjang, Tarikh sumber) — parseManualBlockFields still accepts the legacy aliases on
// the way IN, but everything written back out uses the unambiguous form.
export function serializeManualBentoItem(item) {
  const uuid = item.uuid || '';
  return [
    `UUID: ${uuid}`,
    `Tajuk: ${item.title || ''}`,
    `Topik: ${item.topik || item.topic || ''}`,
    `Huraian ringkas: ${item.brief || ''}`,
    `Huraian panjang: ${item.briefLong || ''}`,
    `Sumber: ${item.source || ''}`,
    `URL: ${item.url || ''}`,
    `Tarikh sumber: ${item.date || ''}`,
    `Imej: ${item.image || ''}`,
    `Nota: ${item.note || ''}`,
  ].join('\n');
}

export function serializeManualBentoQueue(items) {
  return (items || []).map(serializeManualBentoItem).join(MANUAL_BLOCK_SEPARATOR);
}
