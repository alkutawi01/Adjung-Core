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
  /** Butang "Cuba Lagi" di dalam kotak ralat itu sendiri (2026-08-07, Audit §D6) — dahulu 13
   *  tempat tiada jalan pulih langsung, editor terpaksa muat semula seluruh laman. */
  onCubaLagi?: () => void;
}

export const MesejStatus: React.FC<MesejStatusProps> = ({ tone, children, className = '', onCubaLagi }) => (
  // role="alert"/"status" (2026-08-07, Audit §G5) — aria-live sifar dalam repo sebelum ni, jadi
  // kegagalan simpan tidak pernah diumumkan kepada pembaca skrin. MesejStatus ialah titik tunggal
  // yang dilalui hampir semua ralat/kejayaan Editorium, jadi satu pembetulan di sini memberi kesan
  // menyeluruh.
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={`border rounded font-sans text-xs px-3 py-2 flex items-center justify-between gap-3 ${TONE_CLASS[tone]} ${className}`}
  >
    <span>{children}</span>
    {onCubaLagi && (
      <button
        type="button"
        onClick={onCubaLagi}
        className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline cursor-pointer"
      >
        Cuba Lagi
      </button>
    )}
  </div>
);

export default MesejStatus;
