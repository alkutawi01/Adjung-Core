import React from 'react';
import { safeParseInline } from '../../../utils.tsx';

// Tajuk+huraian tier STANDARD (2026-08-16, sambungan Pelan Pratonton Kad ke SEMUA tier).
//
// Ketekalan diselaraskan semasa pengekstrakan ni — audit dedah 6 slot STANDARD (2, 6, 19, 20, 33,
// 34) berselerak dlm TIGA cara berbeza: (a) hanya slot 2 guna `<BentoInner>` (jaring limpahan
// overflow + lencana AI automatik), 5 lain guna `<div className="flex-1">` polos + tiru lencana AI
// manual (TANPA jaring limpahan); (b) h3 slot 2/6 guna group-hover warna maroon, slot 19/20/33/34
// guna hover warna aksen tier (#E9D8A6) tanpa group-hover; (c) p brief slot 2/20 guna text-xs,
// slot 6/19/33/34 guna text-sm. Diselaraskan ikut Izzat (2026-08-16): SEMUA 6 slot kini bungkus
// `<BentoInner>`, gaya teks ikut CORAK MAJORITI SEBENAR (19/33/34, corak paling kerap berulang)
// supaya rupa slot yg dah terbit paling minimum terjejas.
export interface StandardCardTeksProps {
  title: string;
  brief: string;
  briefStyle?: React.CSSProperties;
  onClickTajuk?: (e: React.MouseEvent) => void;
  onClickHuraian?: (e: React.MouseEvent) => void;
}

export const StandardCardTeks: React.FC<StandardCardTeksProps> = ({ title, brief, briefStyle, onClickTajuk, onClickHuraian }) => (
  <>
    <h3
      className="font-serif text-[15px] md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors mt-2"
      onClick={onClickTajuk}
    >
      {safeParseInline(title || '')}
    </h3>
    <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-normal mt-2" style={briefStyle} onClick={onClickHuraian}>
      {safeParseInline(brief || '')}
    </p>
  </>
);

export default StandardCardTeks;
