import React from 'react';
import { extractOrganizerAcronym } from '../../../../core/editorial/EventDateValidator.js';

interface BarCardProps {
  item: any;
  onClick: () => void;
  isEditMode?: boolean;
  onEditClick?: (e: React.MouseEvent) => void;
}

export function extractOrganizerLabel(item: any): string {
  return extractOrganizerAcronym(item);
}

// Extract access badge e.g. "Terbuka" / "Tertutup"
export function extractAccessBadge(item: any): { label: string; isTerbuka: boolean } {
  const accessText = (item.access || item.manualAccess || item.akses || 'Terbuka').toString().toLowerCase();
  const isTertutup = accessText.includes('tertutup') || accessText.includes('closed');
  return {
    label: isTertutup ? 'TERTUTUP' : 'TERBUKA',
    isTerbuka: !isTertutup,
  };
}

export const BarCard: React.FC<BarCardProps> = ({ item, onClick, isEditMode, onEditClick }) => {
  if (!item) return null;

  const eventDate = (item.originalDate || item.date || item.publishedAt || '').toString().trim().toUpperCase();
  // Peraturan Khas Slot Bar: kiri atas ialah Tarikh acara; jika tiada, jatuh balik ke nama desk
  // (bukan kosong) supaya baris atas tak pernah nampak "hilang" sebuah medan.
  const dateOrDeskLabel = eventDate || (item.desk || 'ADJUNG EDITORIAL').toString().toUpperCase();

  // Peraturan Khas Slot Bar: lencana kanan atas ialah Penganjur SAHAJA bila medan Penganjur diisi
  // terus (item.organizer mentah, bukan hasil rekaan extractOrganizerAcronym daripada desk/sumber
  // lain) — jika tidak, jatuh balik ke lencana status Akses (Terbuka/Tertutup).
  const hasOrganizer = !!(item.organizer && item.organizer.toString().trim());
  const organizerLabel = hasOrganizer ? extractOrganizerLabel(item) : '';
  const accessBadge = extractAccessBadge(item);

  return (
    <div
      onClick={onClick}
      className={`group relative bg-[#802334] border border-amber-300/40 rounded-lg p-3 sm:px-3.5 sm:py-2.5 hover:brightness-110 transition-all duration-200 cursor-pointer flex flex-col justify-start gap-1.5 min-h-[84px] w-full overflow-hidden shadow-sm ${
        isEditMode ? 'ring-2 ring-dashed ring-amber-300 cursor-pointer' : ''
      }`}
    >
      {/* Top Row: Tarikh/Desk (Kiri) & Lencana Penganjur atau Akses (Kanan) */}
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="font-mono text-[8px] sm:text-[9px] uppercase font-bold text-amber-100/90 tracking-wider truncate max-w-[60%] select-none">
          {dateOrDeskLabel}
        </span>
        {hasOrganizer ? (
          <span className="font-mono text-[8px] uppercase tracking-widest font-extrabold bg-white/15 text-white border border-white/30 rounded px-1.5 py-0.5 truncate max-w-[40%] text-right shrink-0">
            {organizerLabel}
          </span>
        ) : (
          <span className={`font-mono text-[8px] uppercase tracking-widest font-extrabold rounded px-1.5 py-0.5 truncate max-w-[40%] text-right shrink-0 ${
            accessBadge.isTerbuka
              ? 'bg-amber-400/20 text-amber-300 border border-amber-300/30'
              : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
          }`}>
            {accessBadge.label}
          </span>
        )}
      </div>

      {/* Main Row: Tajuk Acara (Bawah) */}
      <h4 className="font-serif text-xs sm:text-sm text-white leading-snug font-medium line-clamp-2 group-hover:text-[#E9D8A6] transition-colors duration-200 mt-1">
        {item.title}
      </h4>
    </div>
  );
};
