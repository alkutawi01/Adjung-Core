import React from 'react';
import { safeParseInline } from '../../../utils.tsx';
import { renderDenganGlosari, type EntriGlosari } from '../../common/IstilahGlosari';

// Tajuk+huraian tier HERO (2026-08-16, sambungan Pelan Pratonton Kad ke SEMUA tier — dahulu cuma
// KOMPAK, lihat KompakCardTeks.tsx utk corak asal/rasional). Dicabut daripada FrontpageView.tsx
// slot 0 (satu-satunya slot HERO, tiada isu ketekalan antara slot macam tier lain). Dipanggil DUA
// tempat: renderItem carousel slot 0 (FrontpageView.tsx) DAN HeroCardPreview.tsx (pratonton draf).
//
// Glosari Berasaskan Bidang pada huraian kad (2026-09-08, permintaan Izzat: "ya, bina sekarang")
// — dahulu tooltip glosari cuma sampai ke huraian PANJANG di FocusView.tsx (artikel penuh),
// huraian PENDEK di kad bento (SATU-SATUNYA tempat huraian dipaparkan di frontpage) tak pernah
// disambungkan. `petaGlosari`/`desk` PILIHAN (jatuh balik peta kosong + tiada Bidang) supaya
// pratonton draf (Preview.tsx, belum ada Bidang tersimpan/peta dimuat) kekal selamat.
export interface HeroCardTeksProps {
  title: string;
  brief: string;
  briefStyle?: React.CSSProperties;
  petaGlosari?: Map<string, EntriGlosari>;
  desk?: string | null;
  onClickTajuk?: (e: React.MouseEvent) => void;
  onClickHuraian?: (e: React.MouseEvent) => void;
}

const PETA_KOSONG = new Map<string, EntriGlosari>();

export const HeroCardTeks: React.FC<HeroCardTeksProps> = ({ title, brief, briefStyle, petaGlosari, desk, onClickTajuk, onClickHuraian }) => (
  <>
    <h3
      className="font-serif text-[16px] md:text-3xl leading-tight font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200"
      onClick={onClickTajuk}
    >
      {safeParseInline(title || '')}
    </h3>
    <p className="font-serif text-xs text-stone-100/90 leading-relaxed font-normal mt-3" style={briefStyle} onClick={onClickHuraian}>
      {renderDenganGlosari(brief || '', petaGlosari || PETA_KOSONG, new Set(), desk, safeParseInline)}
    </p>
  </>
);

export default HeroCardTeks;
