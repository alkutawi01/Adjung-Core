import React from 'react';
import {
  BentoInner, EyebrowKad, getCardTheme, formatBentoDate, getDisplayDate,
} from '../FrontpageView';
import { StandardCardTeks } from './StandardCardTeks';

// Pratonton kad SEBENAR tier STANDARD (2026-08-16, sambungan Pelan Pratonton Kad — dahulu cuma
// KOMPAK, lihat KompakCardPreview.tsx utk corak/rasional asal). Corak sekarang SATU sahaja bagi
// kesemua 6 slot (2, 6, 19, 20, 33, 34) — diselaraskan semasa pengekstrakan ni (lihat
// StandardCardTeks.tsx utk nota ketekalan).
export interface StandardCardPreviewItem {
  title?: string;
  brief?: string;
  desk?: string;
  topik?: string;
  source?: string;
  originalDate?: string;
  publishedAt?: string;
  imageUrl?: string;
  // Sorok baris tarikh sepenuhnya (2026-08-18) — sepadan kad SEBENAR bila sumber ialah
  // 'Editorial Adjung'/'Adjung Editorial' (>1 sumber, sumberAdjungSendiri() FrontpageView.tsx).
  sembunyikanTarikhSumber?: boolean;
}

export interface StandardCardPreviewProps {
  item: StandardCardPreviewItem;
  bidang?: { icon: string | null; iconSvg: string | null };
}

export const StandardCardPreview: React.FC<StandardCardPreviewProps> = ({ item, bidang }) => {
  const tema = getCardTheme(item, 'transparent');
  return (
    <div className="p-4 md:p-6 relative rounded-lg shadow-sm flex flex-col gap-3 min-h-[180px]" style={tema.cardStyle}>
      <BentoInner itemKey="pratonton-standard" className="md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={tema.deskStyle}>
            <EyebrowKad item={item} bidang={bidang} />
          </div>
          <StandardCardTeks title={item.title || ''} brief={item.brief || ''} briefStyle={tema.briefStyle} />
        </div>
        {/* md:w-28 — lebar TETAP, bukan hiasan (CLAUDE.md "Had aksara: kandungan sedia ada
            dikecualikan + kad carousel tak mengembang"): tanpa ni, teks sumber panjang render
            SATU baris tanpa wrap (flex item tanpa had lebar = intrinsic max-content width) dan
            melimpah keluar kad — TIADA di preview ni sebelum ni walaupun SEMUA 6 tapak STANDARD
            sebenar (FrontpageView.tsx) ada, punca isu Izzat tangkap (2026-08-18): "preview tak
            wrap sumber". Kandungan SEBENAR yang diterbitkan TIDAK terjejas — hanya pratonton. */}
        <span className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300 border-t pt-2 md:border-t-0 md:pt-0 md:pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:w-28 md:self-stretch flex flex-col justify-center gap-0.5" style={tema.sourceStyle}>
          <span>{item.source}</span>
          {!item.sembunyikanTarikhSumber && (getDisplayDate(item.originalDate) || formatBentoDate(item.publishedAt)) && (
            <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">
              {getDisplayDate(item.originalDate) || formatBentoDate(item.publishedAt)}
            </span>
          )}
        </span>
      </BentoInner>
    </div>
  );
};

export default StandardCardPreview;
