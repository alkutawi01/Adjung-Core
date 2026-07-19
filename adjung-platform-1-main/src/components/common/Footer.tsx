import React from 'react';
import { BRAND } from '../../config/brand';
import { SystemSettings } from '../../types';

interface FooterProps {
  systemSettings: SystemSettings;
  setActiveTab: (tab: any) => void;
  setSelectedEntry: (entry: any) => void;
  setEditingEntry: (entry: any) => void;
}

export const Footer: React.FC<FooterProps> = ({
  systemSettings,
  setActiveTab,
  setSelectedEntry,
  setEditingEntry,
}) => {
  const navigateTo = (tab: string) => {
    setActiveTab(tab);
    setSelectedEntry(null);
    setEditingEntry(null);
    window.scrollTo(0, 0);
  };

  return (
    <footer className="w-full mt-12 pt-12 pb-8 border-t border-[#EAE8E3] bg-stone-50 select-none">
      <div className="max-w-4xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center items-start">
        <div className="space-y-4 flex flex-col items-center text-center">
          <h1 className="font-serif text-2xl font-semibold tracking-wider text-[#802334]">{BRAND.logoText}</h1>
          <p className="font-serif italic text-stone-600 text-sm max-w-sm mx-auto">{systemSettings.editorialPolicy}</p>
        </div>
        
        <div className="space-y-4 flex flex-col items-center text-center">
          <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-400 font-bold">Institutional</h4>
          <ul className="space-y-2 font-sans text-xs text-stone-600">
            <li>
              <button 
                type="button"
                onClick={() => navigateTo('editorial')} 
                className="hover:text-[#802334] transition cursor-pointer"
              >
                Editor's Notes
              </button>
            </li>
            <li>
              <button 
                type="button"
                onClick={() => navigateTo('notices')} 
                className="hover:text-[#802334] transition cursor-pointer"
              >
                Notices
              </button>
            </li>
            <li>
              <button 
                type="button"
                onClick={() => navigateTo('policies')} 
                className="hover:text-[#802334] transition cursor-pointer"
              >
                Publishing Policies
              </button>
            </li>
            <li>
              <button 
                type="button"
                onClick={() => navigateTo('changelog')} 
                className="hover:text-[#802334] transition cursor-pointer"
              >
                Version History
              </button>
            </li>
          </ul>
        </div>
        
        <div className="space-y-4 flex flex-col items-center text-center">
          <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-400 font-bold">Network</h4>
          <ul className="space-y-2 font-sans text-xs text-stone-600">
            <li>
              <button 
                type="button"
                onClick={() => navigateTo('policies')} 
                className="hover:text-[#802334] transition cursor-pointer"
              >
                About Adjung
              </button>
            </li>
            <li>
              <button 
                type="button"
                onClick={() => navigateTo('directory')} 
                className="hover:text-[#802334] transition cursor-pointer"
              >
                Editorial Board
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Copyright Bottom Bar */}
      <div className="max-w-4xl mx-auto px-4 border-t border-stone-200/50 mt-8 pt-6 text-center">
        <p className="font-mono uppercase tracking-widest text-[9px] text-stone-400">
          {BRAND.copyright}
        </p>
      </div>
    </footer>
  );
};
