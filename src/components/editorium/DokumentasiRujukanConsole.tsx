import React, { useState } from 'react';
import { BookOpen, Landmark, Palette, History, BarChart3, ShieldCheck } from 'lucide-react';
import { PerlembagaanConsole } from './PerlembagaanConsole';
import { SistemRekaBentukConsole } from './SistemRekaBentukConsole';
import { LogAuditConsole } from './LogAuditConsole';
import { StatistikConsole } from './StatistikConsole';

export const DokumentasiRujukanConsole: React.FC = () => {
  const [subTab, setSubTab] = useState<'panduan' | 'peraturan' | 'reka_bentuk' | 'log' | 'statistik'>('panduan');

  return (
    <div className="space-y-6 font-sans bg-[#FDFDFD] text-[#1F1F1F]">
      {/* Header & Subtab Bar */}
      <div className="pb-4 border-b border-stone-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-900">
            Dokumentasi & Rujukan Sistem
          </h2>
          <p className="text-xs text-stone-500 font-sans mt-0.5">
            Pusat rujukan tunggal bagi manual penggunaan, perlembagaan geometri, spesifikasi reka bentuk visual, log audit, dan statistik.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs font-medium">
          <button
            onClick={() => setSubTab('panduan')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'panduan' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Panduan Penggunaan
          </button>
          <button
            onClick={() => setSubTab('peraturan')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'peraturan' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" /> Peraturan Am
          </button>
          <button
            onClick={() => setSubTab('reka_bentuk')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'reka_bentuk' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5" /> Dokumentasi Visual
          </button>
          <button
            onClick={() => setSubTab('log')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'log' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Log Sistem
          </button>
          <button
            onClick={() => setSubTab('statistik')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'statistik' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Statistik
          </button>
        </div>
      </div>

      {/* SUBTAB 1: PANDUAN PENGGUNAAN */}
      {subTab === 'panduan' && (
        <div className="space-y-4">
          <div className="p-5 border border-stone-200 rounded-xl bg-white space-y-4">
            <h3 className="font-serif font-bold text-stone-900 text-sm border-b border-stone-200 pb-2">
              Panduan Penggunaan Editorium Adjung Brief
            </h3>
            <div className="space-y-3 text-xs text-stone-600 leading-relaxed font-sans">
              <p>
                <strong>1. Pengurusan Draf:</strong> Gunakan konsol <em>Draf Saya</em> untuk menyimpan penulisan sementara. Draf yang disimpan tidak akan dipaparkan pada portal awam sehingga diterbitkan secara rasmi oleh Ketua Editor.
              </p>
              <p>
                <strong>2. Penjadualan Slot Bento:</strong> Setiap slot bento mempunyai tier geometri tertentu (HERO, MENEGAK, STANDARD, KOMPAK, BAR, TICKER). Had aksara tajuk dan huraian dikuatkuasakan secara automatik.
              </p>
              <p>
                <strong>3. Kawalan Akses RBAC:</strong> Hanya peranan <em>Ketua Editor</em> berhak membuat perubahan pada Tetapan Polisi, Akses Kawalan, dan Nota Awam Ketua Editor.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PERATURAN AM */}
      {subTab === 'peraturan' && <PerlembagaanConsole />}

      {/* SUBTAB 3: DOKUMENTASI VISUAL */}
      {subTab === 'reka_bentuk' && <SistemRekaBentukConsole />}

      {/* SUBTAB 4: LOG SISTEM */}
      {subTab === 'log' && <LogAuditConsole />}

      {/* SUBTAB 5: STATISTIK */}
      {subTab === 'statistik' && <StatistikConsole />}
    </div>
  );
};
