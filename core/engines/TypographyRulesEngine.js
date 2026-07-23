// TypographyRulesEngine.js - Adjung Editorial Typography Layer v2.1 (core/engines/TypographyRulesEngine.js)
// High-performance token parser operating cleanly on text rendering WITHOUT mutating raw DB data.

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tokenizes text into styled segments based on Adjung Editorial Typography Rules.
 * Rules are sorted by priority (DESC), term length (DESC), and match type.
 *
 * @param {string} text - Raw input text
 * @param {Array} rules - List of adjung_typography_rules
 * @param {string} scope - Target scope ('all' | 'title' | 'brief' | 'body' | 'caption')
 * @param {string} language - Target language ('ms-MY', 'en', etc.)
 * @returns {Array<{ text: string, style: string, category?: string }>} Structured token array
 */
export function parseTypographyTokens(text, rules = [], scope = 'all', language = 'ms-MY') {
  if (!text || typeof text !== 'string') return [{ text: text || '', style: 'normal' }];
  if (!Array.isArray(rules) || rules.length === 0) return [{ text, style: 'normal' }];

  // 1. Filter active & applicable rules for scope and language
  const applicableRules = rules.filter(r => {
    if (!r.enabled && r.status !== 'active') return false;
    const matchScope = !r.scope || r.scope === 'all' || r.scope === scope;
    const matchLang = !r.language || r.language === 'all' || r.language === language;
    return matchScope && matchLang && r.term && r.term.trim() !== '';
  });

  if (applicableRules.length === 0) return [{ text, style: 'normal' }];

  // 2. Sort rules by Priority (DESC), then Term Length (DESC - longest match wins)
  applicableRules.sort((a, b) => {
    const prioA = Number(a.priority) || 50;
    const prioB = Number(b.priority) || 50;
    if (prioB !== prioA) return prioB - prioA;

    const lenA = (a.term || '').length;
    const lenB = (b.term || '').length;
    return lenB - lenA;
  });

  // Track matched slices in the original string: Array of { start, end, style, category }
  const matches = [];

  for (const rule of applicableRules) {
    let excludeList = [];
    if (rule.excludeTerms) {
      try {
        excludeList = typeof rule.excludeTerms === 'string' ? JSON.parse(rule.excludeTerms) : rule.excludeTerms;
      } catch (e) {
        excludeList = [];
      }
    }

    // Check if any excludeTerm exists in text
    let shouldExclude = false;
    for (const excl of excludeList) {
      if (excl && text.toLowerCase().includes(excl.toLowerCase())) {
        shouldExclude = true;
        break;
      }
    }
    if (shouldExclude) continue;

    let regexPattern = '';
    const flags = rule.caseSensitive ? 'g' : 'gi';

    if (rule.matchType === 'regex') {
      regexPattern = rule.term;
    } else {
      // Safe boundary lookbehind & lookahead to handle Malay prefixes/suffixes (scammers, scammernya)
      regexPattern = `(?<![A-Za-z0-9])${escapeRegExp(rule.term)}(?![A-Za-z0-9])`;
    }

    try {
      const regex = new RegExp(regexPattern, flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        const start = match.index;
        const end = match.index + match[0].length;

        // Ensure this range doesn't overlap with an existing higher-priority/longer match
        const hasOverlap = matches.some(m => Math.max(start, m.start) < Math.min(end, m.end));
        if (!hasOverlap) {
          matches.push({
            start,
            end,
            style: rule.style || 'italic',
            category: rule.category || 'foreign_term'
          });
        }
      }
    } catch (err) {
      console.warn(`[Typography Engine] Invalid RegEx rule '${rule.term}':`, err.message);
    }
  }

  if (matches.length === 0) return [{ text, style: 'normal' }];

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  // Build contiguous token array
  const tokens = [];
  let currentIndex = 0;

  for (const m of matches) {
    if (m.start > currentIndex) {
      tokens.push({
        text: text.slice(currentIndex, m.start),
        style: 'normal'
      });
    }
    tokens.push({
      text: text.slice(m.start, m.end),
      style: m.style,
      category: m.category
    });
    currentIndex = m.end;
  }

  if (currentIndex < text.length) {
    tokens.push({
      text: text.slice(currentIndex),
      style: 'normal'
    });
  }

  return tokens;
}
