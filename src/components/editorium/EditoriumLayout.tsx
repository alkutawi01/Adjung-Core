import React, { useState } from 'react';
import {
  List, FileEdit, Bell, Zap, LayoutGrid, BookOpen, FolderOpen, Settings,
  LogOut, LogIn, PenLine, Mail, Lock, BookMarked, FileText, History, Home,
} from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { BRAND } from '../../config/brand';

interface EditoriumLayoutProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  // null = belum log masuk. `roles` (2026-08-02, Fasa 3) — senarai BERBILANG peranan sebenar
  // (pentadbir/ketua_editor/penolong_ketua_editor/editor); `role` legasi kekal untuk label lama.
  currentUser?: { name: string; role: 'KETUA_EDITOR' | 'EDITOR'; roles: string[] } | null;
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
  // Profil Editor (2026-08-01) — buka modal identiti sendiri, dipicu klik badge nama/peranan.
  onOpenProfil?: () => void;
  children?: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  Icon: any;
  restricted?: boolean;
}

// 2026-08-02 (Fasa 3) — label paparan penuh setiap roleId, dipadankan ROLE_META di
// DirektoriConsole.tsx / DEFAULT_RBAC_MATRIX di TetapanConsole.tsx.
const ROLE_LABELS: Record<string, string> = {
  pentadbir: 'Pentadbir',
  ketua_editor: 'Ketua Editor',
  penolong_ketua_editor: 'Penolong Ketua Editor',
  editor: 'Editor',
};

// Paparan Utama (2026-08-02, Fasa 5) — item PERTAMA, DI ATAS kumpulan Penerbitan, destinasi
// lalai selepas log masuk. Berdiri sendiri (bukan sebahagian Penerbitan) — ia "rumah", bukan
// aliran kerja penerbitan.
const UTAMA: NavItem[] = [
  { id: 'paparan_utama', label: 'Paparan Utama', Icon: Home },
];

// Sidebar menegak TIGA kumpulan (2026-08-01, susunan tepat ditetapkan pemilik projek) — setiap
// destinasi SATU klik. Kandungan dan Slot kekal ada sub-tab SENDIRI dalam EditoriumView.tsx
// (Indeks/Semakan, Senarai/Tier/Bidang/Tetapan Am) — itu keperluan sebenar bagi dua destinasi tu,
// bukan lapisan navigasi tambahan.
const PENERBITAN: NavItem[] = [
  { id: 'draf_saya', label: 'Draf Saya', Icon: FileEdit },
  { id: 'kandungan', label: 'Kandungan', Icon: List },
  { id: 'slot', label: 'Slot', Icon: LayoutGrid },
  { id: 'modul_khas', label: 'Modul Khas', Icon: Zap },
  { id: 'editorial', label: 'Editorial', Icon: BookOpen },
];

const PENGURUSAN: NavItem[] = [
  { id: 'nota_ketua_editor', label: 'Nota Ketua Editor', Icon: Bell },
  { id: 'direktori', label: 'Direktori', Icon: FolderOpen },
  { id: 'tetapan', label: 'Tetapan', Icon: Settings },
];

// Rujukan (2026-08-01) — Panduan (panduan penggunaan Editorium, belum dibina), Dokumentasi
// (Peraturan Am + Reka Bentuk), Log Sistem (berdiri sendiri, bukan sub-tab Dokumentasi lagi).
// Nama kumpulan ditukar daripada "Sistem" kepada "Rujukan" atas arahan pemilik projek.
const RUJUKAN: NavItem[] = [
  { id: 'panduan', label: 'Panduan', Icon: BookMarked },
  { id: 'dokumentasi', label: 'Dokumentasi', Icon: FileText },
  { id: 'log_sistem', label: 'Log Sistem', Icon: History },
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
  onOpenProfil,
  children
}) => {
  const [currentTab, setCurrentTab] = useState(activeTab);
  // Sidebar berkelakuan sebagai FLYOUT ringkas (2026-08-01, arahan tepat pemilik projek):
  //   tertutup (rel ikon 72px) secara lalai
  //   klik sidebar          -> terbuka
  //   klik di tempat lain   -> tertutup
  // Tiada butang "Lipatkan" langsung — butang tu redundan sebaik kelakuan buka/tutup jadi
  // automatik, dan ia buat editor rasa terpaksa cari butang dulu sebelum boleh guna Editorium.
  // (Sejarah: hover-untuk-kembang pernah dicuba dan ditolak — ia buat sidebar rasa tak stabil.)
  const [dilipat, setDilipat] = useState(true);

  const handleNavClick = (tabId: string) => {
    setCurrentTab(tabId);
    if (onTabChange) onTabChange(tabId);
    // SENGAJA tak tutup sidebar di sini — cuma DUA cara ia tutup: klik <aside> sendiri (bila
    // sudah terbuka, tiada kesan — lihat onClick <aside>) atau klik backdrop di luar. Memilih
    // destinasi bukan salah satu daripada dua tu.
  };

  // Belum log masuk = TIADA destinasi boleh dibuka. Dulu semua tab masih boleh diklik: tab
  // bertukar aktif tapi kandungan kekal skrin pagar, jadi nav nampak macam rosak.
  const loggedOut = !currentUser;

  // Kebenaran berbilang peranan (2026-08-02, Fasa 3) — lihat DEFAULT_RBAC_MATRIX di
  // TetapanConsole.tsx / DEFAULT_ROLE_PERMISSIONS di core/middleware/auth.js untuk padanan
  // penuh. Ini cuma bayang RINGKAS di client untuk sorok/tunjuk nav — kawalan SEBENAR tetap di
  // server (requirePermission).
  const roles = currentUser?.roles || [];
  const isKetuaEditor = roles.includes('ketua_editor');
  const isEditorialAdmin = isKetuaEditor || roles.includes('penolong_ketua_editor');
  const isPentadbir = roles.includes('pentadbir');

  // Nota Ketua Editor ialah tempat Ketua Editor MENULIS nota, bukan destinasi Editor lain
  // membaca — nota yang diterbitkan sampai kepada Editor lain melalui Peti Makluman (ikon
  // Makluman di header), bukan dengan membuka destinasi tulis ni sendiri. Editorial (Bidang/
  // tipografi/glosari) dikongsi Ketua Editor + Penolong/Timbalan Ketua Editor. Direktori &
  // Tetapan Sistem domain Pentadbir sahaja (2026-08-02 — dahulu Direktori terbuka untuk
  // sesiapa log masuk, Tetapan Ketua-Editor-sahaja; kedua-duanya kini Pentadbir).
  const restricted = (id: string) => {
    if (id === 'nota_ketua_editor') return !isKetuaEditor;
    if (id === 'editorial') return !isEditorialAdmin;
    if (id === 'tetapan' || id === 'direktori') return !isPentadbir;
    return false;
  };

  const renderKumpulan = (tajuk: string, items: NavItem[]) => (
    <div className="space-y-1">
      {/* Label kumpulan SENTIASA dirender (tinggi tetap) — teks cuma disorok (opacity-0) bila
          dilipat, bukan dibuang terus. Dulu label langsung tiada dalam DOM bila dilipat, jadi
          tinggi keseluruhan berubah dan baris ikon "melompat" kedudukan setiap kali togol. */}
      <div className={`px-3 font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400 mb-1.5 truncate transition-opacity ${dilipat ? 'opacity-0' : 'opacity-100'}`}>
        {tajuk}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => {
          const isActive = currentTab === item.id && !loggedOut;
          const isLocked = loggedOut || restricted(item.id);
          const { Icon } = item;
          const butang = (
            <button
              key={item.id}
              type="button"
              // Sidebar tertutup: klik ikon TIDAK terus melompat destinasi — ia dibiarkan naik
              // (bubble) ke <aside> yang membukanya dahulu, supaya editor nampak label sebelum
              // memilih. Sebaik terbuka, klik yang sama barulah menavigasi.
              onClick={() => { if (!dilipat) handleNavClick(item.id); }}
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
    // flex flex-col + badan flex-1 (2026-08-01) — footer dulu ikut aliran dokumen biasa: kalau
    // kandungan pendek (cth Indeks dengan 2 baris tapisan), footer terapung di tengah halaman
    // dengan ruang kosong terbiar di bawahnya sehingga hujung skrin. Kini footer SENTIASA di
    // bawah — melekat di hujung viewport bila kandungan pendek, turun ikut skrol bila panjang.
    <div className="min-h-screen bg-[#FDFDFD] text-[#1F1F1F] font-sans antialiased flex flex-col">
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
                {/* Susunan header (2026-08-01) — nama/peranan editor diletak DEKAT HUJUNG KANAN
                    (bersebelahan Log Keluar), bukan di hadapan ikon-ikon tindakan. Ikon (tambah
                    kandungan, Makluman) datang dahulu, badge profil + Log Keluar menutup di hujung. */}
                {/* Butang tambah kandungan — ikon sahaja (spesifikasi asal pemilik projek: "+"
                    sebagai simbol, bukan label teks). */}
                {onOpenSlotPicker && (
                  <button
                    type="button"
                    onClick={onOpenSlotPicker}
                    title="Tulis Kandungan Baharu"
                    className="flex items-center justify-center w-7 h-7 bg-white text-[#802334] rounded-full font-bold hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    <PenLine className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* Peti Makluman — ikon sahaja ("✉️" sebagai simbol). */}
                {onOpenMakluman && (
                  <button
                    type="button"
                    onClick={onOpenMakluman}
                    title="Peti Makluman — nota Ketua Editor"
                    className="relative flex items-center justify-center w-7 h-7 bg-white/[0.08] backdrop-blur-xl rounded-full border border-white/[0.1] text-white/80 hover:text-white hover:bg-white/[0.14] transition-colors cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {jumlahMakluman > 0 && (
                      <span className="absolute -top-1 -right-1 font-mono text-[9px] font-bold bg-[#e0b7bd] text-[#5c1624] rounded-full min-w-[16px] px-1 leading-4 text-center">
                        {jumlahMakluman}
                      </span>
                    )}
                  </button>
                )}
                {/* Profil Editor — badge nama/peranan boleh diklik, buka modal lihat/sunting
                    identiti sendiri. Diletak dekat hujung kanan, bersebelahan Log Keluar. */}
                <button
                  type="button"
                  onClick={onOpenProfil}
                  title="Profil Editor"
                  disabled={!onOpenProfil}
                  className="flex items-center gap-2 bg-white/[0.08] backdrop-blur-xl px-2.5 py-1 rounded-full border border-white/[0.1] hover:bg-white/[0.14] transition-colors cursor-pointer disabled:cursor-default"
                >
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                    <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-stone-100 font-medium">{currentUser.name}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-[#e0b7bd]">{
                    // 2026-08-02 (Fasa 3) — label peranan SEBENAR (boleh berbilang, cth "Pentadbir,
                    // Ketua Editor"), bukan label binari lama.
                    roles.length > 0
                      ? roles.map(r => ROLE_LABELS[r] || r).join(', ')
                      : (currentUser.role === 'KETUA_EDITOR' ? 'Ketua Editor' : 'Editor')
                  }</span>
                </button>
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
      <div className="relative flex flex-col flex-1">
        {/* Backdrop tak kelihatan — hanya wujud bila sidebar TERBUKA. Klik di mana-mana pada
            halaman (kandungan, header, ruang kosong) menutupnya semula. Inilah "klik tempat
            lain, ia tertutup". */}
        {!dilipat && (
          <div className="hidden md:block fixed inset-0 z-20" onClick={() => setDilipat(true)} />
        )}
        <aside
          // Klik mana-mana pada sidebar tertutup = buka. Bila sudah terbuka, klik di sini tak
          // buat apa-apa; butang destinasi di dalamnya yang mengambil alih.
          onClick={() => { if (dilipat) setDilipat(false); }}
          className={`hidden md:flex md:flex-col fixed left-0 top-[42px] h-[calc(100vh-42px)] z-30 overflow-y-auto bg-[#F6F4EF] border-r border-stone-200 p-4 gap-6 transition-[width] duration-150 ${
            dilipat ? 'w-[4.5rem] cursor-pointer' : 'w-60 shadow-[4px_0_16px_rgba(0,0,0,0.08)]'
          }`}
        >
          <div className="flex-1 space-y-6">
            {renderKumpulan('Utama', UTAMA)}
            <div className="border-t border-stone-200 pt-4">
              {renderKumpulan('Penerbitan', PENERBITAN)}
            </div>
            <div className="border-t border-stone-200 pt-4">
              {renderKumpulan('Pengurusan', PENGURUSAN)}
            </div>
            <div className="border-t border-stone-200 pt-4">
              {renderKumpulan('Rujukan', RUJUKAN)}
            </div>
          </div>
        </aside>

        {/* Sidebar dibalut jadi bar mendatar boleh skrol pada skrin sempit (< md) — bukan
            disembunyikan terus, atau Editorium jadi tak boleh dinavigasi pada telefon/tablet. */}
        <nav className="md:hidden w-full overflow-x-auto flex gap-1 px-3 py-2 border-b border-stone-200 bg-[#F6F4EF]">
          {[...UTAMA, ...PENERBITAN, ...PENGURUSAN, ...RUJUKAN].map((item) => {
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
