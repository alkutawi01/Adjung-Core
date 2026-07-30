import React, { useState } from 'react';
import { List, LayoutGrid, FolderOpen, Settings, History, Landmark, Palette, LogOut, LogIn, Lock, Zap, PenLine, FileText, Mail, BookOpen, Bell } from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { BRAND } from '../../config/brand';
import { NotificationDrawerModal } from './NotificationDrawerModal';

interface EditoriumLayoutProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  // null = belum log masuk.
  currentUser?: { name: string; role: 'KETUA_EDITOR' | 'EDITOR' } | null;
  onRequestLogin?: () => void;
  onLogout?: () => void;
  onOpenSlotPicker?: () => void;
  children?: React.ReactNode;
}

export const EditoriumLayout: React.FC<EditoriumLayoutProps> = ({
  activeTab = 'indeks',
  onTabChange,
  currentUser = null,
  onRequestLogin,
  onLogout,
  onOpenSlotPicker,
  children
}) => {
  const [currentTab, setCurrentTab] = useState(activeTab);
  const [showDrawer, setShowDrawer] = useState(false);
  const [noteCount, setNoteCount] = useState(0);

  React.useEffect(() => {
    fetch('/api/system/editor-notes?status=aktif')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.notes)) {
          setNoteCount(data.notes.length);
        }
      })
      .catch(() => {});
  }, []);

  const handleNavClick = (tabId: string) => {
    setCurrentTab(tabId);
    if (onTabChange) onTabChange(tabId);
  };

  const loggedOut = !currentUser;

  interface NavItem {
    id: string;
    label: string;
    Icon: any;
    restricted?: boolean;
  }

  const operationalNavItems: NavItem[] = [
    { id: 'indeks', label: 'Kandungan', Icon: List },
    { id: 'draf_saya', label: 'Draf Saya', Icon: FileText },
    { id: 'modul_khas', label: 'Modul Khas', Icon: Zap },
    { id: 'slot', label: 'Slot', Icon: LayoutGrid },
    { id: 'nota_ketua_editor', label: 'Nota Ketua Editor', Icon: Bell }
  ];

  const governanceNavItems: NavItem[] = [
    { id: 'editorial', label: 'Polisi Editorial', Icon: BookOpen },
    { id: 'direktori', label: 'Direktori', Icon: FolderOpen },
    { id: 'tetapan', label: 'Tetapan', Icon: Settings, restricted: currentUser?.role !== 'KETUA_EDITOR' },
    { id: 'dokumentasi', label: 'Dokumentasi & Rujukan', Icon: Landmark }
  ];

  const renderNavGroup = (title: string, items: NavItem[]) => (
    <div className="space-y-1">
      <div className="px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400 mb-1.5">
        {title}
      </div>
      <div className="space-y-1">
        {items.map(item => {
          const isActive = currentTab === item.id && !loggedOut;
          const { Icon } = item;
          const isLocked = loggedOut || item.restricted;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              disabled={isLocked}
              aria-disabled={isLocked}
              title={loggedOut ? 'Log masuk dahulu untuk membuka tab ini' : undefined}
              className={`w-full flex items-center justify-between text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-[#802334] text-white shadow-md font-bold'
                  : isLocked
                  ? 'text-stone-400 cursor-not-allowed opacity-60'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-200/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-500'}`} strokeWidth={2} />
                <span>{item.label}</span>
              </div>
              {!loggedOut && item.restricted && <Lock className="w-3.5 h-3.5 text-stone-400" strokeWidth={2} />}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1F1F1F] font-sans flex flex-col antialiased">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-[#802334] text-white select-none shadow-md">
        <div className="px-6 py-2.5 flex justify-between items-center gap-4">
          <Tooltip text="Klik untuk kembali ke Frontpage">
            <a href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity select-none shrink-0">
              <span className="font-serif font-bold text-xl tracking-tight text-white leading-none">{BRAND.logoText}</span>
              <span className="font-sans text-[9px] tracking-[0.22em] font-semibold text-[#c9929a] uppercase leading-none border-l border-white/20 pl-2.5">
                {BRAND.subLabel} · Editorium
              </span>
            </a>
          </Tooltip>

          <div className="flex items-center gap-2.5 font-sans text-xs">
            {currentUser ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowDrawer(true)}
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full border border-white/15 text-white transition-colors cursor-pointer"
                  title="Makluman & Notis Sistem"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span className="font-semibold">Makluman</span>
                  {noteCount > 0 && (
                    <span className="bg-amber-400 text-stone-950 px-1.5 py-0.2 text-[10px] font-bold rounded-full ml-0.5">
                      {noteCount}
                    </span>
                  )}
                </button>
                {onOpenSlotPicker && (
                  <button
                    type="button"
                    onClick={onOpenSlotPicker}
                    className="flex items-center gap-1.5 bg-white text-[#802334] px-3 py-1.5 rounded-full font-bold hover:bg-stone-100 transition-colors cursor-pointer shadow-xs"
                  >
                    <PenLine className="w-3.5 h-3.5 text-[#802334]" /> + Kandungan Baharu
                  </button>
                )}
                <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/15">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                    <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-stone-100 font-bold">{currentUser.name}</span>
                  <span className="text-white/40">·</span>
                  <span className="text-[#e0b7bd] font-medium">{currentUser.role === 'KETUA_EDITOR' ? 'Ketua Editor' : 'Editor'}</span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full border border-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Log Keluar
                  </button>
                )}
              </>
            ) : (
              onRequestLogin && (
                <button
                  onClick={onRequestLogin}
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full border border-white/15 text-white transition-colors font-medium cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" /> Log Masuk
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Body with Vertical Left Sidebar */}
      <div className="flex flex-1 min-h-[calc(100vh-52px)]">
        {/* Vertical Left Sidebar */}
        <aside className="w-64 bg-[#F6F4EF] border-r border-stone-200 p-4 space-y-6 shrink-0 select-none">
          {renderNavGroup('Operasi Harian', operationalNavItems)}
          <div className="border-t border-stone-200 pt-4">
            {renderNavGroup('Tata Kelola & Rujukan', governanceNavItems)}
          </div>
        </aside>

        {/* Right Main Content Canvas */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto bg-[#FDFDFD] overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Drawer Modal */}
      {showDrawer && (
        <NotificationDrawerModal
          onClose={() => setShowDrawer(false)}
          currentUser={currentUser}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-stone-100 px-6 py-3 font-sans text-xs text-stone-500 flex flex-wrap justify-between items-center gap-2 select-none z-20">
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
