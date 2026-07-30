import React, { useState, useEffect } from 'react';
import { X, Bell, Mail, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';

interface NotificationDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawerModal: React.FC<NotificationDrawerModalProps> = ({ isOpen, onClose }) => {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/system/editor-notes?status=aktif')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setNotes(data.notes || []);
          }
        })
        .catch(err => console.error('Error fetching notifications:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#FDFDFD] h-full shadow-2xl border-l border-stone-200 flex flex-col font-sans"
      >
        {/* Header */}
        <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#802334]" />
            <h3 className="font-serif font-bold text-stone-900 text-sm">Peti Makluman & Notis System</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="p-8 text-center font-serif text-stone-500 text-xs">Memuatkan makluman...</div>
          ) : notes.length === 0 ? (
            <div className="p-8 text-center font-serif text-stone-500 text-xs border border-stone-200 rounded-xl bg-white">
              Tiada makluman atau notis baharu setakat ini.
            </div>
          ) : (
            notes.map(n => (
              <div key={n.id} className="p-3.5 border border-stone-200 rounded-xl bg-white space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                    n.type === 'awam' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-stone-100 text-stone-700 border border-stone-300'
                  }`}>
                    {n.type === 'awam' ? '🌐 Notis Awam' : '🔒 Notis Dalaman'}
                  </span>
                  <span className="font-mono text-[9px] text-stone-400">
                    {new Date(n.created_at).toLocaleDateString('ms-MY')}
                  </span>
                </div>
                <h4 className="font-serif font-bold text-xs text-stone-900">{n.title}</h4>
                <p className="text-[11px] text-stone-600 font-sans leading-relaxed line-clamp-3">{n.content}</p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-stone-200 bg-stone-50 text-center font-mono text-[10px] text-stone-400">
          Sistem Makluman Realtime Adjung Brief v1.2
        </div>
      </div>
    </div>
  );
};
