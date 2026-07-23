import React from 'react';
import { getDeskAccentColor } from '../../../utils';

interface HeroCardProps {
  item: any;
  onClick: () => void;
  isEditMode?: boolean;
  onEditClick?: (e: React.MouseEvent) => void;
}

export const HeroCard: React.FC<HeroCardProps> = ({ item, onClick, isEditMode, onEditClick }) => {
  if (!item) return null;

  const accentColor = item.categoryColor || getDeskAccentColor(item.desk || item.category);

  return (
    <div
      onClick={onClick}
      className="group relative bg-white border border-stone-200 rounded-xl p-6 md:p-8 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between h-full min-h-[380px] overflow-hidden"
    >
      {/* Top Header: Desk Badge & Date */}
      <div className="flex items-center justify-between gap-4 mb-4 select-none">
        <span
          className="font-mono text-xs uppercase tracking-widest font-extrabold px-2.5 py-1 rounded bg-stone-50 border border-stone-100 shadow-2xs"
          style={{ color: accentColor }}
        >
          {item.desk || item.category || 'UMUM'}
        </span>
        <span className="font-mono text-[10px] text-stone-400 tracking-wider">
          {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '21.07.26'}
        </span>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4 my-auto">
        <h2 className="font-serif text-2xl md:text-4xl text-stone-900 leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200">
          {item.title}
        </h2>
        {item.summary && (
          <p className="font-serif text-sm md:text-base text-stone-600 leading-relaxed max-w-2xl font-light line-clamp-3">
            {item.summary}
          </p>
        )}
      </div>

      {/* Footer: Source Line & Edit Button */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-stone-150 select-none">
        <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400">
          {item.source || 'ADJUNG EDITORIAL'} {item.publishedAt ? `• ${new Date(item.publishedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
        </span>
        {isEditMode && onEditClick && (
          <button
            type="button"
            onClick={onEditClick}
            className="px-2.5 py-1 text-[10px] font-mono uppercase bg-stone-100 hover:bg-[#802334] hover:text-white rounded transition-colors text-stone-600"
          >
            Sunting Slot 0
          </button>
        )}
      </div>
    </div>
  );
};
