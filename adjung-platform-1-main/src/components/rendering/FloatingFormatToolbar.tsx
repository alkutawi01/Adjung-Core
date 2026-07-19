import React from 'react';

interface FloatingFormatToolbarProps {
  selectionState: {
    show: boolean;
    x: number;
    y: number;
  } | null;
  showLinkInput: boolean;
  setShowLinkInput: (show: boolean) => void;
  linkUrl: string;
  setLinkUrl: (url: string) => void;
  showGlossInput: boolean;
  setShowGlossInput: (show: boolean) => void;
  glossText: string;
  setGlossText: (text: string) => void;
  applyBold: () => void;
  applyItalic: () => void;
  applyUnderline: () => void;
  applyLink: (url: string) => void;
  applyInterlinear: (text: string) => void;
  applyFootnote: () => void;
}

export const FloatingFormatToolbar: React.FC<FloatingFormatToolbarProps> = ({
  selectionState,
  showLinkInput,
  setShowLinkInput,
  linkUrl,
  setLinkUrl,
  showGlossInput,
  setShowGlossInput,
  glossText,
  setGlossText,
  applyBold,
  applyItalic,
  applyUnderline,
  applyLink,
  applyInterlinear,
  applyFootnote,
}) => {
  if (!selectionState || !selectionState.show) return null;

  return (
    <div 
      style={{ left: `${selectionState.x}px`, top: `${selectionState.y}px` }}
      className="absolute z-50 transform -translate-x-1/2 flex items-center gap-1 bg-[#1e1c18]/90 backdrop-blur-sm border border-stone-800/45 px-2.5 py-1.5 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.3)] text-stone-100 animate-fade-in text-[11px] transition-all font-sans"
    >
      {!showLinkInput && !showGlossInput ? (
        <>
          <button
            type="button"
            onClick={applyBold}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-800 text-stone-100 font-bold transition cursor-pointer font-sans"
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            onClick={applyItalic}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-800 text-stone-100 italic transition cursor-pointer font-sans"
            title="Italic"
          >
            I
          </button>
          <button
            type="button"
            onClick={applyUnderline}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-800 text-stone-100 underline transition cursor-pointer font-sans"
            title="Underline"
          >
            U
          </button>
          <span className="w-px h-4 bg-stone-800 mx-1" />
          <button
            type="button"
            onClick={() => setShowLinkInput(true)}
            className="px-2 h-7 flex items-center justify-center rounded-full hover:bg-stone-800 text-stone-100 font-sans text-[10px] uppercase tracking-wider font-semibold transition cursor-pointer"
            title="Insert Link"
          >
            Link
          </button>
          <button
            type="button"
            onClick={() => setShowGlossInput(true)}
            className="px-2 h-7 flex items-center justify-center rounded-full hover:bg-stone-800 text-stone-100 font-sans text-[10px] uppercase tracking-wider font-semibold transition cursor-pointer"
            title="Insert Interlinear Note (Gloss)"
          >
            Gloss
          </button>
          <button
            type="button"
            onClick={applyFootnote}
            className="px-2 h-7 flex items-center justify-center rounded-full hover:bg-stone-800 text-stone-100 font-sans text-[10px] uppercase tracking-wider font-semibold transition cursor-pointer"
            title="Insert Footnote (Auto Number)"
          >
            FN
          </button>
        </>
      ) : showLinkInput ? (
        <div className="flex items-center gap-1.5 px-1 font-sans">
          <input
            type="text"
            placeholder="URL (https://...)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="bg-stone-900 border border-stone-800 px-2 py-0.5 rounded text-[10px] text-stone-200 focus:outline-none focus:border-Adjung-maroon w-36 font-sans"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyLink(linkUrl);
              }
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={() => applyLink(linkUrl)}
            className="px-2 py-0.5 bg-[#802334] text-white text-[10px] rounded uppercase font-sans tracking-wider font-semibold transition cursor-pointer"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLinkInput(false);
              setLinkUrl('');
            }}
            className="text-stone-400 hover:text-stone-200 text-xs px-1 font-sans"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-1 font-sans">
          <input
            type="text"
            placeholder="Gloss word/translation..."
            value={glossText}
            onChange={(e) => setGlossText(e.target.value)}
            className="bg-stone-900 border border-stone-800 px-2 py-0.5 rounded text-[10px] text-stone-200 focus:outline-none focus:border-Adjung-maroon w-36 font-sans"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyInterlinear(glossText);
              }
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={() => applyInterlinear(glossText)}
            className="px-2 py-0.5 bg-[#802334] text-white text-[10px] rounded uppercase font-sans tracking-wider font-semibold transition cursor-pointer"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setShowGlossInput(false);
              setGlossText('');
            }}
            className="text-stone-400 hover:text-stone-200 text-xs px-1 font-sans"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
export default FloatingFormatToolbar;
