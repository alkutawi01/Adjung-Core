import React from 'react';

// Lajur borang berhad lebar (2026-08-07, arahan Izzat — "Forms should be content-width, not
// screen-width", mengikut bahasa reka bentuk GitHub Settings / Notion / Stripe / Linear).
//
// MASALAH YANG DISELESAIKAN: `INPUT_BORANG` (common/gayaKongsi.ts) bermula dengan `w-full`, dan
// hampir tiada pembalut dalam Editorium yang menghadkannya. Diukur sebenar pada viewport 1440px
// (2026-08-07, borang Glosari): medan "Istilah" — untuk menaip satu perkataan seperti "Bidang" —
// terbentang 1118px. Mata terpaksa merentas seluruh skrin untuk membaca label dan mengisi medan
// ringkas.
//
// KENAPA DI PEMBALUT, BUKAN PADA INPUT: membuang `w-full` daripada INPUT_BORANG akan menyentuh
// setiap medan dalam aplikasi sekali gus (termasuk yang di dalam modal sempit, sel jadual dan
// grid dua-lajur, yang semuanya memang betul pada lebar penuh bekasnya). Menghadkan di PEMBALUT
// mengekalkan `w-full` bermakna "penuhi lajur saya" — corak yang TetapanConsole.tsx sudah pun
// gunakan dengan betul (`max-w-3xl mx-auto`) sebelum ini.
//
// Saiz mengikut julat yang ditetapkan Izzat:
//   sm — medan teks pendek (julat 320–480px): nama, tajuk ringkas, satu istilah
//   md — medan sederhana (julat 560–640px): borang bercampur, medan dengan sedikit konteks
//   lg — textarea panjang (julat 640–720px): perenggan, nota, prompt AI
// Editor kaya (rich editor) sengaja TIADA di sini — ia dibenarkan lebih lebar, jadi ia tidak
// sepatutnya dibalut komponen ni langsung.
export type LebarBorang = 'sm' | 'md' | 'lg';

const LEBAR_CLASS: Record<LebarBorang, string> = {
  sm: 'max-w-[420px]',
  md: 'max-w-[600px]',
  lg: 'max-w-[680px]',
};

export interface FormColumnProps {
  /** Lalai `md` — pilihan paling selamat bagi borang bercampur. */
  saiz?: LebarBorang;
  children: React.ReactNode;
  className?: string;
}

export const FormColumn: React.FC<FormColumnProps> = ({ saiz = 'md', children, className = '' }) => (
  // Sengaja TIADA `mx-auto`: borang Editorium dijajar KIRI, sepadan label dan tajuk seksyen di
  // atasnya. Memusatkan lajur akan memisahkannya daripada teks yang memperkenalkannya.
  <div className={`${LEBAR_CLASS[saiz]} ${className}`}>{children}</div>
);

export default FormColumn;
