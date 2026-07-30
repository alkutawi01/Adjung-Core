import React, { useState, useEffect } from 'react';
import { User, Entry, SystemSettings } from './types';
import { db } from './db/mockDb';
import { FrontpageView } from './components/portal/FrontpageView';
import { ContentReview } from './components/studio/ContentReview';
import { EditoriumView } from './components/editorium/EditoriumView';
import { LoginModal } from './components/editorium/LoginModal';
import { muatPindaanTier } from './config/tierOverrides';
import { LoadingScreen } from './components/common/LoadingScreen';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

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
  const readStoredAuth = (): { username: string; penName: string; email: string; role: string } | null => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem(AUTH_STORAGE_KEY) || window.sessionStorage.getItem(AUTH_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };
  const [authUser, setAuthUser] = useState<{ username: string; penName: string; email: string; role: string } | null>(readStoredAuth);
  const [showLoginModal, setShowLoginModal] = useState(false);
  // Dijalankan lepas log masuk berjaya (cth terus buka mod edit di frontpage) — bukan cuma
  // menutup modal sahaja.
  const [pendingLoginSuccess, setPendingLoginSuccess] = useState<(() => void) | null>(null);

  const currentEditoriumUser: { name: string; role: 'KETUA_EDITOR' | 'EDITOR' } | null = (() => {
    if (!authUser) return null;
    const normalized = String(authUser.role || '').toLowerCase();
    if (normalized.includes('ketua') || normalized.includes('chief')) {
      return { name: authUser.penName || authUser.username, role: 'KETUA_EDITOR' };
    }
    if (normalized.includes('editor')) {
      return { name: authUser.penName || authUser.username, role: 'EDITOR' };
    }
    return { name: authUser.penName || authUser.username, role: 'KETUA_EDITOR' };
  })();

  // Titik masuk tunggal untuk buka borang log masuk — dari mana-mana (butang "Edit Kandungan"
  // di frontpage, butang "Log Masuk" di Editorium). `onSuccess` pilihan dipanggil lepas log
  // masuk berjaya (cth terus aktifkan mod edit).
  const requestLogin = (onSuccess?: () => void) => {
    setPendingLoginSuccess(() => onSuccess || null);
    setShowLoginModal(true);
  };

  const handleLoginSuccess = (user: { username: string; penName: string; email: string; role: string }, rememberMe: boolean) => {
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
              <ContentReview />
            </motion.div>
          } />

          <Route path="/editorium" element={
            <motion.div
              key="editorium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <EditoriumView
                currentUser={currentEditoriumUser}
                onRequestLogin={() => requestLogin()}
                onLogout={handleLogout}
              />
            </motion.div>
          } />

        </Routes>
      </AnimatePresence>
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} onSuccess={handleLoginSuccess} />
      )}
    </BrowserRouter>
  );
}
