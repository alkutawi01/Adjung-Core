class SourceNormalizer {
  static normalize(records) {
    if (!Array.isArray(records)) return [];

    return records
      .map(record => {
        // 1. Clean URL from tracking parameters
        let cleanUrl = '';
        if (record.url) {
          try {
            const urlObj = new URL(record.url);
            urlObj.search = ''; // Remove query parameters (UTM, etc.)
            urlObj.hash = '';   // Remove hashes
            cleanUrl = urlObj.toString();
          } catch (e) {
            cleanUrl = record.url;
          }
        }

        // 2. Strip HTML tags and normalize content/title whitespaces
        const cleanTitle = (record.title || '')
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        const cleanContent = (record.content || '')
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        return {
          id: record.id || cleanUrl,
          title: cleanTitle,
          content: cleanContent,
          url: cleanUrl,
          publishedAt: record.publishedAt || ''
        };
      })
      // 3. Filter out records without titles/urls
      .filter(record => record.title || record.url)
      // 4. Sort records by URL/ID to ensure stable sequence for hashing
      .sort((a, b) => (a.url || a.id).localeCompare(b.url || b.id));
  }
}

export default SourceNormalizer;
