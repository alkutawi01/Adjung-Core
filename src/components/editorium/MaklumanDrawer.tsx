import React, { useEffect } from 'react';
import { X, Pin } from 'lucide-react';

// Peti Makluman (2026-08-01, spesifikasi pemilik projek) — laci gelongsor yang memaparkan nota
// AKTIF daripada Ketua Editor tanpa editor perlu meninggalkan halaman yang sedang dibuka.
//
// Ia PEMBACA sahaja: tiada cipta/sunting/arkib di sini. Semua pengurusan nota berlaku di konsol
// Nota Ketua Editor (Kandungan → Nota Ketua Editor). Sebabnya: laci ni dibuka di tengah-tengah
// kerja lain, jadi ia patut memaklumkan, bukan menarik editor masuk ke tugas pentadbiran.
//
// Data datang daripada laluan Editorium (`/api/system/editor-notes`), jadi nota dalaman DAN awam
// kelihatan di sini — kedua-duanya memang ditujukan kepada pasukan editorial.
interface Nota {
  id: string;
  tajuk: string;
  kandungan: string;
  kategori: string;
  skop: 'dalaman' | 'awam';
  disemat: boolean;
  penulis: string;
  dibuatPada: string;
}

interface MaklumanDrawerProps {
  nota: Nota[];
  memuat: boolean;
  onTutup: () => void;
}

const LABEL_KATEGORI: Record<string, string> = { notis: 'Notis', am: 'Nota Am', khas: 'Nota Khas' };

const tarikhRingkas = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const MaklumanDrawer: React.FC<MaklumanDrawerProps> = ({ nota, memuat, onTutup }) => {
  // Escape menutup laci — ia menutupi kerja yang sedang dibuat, jadi mesti ada jalan keluar pantas
  // yang tak perlu menyasarkan tetikus ke butang X.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTutup]);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-stone-900/50 backdrop-blur-xs" onClick={onTutup}>
      <aside
        className="w-full max-w-md h-full bg-[#FDFDFD] border-l border-stone-200 shadow-2xl flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-none px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-medium text-stone-900 leading-none">Peti Makluman</h2>
            <p className="text-stone-500 text-[11px] mt-1">Nota semasa daripada Ketua Editor.</p>
          </div>
          <button
            type="button"
            onClick={onTutup}
            className="text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
            title="Tutup (Escape)"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {memuat ? (
            <p className="text-stone-400 text-xs py-10 text-center">Memuatkan makluman…</p>
          ) : nota.length === 0 ? (
            <p className="text-stone-400 text-xs py-12 text-center px-6">
              Tiada makluman semasa. Nota daripada Ketua Editor akan muncul di sini.
            </p>
          ) : (
            <ul className="list-none m-0 p-0 divide-y divide-stone-100">
              {nota.map((n) => (
                <li key={n.id} className="px-5 py-4 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {n.disemat && (
                      <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider font-bold text-[#802334]">
                        <Pin className="w-2.5 h-2.5" /> Disemat
                      </span>
                    )}
                    <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
                      {LABEL_KATEGORI[n.kategori] || n.kategori}
                    </span>
                    {n.skop === 'awam' && (
                      <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-[#802334] border border-[#802334]/30 bg-[#802334]/[0.06] px-1.5 py-0.5 rounded">
                        Awam
                      </span>
                    )}
                    <span className="font-mono text-[9px] text-stone-400">{tarikhRingkas(n.dibuatPada)}</span>
                  </div>
                  <p className="font-serif text-[15px] leading-snug text-stone-900">{n.tajuk}</p>
                  <p className="text-stone-600 text-xs whitespace-pre-wrap leading-relaxed">{n.kandungan}</p>
                  {n.penulis && <p className="text-stone-400 text-[10px]">Ditulis oleh {n.penulis}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex-none px-5 py-3 border-t border-stone-200 text-stone-400 text-[10px] leading-relaxed">
          Makluman diuruskan di Kandungan → Nota Ketua Editor.
        </footer>
      </aside>
    </div>
  );
};

export default MaklumanDrawer;
