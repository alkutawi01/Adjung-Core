import React, { useState } from 'react';

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
    { id: 'perlembagaan', label: 'Perlembagaan' }
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1F1F1F] font-sans flex flex-col antialiased">
      {/* Editorium Header */}
      <header className="bg-[#1F1F1F] text-[#FAF9F6] border-b border-stone-800 px-4 md:px-8 py-3 flex flex-wrap justify-between items-center gap-4 select-none shadow-sm">
        {/* Left Side: Logo (Paling Kiri) -> Divider -> Badge Editorium -> Menu Navigasi */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Logo Adjung Brief Baharu (Paling Kiri, BRIEF di bawah Adjung, Klik ke Frontpage) */}
          <a href="/" className="flex flex-col items-center justify-center hover:opacity-90 transition-opacity select-none" title="Klik untuk kembali ke Frontpage">
            <span className="font-serif font-normal text-2xl tracking-tight text-[#FAF9F6] leading-none">Adjung</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-[1px] w-2.5 bg-[#b4b4b4]"></span>
              <span className="font-sans text-[8px] tracking-[0.2em] font-semibold text-[#b4b4b4] uppercase leading-none">BRIEF</span>
              <span className="h-[1px] w-2.5 bg-[#b4b4b4]"></span>
            </div>
          </a>

          <span className="h-6 w-[1px] bg-stone-700 hidden sm:block" />

          {/* Label Tajuk Ruang Kerja Editorium */}
          <span className="font-sans text-xs uppercase tracking-widest text-stone-300 font-semibold hidden md:inline-block">
            EDITORIUM
          </span>

          {/* 4-Module Navigation Menu */}
          <nav className="flex items-center gap-1 bg-stone-900/90 p-1 rounded-md border border-stone-800">
            {navItems.map(item => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`font-sans text-xs font-semibold px-3.5 py-1.5 rounded transition-all ${
                    isActive
                      ? 'bg-[#802334] text-white shadow-xs'
                      : item.restricted
                      ? 'text-stone-600 cursor-not-allowed'
                      : 'text-stone-400 hover:text-[#FAF9F6] hover:bg-stone-800'
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
          <div className="flex items-center gap-2 bg-stone-800/90 px-3 py-1.5 rounded border border-stone-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-stone-100 font-medium">{currentUser.name}</span>
            <span className="text-stone-400">({currentUser.role === 'KETUA_EDITOR' ? 'Ketua Editor' : 'Editor'})</span>
          </div>

          {onUserSwitch && (
            <div className="flex bg-stone-800 p-0.5 rounded border border-stone-700 text-xs">
              <button
                onClick={() => onUserSwitch('KETUA_EDITOR')}
                className={`px-3 py-1 rounded font-semibold transition-colors ${
                  currentUser.role === 'KETUA_EDITOR' ? 'bg-[#802334] text-white' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Ketua Editor
              </button>
              <button
                onClick={() => onUserSwitch('EDITOR')}
                className={`px-3 py-1 rounded font-semibold transition-colors ${
                  currentUser.role === 'EDITOR' ? 'bg-[#802334] text-white' : 'text-stone-400 hover:text-stone-200'
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
