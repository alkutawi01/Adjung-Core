import React, { useState } from 'react';
import { List, LayoutGrid, Settings, Landmark, LogOut, LogIn, PenLine } from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { BRAND } from '../../config/brand';

interface EditoriumLayoutProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  // null = belum log masuk.
  currentUser?: { name: string; role: 'KETUA_EDITOR' | 'EDITOR' } | null;
  onRequestLogin?: () => void;
  onLogout?: () => void;
  // Buka pemilih slot "Tulis Kandungan" — dipunyai & dirender oleh EditoriumView sendiri
  // (2026-07-29, useSlotEditor — Editorium dan Frontpage dipisah 100%, tiada navigasi/
  // parameter URL merentas laman lagi).
  onOpenSlotPicker?: () => void;
  children?: React.ReactNode;
}

export const EditoriumLayout: React.FC<EditoriumLayoutProps> = ({
  activeTab = 'kandungan',
  onTabChange,
  currentUser = null,
  onRequestLogin,
  onLogout,
  onOpenSlotPicker,
  children
}) => {
  const [currentTab, setCurrentTab] = useState(activeTab);

  const handleNavClick = (tabId: string) => {
    setCurrentTab(tabId);
    if (onTabChange) onTabChange(tabId);
  };

  // Belum log masuk = TIADA tab boleh dibuka. Dulu semua tab masih boleh diklik: tab bertukar
  // aktif tapi kandungan kekal skrin pagar, jadi nav nampak macam rosak.
  const loggedOut = !currentUser;

  // Nav peringkat kategori (2026-08-01, permintaan pemilik projek) — 9 tab mendatar disusun
  // semula jadi 4 kategori. Setiap kategori buka baris sub-tab sendiri (EditoriumView.tsx), corak
  // sama yang sudah wujud untuk Kandungan/Slot sebelum ni — kini terpakai serata Editorium, bukan
  // dua tempat sahaja. Tiada satu pun kategori disekat peringkat ni; sekatan peranan (Tetapan)
  // kekal di peringkat SUB-tab dalam Pentadbiran.
  const navItems = [
    { id: 'kandungan', label: 'Kandungan', Icon: List },
    { id: 'slot', label: 'Slot', Icon: LayoutGrid },
    { id: 'pentadbiran', label: 'Pentadbiran', Icon: Settings },
    { id: 'rujukan', label: 'Rujukan', Icon: Landmark },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1F1F1F] font-sans flex flex-col antialiased">
      {/* Editorium Header — bar identiti sahaja, maroon jelas (bukan hampir-hitam). Navigasi kini
          ELEMEN BERASINGAN di bawah, duduk atas latar cream badan halaman (gaya iOS: bar status
          bertona di atas, toolbar kaca lut sinar atas kandungan terang di bawah). */}
      <header className="relative bg-Adjung-maroon-dark text-[#FDFDFD] select-none overflow-hidden">
        <div className="relative px-4 md:px-8 py-2 flex flex-wrap justify-between items-center gap-3">
          <Tooltip text="Klik untuk kembali ke Frontpage">
            <a href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity select-none">
              <span className="font-serif font-normal text-lg tracking-tight text-[#FDFDFD] leading-none">{BRAND.logoText}</span>
              <span className="font-sans text-[9px] tracking-[0.22em] font-semibold text-[#c9929a] uppercase leading-none border-l border-white/15 pl-2.5">
                {BRAND.subLabel} · Editorium
              </span>
            </a>
          </Tooltip>

          <div className="flex items-center gap-2.5 font-sans text-[11px]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif' }}>
            {currentUser ? (
              <>
                {/* "+ Tulis Kandungan" (2026-07-29, permintaan pemilik projek) — Editorium dan
                    Frontpage dipisah 100% sekarang; modal (pemilih slot + borang) render TERUS
                    dalam EditoriumView sendiri (useSlotEditor, mandiri, tiada pergantungan pada
                    FrontpageView), tiada navigasi/parameter URL lagi. */}
                {onOpenSlotPicker && (
                  <button
                    type="button"
                    onClick={onOpenSlotPicker}
                    className="flex items-center gap-1.5 bg-white text-[#802334] px-2.5 py-1 rounded-full font-bold hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    <PenLine className="w-3 h-3" /> Tulis Kandungan
                  </button>
                )}
                <div className="flex items-center gap-2 bg-white/[0.08] backdrop-blur-xl px-2.5 py-1 rounded-full border border-white/[0.1]">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                    <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-stone-100 font-medium">{currentUser.name}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-[#e0b7bd]">{currentUser.role === 'KETUA_EDITOR' ? 'Ketua Editor' : 'Editor'}</span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-1 bg-white/[0.08] backdrop-blur-xl px-2.5 py-1 rounded-full border border-white/[0.1] text-white/70 hover:text-white transition-colors"
                  >
                    <LogOut className="w-3 h-3" /> Log Keluar
                  </button>
                )}
              </>
            ) : (
              onRequestLogin && (
                <button
                  onClick={onRequestLogin}
                  className="flex items-center gap-1.5 bg-white/[0.08] backdrop-blur-xl px-3 py-1 rounded-full border border-white/[0.1] text-white hover:bg-white/[0.15] transition-colors font-medium"
                >
                  <LogIn className="w-3.5 h-3.5" /> Log Masuk
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* Navigasi — elemen berasingan drpd header, kapsul kaca TERANG (bukan gelap) duduk atas
          latar cream badan halaman. Jarak jelas drpd header (bukan bersentuh/bertindih). */}
      {/* Bila tetingkap sempit, nav BALUT ke baris seterusnya — bukan skrol mendatar. Dulu
          `overflow-x-auto` di sini melukis skrolbar Windows yang memotong kapsul kaca nav. */}
      <div className="relative z-10 flex justify-center px-4 pt-4 pb-2">
        <nav
          className="flex flex-wrap justify-center items-center gap-1 bg-white/70 backdrop-blur-2xl p-1 rounded-[1.5rem] border border-black/[0.06] shadow-[0_8px_24px_-6px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.06)]"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif' }}
        >
          {navItems.map(item => {
            const isActive = currentTab === item.id && !loggedOut;
            const { Icon } = item;
            // Belum log masuk = SEMUA kategori terkunci (skrin pagar di tengah sudah menerangkan
            // sebabnya). Sekatan peranan (Tetapan) tidak lagi wujud di peringkat kategori ni sejak
            // ia dipindah jadi sub-tab dalam Pentadbiran — lihat EditoriumView.tsx.
            const isLocked = loggedOut;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                disabled={isLocked}
                aria-disabled={isLocked}
                title={loggedOut ? 'Log masuk dahulu untuk membuka tab ini' : undefined}
                className={`relative flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-[#802334] shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
                    : isLocked
                    ? 'text-stone-400 cursor-not-allowed'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-black/[0.03]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content Workspace Area */}
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-stone-100 px-4 md:px-8 py-3 font-sans text-xs text-stone-500 flex flex-wrap justify-between items-center gap-2 select-none">
        <div>
          Adjung Brief Editorium • Editorial Control System
        </div>
        <div className="flex items-center gap-1.5">
          Status Sistem:
          <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            Dilindungi &amp; Aktif
          </span>
        </div>
      </footer>
    </div>
  );
};

export default EditoriumLayout;
