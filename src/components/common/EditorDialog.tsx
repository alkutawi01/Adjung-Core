import React from 'react';
import { X } from 'lucide-react';
import { useModalFokus } from '../../hooks/useModalFokus';

// Dialog kongsi Editorium (2026-08-07, arahan Izzat — borang "tambah item" tidak sepatutnya
// kekal terpampang; senarai yang utama, borang muncul hanya semasa mencipta/menyunting).
//
// Sebelum ini TIADA komponen dialog kongsi langsung: 17 modal ditulis tangan satu-satu, dengan
// TIGA dialek backdrop yang berbeza (`bg-stone-900/60 backdrop-blur-xs`, `bg-black/60
// backdrop-blur-md`, `bg-black/40 backdrop-blur-sm`) dan z-index ad hoc (50/60/70/100/200).
// Kesan sebenar, bukan sekadar kemasan: `SlotManagerModal.tsx` — modal TERBESAR dalam aplikasi —
// tiada perangkap fokus langsung, jadi Tab boleh terlepas keluar ke halaman di belakangnya.
// Komponen ni menjadikan perangkap fokus lalai, bukan sesuatu yang perlu diingat.
//
// Saiz mengikut konvensyen yang sudah wujud (didokumentasikan di DirektoriConsole.tsx, Pelan 01
// Fasa D2): `sm` untuk pengesahan, `lg` untuk borang. `md`/`xl` ditambah untuk kes antara.
export type SaizDialog = 'sm' | 'md' | 'lg' | 'xl';

const SAIZ_CLASS: Record<SaizDialog, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export interface EditorDialogProps {
  /** ReactNode, bukan string — beberapa dialog sedia ada meletakkan glif dalam tajuknya (cth
   *  BidangIcon dalam modal "Ikon & Warna"). Menerima nod mengelakkan dialog tersebut terpaksa
   *  kekal ditulis tangan semata-mata kerana tajuknya bukan teks tulen. */
  tajuk: React.ReactNode;
  onTutup: () => void;
  /** Lalai `lg` — kebanyakan pemanggil ialah borang. */
  saiz?: SaizDialog;
  children: React.ReactNode;
  /** Baris tindakan di kaki dialog (butang simpan/batal). Dijajar kanan. */
  tindakan?: React.ReactNode;
}

export const EditorDialog: React.FC<EditorDialogProps> = ({
  tajuk, onTutup, saiz = 'lg', children, tindakan,
}) => {
  const refModal = React.useRef<HTMLDivElement>(null);
  // Perangkap fokus + Escape + pulangkan fokus kepada pencetus. Sengaja TIDAK boleh dimatikan:
  // satu-satunya modal yang pernah melangkaunya melakukannya secara tidak sengaja, bukan sebagai
  // keputusan reka bentuk.
  useModalFokus(refModal, onTutup);

  // Tutup hanya apabila mousedown DAN click kedua-duanya bermula pada backdrop (pepijat Izzat
  // 2026-08-07, asalnya dibetulkan di LoginModal.tsx) — tanpa gerbang ni, menyeret untuk memilih
  // teks di dalam dialog dan melepaskan tetikus di luarnya akan menutup dialog dan membuang
  // kerja yang belum disimpan.
  const mousedownPadaBackdrop = React.useRef(false);
  const idTajuk = React.useId();

  return (
    <div
      className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onMouseDown={(e) => { mousedownPadaBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && mousedownPadaBackdrop.current) onTutup(); }}
    >
      <div
        ref={refModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTajuk}
        className={`bg-white rounded-lg shadow-xl border border-stone-300 w-full ${SAIZ_CLASS[saiz]} p-6 space-y-4 text-xs font-sans max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-stone-200 pb-2">
          <h3 id={idTajuk} className="font-serif text-lg font-bold text-Adjung-maroon flex items-center gap-2 min-w-0">{tajuk}</h3>
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup"
            className="text-stone-400 hover:text-stone-700 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {children}

        {tindakan && (
          <div className="flex justify-end gap-2 pt-1">{tindakan}</div>
        )}
      </div>
    </div>
  );
};

export default EditorDialog;
