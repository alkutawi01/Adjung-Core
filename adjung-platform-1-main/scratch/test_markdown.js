const fs = require('fs');

const markdownToHtml = (md) => {
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
    .replace(/\[\^(fn-[a-zA-Z0-9-]+)\]/g, '<span class="footnote-badge" data-id="$1" contenteditable="false"></span>')
    .replace(/\[\^(mn-[a-zA-Z0-9-]+)\]/g, '<span class="margin-note-badge" data-id="$1" contenteditable="false"></span>')
    .replace(/\[\^(\d+)\]/g, '<span class="footnote-badge" data-id="fn-legacy-$1" contenteditable="false"></span>')
    .replace(/(\*\*\*|___)(.*?)\1/g, '<strong><em>$2</em></strong>')
    .replace(/(\**|__)(.*?)\1/g, '<strong>$2</strong>')
    .replace(/(\*|_)(.*?)\1/g, '<em>$2</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\+\+(.*?)\+\+/g, '<u>$1</u>')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '<a href="$2">$1</a>');
};

const htmlToMarkdown = (html) => {
  if (!html) return '';
  let md = html
    .replace(/<span[^>]*class="footnote-badge"[^>]*data-id="([^"]+)"[^>]*>.*?<\/span>/gi, '[^$1]')
    .replace(/<span[^>]*class="margin-note-badge"[^>]*data-id="([^"]+)"[^>]*>.*?<\/span>/gi, '[^$1]')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n')
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
    .replace(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/\n\n\n+/g, '\n\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  return md.trim();
};

let current = 'This is the first paragraph.\n\nThis is the second paragraph.\n\nMargin notes.';
const html1 = markdownToHtml(current);
const md1 = htmlToMarkdown(html1);
const html2 = markdownToHtml(md1);
const md2 = htmlToMarkdown(html2);

fs.writeFileSync('C:\\Users\\alkut\\.gemini\\antigravity-ide\\brain\\249f2e94-ed83-4b75-864e-584641b103bd\\scratch\\output.txt', `
HTML 1: ${html1}
MD 1: ${md1}
HTML 2: ${html2}
MD 2: ${md2}
`);
