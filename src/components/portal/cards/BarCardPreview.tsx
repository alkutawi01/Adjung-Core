import React from 'react';
import { BarCard } from './BarCard';
import { safeParseInline } from '../../../utils.tsx';

// Pratonton kad SEBENAR tier BAR (2026-08-16, sambungan Pelan Pratonton Kad — dahulu cuma KOMPAK,
// lihat KompakCardPreview.tsx utk corak/rasional asal). BarCard.tsx SUDAH satu komponen KONGSI
// konsisten merentasi kelapan-lapan slot BAR (tiada isu ketekalan macam tier lain, disahkan audit
// 2026-08-16) — pratonton ni cuma pembalut nipis, TIADA extraksi diperlukan.
//
// BarCard mengharap `item.title` SUDAH diproses (elemen React, hasil penggalSukuKata() +
// safeParseInline() di FrontpageView.tsx — lihat komen BarCard.tsx baris 80-82) — draf di modal
// Tulis Kandungan masih rentetan MENTAH, jadi pratonton ni proses `safeParseInline()` sahaja
// (TANPA penggalSukuKata, sebab sempang lembut cuma relevan untuk paparan sebenar terbit, bukan
// pratonton draf) sebelum hantar ke BarCard.
export interface BarCardPreviewItem {
  title?: string;
  desk?: string;
  originalDate?: string;
  dateEnd?: string;
  publishedAt?: string;
  organizer?: string;
  access?: string;
}

export interface BarCardPreviewProps {
  item: BarCardPreviewItem;
}

export const BarCardPreview: React.FC<BarCardPreviewProps> = ({ item }) => {
  const itemDiproses = { ...item, title: safeParseInline(item.title || '') };
  return <BarCard item={itemDiproses} onClick={() => {}} />;
};

export default BarCardPreview;
