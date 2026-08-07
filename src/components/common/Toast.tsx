import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

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

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';
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
      className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-lg shadow-lg border border-l-4 bg-[#FDFDFD] text-[#292524] text-xs leading-relaxed ${
        isSuccess
          ? 'border-stone-200 border-l-[#3d6b4c]'
          : isError
          ? 'border-stone-200 border-l-[#a8241f]'
          : 'border-stone-200 border-l-Adjung-maroon'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {isSuccess && <CheckCircle2 className="w-4 h-4 text-[#3d6b4c] shrink-0 mt-0.5" />}
        {isError && <AlertTriangle className="w-4 h-4 text-[#a8241f] shrink-0 mt-0.5" />}
        {!isSuccess && !isError && <Info className="w-4 h-4 text-Adjung-maroon shrink-0 mt-0.5" />}
        <span>{toast.message}</span>
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
