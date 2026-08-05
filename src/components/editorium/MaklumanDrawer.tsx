import React, { useEffect } from 'react';
import { X, Pin, Rss, CloudOff, KeyRound, UserCog, CheckCircle2, XCircle, LayoutGrid, Bell, AlertTriangle, Link2Off } from 'lucide-react';

// Peti Makluman (2026-08-01, spesifikasi pemilik projek) — laci gelongsor yang memaparkan
// makluman AKTIF tanpa editor perlu meninggalkan halaman yang sedang dibuka.
//
// Ia PEMBACA sahaja: tiada cipta/sunting/arkib di sini. Nota Ketua Editor diuruskan di konsol
// berasingan (Kandungan → Nota Ketua Editor).
//
// Fasa 6b (2026-08-02) — dahulu SATU sumber sahaja (`editor_notes`, nota Ketua Editor). Kini
// senarai GABUNGAN dua sumber: `editor_notes` (nota Ketua Editor, KEKAL — bukan digantikan) DAN
// `notifications` (jadual baharu PER-EDITOR: kandungan disiar/ditolak/penugasan slot, sistem
// RSS/cuaca gagal/kata laluan ditukar/akaun digantung-diaktifkan). Setiap item ditanda jenisnya
// sendiri (ikon + label) supaya kedua-dua sumber kelihatan sebagai SATU senarai konsisten, bukan
// dua bahagian terpisah dalam laci sama.
interface Nota {
  id: string;
  jenisSumber: 'nota_ketua_editor';
  tajuk: string;
  kandungan: string;
  kategori: string;
  skop: 'dalaman' | 'awam';
  disemat: boolean;
  penulis: string;
  dibuatPada: string;
}

interface Notifikasi {
  id: string;
  jenisSumber: 'notifikasi';
  jenis: string;
  tajuk: string;
  kandungan: string;
  dibaca: boolean;
  dibuatPada: string;
}

type ItemMakluman = Nota | Notifikasi;

interface MaklumanDrawerProps {
  nota: Nota[];
  notifikasi: Notifikasi[];
  memuat: boolean;
  onTutup: () => void;
  onKlikNotifikasi: (id: string) => void;
}

const LABEL_KATEGORI: Record<string, string> = { notis: 'Notis', am: 'Nota Am', khas: 'Nota Khas' };

// Ikon + label ringkas ikut jenis notifikasi (Fasa 6b) — bantu editor imbas cepat jenis apa
// tanpa baca setiap tajuk sepenuhnya.
const IKON_JENIS: Record<string, React.ReactNode> = {
  kandungan_disiar: <CheckCircle2 className="w-2.5 h-2.5" />,
  kandungan_ditolak: <XCircle className="w-2.5 h-2.5" />,
  kandungan_terbit_berjadual: <CheckCircle2 className="w-2.5 h-2.5" />,
  kandungan_luput_berjadual: <XCircle className="w-2.5 h-2.5" />,
  kandungan_penugasan_slot: <LayoutGrid className="w-2.5 h-2.5" />,
  sistem_rss_gagal: <Rss className="w-2.5 h-2.5" />,
  sistem_cuaca_gagal: <CloudOff className="w-2.5 h-2.5" />,
  sistem_kata_laluan_ditukar: <KeyRound className="w-2.5 h-2.5" />,
  sistem_akaun_digantung: <UserCog className="w-2.5 h-2.5" />,
  sistem_akaun_diaktifkan: <UserCog className="w-2.5 h-2.5" />,
  // Fasa "Peti Makluman menyeluruh" (2026-08-05, permintaan pemilik projek — "setiap ralat/
  // perkara penting patut sampai Peti Makluman").
  sistem_ralat_pelayan: <AlertTriangle className="w-2.5 h-2.5" />,
  sistem_pautan_mati: <Link2Off className="w-2.5 h-2.5" />,
};

const LABEL_JENIS: Record<string, string> = {
  kandungan_disiar: 'Kandungan Disiar',
  kandungan_ditolak: 'Kandungan Ditolak',
  kandungan_terbit_berjadual: 'Terbit Berjadual',
  kandungan_luput_berjadual: 'Luput Berjadual',
  kandungan_penugasan_slot: 'Penugasan Slot',
  sistem_rss_gagal: 'Sistem — RSS',
  sistem_cuaca_gagal: 'Sistem — Cuaca',
  sistem_kata_laluan_ditukar: 'Sistem — Akaun',
  sistem_akaun_digantung: 'Sistem — Akaun',
  sistem_akaun_diaktifkan: 'Sistem — Akaun',
  sistem_ralat_pelayan: 'Sistem — Ralat Pelayan',
  sistem_pautan_mati: 'Sistem — Pautan Mati',
};

const tarikhRingkas = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const MaklumanDrawer: React.FC<MaklumanDrawerProps> = ({ nota, notifikasi, memuat, onTutup, onKlikNotifikasi }) => {
  // Escape menutup laci — ia menutupi kerja yang sedang dibuat, jadi mesti ada jalan keluar pantas
  // yang tak perlu menyasarkan tetikus ke butang X.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTutup]);

  // Senarai gabungan, tersusun terbaharu dahulu — nota disemat tetap naik ke atas dalam
  // kumpulannya sendiri (peraturan sedia ada), notifikasi disisipkan ikut tarikh sahaja.
  const senarai: ItemMakluman[] = [...nota, ...notifikasi].sort((a, b) => {
    const semat = (a.jenisSumber === 'nota_ketua_editor' && a.disemat) ? 1 : 0;
    const sematB = (b.jenisSumber === 'nota_ketua_editor' && b.disemat) ? 1 : 0;
    if (semat !== sematB) return sematB - semat;
    return new Date(b.dibuatPada).getTime() - new Date(a.dibuatPada).getTime();
  });

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-stone-900/50 backdrop-blur-xs" onClick={onTutup}>
      <aside
        className="w-full max-w-md h-full bg-[#FDFDFD] border-l border-stone-200 shadow-2xl flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-none px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-medium text-stone-900 leading-none">Peti Makluman</h2>
            <p className="text-stone-500 text-[11px] mt-1">Nota Ketua Editor dan notifikasi anda.</p>
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
          ) : senarai.length === 0 ? (
            <p className="text-stone-400 text-xs py-12 text-center px-6">
              Tiada makluman semasa. Nota daripada Ketua Editor dan notifikasi akan muncul di sini.
            </p>
          ) : (
            <ul className="list-none m-0 p-0 divide-y divide-stone-100">
              {senarai.map((n) => {
                if (n.jenisSumber === 'notifikasi') {
                  return (
                    <li
                      key={`notif-${n.id}`}
                      onClick={() => !n.dibaca && onKlikNotifikasi(n.id)}
                      className={`px-5 py-4 space-y-1.5 ${!n.dibaca ? 'bg-[#802334]/[0.04] cursor-pointer' : ''}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {!n.dibaca && <span className="w-1.5 h-1.5 rounded-full bg-[#802334]" aria-hidden />}
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
                          {IKON_JENIS[n.jenis] || <Bell className="w-2.5 h-2.5" />}
                          {LABEL_JENIS[n.jenis] || n.jenis}
                        </span>
                        <span className="font-mono text-[9px] text-stone-400">{tarikhRingkas(n.dibuatPada)}</span>
                      </div>
                      <p className="font-serif text-[15px] leading-snug text-stone-900">{n.tajuk}</p>
                      {n.kandungan && <p className="text-stone-600 text-xs whitespace-pre-wrap leading-relaxed">{n.kandungan}</p>}
                    </li>
                  );
                }
                return (
                  <li key={`nota-${n.id}`} className="px-5 py-4 space-y-1.5">
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
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex-none px-5 py-3 border-t border-stone-200 text-stone-400 text-[10px] leading-relaxed">
          Nota Ketua Editor diuruskan di Kandungan → Nota Ketua Editor.
        </footer>
      </aside>
    </div>
  );
};

export default MaklumanDrawer;
