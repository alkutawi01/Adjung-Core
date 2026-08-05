import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BRAND } from '../../config/brand';

export const LoadingScreen: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  // Gentle pulse animation props
  const pulseAnimate = shouldReduceMotion
    ? { opacity: 0.8 }
    : { opacity: [0.3, 0.8, 0.3] };

  const pulseTransition = shouldReduceMotion
    ? {}
    : { repeat: Infinity, duration: 1.8, ease: "easeInOut" };

  return (
    <div 
      id="Adjung-loading-screen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#802334] text-[#FDFDFD] transition-colors duration-300 select-none px-6"
    >
      <div className="max-w-md w-full flex flex-col items-center justify-center text-center">

        {/* Wordmark Adjung — nisbah dibetulkan (2026-08-05, permintaan Izzat) supaya SEPADAN
            lockup rasmi (public/adjung-brief-logo.png: "Adjung" + garis pembahagi + "BRIEF" di
            bawah) dan wordmark Hero muka hadapan (FrontpageView.tsx) — dahulu skrin ni cuma
            teks "Adjung" tunggal tanpa sub-label "BRIEF"/garis pembahagi langsung, nisbah/
            susunan tak sepadan jenama. Fail PNG sendiri tak dipakai terus di sini (ia latar
            putih + teks marun pekat — tak boleh dibaca atas latar marun skrin loading ni),
            dibina semula guna HTML/CSS ikut susunan dan nisbah SAMA seperti Hero, cuma warna
            disongsang (putih/krim) supaya kekal boleh dibaca atas latar marun. */}
        <h1 className="font-serif font-normal tracking-tight text-6xl md:text-7xl text-[#FDFDFD] select-none">
          {BRAND.logoText}
        </h1>
        <div className="flex items-center justify-center gap-3 mt-[8px] mb-1 max-w-xs mx-auto select-none">
          <div className="h-[1px] bg-[#FDFDFD]/40 w-12 md:w-16"></div>
          <span className="font-sans text-[11px] md:text-xs tracking-[0.25em] font-semibold text-[#FDFDFD]/70 uppercase">
            {BRAND.subLabel}
          </span>
          <div className="h-[1px] bg-[#FDFDFD]/40 w-12 md:w-16"></div>
        </div>
        <p className="font-sans text-[9px] md:text-[11px] tracking-editorial uppercase text-[#FDFDFD]/80 mt-2 select-none">
          {BRAND.tagline}
        </p>
      </div>
    </div>
  );
};
