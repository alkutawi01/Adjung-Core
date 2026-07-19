import React, { useState } from 'react';
import { ListOrdered, Info, Search } from 'lucide-react';
import { Entry, User, SystemSettings } from '../../types';
import { isArabicText, stripMarkdown, parseInlineFormatting } from '../../utils';

interface EditorialIndexProps {
  entries: Entry[];
  users: User[];
  setSelectedEntry: (entry: Entry) => void;
  systemSettings: SystemSettings;
  initialSearchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

export function EditorialIndex({
  entries,
  users,
  setSelectedEntry,
  systemSettings,
  initialSearchQuery = '',
  onSearchQueryChange,
}: EditorialIndexProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [typeFilter, setTypeFilter] = useState<'All' | 'Article' | 'Essay' | 'Note' | 'Notice' | "Editor's Note">('All');

  React.useEffect(() => {
    setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery]);

  // Filter entries based on search query and type filter
  const filteredEntries = entries.filter(e => {
    // Only published entries should be visible in the catalog
    if (e.status !== 'Published') return false;

    const matchesType = typeFilter === 'All' || e.contentType === typeFilter;

    const query = searchQuery.trim().toLowerCase();
    const author = users.find(u => u.id === e.authorId);
    const authorName = e.publicationClass === 'Institutional'
      ? (e.publisher || 'Adjung Editorial Board')
      : (author?.penName || 'Anonymous');

    const matchesSearch = !query ||
      e.title.toLowerCase().includes(query) ||
      authorName.toLowerCase().includes(query) ||
      e.contentType.toLowerCase().includes(query) ||
      (e.tags && e.tags.some((t: string) => t.toLowerCase().includes(query))) ||
      (e.slug && e.slug.toLowerCase().includes(query)) ||
      e.id.toLowerCase().includes(query);

    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-8">
      <div className="space-y-1 border-b border-[#111111]/10 pb-5">
        <h2 className="font-serif text-2xl font-light text-[#111111] flex items-center gap-2 text-left">
          <ListOrdered className="w-6 h-6 text-[#802334]" />
          Index
        </h2>
        <p className="font-sans text-[10px] uppercase tracking-widest text-[#111111]/40 text-left">
          Live dynamic catalog of all published entries in the shared index database
        </p>
      </div>

      {/* Info Card */}
      <div className="p-4 bg-[#802334]/5 border border-[#802334]/20 rounded flex gap-3 text-xs text-[#111111]/70 leading-relaxed font-sans select-none text-left">
        <Info className="w-4 h-4 text-[#802334] flex-shrink-0 mt-0.5" />
        <div>
          <strong>Shared Database Index:</strong> every Note, Essay, Article, Notice, and Editor's Note resides inside a single storage and indexing engine. No content is duplicated or moved. This panel allows users to review the public global directory.
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200/50 pb-4">
        {/* Search Input */}
        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            placeholder="Search entries by title, author, slug..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (onSearchQueryChange) onSearchQueryChange(e.target.value);
            }}
            className="w-full border border-stone-200 p-2 pl-8 rounded text-xs focus:outline-none focus:border-[#802334] font-sans bg-white"
          />
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-3" />
        </div>

        {/* Type Filters */}
        <div className="flex flex-wrap items-center gap-1 text-xs font-mono select-none">
          <span className="text-stone-400 uppercase tracking-wider mr-2 text-[10px]">Filter Type:</span>
          {(['All', 'Article', 'Essay', 'Note', 'Notice', "Editor's Note"] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`px-3.5 py-1.5 rounded-full text-[11px] transition-all duration-300 cursor-pointer ${
                typeFilter === type
                  ? 'bg-[#802334]/12 text-[#802334] font-semibold border border-[#802334]/20 backdrop-blur-sm shadow-sm shadow-[#802334]/5'
                  : 'text-stone-500 hover:text-[#802334] hover:bg-stone-50 border border-transparent'
              }`}
            >
              {type === 'All' ? 'All' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Database Table */}
      <div className="bg-white border border-[#111111]/10 rounded overflow-hidden shadow-sm font-sans text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#802334]/90 backdrop-blur-md border-b border-[#802334]/20 font-sans text-[9px] uppercase tracking-widest text-white/90 font-semibold">
                <th className="p-3 pl-4">UUID</th>
                <th className="p-3">Author / Publisher</th>
                <th className="p-3">Title</th>
                <th className="p-3">Type</th>
                <th className="p-3">Published</th>
                <th className="p-3 pr-4">Slug</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#111111]/5 font-serif text-sm">
              {filteredEntries.map((item) => {
                const author = users.find(u => u.id === item.authorId);
                const isAr = item.contentType === 'Note' ? isArabicText(item.content) : isArabicText(item.title);
                return (
                  <tr 
                    key={item.id} 
                    onClick={() => setSelectedEntry(item)}
                    className="hover:bg-stone-50 cursor-pointer transition-colors"
                  >
                    <td className="p-3 pl-4 font-mono text-[9px] text-[#111111]/40 select-all" onClick={(e) => e.stopPropagation()}>{item.id.slice(0, 13)}...</td>
                    <td className="p-3 font-sans font-medium text-[#111111]">
                      {item.publicationClass === 'Institutional'
                        ? (item.publisher || 'Adjung Editorial Board')
                        : (author?.penName || 'Anonymous')}
                    </td>
                    <td 
                      dir={isAr ? 'rtl' : 'ltr'}
                      className={`p-3 text-[#111111] font-medium ${isAr ? 'text-right' : 'text-left'}`}
                    >
                      {item.contentType === 'Note' ? (
                        <span className="italic text-stone-500 font-normal">
                          {(() => {
                            const cleanText = item.content.replace(/\[\^.*?\]/g, '').trim();
                            const firstPara = cleanText.split(/\n+/)[0] || '';
                            const sentenceMatch = firstPara.match(/^[^.!?]+[.!?]/);
                            return sentenceMatch ? sentenceMatch[0] : firstPara.substring(0, 80) + '...';
                          })()}
                        </span>
                      ) : (
                        parseInlineFormatting(item.title)
                      )}
                      {isAr && (
                        <span className="ml-2 font-mono text-[9px] text-[#802334] uppercase tracking-wide bg-[#802334]/5 px-1 rounded">AR</span>
                      )}
                    </td>
                    <td className="p-3 font-sans"><span className="text-[#802334] font-semibold">{item.contentType}</span></td>
                    <td className="p-3 font-mono text-[#111111]/50 text-[10px]">{item.publishedDate ? new Date(item.publishedDate).toLocaleDateString() : 'N/A'}</td>
                    <td className="p-3 font-mono text-[#111111]/40 text-[10px] pr-4">{item.slug}</td>
                  </tr>
                );
              })}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center italic text-stone-400 font-sans">
                    No matching published entries are indexed in the shared database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
