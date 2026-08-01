// Utility module for sanitizing and cleaning HTML/RSS source texts before passing them to AI pipelines.

export function sanitizeHtmlText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let clean = rawText
    // Remove HTML tags
    .replace(/<[^>]*>/g, ' ')
    // Decode decimal numeric HTML entities (e.g. &#039;, &#8211;, &#8217;)
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return code ? String.fromCharCode(code) : '';
    })
    // Decode hex numeric HTML entities (e.g. &#x27;)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return code ? String.fromCharCode(code) : '';
    })
    // Replace named HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&hellip;/g, '...')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    // Completely remove all copyright symbols (&copy;, ©, (c), (C))
    .replace(/&(?:copy);?/gi, '')
    .replace(/©/g, '')
    .replace(/\s+\([cC]\)\s*/g, ' ')
    // Replace weird Unicode control characters
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    // Remove copyright boilerplate, publisher names, and 'all rights reserved' at the end of text (BRIEF_FORMATTER_RULE_006)
    .replace(/(?:\s*[-–—|•]?\s*(?:\bcopyright\b|\bhakcipta\b|\bhak cipta\b|\ball rights reserved\b|new straits times(?: press)?(?: \(m\) bhd)?|bernama|media prima|astro awani|utusan malaysia|kosmo(?: digital)?|sinar harian|berita harian|rtm|the star)\b.*$)/gi, '')
    // Remove comma before dots/ellipsis (e.g. TH,... or TH, ...)
    .replace(/,\s*(?:\.{3,}|…)/g, '...')
    // Format 4 or more dots as ". ..."
    .replace(/\.{4,}/g, '. ...')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    .trim();

  return clean;
}

// 2026-08-02 (Fasa 2, pepijat kritikal) — dahulu URL/GUID RSS turut ditapis melalui
// sanitizeHtmlText(), yang termasuk regex membuang nama penerbit ("bernama", "kosmo(
// digital)?", dll) di HUJUNG teks prosa (BRIEF_FORMATTER_RULE_006). Regex tu tak sedar ia
// sedang memproses URL, bukan ayat — "https://www.bernama.com/bm/news.php?id=21001"
// mengandungi "bernama" sebagai SEBAHAGIAN HOSTNAME, jadi segala-galanya SELEPAS perkataan
// itu (kandungan laluan penuh URL) turut terpadam, tinggal "https://www." sahaja. Dua
// daripada empat sumber RSS disemai (bernama.com, kosmo.com.my) terjejas — setiap item
// ticker daripada sumber tu simpan originalUrl yang rosak/tak boleh diklik.
//
// Fungsi ni sengaja HANYA nyahkod entiti HTML + buang tag + potong ruang — URL/GUID tak
// pernah perlu pembersihan prosa (nama penerbit/hakcipta/dsb) sebab ia bukan teks bacaan.
export function sanitizeUrlText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return code ? String.fromCharCode(code) : '';
    })
    .trim();
}

export function truncateWords(text, maxWords = 100) {
  if (!text) return '';
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

export function stripLocationDateline(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/^(?:[A-Z\s]{2,30}(?:[,\s]+\d{1,2}\s+[A-Za-z]+)?)\s*[\-–—:]+\s*/i, '').trim();
}
