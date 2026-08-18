import React from 'react';
import {
  BentoInner, EyebrowKad, getCardTheme, formatBentoDate, getDisplayDate,
} from '../FrontpageView';
import { HeroCardTeks } from './HeroCardTeks';

// Pratonton kad SEBENAR tier HERO (2026-08-16, sambungan Pelan Pratonton Kad — dahulu cuma
// KOMPAK, lihat KompakCardPreview.tsx utk corak/rasional asal). Slot 0 sahaja bagi tier ni, tiada
// isu ketekalan antara slot.
export interface HeroCardPreviewItem {
  title?: string;
  brief?: string;
  desk?: string;
  topik?: string;
  source?: string;
  originalDate?: string;
  publishedAt?: string;
  imageUrl?: string;
}

export interface HeroCardPreviewProps {
  item: HeroCardPreviewItem;
  bidang?: { icon: string | null; iconSvg: string | null };
}

export const HeroCardPreview: React.FC<HeroCardPreviewProps> = ({ item, bidang }) => {
  const tema = getCardTheme(item, 'transparent');
  return (
    // Bekas ringkas (padding+min-h+bayang sahaja, TIADA hover/scale/cursor) — pratonton, bukan
    // kad boleh klik. Lebar penuh (bukan max-w terhad macam KOMPAK) sebab HERO memang lebar penuh
    // di frontpage sebenar. Susun atur md:flex-row SEBENAR terletak pada className BentoInner
    // (bukan bekas luar ni) — cermin tepat struktur slot 0 sebenar (FrontpageView.tsx), bekas
    // luar sendiri kekal flex-col gap-3 sahaja.
    <div className="p-4 md:p-8 relative rounded-lg shadow-sm flex flex-col gap-3 min-h-[180px]" style={tema.cardStyle}>
      <BentoInner itemKey="pratonton-hero" className="md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-3xl">
          <div className="font-mono text-[9px] md:text-[10px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={tema.deskStyle}>
            <EyebrowKad item={item} bidang={bidang} />
          </div>
          <HeroCardTeks title={item.title || ''} brief={item.brief || ''} briefStyle={tema.briefStyle} />
        </div>
        {/* md:w-36 — lebar TETAP HERO (bukan hiasan, sama rasional StandardCardPreview.tsx),
            tercicir semasa pengekstrakan asal — pratonton overflow teks sumber panjang tanpa
            wrap, tak sepadan kad SEBENAR (FrontpageView.tsx baris 3184). */}
        <span className="font-sans text-[7px] md:text-[10px] tracking-editorial uppercase text-stone-300 border-t pt-2 md:border-t-0 md:border-l md:pt-0 border-stone-400/30 md:pl-4 flex-shrink-0 md:w-36 md:self-stretch flex flex-col justify-center gap-1" style={tema.sourceStyle}>
          <span>{item.source}</span>
          {(getDisplayDate(item.originalDate) || formatBentoDate(item.publishedAt)) && (
            <span className="opacity-70 normal-case font-mono text-[7px] md:text-[9px]">
              {getDisplayDate(item.originalDate) || formatBentoDate(item.publishedAt)}
            </span>
          )}
        </span>
      </BentoInner>
    </div>
  );
};

export default HeroCardPreview;
