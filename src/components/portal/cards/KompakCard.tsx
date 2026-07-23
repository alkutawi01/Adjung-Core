import React from 'react';
import { getDeskAccentColor } from '../../../utils';

interface KompakCardProps {
  item: any;
  onClick: () => void;
  isEditMode?: boolean;
  onEditClick?: (e: React.MouseEvent) => void;
}

export const KompakCard: React.FC<KompakCardProps> = ({ item, onClick, isEditMode, onEditClick }) => {
  if (!item) return null;

  const accentColor = item.categoryColor || getDeskAccentColor(item.desk || item.category);

  return (
    <div
      onClick={onClick}
      className="group relative bg-white border border-stone-200 rounded-lg p-4 hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between h-full min-h-[160px] overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 mb-2 select-none">
        <span
          className="font-mono text-[10px] uppercase tracking-widest font-extrabold px-2 py-0.5 rounded bg-stone-50 border border-stone-100"
          style={{ color: accentColor }}
        >
          {item.desk || item.category || 'KOMPAK'}
        </span>
        <span className="font-mono text-[9px] text-stone-400">
          {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '21.07.26'}
        </span>
      </div>

      <div className="my-auto space-y-1.5">
        <h3 className="font-serif text-sm md:text-base text-stone-900 leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200 line-clamp-2">
          {item.title}
        </h3>
        {item.summary && (
          <p className="font-serif text-xs text-stone-500 leading-relaxed font-light line-clamp-2">
            {item.summary}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-stone-100 select-none">
        <span className="font-mono text-[8px] uppercase tracking-widest text-stone-400 truncate max-w-[70%]">
          {item.source || 'ADJUNG'}
        </span>
        {isEditMode && onEditClick && (
          <button
            type="button"
            onClick={onEditClick}
            className="px-2 py-0.5 text-[8px] font-mono uppercase bg-stone-100 hover:bg-[#802334] hover:text-white rounded transition-colors text-stone-600 shrink-0"
          >
            Sunting
          </button>
        )}
      </div>
    </div>
  );
};
