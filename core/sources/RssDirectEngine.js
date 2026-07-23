// RssDirectEngine.js - High performance RSS 2.0 / Atom XML Parser, Link Extractor, and Language Filter.
// Pure JS XML parser operating WITHOUT any AI API calls.

import { sanitizeHtmlText } from './SourceSanitizer.js';

export function parseRssXml(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') return [];

  const items = [];
  // Match RSS 2.0 <item> or Atom <entry>
  const itemMatches = xmlString.match(/<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi) || [];

  for (const block of itemMatches) {
    // Extract title
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const rawTitle = titleMatch ? titleMatch[1] : '';
    const title = sanitizeHtmlText(rawTitle.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1'));

    // Extract description / summary / content
    const descMatch = block.match(/<(?:description|summary|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/i);
    const rawDesc = descMatch ? descMatch[1] : '';
    const description = sanitizeHtmlText(rawDesc.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1'));

    // Extract link
    let link = '';
    const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    if (linkMatch && linkMatch[1].trim()) {
      link = sanitizeHtmlText(linkMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1'));
    } else {
      // Atom link format: <link href="url" />
      const atomLinkMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (atomLinkMatch) link = atomLinkMatch[1].trim();
    }

    // Extract guid / id
    const guidMatch = block.match(/<(?:guid|id)[^>]*>([\s\S]*?)<\/(?:guid|id)>/i);
    const rawGuid = guidMatch ? guidMatch[1] : link;
    const rssGuid = sanitizeHtmlText(rawGuid.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')) || link;

    // Extract pubDate / updated
    const dateMatch = block.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i);
    const publishedAt = dateMatch ? new Date(sanitizeHtmlText(dateMatch[1])).toISOString() : new Date().toISOString();

    // Extract all category tags
    const catMatches = block.match(/<category[^>]*>([\s\S]*?)<\/category>/gi) || [];
    const categoriesList = catMatches.map(c => {
      const inner = c.replace(/<category[^>]*>([\s\S]*?)<\/category>/i, '$1');
      return sanitizeHtmlText(inner.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1'));
    }).filter(Boolean);

    const category = categoriesList.join(', ');

    if (title && (link || description)) {
      const formattedBrief = formatRssBrief(description || title);
      items.push({
        rssGuid,
        title,
        description,
        formattedBrief,
        link,
        publishedAt,
        category
      });
    }
  }

  return deduplicateRssItems(items);
}

export function formatRssBrief(rawDescription) {
  if (!rawDescription) return '';

  // Clean HTML tags and entities
  let cleanText = sanitizeHtmlText(rawDescription);

  // Remove common RSS boilerplate prefixes
  cleanText = cleanText.replace(/^[A-Z\s]+,\s*\d+\s+[A-Za-z]+\s*–\s*/, '');
  cleanText = cleanText.replace(/^([A-Z\s]+:)\s*/, '');

  // Truncate to maximum 220 characters without cutting words mid-word
  if (cleanText.length > 220) {
    let truncated = cleanText.substring(0, 220);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 150) {
      truncated = truncated.substring(0, lastSpace);
    }
    if (truncated.endsWith('.')) {
      cleanText = truncated + ' ...';
    } else {
      cleanText = truncated.replace(/[,;:\-\s]+$/, '') + '...';
    }
  }

  // Strip any remaining copyright symbols
  cleanText = cleanText.replace(/&(?:copy);?/gi, '').replace(/©/g, '').trim();

  // Remove comma before dots/ellipsis (e.g. TH,... or TH, ...)
  cleanText = cleanText.replace(/,\s*(?:\.{3,}|…)/g, '...');

  // Format 4 or more dots as ". ..."
  cleanText = cleanText.replace(/\.{4,}/g, '. ...');

  return cleanText;
}

export function filterByLanguage(item, targetLang = 'ms-MY') {
  if (!targetLang || targetLang === 'all') return true;

  const text = `${item.title} ${item.description}`.toLowerCase();

  // Basic Malay word markers
  const malayMarkers = ['dan', 'yang', 'di', 'pada', 'ke', 'untuk', 'dengan', 'ini', 'oleh', 'akan', 'tidak', 'adalah', 'atau', 'iaitu'];
  // Basic English word markers
  const englishMarkers = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'to', 'in', 'that', 'for', 'it', 'with', 'as', 'was'];

  const words = text.split(/\s+/);
  let malayCount = 0;
  let englishCount = 0;

  for (const word of words) {
    if (malayMarkers.includes(word)) malayCount++;
    if (englishMarkers.includes(word)) englishCount++;
  }

  if (targetLang.startsWith('ms')) {
    return malayCount >= englishCount;
  } else if (targetLang.startsWith('en')) {
    return englishCount >= malayCount;
  }

  return true;
}

export function deduplicateRssItems(items) {
  const seenGuids = new Set();
  const seenTitles = new Set();
  const uniqueItems = [];

  for (const item of items) {
    const titleKey = item.title.toLowerCase().trim();
    if (!seenGuids.has(item.rssGuid) && !seenTitles.has(titleKey)) {
      seenGuids.add(item.rssGuid);
      seenTitles.add(titleKey);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}
