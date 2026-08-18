import React from 'react';
import {
  BentoInner, EyebrowKad, getCardTheme, formatBentoDate, getDisplayDate,
} from '../FrontpageView';
import { KompakCardTeks } from './KompakCardTeks';

// Pratonton kad SEBENAR tier KOMPAK, dipanggil dari modal Tulis Kandungan (2026-08-08, "saya nak
// nampak persis rupa kad tu sebelum terbit" — Pelan Pratonton Kad, bukti konsep pertama).
//
// Komponen ni GUBAHAN daripada bahagian FrontpageView.tsx yang genuinely dikongsi (BentoInner —
// termasuk jaring limpahan sebenar, EyebrowKad, getCardTheme, KompakCardTeks — tajuk/huraian
// tepat sama seperti yang berputar dalam CarouselStableBlock slot 4/5), BUKAN salinan/tulis
// semula. Sengaja TIADA carousel/klik-navigasi di sini — itu mekanik rotasi kandungan
// DITERBITKAN, tak relevan untuk pratonton SATU draf semasa disunting.
export interface KompakCardPreviewItem {
  title?: string;
  brief?: string;
  desk?: string;
  topik?: string;
  source?: string;
  originalDate?: string;
  publishedAt?: string;
  /** Draf guna medan `image` (SlotManagerModal); tema kad guna `imageUrl` — pemanggil memetakan
   *  supaya komponen ni tak perlu tahu dua nama berbeza tu. */
  imageUrl?: string;
  // Sorok baris tarikh sepenuhnya (2026-08-18) — sepadan kad SEBENAR bila sumber ialah
  // 'Editorial Adjung'/'Adjung Editorial' (>1 sumber, sumberAdjungSendiri() FrontpageView.tsx).
  sembunyikanTarikhSumber?: boolean;
}

export interface KompakCardPreviewProps {
  item: KompakCardPreviewItem;
  bidang?: { icon: string | null; iconSvg: string | null };
}

export const KompakCardPreview: React.FC<KompakCardPreviewProps> = ({ item, bidang }) => {
  const tema = getCardTheme(item, 'transparent');
  return (
    // Bekas ringkas (padding+min-h+bayang sahaja, TIADA hover/scale/cursor) — pratonton, bukan
    // kad boleh klik. Lebar dihadkan ~280px (anggaran KOMPAK dua-kolum sebenar) supaya bungkusan
    // baris tepat sama seperti frontpage, bukan lebar penuh borang yang mengelirukan.
    <div className="p-4 relative rounded-lg shadow-sm flex flex-col min-h-[120px] max-w-[280px]" style={tema.cardStyle}>
      <BentoInner itemKey="pratonton-kompak" className="gap-3">
        <div>
          <div className="font-mono text-[9px] md:text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={tema.deskStyle}>
            <EyebrowKad item={item} bidang={bidang} />
          </div>
          <KompakCardTeks title={item.title || ''} brief={item.brief || ''} briefStyle={tema.briefStyle} />
        </div>
        <span className="font-sans text-[7px] md:text-[8px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={tema.sourceStyle}>
          <span>{item.source}</span>
          {!item.sembunyikanTarikhSumber && (getDisplayDate(item.originalDate) || formatBentoDate(item.publishedAt)) && (
            <span className="opacity-60 normal-case font-mono text-[7px] md:text-[7px]">
              {getDisplayDate(item.originalDate) || formatBentoDate(item.publishedAt)}
            </span>
          )}
        </span>
      </BentoInner>
    </div>
  );
};

export default KompakCardPreview;
