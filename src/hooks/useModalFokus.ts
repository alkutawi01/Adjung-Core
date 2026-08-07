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
  // Rujukan sentiasa segar kepada `onTutup` (2026-08-07, pepijat Izzat — "tekan butang keyboard
  // delete, ia hanya delete satu aksara sahaja... kena klik semula di field") — punca akar:
  // effect di bawah dahulu ada `onTutup` dalam senarai kebergantungan. Kebanyakan pemanggil
  // (cth SlotManagerModal.tsx) hantar closure ditakrif TERUS dalam badan render, bukan
  // useCallback, jadi ia dapat rujukan BAHARU pada SETIAP render induk — dan induk tu sendiri
  // render semula pada SETIAP ketukan kekunci (setFormConfig). Effect ni pun run semula, dan
  // "fokus elemen pertama sebaik lekap" tercetus SEKALI LAGI setiap kali — curi fokus daripada
  // medan yang sedang ditaip balik ke elemen boleh-fokus PERTAMA dalam modal. Guna ref supaya
  // effect kekal STABIL merentasi render induk, tak kira sama ada `onTutup` baharu atau tidak.
  const onTutupRef = useRef(onTutup);
  onTutupRef.current = onTutup;

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

  // Fokus awal + pulangkan fokus ke pencetus — HANYA semasa lekap/lucut modal (deps kosong),
  // bukan setiap kali `refModal`/`onTutup` bertukar rujukan.
  useEffect(() => {
    pencetusSebelumnya.current = document.activeElement as HTMLElement | null;
    const senarai = bolehFokus();
    (senarai[0] || refModal.current)?.focus();
    return () => {
      // Fokus balik ke pencetus — sebelum ni fokus hilang ke <body>, Tab bermula semula dari atas.
      pencetusSebelumnya.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pendengar kekunci berasingan daripada fokus awal — kekal terikat sepanjang hayat modal,
  // baca `onTutupRef.current` supaya sentiasa panggil versi TERKINI tanpa perlu ikatan semula.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onTutupRef.current) {
        e.stopPropagation();
        onTutupRef.current();
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
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default useModalFokus;
