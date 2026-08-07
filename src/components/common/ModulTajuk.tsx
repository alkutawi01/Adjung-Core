import React from 'react';

// Kepala modul piawai Editorium (2026-08-07, Pelan 01 Fasa A1 — keputusan Izzat: keluarga
// serif-maroon menang). Sebelum ni ada LIMA keluarga gaya tajuk merentasi 16 modul: serif-maroon
// (Log Sistem/Direktori/Panduan/Perlembagaan/Sistem Reka Bentuk), sans-xs-stone (9 konsol kerja),
// lejar Dashboard, tiada tajuk langsung (Indeks), dan tiga variasi tajuk modal. Komponen ni
// SATU-SATUNYA cara modul memperkenalkan dirinya.
//
// Pengecualian tunggal yang diluluskan: DashboardConsole kekal gaya "lejar" tersendiri (h1 serif
// besar, tanpa kad) — ia muka depan Editorium, bukan modul kerja biasa.
export interface ModulTajukProps {
  tajuk: string;
  huraian?: React.ReactNode;
  /** Butang/kawalan di hujung kanan (cth "Muat Semula", "Tambah Anggota"). */
  tindakan?: React.ReactNode;
  className?: string;
}

export const ModulTajuk: React.FC<ModulTajukProps> = ({ tajuk, huraian, tindakan, className = '' }) => (
  <div className={`bg-white p-6 rounded-lg border border-stone-200 shadow-[0_1px_2px_rgba(0,0,0,.04)] flex flex-wrap justify-between items-center gap-4 ${className}`}>
    <div className="min-w-0">
      <h2 className="font-serif text-base uppercase tracking-wider text-Adjung-maroon font-bold mb-1">
        {tajuk}
      </h2>
      {huraian && <p className="font-sans text-xs text-stone-600">{huraian}</p>}
    </div>
    {tindakan && <div className="flex items-center gap-2 shrink-0">{tindakan}</div>}
  </div>
);

export default ModulTajuk;
