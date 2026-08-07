import React from 'react';

// Kotak mesej ralat/kejayaan/neutral kongsi (2026-08-07, Pelan 01 Fasa A4). Sebelum ni TIGA merah
// berbeza dipakai untuk maksud yang sama: `var(--color-error)` (DrafSayaConsole/LogAuditConsole),
// `border-red-200 text-red-800` (IndeksConsole/NotaKetuaEditorConsole), dan `text-red-700`
// (kaunter aksara melebihi had). Kini satu merah sahaja — token semantik `--color-error`.
export type MesejTone = 'error' | 'success' | 'neutral';

const TONE_CLASS: Record<MesejTone, string> = {
  error: 'bg-red-50 border-[var(--color-error)] text-[var(--color-error)]',
  success: 'bg-green-50 border-[var(--color-success)] text-[var(--color-success)]',
  neutral: 'bg-stone-50 border-stone-200 text-stone-700',
};

export interface MesejStatusProps {
  tone: MesejTone;
  children: React.ReactNode;
  className?: string;
}

export const MesejStatus: React.FC<MesejStatusProps> = ({ tone, children, className = '' }) => (
  <div className={`border rounded font-sans text-xs px-3 py-2 ${TONE_CLASS[tone]} ${className}`}>
    {children}
  </div>
);

export default MesejStatus;
