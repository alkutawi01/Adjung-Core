import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { Entry, WriterProfile, User } from '../../types';
import { isArabicText, parseInlineFormatting, stripMarkdown, getFootnotesReadingOrderMap, getMarginNotesReadingOrderMap } from '../../utils';
import { TimelineEntryCollapseRenderer } from '../rendering/TimelineEntryCollapseRenderer';

interface FolioTimelineProps {
  authorProfile: WriterProfile;
  currentAuthor: User;
  sortedYears: string[];
  timelineGroupedByYear: { [year: string]: Entry[] };
  allUniqueTags: string[];
  selectedTagFilter: string;
  setSelectedTagFilter: (tag: string) => void;
  setSelectedEntry: (entry: Entry | null) => void;
  authorPublishedEntries: Entry[];
}

export function FolioTimeline({
  authorProfile,
  currentAuthor,
  sortedYears,
  timelineGroupedByYear,
  allUniqueTags,
  selectedTagFilter,
  setSelectedTagFilter,
  setSelectedEntry,
  authorPublishedEntries,
}: FolioTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };
  return (
    <div className="space-y-12">
      {/* Editorial Hero */}
      <header className="mb-12 border-b border-[#111111]/10 pb-8">
        <h1 className="text-4xl md:text-6xl lg:text-7xl leading-[1.0] tracking-tighter mb-6 text-[#111111] font-serif font-light text-left">
          {authorProfile.heroTitle}
        </h1>
        <div className="flex items-center gap-4 text-xs font-sans text-[#111111]/60">
          <span className="bg-[#802334] text-white px-2 py-0.5 uppercase tracking-wider text-[9px] font-sans font-semibold">Folio Discourse</span>
          <span>— {authorProfile.heroSubtitle}</span>
        </div>
      </header>

      {/* Tags / categories filter bar */}
      {allUniqueTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#111111]/10 pb-6 mb-10 text-[11px] font-sans font-medium uppercase tracking-wider">
          <span className="text-[#111111]/40 mr-2">Sort Index:</span>
          <button
            type="button"
            onClick={() => setSelectedTagFilter('All')}
            className={`px-3 py-1 transition-colors ${
              selectedTagFilter === 'All' 
                ? 'text-[#802334] border-b border-[#802334]' 
                : 'text-[#111111]/50 hover:text-[#111111]'
            }`}
          >
            All Entries ({authorPublishedEntries.length})
          </button>
          {allUniqueTags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTagFilter(tag)}
              className={`px-3 py-1 transition-colors ${
                selectedTagFilter === tag 
                  ? 'text-[#802334] border-b border-[#802334]' 
                  : 'text-[#111111]/50 hover:text-[#111111]'
              }`}
            >
              #{tag} ({authorPublishedEntries.filter(e => e.tags.includes(tag)).length})
            </button>
          ))}
        </div>
      )}

      {/* Chronological list of publications */}
      {sortedYears.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[#111111]/10 rounded max-w-xl mx-auto font-serif">
          <FileText className="w-10 h-10 text-[#111111]/20 mx-auto mb-3" />
          <h3 className="text-stone-700 text-lg">Folio Archives Empty</h3>
          <p className="text-xs text-stone-500 mt-1">This scholar has not yet cataloged any public publications in this category.</p>
        </div>
      ) : (
        <div className="space-y-16">
          {sortedYears.map(year => (
            <div key={year} className="relative">
              {/* Year Header absolute positioning */}
              <div className="absolute -left-12 top-0 -rotate-90 origin-top-left select-none hidden md:block">
                <span className="text-5xl font-bold text-[#111111]/5 font-sans">
                  {year}
                </span>
              </div>

              <div className="md:hidden border-b border-[#111111]/10 pb-2 mb-4">
                <span className="text-2xl font-bold text-[#802334] font-serif">{year}</span>
              </div>

              <div className="space-y-12 pl-0 md:pl-12 border-l-0 md:border-l border-[#111111]/5 md:ml-6">
                {timelineGroupedByYear[year].map((item) => {
                  const dateObj = new Date(item.publishedDate || item.createdDate);
                  const dayMonthStr = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase();
                  const isAr = isArabicText(item.title);

                  return (
                    <article 
                      key={item.id} 
                      className="group cursor-pointer" 
                      onClick={() => setSelectedEntry(item)}
                    >
                      <div className="flex gap-4 md:gap-8 items-start">
                        <div className="text-[11px] font-mono text-[#111111]/40 pt-1.5 w-16 flex-shrink-0">
                          {dayMonthStr}
                        </div>
                        <div className="space-y-2 flex-grow">
                          <div className="flex items-center gap-2">
                            <span className="bg-[#802334] text-white px-2 py-0.5 uppercase tracking-wider text-[8px] font-mono">
                              {item.contentType}
                            </span>
                          </div>
                          {item.contentType !== 'Note' && (
                            <h3 
                              className={`text-xl md:text-2xl font-serif text-[#111111] group-hover:text-[#802334] transition-colors leading-snug tracking-tight font-medium text-left ${isAr ? 'font-arabic text-right' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEntry(item);
                              }}
                            >
                              {parseInlineFormatting(item.title, [], 'alphabetical', {}, getFootnotesReadingOrderMap(item.content).map, undefined, undefined, getMarginNotesReadingOrderMap(item.content).map)}
                            </h3>
                          )}
                          <div 
                            className="cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(item.id);
                            }}
                          >
                            <TimelineEntryCollapseRenderer
                              item={item}
                              isExpanded={expandedIds.includes(item.id)}
                              onToggle={() => toggleExpand(item.id)}
                            />
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {item.tags.map(t => (
                              <span key={t} className="text-[9px] uppercase border border-[#111111]/20 px-2 py-0.5 rounded-full opacity-60 font-sans tracking-wide">
                                #{t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
