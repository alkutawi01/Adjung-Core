import { useEffect, useState } from 'react';

// Tapisan kekal sepanjang sesi log masuk (2026-08-08, permintaan pemilik projek) — "apabila saya
// ubah tetapan, kemudian saya refresh, ia kembali ke tetapan lalai... refresh ke tetapan lalai
// hanya apabila log masuk baru. selagi mana masih dalam sesi yg sama, tetapan lalai tidak
// berfungsi." Cangkuk KONGSI (bukan khusus Indeks) supaya konsol lain (Draf Saya, Log Sistem, dll.)
// boleh dapat kelakuan sama tanpa tulis semula.
//
// "Sesi" di sini ditakrifkan sebagai SATU log masuk — App.tsx mencap `sesiTanda` (rentetan unik)
// setiap kali handleLoginSuccess() dipanggil, dan mengekalkannya sepanjang localStorage/
// sessionStorage authUser yang sama (termasuk selepas refresh/tutup-buka tab, SELAGI belum log
// keluar/log masuk semula). Bandingkan tanda TERSIMPAN dgn tanda SEMASA: sepadan -> pulihkan
// nilai tersimpan; tak sepadan (log masuk baharu, mungkin akaun lain) -> guna nilai lalai.
export function useTapisanSesi<T>(kunci: string, sesiTanda: string | undefined, nilaiLalai: T): [T, (nilai: T) => void] {
  const bacaTersimpan = (): T => {
    if (typeof window === 'undefined' || !sesiTanda) return nilaiLalai;
    try {
      const mentah = window.localStorage.getItem(kunci);
      if (!mentah) return nilaiLalai;
      const disimpan = JSON.parse(mentah);
      if (!disimpan || disimpan.sesiTanda !== sesiTanda) return nilaiLalai;
      return disimpan.nilai as T;
    } catch {
      return nilaiLalai;
    }
  };

  const [nilai, setNilaiState] = useState<T>(bacaTersimpan);

  // sesiTanda mungkin belum sedia (currentUser masih dimuat) semasa render pertama — bila ia
  // muncul/berubah (log masuk baharu berlaku SELEPAS komponen dah dipasang), semak semula sekali.
  useEffect(() => {
    setNilaiState(bacaTersimpan());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesiTanda]);

  const setNilai = (baharu: T) => {
    setNilaiState(baharu);
    if (typeof window === 'undefined' || !sesiTanda) return;
    try {
      window.localStorage.setItem(kunci, JSON.stringify({ sesiTanda, nilai: baharu }));
    } catch {
      // Storan penuh/disekat — tak kritikal, tapisan cuma tak berterusan kali ni.
    }
  };

  return [nilai, setNilai];
}

export default useTapisanSesi;
