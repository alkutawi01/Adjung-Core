import React from 'react';
import { safeParseInline } from '../../../utils.tsx';

interface BarCardExpandedPanelProps {
  item: any;
}

// Accordion detail panel for a BAR card — rendered as a separate element directly after the
// (unchanged) BarCard, never inside it. Surfaces item.location and item.penerangan, neither of
// which has any other display path on the compact card (see BarCard.tsx). item.penerangan was
// added to the data pipeline specifically for this panel (server.js, "disediakan untuk ciri
// akordion akan datang").
//
// safeParseInline() on penerangan (2026-09-09, bug-hunt follow-up to #135/#136/#137) —
// BarSlotManagerModal.tsx's Field component wires the SAME Ctrl/Cmd+I italic shortcut
// (tanganiKekunciItalic) to the Penerangan textarea as every other editorial text field
// (Tajuk/Huraian in SlotManagerModal.tsx), so an editor pressing Ctrl+I there produces the
// exact same `*teks*` literal asterisks the rest of the app renders as <em>. This panel used
// to print item.penerangan as a raw string with zero formatting/gloss/typography processing,
// so those asterisks (and any bold/glossary markup) showed up verbatim to readers instead of
// being rendered — the input affordance promised formatting the output never honoured.
// safeParseInline() is the single shared renderer every other kad/Focus View text already
// goes through (bold/italic/autocondong/pemenggalan, plus the gloss-authoring kill-switch
// strip that closed #137) — wiring it here brings Penerangan in line with that contract
// instead of leaving it as the one text field with an input path but no output path.
export const BarCardExpandedPanel: React.FC<BarCardExpandedPanelProps> = ({ item }) => {
  if (!item) return null;

  const hasLocation = !!(item.location && item.location.toString().trim());
  const hasPenerangan = !!(item.penerangan && item.penerangan.toString().trim());
  const hasUrl = !!(item.url && item.url !== '#');

  return (
    <div className="p-3.5 rounded-lg border border-stone-200 bg-white shadow-sm">
      {hasLocation && (
        <div className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold mb-2">
          Lokasi: <span className="text-stone-600 normal-case tracking-normal font-normal">{item.location}</span>
        </div>
      )}
      {/* Fon lebih kecil drpd tajuk kad Bar (BarCard.tsx: text-[10px] md:text-sm) — permintaan
          pemilik projek 2026-08-05, panel akordion patut jelas anak kepada tajuk, bukan sebaris
          besarnya. */}
      {hasPenerangan ? (
        <p className="font-serif text-[9px] md:text-xs text-stone-700 leading-relaxed whitespace-pre-line">
          {safeParseInline(item.penerangan)}
        </p>
      ) : (
        <p className="font-serif text-[9px] md:text-xs text-stone-400 italic">Tiada perincian tambahan.</p>
      )}
      {hasUrl && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 inline-block font-mono text-[9px] uppercase tracking-widest text-[#802334] font-bold hover:underline"
        >
          Baca Lanjut &rarr;
        </a>
      )}
    </div>
  );
};
