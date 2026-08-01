import React, { useState } from 'react';
import {
  List, FileEdit, Bell, Zap, LayoutGrid, BookOpen, FolderOpen, Settings, History, Landmark, Palette,
  LogOut, LogIn, PenLine, Mail, Lock, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
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
  // Peti Makluman (2026-08-01) — laci nota Ketua Editor. Kiraan datang daripada EditoriumView
  // (pemilik data nota), bukan diambil sendiri di sini, supaya laci dan lencana sentiasa membaca
  // senarai yang SAMA — bukan dua panggilan berasingan yang boleh terpesong.
  onOpenMakluman?: () => void;
  jumlahMakluman?: number;
  children?: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  Icon: any;
  restricted?: boolean;
}

// Sidebar menegak dua kumpulan (2026-08-01, permintaan pemilik projek — susun macam contoh yang
// ditunjuk, bukan salinan terus cabang antigravity/simulasi) — setiap destinasi SATU klik, tiada
// lagi lapisan kategori-lepas-sub-tab. Kandungan dan Slot kekal ada sub-tab SENDIRI dalam
// EditoriumView.tsx (Indeks/Semakan, Senarai/Tier/Bidang/Tetapan Am) — itu keperluan sebenar bagi
// dua destinasi tu, bukan lapisan navigasi tambahan.
const OPERASI_HARIAN: NavItem[] = [
  { id: 'kandungan', label: 'Kandungan', Icon: List },
  { id: 'draf_saya', label: 'Draf Saya', Icon: FileEdit },
  { id: 'nota_ketua_editor', label: 'Nota Ketua Editor', Icon: Bell },
  { id: 'modul_khas', label: 'Modul Khas', Icon: Zap },
  { id: 'slot', label: 'Slot', Icon: LayoutGrid },
];

const TATA_KELOLA: NavItem[] = [
  { id: 'editorial', label: 'Editorial', Icon: BookOpen },
  { id: 'direktori', label: 'Direktori', Icon: FolderOpen },
  { id: 'tetapan', label: 'Tetapan', Icon: Settings },
  { id: 'log_audit', label: 'Log Audit', Icon: History },
  { id: 'perlembagaan', label: 'Perlembagaan', Icon: Landmark },
  { id: 'reka_bentuk', label: 'Reka Bentuk', Icon: Palette },
];

export const EditoriumLayout: React.FC<EditoriumLayoutProps> = ({
  activeTab = 'kandungan',
  onTabChange,
  currentUser = null,
  onRequestLogin,
  onLogout,
  onOpenSlotPicker,
  onOpenMakluman,
  jumlahMakluman = 0,
  children
}) => {
  const [currentTab, setCurrentTab] = useState(activeTab);
  // Sidebar boleh dilipat jadi rel ikon sahaja (2026-08-01, permintaan pemilik projek) — jadual
  // panjang macam Indeks perlukan lebar penuh, editor tak sepatutnya terpaksa skrol mendatar
  // untuk lihat lajur Tindakan hanya sebab sidebar sentiasa ambil 240px. Keadaan disimpan supaya
  // kekal antara sesi (bukan reset setiap kali buka Editorium).
  const [dilipat, setDilipat] = useState(() => {
    try { return localStorage.getItem('adjung-editorium-sidebar-lipat') === '1'; } catch { return false; }
  });
  const togolLipat = () => {
    setDilipat((v) => {
      const next = !v;
      try { localStorage.setItem('adjung-editorium-sidebar-lipat', next ? '1' : '0'); } catch { /* localStorage tak tersedia — tak kritikal */ }
      return next;
    });
  };

  const handleNavClick = (tabId: string) => {
    setCurrentTab(tabId);
    if (onTabChange) onTabChange(tabId);
  };

  // Belum log masuk = TIADA destinasi boleh dibuka. Dulu semua tab masih boleh diklik: tab
  // bertukar aktif tapi kandungan kekal skrin pagar, jadi nav nampak macam rosak.
  const loggedOut = !currentUser;

  // Editorial DAN Tetapan (2026-08-01) — dua-dua Ketua Editor sahaja. Editorial ubah peraturan
  // bahasa/templat AI sistem-lebar; Tetapan ubah tetapan sistem. Kedua-duanya bukan kerja editor
  // biasa.
  const restricted = (id: string) => (id === 'editorial' || id === 'tetapan') && currentUser?.role !== 'KETUA_EDITOR';

  const renderKumpulan = (tajuk: string, items: NavItem[]) => (
    <div className="space-y-1">
      {!dilipat && (
        <div className="px-3 font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400 mb-1.5">
          {tajuk}
        </div>
      )}
      <div className="space-y-0.5">
        {items.map((item) => {
          const isActive = currentTab === item.id && !loggedOut;
          const isLocked = loggedOut || restricted(item.id);
          const { Icon } = item;
          const butang = (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              disabled={isLocked}
              aria-disabled={isLocked}
              title={
                loggedOut ? 'Log masuk dahulu untuk membuka destinasi ini'
                : restricted(item.id) ? 'Hanya Ketua Editor'
                : dilipat ? item.label : undefined
              }
              className={`w-full flex items-center gap-2 text-xs font-medium py-2 rounded-lg transition-colors duration-150 ${
                dilipat ? 'justify-center px-2' : 'justify-between px-3'
              } ${
                isActive
                  ? 'bg-[#802334] text-white font-semibold'
                  : isLocked
                  ? 'text-stone-300 cursor-not-allowed'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-black/[0.04] cursor-pointer'
              }`}
            >
              <span className={`flex items-center gap-2.5 min-w-0 ${dilipat ? 'justify-center' : ''}`}>
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-stone-400'}`} strokeWidth={2.2} />
                {!dilipat && <span className="truncate">{item.label}</span>}
              </span>
              {!dilipat && !loggedOut && restricted(item.id) && <Lock className="w-3 h-3 shrink-0 text-stone-300" strokeWidth={2.2} />}
            </button>
          );
          return butang;
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1F1F1F] font-sans antialiased">
      {/* Editorium Header — bar identiti sahaja, maroon jelas. */}
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
                {/* Peti Makluman (2026-08-01, spesifikasi pemilik projek) — nota Ketua Editor
                    dicapai dari mana-mana halaman, tanpa meninggalkan kerja yang sedang dibuat.
                    Lencana kiraan hanya muncul apabila benar-benar ada nota. */}
                {onOpenMakluman && (
                  <button
                    type="button"
                    onClick={onOpenMakluman}
                    title="Peti Makluman — nota Ketua Editor"
                    className="relative flex items-center gap-1.5 bg-white/[0.08] backdrop-blur-xl px-2.5 py-1 rounded-full border border-white/[0.1] text-white/80 hover:text-white hover:bg-white/[0.14] transition-colors cursor-pointer"
                  >
                    <Mail className="w-3 h-3" /> Makluman
                    {jumlahMakluman > 0 && (
                      <span className="font-mono text-[9px] font-bold bg-[#e0b7bd] text-[#5c1624] rounded-full px-1.5 leading-[1.35]">
                        {jumlahMakluman}
                      </span>
                    )}
                  </button>
                )}
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

      {/* Badan halaman: sidebar OVERLAY terapung (2026-08-01) — kembangkan sidebar TIDAK
          menolak/mengengsotkan kandungan ke kanan. `main` sentiasa kekal pada margin rel-ikon
          (72px, w-[4.5rem]) tak kira sidebar dilipat atau dikembang; lebar tambahan bila
          dikembangkan (240px - 72px) melayang ATAS kandungan (bayang jelas jadi petanda ia
          terapung), bukan tolak kandungan. Ini jugalah sebabnya jadual lebar macam Indeks tak
          perlu skrol mendatar sekadar sebab sidebar terbuka. */}
      <div className="relative flex flex-col">
        <aside
          className={`hidden md:flex md:flex-col fixed left-0 top-[42px] h-[calc(100vh-42px)] z-30 overflow-y-auto bg-[#F6F4EF] border-r border-stone-200 p-4 gap-6 transition-[width] duration-150 ${
            dilipat ? 'w-[4.5rem]' : 'w-60 shadow-[4px_0_16px_rgba(0,0,0,0.08)]'
          }`}
        >
          <div className="flex-1 space-y-6">
            {renderKumpulan('Operasi Harian', OPERASI_HARIAN)}
            <div className="border-t border-stone-200 pt-4">
              {renderKumpulan('Tata Kelola & Rujukan', TATA_KELOLA)}
            </div>
          </div>
          {/* Togol lipat (2026-08-01) — jadual lebar macam Indeks perlukan ruang penuh; sidebar
              240px sentiasa terbuka memaksa skrol mendatar untuk lihat lajur Tindakan. */}
          <button
            type="button"
            onClick={togolLipat}
            title={dilipat ? 'Kembangkan sidebar' : 'Lipatkan sidebar'}
            className="flex items-center justify-center gap-2 text-stone-400 hover:text-stone-700 hover:bg-black/[0.04] rounded-lg py-2 transition-colors cursor-pointer"
          >
            {dilipat ? <ChevronsRight className="w-4 h-4" /> : <><ChevronsLeft className="w-4 h-4" /><span className="text-[11px] font-medium">Lipatkan</span></>}
          </button>
        </aside>

        {/* Sidebar dibalut jadi bar mendatar boleh skrol pada skrin sempit (< md) — bukan
            disembunyikan terus, atau Editorium jadi tak boleh dinavigasi pada telefon/tablet. */}
        <nav className="md:hidden w-full overflow-x-auto flex gap-1 px-3 py-2 border-b border-stone-200 bg-[#F6F4EF]">
          {[...OPERASI_HARIAN, ...TATA_KELOLA].map((item) => {
            const isActive = currentTab === item.id && !loggedOut;
            const isLocked = loggedOut || restricted(item.id);
            const { Icon } = item;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                disabled={isLocked}
                className={`shrink-0 flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                  isActive ? 'bg-[#802334] text-white font-semibold' : isLocked ? 'text-stone-300' : 'text-stone-600 bg-white border border-stone-200'
                }`}
              >
                <Icon className="w-3 h-3" strokeWidth={2.2} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* pl-[4.5rem] tetap (SAMA seperti lebar rel ikon) tak kira dilipat atau dikembang —
            itulah yang menghalang kandungan daripada bergerak bila togol ditekan. */}
        <main className="min-w-0 p-4 md:py-8 md:pr-8 md:pl-[4.5rem]">
          {children}
        </main>
      </div>

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
