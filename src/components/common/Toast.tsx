import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// Reka bentuk semula KEDUA (2026-08-08, Izzat: "yg awak ckp versi baru tu orang dah tau AI yg
// buat. guna satu warna sahaja").
//
// Percubaan pertama (2026-08-07) cuma menanggalkan bulatan ikon dan sempadan kiri tebal, tetapi
// MENGEKALKAN bentuk asas yang menjadikannya boleh dikenali serta-merta: kad putih bersempadan,
// bersudut bulat, dengan aksen warna SEMANTIK (hijau berjaya / merah ralat). Gabungan itulah
// "komponen notifikasi" lalai setiap templat — menukar butirannya tak mengubah apa-apa.
//
// Kali ini bentuknya sendiri ditukar:
//   1. SATU warna sahaja — maroon Adjung. Tiada hijau/merah semantik langsung. Makna dibawa
//      sepenuhnya oleh LABEL bertulis ("BERJAYA"/"RALAT"/"MAKLUMAN"), bukan warna; sama pendirian
//      macam StatusBadge dan eyebrow kad bento, dan lebih baik untuk buta warna.
//   2. Terbalik — ground maroon pekat, teks krim. Blok maroon pekat ialah perbendaharaan visual
//      Adjung sendiri (kepala frontpage, BERITA SEMASA), bukan kad putih terapung sejagat.
//   3. Sudut TAJAM (tiada rounded) dan tiada bayang — bahasa cetak, bukan bahasa "kad" skrin.
//   4. Mesej dalam SERIF (font kandungan editorial Adjung), bukan sans-serif UI. Ini yang paling
//      ketara membezakannya daripada notifikasi aplikasi biasa.
const LABEL_JENIS: Record<ToastMessage['type'], string> = {
  success: 'Berjaya',
  error: 'Ralat',
  info: 'Makluman',
};

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-0 right-0 z-50 flex flex-col items-end gap-px max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismissRef.current(toast.id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast.id]);

  const isError = toast.type === 'error';
  // Audit UI/UX §G10 — Toast ialah animasi PALING kerap muncul dalam kerja harian Editorium,
  // tapi sebelum ni tak pernah menyemak prefers-reduced-motion langsung.
  const kurangGerak = useReducedMotion();

  return (
    <motion.div
      role={isError ? 'alert' : 'status'}
      initial={kurangGerak ? false : { opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={kurangGerak ? { opacity: 0 } : { opacity: 0, x: 12 }}
      transition={{ duration: kurangGerak ? 0.01 : 0.2, ease: 'easeOut' }}
      className="pointer-events-auto w-full flex items-start gap-4 pl-5 pr-3.5 py-3.5"
      style={{ backgroundColor: 'var(--color-Adjung-maroon)', color: 'var(--color-Adjung-cream)' }}
    >
      <div className="min-w-0 flex-1">
        <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.2em] opacity-60 mb-1">
          {LABEL_JENIS[toast.type]}
        </span>
        <span className="block font-serif text-[13px] leading-snug">{toast.message}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="opacity-50 hover:opacity-100 transition-opacity shrink-0 mt-0.5 cursor-pointer"
        aria-label="Tutup"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};
