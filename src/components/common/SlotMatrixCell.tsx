import React from 'react';

// Sel Matriks Slot kongsi (2026-08-07, hasil audit reka bentuk — design_handoff_editorium_
// redesign, seksyen 3.5/4.3). Papan Pemuka (DashboardConsole.tsx) dahulu kod status matriks
// 38-slot cuma nombor slot berwarna + satu dot — audit: mesti ada LABEL TEKS eksplisit jugak
// (bukan warna sahaja). Satu definisi di sini, boleh dipakai semula kalau matriks dipaparkan di
// tempat lain (cth Senarai Slot) tanpa ulang corak.
export type SlotMatrixStatus = 'terisi' | 'menunggu' | 'kosong';

const STATUS_WARNA: Record<SlotMatrixStatus, string> = {
  terisi: 'var(--color-success)',
  menunggu: 'var(--color-warning)',
  kosong: 'var(--color-error)',
};
const STATUS_LABEL: Record<SlotMatrixStatus, string> = {
  terisi: 'AKTIF',
  menunggu: 'TUNGGU',
  kosong: 'KOSONG',
};
// Corak latar (2026-08-07) — bukan warna sahaja: menunggu dapat lorek serong, kosong dapat
// sempadan putus-putus, terisi kekal isian padat sisi kiri (jalur tebal, bukan latar penuh —
// kad matriks ni kecil, latar penuh warna boleh jejas kebolehbacaan label).
const STATUS_STYLE = (status: SlotMatrixStatus): React.CSSProperties => {
  const warna = STATUS_WARNA[status];
  if (status === 'menunggu') {
    return { borderLeft: `3px solid ${warna}`, backgroundImage: `repeating-linear-gradient(45deg, ${warna}14 0, ${warna}14 3px, transparent 3px, transparent 8px)` };
  }
  if (status === 'kosong') {
    return { borderLeft: `3px dashed ${warna}` };
  }
  return { borderLeft: `3px solid ${warna}` };
};

export interface SlotMatrixCellProps {
  /** Slot 1-based (paparan) — pemanggil hantar slotIndex+1 kalau data 0-based. */
  slotNombor: number;
  status: SlotMatrixStatus;
  onClick?: () => void;
}

export const SlotMatrixCell: React.FC<SlotMatrixCellProps> = ({ slotNombor, status, onClick }) => {
  const warna = STATUS_WARNA[status];
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[#FDFDFD] px-3 py-2.5 flex flex-col gap-0.5 min-w-0 overflow-hidden hover:bg-[#802334]/5 transition-colors cursor-pointer text-left"
      style={STATUS_STYLE(status)}
    >
      <span className="font-mono text-[11px] font-semibold whitespace-nowrap text-stone-700">
        S-{String(slotNombor).padStart(2, '0')}
      </span>
      <span className="font-mono text-[9px] font-bold tracking-wide" style={{ color: warna }}>
        {STATUS_LABEL[status]}
      </span>
    </button>
  );
};

export default SlotMatrixCell;
