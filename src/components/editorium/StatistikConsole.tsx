import React from 'react';
import { BarChart3, TrendingUp, FileText, CheckCircle, Users, Activity } from 'lucide-react';

export const StatistikConsole: React.FC = () => {
  return (
    <div className="space-y-6 font-sans bg-[#FDFDFD] text-[#1F1F1F]">
      {/* Header */}
      <div className="pb-4 border-b border-stone-200">
        <h2 className="text-xl font-serif font-bold text-stone-900">
          Konsol Laporan & Statistik Sistem
        </h2>
        <p className="text-xs text-stone-500 font-sans mt-0.5">
          Analisis prestasi penerbitan, keaktifan slot bento, dan statistik penggunaan editor.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 border border-stone-200 rounded-xl bg-white space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-stone-400">
            <span className="font-mono text-[10px] uppercase font-bold">Kandungan Aktif</span>
            <FileText className="w-4 h-4 text-[#802334]" />
          </div>
          <div className="text-2xl font-serif font-bold text-stone-900">38</div>
          <div className="text-[11px] text-stone-500 font-sans">Slot Bento Terisi (100%)</div>
        </div>

        <div className="p-4 border border-stone-200 rounded-xl bg-white space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-stone-400">
            <span className="font-mono text-[10px] uppercase font-bold">Draf Tersimpan</span>
            <Activity className="w-4 h-4 text-[#802334]" />
          </div>
          <div className="text-2xl font-serif font-bold text-stone-900">12</div>
          <div className="text-[11px] text-stone-500 font-sans">Ruang Peribadi Editor</div>
        </div>

        <div className="p-4 border border-stone-200 rounded-xl bg-white space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-stone-400">
            <span className="font-mono text-[10px] uppercase font-bold">Lulus AUTO_LIVE</span>
            <CheckCircle className="w-4 h-4 text-[#3d6b4c]" />
          </div>
          <div className="text-2xl font-serif font-bold text-stone-900">94.2%</div>
          <div className="text-[11px] text-stone-500 font-sans">Skor Amanah Sumber ≥ 90</div>
        </div>

        <div className="p-4 border border-stone-200 rounded-xl bg-white space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-stone-400">
            <span className="font-mono text-[10px] uppercase font-bold">Anggota Editorial</span>
            <Users className="w-4 h-4 text-[#802334]" />
          </div>
          <div className="text-2xl font-serif font-bold text-stone-900">4</div>
          <div className="text-[11px] text-stone-500 font-sans">Akaun Aktif Berdaftar</div>
        </div>
      </div>

      <div className="p-5 border border-stone-200 rounded-xl bg-white space-y-4">
        <h3 className="font-serif font-bold text-stone-900 text-sm border-b border-stone-200 pb-2">
          Taburan Kandungan Mengikut Bidang Kurasi
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs font-sans mb-1">
              <span className="font-bold text-stone-800">Nasional</span>
              <span className="font-mono text-stone-500">14 Slot (36.8%)</span>
            </div>
            <div className="h-2 bg-stone-100 rounded overflow-hidden">
              <div className="h-full bg-[#802334] rounded" style={{ width: '36.8%' }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-sans mb-1">
              <span className="font-bold text-stone-800">Kesihatan</span>
              <span className="font-mono text-stone-500">8 Slot (21.0%)</span>
            </div>
            <div className="h-2 bg-stone-100 rounded overflow-hidden">
              <div className="h-full bg-[#802334]/80 rounded" style={{ width: '21.0%' }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-sans mb-1">
              <span className="font-bold text-stone-800">Ekonomi</span>
              <span className="font-mono text-stone-500">7 Slot (18.4%)</span>
            </div>
            <div className="h-2 bg-stone-100 rounded overflow-hidden">
              <div className="h-full bg-[#802334]/60 rounded" style={{ width: '18.4%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
