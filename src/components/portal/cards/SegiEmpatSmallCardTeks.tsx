import React from 'react';
import { safeParseInline } from '../../../utils.tsx';

// Tajuk+huraian tier SEGI_EMPAT_SMALL (2026-08-16, sambungan Pelan Pratonton Kad ke SEMUA tier).
//
// Ketekalan diselaraskan semasa pengekstrakan ni — audit dedah slot 3/11 (h3 group-hover warna
// maroon TETAP, TANPA `<BentoInner>` bagi slot 11) berbeza drpd 16/25/30/35 (h3 hover warna aksen
// #F5EBE6, tiada group-hover) DAN slot 36 (skema warna kelabu berasingan sepenuhnya — eyebrow
// #D6D3D1, h3 hover stone-300, brief text-stone-300/90, sumber text-stone-400 — nampak SENGAJA
// bukan pepijat, kekal berasingan, tak diselaraskan). Diselaraskan ikut Izzat (2026-08-16): SEMUA
// 7 slot kini bungkus `<BentoInner>`; warna aksen (`hoverClassName`/`briefClassName`) diterima
// sebagai STRING KELAS Tailwind PENUH supaya kekal literal utk imbasan JIT (sama rasional
// SegiEmpatMediumCardTeks.tsx) — pemanggil (FrontpageView.tsx) hantar warna SEBENAR ikut slot.
export interface SegiEmpatSmallCardTeksProps {
  title: string;
  brief: string;
  briefStyle?: React.CSSProperties;
  hoverClassName: string;
  briefClassName?: string;
  onClickTajuk?: (e: React.MouseEvent) => void;
  onClickHuraian?: (e: React.MouseEvent) => void;
}

export const SegiEmpatSmallCardTeks: React.FC<SegiEmpatSmallCardTeksProps> = ({
  title, brief, briefStyle, hoverClassName, briefClassName = 'text-stone-200/90', onClickTajuk, onClickHuraian,
}) => (
  <>
    <h3
      className={`font-serif text-[14px] md:text-lg leading-snug font-medium transition-colors ${hoverClassName}`}
      onClick={onClickTajuk}
    >
      {safeParseInline(title || '')}
    </h3>
    <p className={`font-serif text-xs ${briefClassName} leading-relaxed font-normal mt-2`} style={briefStyle} onClick={onClickHuraian}>
      {safeParseInline(brief || '')}
    </p>
  </>
);

export default SegiEmpatSmallCardTeks;
