import React from 'react';
import {
  BentoInner, EyebrowKad, getCardTheme, formatBentoDate, getDisplayDate,
} from '../FrontpageView';
import { SegiEmpatSmallCardTeks } from './SegiEmpatSmallCardTeks';

// Pratonton kad SEBENAR tier SEGI_EMPAT_SMALL (2026-08-16, sambungan Pelan Pratonton Kad — dahulu
// cuma KOMPAK, lihat KompakCardPreview.tsx utk corak/rasional asal). 6 daripada 7 slot (3, 11, 16,
// 25, 30, 35) guna aksen #F5EBE6 sama; slot 36 SENGAJA guna skema kelabu berasingan (lihat
// SegiEmpatSmallCardTeks.tsx) — pemanggil (modal Tulis Kandungan) tentukan `aksen` ikut
// slotIndex, lihat SlotManagerModal.tsx.
export interface SegiEmpatSmallCardPreviewItem {
  title?: string;
  brief?: string;
  desk?: string;
  topik?: string;
  source?: string;
  originalDate?: string;
  publishedAt?: string;
  imageUrl?: string;
}

export interface SegiEmpatSmallCardPreviewProps {
  item: SegiEmpatSmallCardPreviewItem;
  bidang?: { icon: string | null; iconSvg: string | null };
  /** 'krem' -> #F5EBE6 (slot 3/11/16/25/30/35), 'kelabu' -> skema kelabu berasingan (slot 36
   *  sahaja) — padan warna SEBENAR kedudukan slot tu di FrontpageView.tsx, bukan agak. */
  aksen: 'krem' | 'kelabu';
}

const WARNA_AKSEN: Record<'krem' | 'kelabu', { deskClassName: string; hoverClassName: string; briefClassName: string; sourceClassName: string }> = {
  krem: { deskClassName: 'text-[#F5EBE6]', hoverClassName: 'hover:text-[#F5EBE6]', briefClassName: 'text-stone-200/90', sourceClassName: 'text-stone-300/90' },
  kelabu: { deskClassName: 'text-[#D6D3D1]', hoverClassName: 'hover:text-stone-300', briefClassName: 'text-stone-300/90', sourceClassName: 'text-stone-400' },
};

export const SegiEmpatSmallCardPreview: React.FC<SegiEmpatSmallCardPreviewProps> = ({ item, bidang, aksen }) => {
  const tema = getCardTheme(item, 'transparent');
  const { deskClassName, hoverClassName, briefClassName, sourceClassName } = WARNA_AKSEN[aksen];
  return (
    <div className="p-4 md:p-6 relative rounded-lg shadow-sm flex flex-col gap-3 min-h-[180px] max-w-[280px]" style={tema.cardStyle}>
      <BentoInner itemKey="pratonton-segi-empat-small" className="gap-3">
        <div>
          <div className={`font-mono text-[9px] uppercase tracking-widest font-bold mb-2 ${deskClassName}`} style={tema.deskStyle}>
            <EyebrowKad item={item} bidang={bidang} />
          </div>
          <SegiEmpatSmallCardTeks title={item.title || ''} brief={item.brief || ''} briefStyle={tema.briefStyle} hoverClassName={hoverClassName} briefClassName={briefClassName} />
        </div>
        <span className={`font-sans text-[7px] md:text-[9px] tracking-editorial uppercase ${sourceClassName} pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto`} style={tema.sourceStyle}>
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

export default SegiEmpatSmallCardPreview;
