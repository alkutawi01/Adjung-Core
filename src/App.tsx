import React, { useState, useEffect } from 'react';
import { User, Entry, SystemSettings } from './types';
import { db } from './db/mockDb';
import { FrontpageView } from './components/portal/FrontpageView';
import { ContentReview } from './components/studio/ContentReview';
import { EditoriumView } from './components/editorium/EditoriumView';
import { LoadingScreen } from './components/common/LoadingScreen';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  // Peranan Editorium (Ketua Editor / Editor) — kongsi di sini (bukan local state dalam
  // EditoriumView) supaya FrontpageView (borang Tetapan Slot Bidang) turut boleh kunci ikut
  // peranan yang sama. Toggle kosmetik sahaja (auth backend sebenar memang KIV, pra-MVP).
  // Disimpan ke localStorage sebab navigasi antara "/" dan "/editorium" guna <a href> biasa
  // (bukan React Router Link) — setiap pertukaran laman reload penuh & reset semua state App
  // ni; tanpa localStorage, pilihan peranan akan sentiasa jatuh balik ke lalai setiap kali
  // pindah laman, menjadikan kunci Bidang tak bermakna dalam praktik.
  const ROLE_STORAGE_KEY = 'adjung-editorium-role';
  const [currentEditoriumUser, setCurrentEditoriumUser] = useState<{ name: string; role: 'KETUA_EDITOR' | 'EDITOR' }>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(ROLE_STORAGE_KEY) : null;
    return stored === 'EDITOR' ? { name: 'Editor Ahmad', role: 'EDITOR' } : { name: 'Izzat Anas', role: 'KETUA_EDITOR' };
  });
  const handleEditoriumRoleSwitch = (role: 'KETUA_EDITOR' | 'EDITOR') => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, role);
    if (role === 'KETUA_EDITOR') {
      setCurrentEditoriumUser({ name: 'Izzat Anas', role: 'KETUA_EDITOR' });
    } else {
      setCurrentEditoriumUser({ name: 'Editor Ahmad', role: 'EDITOR' });
    }
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
                  currentEditoriumRole={currentEditoriumUser.role}
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
                  currentEditoriumRole={currentEditoriumUser.role}
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
                onUserSwitch={handleEditoriumRoleSwitch}
              />
            </motion.div>
          } />

        </Routes>
      </AnimatePresence>
    </BrowserRouter>
  );
}
