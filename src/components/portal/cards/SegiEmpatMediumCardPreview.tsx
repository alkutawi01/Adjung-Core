import React from 'react';
import {
  BentoInner, EyebrowKad, getCardTheme, formatBentoDate, getDisplayDate,
} from '../FrontpageView';
import { SegiEmpatMediumCardTeks } from './SegiEmpatMediumCardTeks';

// Pratonton kad SEBENAR tier SEGI_EMPAT_MEDIUM (2026-08-16, sambungan Pelan Pratonton Kad —
// dahulu cuma KOMPAK, lihat KompakCardPreview.tsx utk corak/rasional asal). Tier ni sentiasa
// berpasangan (13/14, 27/28) dgn warna aksen BERBEZA ikut kedudukan kiri/kanan — pemanggil (modal
// Tulis Kandungan) tentukan `aksen` ikut slotIndex genap/ganjil (lihat SlotManagerModal.tsx).
export interface SegiEmpatMediumCardPreviewItem {
  title?: string;
  brief?: string;
  desk?: string;
  topik?: string;
  source?: string;
  originalDate?: string;
  publishedAt?: string;
  imageUrl?: string;
}

export interface SegiEmpatMediumCardPreviewProps {
  item: SegiEmpatMediumCardPreviewItem;
  bidang?: { icon: string | null; iconSvg: string | null };
  /** 'kiri' -> #E9D8A6 (slot 13/27), 'kanan' -> #F5EBE6 (slot 14/28) — padan warna eyebrow ASAL
   *  kedudukan slot tu di FrontpageView.tsx, bukan agak. */
  aksen: 'kiri' | 'kanan';
}

// Kelas Tailwind LITERAL (bukan gubah runtime) — cermin tepat class asal FrontpageView.tsx
// (`text-[#E9D8A6]`/`text-[#F5EBE6]` pada eyebrow), supaya lapisan `style={deskStyle}` di atasnya
// berkelakuan SAMA seperti sedia ada (jika getCardTheme() tetapkan `color` sendiri, ia menang
// atas kelas ni — sama seperti render sebenar — bukan kita paksa override di sini).
const WARNA_AKSEN: Record<'kiri' | 'kanan', { deskClassName: string; hoverClassName: string }> = {
  kiri: { deskClassName: 'text-[#E9D8A6]', hoverClassName: 'hover:text-[#E9D8A6]' },
  kanan: { deskClassName: 'text-[#F5EBE6]', hoverClassName: 'hover:text-[#F5EBE6]' },
};

export const SegiEmpatMediumCardPreview: React.FC<SegiEmpatMediumCardPreviewProps> = ({ item, bidang, aksen }) => {
  const tema = getCardTheme(item, 'transparent');
  const { deskClassName, hoverClassName } = WARNA_AKSEN[aksen];
  return (
    <div className="p-4 md:p-6 relative rounded-lg shadow-sm flex flex-col gap-3 min-h-[180px] max-w-[420px]" style={tema.cardStyle}>
      <BentoInner itemKey="pratonton-segi-empat-medium" className="gap-3">
        <div className="space-y-2">
          <div className={`font-mono text-[9px] uppercase tracking-widest font-bold ${deskClassName}`} style={tema.deskStyle}>
            <EyebrowKad item={item} bidang={bidang} />
          </div>
          <SegiEmpatMediumCardTeks title={item.title || ''} brief={item.brief || ''} briefStyle={tema.briefStyle} hoverClassName={hoverClassName} />
        </div>
        <span className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={tema.sourceStyle}>
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

export default SegiEmpatMediumCardPreview;
