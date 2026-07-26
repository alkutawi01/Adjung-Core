import React, { useState } from 'react';
import { List, FolderOpen, Settings, History, Landmark, Palette } from 'lucide-react';
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
    { id: 'indeks', label: 'Indeks', Icon: List },
    { id: 'direktori', label: 'Direktori', Icon: FolderOpen },
    { id: 'tetapan', label: 'Tetapan', Icon: Settings, restricted: currentUser.role !== 'KETUA_EDITOR' },
    { id: 'log_audit', label: 'Log Audit', Icon: History },
    { id: 'perlembagaan', label: 'Perlembagaan', Icon: Landmark },
    { id: 'reka_bentuk', label: 'Reka Bentuk', Icon: Palette }
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1F1F1F] font-sans flex flex-col antialiased">
      {/* Editorium Header -- dua baris, gaya iOS "Liquid Glass": permukaan kaca terapung, kapsul
          bercahaya pada item aktif, ikon+label macam tab bar iOS (rujukan: Apple HIG - Tab Bars) */}
      <header className="relative bg-[#161513] text-[#FDFDFD] select-none overflow-hidden">
        {/* Cahaya latar bertona maroon -- bagi permukaan kaca sesuatu utk dibiaskan/blur, tanpa
            ini backdrop-blur atas latar rata tak nampak kesan langsung */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 500px 200px at 30% 0%, rgba(128,35,52,0.35), transparent 60%), radial-gradient(ellipse 400px 180px at 80% 100%, rgba(128,35,52,0.25), transparent 60%)'
          }}
        />
        {/* Baris 1: Logo (kiri) -- Identiti pengguna (kanan) */}
        <div className="relative px-4 md:px-8 py-3 flex flex-wrap justify-between items-center gap-3 border-b border-white/[0.06]">
          <Tooltip text="Klik untuk kembali ke Frontpage">
            <a href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity select-none">
              <span className="font-serif font-normal text-xl tracking-tight text-[#FDFDFD] leading-none">{BRAND.logoText}</span>
              <span className="font-sans text-[9px] tracking-[0.22em] font-semibold text-[#8a6a6f] uppercase leading-none border-l border-white/15 pl-2.5">
                {BRAND.subLabel} · Editorium
              </span>
            </a>
          </Tooltip>

          <div className="flex items-center gap-2.5 font-sans text-[11px]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif' }}>
            <div className="flex items-center gap-2 bg-white/[0.06] backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/[0.08]">
              <span className="relative flex w-1.5 h-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-stone-200 font-medium">{currentUser.name}</span>
              <span className="text-stone-600">·</span>
              <span className="text-stone-500">{currentUser.role === 'KETUA_EDITOR' ? 'Ketua Editor' : 'Editor'}</span>
            </div>

            {onUserSwitch && (
              <div className="flex items-center gap-0.5 bg-white/[0.06] backdrop-blur-xl p-0.5 rounded-full border border-white/[0.08]">
                <button
                  onClick={() => onUserSwitch('KETUA_EDITOR')}
                  className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                    currentUser.role === 'KETUA_EDITOR' ? 'bg-white/[0.12] text-[#e8a4ac]' : 'text-stone-500 hover:text-stone-300'
                  }`}
                >
                  Ketua Editor
                </button>
                <button
                  onClick={() => onUserSwitch('EDITOR')}
                  className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                    currentUser.role === 'EDITOR' ? 'bg-white/[0.12] text-[#e8a4ac]' : 'text-stone-500 hover:text-stone-300'
                  }`}
                >
                  Editor
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Baris 2: Navigasi -- kapsul kaca terapung ditengah, setiap tab ikon+label, tab aktif
            dapat highlight kaca sendiri (lensing/material lapis-atas-lapis, bukan pil warna rata) */}
        <div className="flex justify-center px-4 py-3.5 overflow-x-auto">
          <nav
            className="flex items-center gap-1 bg-white/[0.05] backdrop-blur-2xl p-1 rounded-full border border-white/[0.08] shadow-[0_8px_30px_-4px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif' }}
          >
            {navItems.map(item => {
              const isActive = currentTab === item.id;
              const { Icon } = item;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`relative flex items-center gap-1.5 text-[12.5px] font-medium px-3.5 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? 'bg-white/[0.14] text-white shadow-[0_1px_4px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md'
                      : item.restricted
                      ? 'text-stone-600 cursor-not-allowed'
                      : 'text-stone-400 hover:text-stone-100 hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#e8a4ac]' : ''}`} strokeWidth={2.2} />
                  {item.label} {item.restricted ? '🔒' : ''}
                </button>
              );
            })}
          </nav>
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
