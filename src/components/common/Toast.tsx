import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// Reka bentuk semula (2026-08-07, Izzat: "reka bentuk sekarang nampak generik AI") — bekas
// bulatan ikon berwarna + sempadan kiri tebal 4px ialah corak notifikasi SaaS generik (setiap
// templat AI-wrapper guna corak SAMA). Gantikan dengan bahasa visual Adjung sendiri: label mono
// huruf besar bertitik lebar di atas mesej (corak SAMA seperti eyebrow kad bento/SectionLabel/
// StatusBadge — teks EKSPLISIT sebagai isyarat utama, bukan ikon bulat berwarna), garis atas 2px
// nipis untuk isyarat warna sekali imbas (bukan sempadan kiri tebal — cliché templat generik),
// sudut lebih tajam (rounded kecil, bukan rounded-lg+shadow-lg bombastik).
const TOAST_LABEL: Record<ToastMessage['type'], string> = {
  success: 'Berjaya',
  error: 'Ralat',
  info: 'Makluman',
};
const TOAST_WARNA: Record<ToastMessage['type'], string> = {
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  info: 'var(--color-Adjung-maroon)',
};

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none font-sans">
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
  const warna = TOAST_WARNA[toast.type];
  // Audit UI/UX §G10 — Toast ialah animasi PALING kerap muncul dalam kerja harian Editorium,
  // tapi sebelum ni tak pernah menyemak prefers-reduced-motion langsung.
  const kurangGerak = useReducedMotion();

  return (
    <motion.div
      role={isError ? 'alert' : 'status'}
      initial={kurangGerak ? false : { opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={kurangGerak ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.9 }}
      transition={{ duration: kurangGerak ? 0.01 : 0.25, ease: 'easeOut' }}
      className="pointer-events-auto flex items-start justify-between gap-3 px-3.5 py-3 rounded border border-stone-200 bg-[#FDFDFD] text-[#292524] text-xs leading-relaxed"
      style={{ borderTop: `2px solid ${warna}` }}
    >
      <div className="min-w-0">
        <span
          className="block font-mono text-[9px] font-bold uppercase tracking-widest mb-1"
          style={{ color: warna }}
        >
          {TOAST_LABEL[toast.type]}
        </span>
        <span className="text-stone-700">{toast.message}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-stone-400 hover:text-[#292524] transition-colors p-0.5 rounded shrink-0"
        aria-label="Tutup"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};
