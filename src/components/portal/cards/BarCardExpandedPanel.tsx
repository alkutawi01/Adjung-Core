import React from 'react';

interface BarCardExpandedPanelProps {
  item: any;
}

// Accordion detail panel for a BAR card -- rendered as a separate element directly after the
// (unchanged) BarCard, never inside it. Surfaces item.location and item.penerangan, neither of
// which has any other display path on the compact card (see BarCard.tsx). item.penerangan was
// added to the data pipeline specifically for this panel (server.js, "disediakan untuk ciri
// akordion akan datang").
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
      {hasPenerangan ? (
        <p className="font-serif text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line">
          {item.penerangan}
        </p>
      ) : (
        <p className="font-serif text-xs sm:text-sm text-stone-400 italic">Tiada perincian tambahan.</p>
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
