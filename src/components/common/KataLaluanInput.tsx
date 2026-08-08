import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Medan kata laluan dengan butang tunjuk/sembunyi (2026-08-07, permintaan Izzat — "kenapa takde
// preview utk kata laluan?"). Sebelum ni KESEMUA 4 medan kata laluan merentasi apl (LoginModal
// x1, TetapkanKataLaluan x2, ProfilEditorModal x2) type="password" tanpa cara langsung untuk
// editor sahkan apa yang ditaip — silap taip cuma nampak lepas hantar gagal. Satu komponen kongsi
// supaya keempat-empat tempat kekal konsisten (kad sejenis dilayan sama rata), bukan disalin
// tangan setiap tempat.
//
// className diterima terus (bukan gaya tetap) — tiga tempat guna gaya sangat berbeza (INPUT_BORANG
// kongsi, latar gelap TetapkanKataLaluan, kotak kecil ProfilEditorModal) — komponen ni cuma
// tambah padding kanan + butang mata, tak paksa satu rupa.
export const KataLaluanInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const [tunjuk, setTunjuk] = useState(false);
    return (
      <div className="relative">
        <input
          {...props}
          ref={ref}
          type={tunjuk ? 'text' : 'password'}
          className={`${className || ''} pr-9`}
        />
        <button
          type="button"
          onClick={() => setTunjuk((t) => !t)}
          aria-label={tunjuk ? 'Sembunyikan kata laluan' : 'Tunjukkan kata laluan'}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
        >
          {tunjuk ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    );
  }
);

KataLaluanInput.displayName = 'KataLaluanInput';

export default KataLaluanInput;
