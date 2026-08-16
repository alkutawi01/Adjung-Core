import React from 'react';
import { safeParseInline } from '../../../utils.tsx';

// Tajuk+huraian tier MENEGAK (2026-08-16, sambungan Pelan Pratonton Kad ke SEMUA tier).
//
// Ketekalan diselaraskan semasa pengekstrakan ni — audit dedah slot 1 (satu-satunya drpd 6 slot
// MENEGAK: 1, 12, 15, 26, 29, 37) berbeza drpd baki 5 dlm DUA cara: (a) bekas h3/p slot 1 guna
// `<BentoInner>` (jaring limpahan overflow SEBENAR + lencana penyedia AI automatik), 5 slot lain
// guna `<div className="space-y-4">` polos DAN tiru manual lencana AI sahaja (TANPA jaring
// limpahan — pepijat, bukan reka bentuk sengaja); (b) gaya h3/p sendiri berbeza (slot 1: teks
// mt-3 text-xs + h3 group-hover warna maroon; 5 slot lain: text-sm + h3 hover warna aksen tier,
// tiada group-hover). Diselaraskan ikut Izzat (2026-08-16): SEMUA 6 slot kini bungkus
// `<BentoInner>` (bawa jaring limpahan ke slot 1/12 yg dulu tiada), gaya teks ikut CORAK MAJORITI
// (5/6 slot) supaya rupa slot yg dah terbit paling minimum terjejas.
export interface MenegakCardTeksProps {
  title: string;
  brief: string;
  briefStyle?: React.CSSProperties;
  onClickTajuk?: (e: React.MouseEvent) => void;
  onClickHuraian?: (e: React.MouseEvent) => void;
}

export const MenegakCardTeks: React.FC<MenegakCardTeksProps> = ({ title, brief, briefStyle, onClickTajuk, onClickHuraian }) => (
  <>
    <h3
      className="font-serif text-[14px] md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors"
      onClick={onClickTajuk}
    >
      {safeParseInline(title || '')}
    </h3>
    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-normal mt-3" style={briefStyle} onClick={onClickHuraian}>
      {safeParseInline(brief || '')}
    </p>
  </>
);

export default MenegakCardTeks;
