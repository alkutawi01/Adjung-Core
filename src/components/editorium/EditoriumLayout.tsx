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
      {/* Editorium Header */}
      <header className="relative bg-gradient-to-b from-[#252525] to-[#181818] text-[#FDFDFD] px-4 md:px-8 py-3.5 flex flex-wrap justify-between items-center gap-4 select-none shadow-[0_4px_24px_-6px_rgba(0,0,0,0.4)]">
        {/* Jalur bawah bertona maroon (motif "scholarly-line" sedia ada) menggantikan garis kelabu rata */}
        <div
          className="absolute inset-x-0 bottom-0 h-px"
          style={{ backgroundImage: 'linear-gradient(to right, transparent, rgba(128,35,52,0.5) 15%, rgba(128,35,52,0.5) 85%, transparent)' }}
        />

        {/* Left Side: Logo (Paling Kiri) -> Divider -> Badge Editorium -> Menu Navigasi */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Logo Adjung Brief Baharu (Paling Kiri, BRIEF di bawah Adjung, Klik ke Frontpage) */}
          <Tooltip text="Klik untuk kembali ke Frontpage">
            <a href="/" className="flex flex-col items-center justify-center hover:opacity-90 transition-opacity select-none">
              <span className="font-serif font-normal text-2xl tracking-tight text-[#FDFDFD] leading-none">{BRAND.logoText}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-[1px] w-2.5 bg-[#b4b4b4]"></span>
                <span className="font-sans text-[8px] tracking-[0.2em] font-semibold text-[#b4b4b4] uppercase leading-none">{BRAND.subLabel}</span>
                <span className="h-[1px] w-2.5 bg-[#b4b4b4]"></span>
              </div>
            </a>
          </Tooltip>

          <span className="h-7 w-px bg-gradient-to-b from-transparent via-stone-700 to-transparent hidden sm:block" />

          {/* Label Tajuk Ruang Kerja Editorium */}
          <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-stone-400 font-semibold hidden md:inline-block">
            Editorium
          </span>

          {/* 4-Module Navigation Menu */}
          <nav className="flex items-center gap-1 bg-black/25 p-1 rounded-lg border border-white/[0.06] shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]">
            {navItems.map(item => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`font-sans text-xs font-semibold px-3.5 py-1.5 rounded-md transition-all ${
                    isActive
                      ? 'bg-gradient-to-b from-[#8f2739] to-[#732030] text-white shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : item.restricted
                      ? 'text-stone-600 cursor-not-allowed'
                      : 'text-stone-400 hover:text-[#FDFDFD] hover:bg-white/[0.06]'
                  }`}
                >
                  {item.label} {item.restricted ? '🔒' : ''}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Role Indicator & Role Switcher */}
        <div className="flex items-center gap-3 font-sans text-xs">
          <div className="flex items-center gap-2.5 bg-white/[0.04] backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/[0.08]">
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500"></span>
            </span>
            <span className="text-stone-100 font-medium">{currentUser.name}</span>
            <span className="text-stone-600">·</span>
            <span className="text-stone-400">{currentUser.role === 'KETUA_EDITOR' ? 'Ketua Editor' : 'Editor'}</span>
          </div>

          {onUserSwitch && (
            <div className="flex bg-white/[0.04] backdrop-blur-sm p-0.5 rounded-lg border border-white/[0.08] text-xs">
              <button
                onClick={() => onUserSwitch('KETUA_EDITOR')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  currentUser.role === 'KETUA_EDITOR' ? 'bg-gradient-to-b from-[#8f2739] to-[#732030] text-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Ketua Editor
              </button>
              <button
                onClick={() => onUserSwitch('EDITOR')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  currentUser.role === 'EDITOR' ? 'bg-gradient-to-b from-[#8f2739] to-[#732030] text-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Editor
              </button>
            </div>
          )}
        </div>
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
