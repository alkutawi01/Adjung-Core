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

  const organizerLabel = extractOrganizerLabel(item);
  const eventDate = (item.originalDate || item.date || item.publishedAt || '').toString().trim().toUpperCase();

  return (
    <div
      onClick={onClick}
      className={`group relative bg-[#802334] border border-amber-300/40 rounded-lg p-3 sm:px-3.5 sm:py-2.5 hover:brightness-110 transition-all duration-200 cursor-pointer flex flex-col justify-start gap-1.5 min-h-[84px] w-full overflow-hidden shadow-sm ${
        isEditMode ? 'ring-2 ring-dashed ring-amber-300 cursor-pointer' : ''
      }`}
    >
      {/* Top Row: Tarikh (Kiri) & Akronim Penganjur (Kanan) */}
      <div className="flex items-center justify-between gap-2 w-full">
        {eventDate ? (
          <span className="font-mono text-[8px] sm:text-[9px] uppercase font-bold text-amber-100/90 tracking-wider truncate max-w-[60%] select-none">
            {eventDate}
          </span>
        ) : <span />}
        <span className="font-mono text-[9px] uppercase tracking-widest font-bold text-[#E9D8A6] truncate max-w-[40%] text-right shrink-0">
          {organizerLabel}
        </span>
      </div>

      {/* Main Row: Tajuk Acara (Bawah) */}
      <h4 className="font-serif text-xs sm:text-sm text-white leading-snug font-medium line-clamp-2 group-hover:text-[#E9D8A6] transition-colors duration-200 mt-1">
        {item.title}
      </h4>
    </div>
  );
};
