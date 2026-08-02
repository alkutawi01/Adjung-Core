import React, { useState } from 'react';
import { X } from 'lucide-react';
import { labelUi } from '../../config/istilah';

// Profil Editor (2026-08-01, spesifikasi pemilik projek — aksesori header "Profil editor",
// bukan destinasi sidebar). 2026-08-02: dipermudah atas arahan Izzat — "ni bukan medsos, hanya
// utk rujukan dalaman". Avatar/tandatangan/bio DIBUANG (bukan disorok — medan tu tak bermakna
// untuk portal editorial dalaman, bukan produk sosial). Nama Pena SAHAJA yang kekal, sebab
// itulah satu-satunya identiti yang pernah terpapar di luar Editorium (kolofon kandungan). Tukar
// ID pengguna/emel/kata laluan sendiri dirancang berasingan (lihat PELAN_PRA_LAUNCH.md Fasa 6b),
// belum dibina di sini lagi.
interface ProfilEditor {
  id: string;
  penName: string;
}

interface ProfilEditorModalProps {
  profil: ProfilEditor;
  onTutup: () => void;
  // Dipanggil selepas simpan berjaya — App.tsx guna ni untuk kemas kini sesi log masuk (nama
  // pena dipapar di header/Editorium), supaya perubahan kelihatan serta-merta tanpa log keluar.
  onKemasKini: (patch: Partial<ProfilEditor>) => void;
}

const HAD_PEN_NAME = 60;

export const ProfilEditorModal: React.FC<ProfilEditorModalProps> = ({ profil, onTutup, onKemasKini }) => {
  const [penName, setPenName] = useState(profil.penName || '');
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
        body: JSON.stringify({ penName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan profil.');
      onKemasKini({ penName });
      setMesej(labelUi('toast.profil_disimpan'));
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

        <label className="flex flex-col gap-1">
          <span className="flex justify-between font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
            <span>Nama Pena</span>
            <span className={penName.length > HAD_PEN_NAME ? 'text-red-700' : 'text-stone-400'}>{penName.length}/{HAD_PEN_NAME}</span>
          </span>
          <input
            type="text"
            value={penName}
            onChange={(e) => setPenName(e.target.value)}
            placeholder="Dipaparkan pada kolofon kandungan"
            className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs"
          />
        </label>

        {ralat && (
          <p className="text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 text-[11px]">{ralat}</p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1 border-t border-stone-200">
          {mesej && <span className="text-emerald-700 text-[11px] font-semibold">{mesej}</span>}
          <button
            type="submit"
            disabled={menyimpan || !penName.trim() || penName.length > HAD_PEN_NAME}
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
