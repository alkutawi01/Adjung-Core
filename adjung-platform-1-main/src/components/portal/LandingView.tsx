import React from 'react';
import { Entry, SystemSettings } from '../../types';
import { parseInlineFormatting, toRoman, markdownToHtml } from '../../utils';
import { PhilosophyCarousel } from '../common/PhilosophyCarousel';
import { ElasticMarginRow } from '../rendering/ElasticMarginRow';
import { AnimatedSignature } from '../desk/AnimatedSignature';
import { motion } from 'motion/react';

interface LandingViewProps {
  entries: Entry[];
  systemSettings: SystemSettings;
  setActiveTab: (tab: string) => void;
  setSelectedEntry: (entry: Entry | null) => void;
  setSelectedAuthorId: (id: string | null) => void;
  setShowLoginModal: (show: boolean) => void;
  setLoginError: (error: string) => void;
  researchFindingsGoogleDocText?: string;
}

export const LandingView: React.FC<LandingViewProps> = ({
  entries,
  systemSettings,
  setActiveTab,
  setSelectedEntry,
  setSelectedAuthorId,
  setShowLoginModal,
  setLoginError,
  researchFindingsGoogleDocText = '',
}) => {
  const manifestoEntry = entries.find((e) => e.id === 'entry-manifesto');

  const renderManifestoParagraph = (markdownText: string, idx: number) => {
    const htmlContent = markdownToHtml(markdownText).replace(/^<p>/, '').replace(/<\/p>$/, '');
    const cleanText = htmlContent.replace(/<[^>]*>/g, '');
    if (idx === 0 && cleanText.length > 0) {
      const firstLetter = cleanText.charAt(0);
      const firstLetterPos = htmlContent.indexOf(firstLetter);
      const rest = htmlContent.substring(firstLetterPos + 1);
      return (
        <p key={idx} className="leading-relaxed">
          <span className="float-left text-5xl md:text-6xl font-light text-[#802334] mr-2 mt-1 leading-none font-serif select-none">
            {firstLetter}
          </span>
          <span dangerouslySetInnerHTML={{ __html: wrapBadgesWithWords(rest) }} />
        </p>
      );
    }
    return (
      <p
        key={idx}
        className="leading-relaxed"
        dangerouslySetInnerHTML={{ __html: wrapBadgesWithWords(htmlContent) }}
      />
    );
  };

  const wrapBadgesWithWords = (html: string) => {
    return html.replace(
      /((?:<span class="interlinear-word"><span class="interlinear-gloss">[^<]*<\/span>[^<]*<\/span>|[^\s<>]+)[,.;:!?]?(?:<span class="(?:footnote|margin-note)-badge"[^>]*><\/span>)+)/g,
      '<span class="whitespace-nowrap">$1</span>'
    );
  };

  const featuredEntry = entries.find(
    (e) => e.id === systemSettings.featuredEntryId && e.status === 'Published'
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pt-24 pb-12 px-4 select-none animate-fade-in text-center">
      {/* Elegant Hero Introduction */}
      <div className="space-y-4 max-w-2xl mx-auto">
        <span className="block font-mono text-[9px] uppercase tracking-[0.3em] text-[#802334] font-bold">
          A Better Place for Knowledge
        </span>
        <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light text-stone-900 leading-tight tracking-tight animate-fade-in">
          Libraries Ask for Silence for a Reason.
        </h2>
        <div className="h-px w-16 bg-[#802334]/20 mx-auto my-4" />
      </div>

      {/* Swapped CTA Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto py-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('frontpage');
            setSelectedEntry(null);
          }}
          className="w-full sm:w-auto min-w-[180px] px-6 py-2.5 bg-[#802334] hover:bg-[#9c2c41] text-[#FDFDFD] font-mono text-xs uppercase tracking-wider rounded-sm transition cursor-pointer shadow-md font-semibold text-center"
        >
          Enter Frontpage
        </button>
        <button
          type="button"
          onClick={() => {
            setLoginError('');
            setShowLoginModal(true);
          }}
          className="w-full sm:w-auto min-w-[180px] px-6 py-2.5 bg-white border border-stone-200 hover:border-[#802334] text-stone-700 hover:text-[#802334] font-mono text-xs uppercase tracking-wider rounded-sm transition cursor-pointer font-semibold text-center"
        >
          Sign In
        </button>
      </div>

      {/* Scroll-Revealed Philosophy Quote Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="py-6 max-w-xl mx-auto text-center my-4 bg-transparent"
      >
        <PhilosophyCarousel systemSettings={systemSettings} researchFindingsGoogleDocText={researchFindingsGoogleDocText} />
      </motion.div>

      {/* FASA 1.5: FEATURED ENTRY HERO */}
      {featuredEntry && (
        <div
          className="py-12 text-center group cursor-pointer max-w-3xl mx-auto"
          onClick={() => {
            setSelectedEntry(featuredEntry);
            setSelectedAuthorId(featuredEntry.authorId);
            setActiveTab('folio');
          }}
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-px w-12 bg-stone-200"></div>
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#802334] font-bold">
              Featured Entry
            </span>
            <div className="h-px w-12 bg-stone-200"></div>
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-light text-stone-900 leading-tight mb-6 group-hover:text-[#802334] transition-colors px-4">
            {parseInlineFormatting(featuredEntry.title)}
          </h2>
          <p className="font-serif text-stone-500 italic max-w-2xl mx-auto leading-relaxed">
            {featuredEntry.excerpt || featuredEntry.content.substring(0, 200) + '...'}
          </p>
        </div>
      )}

      {/* FASA 2 & 3: THE MANIFESTO & THE FIRST PROOF */}
      {manifestoEntry && (() => {
        const paragraphs = manifestoEntry.content.split('\n\n');
        const fnData = manifestoEntry.footnotesData || [];
        const mnData = manifestoEntry.marginNotesData || {};

        return (
          <div
            id="platform-description-block"
            className="manifesto-container max-w-5xl mx-auto pt-8 pb-20 px-4 text-left mt-6 border-t border-stone-200/40 space-y-10"
          >
            {/* FASA 2: THE MANIFESTO */}
            <div className="space-y-6 font-serif">
              <div className="flex justify-between items-center select-none border-b border-stone-100 pb-2">
                <span className="block font-mono text-[9px] uppercase tracking-[0.25em] text-[#802334] font-bold">
                  The Manifesto
                </span>
              </div>

              <h3 className="text-2xl md:text-3xl lg:text-4xl font-light text-stone-900 leading-tight max-w-xl">
                {manifestoEntry.title}
              </h3>

              <div className="h-px w-16 bg-[#802334]/20 my-4" />

              <div
                className="space-y-4"
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  const badge = target.closest('.footnote-badge');
                  if (badge) {
                    const dataId = badge.getAttribute('data-id');
                    if (dataId) {
                      const destEl = document.getElementById(`manifesto-footnote-dest-${dataId}`);
                      if (destEl) {
                        destEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        destEl.classList.add('bg-stone-200/60');
                        setTimeout(() => destEl.classList.remove('bg-stone-200/60'), 2000);
                        return;
                      }
                    }
                    const footnotesEl = document.getElementById('manifesto-footnotes');
                    if (footnotesEl) {
                      footnotesEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }
                }}
              >
                {paragraphs.map((p, idx) => {
                  const noteKey = `mn-${idx + 1}`;
                  const noteRaw = mnData[noteKey] || '';
                  const noteParts = noteRaw.split('\n');
                  const noteLabel = noteParts[0] || '';
                  const noteContent = noteParts.slice(1).join('\n') || '';

                  return (
                    <ElasticMarginRow
                      key={idx}
                      noteLabel={noteLabel}
                      noteContent={noteContent}
                      noteIndexRoman={toRoman(idx + 1).toLowerCase()}
                    >
                      <div className="text-stone-600 text-[15px] md:text-[16px] leading-relaxed">
                        {renderManifestoParagraph(p, idx)}
                      </div>
                    </ElasticMarginRow>
                  );
                })}
              </div>

              {/* Animated Signature - Centered and positioned above footnotes */}
              <div className="pt-10 pb-4 flex justify-center">
                <AnimatedSignature />
              </div>

              {/* Footnotes */}
              {fnData.length > 0 && (
                <div id="manifesto-footnotes" className="pt-8 scroll-mt-20">
                  <div className="border-t border-stone-200/50 w-24 my-4 mx-auto" />
                  <div className="space-y-3 max-w-xl mx-auto">
                    {fnData.map((fn, idx) => (
                      <div
                        key={fn.id}
                        id={`manifesto-footnote-dest-${fn.id}`}
                        className="group flex gap-3 hover:bg-stone-50/50 p-1.5 rounded transition scroll-mt-24 duration-700"
                      >
                        <span
                          className="font-sans text-[10px] font-medium align-super text-[#802334] w-4 flex-shrink-0 select-none mr-1 cursor-pointer hover:underline hover:text-[#611522]"
                          title="Go back to citation"
                          onClick={() => {
                            const refBadge = document.querySelector(
                              `.footnote-badge[data-id="${fn.id}"]`
                            );
                            if (refBadge) {
                              refBadge.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              refBadge.classList.remove('citation-flash');
                              void (refBadge as HTMLElement).offsetWidth; // Trigger reflow
                              refBadge.classList.add('citation-flash');
                              setTimeout(() => refBadge.classList.remove('citation-flash'), 2500);
                            }
                          }}
                        >
                          ({idx + 1})
                        </span>
                        <div className="flex-grow text-left text-stone-500 text-xs">
                          {fn.label && (
                            <strong className="text-stone-750 block font-sans text-[9px] uppercase tracking-wider mb-0.5">
                              {fn.label}
                            </strong>
                          )}
                          <p className="inline font-serif text-[12px] md:text-[13px] text-stone-600 leading-relaxed">
                            {fn.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer navigation */}
            <div className="text-center pt-12 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('frontpage');
                  setSelectedEntry(null);
                }}
                className="px-6 py-2 border border-stone-200 hover:border-[#802334] text-stone-600 hover:text-[#802334] font-mono text-xs uppercase tracking-wider rounded-sm transition cursor-pointer font-semibold"
              >
                Browse the Frontpage →
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
