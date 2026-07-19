import { Entry, Citation, EditorBlock } from '../types';
import { parseContentToBlocks } from '../utils';

export interface DocumentExporter {
  id: string; // 'html' | 'markdown' | 'xml' | 'pdf' | 'docx' | 'latex'
  name: string;
  extension: string;
  exportDocument: (entry: Entry, blocks: EditorBlock[], citations: Citation[], authorName: string) => string;
}

export class ExporterRegistry {
  private exporters = new Map<string, DocumentExporter>();

  register(exporter: DocumentExporter) {
    this.exporters.set(exporter.id, exporter);
  }

  get(id: string): DocumentExporter | undefined {
    return this.exporters.get(id);
  }

  getAll(): DocumentExporter[] {
    return Array.from(this.exporters.values());
  }
}

// Helper to escape XML characters safely
const escapeXml = (str: string) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// 1. HTML Exporter
export const HtmlExporter: DocumentExporter = {
  id: 'html',
  name: 'HTML',
  extension: 'html',
  exportDocument: (entry: Entry, blocks: EditorBlock[], citations: Citation[], authorName: string) => {
    let html = `<article class="Adjung-publication" data-type="${entry.contentType}">\n`;
    html += `  <header class="publication-header">\n`;
    if (entry.contentType !== 'Note') {
      html += `    <h1>${entry.title}</h1>\n`;
    }
    html += `    <div class="metadata">\n`;
    html += `      <span class="author">By ${authorName}</span>\n`;
    html += `      <span class="date">${entry.publishedDate ? new Date(entry.publishedDate).toLocaleDateString() : 'Draft'}</span>\n`;
    html += `    </div>\n`;
    if (entry.excerpt) {
      html += `    <p class="publication-abstract"><em>${entry.excerpt}</em></p>\n`;
    }
    html += `  </header>\n`;
    html += `  <section class="publication-body">\n`;

    blocks.forEach(block => {
      if (block.type === 'paragraph') {
        html += `    <p>${block.data.text}</p>\n`;
      } else if (block.type === 'heading') {
        const level = block.data.level || 1;
        html += `    <h${level + 1}>${block.data.text}</h${level + 1}>\n`;
      } else if (block.type === 'divider') {
        html += `    <hr />\n`;
      } else if (block.type === 'figure' || block.type === 'image') {
        const url = block.data.url || '';
        const caption = block.data.caption || block.data.alt || 'Figure';
        html += `    <figure><img src="${url}" alt="${caption}" /><figcaption>${caption}</figcaption></figure>\n`;
      } else if (block.type === 'code-block') {
        html += `    <pre><code class="language-${block.data.language || 'none'}">${block.data.code}</code></pre>\n`;
      } else if (block.type === 'quote' || block.type === 'latin-quote') {
        const attr = block.data.attribution ? `<cite>${block.data.attribution}</cite>` : '';
        html += `    <blockquote><p>${block.data.text}</p>${attr}</blockquote>\n`;
      } else if (block.type === 'arabic-quote') {
        const trans = block.data.translation ? `<p class="translation">${block.data.translation}</p>` : '';
        const attr = block.data.attribution ? `<cite>${block.data.attribution}</cite>` : '';
        html += `    <blockquote class="arabic" dir="rtl"><p>${block.data.arabic}</p>${trans}${attr}</blockquote>\n`;
      } else if (block.type === 'callout') {
        const title = block.data.title ? `<h5>${block.data.title}</h5>` : '';
        html += `    <div class="callout callout-${block.data.calloutType || 'note'}">${title}<p>${block.data.text}</p></div>\n`;
      } else if (block.type === 'list') {
        const tag = block.data.ordered ? 'ol' : 'ul';
        html += `    <${tag}>\n`;
        const items = block.data.items || [];
        items.forEach((item: any) => {
          html += `      <li>${item.text}</li>\n`;
        });
        html += `    </${tag}>\n`;
      } else if (block.type === 'table') {
        const headers = block.data.headers || [];
        const rows = block.data.rows || [];
        html += `    <table>\n      <thead>\n        <tr>\n`;
        headers.forEach((h: string) => {
          html += `          <th>${h}</th>\n`;
        });
        html += `        </tr>\n      </thead>\n      <tbody>\n`;
        rows.forEach((row: string[]) => {
          html += `        <tr>\n`;
          row.forEach((cell: string) => {
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
};

// 2. Markdown Exporter
export const MarkdownExporter: DocumentExporter = {
  id: 'markdown',
  name: 'Markdown',
  extension: 'md',
  exportDocument: (entry: Entry, blocks: EditorBlock[], citations: Citation[], authorName: string) => {
    let md = '';
    if (entry.contentType !== 'Note') {
      md += `# ${entry.title}\n\n`;
    }
    if (entry.excerpt) {
      md += `> *${entry.excerpt}*\n\n`;
    }
    
    // Convert AST blocks to standard Markdown strings
    const serialized = blocks.map(block => {
      if (block.type === 'paragraph') {
        return block.data.text;
      }
      if (block.type === 'heading') {
        return '#'.repeat(block.data.level || 1) + ' ' + block.data.text;
      }
      if (block.type === 'list') {
        const items = block.data.items || [];
        return items.map((item: any, idx: number) => {
          const prefix = block.data.ordered 
            ? `${idx + 1}. ` 
            : (item.checked !== undefined ? `- [${item.checked ? 'x' : ' '}] ` : '- ');
          return prefix + item.text;
        }).join('\n');
      }
      if (block.type === 'table') {
        const headers = block.data.headers || [];
        const alignments = block.data.alignments || headers.map(() => 'left');
        const rows = block.data.rows || [];
        const headerLine = '| ' + headers.join(' | ') + ' |';
        const sepLine = '| ' + alignments.map((align: string) => {
          if (align === 'center') return ':---:';
          if (align === 'right') return '---:';
          return '---';
        }).join(' | ') + ' |';
        const rowLines = rows.map((row: string[]) => '| ' + row.join(' | ') + ' |');
        return [headerLine, sepLine, ...rowLines].join('\n');
      }
      if (block.type === 'figure' || block.type === 'image') {
        return `![${block.data.caption || block.data.alt || 'Figure'}](${block.data.url})`;
      }
      if (block.type === 'divider') {
        return '---';
      }
      if (block.type === 'code-block') {
        return '```' + (block.data.language || '') + '\n' + block.data.code + '\n```';
      }
      if (block.type === 'quote' || block.type === 'latin-quote') {
        const attr = block.data.attribution ? ` attribution="${block.data.attribution}"` : '';
        return `<quote type="latin"${attr}><text>${block.data.text}</text></quote>`;
      }
      if (block.type === 'arabic-quote') {
        const attr = block.data.attribution ? ` attribution="${block.data.attribution}"` : '';
        const trans = block.data.translation ? `\n  <translation>${block.data.translation}</translation>` : '';
        return `<quote type="arabic"${attr}>\n  <arabic>${block.data.arabic}</arabic>${trans}\n</quote>`;
      }
      if (block.type === 'callout') {
        const titleAttr = block.data.title ? ` title="${block.data.title}"` : '';
        return `<callout type="${block.data.calloutType || 'note'}"${titleAttr}>\n  ${block.data.text}\n</callout>`;
      }
      return '';
    }).join('\n\n');
    
    md += serialized;
    return md;
  }
};

// 3. XML Exporter
export const XmlExporter: DocumentExporter = {
  id: 'xml',
  name: 'Semantic XML',
  extension: 'xml',
  exportDocument: (entry: Entry, blocks: EditorBlock[], citations: Citation[], authorName: string) => {
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
    blocks.forEach(block => {
      if (block.type === 'paragraph') {
        xml += `    <paragraph>${escapeXml(block.data.text)}</paragraph>\n`;
      } else if (block.type === 'heading') {
        xml += `    <heading level="${block.data.level}">${escapeXml(block.data.text)}</heading>\n`;
      } else if (block.type === 'divider') {
        xml += `    <divider />\n`;
      } else if (block.type === 'figure' || block.type === 'image') {
        xml += `    <figure url="${escapeXml(block.data.url || '')}">\n`;
        const caption = block.data.caption || block.data.alt;
        if (caption) {
          xml += `      <caption>${escapeXml(caption)}</caption>\n`;
        }
        xml += `    </figure>\n`;
      } else if (block.type === 'code-block') {
        xml += `    <codeBlock${block.data.language ? ` language="${escapeXml(block.data.language)}"` : ''}>${escapeXml(block.data.code)}</codeBlock>\n`;
      } else if (block.type === 'quote' || block.type === 'latin-quote') {
        const attrAttr = block.data.attribution ? ` attribution="${escapeXml(block.data.attribution)}"` : '';
        xml += `    <blockquote type="latin"${attrAttr}>\n`;
        xml += `      <text>${escapeXml(block.data.text)}</text>\n`;
        xml += `    </blockquote>\n`;
      } else if (block.type === 'arabic-quote') {
        const attrAttr = block.data.attribution ? ` attribution="${escapeXml(block.data.attribution)}"` : '';
        xml += `    <blockquote type="arabic"${attrAttr}>\n`;
        xml += `      <arabic>${escapeXml(block.data.arabic)}</arabic>\n`;
        if (block.data.translation) {
          xml += `      <translation>${escapeXml(block.data.translation)}</translation>\n`;
        }
        xml += `    </blockquote>\n`;
      } else if (block.type === 'callout') {
        const titleAttr = block.data.title ? ` title="${escapeXml(block.data.title)}"` : '';
        xml += `    <callout type="${block.data.calloutType || 'note'}"${titleAttr}>${escapeXml(block.data.text)}</callout>\n`;
      } else if (block.type === 'list') {
        xml += `    <list ordered="${block.data.ordered || false}">\n`;
        const items = block.data.items || [];
        items.forEach((item: any) => {
          xml += `      <listItem>${escapeXml(item.text)}</listItem>\n`;
        });
        xml += `    </list>\n`;
      } else if (block.type === 'table') {
        xml += `    <table>\n`;
        xml += `      <thead>\n`;
        xml += `        <tr>\n`;
        const headers = block.data.headers || [];
        headers.forEach((h: string) => {
          xml += `          <th>${escapeXml(h)}</th>\n`;
        });
        xml += `        </tr>\n`;
        xml += `      </thead>\n`;
        xml += `      <tbody>\n`;
        const rows = block.data.rows || [];
        rows.forEach((row: string[]) => {
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
};

// 4. Future Stub Exporters for extensibility demo (no switches)
export const PdfExporterStub: DocumentExporter = {
  id: 'pdf',
  name: 'PDF (Future)',
  extension: 'pdf',
  exportDocument: (entry, blocks, citations, authorName) => {
    return `% PDF binary stream simulation for ${entry.title}`;
  }
};

export const DocxExporterStub: DocumentExporter = {
  id: 'docx',
  name: 'DOCX Word (Future)',
  extension: 'docx',
  exportDocument: (entry, blocks, citations, authorName) => {
    return `[DOCX ZIP structure mockup for ${entry.title}]`;
  }
};

export const LatexExporterStub: DocumentExporter = {
  id: 'latex',
  name: 'LaTeX (Future)',
  extension: 'tex',
  exportDocument: (entry, blocks, citations, authorName) => {
    return `\\documentclass{article}\n\\title{${entry.title}}\n\\author{${authorName}}\n\\begin{document}\n\\maketitle\n\\end{document}`;
  }
};

// Exporter Registry
export const exporterRegistry = new ExporterRegistry();
exporterRegistry.register(HtmlExporter);
exporterRegistry.register(MarkdownExporter);
exporterRegistry.register(XmlExporter);
exporterRegistry.register(PdfExporterStub);
exporterRegistry.register(DocxExporterStub);
exporterRegistry.register(LatexExporterStub);
