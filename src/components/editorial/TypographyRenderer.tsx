import React from 'react';

export interface TypographyRule {
  id: string;
  term: string;
  style: 'italic' | 'bold' | 'small_caps' | string;
  category?: string;
  matchType?: 'word' | 'phrase' | 'regex' | string;
  scope?: string;
  language?: string;
  caseSensitive?: number | boolean;
  priority?: number;
  status?: string;
  enabled?: number | boolean;
  excludeTerms?: string | string[];
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseTypographyTokensClient(
  text: string,
  rules: TypographyRule[] = [],
  scope: string = 'all',
  language: string = 'ms-MY'
): Array<{ text: string; style: string; category?: string }> {
  if (!text || typeof text !== 'string') return [{ text: text || '', style: 'normal' }];
  if (!Array.isArray(rules) || rules.length === 0) return [{ text, style: 'normal' }];

  const applicableRules = rules.filter(r => {
    const isEn = r.enabled === 1 || r.enabled === true;
    const isAct = !r.status || r.status === 'active';
    if (!isEn || !isAct) return false;
    const matchScope = !r.scope || r.scope === 'all' || r.scope === scope;
    const matchLang = !r.language || r.language === 'all' || r.language === language;
    return matchScope && matchLang && r.term && r.term.trim() !== '';
  });

  if (applicableRules.length === 0) return [{ text, style: 'normal' }];

  applicableRules.sort((a, b) => {
    const prioA = Number(a.priority) || 50;
    const prioB = Number(b.priority) || 50;
    if (prioB !== prioA) return prioB - prioA;
    return (b.term || '').length - (a.term || '').length;
  });

  const matches: Array<{ start: number; end: number; style: string; category?: string }> = [];

  for (const rule of applicableRules) {
    let excludeList: string[] = [];
    if (rule.excludeTerms) {
      try {
        excludeList = typeof rule.excludeTerms === 'string' ? JSON.parse(rule.excludeTerms) : rule.excludeTerms;
      } catch (e) {
        excludeList = [];
      }
    }

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
      regexPattern = `(?<![A-Za-z0-9])${escapeRegExp(rule.term)}(?![A-Za-z0-9])`;
    }

    try {
      const regex = new RegExp(regexPattern, flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        const start = match.index;
        const end = match.index + match[0].length;
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
      // Ignore invalid regex
    }
  }

  if (matches.length === 0) return [{ text, style: 'normal' }];

  matches.sort((a, b) => a.start - b.start);

  const tokens: Array<{ text: string; style: string; category?: string }> = [];
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

export const TypographyRenderer: React.FC<{
  text: string;
  rules?: TypographyRule[];
  scope?: string;
  language?: string;
  className?: string;
}> = ({ text, rules = [], scope = 'all', language = 'ms-MY', className = '' }) => {
  const tokens = parseTypographyTokensClient(text, rules, scope, language);

  return (
    <span className={className}>
      {tokens.map((token, idx) => {
        if (token.style === 'italic') {
          return (
            <em key={idx} className="italic font-serif inline" style={{ fontStyle: 'italic' }}>
              {token.text}
            </em>
          );
        } else if (token.style === 'bold') {
          return (
            <strong key={idx} className="font-bold inline" style={{ fontWeight: 'bold' }}>
              {token.text}
            </strong>
          );
        } else if (token.style === 'small_caps') {
          return (
            <span key={idx} className="uppercase text-[0.88em] tracking-wider font-semibold inline" style={{ fontVariant: 'small-caps' }}>
              {token.text}
            </span>
          );
        }
        return <React.Fragment key={idx}>{token.text}</React.Fragment>;
      })}
    </span>
  );
};
