import { useEffect, useRef, type RefObject } from 'react';

// Cangkuk pengurusan fokus modal kongsi (2026-08-07, Audit UI/UX Editorium §G1/G2).
// Sebelum ni TIADA satu pun daripada 13 modal Editorium memindahkan fokus masuk, memerangkap Tab,
// atau memulangkan fokus kepada pencetus apabila ditutup — pengguna papan kekunci menaip ke medan
// yang tidak kelihatan di halaman belakang. Escape turut tidak konsisten (cuma 2/13 modal).
//
// Guna: letak `useModalFokus(refModal, onTutup)` dalam komponen modal, sambungkan `refModal` pada
// elemen pembalut modal (bukan backdrop). `onTutup` dipanggil apabila Escape ditekan — hantar
// `undefined` untuk modal yang sengaja tidak boleh ditutup dengan Escape (cth LengkapkanProfilModal,
// gerbang terma wajib).
export function useModalFokus(refModal: RefObject<HTMLElement>, onTutup?: () => void) {
  const pencetusSebelumnya = useRef<HTMLElement | null>(null);

  useEffect(() => {
    pencetusSebelumnya.current = document.activeElement as HTMLElement | null;

    const bolehFokus = (): HTMLElement[] => {
      const el = refModal.current;
      if (!el) return [];
      const senarai: HTMLElement[] = Array.from(
        el.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      return senarai.filter((e: HTMLElement) => e.offsetParent !== null);
    };

    // Fokus elemen pertama sebaik modal dilekap — sebelum ni kursor kekal di halaman belakang.
    const senarai = bolehFokus();
    (senarai[0] || refModal.current)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onTutup) {
        e.stopPropagation();
        onTutup();
        return;
      }
      if (e.key !== 'Tab') return;
      const boleh = bolehFokus();
      if (boleh.length === 0) return;
      const pertama = boleh[0], terakhir = boleh[boleh.length - 1];
      if (e.shiftKey && document.activeElement === pertama) {
        e.preventDefault();
        terakhir.focus();
      } else if (!e.shiftKey && document.activeElement === terakhir) {
        e.preventDefault();
        pertama.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Fokus balik ke pencetus — sebelum ni fokus hilang ke <body>, Tab bermula semula dari atas.
      pencetusSebelumnya.current?.focus?.();
    };
  }, [refModal, onTutup]);
}

export default useModalFokus;
