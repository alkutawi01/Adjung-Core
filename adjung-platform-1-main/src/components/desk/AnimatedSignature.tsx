import React from 'react';
import { motion } from 'motion/react';

export function AnimatedSignature() {
  return (
    <div className="flex flex-col items-center justify-center pt-8 pb-4 select-none">
      <div className="relative flex flex-col items-center">
        {/* Typographic Signature using upright Mrs Saint Delafield font */}
        <motion.div 
          initial={{ opacity: 0, y: 10, filter: "blur(2px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-6xl md:text-7xl text-[#802334] h-14 flex items-center justify-center select-none font-normal"
          style={{ fontFamily: '"Mrs Saint Delafield", "Birthstone", cursive' }}
        >
          Adjung
        </motion.div>
      </div>
      
      {/* Subtitle - saying "Adjung" in elegant grey font */}
      <motion.span 
        initial={{ opacity: 0, y: 4 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="font-serif text-[10px] uppercase tracking-[0.25em] text-stone-400 mt-2 font-semibold"
      >
        Adjung
      </motion.span>
    </div>
  );
}
