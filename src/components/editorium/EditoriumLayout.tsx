import React, { useState, useRef, useLayoutEffect } from 'react';
import {
  List, FileEdit, Bell, Zap, LayoutGrid, BookOpen, FolderOpen, Settings,
  LogOut, LogIn, PenLine, Mail, Lock, BookMarked, FileText, History, Home,
  Pin, PinOff,
} from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { BRAND } from '../../config/brand';

// Logo sebenar (2026-08-07, PNG->SVG) — public/adjung-brief-logo.svg, disajikan terus daripada
// public/ (corak sama seperti favicon.svg/adjung-symbol.svg), bukan import ES module. Dahulu
// PNG raster 1563×1563px (permintaan Izzat: "sepatutnya semua imej dalam Adjung Brief guna SVG,
// tidak perlu PNG langsung") — disurih jadi path vektor (bukan dibina semula guna teks: nisbah
// lebar:tinggi "Adjung" pada PNG asal ialah 3.245, TIDAK sepadan Source Serif 4 punya 2.895,
// jadi fon berbeza — path surihan mengekalkan bentuk huruf SEBENAR). SVG sudah dipotong tepat
// pada sempadan lockup ("Adjung"+garis+"BRIEF"), jadi tiada lagi keperluan bekas overflow-hidden
// + posisi negatif macam PNG dahulu.
const ADJUNG_BRIEF_LOGO = '/adjung-brief-logo.svg';

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
  // `activeTab` prop TERKAWAL sepenuhnya (2026-08-07, pepijat Audit UI/UX §A1) — dahulu
  // `currentTab` state SENDIRI dibaca sekali semasa lekapan sahaja, jadi apabila kandungan
  // menukar destinasi sendiri (pintasan Paparan Utama, "Urus Penaja", dll — lihat
  // `EditoriumView.tsx` `setActiveTab`), sidebar terus tak segerak: menyerlah destinasi LAMA,
  // dan klik semula destinasi yang (pada hakikatnya) sedang aktif tak berkesan langsung sebab
  // `currentTab` menyangka ia sudah di sana. Tiada lagi state pendua — `activeTab` ialah
  // satu-satunya sumber kebenaran.
  const currentTab = activeTab;
  // Sidebar berkelakuan sebagai FLYOUT ringkas (2026-08-01, arahan tepat pemilik projek):
  //   tertutup (rel ikon 72px) secara lalai
  //   klik sidebar          -> terbuka
  //   klik di tempat lain   -> tertutup
  // Tiada butang "Lipatkan" langsung — butang tu redundan sebaik kelakuan buka/tutup jadi
  // automatik, dan ia buat editor rasa terpaksa cari butang dulu sebelum boleh guna Editorium.
  // (Sejarah: hover-untuk-kembang pernah dicuba dan ditolak — ia buat sidebar rasa tak stabil.)
  // Sematkan sidebar (2026-08-07, permintaan Izzat) — pilihan KEKAL TERBUKA, untuk editor yang
  // kerap melompat antara destinasi dan tak mahu sidebar tutup sendiri setiap kali klik. Bila
  // DISEMAT kelakuan terapung/auto-tutup di atas dimatikan SEPENUHNYA: tiada backdrop, klik di
  // tempat lain tak menutupnya, dan sidebar MENOLAK kandungan (bukan melayang atasnya) — kalau
  // ia kekal terapung selamanya ia akan menutupi kandungan secara kekal, bukan sekejap.
  // Disimpan dalam localStorage supaya pilihan kekal antara sesi/muat semula.
  // Lalai SEMAT untuk log masuk pertama (2026-08-07, Audit UI/UX §C3, diluluskan Izzat) — rel
  // ikon terlipat perlukan 2-3 klik setiap tukar modul (klik pertama cuma buka, klik kedua
  // pilih, sidebar tak tutup sendiri jadi klik ketiga perlu dapatkan semula ruang). Kunci ni
  // TIADA (null) hanya pada log masuk pertama seorang editor pada peranti tu — selepas itu
  // sentiasa '0' atau '1' eksplisit, jadi nyahsemat kekal dihormati selamanya (bukan reset
  // balik ke semat setiap kali storan entah bagaimana kosong).
  const KUNCI_SEMAT = 'adjung-editorium-sidebar-disemat';
  const [disemat, setDisemat] = useState(() => {
    try {
      const tersimpan = window.localStorage.getItem(KUNCI_SEMAT);
      return tersimpan === null ? true : tersimpan === '1';
    } catch {
      return true;
    }
  });

  const [dilipat, setDilipatMentah] = useState(true);
  // Bila disemat, SEMUA permintaan lipat automatik (klik backdrop, klik <aside>) diabaikan —
  // satu-satunya cara tutup ialah nyahsemat melalui butang pin.
  const setDilipat = (nilai: boolean) => { if (!disemat) setDilipatMentah(nilai); };
  const sidebarTerbuka = disemat || !dilipat;

  const togolSemat = () => {
    const baharu = !disemat;
    setDisemat(baharu);
    try { window.localStorage.setItem(KUNCI_SEMAT, baharu ? '1' : '0'); } catch { /* storan disekat — pilihan tak kekal, bukan ralat */ }
    // Nyahsemat = kembali ke lalai terlipat, bukan tinggalkan sidebar terbuka terapung tanpa
    // backdrop yang baru sahaja dimatikan. Guna setter MENTAH: `setDilipat` berpagar `disemat`
    // yang masih nilai LAMA (true) pada baris ni, jadi ia akan diabaikan.
    if (!baharu) setDilipatMentah(true);
  };

  // Tinggi header DIUKUR, bukan dikodkan keras (2026-08-07, laporan Izzat: "sidebar menutup
  // header tab, sampai terlindung logo"). Sidebar <aside> dahulu guna top-[42px] tetap, tapi
  // header sebenar 61px tinggi (padding + logo 40px) — disahkan dgn getBoundingClientRect:
  // penjuru bawah-kiri logo bertindih sidebar. Nilai tetap pun takkan pernah betul untuk semua
  // kes — header sendiri patah jadi DUA baris pada lebar sempit (lihat komen "kelompok kanan
  // patah ke baris kedua" di header di bawah), jadi tingginya berubah ikut kandungan/lebar
  // skrin. ResizeObserver memastikan sidebar sentiasa bermula tepat di penghujung header
  // SEBENAR, tak kira berapa baris ia jadi.
  const headerRef = useRef<HTMLElement>(null);
  const [tinggiHeader, setTinggiHeader] = useState(61);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const kemaskini = () => setTinggiHeader(el.getBoundingClientRect().height);
    kemaskini();
    const ro = new ResizeObserver(kemaskini);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleNavClick = (tabId: string) => {
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
  // Log Sistem (2026-08-05, keputusan Izzat) — jejak audit SEMUA orang; dahulu terbuka kepada
  // sesiapa yang log masuk (termasuk Editor biasa). Kini Pentadbir + Ketua Editor + Penolong.
  const restricted = (id: string) => {
    if (id === 'nota_ketua_editor') return !isKetuaEditor;
    if (id === 'editorial') return !isEditorialAdmin;
    if (id === 'log_sistem') return !(isPentadbir || isEditorialAdmin);
    if (id === 'tetapan' || id === 'direktori') return !isPentadbir;
    return false;
  };

  const renderKumpulan = (tajuk: string, items: NavItem[]) => (
    <div className="space-y-1">
      {/* Label kumpulan SENTIASA dirender (tinggi tetap) — teks cuma disorok (opacity-0) bila
          dilipat, bukan dibuang terus. Dulu label langsung tiada dalam DOM bila dilipat, jadi
          tinggi keseluruhan berubah dan baris ikon "melompat" kedudukan setiap kali togol. */}
      <div className={`px-3 font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400 mb-1.5 truncate transition-opacity ${!sidebarTerbuka ? 'opacity-0' : 'opacity-100'}`}>
        {tajuk}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => {
          const isActive = currentTab === item.id && !loggedOut;
          const isLocked = loggedOut || restricted(item.id);
          const { Icon } = item;
          // Label penerangan (2026-08-07, Audit UI/UX §C3/§G4) — dahulu atribut `title=` asli,
          // yang TIDAK muncul pada fokus papan kekunci (cuma hover tetikus) dan tak boleh
          // digayakan. Diganti komponen `Tooltip` projek, yang SUDAH menyokong onFocus/onBlur.
          const labelPenerangan =
            loggedOut ? 'Log masuk dahulu untuk membuka destinasi ini'
            : restricted(item.id) ? 'Hanya Ketua Editor'
            : !sidebarTerbuka ? item.label : undefined;
          const butang = (
            <Tooltip key={item.id} text={labelPenerangan}>
              <button
                type="button"
                // Sidebar tertutup: klik ikon TIDAK terus melompat destinasi — ia dibiarkan naik
                // (bubble) ke <aside> yang membukanya dahulu, supaya editor nampak label sebelum
                // memilih. Sebaik terbuka, klik yang sama barulah menavigasi.
                onClick={() => { if (sidebarTerbuka) handleNavClick(item.id); }}
                disabled={isLocked}
                aria-disabled={isLocked}
                aria-label={!sidebarTerbuka ? item.label : undefined}
                className={`w-full flex items-center gap-2 text-xs font-medium py-2 rounded transition-colors duration-150 ${
                  !sidebarTerbuka ? 'justify-center px-2' : 'justify-between px-3'
                } ${
                  isActive
                    ? 'text-Adjung-maroon font-semibold bg-Adjung-maroon/[0.06] shadow-[inset_2px_0_0_var(--color-Adjung-maroon)]'
                    : isLocked
                    ? 'text-stone-300 cursor-not-allowed'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-black/[0.04] cursor-pointer'
                }`}
              >
                <span className={`flex items-center gap-2.5 min-w-0 ${!sidebarTerbuka ? 'justify-center' : ''}`}>
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-Adjung-maroon' : 'text-stone-400'}`} strokeWidth={2.2} />
                  {sidebarTerbuka && <span className="truncate">{item.label}</span>}
                </span>
                {sidebarTerbuka && !loggedOut && restricted(item.id) && <Lock className="w-3 h-3 shrink-0 text-stone-300" strokeWidth={2.2} />}
              </button>
            </Tooltip>
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
      {/* Editorium Header — bar identiti. 2026-08-03: reskin warna/gaya ikon ikut mockup Claude
          Design Izzat ("ledger editorial" — latar cerah, garis rambut, aksen maroon), TAPI kekal
          DUA keputusan sengaja lama yang disahkan semula (bukan diguna pakai mockup 100%):
          butang tambah kandungan kekal IKON SAHAJA (bukan berlabel), dan susunan/tingkah laku
          setiap elemen (log masuk/keluar, profil, makluman) kekal serupa. */}
      {/* `overflow-hidden` DIBUANG (2026-08-05, pepijat lebar skrin sederhana ~850-900px, dilapor
          pemilik projek — teks badge/nav terpotong "KETUA EDITOR" jadi "KIA EDR") — bukan pepijat
          telefon (lihat SlotManagerModal.tsx fix untuk itu), lebar ANTARA md:768 dan lg:1024
          langsung tiada gerbang breakpoint di sini, jadi kelompok kanan (butang+badge+log keluar)
          yang TIDAK sendiri flex-wrap (di bawah) memaksa lebar melebihi ruang lalu DIPOTONG oleh
          overflow-hidden header — bukan dibalut ke baris baharu. Kelompok kanan kini flex-wrap
          sendiri (bukan cuma header luar) supaya ia patah ke baris kedua pada lebar sempit,
          overflow-hidden header dibuang supaya baris kedua tu kelihatan (bukan turut terpotong). */}
      <header ref={headerRef} className="relative bg-[#FDFDFD] border-b border-stone-200 select-none">
        <div className="relative px-4 md:px-8 py-2.5 flex flex-wrap justify-between items-center gap-3">
          <Tooltip text="Klik untuk kembali ke Frontpage">
            {/* Logo SEBENAR (2026-08-07) — SVG disurih drpd rekaan Izzat, sudah dipotong tepat
                pada sempadan lockup ("Adjung"+garis+"BRIEF"), jadi img terus tanpa bekas
                crop/posisi negatif macam PNG dahulu. "· Editorium" kekal teks berasingan
                (konteks laman ni sahaja, bukan sebahagian jenama). */}
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity select-none">
              <img
                src={ADJUNG_BRIEF_LOGO}
                alt={`${BRAND.name} logo`}
                className="w-[100px] h-auto shrink-0"
              />
              <span className="font-mono text-[8px] tracking-[0.22em] font-semibold text-stone-400 uppercase leading-none border-l border-stone-200 pl-2">
                Editorium
              </span>
            </a>
          </Tooltip>

          <div className="flex flex-wrap items-center justify-end gap-2.5 font-sans text-[11px]">
            {currentUser ? (
              <>
                {/* Susunan header (2026-08-01) — nama/peranan editor diletak DEKAT HUJUNG KANAN
                    (bersebelahan Log Keluar), bukan di hadapan ikon-ikon tindakan. Ikon (tambah
                    kandungan, Makluman) datang dahulu, badge profil + Log Keluar menutup di hujung. */}
                {/* Butang tambah kandungan dipindah jadi FAB terapung penjuru kanan bawah
                    (2026-08-07, permintaan Izzat) — lihat hujung fail. */}
                {/* Peti Makluman — ikon sahaja ("✉️" sebagai simbol). */}
                {onOpenMakluman && (
                  <Tooltip text="Peti Makluman, nota Ketua Editor">
                    <button
                      type="button"
                      onClick={onOpenMakluman}
                      aria-label="Peti Makluman, nota Ketua Editor"
                      className="relative flex items-center justify-center w-7 h-7 border border-stone-200 rounded text-stone-500 hover:text-Adjung-maroon hover:border-stone-300 hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {jumlahMakluman > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 font-mono text-[9px] font-bold bg-Adjung-maroon text-white rounded-full min-w-[16px] px-1 leading-4 text-center border-2 border-[#FDFDFD]">
                          {jumlahMakluman}
                        </span>
                      )}
                    </button>
                  </Tooltip>
                )}
                {/* Profil Editor — badge nama/peranan boleh diklik, buka modal lihat/sunting
                    identiti sendiri. Diletak dekat hujung kanan, bersebelahan Log Keluar. */}
                <Tooltip text="Profil Editor">
                <button
                  type="button"
                  onClick={onOpenProfil}
                  aria-label="Profil Editor"
                  disabled={!onOpenProfil}
                  className="flex items-center gap-2 border border-stone-200 px-2.5 py-1 rounded hover:bg-stone-50 hover:border-stone-300 transition-colors cursor-pointer disabled:cursor-default"
                >
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                    <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-stone-800 font-medium">{currentUser.name}</span>
                  <span className="text-stone-300">·</span>
                  <span className="text-Adjung-maroon font-mono text-[9.5px] uppercase tracking-wider font-semibold">{
                    // 2026-08-02 (Fasa 3) — label peranan SEBENAR (boleh berbilang, cth "Pentadbir,
                    // Ketua Editor"), bukan label binari lama.
                    roles.length > 0
                      ? roles.map(r => ROLE_LABELS[r] || r).join(', ')
                      : (currentUser.role === 'KETUA_EDITOR' ? 'Ketua Editor' : 'Editor')
                  }</span>
                </button>
                </Tooltip>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-1 border border-stone-200 px-2.5 py-1 rounded text-stone-500 hover:text-Adjung-maroon hover:border-stone-300 hover:bg-stone-50 transition-colors"
                  >
                    <LogOut className="w-3 h-3" /> Log Keluar
                  </button>
                )}
              </>
            ) : (
              onRequestLogin && (
                <button
                  onClick={onRequestLogin}
                  className="flex items-center gap-1.5 bg-Adjung-maroon px-3 py-1 rounded text-white hover:bg-Adjung-maroon-dark transition-colors font-medium"
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
          perlu skrol mendatar sekadar sebab sidebar terbuka.
          PENGECUALIAN (2026-08-07): bila DISEMAT, sidebar bukan lagi flyout sekejap — ia kekal
          terbuka, jadi ia MENOLAK `main` (md:pl-60) dan bukan melayang atas kandungan. */}
      <div className="relative flex flex-col flex-1">
        {/* Backdrop tak kelihatan — hanya wujud bila sidebar TERBUKA. Klik di mana-mana pada
            halaman (kandungan, header, ruang kosong) menutupnya semula. Inilah "klik tempat
            lain, ia tertutup". */}
        {/* Backdrop TIDAK wujud bila disemat — sidebar sengaja kekal terbuka, jadi klik di tempat
            lain tak boleh menutupnya. */}
        {!dilipat && !disemat && (
          <div className="hidden md:block fixed inset-0 z-20" style={{ top: tinggiHeader }} onClick={() => setDilipat(true)} />
        )}
        <aside
          // Klik mana-mana pada sidebar tertutup = buka. Bila sudah terbuka, klik di sini tak
          // buat apa-apa; butang destinasi di dalamnya yang mengambil alih.
          onClick={() => { if (!sidebarTerbuka) setDilipat(false); }}
          style={{ top: tinggiHeader, height: `calc(100vh - ${tinggiHeader}px)` }}
          className={`hidden md:flex md:flex-col fixed left-0 z-30 overflow-y-auto bg-[#FDFDFD] border-r border-stone-200 p-4 gap-6 transition-[width] duration-150 ${
            !sidebarTerbuka
              ? 'w-[4.5rem] cursor-pointer'
              // Bayang (petanda "terapung ATAS kandungan") sengaja DIBUANG bila disemat — bila
              // disemat ia bukan lagi terapung, ia menolak kandungan, jadi bayang jadi penipuan
              // visual.
              : disemat ? 'w-60' : 'w-60 shadow-[4px_0_16px_rgba(0,0,0,0.08)]'
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

          {/* Butang semat — hanya bermakna (dan hanya kelihatan) bila sidebar sedang terbuka;
              bila terlipat rel ikon 72px tiada ruang untuk label, dan editor perlu bukanya dahulu
              untuk faham apa yang disemat. Ikon sahaja (2026-08-07, Izzat: "hapuskan perkataan
              tu, guna icon sahaja") — Tooltip hover dibuang semula (2026-08-07, Izzat: "sudah
              difahami") — ikon pin/pin-off sendiri dianggap cukup jelas tanpa penjelasan hover;
              aria-label kekal untuk pembaca skrin (keperluan nama boleh capai, bukan label
              paparan). Bulatan ikon kecil dipusatkan (bukan kotak bersempadan lebar penuh, sisa
              gaya lama era butang berlabel). */}
          {sidebarTerbuka && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); togolSemat(); }}
              aria-pressed={disemat}
              aria-label={disemat ? 'Nyahsemat sidebar' : 'Sematkan sidebar'}
              className={`shrink-0 mx-auto flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                disemat
                  ? 'text-Adjung-maroon bg-Adjung-maroon/[0.08]'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-black/[0.04]'
              }`}
            >
              {disemat ? <PinOff className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} /> : <Pin className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />}
            </button>
          )}
        </aside>

        {/* Sidebar dibalut jadi bar mendatar boleh skrol pada skrin sempit (< md) — bukan
            disembunyikan terus, atau Editorium jadi tak boleh dinavigasi pada telefon/tablet. */}
        <nav className="md:hidden w-full overflow-x-auto flex gap-1 px-3 py-2 border-b border-stone-200 bg-[#FDFDFD]">
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
                  isActive ? 'bg-Adjung-maroon text-white font-semibold' : isLocked ? 'text-stone-300' : 'text-stone-600 bg-white border border-stone-200'
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
        <main className={`min-w-0 p-4 md:py-8 md:pr-8 transition-[padding] duration-150 ${disemat ? 'md:pl-60' : 'md:pl-[4.5rem]'}`}>
          {/* Had lebar kongsi SEMUA modul Editorium (2026-08-07, maklum balas Izzat: kandungan
              regang sepenuh skrin tanpa sebab pada skrin lebar — borang/jadual jadi payah dibaca/
              imbas). Satu titik tetap di sini (bukan per-modul) supaya semua modul dilayan sama
              rata — sepadan falsafah "tier/kumpulan dilayan sama rata" projek ni. */}
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Footer — bila sidebar DISEMAT ia menolak footer sekali (md:pl-60), bukan cuma `main`
          (2026-08-07, laporan Izzat: "sidebar menutup footer apabila disematkan"). <aside>
          `fixed` setinggi viewport, jadi tanpa ini teks footer kiri terperangkap DI BAWAH
          sidebar. Nilai mesti kekal sepadan dengan md:pl-* pada <main> di atas. */}
      <footer className={`border-t border-stone-200 bg-[#FDFDFD] px-4 md:px-8 py-3 font-sans text-[11px] text-stone-400 flex flex-wrap justify-between items-center gap-2 select-none transition-[padding] duration-150 ${disemat ? 'md:pl-[16.5rem]' : ''}`}>
        <div>
          Adjung Brief Editorium · Sistem Kawalan Editorial
        </div>
        <div className="flex items-center gap-1.5">
          Status Sistem:
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] font-semibold" style={{ color: '#3d6b4c' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#3d6b4c' }} />
            Dilindungi &amp; Aktif
          </span>
        </div>
      </footer>

      {/* FAB tulis kandungan — terapung penjuru kanan bawah (2026-08-07, permintaan Izzat:
          "ikon/butang tulis kandungan jadikan terapung di penjuru kanan belah bawah"). Dulu
          ikon dalam header, kini `fixed` supaya sentiasa boleh dicapai tanpa skrol balik atas,
          konsisten pada semua saiz skrin (bukan cuma md+). Ikon sahaja kekal (spesifikasi asal
          pemilik projek disahkan 2026-08-03), diperbesar sikit (w-12 h-12) sebab kini sasaran
          sentuh berasingan, bukan sebahagian kelompok ikon kecil header. */}
      {currentUser && onOpenSlotPicker && (
        <Tooltip text="Tulis Kandungan Baharu">
          <button
            type="button"
            onClick={onOpenSlotPicker}
            aria-label="Tulis Kandungan Baharu"
            className="fixed bottom-16 right-6 z-40 flex items-center justify-center w-12 h-12 bg-Adjung-maroon text-white rounded-full shadow-[0_4px_16px_rgba(128,35,52,0.4)] hover:bg-Adjung-maroon-dark hover:shadow-[0_6px_20px_rgba(128,35,52,0.5)] transition-all cursor-pointer"
          >
            <PenLine className="w-5 h-5" />
          </button>
        </Tooltip>
      )}
    </div>
  );
};

export default EditoriumLayout;
