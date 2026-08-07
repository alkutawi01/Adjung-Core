import React from 'react';

// Butang kongsi Editorium (2026-08-07, hasil audit reka bentuk — design_handoff_editorium_
// redesign, seksyen 4.1). Sebelum ni setiap konsol kod tangan butang sendiri — radius/padding/
// saiz ikon berbeza sikit antara satu sama lain (cth #9b2c41 vs --color-Adjung-maroon-dark
// sebenar #601824). Komponen ni SATU-SATUNYA sumber kebenaran corak butang Editorium: radius
// 6px tetap, dua saiz padding, tiga varian. `:active{transform:scale(0.97)}` sudah GLOBAL di
// index.css — komponen ni sengaja TAK override transform supaya mikro-interaksi tu terpakai.
//
// Bukan pengesahan seragam PAKSA — konsol sedia ada boleh terus guna className tangan sehingga
// disunting satu-satu ikut audit; komponen ni cuma rumah bagi butang BAHARU/disunting supaya
// tak reka corak baharu lagi.
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'bahaya';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
}

// Ejaan maroon piawai (2026-08-07, Pelan 01 Fasa B): kelas Tailwind terbitan token
// (`bg-Adjung-maroon`), bukan hex literal. Dahulu fail ni sendiri menaip #802334/#601824.
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-Adjung-maroon text-white border border-transparent hover:bg-Adjung-maroon-dark',
  secondary: 'bg-white text-Adjung-maroon border border-stone-200 hover:bg-stone-50 hover:border-stone-300',
  ghost: 'bg-transparent text-stone-500 border border-transparent hover:bg-stone-50 hover:text-stone-700',
  // Tindakan merbahaya (padam/tamatkan akaun) — Pelan 01 Fasa D2 menetapkan butang begini WAJIB
  // ada pengesahan dua langkah; varian ni cuma memberinya bahasa visual yang betul.
  bahaya: 'bg-white text-[var(--color-error)] border border-[var(--color-error)]/40 hover:bg-red-50 hover:border-[var(--color-error)]',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-[11px] gap-1.5',
  md: 'px-4 py-1.5 text-xs gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', size = 'md', icon, children, className = '', disabled, ...rest
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-md font-semibold font-sans cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
};

export default Button;
