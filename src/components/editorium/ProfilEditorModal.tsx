import React, { useState } from 'react';
import { X } from 'lucide-react';

// Profil Editor (2026-08-01, spesifikasi pemilik projek — aksesori header "Profil editor",
// bukan destinasi sidebar). Editor sunting identiti DIA SENDIRI sahaja: nama pena, tandatangan,
// warna avatar, bio ringkas. Email/username/peranan sengaja tiada di sini — bukan hak editor
// untuk ubah sendiri.
interface ProfilEditor {
  id: string;
  penName: string;
  signature: string;
  avatarColor: string;
  bioSummary: string;
}

interface ProfilEditorModalProps {
  profil: ProfilEditor;
  onTutup: () => void;
  // Dipanggil selepas simpan berjaya — App.tsx guna ni untuk kemas kini sesi log masuk (nama
  // pena dipapar di header/Editorium), supaya perubahan kelihatan serta-merta tanpa log keluar.
  onKemasKini: (patch: Partial<ProfilEditor>) => void;
}

const HAD_PEN_NAME = 60;
const HAD_SIGNATURE = 40;
const HAD_BIO = 500;

export const ProfilEditorModal: React.FC<ProfilEditorModalProps> = ({ profil, onTutup, onKemasKini }) => {
  const [penName, setPenName] = useState(profil.penName || '');
  const [signature, setSignature] = useState(profil.signature || '');
  const [avatarColor, setAvatarColor] = useState(profil.avatarColor || '#802334');
  const [bioSummary, setBioSummary] = useState(profil.bioSummary || '');
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState('');
  const [mesej, setMesej] = useState('');

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenyimpan(true);
    setRalat('');
    try {
      const res = await fetch(`/api/system/profile/${profil.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ penName, signature, avatarColor, bioSummary }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan profil.');
      onKemasKini({ penName, signature, avatarColor, bioSummary });
      setMesej('Profil disimpan');
      setTimeout(() => setMesej(''), 2000);
    } catch (err: any) {
      setRalat(err.message || 'Gagal menyimpan profil.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onTutup}>
      <form
        onSubmit={simpan}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-md w-full p-6 space-y-4 text-xs font-sans"
      >
        <div className="flex justify-between items-center border-b border-stone-200 pb-2">
          <h3 className="font-sans text-xs font-bold text-[#802334] uppercase tracking-wider">Profil Editor</h3>
          <button type="button" onClick={onTutup} className="text-stone-400 hover:text-stone-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-full border border-stone-300 shrink-0 flex items-center justify-center text-white font-serif font-semibold text-sm"
            style={{ backgroundColor: avatarColor }}
          >
            {(penName || '?').trim().charAt(0).toUpperCase()}
          </span>
          <label className="flex flex-col gap-1 flex-1">
            <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Warna Avatar</span>
            <input
              type="color"
              value={avatarColor}
              onChange={(e) => setAvatarColor(e.target.value)}
              className="w-full h-7 border border-stone-300 rounded cursor-pointer"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
            <span>Nama Pena</span>
            <span className={penName.length > HAD_PEN_NAME ? 'text-red-700' : 'text-stone-400'}>{penName.length}/{HAD_PEN_NAME}</span>
          </span>
          <input
            type="text"
            value={penName}
            onChange={(e) => setPenName(e.target.value)}
            className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
            <span>Tandatangan</span>
            <span className={signature.length > HAD_SIGNATURE ? 'text-red-700' : 'text-stone-400'}>{signature.length}/{HAD_SIGNATURE}</span>
          </span>
          <input
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Dipaparkan pada kolofon Focus View, contoh…"
            className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
            <span>Bio Ringkas</span>
            <span className={bioSummary.length > HAD_BIO ? 'text-red-700' : 'text-stone-400'}>{bioSummary.length}/{HAD_BIO}</span>
          </span>
          <textarea
            value={bioSummary}
            onChange={(e) => setBioSummary(e.target.value)}
            rows={3}
            className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs resize-y"
          />
        </label>

        {ralat && (
          <p className="text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 text-[11px]">{ralat}</p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1 border-t border-stone-200">
          {mesej && <span className="text-emerald-700 text-[11px] font-semibold">{mesej}</span>}
          <button
            type="submit"
            disabled={menyimpan || !penName.trim() || penName.length > HAD_PEN_NAME || signature.length > HAD_SIGNATURE || bioSummary.length > HAD_BIO}
            className="bg-[#802334] text-white px-4 py-1.5 rounded font-semibold text-xs hover:bg-[#6a1c2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {menyimpan ? 'Menyimpan…' : 'Simpan Profil'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfilEditorModal;
