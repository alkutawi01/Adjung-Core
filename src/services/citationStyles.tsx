import React from 'react';
import { Citation } from '../types';

export interface CitationStylePlugin {
  id: string;
  name: string;
  formatCitation: (citation: Citation, index: number, sortOrder: 'alphabetical' | 'appearance') => string;
  formatBibliography: (citation: Citation, index: number) => React.ReactNode;
}

export class CitationStyleRegistry {
  private styles = new Map<string, CitationStylePlugin>();

  register(style: CitationStylePlugin) {
    this.styles.set(style.id, style);
  }

  get(id: string): CitationStylePlugin | undefined {
    return this.styles.get(id);
  }

  getAll(): CitationStylePlugin[] {
    return Array.from(this.styles.values());
  }
}

export const HarvardStylePlugin: CitationStylePlugin = {
  id: 'harvard',
  name: 'Harvard (Author-Date)',
  formatCitation: (citation, index, sortOrder) => {
    return `(${citation.author}, ${citation.year})`;
  },
  formatBibliography: (citation, index) => {
    return (
      <span className="text-left block">
        <strong className="font-sans font-semibold text-stone-900">{citation.author}</strong> ({citation.year}).{' '}
        <span>"{citation.title}."</span> <em>{citation.publisher}</em>.
        {citation.url && (
          <span className="ml-1 text-[11px] text-stone-500 font-mono">
            Available at:{' '}
            <a href={citation.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-Adjung-maroon">
              {citation.url}
            </a>
          </span>
        )}
        {citation.doi && <span className="ml-1 text-[11px] text-stone-400 font-mono">DOI: {citation.doi}</span>}
      </span>
    );
  }
};

export const VancouverStylePlugin: CitationStylePlugin = {
  id: 'vancouver',
  name: 'Vancouver (Numbered)',
  formatCitation: (citation, index, sortOrder) => {
    return `[${index}]`;
  },
  formatBibliography: (citation, index) => {
    return (
      <span className="text-left block">
        <span className="font-mono text-Adjung-maroon mr-2 font-bold select-none">[{index}]</span>
        <strong className="font-sans font-semibold text-stone-900">{citation.author}</strong>.{' '}
        <span>{citation.title}.</span> <em>{citation.publisher}</em>; {citation.year}.
        {citation.url && (
          <span className="ml-1 text-[11px] text-stone-500 font-mono">
            Available from:{' '}
            <a href={citation.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-Adjung-maroon">
              {citation.url}
            </a>
          </span>
        )}
        {citation.doi && <span className="ml-1 text-[11px] text-stone-400 font-mono">DOI: {citation.doi}</span>}
      </span>
    );
  }
};

export const citationStyleRegistry = new CitationStyleRegistry();
citationStyleRegistry.register(HarvardStylePlugin);
citationStyleRegistry.register(VancouverStylePlugin);
