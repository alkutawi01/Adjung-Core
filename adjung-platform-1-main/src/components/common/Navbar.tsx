import React, { useState, useEffect, useRef } from 'react';
import { BRAND } from '../../config/brand';
import { useAppContext } from '../../context/AppContext';

interface NavbarProps {
  isHeaderHovered: boolean;
  setIsHeaderHovered: (hovered: boolean) => void;
  isFloating: boolean;
  showNavbar: boolean;
  scrollY: number;
  maxScroll: number;
  setShowAccountModal: (show: boolean) => void;
  setShowLoginModal: (show: boolean) => void;
  setLoginError: (err: string) => void;
  handleLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isHeaderHovered,
  setIsHeaderHovered,
  isFloating,
  showNavbar,
  scrollY,
  maxScroll,
  setShowAccountModal,
  setShowLoginModal,
  setLoginError,
  handleLogout,
}) => {
  const {
    currentUser,
    activeTab,
    setActiveTab,
    selectedAuthorId,
    setSelectedAuthorId,
    setSelectedEntry,
    setEditingEntry,
    hasPermission,
  } = useAppContext();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside the user menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleBrandClick = () => {
    setSelectedAuthorId('');
    setSelectedEntry(null);
    setEditingEntry(null);
    if (currentUser) {
      setActiveTab('frontpage');
    } else {
      setActiveTab('landing');
    }
  };

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    setSelectedEntry(null);
    setEditingEntry(null);
  };

  return (
    <nav 
      onMouseEnter={() => setIsHeaderHovered(true)}
      onMouseLeave={() => setIsHeaderHovered(false)}
      className={`w-full sticky top-0 z-40 px-4 md:px-8 select-none border-b transition-all ease-out backdrop-blur-md ${
        isHeaderHovered ? 'duration-200' : 'duration-[1500ms]'
      } ${
        isFloating 
          ? 'shadow-[0_4px_20px_rgba(128,35,52,0.08),0_1px_3px_rgba(128,35,52,0.04)] border-white/10' 
          : 'border-white/5 shadow-none'
      } bg-[#802334]/90`}
      style={{
        opacity: showNavbar 
          ? (isHeaderHovered 
              ? 1.0 
              : Math.max(0, 1.0 - scrollY / Math.max(100, Math.min(400, maxScroll)))) 
          : 0,
        pointerEvents: showNavbar ? 'auto' : 'none',
      }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between py-2">
        
        {/* Left: Beautiful brand wordmark logo linking back to Frontpage */}
        <div 
          onClick={handleBrandClick}
          className="flex items-center cursor-pointer group text-white hover:opacity-85 transition-opacity"
        >
          <span className="font-serif text-[15px] font-semibold tracking-wider">
            {BRAND.logoText}
          </span>
        </div>

        {/* Middle: Dynamic Navigation Links depending on portal/author context */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 md:gap-3">
            {selectedAuthorId === '' ? (
              /* PLATFORM PORTAL NAVIGATION (DIRECTORY, INDEX) */
              <>
                {/* Directory */}
                {currentUser && hasPermission('viewDirectory') && (
                  <button
                    type="button"
                    onClick={() => handleTabClick('directory')}
                    className={`relative px-2 py-1 text-xs font-mono tracking-wider uppercase transition cursor-pointer ${
                      activeTab === 'directory'
                        ? 'text-white font-bold after:absolute after:bottom-[-9px] after:left-2 after:right-2 after:h-[1.5px] after:bg-white'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Directory
                  </button>
                )}

                {/* Shared Index */}
                {currentUser && hasPermission('viewIndex') && (
                  <button
                    type="button"
                    onClick={() => handleTabClick('index')}
                    className={`relative px-2 py-1 text-xs font-mono tracking-wider uppercase transition cursor-pointer ${
                      activeTab === 'index'
                        ? 'text-white font-bold after:absolute after:bottom-[-9px] after:left-2 after:right-2 after:h-[1.5px] after:bg-white'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Index
                  </button>
                )}
              </>
            ) : (
              /* INDEPENDENT AUTHOR SITE NAVIGATION (FOLIO, BIOGRAPHY, DESK) */
              <>
                <button
                  type="button"
                  onClick={() => handleTabClick('folio')}
                  className={`relative px-2 py-1 text-xs font-mono tracking-wider uppercase transition cursor-pointer ${
                    activeTab === 'folio'
                      ? 'text-white font-bold after:absolute after:bottom-[-9px] after:left-2 after:right-2 after:h-[1.5px] after:bg-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Folio
                </button>

                <button
                  type="button"
                  onClick={() => handleTabClick('bio')}
                  className={`relative px-2 py-1 text-xs font-mono tracking-wider uppercase transition cursor-pointer ${
                    activeTab === 'bio'
                      ? 'text-white font-bold after:absolute after:bottom-[-9px] after:left-2 after:right-2 after:h-[1.5px] after:bg-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Biography
                </button>

                {/* Desk: Only if the authenticated user is the owner of this author site */}
                {currentUser?.id === selectedAuthorId && (
                  <>
                    <span className="text-white/20 text-[10px] select-none font-mono">|</span>
                    <button
                      type="button"
                      onClick={() => handleTabClick('desk')}
                      className={`px-2.5 py-1 text-xs font-mono tracking-wider uppercase transition border rounded-sm cursor-pointer ${
                        activeTab === 'desk'
                          ? 'bg-white border-white text-[#802334] font-semibold'
                          : 'text-white/80 border-white/20 hover:bg-white/10 font-medium'
                      }`}
                      title="Your private workspace"
                    >
                      desk
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          <div className="h-4 w-px bg-white/20" />

          {/* Right: Authentication or User menu */}
          {currentUser ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono tracking-wider text-white/80 hover:text-white transition uppercase cursor-pointer"
              >
                <span>{currentUser.penName}</span>
                <span className="text-[10px] opacity-60">▾</span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-[#FDFDFD] border border-stone-200 shadow-md rounded-sm py-2 z-50 animate-fade-in font-sans text-left">
                  <div className="px-4 py-2 border-b border-stone-100 bg-stone-50/40 select-none">
                    <div className="font-serif text-[13px] font-semibold text-stone-950 leading-tight">
                      {currentUser.penName}
                    </div>
                    <div className="font-mono text-[9px] text-[#802334] font-semibold uppercase tracking-wider mt-1">
                      {currentUser.role}
                    </div>
                    <div className="font-mono text-[9px] text-stone-400 mt-0.5">
                      {currentUser.username}
                    </div>
                  </div>

                  <div className="py-1 font-mono uppercase tracking-wider text-[11px]">
                    {selectedAuthorId !== currentUser.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);
                          setSelectedAuthorId(currentUser.id);
                          setActiveTab('folio');
                          setSelectedEntry(null);
                          setEditingEntry(null);
                        }}
                        className="w-full text-left px-4 py-1.5 text-stone-600 hover:text-[#802334] hover:bg-stone-50/60 transition-colors font-semibold border-b border-stone-100 pb-2 mb-1 cursor-pointer"
                      >
                        My Site
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowAccountModal(true);
                      }}
                      className="w-full text-left px-4 py-1.5 text-stone-600 hover:text-[#802334] hover:bg-stone-50/60 transition-colors cursor-pointer"
                    >
                      Account
                    </button>

                    {hasPermission('curateFrontpage') && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);
                          setSelectedAuthorId('');
                          setActiveTab('editorium');
                          setSelectedEntry(null);
                          setEditingEntry(null);
                        }}
                        className={`w-full text-left px-4 py-1.5 transition-colors cursor-pointer ${
                          activeTab === 'editorium'
                            ? 'text-[#802334] bg-stone-50/60 font-semibold'
                            : 'text-stone-600 hover:text-[#802334] hover:bg-stone-50/60'
                        }`}
                      >
                        Editorium
                      </button>
                    )}

                    <div className="h-px bg-stone-100 my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-1.5 text-stone-600 hover:text-[#802334] hover:bg-stone-50/60 transition-colors font-medium cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLoginError('');
                setShowLoginModal(true);
              }}
              className="px-1.5 py-1 text-xs font-mono tracking-wider text-white/80 hover:text-white font-semibold transition uppercase cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
