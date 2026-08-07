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
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-[#802334] text-white border border-transparent hover:bg-[#601824]',
  secondary: 'bg-white text-[#802334] border border-stone-200 hover:bg-stone-50 hover:border-stone-300',
  ghost: 'bg-transparent text-stone-500 border border-transparent hover:bg-stone-50 hover:text-stone-700',
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
