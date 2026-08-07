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
  /** Kandungan kiri pada baris tindakan — cth "Tarikh: 2 Ogos 2026" bersebelahan butang di kanan.
   *  Tanpa slot ni, dialog berkaki-terbelah terpaksa kekal ditulis tangan. */
  tindakanKiri?: React.ReactNode;
  /** Badan menatal sendiri, kepala dan kaki MELEKAT (2026-08-07).
   *
   *  Mod lalai menatal keseluruhan dialog (`max-h-[90vh] overflow-y-auto`), yang memadai untuk
   *  borang pendek. Ia TIDAK memadai untuk dialog berkandungan panjang: butang tutup di kepala
   *  menatal keluar pandangan, jadi pembaca terpaksa menatal balik ke atas untuk menutupnya —
   *  pepijat yang sudah pernah berlaku dan didokumentasikan di IndeksConsole.tsx (2026-07-29).
   *
   *  Bila `true`: panel jadi tinggi tetap, kepala/kaki `flex-none`, badan sahaja yang menatal. */
  badanMenatal?: boolean;
}

export const EditorDialog: React.FC<EditorDialogProps> = ({
  tajuk, onTutup, saiz = 'lg', children, tindakan, tindakanKiri, badanMenatal = false,
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
        className={`bg-white rounded-lg shadow-xl border border-stone-300 w-full ${SAIZ_CLASS[saiz]} text-xs font-sans max-h-[90vh] ${
          badanMenatal ? 'flex flex-col overflow-hidden' : 'p-6 space-y-4 overflow-y-auto'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex justify-between items-center border-b border-stone-200 pb-2 ${badanMenatal ? 'flex-none px-6 pt-6' : ''}`}>
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

        {/* Mod lalai sengaja merender `children` TERUS tanpa pembalut — jarak dikawal oleh
            `space-y-4` pada panel. Menambah pembalut di sini akan mengubah rupa kesemua dialog
            sedia ada yang sudah disahkan. */}
        {badanMenatal
          ? <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">{children}</div>
          : children}

        {(tindakan || tindakanKiri) && (
          <div
            className={`flex items-center gap-2 ${tindakanKiri ? 'justify-between' : 'justify-end'} ${
              badanMenatal ? 'flex-none px-6 pb-6 pt-3 border-t border-stone-200' : 'pt-1'
            }`}
          >
            {tindakanKiri && <div className="min-w-0">{tindakanKiri}</div>}
            {tindakan && <div className="flex items-center gap-2 shrink-0">{tindakan}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default EditorDialog;
