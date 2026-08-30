import React, { useState, useEffect } from 'react';
import { User, Entry, SystemSettings } from './types';
import { db } from './db/mockDb';
import { FrontpageView } from './components/portal/FrontpageView';
import { LoginModal } from './components/editorium/LoginModal';
import { muatPindaanTier } from './config/tierOverrides';
import { muatPindaanMedanLimit } from './config/medanLimitOverrides';
import { muatPindaanLabel } from './config/labelOverrides';
import { LoadingScreen } from './components/common/LoadingScreen';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { SkrinDegradasiDB } from './components/common/SkrinDegradasiDB';
import { PERISTIWA_SESI_TAMAT } from './utils/pemintasSesi';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserRouter, Routes, Route, useParams, useLocation } from 'react-router-dom';
import { HalamanStatik } from './components/portal/HalamanStatik';
import { HalamanPenaja } from './components/portal/HalamanPenaja';
import { HalamanSertai } from './components/portal/HalamanSertai';
import { HalamanMohonPenaja } from './components/portal/HalamanMohonPenaja';
import { HalamanLengkapkanPenajaan } from './components/portal/HalamanLengkapkanPenajaan';
import { TidakDijumpai } from './components/portal/TidakDijumpai';
import { TetapkanKataLaluan } from './components/portal/TetapkanKataLaluan';
import { LengkapkanProfilModal } from './components/editorium/LengkapkanProfilModal';

// Muat malas (2026-08-02, Fasa 15 — "prestasi & kesediaan produksi") — ContentReview (Studio)
// dan EditoriumView (konsol pentadbiran penuh, import berpuluh-puluh sub-komponen) dahulu
// dibundel TERUS ke dalam chunk utama walaupun kebanyakan pelawat portal awam tak pernah
// melawat kedua-dua laluan ni langsung. Vite beri amaran "chunk > 500kB" pada bundle asal
// (~1.09MB, gzip ~280KB) — pemisahan kod ni JS split rendah-risiko (React.lazy standard, tak
// sentuh struktur bento/kad), bukan refactor besar-besaran.
const ContentReview = React.lazy(() =>
  import('./components/studio/ContentReview').then(m => ({ default: m.ContentReview }))
);
const EditoriumView = React.lazy(() =>
  import('./components/editorium/EditoriumView').then(m => ({ default: m.EditoriumView }))
);

// Pautan mendalam per-kandungan (Fasa 9, 2026-08-05) — /:bidangSlug/kandungan/:kodPendek.
// Bungkusan kecil supaya JSX laluan "/" tak perlu diduplikasi penuh: baca `kodPendek` dari URL
// via useParams() (mesti dalam komponen berasingan — hook cuma boleh dipanggil dalam render
// komponen, bukan terus dalam callback `element` Route), hantar ke children sebagai render-prop.
function LaluanKandungan({ children }: { children: (kodPendek: string | undefined) => React.ReactNode }) {
  const { kodPendek } = useParams<{ kodPendek: string }>();
  return <>{children(kodPendek)}</>;
}

// Laluan yang tergolong dalam kerja editorial — gerbang profil wajib (di bawah) hanya aktif di
// sini, bukan di frontpage awam (lihat nota di titik guna).
const LALUAN_EDITORIAL = ['/editorium', '/studio/semakan-kandungan'];

function GerbangProfilWajib({
  authUser,
  onSelesai,
}: {
  authUser: { id: string; termaDipersetujuiPada?: string | null } | null;
  onSelesai: (patch: Record<string, string | undefined>) => void;
}) {
  const location = useLocation();
  const dalamEditorial = LALUAN_EDITORIAL.some((laluan) => location.pathname.startsWith(laluan));
  if (!authUser || authUser.termaDipersetujuiPada || !dalamEditorial) return null;
  return <LengkapkanProfilModal userId={authUser.id} onSelesai={onSelesai} />;
}

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  // Log masuk sebenar (2026-07-29) — SATU-SATUNYA punca kebenaran edit. Tiada lagi persona
  // tetamu "Editor Ahmad"/togol kosmetik: setiap orang yang nak edit kandungan (frontpage
  // ATAU Editorium) MESTI log masuk dulu (/api/auth/login, core/routes/authRoutes.js, jadual
  // `users`, password di-hash scrypt). Peranan (KETUA_EDITOR/EDITOR) datang terus daripada
  // akaun yang log masuk itu sendiri, bukan pilihan manual.
  //
  // "Ingat saya": localStorage (kekal selepas browser ditutup) bila ditanda, sessionStorage
  // (hilang bila tab/browser ditutup) bila tidak. Kedua-dua disemak semasa mula — localStorage
  // diutamakan.
  const AUTH_STORAGE_KEY = 'adjung-auth-user';
  const readStoredAuth = (): { id: string; username: string; penName: string; email: string; role: string; roles?: string[] } | null => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem(AUTH_STORAGE_KEY) || window.sessionStorage.getItem(AUTH_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };
  const [authUser, setAuthUser] = useState<{ id: string; username: string; penName: string; email: string; role: string; roles?: string[]; termaDipersetujuiPada?: string | null; sesiTanda?: string; autoTerbit?: boolean } | null>(readStoredAuth);
  const [showLoginModal, setShowLoginModal] = useState(false);
  // Dijalankan lepas log masuk berjaya (cth terus buka mod edit di frontpage) — bukan cuma
  // menutup modal sahaja.
  const [pendingLoginSuccess, setPendingLoginSuccess] = useState<(() => void) | null>(null);

  // id dibawa sekali (2026-08-01) — "Draf Saya" perlukannya untuk membaca slot yang ditugaskan
  // kepada editor ni (jadual slot_editors berkunci pada users.id, bukan nama pena). `roles`
  // (2026-08-02, Fasa 3) — senarai BERBILANG peranan sebenar (pentadbir/ketua_editor/
  // penolong_ketua_editor/editor); `role` legasi ('KETUA_EDITOR'/'EDITOR') dikekalkan sebagai
  // label paparan sahaja — SEMUA kawalan akses sebenar (client MAHUPUN server) mesti guna `roles`.
  const currentEditoriumUser: { id: string; name: string; role: 'KETUA_EDITOR' | 'EDITOR'; roles: string[]; sesiTanda?: string; autoTerbit?: boolean } | null =
    authUser && (authUser.role === 'KETUA_EDITOR' || authUser.role === 'EDITOR')
      // Sesi yang tersimpan SEBELUM id mula dibawa (2026-08-01) tiada medan `id` — dibiar kosong,
      // bukan direka. Kesannya terhad: draf bercap nama tetap muncul dalam "Draf Saya", cuma
      // sandaran "ikut slot" untuk draf lama tanpa nama tidak berfungsi sehingga log masuk semula.
      ? { id: authUser.id || '', name: authUser.penName, role: authUser.role as 'KETUA_EDITOR' | 'EDITOR', roles: authUser.roles || [], sesiTanda: authUser.sesiTanda, autoTerbit: authUser.autoTerbit }
      : null;

  // Titik masuk tunggal untuk buka borang log masuk — dari mana-mana (butang "Edit Kandungan"
  // di frontpage, butang "Log Masuk" di Editorium). `onSuccess` pilihan dipanggil lepas log
  // masuk berjaya (cth terus aktifkan mod edit).
  const requestLogin = (onSuccess?: () => void) => {
    setPendingLoginSuccess(() => onSuccess || null);
    setShowLoginModal(true);
  };

  const handleLoginSuccess = (user: { id: string; username: string; penName: string; email: string; role: string; roles: string[]; termaDipersetujuiPada?: string | null; autoTerbit?: boolean }, rememberMe: boolean) => {
    // Tanda sesi (2026-08-08, "tapisan Indeks kekal sepanjang sesi") — dicap SEKALI di sini,
    // setiap kali log masuk berjaya (bukan setiap kali authUser dikemas kini — lihat
    // handleProfilKemasKini di bawah, sengaja TIDAK menjana tanda baharu). Konsol seperti Indeks
    // guna tanda ni (src/hooks/useTapisanSesi.ts) utk bezakan "masih sesi sama, refresh sahaja"
    // drpd "log masuk baharu" — tapisan tersimpan cuma dipulihkan bila tanda sepadan.
    const userDenganTanda = { ...user, sesiTanda: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` };
    setAuthUser(userDenganTanda);
    const target = rememberMe ? window.localStorage : window.sessionStorage;
    const other = rememberMe ? window.sessionStorage : window.localStorage;
    target.setItem(AUTH_STORAGE_KEY, JSON.stringify(userDenganTanda));
    other.removeItem(AUTH_STORAGE_KEY);
    setShowLoginModal(false);
    if (pendingLoginSuccess) {
      pendingLoginSuccess();
      setPendingLoginSuccess(null);
    }
  };

  // Profil Editor (2026-08-01, spesifikasi pemilik projek) — kemas kini nama pena serta-merta di
  // sesi log masuk (header/Editorium papar nama tu), tanpa perlu log keluar-masuk semula.
  // Kekalkan storan (local/session) yang sama yang sedia digunakan — jangan tukar pilihan
  // "Ingat saya" sekadar sebab profil disunting.
  const handleProfilKemasKini = (patch: Record<string, string | undefined>) => {
    if (!authUser) return;
    const updated = { ...authUser, ...patch };
    setAuthUser(updated);
    const target = window.localStorage.getItem(AUTH_STORAGE_KEY) ? window.localStorage : window.sessionStorage;
    target.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleLogout = () => {
    setAuthUser(null);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  };

  // Sesi tamat dikesan pemintas fetch global (2026-08-07, Audit UI/UX §D1, src/utils/
  // pemintasSesi.ts) — dahulu setiap panel Editorium mereput senyap atau papar mesej sendiri-
  // sendiri, header terus tunjuk titik hijau "aktif" dengan nama lapuk, borang log masuk tak
  // pernah terbuka sendiri. Kosongkan `authUser` di sini sahaja sudah cukup: EditoriumView
  // (useEffect sedia ada, `!currentUser && !sedangKeluar` -> `onRequestLogin()`) automatik buka
  // LoginModal semula, DAN `activeTab`-nya tak reset (komponen tak unmount, cuma gerbang dalaman
  // bertukar) — jadi editor kembali ke modul yang SAMA lepas log masuk semula, bukan tercampak
  // ke destinasi lalai.
  useEffect(() => {
    const onSesiTamat = () => {
      setAuthUser(null);
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    };
    window.addEventListener(PERISTIWA_SESI_TAMAT, onSesiTamat);
    return () => window.removeEventListener(PERISTIWA_SESI_TAMAT, onSesiTamat);
  }, []);
  const [inTheNewsGoogleDocText, setInTheNewsGoogleDocText] = useState('');
  const [worldClockHolidaysGoogleDocText, setWorldClockHolidaysGoogleDocText] = useState('');
  const [initializing, setInitializing] = useState(true);
  const [dbConnectionError, setDbConnectionError] = useState(false);
  const [retryingDb, setRetryingDb] = useState(false);

  const fetchDbState = () => {
    setRetryingDb(true);
    fetch('/api/db-state')
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then((data) => {
        if (data.users) {
          db.setUsers(data.users);
          setUsers(data.users);
        } else {
          setUsers(db.getUsers());
        }

        if (data.entries) {
          db.setEntries(data.entries);
          setEntries(data.entries);
        } else {
          setEntries(db.getEntries());
        }

        if (data.systemSettings) {
          db.setSystemSettings(data.systemSettings);
          setSystemSettings(data.systemSettings);
        } else {
          setSystemSettings(db.getSystemSettings());
        }

        setInTheNewsGoogleDocText(data.inTheNewsGoogleDocText || '');
        setWorldClockHolidaysGoogleDocText(data.worldClockHolidaysGoogleDocText || '');
        setDbConnectionError(false);
        setInitializing(false);
        setRetryingDb(false);
      })
      .catch((err) => {
        console.error('Failed to sync state from database:', err);
        // Skrin cuba-semula kosong (2026-08-08, dapatan audit UI/UX ChatGPT + kelulusan Izzat) —
        // dahulu jatuh balik kepada kandungan REKAAN (mockDb, entri demo "Tentang Adjung" dll.)
        // bersama amaran "kandungan mungkin tak terkini". Tapi data mock bukan lapuk, ia REKAAN
        // sepenuhnya — banner tu (walau dah ditulis semula sekali sebelum ni) sebenarnya masih
        // mengelirukan pembaca yang tak boleh bezakan kandungan palsu drpd kandungan sebenar yang
        // stale. Kini: TIADA kandungan dipaparkan langsung semasa gangguan — skrin degradasi
        // (lihat render di bawah) sahaja, bukan FrontpageView diisi data reka.
        setUsers([]);
        setEntries([]);
        setSystemSettings(null);
        setDbConnectionError(true);
        setInitializing(false);
        setRetryingDb(false);
      });
  };

  useEffect(() => {
    fetchDbState();
    // Pindaan had aksara tier — WAJIB dimuatkan ke salinan browser juga, kalau tidak setiap meter
    // had dalam borang penulisan mengesahkan ikut nilai lalai sedangkan server sudah pakai nilai
    // yang dipinda. Lihat src/config/tierOverrides.ts.
    muatPindaanTier();
    // Pindaan had geometri Topik/Huraian Panjang (Tetapan Am Slot) — sama sebab persis muatPindaanTier
    // di atas. Lihat src/config/medanLimitOverrides.ts.
    muatPindaanMedanLimit();
    // Gantian Label Sistem (Fasa 6) — sama sebab: label lama (STATUS_LABEL/MOD_KANDUNGAN_LABEL/
    // MESEJ_SISTEM_LABEL) dikodkan terus di istilah.ts; gantian Ketua Editor kena disuap masuk
    // secara eksplisit. Lihat src/config/labelOverrides.ts.
    muatPindaanLabel();
  }, []);

  if (initializing || !systemSettings) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="loading"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="fixed inset-0 z-50 bg-[#802334]"
        >
          <LoadingScreen />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <BrowserRouter>
      <ErrorBoundary konteks="Laluan aplikasi">
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={
            <motion.div
              key="app"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="min-h-screen bg-[#FDFDFD]"
            >
              {dbConnectionError ? (
                <SkrinDegradasiDB sedangMenyemak={retryingDb} onCubaSemula={fetchDbState} />
              ) : (
              <main className="max-w-6xl w-full mx-auto">
                <FrontpageView
                  entries={entries}
                  users={users}
                  systemSettings={systemSettings}
                  setSelectedEntry={() => {}}
                  setSelectedAuthorId={() => {}}
                  setActiveTab={() => {}}
                  currentUser={null}
                  currentEditoriumRole={currentEditoriumUser?.role}
                  currentEditoriumName={authUser?.role === 'KETUA_EDITOR' ? authUser.penName : undefined}
                  currentEditoriumContact={authUser?.role === 'KETUA_EDITOR' ? authUser.email : undefined}
                  onRequestEditLogin={requestLogin}
                  onLogout={handleLogout}
                  inTheNewsGoogleDocText={inTheNewsGoogleDocText}
                  worldClockHolidaysGoogleDocText={worldClockHolidaysGoogleDocText}
                  setIndexSearchQuery={() => {}}
                />
              </main>
              )}
            </motion.div>
          } />
          {/* Pautan mendalam per-kandungan (Fasa 9, 2026-08-05, keputusan Izzat) — sepadan skema
              URL awam /:bidangSlug/kandungan/:kodPendek yang crawler bot dapat HTML pra-terap
              (server.js/articleUrlRoutes.js). Pengguna manusia (SPA) mendarat di sini, JSX SAMA
              persis macam laluan "/" — FrontpageView buka Focus View kandungan berkenaan
              automatik (deepLinkKodPendek, lihat useEffect di FrontpageView.tsx). `bidangSlug`
              sendiri tak digunakan langsung (kod pendek sahaja perlu unik, Bidang cuma kosmetik
              URL) — tiada pengesahan padanan slug/Bidang sebenar, pautan kongsi lama kekal
              berfungsi walau Bidang kandungan bertukar kemudian. */}
          <Route path="/:bidangSlug/kandungan/:kodPendek" element={
            <LaluanKandungan>
              {(kodPendek) => (
                <motion.div
                  key="app-kandungan"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="min-h-screen bg-[#FDFDFD]"
                >
                  {dbConnectionError ? (
                    <SkrinDegradasiDB sedangMenyemak={retryingDb} onCubaSemula={fetchDbState} />
                  ) : (
                  <main className="max-w-6xl w-full mx-auto">
                    <FrontpageView
                      entries={entries}
                      users={users}
                      systemSettings={systemSettings}
                      setSelectedEntry={() => {}}
                      setSelectedAuthorId={() => {}}
                      setActiveTab={() => {}}
                      currentUser={null}
                      currentEditoriumRole={currentEditoriumUser?.role}
                      currentEditoriumName={authUser?.role === 'KETUA_EDITOR' ? authUser.penName : undefined}
                      currentEditoriumContact={authUser?.role === 'KETUA_EDITOR' ? authUser.email : undefined}
                      onRequestEditLogin={requestLogin}
                      onLogout={handleLogout}
                      inTheNewsGoogleDocText={inTheNewsGoogleDocText}
                      worldClockHolidaysGoogleDocText={worldClockHolidaysGoogleDocText}
                      setIndexSearchQuery={() => {}}
                      deepLinkKodPendek={kodPendek}
                    />
                  </main>
                  )}
                </motion.div>
              )}
            </LaluanKandungan>
          } />
          <Route path="/sandbox" element={
            <motion.div
              key="sandbox"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="min-h-screen bg-[#FDFDFD]"
            >
              <main className="max-w-6xl w-full mx-auto">
                <FrontpageView
                  entries={entries}
                  users={users}
                  systemSettings={systemSettings}
                  setSelectedEntry={() => {}}
                  setSelectedAuthorId={() => {}}
                  setActiveTab={() => {}}
                  currentUser={null}
                  currentEditoriumRole={currentEditoriumUser?.role}
                  currentEditoriumName={authUser?.role === 'KETUA_EDITOR' ? authUser.penName : undefined}
                  currentEditoriumContact={authUser?.role === 'KETUA_EDITOR' ? authUser.email : undefined}
                  onRequestEditLogin={requestLogin}
                  onLogout={handleLogout}
                  inTheNewsGoogleDocText={inTheNewsGoogleDocText}
                  worldClockHolidaysGoogleDocText={worldClockHolidaysGoogleDocText}
                  setIndexSearchQuery={() => {}}
                />
              </main>
            </motion.div>
          } />

          <Route path="/studio/semakan-kandungan" element={
            <motion.div
              key="content-review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <React.Suspense fallback={<LoadingScreen />}>
                <ContentReview />
              </React.Suspense>
            </motion.div>
          } />

          <Route path="/editorium" element={
            <motion.div
              key="editorium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <React.Suspense fallback={<LoadingScreen />}>
                <EditoriumView
                  currentUser={currentEditoriumUser}
                  onRequestLogin={() => requestLogin()}
                  onLogout={handleLogout}
                  onProfilKemasKini={handleProfilKemasKini}
                />
              </React.Suspense>
            </motion.div>
          } />

          {/* /tentang DIBUANG (2026-08-08, audit halaman mati) — tiada satu pautan pun ke sini
              sejak "Mengenai Adjung" (modal footer, kunci 'about') menggantikannya. */}
          <Route path="/hubungi" element={<HalamanStatik pageKey="hubungi" labelSandaran="Hubungi" />} />
          {/* "Polisi & Penafian" dipecah kepada tiga laluan berasingan (2026-08-05, susun atur
              footer baharu) — /polisi-penafian lama sengaja tak dikekalkan sebagai alias, laluan
              baharu ni sahaja yang dipaut daripada footer sekarang. */}
          <Route path="/polisi-privasi" element={<HalamanStatik pageKey="polisi-privasi" labelSandaran="Polisi Privasi" />} />
          <Route path="/terma-penggunaan" element={<HalamanStatik pageKey="terma-penggunaan" labelSandaran="Terma Penggunaan" />} />
          <Route path="/penafian" element={<HalamanStatik pageKey="penafian" labelSandaran="Penafian" />} />
          {/* Penaja (2026-08-05, Fasa 12) — struktur data berkumpul (senarai per-bulan), bukan
              prosa title+content macam HalamanStatik, jadi komponen tersendiri. */}
          <Route path="/penaja" element={<HalamanPenaja />} />
          {/* Borang permohonan editor awam (2026-08-25) — lihat core/routes/permohonanEditorRoutes.js. */}
          <Route path="/sertai-pasukan-editorial" element={<HalamanSertai />} />
          {/* Borang permohonan penaja awam (2026-08-30) — lihat core/routes/permohonanPenajaRoutes.js. */}
          <Route path="/jadi-penaja" element={<HalamanMohonPenaja />} />
          <Route path="/lengkapkan-penajaan" element={<HalamanLengkapkanPenajaan />} />
          <Route path="/tetapkan-kata-laluan" element={<TetapkanKataLaluan />} />
          <Route path="*" element={<TidakDijumpai />} />

        </Routes>
      </AnimatePresence>
      </ErrorBoundary>
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} onSuccess={handleLoginSuccess} />
      )}
      {/* Gerbang log masuk PERTAMA (2026-08-05, permintaan Izzat) — "editor masa daftar masuk
          kali pertama baca dan setuju beberapa syarat dan peraturan", digabung profil wajib.
          `termaDipersetujuiPada` kosong = belum pernah setuju; modal ni TIDAK boleh
          ditutup/langkau, dirender DI ATAS segala-galanya (z-[200], lebih tinggi drpd
          LoginModal/modal lain z-[70]) sehingga borang dihantar berjaya.
          Skop kepada Editorium/Studio SAHAJA (2026-08-06, pembetulan) — dahulu authUser wujud
          + terma belum setuju memaparkan modal ni di MANA-MANA laluan termasuk frontpage awam,
          sebab sesi editor kekal dalam browser walaupun editor tu cuma nak baca portal macam
          pembaca biasa (cth: buka brief.adjung.com terus dari carian Google). Gerbang "kali
          pertama log masuk" patut memaksa selesaikan profil SEBELUM mula kerja editorial, bukan
          menyekat pembacaan portal sendiri. */}
      <GerbangProfilWajib authUser={authUser} onSelesai={handleProfilKemasKini} />
    </BrowserRouter>
  );
}
