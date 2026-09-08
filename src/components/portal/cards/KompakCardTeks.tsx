import React from 'react';
import { safeParseInline } from '../../../utils.tsx';
import { renderDenganGlosari, type EntriGlosari } from '../../common/IstilahGlosari';

// Tajuk+huraian tier KOMPAK — unit KONGSI paling kecil dan paling selamat untuk pratonton kad
// sebenar (2026-08-08, bukti konsep pertama Pelan Pratonton Kad). Ini SATU-SATUNYA bahagian yang
// benar-benar berputar dalam CarouselStableBlock (eyebrow/sumber di luar carousel, TAK berputar —
// lihat FrontpageView.tsx slot 4/5), jadi ia unit paling tepat untuk dicabut tanpa menyentuh
// struktur carousel yang sangat fragile (CLAUDE.md). Dipanggil DUA tempat: renderItem carousel
// slot 4/5 (FrontpageView.tsx) DAN KompakCardPreview.tsx (pratonton draf, modal Tulis Kandungan).
export interface KompakCardTeksProps {
  title: string;
  brief: string;
  briefStyle?: React.CSSProperties;
  // Glosari Berasaskan Bidang pada huraian (2026-09-08) — lihat nota HeroCardTeks.tsx.
  petaGlosari?: Map<string, EntriGlosari>;
  desk?: string | null;
  onClickTajuk?: (e: React.MouseEvent) => void;
  onClickHuraian?: (e: React.MouseEvent) => void;
}

const PETA_KOSONG = new Map<string, EntriGlosari>();

export const KompakCardTeks: React.FC<KompakCardTeksProps> = ({ title, brief, briefStyle, petaGlosari, desk, onClickTajuk, onClickHuraian }) => (
  <>
    <h3
      className="font-serif text-[15px] font-medium leading-snug group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200"
      onClick={onClickTajuk}
    >
      {safeParseInline(title || '')}
    </h3>
    <p className="hidden md:block font-serif text-xs leading-relaxed font-normal mt-1" style={briefStyle} onClick={onClickHuraian}>
      {renderDenganGlosari(brief || '', petaGlosari || PETA_KOSONG, new Set(), desk, safeParseInline)}
    </p>
  </>
);

export default KompakCardTeks;
