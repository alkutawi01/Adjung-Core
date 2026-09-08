import crypto from 'crypto';

class SourceCache {
  static calculateHash(normalizedRecords) {
    if (!Array.isArray(normalizedRecords) || normalizedRecords.length === 0) {
      return '';
    }

    // Serialize stable canonical record set (using first 500 characters of clean content per record)
    const serializeData = normalizedRecords
      .map(record => `${record.id}|${record.title}|${record.url}|${record.content.substring(0, 500)}`)
      .join('\n');

    return crypto.createHash('sha256').update(serializeData).digest('hex');
  }

  static async isHashUnchanged(dbGetFn, slotIndex, newHash) {
    if (!newHash) return false;

    // Ticker (slotIndex -1) TIADA baris editorial_objects langsung (2026-09-08, dapatan
    // bug-hunt) — laluan AI Generated Ticker (EditorialPipeline.js) tulis terus ke
    // system_settings.inTheNewsText, tak pernah INSERT editorial_objects/editorial_attribute_values
    // macam slot biasa. Query LIKE di bawah ('object-%-slot-1-%') jadi SENTIASA sifar baris
    // sepadan untuk Ticker -- cache-skip (penjimat kos AI utama modul ni, lihat komen
    // buildContentPool di EditorialPipeline.js) senyap TAK PERNAH terpakai untuk Ticker,
    // setiap larian "run-now" panggil AI walaupun pool sumber tak berubah langsung. Ticker
    // guna lajur khusus system_settings.tickerSourceHash sebagai gantian.
    if (slotIndex === -1) {
      try {
        const row = await dbGetFn(`SELECT tickerSourceHash FROM system_settings WHERE id = 'settings-main'`);
        return !!(row && row.tickerSourceHash === newHash);
      } catch (e) {
        console.error('SourceCache check error (ticker):', e);
        return false;
      }
    }

    // Check last saved sourceHash for this slot
    try {
      const row = await dbGetFn(`
        SELECT valueText FROM editorial_attribute_values
        WHERE objectId LIKE ? AND attributeId = 'sourceHash'
        ORDER BY id DESC LIMIT 1
      `, [`object-%-slot${slotIndex}-%`]);

      if (row && row.valueText === newHash) {
        return true;
      }
    } catch (e) {
      console.error('SourceCache check error:', e);
    }
    return false;
  }
}

export default SourceCache;
