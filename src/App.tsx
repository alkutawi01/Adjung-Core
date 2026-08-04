import React, { useState, useEffect } from 'react';
import { User, Entry, SystemSettings } from './types';
import { db } from './db/mockDb';
import { FrontpageView } from './components/portal/FrontpageView';
import { LoginModal } from './components/editorium/LoginModal';
import { muatPindaanTier } from './config/tierOverrides';
import { muatPindaanLabel } from './config/labelOverrides';
import { LoadingScreen } from './components/common/LoadingScreen';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { HalamanStatik } from './components/portal/HalamanStatik';
import { TidakDijumpai } from './components/portal/TidakDijumpai';
import { TetapkanKataLaluan } from './components/portal/TetapkanKataLaluan';

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
  const [authUser, setAuthUser] = useState<{ id: string; username: string; penName: string; email: string; role: string; roles?: string[] } | null>(readStoredAuth);
  const [showLoginModal, setShowLoginModal] = useState(false);
  // Dijalankan lepas log masuk berjaya (cth terus buka mod edit di frontpage) — bukan cuma
  // menutup modal sahaja.
  const [pendingLoginSuccess, setPendingLoginSuccess] = useState<(() => void) | null>(null);

  // id dibawa sekali (2026-08-01) — "Draf Saya" perlukannya untuk membaca slot yang ditugaskan
  // kepada editor ni (jadual slot_editors berkunci pada users.id, bukan nama pena). `roles`
  // (2026-08-02, Fasa 3) — senarai BERBILANG peranan sebenar (pentadbir/ketua_editor/
  // penolong_ketua_editor/editor); `role` legasi ('KETUA_EDITOR'/'EDITOR') dikekalkan sebagai
  // label paparan sahaja — SEMUA kawalan akses sebenar (client MAHUPUN server) mesti guna `roles`.
  const currentEditoriumUser: { id: string; name: string; role: 'KETUA_EDITOR' | 'EDITOR'; roles: string[] } | null =
    authUser && (authUser.role === 'KETUA_EDITOR' || authUser.role === 'EDITOR')
      // Sesi yang tersimpan SEBELUM id mula dibawa (2026-08-01) tiada medan `id` — dibiar kosong,
      // bukan direka. Kesannya terhad: draf bercap nama tetap muncul dalam "Draf Saya", cuma
      // sandaran "ikut slot" untuk draf lama tanpa nama tidak berfungsi sehingga log masuk semula.
      ? { id: authUser.id || '', name: authUser.penName, role: authUser.role as 'KETUA_EDITOR' | 'EDITOR', roles: authUser.roles || [] }
      : null;

  // Titik masuk tunggal untuk buka borang log masuk — dari mana-mana (butang "Edit Kandungan"
  // di frontpage, butang "Log Masuk" di Editorium). `onSuccess` pilihan dipanggil lepas log
  // masuk berjaya (cth terus aktifkan mod edit).
  const requestLogin = (onSuccess?: () => void) => {
    setPendingLoginSuccess(() => onSuccess || null);
    setShowLoginModal(true);
  };

  const handleLoginSuccess = (user: { id: string; username: string; penName: string; email: string; role: string; roles: string[] }, rememberMe: boolean) => {
    setAuthUser(user);
    const target = rememberMe ? window.localStorage : window.sessionStorage;
    const other = rememberMe ? window.sessionStorage : window.localStorage;
    target.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
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
  const handleProfilKemasKini = (patch: { penName?: string }) => {
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
        console.error('Failed to sync state from database, using client defaults:', err);
        // Fallback to mockDb in-memory defaults
        setUsers(db.getUsers());
        setEntries(db.getEntries());
        setSystemSettings(db.getSystemSettings());
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
              {dbConnectionError && (
                <div role="alert" className="bg-red-700 text-white text-xs px-4 py-2.5 flex items-center justify-between shadow-md font-sans">
                  <div className="flex items-center gap-2">
                    <span className="font-bold tracking-wide uppercase bg-red-900 px-2 py-0.5 rounded">Amaran Sambungan</span>
                    <span>Gagal menyambung ke pangkalan data SQLite (server.js). Mod Data Sementara Aktif — sebarang suntingan tidak akan disimpan ke database.</span>
                  </div>
                  <button
                    onClick={fetchDbState}
                    disabled={retryingDb}
                    className="bg-white text-red-900 hover:bg-red-50 font-semibold px-3 py-1 rounded transition-colors text-xs disabled:opacity-50"
                  >
                    {retryingDb ? 'Menyemak...' : 'Cuba Semula Sambungan'}
                  </button>
                </div>
              )}
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
                  {dbConnectionError && (
                    <div role="alert" className="bg-red-700 text-white text-xs px-4 py-2.5 flex items-center justify-between shadow-md font-sans">
                      <div className="flex items-center gap-2">
                        <span className="font-bold tracking-wide uppercase bg-red-900 px-2 py-0.5 rounded">Amaran Sambungan</span>
                        <span>Gagal menyambung ke pangkalan data SQLite (server.js). Mod Data Sementara Aktif — sebarang suntingan tidak akan disimpan ke database.</span>
                      </div>
                      <button
                        onClick={fetchDbState}
                        disabled={retryingDb}
                        className="bg-white text-red-900 hover:bg-red-50 font-semibold px-3 py-1 rounded transition-colors text-xs disabled:opacity-50"
                      >
                        {retryingDb ? 'Menyemak...' : 'Cuba Semula Sambungan'}
                      </button>
                    </div>
                  )}
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

          <Route path="/tentang" element={<HalamanStatik pageKey="tentang" labelSandaran="Tentang" />} />
          <Route path="/hubungi" element={<HalamanStatik pageKey="hubungi" labelSandaran="Hubungi" />} />
          <Route path="/polisi-penafian" element={<HalamanStatik pageKey="polisi-penafian" labelSandaran="Polisi & Penafian" />} />
          <Route path="/tetapkan-kata-laluan" element={<TetapkanKataLaluan />} />
          <Route path="*" element={<TidakDijumpai />} />

        </Routes>
      </AnimatePresence>
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} onSuccess={handleLoginSuccess} />
      )}
    </BrowserRouter>
  );
}
