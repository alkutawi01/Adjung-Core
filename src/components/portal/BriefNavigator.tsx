import React from 'react';
import { BidangIcon } from '../common/BidangIcon';
import { Menu, X } from 'lucide-react';

// BriefNavigator — sidebar navigasi Bidang di margin kiri frontpage (2026-08-31).
//
// Sejarah reka bentuk: permintaan asal Izzat — "susah nak cari/baca kandungan yg diminati
// kalau mengharapkan carousel bertukar". Dua percubaan awal (rail nipis + panel hover, kemudian
// wheel skrol terapung) ditolak semasa Izzat cuba sendiri — rail terlalu halus untuk disedari,
// wheel kurang jelas untuk pengguna biasa. Reka bentuk MUKTAMAD (semakan ketiga): sidebar slide
// klasik, dicetuskan tab tetap yang sentiasa kelihatan (bukan hover tersembunyi).
//
// SEMPADAN TANGGUNGJAWAB (kontrak disahkan bersama ChatGPT semasa audit awal, kekal terpakai):
// - Komponen ni memiliki: buka/tutup sidebar, Bidang dipilih (accordion), navigasi papan
//   kekunci tempatan, animasi slide.
// - Komponen ni TIDAK memiliki: data kandungan, definisi "aktif", panggilan API, atau FocusLoc
//   state — semua tu kekal di FrontpageView (pemilik data sedia ada), dihantar sebagai props.
// - `onOpenNews` MESTI menerima FocusLoc {slotIndex, itemIndex}, BUKAN objek berita mentah —
//   openFocus() sedia ada (FrontpageView.tsx) padan objek guna PERSAMAAN RUJUKAN, jadi hantar
//   objek yang dibina semula (bukan rujukan asal) akan gagal senyap. Guna openFocusLoc terus.

export type FocusLoc = { slotIndex: number; itemIndex: number };
export type NavigatorNewsItem = { objectId: string; title: string; loc: FocusLoc };
export type NavigatorField = {
  name: string;
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

const locSama = (a: FocusLoc | null | undefined, b: FocusLoc | null | undefined): boolean =>
  !!a && !!b && a.slotIndex === b.slotIndex && a.itemIndex === b.itemIndex;

export default function BriefNavigator({ fields, currentLoc, onOpenNews }: BriefNavigatorProps) {
  const [terbuka, setTerbuka] = React.useState(false);
  const [bidangDibuka, setBidangDibuka] = React.useState<string | null>(null);
  const navRef = React.useRef<HTMLDivElement>(null);

  // Bidang accordion terbuka lapuk (data refresh) tak lagi wujud — tutup accordion, jangan
  // tergantung papar senarai kosong (corak sama isu 2026-08-31 versi rail/wheel).
  React.useEffect(() => {
    if (bidangDibuka && !fields.some((f) => f.name === bidangDibuka)) {
      setBidangDibuka(null);
    }
  }, [fields, bidangDibuka]);

  if (fields.length === 0) return null;

  const togolBidang = (nama: string) => {
    setBidangDibuka((semasa) => (semasa === nama ? null : nama));
  };
  const tutupSidebar = () => {
    setTerbuka(false);
  };
  const pilihBerita = (loc: FocusLoc) => {
    onOpenNews(loc);
    tutupSidebar();
  };

  // Keyboard TEMPATAN sahaja (bukan window listener) — Focus View sendiri sudah memasang
  // window.keydown (Escape/anak panah) untuk navigasi artikel; kalau navigator turut pasang
  // global, kedua-dua sistem boleh bertindak balas serentak pada kekunci sama.
  const onKeyDownNav = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (bidangDibuka) setBidangDibuka(null);
      else tutupSidebar();
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
          aria-label="Buka navigasi Slot"
          aria-expanded={false}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-[61] bg-[var(--surface-page)] border border-l-0 border-[var(--border-default)] rounded-r-md shadow-md w-7 h-14 flex items-center justify-center text-stone-500 hover:text-Adjung-maroon transition-colors"
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

      {/* Sidebar itu sendiri — slide dari kiri. */}
      <div
        className={`maroon-scrollbar fixed left-0 top-0 bottom-0 z-[60] w-[280px] max-w-[80vw] bg-[var(--surface-page)] border-r border-[var(--border-default)] shadow-xl overflow-y-auto transition-transform ${
          terbuka ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ transitionDuration: '220ms', transitionTimingFunction: 'cubic-bezier(.2,.8,.2,1)' }}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-default)]">
          {/* Label PAPARAN sahaja "Slot" (permintaan Izzat — pembaca awam tak kenal istilah
              dalaman "Bidang"). Kod/pembolehubah/CLAUDE.md KEKAL guna "Bidang" (istilah produk
              sebenar); JANGAN ubah nama fungsi/prop/komen ikut label ni. */}
          <span className="font-serif text-[var(--text-15)] font-bold text-[var(--text-heading)]">Slot</span>
          <button type="button" onClick={tutupSidebar} aria-label="Tutup" className="text-stone-500 hover:text-Adjung-maroon">
            <X size={16} />
          </button>
        </div>

        <div className="py-1.5">
          {fields.map((f) => {
            const dibuka = f.name === bidangDibuka;
            return (
              <div key={f.name} className="border-b border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => togolBidang(f.name)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left font-mono text-[9px] md:text-[10px] uppercase tracking-widest font-bold transition-colors ${
                    dibuka ? 'text-Adjung-maroon bg-stone-150' : 'text-[var(--text-heading)] hover:bg-stone-150 hover:text-Adjung-maroon'
                  }`}
                >
                  {(f.icon || f.iconSvg) && (
                    <span className="flex-shrink-0 inline-flex items-center" style={{ width: 11, height: 11 }}>
                      <BidangIcon iconName={f.icon} iconSvg={f.iconSvg} color="currentColor" variant="bare" size={11} />
                    </span>
                  )}
                  <span className="flex-1 truncate">{f.name}</span>
                </button>
                {dibuka && (
                  // maxHeight+overflow SENDIRI (bukan biar sidebar induk membesar tanpa had) —
                  // 10 tajuk pada saiz besar boleh jadikan SATU accordion lebih tinggi drpd
                  // skrin (permintaan Izzat: "bayangkan ada 10 tajuk"), jadi had ke ~4 baris
                  // kelihatan lalu skrol dalam kotak sendiri sahaja.
                  <div className="maroon-scrollbar bg-stone-100 px-2 pb-2 overflow-y-auto" style={{ maxHeight: 168 }}>
                    {f.news.map((item, idx) => {
                      const semasa = locSama(currentLoc, item.loc);
                      return (
                        <button
                          key={item.objectId}
                          type="button"
                          onClick={() => pilihBerita(item.loc)}
                          className={`w-full flex gap-2 px-2 py-1.5 text-left rounded transition-colors ${
                            semasa ? 'text-Adjung-maroon' : 'text-[var(--text-heading)] hover:bg-white hover:text-Adjung-maroon'
                          }`}
                        >
                          <span className="font-mono text-[9px] text-stone-500 flex-shrink-0 pt-px">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="font-sans text-[11px] leading-snug">{item.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
