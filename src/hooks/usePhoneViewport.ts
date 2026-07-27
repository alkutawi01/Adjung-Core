import { useState, useEffect } from 'react';
import { PHONE_MAX_WIDTH_PX } from '../../core/editorial/PhoneGeometry.js';

// Adakah tetingkap selebar telefon? Guna HANYA apabila telefon perlu struktur yang berbeza, bukan
// sekadar gaya yang berbeza — kalau CSS boleh menyelesaikannya, guna CSS (lihat phoneLayoutCss()).
//
// Dua tempat yang benar-benar memerlukannya:
//   WorldClockStrip — kad bandar telefon memapar medan yang berlainan daripada desktop; tarikh,
//                     hari dan masa berpindah ke satu baris meta dikongsi, kerana lebar kolum
//                     telefon hanya ±72px sedangkan rentetan masa penuh perlu ±111px.
//   FocusView       — susun atur desktop ialah grid 12 kolum setinggi skrin yang tidak menatal;
//                     ia tidak boleh dilenturkan kepada 390px dengan CSS semata-mata.
//
// Ambang sama dengan breakpoint `md` Tailwind dan dengan phoneLayoutCss(), diimport daripada satu
// sumber supaya CSS dan JS tidak boleh bercanggah.
export const usePhoneViewport = (): boolean => {
  const query = `(max-width: ${PHONE_MAX_WIDTH_PX}px)`;

  const [isPhone, setIsPhone] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);

    // Dengar `resize` di samping `change`. Peristiwa `change` MediaQueryList sepatutnya memadai,
    // tetapi ia tidak boleh dipercayai sepenuhnya: ia terlepas apabila viewport ditindih melalui
    // alat pembangun/automasi, dan sesetengah pelayar telefon menukar saiz semasa putaran skrin
    // tanpa menghantar `change` yang bersih. Kalau ia terlepas, komponen tersangkut dalam susun
    // atur yang salah walaupun CSS sudah bertukar — jadi dua-dua didengar, dan setState hanya
    // dipanggil apabila nilainya benar-benar berubah supaya tiada render tambahan.
    const sync = () => setIsPhone(prev => (prev === mq.matches ? prev : mq.matches));
    sync();
    mq.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, [query]);

  return isPhone;
};
