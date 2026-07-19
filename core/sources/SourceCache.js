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
