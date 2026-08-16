import React from 'react';
import { safeParseInline } from '../../../utils.tsx';

// Tajuk+huraian tier HERO (2026-08-16, sambungan Pelan Pratonton Kad ke SEMUA tier — dahulu cuma
// KOMPAK, lihat KompakCardTeks.tsx utk corak asal/rasional). Dicabut daripada FrontpageView.tsx
// slot 0 (satu-satunya slot HERO, tiada isu ketekalan antara slot macam tier lain). Dipanggil DUA
// tempat: renderItem carousel slot 0 (FrontpageView.tsx) DAN HeroCardPreview.tsx (pratonton draf).
export interface HeroCardTeksProps {
  title: string;
  brief: string;
  briefStyle?: React.CSSProperties;
  onClickTajuk?: (e: React.MouseEvent) => void;
  onClickHuraian?: (e: React.MouseEvent) => void;
}

export const HeroCardTeks: React.FC<HeroCardTeksProps> = ({ title, brief, briefStyle, onClickTajuk, onClickHuraian }) => (
  <>
    <h3
      className="font-serif text-[16px] md:text-3xl leading-tight font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200"
      onClick={onClickTajuk}
    >
      {safeParseInline(title || '')}
    </h3>
    <p className="font-serif text-xs text-stone-100/90 leading-relaxed font-normal mt-3" style={briefStyle} onClick={onClickHuraian}>
      {safeParseInline(brief || '')}
    </p>
  </>
);

export default HeroCardTeks;
