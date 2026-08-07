import React from 'react';

// Kad panel kongsi Editorium (2026-08-07, Pelan 01 Fasa A2). Sebelum ni setiap konsol menulis
// pembalut kad sendiri dan bayangnya hanyut kepada EMPAT varian tanpa sebab: tiada bayang
// (NotaKetuaEditorConsole/PenajaConsole/EditorialConsole), `shadow-sm` (IndeksConsole/
// DirektoriConsole), dan hex literal `shadow-[0_1px_2px_rgba(0,0,0,.04)]` (DrafSayaConsole/
// LogAuditConsole/PerlembagaanConsole). Komponen ni SATU-SATUNYA sumber kebenaran corak kad:
// satu bayang, satu radius, satu sempadan.
//
// `padding='p-0'` untuk kad yang membalut jadual — jadual perlukan `overflow-hidden` pada
// pembalut supaya sudut bulat tidak dipotong baris pertama/terakhir.
export type PanelPadding = 'p-0' | 'p-4' | 'p-6';

export interface PanelCardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: PanelPadding;
  children?: React.ReactNode;
}

export const PanelCard: React.FC<PanelCardProps> = ({
  padding = 'p-6', className = '', children, ...rest
}) => (
  <div
    className={`bg-white rounded-lg border border-stone-200 shadow-[0_1px_2px_rgba(0,0,0,.04)] ${padding} ${padding === 'p-0' ? 'overflow-hidden' : ''} ${className}`}
    {...rest}
  >
    {children}
  </div>
);

export default PanelCard;
