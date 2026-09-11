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
  //
  // 2026-08-02 (Fasa 2, pepijat kritikal) — syarat asal `!r.enabled && r.status !== 'active'`
  // guna AND, bukan OR. Kesannya: peraturan yang DIMATIKAN (enabled=0) tapi status masih
  // 'active' (cth ditogol tak aktif di FrontpageView.tsx:862-881) LULUS penapis ni sebab
  // separuh syarat je benar — peraturan "dimatikan" terus terpakai di pratonton pelayan
  // walaupun editor dah togolkannya tak aktif. Client (TypographyRenderer.tsx) sentiasa
  // betul (`!isEn || !isAct`, OR). Disamakan di sini.
  const applicableRules = rules.filter(r => {
    const isEn = r.enabled === 1 || r.enabled === true;
    const isAct = !r.status || r.status === 'active';
    if (!isEn || !isAct) return false;
    const matchScope = !r.scope || r.scope === 'all' || r.scope === scope;
    const matchLang = !r.language || r.language === 'all' || r.language === language;
    return matchScope && matchLang && r.term && r.term.trim() !== '';
  });

  if (applicableRules.length === 0) return [{ text, style: 'normal' }];

  // 2. Sort rules by Priority (DESC), then Term Length (DESC - longest match wins)
  //
  // PEMBETULAN (2026-09-11, bug-hunt) — `Number(priority) || 50` gugurkan priority=0 (nilai
  // SAH — keutamaan terendah dlm `ORDER BY priority DESC`), jatuh balik ke 50, punca sama
  // pepijat yang dibaiki hari ni di slotRoutes.js POST /adjung-typography-rules DAN di
  // parseTypographyTokensClient (TypographyRenderer.tsx). Fail ni (parseTypographyTokens,
  // dipakai laluan pratonton "Uji Peraturan" slotRoutes.js GET /adjung-typography-rules/test)
  // terlepas pembetulan tu — peraturan priority=0 diuji admin nampak seolah-olah priority=50,
  // TAK padan susunan sebenar yang client guna semasa render frontpage sebenar.
  applicableRules.sort((a, b) => {
    const prioA = a.priority !== undefined && a.priority !== null ? Number(a.priority) : 50;
    const prioB = b.priority !== undefined && b.priority !== null ? Number(b.priority) : 50;
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
      // Sempadan Unicode (2026-09-11, dapatan bug-hunt, corak SAMA yang dibaiki di
      // IstilahGlosari.tsx — lihat CLAUDE.md "Medan borang terima sebarang glif Unicode") —
      // kelas ASCII [A-Za-z0-9] sebelum ni tak kenal huruf diakritik/pengubah (cth ʿ dalam
      // transliterasi Arab "ʿIlm", disahkan reproduce: peraturan bertepatan "ilm" padan
      // separuh perkataan "ʿIlm" sebab ʿ (U+02BF) dianggap sempadan). Kesan sebenar: peraturan
      // condong/tebal Typography Rules Engine terpakai pada SEBAHAGIAN perkataan sahaja pada
      // kandungan yang guna transliterasi Arab (NIQAB, dsb.), bukan seluruh istilah. Diganti
      // lookaround \p{L}\p{N}\p{M} (huruf + nombor + tanda gabungan), perlukan bendera 'u'.
      regexPattern = `(?<![\\p{L}\\p{N}\\p{M}])${escapeRegExp(rule.term)}(?![\\p{L}\\p{N}\\p{M}])`;
    }

    try {
      const regex = new RegExp(regexPattern, rule.matchType === 'regex' ? flags : flags + 'u');
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
