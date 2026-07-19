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
      <div className="max-w-md w-full flex flex-col items-center justify-center text-center space-y-3">
        
        {/* 1. Official Adjung Logo */}
        <div className="select-none flex justify-center items-center">
          <span className="font-serif text-3xl md:text-4xl font-semibold tracking-wider text-[#FDFDFD]">
            {BRAND.logoText}
          </span>
        </div>

        {/* 2. Official Tagline */}
        <p className="font-serif text-stone-200 text-[13px] md:text-[14px] tracking-wide select-none">
          {BRAND.tagline}
        </p>
      </div>
    </div>
  );
};
