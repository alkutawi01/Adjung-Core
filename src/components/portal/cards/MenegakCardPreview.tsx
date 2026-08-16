import React from 'react';
import {
  BentoInner, EyebrowKad, getCardTheme, formatBentoDate, getDisplayDate,
} from '../FrontpageView';
import { MenegakCardTeks } from './MenegakCardTeks';

// Pratonton kad SEBENAR tier MENEGAK (2026-08-16, sambungan Pelan Pratonton Kad — dahulu cuma
// KOMPAK, lihat KompakCardPreview.tsx utk corak/rasional asal). Corak sekarang SATU sahaja bagi
// keenam-enam slot (1, 12, 15, 26, 29, 37) — diselaraskan semasa pengekstrakan ni (lihat
// MenegakCardTeks.tsx utk nota ketekalan).
export interface MenegakCardPreviewItem {
  title?: string;
  brief?: string;
  desk?: string;
  topik?: string;
  source?: string;
  originalDate?: string;
  publishedAt?: string;
  imageUrl?: string;
}

export interface MenegakCardPreviewProps {
  item: MenegakCardPreviewItem;
  bidang?: { icon: string | null; iconSvg: string | null };
}

export const MenegakCardPreview: React.FC<MenegakCardPreviewProps> = ({ item, bidang }) => {
  const tema = getCardTheme(item, 'transparent');
  return (
    <div className="p-4 md:p-6 relative rounded-lg shadow-sm flex flex-col gap-3 min-h-[380px] max-w-[280px]" style={tema.cardStyle}>
      <BentoInner itemKey="pratonton-menegak" className="gap-3">
        <div className="space-y-4">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={tema.deskStyle}>
            <EyebrowKad item={item} bidang={bidang} />
          </div>
          <MenegakCardTeks title={item.title || ''} brief={item.brief || ''} briefStyle={tema.briefStyle} />
        </div>
        <span className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={tema.sourceStyle}>
          <span>{item.source}</span>
          {(getDisplayDate(item.originalDate) || formatBentoDate(item.publishedAt)) && (
            <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">
              {getDisplayDate(item.originalDate) || formatBentoDate(item.publishedAt)}
            </span>
          )}
        </span>
      </BentoInner>
    </div>
  );
};

export default MenegakCardPreview;
