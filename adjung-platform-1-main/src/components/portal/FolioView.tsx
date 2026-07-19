import React from 'react';
import { User, Entry, WriterProfile, SystemSettings, DigitalSignature } from '../../types';
import { db } from '../../db/mockDb';
import { BRAND } from '../../config/brand';
import { isArabicText, parseInlineFormatting, toRoman } from '../../utils';
import { SignatureRenderer } from '../desk/SignatureRenderer';
import { TimelineEntryCollapseRenderer } from '../rendering/TimelineEntryCollapseRenderer';
import { FileText, ArrowRight } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

interface FolioViewProps {
  currentAuthor: User | null;
  authorProfile: WriterProfile | null;
  selectedEntry: Entry | null;
  systemSettings: SystemSettings;
  allUniqueTags: string[];
  selectedTagFilter: string;
  setSelectedTagFilter: (tag: string) => void;
  authorPublishedEntries: Entry[];
  sortedYears: number[];
  timelineGroupedByYear: Record<number, Entry[]>;
  expandedNoteIds: string[];
  toggleNote: (id: string) => void;
  setSelectedEntry: (entry: Entry | null) => void;
  setSelectedAuthorId: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
  setShowLoginModal: (show: boolean) => void;
  setLoginError: (error: string) => void;
}

function resolveDigitalSignature(authorId: string, entry?: Entry | null): DigitalSignature | undefined {
  const identity = db.getIdentityByAccountId(authorId);
  if (!identity || !identity.signatures) return undefined;
  if (entry?.signatureVersionId) {
    const sig = identity.signatures.find(s => s.id === entry.signatureVersionId);
    if (sig) return sig;
  }
  return identity.signatures.find(s => s.status === 'Default');
}

export const FolioView: React.FC<FolioViewProps> = ({
  currentAuthor,
  authorProfile,
  selectedEntry,
  systemSettings,
  allUniqueTags,
  selectedTagFilter,
  setSelectedTagFilter,
  authorPublishedEntries,
  sortedYears,
  timelineGroupedByYear,
  expandedNoteIds,
  toggleNote,
  setSelectedEntry,
  setSelectedAuthorId,
  setActiveTab,
  setShowLoginModal,
  setLoginError,
}) => {
  const { currentUser, refreshDbState } = useAppContext();
  const [noteExceedsMap, setNoteExceedsMap] = React.useState<Record<string, boolean>>({});
  const [isEditingHeader, setIsEditingHeader] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState(authorProfile?.heroTitle || '');
  const [editedSubtitle, setEditedSubtitle] = React.useState(authorProfile?.heroSubtitle || '');

  React.useEffect(() => {
    setEditedTitle(authorProfile?.heroTitle || '');
    setEditedSubtitle(authorProfile?.heroSubtitle || '');
  }, [authorProfile]);

  const handleKeyDownShortcut = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, setter: (val: string) => void) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      const text = target.value;
      
      if (start === end) {
        const newText = text.slice(0, start) + '**' + text.slice(start);
        setter(newText);
        setTimeout(() => {
          target.focus();
          target.setSelectionRange(start + 1, start + 1);
        }, 0);
      } else {
        const selectedText = text.slice(start, end);
        const isAlreadyItalic = selectedText.startsWith('*') && selectedText.endsWith('*');
        let newText = '';
        let newCursorStart = start;
        let newCursorEnd = end;
        
        if (isAlreadyItalic) {
          const unwrapped = selectedText.slice(1, -1);
          newText = text.slice(0, start) + unwrapped + text.slice(end);
          newCursorEnd = start + unwrapped.length;
        } else {
          const wrapped = `*${selectedText}*`;
          newText = text.slice(0, start) + wrapped + text.slice(end);
          newCursorStart = start;
          newCursorEnd = end + 2;
        }
        
        setter(newText);
        setTimeout(() => {
          target.focus();
          target.setSelectionRange(newCursorStart, newCursorEnd);
        }, 0);
      }
    }
  };

  const handleSaveHeader = async () => {
    if (!currentAuthor) return;
    const updatedProfile = {
      authorId: currentAuthor.id,
      heroTitle: editedTitle,
      heroSubtitle: editedSubtitle
    };
    
    await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProfile)
    });
    
    db.updateProfile(updatedProfile);
    setIsEditingHeader(false);
    refreshDbState();
  };

  return (
    !currentAuthor ? (
      <div className="max-w-2xl mx-auto text-center py-16 px-4 space-y-8 select-none">
        <div className="space-y-3">
          <span className="block font-mono text-[8px] md:text-[9px] uppercase tracking-[0.25em] text-adjung-maroon mb-2">
            Welcome to {BRAND.name}
          </span>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-light text-stone-900 leading-tight">
            Independent Folios
          </h2>
          <div className="h-px w-24 bg-adjung-maroon/30 mx-auto my-4" />
          <p className="font-serif text-stone-600 text-sm md:text-base leading-loose max-w-lg mx-auto">
            {systemSettings.editorialPolicy}
          </p>
        </div>

        <div className="pt-4 space-y-4">
          <p className="font-sans text-xs text-stone-500 max-w-md mx-auto">
            To view individual timelines, articles, essays, and writer profiles, please select a registered writer from our directory or sign in if you are an editor.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              className="bg-adjung-maroon hover:opacity-95 text-[#FDFDFD] font-mono text-xs uppercase tracking-wider px-6 py-3 rounded shadow transition cursor-pointer"
            >
              Browse Writers Directory
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginError('');
                setShowLoginModal(true);
              }}
              className="border border-stone-300 hover:border-adjung-maroon hover:text-adjung-maroon text-stone-700 font-mono text-xs uppercase tracking-wider px-6 py-3 rounded transition cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    ) : (
      <div className="space-y-10 max-w-4xl mx-auto">
        {/* Writer Hero Block */}
        <div className="text-center md:text-left border-b border-stone-300 pb-8 flex flex-col md:flex-row items-center md:items-stretch justify-between gap-6 md:gap-8">
          <div className="space-y-3 max-w-3xl flex-grow relative group">
            {isEditingHeader ? (
              <div className="space-y-3 py-2 text-left w-full">
                <div className="relative">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value.slice(0, 200))}
                    onKeyDown={(e) => handleKeyDownShortcut(e, setEditedTitle)}
                    maxLength={200}
                    className="w-full border border-stone-200 p-2 pr-16 rounded text-2xl md:text-[28px] font-serif text-[#111111] focus:outline-none focus:border-[#802334] leading-tight"
                    placeholder="Folio Hero Title"
                  />
                  <span className="absolute right-2 bottom-2 text-[9px] font-mono text-stone-400 select-none">
                    {editedTitle.length}/200
                  </span>
                </div>
                <div className="relative">
                  <textarea
                    value={editedSubtitle}
                    onChange={(e) => setEditedSubtitle(e.target.value.slice(0, 300))}
                    onKeyDown={(e) => handleKeyDownShortcut(e, setEditedSubtitle)}
                    maxLength={300}
                    className="w-full border border-stone-200 p-2 pr-16 rounded text-[14px] md:text-[15px] font-serif text-stone-500 focus:outline-none focus:border-[#802334] min-h-[140px] leading-relaxed"
                    placeholder="Folio Hero Subtitle"
                  />
                  <span className="absolute right-2 bottom-2 text-[9px] font-mono text-stone-400 select-none">
                    {editedSubtitle.length}/300
                  </span>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsEditingHeader(false)}
                    className="px-2.5 py-1 border border-stone-200 text-stone-600 rounded text-[10px] uppercase font-mono tracking-wider hover:bg-stone-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveHeader}
                    className="px-2.5 py-1 bg-[#802334] text-white rounded text-[10px] uppercase font-mono tracking-wider hover:opacity-90 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="font-serif text-2xl md:text-[28px] font-normal tracking-tight text-[#111111] leading-tight relative group/title inline-block">
                  <span>{parseInlineFormatting(authorProfile?.heroTitle || '')}</span>
                  {currentUser?.id === currentAuthor.id && (
                    <button
                      onClick={() => setIsEditingHeader(true)}
                      className="inline-block align-middle ml-2 opacity-0 group-hover/title:opacity-100 transition-opacity p-1 text-stone-400 hover:text-[#802334] cursor-pointer"
                      title="Edit Banner Title & Subtitle"
                    >
                      <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </h2>
                <p className="font-serif text-[14px] md:text-[15px] text-stone-500 leading-relaxed max-w-xl">
                  {parseInlineFormatting(authorProfile?.heroSubtitle || '')}
                </p>
              </>
            )}
          </div>
          {/* Writer Signature replacement of traditional avatar (refined personal seal style) */}
          <div className="flex-shrink-0 text-center border-l border-stone-300 pl-8 py-1.5 select-none flex flex-col justify-center">
            <div className="h-16 w-64 flex items-center justify-center z-10 relative mix-blend-multiply">
              {currentAuthor && (
                <SignatureRenderer
                  strokes={resolveDigitalSignature(currentAuthor.id)?.strokes || []}
                  type={resolveDigitalSignature(currentAuthor.id)?.type || 'drawn'}
                  typedText={resolveDigitalSignature(currentAuthor.id)?.typedText || currentAuthor.signature}
                  fontFamily={resolveDigitalSignature(currentAuthor.id)?.fontFamily}
                  typographyStyle={resolveDigitalSignature(currentAuthor.id)?.typographyStyle}
                  className="w-full h-full overflow-visible origin-center"
                  color="rgba(128, 35, 52, 0.85)"
                  strokeWidth={2.5}
                  enableBleed={true}
                />
              )}
            </div>
          </div>
        </div>

        {/* Categories filter bar */}
        {allUniqueTags.length > 0 && (
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 border-b border-stone-300 pb-4 text-xs font-mono">
            <span className="text-stone-400 uppercase tracking-wider mr-2">Sort Index:</span>
            <button
              type="button"
              onClick={() => setSelectedTagFilter('All')}
              className={`px-2.5 py-0.5 rounded transition ${
                selectedTagFilter === 'All' 
                  ? 'bg-adjung-maroon/10 text-adjung-maroon font-semibold border border-adjung-maroon/20' 
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              All Entries ({authorPublishedEntries.length})
            </button>
            {allUniqueTags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTagFilter(tag)}
                className={`px-2.5 py-0.5 rounded transition ${
                  selectedTagFilter === tag 
                    ? 'bg-adjung-maroon/10 text-adjung-maroon font-semibold border border-adjung-maroon/20' 
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                #{tag} ({authorPublishedEntries.filter(e => e.tags.includes(tag)).length})
              </button>
            ))}
          </div>
        )}

        {/* Grouped timeline list */}
        {sortedYears.length === 0 ? (
          <div className="text-center py-20 bg-transparent border-none max-w-xl mx-auto">
            <FileText className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <h3 className="font-serif text-stone-700 text-lg">Folio Archives Empty</h3>
            <p className="font-serif text-xs text-stone-500 mt-1">This writer has not yet cataloged any public publications in this category.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {sortedYears.map(year => (
              <section key={year} className="relative pl-0 md:pl-28">
                
                {/* Left side year indicator (Floating anchor) */}
                <div className="absolute left-0 top-1 text-center hidden md:block">
                  <span className="font-serif text-2xl font-bold tracking-tight text-adjung-maroon block">
                    {year}
                  </span>
                </div>

                <div className="border-t border-stone-200/50 pt-3 mb-3 md:hidden">
                  <span className="font-serif text-xl font-bold tracking-tight text-adjung-maroon mr-2">{year}</span>
                </div>

                {/* Timeline items list */}
                <div className="space-y-4">
                  {timelineGroupedByYear[year].map((item, idx) => {
                    const dateObj = new Date(item.publishedDate || item.createdDate);
                    const dayMonthStr = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                    const isNote = item.contentType === 'Note';
                    const isAr = isNote ? isArabicText(item.content) : isArabicText(item.title);
                    const isExpanded = expandedNoteIds.includes(item.id);
                    
                    return (
                      <div 
                        key={item.id} 
                        id={`note-card-${item.id}`}
                        className={`px-6 py-5 md:px-8 md:py-6 rounded border my-4 group flex flex-col md:flex-row md:items-start justify-between gap-4 transition-all duration-300 w-full ${
                          isNote 
                            ? 'bg-[#FAF8F5] border-stone-300/85 hover:border-stone-400 hover:shadow-sm text-stone-850' 
                            : 'bg-adjung-maroon/[0.015] hover:bg-adjung-maroon/[0.03] border-stone-300 hover:text-stone-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
                        } ${isAr && isNote ? 'text-right' : 'text-left'}`}
                      >
                        
                        <div className="space-y-2 flex-grow text-left w-full">
                          {/* Day / Month label */}
                          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-stone-500">
                            <span className="bg-[#FDFDFD] border border-stone-200 px-1.5 py-0.5 rounded">{dayMonthStr}</span>
                            <span>•</span>
                            <span className="text-adjung-maroon font-semibold uppercase tracking-wider text-[9px]">{item.contentType}</span>
                          </div>

                          {/* Title link */}
                          {!isNote && item.title && (
                            <h3 
                              onClick={() => {
                                setSelectedEntry(item);
                              }}
                              className={`text-xl font-serif text-stone-900 cursor-pointer hover:text-adjung-maroon transition-colors leading-snug tracking-tight font-medium ${
                                isAr ? 'font-arabic text-right' : ''
                              }`}
                            >
                              {parseInlineFormatting(item.title || '')}
                            </h3>
                          )}

                          {/* Preview/Full Content snippet with visual layout collapse */}
                          <div 
                            className="cursor-pointer" 
                            onClick={(e) => {
                              if (isNote) {
                                toggleNote(item.id);
                              } else {
                                setSelectedEntry(item);
                              }
                            }}
                          >
                             <TimelineEntryCollapseRenderer
                               item={item}
                               isExpanded={isNote ? isExpanded : false}
                               onToggle={() => {
                                 if (isNote) {
                                   toggleNote(item.id);
                                 } else {
                                   setSelectedEntry(item);
                                 }
                               }}
                               onOpenText={() => setSelectedEntry(item)}
                               showInlineToggle={false}
                               onLimitExceeded={(exceeded) => {
                                 setNoteExceedsMap(prev => {
                                   if (prev[item.id] === exceeded) return prev;
                                   return { ...prev, [item.id]: exceeded };
                                 });
                               }}
                             />
                          </div>

                          {/* Tag tokens */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {item.tags.map(t => (
                              <span key={t} className="font-mono text-[9px] text-stone-400 uppercase tracking-wider">
                                #{t}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* View trigger */}
                        <div className="self-end md:self-center flex items-center gap-2 flex-shrink-0">
                           {isNote && noteExceedsMap[item.id] && (
                             <button
                               type="button"
                               onClick={() => toggleNote(item.id)}
                               className="px-3 py-1.5 rounded hover:bg-stone-100 text-stone-500 font-mono text-[10px] uppercase tracking-wider transition border border-stone-200/50 cursor-pointer"
                             >
                               {isExpanded ? 'Collapse' : 'Expand'}
                             </button>
                           )}
                          <button
                            type="button"
                            onClick={() => setSelectedEntry(item)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded hover:bg-adjung-maroon/5 text-stone-500 hover:text-adjung-maroon font-mono text-[10px] uppercase tracking-wider transition border border-transparent hover:border-adjung-maroon/10 cursor-pointer font-semibold"
                          >
                            Open Text
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>

              </section>
            ))}
          </div>
        )}
      </div>
    )
  );
};
