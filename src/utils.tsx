import React from 'react';
import { Citation, EditorBlock, NewsItem, ParseError } from './types';
import { citationStyleRegistry, HarvardStylePlugin } from './services/citationStyles';
import { Tooltip } from './components/common/Tooltip';
import { penggalSukuKata } from '../core/editorial/PemenggalSukuKata.js';
import { parseTypographyTokensClient, TypographyRule } from './components/editorial/TypographyRenderer';

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const LATIN_REGEX = /[a-zA-Z]/g;
const ARABIC_PHRASE_REGEX = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:[\s.,،؟؛'"]+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*)/;

/**
 * Detects if a given text block's dominant script is Arabic/Jawi.
 * Counting Arabic/Jawi script characters vs Latin LTR characters.
 */
export function isArabicText(text: string): boolean {
  if (!text) return false;
  
  const arabicMatches = text.match(ARABIC_REGEX) || [];
  const latinMatches = text.match(LATIN_REGEX) || [];

  if (arabicMatches.length === 0) return false;
  if (latinMatches.length === 0) return true;

  // Dominant script determines the direction of the block
  return arabicMatches.length > latinMatches.length;
}

export function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/(\*\*\*|___)(.*?)\1/g, '$2')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\+\+(.*?)\+\+/g, '$1')
    .replace(/<u>(.*?)<\/u>/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

export function handleMarkdownShortcut(
  e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, 
  value: string, 
  onChange: (newVal: string) => void
) {
  // Keeping this for Source Mode where we still use textareas
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
    e.preventDefault();
    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    
    if (start !== null && end !== null && start !== end) {
      const selectedText = value.substring(start, end);
      const before = value.substring(0, start);
      const after = value.substring(end);
      
      const newVal = before + '*' + selectedText + '*' + after;
      onChange(newVal);
      
      setTimeout(() => {
        target.focus();
        target.setSelectionRange(start + 1, end + 1);
      }, 0);
    }
  }
  
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    
    if (start !== null && end !== null && start !== end) {
      const selectedText = value.substring(start, end);
      const before = value.substring(0, start);
      const after = value.substring(end);
      
      const newVal = before + '**' + selectedText + '**' + after;
      onChange(newVal);
      
      setTimeout(() => {
        target.focus();
        target.setSelectionRange(start + 2, end + 2);
      }, 0);
    }
  }
}

export function markdownToHtml(md: string): string {
  if (!md) return '';
  let content = md.replace(/\r\n/g, '\n');
  
  // Split by double newline to separate blocks
  const blocks = content.split('\n\n');
  
  const htmlBlocks = blocks.map(block => {
    let trimmed = block.trim();
    if (!trimmed) return '';
    
    // Check if it is a heading
    if (trimmed.startsWith('# ')) {
      return `<h1>${trimmed.slice(2)}</h1>`;
    }
    if (trimmed.startsWith('## ')) {
      return `<h2>${trimmed.slice(3)}</h2>`;
    }
    
    // Check if it is a blockquote
    if (trimmed.startsWith('> ')) {
      const quoteContent = trimmed.split('\n')
        .map(line => line.startsWith('> ') ? line.slice(2) : line)
        .join('<br>');
      return `<blockquote>${quoteContent}</blockquote>`;
    }
    
    // Otherwise it is a paragraph
    const paraContent = trimmed.replace(/\n/g, '<br>');
    return `<p>${paraContent}</p>`;
  });
  
  const html = htmlBlocks.filter(Boolean).join('');

  return html
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\[\^(fn-[a-zA-Z0-9-]+)\]/g, '<span class="footnote-badge" data-id="$1" contenteditable="false"></span>')
    .replace(/\[\^(mn-[a-zA-Z0-9-]+)\]/g, '<span class="margin-note-badge" data-id="$1" contenteditable="false"></span>')
    .replace(/\[\^(\d+)\]/g, '<span class="footnote-badge" data-id="fn-legacy-$1" contenteditable="false"></span>')
    .replace(/(\*\*\*|___)(.*?)\1/g, '<strong><em>$2</em></strong>')
    .replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>')
    .replace(/(\*|_)(.*?)\1/g, '<em>$2</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\+\+(.*?)\+\+/g, '<u>$1</u>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
      if (url.startsWith('gloss:')) {
        const glossVal = url.substring(6);
        return `<span class="interlinear-word"><span class="interlinear-gloss">${glossVal}</span>${label}</span>`;
      }
      return `<a href="${url}">${label}</a>`;
    });
}

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html
    .replace(/<span[^>]+class="[^"]*(footnote-badge|margin-note-badge)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, (match) => {
      const idMatch = match.match(/data-id="([^"]+)"/i);
      return idMatch ? `[^${idMatch[1]}]` : '';
    })
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, p1) => {
      const lines = p1.split(/<br\s*\/?>|<\/?p[^>]*>|<\/?div[^>]*>/i)
        .map((line: string) => line.trim())
        .filter(Boolean);
      return lines.map((line: string) => `> ${line}`).join('\n\n') + '\n\n';
    })
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong[^>]*><em[^>]*>(.*?)<\/em><\/strong>/gi, '***$1***')
    .replace(/<em[^>]*><strong[^>]*>(.*?)<\/strong><\/em>/gi, '***$1***')
    .replace(/<b[^>]*><i[^>]*>(.*?)<\/i><\/b>/gi, '***$1***')
    .replace(/<i[^>]*><b[^>]*>(.*?)<\/b><\/i>/gi, '***$1***')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<u[^>]*>(.*?)<\/u>/gi, '++$1++')
    .replace(/<span[^>]*class="interlinear-word"[^>]*><span[^>]*class="interlinear-gloss"[^>]*>(.*?)<\/span>(.*?)<\/span>/gi, '[$2](gloss:$1)')
    .replace(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/\n\n\n+/g, '\n\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
    
  return md.trim();
}

type TokenType = 'TRIPLE_AST' | 'TRIPLE_UND' | 'DOUBLE_AST' | 'DOUBLE_UND' | 'SINGLE_AST' | 'SINGLE_UND' | 'BACKTICK' | 'TEXT' | 'DOUBLE_PLUS' | 'HTML_U_OPEN' | 'HTML_U_CLOSE' | 'LINK' | 'INTERLINEAR';

interface Token {
  type: TokenType;
  text: string;
  url?: string;
  gloss?: string;
}

// Had imbasan carian penutup ')' bagi [label](gloss:...)/[label](url) -- gloss ialah
// anotasi PENDEK (definisi satu-dua ayat), bukan perenggan; had ni jadi sempadan selamat
// bila penutup tiada langsung, elak imbasan tanpa henti sepanjang baki dokumen.
const GLOSS_LOOKAHEAD_MAX = 300;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = text.length;
  let currentText = '';

  const flushText = () => {
    if (currentText) {
      tokens.push({ type: 'TEXT', text: currentText });
      currentText = '';
    }
  };

  while (i < len) {
    if (text.startsWith('***', i)) {
      flushText();
      tokens.push({ type: 'TRIPLE_AST', text: '***' });
      i += 3;
    } else if (text.startsWith('___', i)) {
      flushText();
      tokens.push({ type: 'TRIPLE_UND', text: '___' });
      i += 3;
    } else if (text.startsWith('**', i)) {
      flushText();
      tokens.push({ type: 'DOUBLE_AST', text: '**' });
      i += 2;
    } else if (text.startsWith('__', i)) {
      flushText();
      tokens.push({ type: 'DOUBLE_UND', text: '__' });
      i += 2;
    } else if (text.startsWith('*', i)) {
      flushText();
      tokens.push({ type: 'SINGLE_AST', text: '*' });
      i += 1;
    } else if (text.startsWith('_', i)) {
      flushText();
      tokens.push({ type: 'SINGLE_UND', text: '_' });
      i += 1;
    } else if (text.startsWith('`', i)) {
      flushText();
      tokens.push({ type: 'BACKTICK', text: '`' });
      i += 1;
    } else if (text.startsWith('++', i)) {
      flushText();
      tokens.push({ type: 'DOUBLE_PLUS', text: '++' });
      i += 2;
    } else if (text.startsWith('<u>', i)) {
      flushText();
      tokens.push({ type: 'HTML_U_OPEN', text: '<u>' });
      i += 3;
    } else if (text.startsWith('</u>', i)) {
      flushText();
      tokens.push({ type: 'HTML_U_CLOSE', text: '</u>' });
      i += 4;
    } else if (text.startsWith('[', i)) {
      const closeBracket = text.indexOf('](', i);
      if (closeBracket !== -1) {
        // Padanan kurungan SEIMBANG (bukan indexOf ')' pertama) — gloss/link boleh ada
        // '(...)' wajar dalam maksudnya sendiri (cth "(rujuk...)"), dan carian naif ambil
        // ')' PERTAMA akan potong separuh nilai + bocorkan baki teks sbg literal (pepijat
        // sebenar ditemui simulasi UX, audit ChatGPT 2026-08-12). Had skop carian
        // (GLOSS_LOOKAHEAD_MAX) elak imbasan tanpa henti sepanjang baki dokumen bila
        // penutup sengaja/tak sengaja tiada — gloss ialah anotasi PENDEK, bukan perenggan.
        let depth = 1;
        let j = closeBracket + 2;
        let closeParen = -1;
        const scanLimit = Math.min(len, closeBracket + 2 + GLOSS_LOOKAHEAD_MAX);
        while (j < scanLimit) {
          if (text[j] === '(') depth++;
          else if (text[j] === ')') {
            depth--;
            if (depth === 0) { closeParen = j; break; }
          }
          j++;
        }
        if (closeParen !== -1) {
          flushText();
          const label = text.substring(i + 1, closeBracket);
          const url = text.substring(closeBracket + 2, closeParen);
          if (url.startsWith('gloss:')) {
            const glossVal = url.substring(6);
            tokens.push({ type: 'INTERLINEAR', text: label, gloss: glossVal });
          } else {
            tokens.push({ type: 'LINK', text: label, url: url });
          }
          i = closeParen + 1;
          continue;
        }
        // Sintaks rosak (tiada penutup seimbang dlm skop) — JANGAN bocorkan markup mentah
        // '[label](gloss:...' kpd pembaca (kontrak dikunci selepas audit: renderer perlu
        // fallback selamat, bukan pindah beban kpd editor via validation simpan). Papar
        // label sahaja sbg teks biasa, sambung imbas TERUS lepas '](' — elak "makan" baki
        // kandungan/format sah yg menyusul (cth *italic* lepas gloss rosak).
        flushText();
        const label = text.substring(i + 1, closeBracket);
        currentText += label;
        i = closeBracket + 2;
        continue;
      }
      currentText += text[i];
      i += 1;
    } else {
      currentText += text[i];
      i += 1;
    }
  }
  flushText();
  return tokens;
}

function parseTokens(tokens: Token[], keyPrefix: string = 'token'): React.ReactNode[] {
  let i = 0;
  const result: React.ReactNode[] = [];
  let keyIdx = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === 'TEXT') {
      const parts = token.text.split(ARABIC_PHRASE_REGEX);
      const textNodes = parts.map((part, pIdx) => {
        if (!part) return null;
        if (ARABIC_PHRASE_REGEX.test(part)) {
          return (
            <bdi key={`ar-${pIdx}`} dir="rtl" className="font-arabic font-normal inline-block" style={{ lineHeight: 'normal' }}>
              {part}
            </bdi>
          );
        }
        return part;
      });
      result.push(<React.Fragment key={`${keyPrefix}-${keyIdx++}`}>{textNodes}</React.Fragment>);
      i++;
      continue;
    }

    if (token.type === 'LINK') {
      const elementKey = `${keyPrefix}-${keyIdx++}`;
      result.push(
        <a key={elementKey} href={token.url} target="_blank" rel="noopener noreferrer" className="text-Adjung-maroon hover:underline cursor-pointer">
          {token.text}
        </a>
      );
      i++;
      continue;
    }

    if (token.type === 'INTERLINEAR') {
      const elementKey = `${keyPrefix}-${keyIdx++}`;
      const isGlossAr = isArabicText(token.gloss);
      result.push(
        <span key={elementKey} className="interlinear-word">
          <span 
            className={`interlinear-gloss ${isGlossAr ? 'font-arabic-handwritten text-xs' : ''}`}
            style={isGlossAr ? { fontFamily: 'var(--font-arabic-handwritten)' } : undefined}
          >
            {token.gloss}
          </span>
          {token.text}
        </span>
      );
      i++;
      continue;
    }

    // It's a formatting marker
    let matchIdx = -1;
    let closingType = token.type;
    if (token.type === 'HTML_U_OPEN') closingType = 'HTML_U_CLOSE';

    for (let j = i + 1; j < tokens.length; j++) {
      if (tokens[j].type === closingType) {
        matchIdx = j;
        break;
      }
    }

    if (matchIdx !== -1) {
      const innerTokens = tokens.slice(i + 1, matchIdx);
      const innerParsed = parseTokens(innerTokens, `${keyPrefix}-${keyIdx++}`);

      const elementKey = `${keyPrefix}-${keyIdx++}`;
      if (token.type === 'TRIPLE_AST' || token.type === 'TRIPLE_UND') {
        result.push(
          <strong key={elementKey} className="font-bold text-[#111111]">
            <em className="italic">{innerParsed}</em>
          </strong>
        );
      } else if (token.type === 'DOUBLE_AST' || token.type === 'DOUBLE_UND') {
        result.push(
          <strong key={elementKey} className="font-bold text-[#111111]">
            {innerParsed}
          </strong>
        );
      } else if (token.type === 'SINGLE_AST' || token.type === 'SINGLE_UND') {
        result.push(
          <em key={elementKey} className="italic">
            {innerParsed}
          </em>
        );
      } else if (token.type === 'BACKTICK') {
        result.push(
          <code key={elementKey} className="font-mono text-[13px] bg-stone-100 text-[#802334] px-1 py-0.5 rounded-sm border border-stone-200/50">
            {innerParsed}
          </code>
        );
      } else if (token.type === 'DOUBLE_PLUS' || token.type === 'HTML_U_OPEN') {
        result.push(
          <u key={elementKey} className="underline decoration-stone-300">
            {innerParsed}
          </u>
        );
      }
      i = matchIdx + 1;
    } else {
      // No matching closing marker found. Treat this marker as literal plain text!
      result.push(<React.Fragment key={`${keyPrefix}-${keyIdx++}`}>{token.text}</React.Fragment>);
      i++;
    }
  }

  return result;
}

const UNIFIED_REGEX = /(\[\^((?:fn|mn)-[a-zA-Z0-9-]+)\]|\[\^(\d+)\]|\[cite:([^\]]+)\]|\[@(fig|tbl|sec|fn):([a-zA-Z0-9-]+)\])/g;

export function toRoman(num: number): string {
  const val = [10, 9, 5, 4, 1];
  const syb = ["x", "ix", "v", "iv", "i"];
  let roman = "";
  let n = num;
  for (let i = 0; i < val.length; i++) {
    while (n >= val[i]) {
      roman += syb[i];
      n -= val[i];
    }
  }
  return roman;
}

/**
 * Semantic Inline Markdown Parser:
 * Replaces Markdown styles with clean inline HTML/React elements without leakage.
 * Processes footers, citations and inline elements recursively and safely.
 */
function renderPartNode(
  part: any,
  citations: Citation[],
  sortOrder: 'alphabetical' | 'appearance',
  citationsMap: { [id: string]: number },
  footnotesMap: Record<string, number>,
  crossRefMap: Record<string, string>,
  citationStyle: string,
  marginNotesMap: Record<string, number>
): React.ReactNode {
  if (part.type === 'fn-stable') {
    let num: number | string | undefined = footnotesMap[part.content] || footnotesMap[`fn-${part.content}`];
    if (!num) {
      num = part.content.startsWith('fn-legacy-') ? part.content.replace('fn-legacy-', '') : '?';
    }
    return (
      <Tooltip key={part.key} text={`Jump to footnote ${num}`}>
        <span
          className="footnote-ref text-[10px] font-medium align-super select-none hover:text-Adjung-maroon font-sans px-0.5 cursor-pointer scroll-mt-24 transition-all duration-350"
          id={`fnref-${part.content}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const target = document.getElementById(`footnote-dest-${part.content}`);
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              target.classList.remove('footnote-dest-flash');
              void target.offsetWidth;
              target.classList.add('footnote-dest-flash');
              setTimeout(() => target.classList.remove('footnote-dest-flash'), 2500);
            }
          }}
        >
          ({num})
        </span>
      </Tooltip>
    );
  }

  if (part.type === 'fn-legacy') {
    const num = footnotesMap[part.content] || part.content;
    return (
      <Tooltip key={part.key} text={`Jump to footnote ${num}`}>
        <span
          className="footnote-ref text-[10px] font-medium align-super select-none hover:text-Adjung-maroon font-sans px-0.5 cursor-pointer scroll-mt-24 transition-all duration-350"
          id={`fnref-legacy-${part.content}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const target = document.getElementById(`footnote-dest-legacy-${part.content}`);
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              target.classList.remove('footnote-dest-flash');
              void target.offsetWidth;
              target.classList.add('footnote-dest-flash');
              setTimeout(() => target.classList.remove('footnote-dest-flash'), 2500);
            }
          }}
        >
          ({num})
        </span>
      </Tooltip>
    );
  }

  if (part.type === 'mn-stable') {
    const num = marginNotesMap[part.content] || '?';
    const roman = typeof num === 'number' ? toRoman(num).toLowerCase() : num;
    return (
      <Tooltip key={part.key} text={`Margin Note ${roman}`}>
        <span
          id={`mn-marker-${part.content}`}
          className="margin-note-ref text-[10px] font-medium align-super select-none text-Adjung-maroon font-sans px-0.5 cursor-default"
        >
          ({roman})
        </span>
      </Tooltip>
    );
  }

  if (part.type === 'cite') {
    const citation = citations.find(c => c.id === part.content);
    if (!citation) {
      return <span key={part.key} className="text-red-500 font-mono text-xs">[cite-error]</span>;
    }

    const stylePlugin = citationStyleRegistry.get(citationStyle) || HarvardStylePlugin;
    const index = citationsMap[citation.id] || 1;
    const label = stylePlugin.formatCitation(citation, index, sortOrder);

    return (
      <Tooltip key={part.key} text={`${citation.author} (${citation.year}) - ${citation.title}`}>
        <span
          className="citation-ref text-[11px] font-sans font-medium text-Adjung-maroon hover:underline px-0.5 select-none cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const target = document.getElementById(`reference-${citation.id}`);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        >
          {label}
        </span>
      </Tooltip>
    );
  }

  if (part.type === 'cross-ref') {
    const [refType, refId] = part.content.split(':');
    let label = '';
    if (refType === 'fn') {
      const num = footnotesMap[refId] || footnotesMap[`fn-${refId}`] || '?';
      label = `Footnote ${num}`;
    } else {
      label = crossRefMap[refId] || `${refType.charAt(0).toUpperCase() + refType.slice(1)} ?`;
    }
    return (
      <span
        key={part.key}
        className="cross-ref text-[11px] font-sans font-medium text-Adjung-maroon hover:underline px-0.5 cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const target = document.getElementById(`ref-${refId}`);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      >
        {label}
      </span>
    );
  }

  const subText = part.content;
  const tokens = tokenize(subText);
  return parseTokens(tokens, part.key);
}

export function parseInlineFormatting(
  text: string,
  citations: Citation[] = [],
  sortOrder: 'alphabetical' | 'appearance' = 'alphabetical',
  citationsMap: { [id: string]: number } = {},
  footnotesMap: Record<string, number> = {},
  crossRefMap: Record<string, string> = {},
  citationStyle: string = 'harvard',
  marginNotesMap: Record<string, number> = {}
): React.ReactNode {
  if (!text) return '';

  const parts: { type: 'text' | 'fn-stable' | 'fn-legacy' | 'mn-stable' | 'cite' | 'cross-ref'; content: string; key: string }[] = [];
  let lastIndex = 0;
  let match;
  let keyIdx = 0;

  UNIFIED_REGEX.lastIndex = 0;
  while ((match = UNIFIED_REGEX.exec(text)) !== null) {
    const index = match.index;
    const matchedText = match[0];

    if (index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, index), key: `txt-${keyIdx++}` });
    }

    if (match[2]) {
      const fnId = match[2];
      if (fnId.startsWith('mn-')) {
        parts.push({ type: 'mn-stable', content: fnId, key: `mn-stable-${fnId}-${keyIdx++}` });
      } else {
        parts.push({ type: 'fn-stable', content: fnId, key: `fn-stable-${fnId}-${keyIdx++}` });
      }
    } else if (match[3]) {
      const fnNum = match[3];
      parts.push({ type: 'fn-legacy', content: fnNum, key: `fn-legacy-${fnNum}-${keyIdx++}` });
    } else if (match[4]) {
      const citeId = match[4];
      parts.push({ type: 'cite', content: citeId, key: `cite-${citeId}-${keyIdx++}` });
    } else if (match[5] && match[6]) {
      const refType = match[5];
      const refId = match[6];
      parts.push({ type: 'cross-ref', content: `${refType}:${refId}`, key: `cross-${refType}-${refId}-${keyIdx++}` });
    }
    lastIndex = UNIFIED_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex), key: `txt-${keyIdx++}` });
  }

  if (parts.length === 0) {
    parts.push({ type: 'text', content: text, key: 'txt-all' });
  }

  const nodes: React.ReactNode[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (part.type === 'text') {
      const nextPart = parts[i + 1];
      const isNextBadge = nextPart && (nextPart.type === 'fn-stable' || nextPart.type === 'fn-legacy' || nextPart.type === 'mn-stable');
      
      if (isNextBadge) {
        const textContent = part.content;
        const lastWordMatch = textContent.match(/(\s+)([^\s]+)\s*$/);
        
        if (lastWordMatch) {
          const lastWord = lastWordMatch[2];
          const lastWordIndex = textContent.lastIndexOf(lastWord);
          const mainText = textContent.substring(0, lastWordIndex);
          
          nodes.push(
            <React.Fragment key={part.key}>
              {parseTokens(tokenize(mainText))}
            </React.Fragment>
          );
          
          const badgeNode = renderPartNode(nextPart, citations, sortOrder, citationsMap, footnotesMap, crossRefMap, citationStyle, marginNotesMap);
          nodes.push(
            <span key={`nowrap-${part.key}`} className="inline-block whitespace-nowrap">
              {parseTokens(tokenize(lastWord))}
              {badgeNode}
            </span>
          );
          
          i++;
        } else {
          const badgeNode = renderPartNode(nextPart, citations, sortOrder, citationsMap, footnotesMap, crossRefMap, citationStyle, marginNotesMap);
          nodes.push(
            <span key={`nowrap-${part.key}`} className="inline-block whitespace-nowrap">
              {parseTokens(tokenize(textContent))}
              {badgeNode}
            </span>
          );
          i++;
        }
      } else {
        nodes.push(<React.Fragment key={part.key}>{parseTokens(tokenize(part.content))}</React.Fragment>);
      }
    } else {
      nodes.push(renderPartNode(part, citations, sortOrder, citationsMap, footnotesMap, crossRefMap, citationStyle, marginNotesMap));
    }
  }

  return nodes;
}

// safeParseInline (2026-08-02, dipindah dari FrontpageView.tsx, Fasa 8) — bungkusan tunggal
// gloss/pemenggalan/autocondong bagi SEMUA teks editorial dipapar kepada pembaca (kad bento DAN
// Focus View kini kedua-duanya guna fungsi SAMA, bukan dua laluan berasingan yang boleh
// terpesong). Diletak di sini (bukan kekal dalam FrontpageView.tsx) supaya FocusView.tsx boleh
// import terus tanpa import bulat (FrontpageView.tsx sendiri import FocusView.tsx).
//
// Bendera dalam-modul (glosSelariAktif/typographyRulesAktif) diselaraskan oleh FrontpageView.tsx
// via setGlosSelariAktif()/setTypographyRulesAktif() setiap kali systemSettings/peraturan
// autocondong berubah — corak sama seperti sebelum ni (satu bendera dalam-modul, bukan prop
// dihantar merentasi ~60 tapak render kad + Focus View).
let glosSelariAktif = false;
export const setGlosSelariAktif = (aktif: boolean) => { glosSelariAktif = aktif; };

let typographyRulesAktif: TypographyRule[] = [];
export const setTypographyRulesAktif = (rules: TypographyRule[]) => {
  typographyRulesAktif = rules;
};

const GLOSS_SYNTAX_RE = /\[([^\]]+)\]\(gloss:[^)]*\)/g;
const stripGlossSyntax = (text: string): string => text.replace(GLOSS_SYNTAX_RE, '$1');

export const safeParseInline = (text: string): React.ReactNode => {
  if (typeof text !== 'string' || text === '') return text;
  try {
    const sumber = glosSelariAktif ? text : stripGlossSyntax(text);
    if (typographyRulesAktif.length === 0) {
      return parseInlineFormatting(penggalSukuKata(sumber));
    }
    // Autocondong dahulu (segmen teks mentah ikut peraturan istilah asing), gloss/pemenggalan
    // sedia ada TERUS terpakai di dalam setiap segmen 'normal' — segmen dipadan (italic/bold/
    // small_caps) dilangkau daripada gloss (jarang bertindih, istilah pendek) tapi tetap
    // dipenggal suku kata untuk keselamatan bungkus baris kad sempit.
    const tokens = parseTypographyTokensClient(sumber, typographyRulesAktif, 'all', 'ms-MY');
    return tokens.map((token, idx) => {
      if (token.style === 'normal') {
        return <React.Fragment key={idx}>{parseInlineFormatting(penggalSukuKata(token.text))}</React.Fragment>;
      }
      const dipenggal = penggalSukuKata(token.text);
      if (token.style === 'italic') {
        return <em key={idx} className="italic font-serif inline" style={{ fontStyle: 'italic' }}>{dipenggal}</em>;
      }
      if (token.style === 'bold') {
        return <strong key={idx} className="font-bold inline" style={{ fontWeight: 'bold' }}>{dipenggal}</strong>;
      }
      if (token.style === 'small_caps') {
        return <span key={idx} className="uppercase text-[0.88em] tracking-wider font-semibold inline" style={{ fontVariant: 'small-caps' }}>{dipenggal}</span>;
      }
      return <React.Fragment key={idx}>{dipenggal}</React.Fragment>;
    });
  } catch (e) {
    console.warn('parseInlineFormatting failed, falling back to plain text:', e, text);
    return text;
  }
};

/**
 * Generates an elegant and unique canonical URL for a given writer and post slug.
 */
export function generateCanonicalUrl(penName: string, type: string, slug: string): string {
  const authorSubdomain = penName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `https://${authorSubdomain}.Adjung.com/${type.toLowerCase()}/${slug}`;
}

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface HeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3;
  text: string;
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: Array<{ text: string; checked?: boolean }>;
}

export interface TableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
  alignments?: Array<'left' | 'center' | 'right'>;
}

export interface ImageBlock {
  type: 'image';
  alt: string;
  url: string;
}

export interface DividerBlock {
  type: 'divider';
}

export interface CodeBlock {
  type: 'code-block';
  language?: string;
  code: string;
}

export interface LatinQuoteBlock {
  type: 'latin-quote';
  text: string;
  translation?: string;
  attribution?: string;
}

export interface ArabicQuoteBlock {
  type: 'arabic-quote';
  arabic: string;
  translation?: string;
  attribution?: string;
}

export interface CalloutBlock {
  type: 'callout';
  calloutType: 'note' | 'warning' | 'tip' | 'important' | 'definition';
  title?: string;
  text: string;
}

export type ContentBlock = 
  | ParagraphBlock 
  | HeadingBlock 
  | ListBlock 
  | TableBlock 
  | ImageBlock 
  | DividerBlock 
  | CodeBlock 
  | LatinQuoteBlock 
  | ArabicQuoteBlock
  | CalloutBlock;

/**
 * Parses raw text content into an array of structured ContentBlocks.
 * Handles both the new explicit XML <quote> tags and legacy Markdown blockquotes.
 */
export function parseContentToBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  if (!content) return [];

  // Parse a single block segment
  const parseSingleSegment = (segment: string): ContentBlock => {
    const trimmed = segment.trim();

    // 1. Callout Block
    if (trimmed.startsWith('<callout')) {
      const typeMatch = trimmed.match(/type="([^"]+)"/);
      const titleMatch = trimmed.match(/title="([^"]+)"/);
      const cType = (typeMatch ? typeMatch[1] : 'note') as 'note' | 'warning' | 'tip' | 'important' | 'definition';
      const titleVal = titleMatch ? titleMatch[1] : undefined;
      const textStart = segment.indexOf('>') + 1;
      const textEnd = segment.lastIndexOf('</callout>');
      const textVal = textEnd !== -1 ? segment.substring(textStart, textEnd).trim() : segment.substring(textStart).trim();
      return {
        type: 'callout',
        calloutType: cType,
        title: titleVal,
        text: textVal
      };
    }

    // 2. XML Quote Block
    if (trimmed.startsWith('<quote')) {
      const typeMatch = trimmed.match(/type="([^"]+)"/);
      const attribMatch = trimmed.match(/attribution="([^"]+)"/);
      const qType = typeMatch ? typeMatch[1] : 'latin';
      const quoteAttrib = attribMatch ? attribMatch[1] : undefined;

      const tagEnd = segment.indexOf('>');
      const quoteEnd = segment.lastIndexOf('</quote>');
      const inner = quoteEnd !== -1 ? segment.substring(tagEnd + 1, quoteEnd).trim() : segment.substring(tagEnd + 1).trim();

      if (qType === 'arabic') {
        const arStart = inner.indexOf('<arabic>');
        const arEnd = inner.indexOf('</arabic>');
        let arabicVal = '';
        if (arStart !== -1 && arEnd !== -1) {
          arabicVal = inner.substring(arStart + 8, arEnd).trim();
        } else {
          arabicVal = inner;
        }

        const transStart = inner.indexOf('<translation>');
        const transEnd = inner.indexOf('</translation>');
        let translationVal: string | undefined = undefined;
        if (transStart !== -1 && transEnd !== -1) {
          translationVal = inner.substring(transStart + 13, transEnd).trim();
        }

        return {
          type: 'arabic-quote',
          arabic: arabicVal,
          translation: translationVal,
          attribution: quoteAttrib
        };
      } else {
        const textStart = inner.indexOf('<text>');
        const textEnd = inner.indexOf('</text>');
        let textVal = '';
        if (textStart !== -1 && textEnd !== -1) {
          textVal = inner.substring(textStart + 6, textEnd).trim();
        } else {
          textVal = inner;
        }

        const transStart = inner.indexOf('<translation>');
        const transEnd = inner.indexOf('</translation>');
        let translationVal: string | undefined = undefined;
        if (transStart !== -1 && transEnd !== -1) {
          translationVal = inner.substring(transStart + 13, transEnd).trim();
        }

        return {
          type: 'latin-quote',
          text: textVal,
          translation: translationVal,
          attribution: quoteAttrib
        };
      }
    }

    // 3. Code Block
    if (trimmed.startsWith('```')) {
      const lines = segment.split('\n');
      const firstLine = lines[0];
      const lang = firstLine.substring(3).trim();
      const codeLines = lines.slice(1);
      if (codeLines.length > 0 && codeLines[codeLines.length - 1].trim().startsWith('```')) {
        codeLines.pop();
      }
      return { type: 'code-block', language: lang || undefined, code: codeLines.join('\n') };
    }

    // 4. Divider
    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      return { type: 'divider' };
    }

    // 5. Headings
    if (trimmed.startsWith('# ')) {
      return { type: 'heading', level: 1, text: trimmed.substring(2).trim() };
    }
    if (trimmed.startsWith('## ')) {
      return { type: 'heading', level: 2, text: trimmed.substring(3).trim() };
    }
    if (trimmed.startsWith('### ')) {
      return { type: 'heading', level: 3, text: trimmed.substring(4).trim() };
    }

    // 6. Image
    const imgRegex = /^!\[([^\]]*)\]\(([^)]+)\)$/;
    const imgMatch = trimmed.match(imgRegex);
    if (imgMatch) {
      return { type: 'image', alt: imgMatch[1], url: imgMatch[2] };
    }

    // 7. Table
    const lines = segment.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length >= 2 && lines[0].startsWith('|') && lines[0].endsWith('|')) {
      const headers = lines[0].split('|').slice(1, -1).map(h => h.trim());
      let startRowIdx = 1;
      let alignments: Array<'left' | 'center' | 'right'> = [];
      if (lines[1] && lines[1].includes('-')) {
        startRowIdx = 2;
        alignments = lines[1].split('|').slice(1, -1).map(col => {
          const c = col.trim();
          if (c.startsWith(':') && c.endsWith(':')) return 'center';
          if (c.endsWith(':')) return 'right';
          return 'left';
        });
      }
      const rows = lines.slice(startRowIdx).map(line => {
        return line.split('|').slice(1, -1).map(c => c.trim());
      });
      return { type: 'table', headers, rows, alignments };
    }

    // 8. Lists & Checklists
    const isNumbered = /^\d+\.\s+/.test(lines[0] || '');
    const isBullet = /^([-\*•])\s+/.test(lines[0] || '') || /^([-\*])\s+\[([ x])\]\s+/i.test(lines[0] || '');
    if ((isNumbered || isBullet) && lines.length > 0) {
      const items = lines.map(line => {
        // Checklist check
        const checkMatch = line.match(/^([-\*•])\s+\[([ x])\]\s+(.*)$/i);
        if (checkMatch) {
          return {
            text: checkMatch[3],
            checked: checkMatch[2].toLowerCase() === 'x'
          };
        }
        
        // Bullet check
        const bulletMatch = line.match(/^([-\*•])\s+(.*)$/);
        if (bulletMatch) {
          return { text: bulletMatch[2] };
        }
        
        // Numbered check
        const numMatch = line.match(/^\d+\.\s+(.*)$/);
        if (numMatch) {
          return { text: numMatch[1] };
        }
        
        return { text: line };
      });
      
      return {
        type: 'list',
        ordered: isNumbered,
        items
      };
    }

    // 9. Legacy Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines = segment.split('\n').map(line => {
        const l = line.trim();
        return l.startsWith('>') ? l.substring(1).trim() : l;
      }).filter(Boolean);

      const hasArabic = quoteLines.some(line => isArabicText(line));
      if (hasArabic) {
        const arLines: string[] = [];
        const transLines: string[] = [];
        let readingArabic = true;

        for (const line of quoteLines) {
          if (readingArabic) {
            if (isArabicText(line)) {
              arLines.push(line);
            } else {
              readingArabic = false;
              transLines.push(line);
            }
          } else {
            transLines.push(line);
          }
        }

        return {
          type: 'arabic-quote',
          arabic: arLines.join('\n'),
          translation: transLines.length > 0 ? transLines.join('\n') : undefined
        };
      } else {
        return {
          type: 'latin-quote',
          text: quoteLines.join('\n')
        };
      }
    }

    // 10. Default Paragraph
    return { type: 'paragraph', text: segment };
  };

  // If the content contains explicit XML quote tags or callout tags, parse them using a structured tag scanner
  if (content.includes('<quote') || content.includes('<callout')) {
    let remaining = content;
    while (remaining.length > 0) {
      const quoteStartIdx = remaining.indexOf('<quote');
      const calloutStartIdx = remaining.indexOf('<callout');
      
      // Determine which starts first
      let firstIdx = -1;
      let tagType: 'quote' | 'callout' = 'quote';
      if (quoteStartIdx !== -1 && calloutStartIdx !== -1) {
        if (quoteStartIdx < calloutStartIdx) {
          firstIdx = quoteStartIdx;
          tagType = 'quote';
        } else {
          firstIdx = calloutStartIdx;
          tagType = 'callout';
        }
      } else if (quoteStartIdx !== -1) {
        firstIdx = quoteStartIdx;
        tagType = 'quote';
      } else if (calloutStartIdx !== -1) {
        firstIdx = calloutStartIdx;
        tagType = 'callout';
      }

      if (firstIdx === -1) {
        const paras = remaining.split(/\n\n+/).filter(Boolean);
        for (const p of paras) {
          blocks.push(parseSingleSegment(p));
        }
        break;
      }

      if (firstIdx > 0) {
        const preceding = remaining.substring(0, firstIdx);
        const paras = preceding.split(/\n\n+/).filter(Boolean);
        for (const p of paras) {
          blocks.push(parseSingleSegment(p));
        }
      }

      if (tagType === 'quote') {
        const tagEndIdx = remaining.indexOf('>', firstIdx);
        if (tagEndIdx === -1) {
          const paras = remaining.substring(firstIdx).split(/\n\n+/).filter(Boolean);
          for (const p of paras) {
            blocks.push(parseSingleSegment(p));
          }
          break;
        }

        const tagText = remaining.substring(firstIdx, tagEndIdx + 1);
        const quoteEndIdx = remaining.indexOf('</quote>', tagEndIdx);
        if (quoteEndIdx === -1) {
          const paras = remaining.substring(firstIdx).split(/\n\n+/).filter(Boolean);
          for (const p of paras) {
            blocks.push(parseSingleSegment(p));
          }
          break;
        }

        const quoteInner = remaining.substring(tagEndIdx + 1, quoteEndIdx).trim();
        const typeMatch = tagText.match(/type="([^"]+)"/);
        const quoteType = typeMatch ? typeMatch[1] : 'latin';
        const attribMatch = tagText.match(/attribution="([^"]+)"/);
        const quoteAttrib = attribMatch ? attribMatch[1] : undefined;

        if (quoteType === 'arabic') {
          const arStart = quoteInner.indexOf('<arabic>');
          const arEnd = quoteInner.indexOf('</arabic>');
          let arabicVal = '';
          if (arStart !== -1 && arEnd !== -1) {
            arabicVal = quoteInner.substring(arStart + 8, arEnd).trim();
          } else {
            arabicVal = quoteInner;
          }

          const transStart = quoteInner.indexOf('<translation>');
          const transEnd = quoteInner.indexOf('</translation>');
          let translationVal: string | undefined = undefined;
          if (transStart !== -1 && transEnd !== -1) {
            translationVal = quoteInner.substring(transStart + 13, transEnd).trim();
          }

          blocks.push({
            type: 'arabic-quote',
            arabic: arabicVal,
            translation: translationVal,
            attribution: quoteAttrib
          });
        } else {
          // Latin Quote
          const textStart = quoteInner.indexOf('<text>');
          const textEnd = quoteInner.indexOf('</text>');
          let textVal = '';
          if (textStart !== -1 && textEnd !== -1) {
            textVal = quoteInner.substring(textStart + 6, textEnd).trim();
          } else {
            textVal = quoteInner;
          }

          const transStart = quoteInner.indexOf('<translation>');
          const transEnd = quoteInner.indexOf('</translation>');
          let translationVal: string | undefined = undefined;
          if (transStart !== -1 && transEnd !== -1) {
            translationVal = quoteInner.substring(transStart + 13, transEnd).trim();
          }

          blocks.push({
            type: 'latin-quote',
            text: textVal,
            translation: translationVal,
            attribution: quoteAttrib
          });
        }

        remaining = remaining.substring(quoteEndIdx + 8);
      } else {
        // Callout Block
        const tagEndIdx = remaining.indexOf('>', firstIdx);
        if (tagEndIdx === -1) {
          const paras = remaining.substring(firstIdx).split(/\n\n+/).filter(Boolean);
          for (const p of paras) {
            blocks.push(parseSingleSegment(p));
          }
          break;
        }

        const tagText = remaining.substring(firstIdx, tagEndIdx + 1);
        const calloutEndIdx = remaining.indexOf('</callout>', tagEndIdx);
        if (calloutEndIdx === -1) {
          const paras = remaining.substring(firstIdx).split(/\n\n+/).filter(Boolean);
          for (const p of paras) {
            blocks.push(parseSingleSegment(p));
          }
          break;
        }

        const calloutInner = remaining.substring(tagEndIdx + 1, calloutEndIdx).trim();
        const typeMatch = tagText.match(/type="([^"]+)"/);
        const titleMatch = tagText.match(/title="([^"]+)"/);
        const cType = (typeMatch ? typeMatch[1] : 'note') as 'note' | 'warning' | 'tip' | 'important' | 'definition';
        const titleVal = titleMatch ? titleMatch[1] : undefined;

        blocks.push({
          type: 'callout',
          calloutType: cType,
          title: titleVal,
          text: calloutInner
        });

        remaining = remaining.substring(calloutEndIdx + 10);
      }
    }
    return blocks;
  }

  // Legacy parser: split content by paragraphs and parse each segment
  const paragraphs = content.split(/\n\n+/).filter(Boolean);
  for (const p of paragraphs) {
    blocks.push(parseSingleSegment(p));
  }

  return blocks;
}

/**
 * Serializes ContentBlocks back to a raw text string for persistence.
 */
export function serializeBlocks(blocks: ContentBlock[]): string {
  return blocks.map(block => {
    if (block.type === 'paragraph') {
      return block.text;
    }
    if (block.type === 'heading') {
      return '#'.repeat(block.level) + ' ' + block.text;
    }
    if (block.type === 'list') {
      return block.items.map((item, idx) => {
        const prefix = block.ordered 
          ? `${idx + 1}. ` 
          : (item.checked !== undefined ? `- [${item.checked ? 'x' : ' '}] ` : '- ');
        return prefix + item.text;
      }).join('\n');
    }
    if (block.type === 'table') {
      const headerLine = '| ' + block.headers.join(' | ') + ' |';
      const alignments = block.alignments || block.headers.map(() => 'left');
      const sepLine = '| ' + alignments.map(align => {
        if (align === 'center') return ':---:';
        if (align === 'right') return '---:';
        return '---';
      }).join(' | ') + ' |';
      const rowLines = block.rows.map(row => '| ' + row.join(' | ') + ' |');
      return [headerLine, sepLine, ...rowLines].join('\n');
    }
    if (block.type === 'image') {
      return `![${block.alt}](${block.url})`;
    }
    if (block.type === 'divider') {
      return '---';
    }
    if (block.type === 'code-block') {
      const lang = block.language || '';
      return '```' + lang + '\n' + block.code + '\n```';
    }
    if (block.type === 'latin-quote') {
      const attr = block.attribution ? ` attribution="${block.attribution}"` : '';
      const trans = block.translation ? `\n  <translation>${block.translation}</translation>` : '';
      return `<quote type="latin"${attr}>\n  <text>${block.text}</text>${trans}\n</quote>`;
    }
    if (block.type === 'arabic-quote') {
      const attr = block.attribution ? ` attribution="${block.attribution}"` : '';
      const trans = block.translation ? `\n  <translation>${block.translation}</translation>` : '';
      return `<quote type="arabic"${attr}>\n  <arabic>${block.arabic}</arabic>${trans}\n</quote>`;
    }
    if (block.type === 'callout') {
      const titleAttr = block.title ? ` title="${block.title}"` : '';
      return `<callout type="${block.calloutType}"${titleAttr}>\n  ${block.text}\n</callout>`;
    }
    return '';
  }).join('\n\n');
}

/**
 * Generates a clean random UUID for local database records.
 */
export function generateUUID(): string {
  return 'entry-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class DocumentExporter {
  // HTML Export
  static exportToHtml(entry: { title: string; contentType: string; content: string; excerpt?: string }): string {
    const blocks = parseContentToBlocks(entry.content);
    let html = `<article class="Adjung-publication" data-type="${entry.contentType}">\n`;
    html += `  <header class="publication-header">\n`;
    if (entry.contentType !== 'Note') {
      html += `    <h1>${entry.title}</h1>\n`;
    }
    if (entry.excerpt) {
      html += `    <p class="publication-abstract"><em>${entry.excerpt}</em></p>\n`;
    }
    html += `  </header>\n`;
    html += `  <section class="publication-body">\n`;
    
    blocks.forEach(block => {
      if (block.type === 'paragraph') {
        html += `    <p>${block.text}</p>\n`;
      } else if (block.type === 'heading') {
        html += `    <h${block.level + 1}>${block.text}</h${block.level + 1}>\n`;
      } else if (block.type === 'divider') {
        html += `    <hr />\n`;
      } else if (block.type === 'image') {
        html += `    <figure><img src="${block.url}" alt="${block.alt}" /><figcaption>${block.alt}</figcaption></figure>\n`;
      } else if (block.type === 'code-block') {
        html += `    <pre><code class="language-${block.language || 'none'}">${block.code}</code></pre>\n`;
      } else if (block.type === 'latin-quote') {
        const trans = block.translation ? `<p class="translation">${block.translation}</p>` : '';
        const attr = block.attribution ? `<cite>${block.attribution}</cite>` : '';
        html += `    <blockquote><p>${block.text}</p>${trans}${attr}</blockquote>\n`;
      } else if (block.type === 'arabic-quote') {
        const trans = block.translation ? `<p class="translation">${block.translation}</p>` : '';
        const attr = block.attribution ? `<cite>${block.attribution}</cite>` : '';
        html += `    <blockquote class="arabic" dir="rtl"><p>${block.arabic}</p>${trans}${attr}</blockquote>\n`;
      } else if (block.type === 'callout') {
        const title = block.title ? `<h5>${block.title}</h5>` : '';
        html += `    <div class="callout callout-${block.calloutType}">${title}<p>${block.text}</p></div>\n`;
      } else if (block.type === 'list') {
        const tag = block.ordered ? 'ol' : 'ul';
        html += `    <${tag}>\n`;
        block.items.forEach(item => {
          html += `      <li>${item.text}</li>\n`;
        });
        html += `    </${tag}>\n`;
      } else if (block.type === 'table') {
        html += `    <table>\n      <thead>\n        <tr>\n`;
        block.headers.forEach(h => {
          html += `          <th>${h}</th>\n`;
        });
        html += `        </tr>\n      </thead>\n      <tbody>\n`;
        block.rows.forEach(row => {
          html += `        <tr>\n`;
          row.forEach(cell => {
            html += `          <td>${cell}</td>\n`;
          });
          html += `        </tr>\n`;
        });
        html += `      </tbody>\n    </table>\n`;
      }
    });
    
    html += `  </section>\n`;
    html += `</article>`;
    return html;
  }

  // Markdown Export
  static exportToMarkdown(entry: { title: string; contentType: string; content: string; excerpt?: string }): string {
    let md = '';
    if (entry.contentType !== 'Note') {
      md += `# ${entry.title}\n\n`;
    }
    if (entry.excerpt) {
      md += `> *${entry.excerpt}*\n\n`;
    }
    md += entry.content;
    return md;
  }

  // XML Export
  static exportToXml(entry: { id: string; title: string; contentType: string; content: string; excerpt?: string; authorId: string; createdDate: string; updatedDate: string; publishedDate: string | null; slug: string; tags: string[]; revisions?: any[]; citations?: any[]; referenceSortOrder?: string }, authorName: string): string {
    const escapeXml = (str: string) => {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const blocks = parseContentToBlocks(entry.content);
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<publication type="${entry.contentType}">\n`;
    
    xml += `  <metadata>\n`;
    xml += `    <id>${escapeXml(entry.id)}</id>\n`;
    if (entry.contentType !== 'Note') {
      xml += `    <title>${escapeXml(entry.title)}</title>\n`;
    }
    if (entry.excerpt) {
      xml += `    <excerpt>${escapeXml(entry.excerpt)}</excerpt>\n`;
    }
    xml += `    <author>${escapeXml(authorName)}</author>\n`;
    xml += `    <slug>${escapeXml(entry.slug)}</slug>\n`;
    xml += `    <createdDate>${escapeXml(entry.createdDate)}</createdDate>\n`;
    xml += `    <updatedDate>${escapeXml(entry.updatedDate)}</updatedDate>\n`;
    if (entry.publishedDate) {
      xml += `    <publishedDate>${escapeXml(entry.publishedDate)}</publishedDate>\n`;
    }
    if (entry.tags && entry.tags.length > 0) {
      xml += `    <tags>\n`;
      entry.tags.forEach(tag => {
        xml += `      <tag>${escapeXml(tag)}</tag>\n`;
      });
      xml += `    </tags>\n`;
    }
    xml += `  </metadata>\n`;

    xml += `  <body>\n`;
    blocks.forEach((block, idx) => {
      if (block.type === 'paragraph') {
        xml += `    <paragraph>${escapeXml(block.text)}</paragraph>\n`;
      } else if (block.type === 'heading') {
        xml += `    <heading level="${block.level}">${escapeXml(block.text)}</heading>\n`;
      } else if (block.type === 'divider') {
        xml += `    <divider />\n`;
      } else if (block.type === 'image') {
        xml += `    <figure url="${escapeXml(block.url)}">\n`;
        if (block.alt) {
          xml += `      <caption>${escapeXml(block.alt)}</caption>\n`;
        }
        xml += `    </figure>\n`;
      } else if (block.type === 'code-block') {
        xml += `    <codeBlock${block.language ? ` language="${escapeXml(block.language)}"` : ''}>${escapeXml(block.code)}</codeBlock>\n`;
      } else if (block.type === 'latin-quote') {
        const attrAttr = block.attribution ? ` attribution="${escapeXml(block.attribution)}"` : '';
        xml += `    <blockquote type="latin"${attrAttr}>\n`;
        xml += `      <text>${escapeXml(block.text)}</text>\n`;
        if (block.translation) {
          xml += `      <translation>${escapeXml(block.translation)}</translation>\n`;
        }
        xml += `    </blockquote>\n`;
      } else if (block.type === 'arabic-quote') {
        const attrAttr = block.attribution ? ` attribution="${escapeXml(block.attribution)}"` : '';
        xml += `    <blockquote type="arabic"${attrAttr}>\n`;
        xml += `      <arabic>${escapeXml(block.arabic)}</arabic>\n`;
        if (block.translation) {
          xml += `      <translation>${escapeXml(block.translation)}</translation>\n`;
        }
        xml += `    </blockquote>\n`;
      } else if (block.type === 'callout') {
        const titleAttr = block.title ? ` title="${escapeXml(block.title)}"` : '';
        xml += `    <callout type="${block.calloutType}"${titleAttr}>${escapeXml(block.text)}</callout>\n`;
      } else if (block.type === 'list') {
        xml += `    <list ordered="${block.ordered}">\n`;
        block.items.forEach(item => {
          xml += `      <listItem>${escapeXml(item.text)}</listItem>\n`;
        });
        xml += `    </list>\n`;
      } else if (block.type === 'table') {
        xml += `    <table>\n`;
        xml += `      <thead>\n`;
        xml += `        <tr>\n`;
        block.headers.forEach(h => {
          xml += `          <th>${escapeXml(h)}</th>\n`;
        });
        xml += `        </tr>\n`;
        xml += `      </thead>\n`;
        xml += `      <tbody>\n`;
        block.rows.forEach(row => {
          xml += `        <tr>\n`;
          row.forEach(cell => {
            xml += `          <td>${escapeXml(cell)}</td>\n`;
          });
          xml += `        </tr>\n`;
        });
        xml += `      </tbody>\n`;
        xml += `    </table>\n`;
      }
    });
    xml += `  </body>\n`;
    xml += `</publication>\n`;
    return xml;
  }

  // PDF Schema mapping output (prepared structure)
  static exportToPdfData(entry: { title: string; contentType: string; content: string }) {
    const blocks = parseContentToBlocks(entry.content);
    return {
      metadata: {
        title: entry.title,
        type: entry.contentType,
        generatedAt: new Date().toISOString()
      },
      pageConfig: {
        fontFamily: 'Crimson Text',
        fontSize: 11,
        lineHeight: 1.6,
        margins: { top: 54, bottom: 54, left: 72, right: 72 }
      },
      renderOutline: blocks.map(block => {
        return {
          type: block.type,
          data: { ...block },
          estimatedHeight: block.type === 'heading' ? 24 : 16 * (block.type === 'paragraph' ? Math.ceil(block.text.length / 80) : 2)
        };
      })
    };
  }
}

const arabicRegex = /[\u0600-\u06FF]/;
const latinRegex = /[a-zA-Z]/;
const unifiedRegex = new RegExp(`(${arabicRegex.source})|(${latinRegex.source})`, 'gu');

/**
 * Converts a content string into AST EditorBlock objects.
 */
export function parseTextToAST(content: string): EditorBlock[] {
  const contentBlocks = parseContentToBlocks(content);
  return contentBlocks.map(block => {
    let data: Record<string, unknown> = {};
    if (block.type === 'paragraph') {
      data = { text: block.text };
    } else if (block.type === 'heading') {
      data = { level: block.level, text: block.text };
    } else if (block.type === 'list') {
      data = { ordered: block.ordered, items: block.items };
    } else if (block.type === 'table') {
      data = { headers: block.headers, rows: block.rows, alignments: block.alignments };
    } else if (block.type === 'image') {
      data = { url: block.url, alt: block.alt, caption: block.alt };
    } else if (block.type === 'divider') {
      data = {};
    } else if (block.type === 'code-block') {
      data = { language: block.language, code: block.code };
    } else if (block.type === 'latin-quote') {
      data = { text: block.text, translation: block.translation, attribution: block.attribution };
    } else if (block.type === 'arabic-quote') {
      data = { arabic: block.arabic, translation: block.translation, attribution: block.attribution };
    } else if (block.type === 'callout') {
      data = { calloutType: block.calloutType, title: block.title, text: block.text };
    }
    return {
      id: generateUUID(),
      type: block.type === 'image' ? 'figure' : block.type,
      data
    };
  });
}

/**
 * Serializes AST EditorBlock objects back to a markdown/XML content string.
 */
export function serializeASTToText(blocks: EditorBlock[]): string {
  const contentBlocks = blocks.map(block => {
    let type = block.type;
    if (type === 'figure') type = 'image';
    const cb = { type, data: block.data } as any;
    if (type === 'paragraph') {
      cb.text = block.data.text || '';
    } else if (type === 'heading') {
      cb.level = block.data.level || 1;
      cb.text = block.data.text || '';
    } else if (type === 'list') {
      cb.ordered = block.data.ordered || false;
      cb.items = block.data.items || [];
    } else if (type === 'table') {
      cb.headers = block.data.headers || [];
      cb.rows = block.data.rows || [];
      cb.alignments = block.data.alignments;
    } else if (type === 'image' || type === 'figure') {
      cb.type = 'image';
      cb.url = block.data.url || '';
      cb.alt = block.data.caption || block.data.alt || '';
    } else if (type === 'divider') {
      // empty
    } else if (type === 'code-block') {
      cb.language = block.data.language;
      cb.code = block.data.code || '';
    } else if (type === 'latin-quote' || type === 'quote') {
      cb.type = 'latin-quote';
      cb.text = block.data.text || '';
      cb.translation = block.data.translation;
      cb.attribution = block.data.attribution;
    } else if (type === 'arabic-quote') {
      cb.arabic = block.data.arabic || '';
      cb.translation = block.data.translation;
      cb.attribution = block.data.attribution;
    } else if (type === 'callout') {
      cb.calloutType = block.data.calloutType || 'note';
      cb.title = block.data.title;
      cb.text = block.data.text || '';
    }
    return cb;
  });
  return serializeBlocks(contentBlocks);
}

/**
 * Scans AST blocks for inline stable footnotes [^fn-xxx] and builds occurrence map.
 */
export function buildFootnotesMap(blocks: EditorBlock[]): { map: Record<string, number>; order: string[] } {
  const map: Record<string, number> = {};
  const order: string[] = [];
  let currentNumber = 1;
  const fnRegex = /\[\^(fn-[a-zA-Z0-9-]+)\]/g;

  blocks.forEach(b => {
    let text = '';
    if (b.type === 'paragraph') {
      text = b.data.text || '';
    } else if (b.type === 'heading') {
      text = b.data.text || '';
    } else if (b.type === 'callout') {
      text = b.data.text || '';
    } else if (b.type === 'latin-quote' || b.type === 'quote') {
      text = (b.data.text || '') + ' ' + (b.data.translation || '');
    } else if (b.type === 'arabic-quote') {
      text = (b.data.arabic || '') + ' ' + (b.data.translation || '');
    } else if (b.type === 'list') {
      const items = b.data.items || [];
      text = items.map((it: {text: string, checked?: boolean}) => it.text).join(' ');
    }
    if (b.type === 'table') {
      const headers = b.data.headers || [];
      const rows = b.data.rows || [];
      text = headers.join(' ') + ' ' + rows.map((r: string[]) => r.join(' ')).join(' ');
    }

    let match;
    fnRegex.lastIndex = 0;
    while ((match = fnRegex.exec(text)) !== null) {
      const fnId = match[1];
      if (map[fnId] === undefined) {
        map[fnId] = currentNumber++;
        order.push(fnId);
      }
    }
  });

  return { map, order };
}

/**
 * Scans AST blocks and returns cross-reference labels mapped by target block ID.
 */
export function buildCrossReferencesMap(blocks: EditorBlock[]): Record<string, string> {
  const map: Record<string, string> = {};
  let figCount = 1;
  let tblCount = 1;
  let secCount = 1;

  blocks.forEach(block => {
    if (block.type === 'figure' || block.type === 'image') {
      map[block.id] = `Figure ${figCount++}`;
    } else if (block.type === 'table') {
      map[block.id] = `Table ${tblCount++}`;
    } else if (block.type === 'heading') {
      map[block.id] = `Section ${secCount++}`;
    }
  });

  return map;
}

export function getWordCount(text: string): number {
  if (!text) return 0;
  const cleanText = text.trim();
  if (!cleanText) return 0;
  return cleanText.split(/\s+/).filter(Boolean).length;
}

export function getReadingTime(text: string): string {
  const words = getWordCount(text);
  const minutes = Math.ceil(words / 200);
  return minutes === 1 ? '1 min read' : `${minutes} min read`;
}

export const getFootnotesReadingOrderMap = (content: string) => {
  const map: Record<string, number> = {};
  const occurrences: string[] = [];
  const fnRegex = /\[\^(fn-[a-zA-Z0-9-]+)\]|\[\^(\d+)\]/g;
  
  const blocks = parseContentToBlocks(content);
  blocks.forEach(b => {
    let text = '';
    if (b.type === 'paragraph') {
      text = b.text || '';
    } else if (b.type === 'heading') {
      text = b.text || '';
    } else if (b.type === 'latin-quote') {
      text = (b.text || '') + ' ' + (b.translation || '');
    } else if (b.type === 'arabic-quote') {
      text = (b.arabic || '') + ' ' + (b.translation || '');
    } else if (b.type === 'list') {
      text = (b.items || []).map((it: any) => it.text).join(' ');
    } else if (b.type === 'table') {
      text = (b.headers || []).join(' ') + ' ' + (b.rows || []).map((r: string[]) => r.join(' ')).join(' ');
    }
    
    let match;
    fnRegex.lastIndex = 0;
    while ((match = fnRegex.exec(text)) !== null) {
      const fnId = match[1] || match[2];
      if (fnId && !occurrences.includes(fnId)) {
        occurrences.push(fnId);
      }
    }
  });

  occurrences.forEach((fnId, idx) => {
    map[fnId] = idx + 1;
  });

  return { map, occurrences };
};

export const getMarginNotesReadingOrderMap = (content: string) => {
  const map: Record<string, number> = {};
  const occurrences: string[] = [];
  const mnRegex = /\[\^(mn-[a-zA-Z0-9-]+)\]/g;
  
  let match;
  mnRegex.lastIndex = 0;
  while ((match = mnRegex.exec(content)) !== null) {
    const mnId = match[1];
    if (!occurrences.includes(mnId)) {
      occurrences.push(mnId);
    }
  }
  
  occurrences.forEach((mnId, idx) => {
    map[mnId] = idx + 1;
  });
  
  return { map, occurrences };
};

export const DESK_ACCENTS: Record<string, string> = {
  'Astronomy': '#0A192F',
  'Space': '#1E293B',
  'Science': '#15803D',
  'Medicine': '#7B2737',
  'Kesihatan': '#991B1B',
  'Artificial Intelligence': '#6D28D9',
  'History': '#78350F',
  'Archaeology': '#B45309',
  'Libraries': '#4B5563',
  'Museums': '#D97706',
  'Environment': '#4D7C0F',
  'Education': '#1E3A8A',
  'Pendidikan': '#B55604',
  'Technology': '#475569',
  'Publishing': '#881337',
  'Languages': '#4338CA',
  'Heritage': '#92400E',
  'Islamic Affairs': '#047857',
  'International Relations': '#0F172A',
  'Dalam Negeri': '#802334',
  'Ekonomi': '#1D4ED8',
  'Bisnes': '#0284C7',
  'Negara': '#0369A1',
  'Nasional': '#2563EB',
  'Dunia': '#7C3AED',
  'Teknologi': '#0D9488',
  'Gaya Hidup': '#DB2777',
  'Hiburan': '#EA580C',
  'Kesusasteraan Melayu': '#E05638',
  'Psikolinguistik': '#6366F1',
  'Warisan': '#A16207',
  'Ujian': '#64748B',
  'Semasa': '#B91C1C',
  'Politik': '#3730A3',
  'Sukan': '#059669',
  'Berita': '#BE123C',
  'Terkini': '#9F1239',
  'Diplomasi': '#312E81',
  'Falsafah': '#6B21A8',
  'Sejarah': '#854D0E',
  'Sains': '#0891B2',
  'Sains & Teknologi': '#0284C7'
};

export function getDeskAccentColor(deskName: string): string {
  if (!deskName) return '#802334';
  const normalized = Object.keys(DESK_ACCENTS).find(
    k => k.toLowerCase() === deskName.trim().toLowerCase()
  );
  if (normalized) return DESK_ACCENTS[normalized];

  // Dynamic hash to distinct HSL color for any new category
  let hash = 0;
  for (let i = 0; i < deskName.length; i++) {
    hash = deskName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 75%, 38%)`;
}

// Had aksara huraian Ticker (2026-08-05, permintaan Izzat) — 225 aksara. Kandungan sedia ada
// (sumber RSS/Google Doc) semuanya sudah di bawah had ni (maksimum sebenar diperiksa dalam DB
// ialah 222 aksara — sumber sendiri sudah pendekkan), jadi had ni SEKADAR PLAFON KESELAMATAN
// untuk kandungan masa depan yang lebih panjang, bukan pemendekan kandungan sedia ada. Dipotong
// pada sempadan perkataan (bukan tengah-tengah perkataan) + elipsis, sama corak dgn trimNota()
// FocusView.tsx.
const HAD_HURAIAN_TICKER = 225;
function potongHuraianTicker(teks: string): string {
  const t = teks.trim();
  if (t.length <= HAD_HURAIAN_TICKER) return t;
  const cut = t.lastIndexOf(' ', HAD_HURAIAN_TICKER);
  return t.slice(0, cut > HAD_HURAIAN_TICKER * 0.6 ? cut : HAD_HURAIAN_TICKER).trim() + '...';
}

export function parseInTheNews(text: string): { items: NewsItem[]; errors: ParseError[] } {
  const items: NewsItem[] = [];
  const errors: ParseError[] = [];
  
  if (!text) return { items, errors };
  
  // Split sections by 3 or more hyphens/underscores/dashes, or two-em dashes (matching --- or ⸻ on its own line)
  const sections = text.split(/^[ \t]*(?:[-_—–―]{3,}|⸻+)[ \t]*$/gm);
  
  sections.forEach((section, index) => {
    const itemIndex = index + 1;
    const lines = section.split('\n');
    
    let desk = '';
    let title = '';
    let brief = '';
    let source = '';
    let url = '';
    
    let deskB = '';
    let titleB = '';
    let briefB = '';
    let sourceB = '';
    let urlB = '';
    
    let offset = 0;
    let aiProvider = '';
    let bgColor = '';
    let borderColor = '';
    let textColor = '';
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      // Robust check for URL on its own line
      if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
        if (!url) {
          url = trimmed;
        } else if (!urlB) {
          urlB = trimmed;
        }
        return;
      }
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex <= 0) return;
      
      const key = trimmed.substring(0, colonIndex).trim().toLowerCase();
      const val = trimmed.substring(colonIndex + 1).trim();
      
      if (key === 'desk' || key === 'deska' || key === 'kategori') {
        desk = val;
      } else if (key === 'deskb') {
        deskB = val;
      } else if (key === 'title' || key === 'titlea' || key === 'tajuk') {
        title = val;
      } else if (key === 'titleb') {
        titleB = val;
      } else if (key === 'brief' || key === 'summary' || key === 'briefa' || key === 'summarya' || key === 'huraian' || key === 'huraian ringkas') {
        brief = potongHuraianTicker(val.replace(/&(?:copy);?/gi, '').replace(/©/g, '').replace(/\s+\([cC]\)\s*/g, ' ').replace(/(?:\s*[-–—|•]?\s*(?:\bcopyright\b|\bhakcipta\b|\bhak cipta\b|\ball rights reserved\b|new straits times(?: press)?(?: \(m\) bhd)?|bernama|media prima|astro awani|utusan malaysia|kosmo(?: digital)?|sinar harian|berita harian|rtm|the star)\b.*$)/gi, '').replace(/^(?:[A-Z\s]{2,30}(?:[,\s]+\d{1,2}\s+[A-Za-z]+)?)\s*[\-–—:]+\s*/i, '').replace(/,\s*(?:\.{3,}|…)/g, '...').replace(/\s+[A-Za-z0-9]{1,5}(?:\.\.\.|…)$/, '...').replace(/\.{4,}/g, '. ...').replace(/,\s*\.\.\./g, '...').replace(/\.\s*\.\.\./g, '. ...').trim());
      } else if (key === 'briefb' || key === 'summaryb') {
        briefB = potongHuraianTicker(val.replace(/&(?:copy);?/gi, '').replace(/©/g, '').replace(/\s+\([cC]\)\s*/g, ' ').replace(/(?:\s*[-–—|•]?\s*(?:\bcopyright\b|\bhakcipta\b|\bhak cipta\b|\ball rights reserved\b|new straits times(?: press)?(?: \(m\) bhd)?|bernama|media prima|astro awani|utusan malaysia|kosmo(?: digital)?|sinar harian|berita harian|rtm|the star)\b.*$)/gi, '').replace(/^(?:[A-Z\s]{2,30}(?:[,\s]+\d{1,2}\s+[A-Za-z]+)?)\s*[\-–—:]+\s*/i, '').replace(/,\s*(?:\.{3,}|…)/g, '...').replace(/\s+[A-Za-z0-9]{1,5}(?:\.\.\.|…)$/, '...').replace(/\.{4,}/g, '. ...').replace(/,\s*\.\.\./g, '...').replace(/\.\s*\.\.\./g, '. ...').trim());
      } else if (key === 'source' || key === 'sourcea' || key === 'sumber') {
        source = val;
      } else if (key === 'sourceb') {
        sourceB = val;
      } else if (key === 'url' || key === 'urla' || key === 'pautan') {
        url = val;
      } else if (key === 'urlb') {
        urlB = val;
      } else if (key === 'offset' || key === 'switchoffset') {
        offset = parseInt(val, 10) || 0;
      } else if (key === 'aiprovider') {
        aiProvider = val;
      } else if (key === 'bgcolor') {
        bgColor = val;
      } else if (key === 'bordercolor') {
        borderColor = val;
      } else if (key === 'textcolor') {
        textColor = val;
      }
    });
    
    // Skip completely empty sections
    if (!desk && !title && !brief && !source && !url && !deskB && !titleB && !briefB && !sourceB && !urlB) {
      return;
    }
    
    // Validation on News A (always check if title or desk exists)
    if (desk && desk.length > 30) {
      errors.push({
        index: itemIndex,
        error: `Desk A field exceeds 30 characters limit`
      });
      return;
    }
    
    if (title && title.length > 80) {
      errors.push({
        index: itemIndex,
        error: `Title A field exceeds 80 characters limit`
      });
      return;
    }
    
    if (brief) {
      const briefWords = brief.trim().split(/\s+/).filter(Boolean).length;
      const briefChars = brief.length;
      if (briefWords > 50) {
        errors.push({
          index: itemIndex,
          error: `Brief A field exceeds 50 words limit (has ${briefWords} words)`
        });
        return;
      }
      if (briefChars > 250) {
        errors.push({
          index: itemIndex,
          error: `Brief A field exceeds 250 characters limit (has ${briefChars} characters)`
        });
        return;
      }
    }
    
    if (source && source.length > 40) {
      errors.push({
        index: itemIndex,
        error: `Source A field exceeds 40 characters limit`
      });
      return;
    }
    
    if (url && !url.startsWith('https://') && !url.startsWith('http://')) {
      errors.push({
        index: itemIndex,
        error: `Invalid URL A: must start with http:// or https://`
      });
      return;
    }
    
    // Validation on News B (only if News B has content)
    if (titleB || deskB || briefB || sourceB || urlB) {
      if (deskB && deskB.length > 30) {
        errors.push({
          index: itemIndex,
          error: `Desk B field exceeds 30 characters limit`
        });
        return;
      }
      
      if (titleB && titleB.length > 80) {
        errors.push({
          index: itemIndex,
          error: `Title B field exceeds 80 characters limit`
        });
        return;
      }
      
      if (briefB) {
        const briefBWords = briefB.trim().split(/\s+/).filter(Boolean).length;
        const briefBChars = briefB.length;
        if (briefBWords > 50) {
          errors.push({
            index: itemIndex,
            error: `Brief B field exceeds 50 words limit (has ${briefBWords} words)`
          });
          return;
        }
        if (briefBChars > 250) {
          errors.push({
            index: itemIndex,
            error: `Brief B field exceeds 250 characters limit (has ${briefBChars} characters)`
          });
          return;
        }
      }
      
      if (sourceB && sourceB.length > 40) {
        errors.push({
          index: itemIndex,
          error: `Source B field exceeds 40 characters limit`
        });
        return;
      }
      
      if (urlB && !urlB.startsWith('https://') && !urlB.startsWith('http://')) {
        errors.push({
          index: itemIndex,
          error: `Invalid URL B: must start with http:// or https://`
        });
        return;
      }
    }
    
    items.push({
      desk,
      title,
      brief,
      source,
      url,
      rawIndex: itemIndex,
      deskB: deskB || undefined,
      titleB: titleB || undefined,
      briefB: briefB || undefined,
      sourceB: sourceB || undefined,
      urlB: urlB || undefined,
      offset: offset || undefined,
      aiProvider: aiProvider || undefined,
      bgColor: bgColor || undefined,
      borderColor: borderColor || undefined,
      textColor: textColor || undefined
    });
  });
  
  return { items, errors };
}

export interface HolidayItem {
  city: string;
  dateStr: string; // DD/MM/YY
  status: 'Holiday' | 'Weekend' | 'Working' | 'SchoolHoliday';
  holidayName?: string;
}

export function parseWorldClockHolidays(text: string): { items: HolidayItem[]; errors: ParseError[] } {
  const items: HolidayItem[] = [];
  const errors: ParseError[] = [];
  
  if (!text) return { items, errors };
  
  // Split sections by 3 or more hyphens/underscores/dashes, or two-em dashes (matching --- or ⸻ on its own line)
  const sections = text.split(/^[ \t]*(?:[-_—–―]{3,}|⸻+)[ \t]*$/gm);
  
  sections.forEach((section, index) => {
    const itemIndex = index + 1;
    const lines = section.split('\n');
    
    let city = '';
    let dateStr = '';
    let status = '';
    let holidayName = '';
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex <= 0) return;
      
      const key = trimmed.substring(0, colonIndex).trim().toLowerCase();
      const val = trimmed.substring(colonIndex + 1).trim();
      
      if (key === 'city') {
        city = val;
      } else if (key === 'date') {
        dateStr = val;
      } else if (key === 'status') {
        status = val;
      } else if (key === 'holiday name' || key === 'holidayname' || key === 'name') {
        holidayName = val;
      }
    });
    
    // Skip completely empty sections
    if (!city && !dateStr && !status && !holidayName) {
      return;
    }
    
    const missing: string[] = [];
    if (!city) missing.push('City');
    if (!dateStr) missing.push('Date');
    if (!status) missing.push('Status');
    
    if (missing.length > 0) {
      errors.push({
        index: itemIndex,
        error: `Missing mandatory field(s): ${missing.join(', ')}`
      });
      return;
    }
    
    // Normalize status
    let normStatus: 'Holiday' | 'Weekend' | 'Working' | 'SchoolHoliday' = 'Working';
    const cleanStatus = status.toLowerCase();
    if (cleanStatus.includes('school') || cleanStatus.includes('cuti sekolah')) {
      normStatus = 'SchoolHoliday';
    } else if (cleanStatus.includes('holiday') || cleanStatus.includes('umum')) {
      normStatus = 'Holiday';
    } else if (cleanStatus.includes('weekend') || cleanStatus.includes('mingguan')) {
      normStatus = 'Weekend';
    } else if (cleanStatus.includes('working') || cleanStatus.includes('work') || cleanStatus.includes('biasa')) {
      normStatus = 'Working';
    } else {
      errors.push({
        index: itemIndex,
        error: `Invalid status "${status}". Must be Holiday, Weekend, SchoolHoliday, or Working`
      });
      return;
    }
    
    items.push({
      city,
      dateStr,
      status: normStatus,
      holidayName
    });
  });
  
  return { items, errors };
}

export interface ResearchFindingItem {
  finding: string;
  source: string;
  rawIndex: number;
}

export function parseResearchFindings(text: string): { items: ResearchFindingItem[]; errors: { index: number; error: string }[] } {
  const items: ResearchFindingItem[] = [];
  const errors: { index: number; error: string }[] = [];
  
  if (!text) return { items, errors };
  
  const lines = text.split('\n');
  let currentFinding = '';
  let currentSource = '';
  let itemIndex = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if it's a separator line
    if (/^[ \t]*(?:[-_—–―]{3,}|⸻+)[ \t]*$/.test(trimmed)) {
      if (currentFinding || currentSource) {
        if (!currentFinding) {
          errors.push({ index: itemIndex, error: 'Missing "Finding:" parameter.' });
        } else if (!currentSource) {
          errors.push({ index: itemIndex, error: 'Missing "Source:" parameter.' });
        } else {
          items.push({ finding: currentFinding, source: currentSource, rawIndex: itemIndex });
        }
        currentFinding = '';
        currentSource = '';
        itemIndex++;
      }
      continue;
    }

    const match = line.match(/^\s*(Finding|Source)\s*:\s*(.*)$/i);
    if (match) {
      const key = match[1].toLowerCase();
      const val = match[2].trim();

      if (key === 'finding') {
        // Auto-push the previous finding if we encounter a new one
        if (currentFinding) {
          if (!currentSource) {
            errors.push({ index: itemIndex, error: 'Missing "Source:" parameter.' });
          } else {
            items.push({ finding: currentFinding, source: currentSource, rawIndex: itemIndex });
          }
          currentFinding = '';
          currentSource = '';
          itemIndex++;
        }
        currentFinding = val;
      } else if (key === 'source') {
        currentSource = val;
      }
    }
  }

  // Push the final finding if pending
  if (currentFinding || currentSource) {
    if (!currentFinding) {
      errors.push({ index: itemIndex, error: 'Missing "Finding:" parameter.' });
    } else if (!currentSource) {
      errors.push({ index: itemIndex, error: 'Missing "Source:" parameter.' });
    } else {
      items.push({ finding: currentFinding, source: currentSource, rawIndex: itemIndex });
    }
  }

  return { items, errors };
}

