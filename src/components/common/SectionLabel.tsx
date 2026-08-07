import React from 'react';

// Label seksyen bernombor ("01 —", "02 —") kongsi (2026-08-07, Pelan 01 Fasa A3). Rupa ni sudah
// KONSISTEN merentasi PerlembagaanConsole/PanduanConsole/SistemRekaBentukConsole, cuma ditakrif
// semula secara tempatan dalam setiap satu — diangkat ke sini TANPA mengubah rupanya supaya
// konsol lain (Editorial, Tetapan, Nota, Penaja) boleh mengikutnya, bukan mereka corak keempat.
export const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children, className = '',
}) => (
  <span className={`font-mono text-[10px] uppercase tracking-widest text-[var(--color-warning)] font-bold block mb-3 ${className}`}>
    {children}
  </span>
);

export default SectionLabel;
