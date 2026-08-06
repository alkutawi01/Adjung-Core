// EditorialTextNormalizer.js - Dynamic Text Cleaning & Transformation Engine for Adjung Brief.
// 100% Configurable by Chief Editor via Adjung Editorial Text Rules.

// stripLocationDateline diimport terus daripada SourceSanitizer.js (2026-08-06, pembetulan
// audit) — dahulu DUA salinan byte-for-byte sama fungsi ni wujud (satu di sini, satu di
// SourceSanitizer.js/dipakai RssDirectEngine.js), risiko hanyut kalau satu diubah tanpa yang
// lain. Kedua-dua salinan disahkan LIVE (bukan satu kod mati) — laluan ni (normalizeEditorialText/
// processTextWithTrace, dipanggil slotRoutes.js semasa ambilan RSS) dan RssDirectEngine.js
// kedua-duanya benar-benar dilaksanakan.
import { stripLocationDateline } from './SourceSanitizer.js';
export { stripLocationDateline };

export function decodeHtmlEntities(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  return rawText
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
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&hellip;/g, '...')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
}


/**
 * Filter and sort rules applicable for a specific scope and sourceId.
 */
export function getApplicableRules(rules = [], scope = 'brief', sourceId = null) {
  return rules
    .filter(rule => {
      if (!rule || !rule.enabled) return false;
      
      // Filter by scope ('all' applies everywhere)
      const matchesScope = rule.scope === 'all' || rule.scope === scope;
      if (!matchesScope) return false;

      // Filter by sourceId (null / 'global' applies to all sources)
      const matchesSource = !rule.sourceId || rule.sourceId === 'global' || rule.sourceId === sourceId;
      return matchesSource;
    })
    .sort((a, b) => (a.orderIndex || 10) - (b.orderIndex || 10));
}

/**
 * Apply active rules to a single text string and record execution trace.
 */
export function processTextWithTrace(rawText, scope = 'brief', sourceId = null, rules = []) {
  if (typeof rawText !== 'string') return { originalText: '', cleanedText: '', trace: [] };

  const applicableRules = getApplicableRules(rules, scope, sourceId);
  let currentText = rawText;
  const trace = [];

  for (let i = 0; i < applicableRules.length; i++) {
    const rule = applicableRules[i];
    const before = currentText;
    let after = before;

    try {
      if (rule.ruleType === 'decode_entities') {
        after = decodeHtmlEntities(before);
      } else if (rule.ruleType === 'strip_dateline') {
        after = stripLocationDateline(before);
      } else if (rule.ruleType === 'substitute' && rule.pattern) {
        after = before.split(rule.pattern).join(rule.replacement || '');
      } else if (rule.ruleType === 'regex' && rule.pattern) {
        const flags = rule.flags || 'g';
        const rx = new RegExp(rule.pattern, flags);
        after = before.replace(rx, rule.replacement || '');
      }
    } catch (err) {
      console.error(`[EditorialTextNormalizer Error] Rule '${rule.ruleName}':`, err.message);
    }

    if (before !== after) {
      trace.push({
        step: trace.length + 1,
        ruleId: rule.id,
        ruleName: rule.ruleName,
        ruleType: rule.ruleType,
        before,
        after
      });
      currentText = after;
    }
  }

  // Strip copyright symbols
  currentText = currentText.replace(/&(?:copy);?/gi, '').replace(/©/g, '');
  // Remove comma before dots/ellipsis (e.g. TH,... or TH, ...)
  currentText = currentText.replace(/,\s*(?:\.{3,}|…)/g, '...');
  // Format 4 or more dots as ". ..."
  currentText = currentText.replace(/\.{4,}/g, '. ...');
  // Final trim and whitespace collapse
  currentText = currentText.replace(/\s+/g, ' ').trim();

  return {
    originalText: rawText,
    cleanedText: currentText,
    trace
  };
}

/**
 * Convenience function to return normalized text directly.
 */
export function normalizeEditorialText(rawText, scope = 'brief', sourceId = null, rules = []) {
  const result = processTextWithTrace(rawText, scope, sourceId, rules);
  return result.cleanedText;
}
