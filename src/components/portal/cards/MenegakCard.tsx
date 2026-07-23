import React from 'react';
import { getDeskAccentColor } from '../../../utils';

interface MenegakCardProps {
  item: any;
  onClick: () => void;
  isEditMode?: boolean;
  onEditClick?: (e: React.MouseEvent) => void;
}

export const MenegakCard: React.FC<MenegakCardProps> = ({ item, onClick, isEditMode, onEditClick }) => {
  if (!item) return null;

  const accentColor = item.categoryColor || getDeskAccentColor(item.desk || item.category);

  return (
    <div
      onClick={onClick}
      className="group relative bg-white border border-stone-200 rounded-xl p-5 md:p-6 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between h-full min-h-[320px] overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 mb-3 select-none">
        <span
          className="font-mono text-xs uppercase tracking-widest font-extrabold px-2.5 py-0.5 rounded bg-stone-50 border border-stone-100"
          style={{ color: accentColor }}
        >
          {item.desk || item.category || 'MENEGAK'}
        </span>
        <span className="font-mono text-[9px] text-stone-400">
          {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '21.07.26'}
        </span>
      </div>

      <div className="space-y-3 my-auto">
        <h3 className="font-serif text-xl md:text-2xl text-stone-900 leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200 line-clamp-3">
          {item.title}
        </h3>
        {item.summary && (
          <p className="font-serif text-xs md:text-sm text-stone-600 leading-relaxed font-light line-clamp-4">
            {item.summary}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 mt-3 border-t border-stone-150 select-none">
        <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400">
          {item.source || 'ADJUNG'} {item.publishedAt ? `• ${new Date(item.publishedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
        </span>
        {isEditMode && onEditClick && (
          <button
            type="button"
            onClick={onEditClick}
            className="px-2 py-0.5 text-[9px] font-mono uppercase bg-stone-100 hover:bg-[#802334] hover:text-white rounded transition-colors text-stone-600"
          >
            Sunting
          </button>
        )}
      </div>
    </div>
  );
};
