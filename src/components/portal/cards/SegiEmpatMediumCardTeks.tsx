import React from 'react';
import { safeParseInline } from '../../../utils.tsx';

// Tajuk+huraian tier SEGI_EMPAT_MEDIUM (2026-08-16, sambungan Pelan Pratonton Kad ke SEMUA tier).
//
// Ketekalan diselaraskan semasa pengekstrakan ni — audit dedah slot 13/14 (pasangan PERTAMA)
// guna h3 group-hover warna maroon TETAP, manakala slot 27/28 (pasangan KEDUA) guna h3 hover
// warna AKSEN sendiri (padan warna eyebrow slot tu — #E9D8A6 utk kiri, #F5EBE6 utk kanan) TANPA
// group-hover. Diselaraskan ikut Izzat (2026-08-16) ikut corak `hover:text-[aksen]` (SAMA arah
// keputusan MENEGAK/StandardCardTeks) — warna aksen kekal per-slot (padan eyebrow), jadi
// `hoverClassName` diterima sebagai STRING KELAS Tailwind PENUH (cth. "hover:text-[#E9D8A6]"),
// bukan hex mentah — Tailwind JIT imbas fail SUMBER cari corak kelas literal, JIKA dihantar
// sebagai hex mentah lalu digubah runtime jadi style inline, imbasan JIT takkan jumpa corak tu
// langsung, kelas tak pernah dijana dalam CSS terkompil (rosak senyap, tiada ralat build).
// Menghantar `hoverClassName` sebagai literal string di tapak panggilan (FrontpageView.tsx)
// kekal boleh diimbas kerana JIT hanya regex teks fail, tak kisah literal tu di dalam prop atau
// className terus.
export interface SegiEmpatMediumCardTeksProps {
  title: string;
  brief: string;
  briefStyle?: React.CSSProperties;
  hoverClassName: string;
  onClickTajuk?: (e: React.MouseEvent) => void;
  onClickHuraian?: (e: React.MouseEvent) => void;
}

export const SegiEmpatMediumCardTeks: React.FC<SegiEmpatMediumCardTeksProps> = ({ title, brief, briefStyle, hoverClassName, onClickTajuk, onClickHuraian }) => (
  <>
    <h3
      className={`font-serif text-[14px] md:text-xl leading-snug font-medium transition-colors ${hoverClassName}`}
      onClick={onClickTajuk}
    >
      {safeParseInline(title || '')}
    </h3>
    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={briefStyle} onClick={onClickHuraian}>
      {safeParseInline(brief || '')}
    </p>
  </>
);

export default SegiEmpatMediumCardTeks;
