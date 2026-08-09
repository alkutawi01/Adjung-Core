import { useCallback, useEffect, useState } from 'react';

// Cangkuk amaran kerja belum disimpan (2026-08-07, Audit UI/UX Editorium §B1/B2; disegar semula
// 2026-08-09, DLG-01 Pusingan 2B). Sebelum ni modal-modal (Ticker, Tambah Anggota, Profil Editor,
// Senarai Slot) tertutup terus apabila klik latar/X/Escape walaupun medan sudah diisi — kerja
// hilang tanpa amaran. Ticker khususnya ialah SATU-SATUNYA slot yang membawa kandungan SEBENAR
// (selebihnya data ujian), jadi kehilangan di situ paling mahal.
//
// Pengesahan dalam-aplikasi (BUKAN `window.confirm`) — falsafah sama seperti konfirmTutup/
// konfirmTukarKe di SlotManagerModal/BarSlotManagerModal: dialog native pelayar berada di luar
// kawalan focus-management aplikasi (boleh berlanggar dengan perangkap fokus useModalFokus modal
// yang sama), dan boleh "disenyapkan pelayar" selepas beberapa kali dicetuskan berturut-turut
// ("Prevent this page from creating additional dialogs") — ditemui 2026-08-08 semasa ujian sebenar
// Izzat pada SlotManagerModal, sebab asal DLG-01 ini disenaraikan sebagai isu sistemik merentasi
// SEMUA pengguna cangkuk ini, bukan satu patch setiap pemanggil.
//
// Guna: `const { cubaTutup, tunjukAmaran, batalTutup, sahkanTutup } = useAmaranBelumSimpan(kotor,
// onTutupSebenar)`. Panggil `cubaTutup()` pada SETIAP laluan tutup (butang X, klik backdrop,
// Escape via useModalFokus, butang Batal) — bukan panggil `onTutupSebenar` terus. Bila `kotor`
// benar, `cubaTutup()` TIDAK tutup terus — ia set `tunjukAmaran` true, dan pemanggil wajib render
// bar pengesahan sebaris (sama corak SlotManagerModal) yang memanggil `batalTutup()` (kekal buka)
// atau `sahkanTutup()` (buang perubahan, tutup sebenar). `kotor` ialah keputusan pemanggil
// (perbandingan draf semasa dengan nilai asal); cangkuk ni tidak menyimpan draf sendiri.
export function useAmaranBelumSimpan(kotor: boolean, onTutupSebenar: () => void) {
  const [tunjukAmaran, setTunjukAmaran] = useState(false);

  useEffect(() => {
    if (!kotor) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [kotor]);

  const cubaTutup = useCallback(() => {
    if (kotor) {
      setTunjukAmaran(true);
      return;
    }
    onTutupSebenar();
  }, [kotor, onTutupSebenar]);

  const batalTutup = useCallback(() => setTunjukAmaran(false), []);

  const sahkanTutup = useCallback(() => {
    setTunjukAmaran(false);
    onTutupSebenar();
  }, [onTutupSebenar]);

  return { cubaTutup, tunjukAmaran, batalTutup, sahkanTutup };
}

export default useAmaranBelumSimpan;
