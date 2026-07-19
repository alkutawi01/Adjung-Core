import CanonicalSourceRecord from './CanonicalSourceRecord.js';

class SourceTransformer {
  parse(rawContent) {
    throw new Error("Method 'parse()' must be implemented.");
  }
}

// 1. FeedTransformer for RSS and Atom XML
class FeedTransformer extends SourceTransformer {
  parse(rawContent) {
    const records = [];
    const contentTrimmed = rawContent.trim();

    // Helper to extract tag text, including CDATA
    const extractTag = (xml, tagName) => {
      const match = xml.match(new RegExp(`<${tagName}(?:\\s+[^>]*)*>([\\s\\S]*?)<\/${tagName}>`, 'i'));
      if (!match) return '';
      let content = match[1].trim();
      if (content.startsWith('<![CDATA[')) {
        content = content.substring(9, content.length - 3).trim();
      }
      return content;
    };

    // Helper to extract href from link tags (Atom style)
    const extractLinkHref = (xml) => {
      const match = xml.match(/<link\s+[^>]*href=["']([^"']+)["']/i);
      return match ? match[1].trim() : '';
    };

    // Detect if RSS or Atom
    if (contentTrimmed.includes('<item') || contentTrimmed.includes('</item>')) {
      // RSS Feed
      const items = contentTrimmed.split(/<item(?:\s+[^>]*)?>/gi).slice(1);
      for (const item of items) {
        const cleanItemXml = item.split('</item>')[0];
        const title = extractTag(cleanItemXml, 'title');
        const link = extractTag(cleanItemXml, 'link') || extractLinkHref(cleanItemXml);
        const description = extractTag(cleanItemXml, 'description') || extractTag(cleanItemXml, 'content:encoded');
        const guid = extractTag(cleanItemXml, 'guid') || link;
        const pubDate = extractTag(cleanItemXml, 'pubDate');

        if (title || link) {
          records.push(new CanonicalSourceRecord({
            id: guid,
            title,
            content: description,
            url: link,
            publishedAt: pubDate
          }));
        }
      }
    } else if (contentTrimmed.includes('<entry') || contentTrimmed.includes('</entry>')) {
      // Atom Feed
      const entries = contentTrimmed.split(/<entry(?:\s+[^>]*)?>/gi).slice(1);
      for (const entry of entries) {
        const cleanEntryXml = entry.split('</entry>')[0];
        const title = extractTag(cleanEntryXml, 'title');
        const link = extractLinkHref(cleanEntryXml) || extractTag(cleanEntryXml, 'link');
        const content = extractTag(cleanEntryXml, 'content') || extractTag(cleanEntryXml, 'summary');
        const id = extractTag(cleanEntryXml, 'id') || link;
        const published = extractTag(cleanEntryXml, 'published') || extractTag(cleanEntryXml, 'updated');

        if (title || link) {
          records.push(new CanonicalSourceRecord({
            id,
            title,
            content,
            url: link,
            publishedAt: published
          }));
        }
      }
    }

    return records;
  }
}

// 2. JsonFeedTransformer for JSON Feeds
class JsonFeedTransformer extends SourceTransformer {
  parse(rawContent) {
    const records = [];
    try {
      const feed = JSON.parse(rawContent);
      const items = feed.items || [];
      for (const item of items) {
        const id = item.id || item.url || '';
        const title = item.title || '';
        const content = item.content_html || item.content_text || item.summary || '';
        const url = item.url || '';
        const publishedAt = item.date_published || item.date_modified || '';

        if (title || url) {
          records.push(new CanonicalSourceRecord({
            id,
            title,
            content,
            url,
            publishedAt
          }));
        }
      }
    } catch (e) {
      console.error('JsonFeedTransformer parse error:', e);
    }
    return records;
  }
}

// 3. RestApiTransformer for Custom REST APIs
class RestApiTransformer extends SourceTransformer {
  parse(rawContent) {
    const records = [];
    try {
      const data = JSON.parse(rawContent);
      const items = Array.isArray(data) ? data : (data.articles || data.data || data.results || []);
      
      if (Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item && typeof item === 'object') {
            const id = item.id || item.uuid || item.url || String(i);
            const title = item.title || item.name || item.headline || '';
            const content = item.content || item.description || item.body || item.text || '';
            const url = item.url || item.link || '';
            const publishedAt = item.publishedAt || item.date || item.createdAt || '';

            if (title || url) {
              records.push(new CanonicalSourceRecord({
                id,
                title,
                content,
                url,
                publishedAt
              }));
            }
          }
        }
      } else if (data && typeof data === 'object') {
        // Single object response
        records.push(new CanonicalSourceRecord({
          id: data.id || 'single',
          title: data.title || data.name || '',
          content: data.content || data.description || JSON.stringify(data),
          url: data.url || '',
          publishedAt: data.publishedAt || ''
        }));
      }
    } catch (e) {
      console.error('RestApiTransformer parse error:', e);
    }
    return records;
  }
}

// 4. StaticHtmlTransformer fallback for static websites
class StaticHtmlTransformer extends SourceTransformer {
  parse(rawContent) {
    const records = [];
    const contentTrimmed = rawContent.trim();

    // Strip scripts and styles
    let cleanHtml = contentTrimmed
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Extract page title
    const titleMatch = cleanHtml.match(/<title>([\s\\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Static Page';

    // Strip remaining tags for simple content body
    const bodyContent = cleanHtml
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    records.push(new CanonicalSourceRecord({
      id: 'html-static',
      title,
      content: bodyContent.substring(0, 10000), // Cap size
      url: ''
    }));

    return records;
  }
}

export {
  SourceTransformer,
  FeedTransformer,
  JsonFeedTransformer,
  RestApiTransformer,
  StaticHtmlTransformer
};
