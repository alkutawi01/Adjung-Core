import React, { useEffect, useState } from 'react';

// Popover kecil untuk menetapkan editor SATU slot, terus dari senarai (2026-08-01, permintaan
// pemilik projek — pemilih slot "Tulis Kandungan"). Sengaja tetingkap kecil terapung, BUKAN modal
// skrin penuh (seperti Editorium → Slot → Senarai Slot): supaya editor boleh tetapkan penugasan
// tanpa meninggalkan konteks pemilih slot yang sedang dilihat.
//
// Peraturan sama seperti Senarai Slot: satu slot boleh diuruskan lebih seorang editor, seorang
// editor boleh menguruskan lebih satu slot, dan senarai dihantar SEPENUHNYA (bukan tambah/buang
// satu-satu) supaya tiada keadaan separuh siap kalau simpan gagal di tengah jalan.
interface Pengguna {
  id: string;
  penName?: string;
  username?: string;
  role?: string;
}

interface PenugasanEditorPopoverProps {
  slotIndex: number;
  pengguna: Pengguna[];
  editorIdsSemasa: string[];
  onBatal: () => void;
  onSimpan: (editorIds: string[]) => Promise<{ ok: boolean; ralat?: string }>;
}

export const PenugasanEditorPopover: React.FC<PenugasanEditorPopoverProps> = ({
  slotIndex, pengguna, editorIdsSemasa, onBatal, onSimpan,
}) => {
  const [draf, setDraf] = useState<string[]>(editorIdsSemasa);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState('');

  // Escape membatalkan popover (Audit UI/UX §G2) — popover ringkas, bukan modal skrin penuh,
  // jadi tak perlukan perangkap fokus penuh useModalFokus, tapi tetap wajar keluar papan kekunci.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBatal();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onBatal]);

  const simpan = async () => {
    setMenyimpan(true);
    setRalat('');
    const hasil = await onSimpan(draf);
    setMenyimpan(false);
    if (!hasil.ok) setRalat(hasil.ralat || 'Gagal menyimpan penugasan.');
  };

  return (
    <div
      className="absolute z-20 right-3 top-full mt-1 w-60 bg-white border border-stone-300 rounded-lg shadow-xl p-3 space-y-2 text-xs"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
        Editor Slot {slotIndex + 1}
      </p>
      {pengguna.length === 0 ? (
        <p className="text-stone-400 italic py-2">Tiada pengguna dalam sistem.</p>
      ) : (
        <div className="max-h-52 overflow-y-auto divide-y divide-Adjung-line border border-stone-200 rounded">
          {pengguna.map((u) => {
            const ditanda = draf.includes(u.id);
            return (
              <label key={u.id} className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-stone-50">
                <input
                  type="checkbox"
                  checked={ditanda}
                  onChange={() => setDraf((prev) => (ditanda ? prev.filter((x) => x !== u.id) : [...prev, u.id]))}
                  className="w-3.5 h-3.5 rounded border-stone-300 text-Adjung-maroon cursor-pointer"
                />
                <span className="font-semibold text-stone-800 truncate">{u.penName || u.username}</span>
              </label>
            );
          })}
        </div>
      )}
      {ralat && <p className="text-[var(--color-error)] bg-red-50 border border-[var(--color-error)] rounded px-2 py-1 text-[10px]">{ralat}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onBatal}
          disabled={menyimpan}
          className="bg-stone-200 text-stone-700 px-2.5 py-1 rounded font-semibold text-[11px] disabled:opacity-50 cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={simpan}
          disabled={menyimpan}
          className="bg-Adjung-maroon text-white px-3 py-1 rounded font-semibold text-[11px] disabled:opacity-50 cursor-pointer"
        >
          {menyimpan ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
};

export default PenugasanEditorPopover;
