import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BidangIcon } from '../common/BidangIcon';
import { Menu, X } from 'lucide-react';

// BriefNavigator — sidebar navigasi Bidang di margin kiri frontpage (2026-08-31, disemak
// 2026-09-01 untuk Halaman Bidang).
//
// Sejarah reka bentuk: permintaan asal Izzat — "susah nak cari/baca kandungan yg diminati
// kalau mengharapkan carousel bertukar". Dua percubaan awal (rail nipis + panel hover, kemudian
// wheel skrol terapung) ditolak semasa Izzat cuba sendiri — rail terlalu halus untuk disedari,
// wheel kurang jelas untuk pengguna biasa. Percubaan ketiga (accordion INLINE) dan keempat
// (GANTI seluruh sidebar ke senarai berita, header "← Slot" untuk balik) turut digantikan
// (2026-09-01, spesifikasi Halaman Bidang MUKTAMAD) — klik nama/ikon Bidang kini NAVIGASI TERUS
// ke /bidang/{slug} (halaman penuh, bukan senarai dalam sidebar). Sidebar ni kini HANYA papar
// senarai Bidang (mod "senarai berita dalam sidebar" dibuang sepenuhnya — bidangDipapar,
// bukaSenaraiBerita/balikSenaraiBidang, blok bidangAktif semua dibuang).
//
// SEMPADAN TANGGUNGJAWAB (kontrak disahkan bersama ChatGPT semasa audit awal, kekal terpakai):
// - Komponen ni memiliki: buka/tutup sidebar, navigasi papan kekunci tempatan, animasi slide.
// - Komponen ni TIDAK memiliki: data kandungan, definisi "aktif", panggilan API, atau FocusLoc
//   state — semua tu kekal di FrontpageView (pemilik data sedia ada), dihantar sebagai props.

export type FocusLoc = { slotIndex: number; itemIndex: number };
export type NavigatorNewsItem = { objectId: string; title: string; loc: FocusLoc };
export type NavigatorField = {
  name: string;
  slug: string;
  totalCount: number;
  news: NavigatorNewsItem[];
  icon: string | null;
  iconSvg: string | null;
};

interface BriefNavigatorProps {
  fields: NavigatorField[];
  currentLoc: FocusLoc | null;
  onOpenNews: (loc: FocusLoc) => void;
}

export default function BriefNavigator({ fields }: BriefNavigatorProps) {
  const [terbuka, setTerbuka] = React.useState(false);
  const navRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Kunci skrol LATAR semasa sidebar terbuka (2026-08-31, Izzat: "masa tutup ia tiba2 berada
  // di bawah") — punca sebenar: frontpage di sebalik overlay boleh diskrol semasa sidebar
  // terbuka (tiada kunci sebelum ni), jadi kedudukan skrol berbeza sebaik tutup, dan tab "☰"
  // (fixed, ikut skrin) kelihatan macam "melompat" berbanding kandungan sekeliling walhal ia
  // sendiri tak bergerak sepiksel pun. Pulihkan overflow asal (body mungkin sudah ada
  // peraturan sendiri) bila ditutup/dilupuskan.
  React.useEffect(() => {
    if (!terbuka) return;
    const asal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = asal; };
  }, [terbuka]);

  if (fields.length === 0) return null;

  const tutupSidebar = () => setTerbuka(false);
  const pilihBidang = (slug: string) => {
    tutupSidebar();
    navigate(`/bidang/${slug}`);
  };

  // Keyboard TEMPATAN sahaja (bukan window listener) — Focus View sendiri sudah memasang
  // window.keydown (Escape/anak panah) untuk navigasi artikel; kalau navigator turut pasang
  // global, kedua-dua sistem boleh bertindak balas serentak pada kekunci sama.
  const onKeyDownNav = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      tutupSidebar();
    }
  };

  return (
    <div ref={navRef} onKeyDown={onKeyDownNav} className="brief-navigator">
      {/* Tab pencetus — SENTIASA kelihatan BILA TERTUTUP sahaja (bukan bergantung hover,
          pengajaran daripada versi rail nipis yang terlalu halus untuk disedari). Disorok
          semasa sidebar TERBUKA — Izzat tangkap dua kawalan tutup bertindih (tab "<" dan ×
          header serentak kelihatan, mengelirukan); × header dah cukup untuk tutup. */}
      {!terbuka && (
        <button
          type="button"
          onClick={() => setTerbuka(true)}
          aria-label="Buka navigasi Bidang"
          aria-expanded={false}
          className="fixed left-0 top-[450px] md:top-1/2 md:-translate-y-1/2 z-[61] bg-[var(--surface-page)] border border-l-0 border-[var(--border-default)] rounded-r-md shadow-md w-7 h-14 flex items-center justify-center text-stone-500 hover:text-Adjung-maroon transition-colors"
        >
          <Menu size={16} />
        </button>
      )}

      {/* Overlay latar (mudah alih terutamanya) — klik luar tutup sidebar. */}
      {terbuka && (
        <div
          className="fixed inset-0 z-[59] bg-black/20 md:bg-transparent"
          onClick={tutupSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar itu sendiri — slide dari kiri, tinggi PENUH skrin, SATU scroll sahaja. */}
      <div
        className={`fixed left-0 top-0 bottom-0 z-[60] w-[260px] max-w-[80vw] bg-[var(--surface-page)] border-r border-[var(--border-default)] shadow-xl flex flex-col transition-transform ${
          terbuka ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ transitionDuration: '220ms', transitionTimingFunction: 'cubic-bezier(.2,.8,.2,1)' }}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-default)] flex-shrink-0">
          {/* Label "Bidang" (2026-09-02, Izzat: selaraskan dengan URL /bidang/{slug} — label
              "Slot" (keputusan sementara 2026-08-31) kini digantikan sebab istilah produk
              sebenar "Bidang" sudah terdedah terus kepada pembaca via URL Halaman Bidang). */}
          <span className="font-serif text-[var(--text-15)] font-bold text-[var(--text-heading)]">Bidang</span>
          <button type="button" onClick={tutupSidebar} aria-label="Tutup" className="text-stone-500 hover:text-Adjung-maroon">
            <X size={16} />
          </button>
        </div>
        <div className="maroon-scrollbar py-1.5 overflow-y-auto flex-1">
          {fields.map((f) => (
            <button
              key={f.slug}
              type="button"
              onClick={() => pilihBidang(f.slug)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left font-mono text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-[var(--text-heading)] hover:bg-stone-150 hover:text-Adjung-maroon transition-colors"
            >
              {(f.icon || f.iconSvg) && (
                <span className="flex-shrink-0 inline-flex items-center" style={{ width: 11, height: 11 }}>
                  <BidangIcon iconName={f.icon} iconSvg={f.iconSvg} color="currentColor" variant="bare" size={11} />
                </span>
              )}
              <span className="flex-1 truncate">{f.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
