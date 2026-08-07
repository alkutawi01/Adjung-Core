import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND, LOGO_SIZE } from '../../config/brand';

// Halaman 404 bergaya Adjung (Fasa 11, 2026-08-02; direka semula 2026-08-07 — permintaan Izzat
// "redesign page 404. masih hodoh"). Reka bentuk asal blok marun pekat penuh skrin + teks putih
// tengah terasa macam templat ralat generik, tak sepadan bahasa visual majalah ilmiah Adjung
// (latar putih/stone + aksen marun, bukan blok warna pekat — lihat FrontpageView.tsx). Susunan
// baharu ikut corak "header ringkas + kandungan tengah" yang sama macam HalamanStatik.tsx/
// HalamanPenaja.tsx (wordmark kecil kiri atas, pautan balik Laman Utama), dengan angka "404" besar
// bergaya editorial (label mono huruf besar + nombor serif — corak eyebrow/label sedia ada
// merentasi bento frontpage) sebagai fokus visual, gantikan blok warna rata yang kosong.

export const TidakDijumpai: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col">
      <header className="w-full max-w-2xl mx-auto px-6 pt-10">
        <Link
          to="/"
          className={`font-serif ${LOGO_SIZE.header} text-[#802334] tracking-tight hover:opacity-80 transition-opacity`}
        >
          {BRAND.logoText}
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-Adjung-maroon mb-3">
            Ralat 404
          </p>
          <div className="font-serif text-8xl md:text-9xl leading-none tracking-tight text-Adjung-maroon mb-5 select-none">
            404
          </div>
          <h1 className="font-serif text-2xl md:text-3xl font-normal tracking-tight text-stone-900 mb-3">
            Halaman Tidak Dijumpai
          </h1>
          <p className="font-serif text-stone-600 text-[13px] md:text-[14px] tracking-wide mb-8">
            Pautan yang anda ikuti mungkin salah atau halaman ini telah dialihkan.
          </p>
          <Link
            to="/"
            className="inline-block font-sans text-xs font-semibold bg-Adjung-maroon text-white px-5 py-2.5 rounded hover:bg-Adjung-maroon-dark transition-colors"
          >
            Kembali ke Laman Utama
          </Link>
        </div>
      </main>
    </div>
  );
};
