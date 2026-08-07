import { useCallback, useEffect } from 'react';

// Cangkuk amaran kerja belum disimpan (2026-08-07, Audit UI/UX Editorium §B1/B2). Sebelum ni
// modal-modal (Ticker, Tambah Anggota, Profil Editor, Senarai Slot) tertutup terus apabila klik
// latar/X/Escape walaupun medan sudah diisi — kerja hilang tanpa amaran. Ticker khususnya ialah
// SATU-SATUNYA slot yang membawa kandungan SEBENAR (selebihnya data ujian), jadi kehilangan di
// situ paling mahal.
//
// Guna: `const cubaTutup = useAmaranBelumSimpan(kotor, onTutupSebenar)`. Panggil `cubaTutup()`
// pada SETIAP laluan tutup (butang X, klik backdrop, Escape via useModalFokus, butang Batal) —
// bukan panggil `onTutupSebenar` terus. `kotor` ialah keputusan pemanggil (perbandingan draf
// semasa dengan nilai asal); cangkuk ni tidak menyimpan draf sendiri.
export function useAmaranBelumSimpan(kotor: boolean, onTutupSebenar: () => void) {
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
    if (kotor && !window.confirm('Ada perubahan belum disimpan. Tutup dan buang perubahan ini?')) {
      return;
    }
    onTutupSebenar();
  }, [kotor, onTutupSebenar]);

  return cubaTutup;
}

export default useAmaranBelumSimpan;
