import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../../config/brand';

// Halaman 404 bergaya Adjung (Fasa 11, 2026-08-02) — sebelum ni laluan URL salah
// memaparkan halaman kosong sebab tiada laluan `*` didaftar di App.tsx.

export const TidakDijumpai: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#802334] text-[#FDFDFD] flex flex-col items-center justify-center px-6 select-none">
      <div className="max-w-md w-full flex flex-col items-center text-center space-y-4">
        <span className="font-serif text-3xl md:text-4xl font-semibold tracking-wider text-[#FDFDFD]">
          {BRAND.logoText}
        </span>
        <p className="font-mono text-[10px] tracking-widest uppercase font-bold text-stone-200">
          Ralat 404
        </p>
        <h1 className="font-serif text-2xl md:text-3xl font-normal tracking-tight">
          Halaman Tidak Dijumpai
        </h1>
        <p className="font-serif text-stone-200 text-[13px] md:text-[14px] tracking-wide">
          Pautan yang anda ikuti mungkin salah atau halaman ini telah dialihkan.
        </p>
        <Link
          to="/"
          className="mt-2 font-sans text-xs font-semibold bg-[#FDFDFD] text-[#802334] px-4 py-2 rounded hover:bg-stone-100 transition-colors"
        >
          Kembali ke Laman Utama
        </Link>
      </div>
    </div>
  );
};
