import React, { useState } from 'react';
import { Tooltip } from '../common/Tooltip';
import { BRAND } from '../../config/brand';

interface EditoriumLayoutProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  currentUser?: { name: string; role: 'KETUA_EDITOR' | 'EDITOR' };
  onUserSwitch?: (role: 'KETUA_EDITOR' | 'EDITOR') => void;
  children?: React.ReactNode;
}

export const EditoriumLayout: React.FC<EditoriumLayoutProps> = ({
  activeTab = 'indeks',
  onTabChange,
  currentUser = { name: 'Izzat Anas', role: 'KETUA_EDITOR' },
  onUserSwitch,
  children
}) => {
  const [currentTab, setCurrentTab] = useState(activeTab);

  const handleNavClick = (tabId: string) => {
    setCurrentTab(tabId);
    if (onTabChange) onTabChange(tabId);
  };

  const navItems = [
    { id: 'indeks', label: 'Indeks' },
    { id: 'direktori', label: 'Direktori' },
    { id: 'tetapan', label: 'Tetapan', restricted: currentUser.role !== 'KETUA_EDITOR' },
    { id: 'log_audit', label: 'Log Audit' },
    { id: 'perlembagaan', label: 'Perlembagaan' },
    { id: 'reka_bentuk', label: 'Reka Bentuk' }
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1F1F1F] font-sans flex flex-col antialiased">
      {/* Editorium Header -- dua baris: (1) identiti + pengguna, senyap; (2) navigasi, tengah, lapang */}
      <header className="bg-[#161513] text-[#FDFDFD] select-none">
        {/* Baris 1: Logo (kiri) -- Identiti pengguna (kanan) */}
        <div className="px-4 md:px-8 py-3 flex flex-wrap justify-between items-center gap-3 border-b border-white/[0.06]">
          <Tooltip text="Klik untuk kembali ke Frontpage">
            <a href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity select-none">
              <span className="font-serif font-normal text-xl tracking-tight text-[#FDFDFD] leading-none">{BRAND.logoText}</span>
              <span className="font-sans text-[9px] tracking-[0.22em] font-semibold text-[#8a6a6f] uppercase leading-none border-l border-white/15 pl-2.5">
                {BRAND.subLabel} · Editorium
              </span>
            </a>
          </Tooltip>

          <div className="flex items-center gap-3 font-sans text-[11px]">
            <div className="flex items-center gap-2">
              <span className="relative flex w-1.5 h-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-stone-200 font-medium">{currentUser.name}</span>
              <span className="text-stone-600">·</span>
              <span className="text-stone-500 uppercase tracking-wide">{currentUser.role === 'KETUA_EDITOR' ? 'Ketua Editor' : 'Editor'}</span>
            </div>

            {onUserSwitch && (
              <div className="flex items-center gap-0.5 pl-3 border-l border-white/10">
                <button
                  onClick={() => onUserSwitch('KETUA_EDITOR')}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    currentUser.role === 'KETUA_EDITOR' ? 'text-[#c9737f]' : 'text-stone-600 hover:text-stone-400'
                  }`}
                >
                  Ketua Editor
                </button>
                <span className="text-stone-700">/</span>
                <button
                  onClick={() => onUserSwitch('EDITOR')}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    currentUser.role === 'EDITOR' ? 'text-[#c9737f]' : 'text-stone-600 hover:text-stone-400'
                  }`}
                >
                  Editor
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Baris 2: Navigasi -- ditengahkan, lapang, penunjuk underline (bukan pil) */}
        <nav className="relative flex items-center justify-center gap-8 md:gap-10 px-4 py-4 overflow-x-auto">
          {navItems.map(item => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`relative font-sans text-[13px] tracking-wide font-medium pb-2.5 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-[#FDFDFD]'
                    : item.restricted
                    ? 'text-stone-700 cursor-not-allowed'
                    : 'text-stone-500 hover:text-stone-200'
                }`}
              >
                {item.label} {item.restricted ? '🔒' : ''}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-px h-[2px] bg-[#802334] rounded-full" />
                )}
              </button>
            );
          })}
          <div
            className="absolute inset-x-0 bottom-0 h-px"
            style={{ backgroundImage: 'linear-gradient(to right, transparent, rgba(255,255,255,0.08) 15%, rgba(255,255,255,0.08) 85%, transparent)' }}
          />
        </nav>
      </header>

      {/* Main Content Workspace Area */}
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-stone-100 px-4 md:px-8 py-3 font-sans text-xs text-stone-500 flex flex-wrap justify-between items-center gap-2 select-none">
        <div>
          Adjung Brief Editorium • Editorial Control System
        </div>
        <div>
          Status Sistem: <span className="text-emerald-700 font-semibold">🟢 Dilindungi & Aktif</span>
        </div>
      </footer>
    </div>
  );
};

export default EditoriumLayout;
