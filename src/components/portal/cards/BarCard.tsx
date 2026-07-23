import React from 'react';
import { getDeskAccentColor } from '../../../utils';

interface BarCardProps {
  item: any;
  onClick: () => void;
  isEditMode?: boolean;
  onEditClick?: (e: React.MouseEvent) => void;
}

export const BarCard: React.FC<BarCardProps> = ({ item, onClick, isEditMode, onEditClick }) => {
  if (!item) return null;

  const accentColor = item.categoryColor || getDeskAccentColor(item.desk || item.category);

  return (
    <div
      onClick={onClick}
      className="group relative bg-white border border-stone-200 rounded-lg p-3.5 hover:shadow-md transition-all duration-300 cursor-pointer flex items-center justify-between gap-4 w-full overflow-hidden"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span
          className="font-mono text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-stone-50 border border-stone-150 shrink-0"
          style={{ color: accentColor }}
        >
          {item.desk || item.category || 'KAD BAR'}
        </span>
        <h4 className="font-serif text-sm text-stone-900 leading-snug font-medium truncate group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200">
          {item.title}
        </h4>
      </div>

      <div className="flex items-center gap-3 shrink-0 select-none">
        <span className="font-mono text-[9px] text-stone-400">
          {item.source || 'ADJUNG'}
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
