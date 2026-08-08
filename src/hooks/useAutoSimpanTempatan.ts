import { useEffect, useRef, useState } from 'react';

// Auto-simpan draf SENYAP (2026-08-08, Gemini/audit UI-UX — "crash/bekalan elektrik terputus,
// seluruh penulisan ghaib"). Auto-simpan KE PELAYAN sebenarnya dipertimbang dan DIBUANG sengaja
// sebelum ni (lihat komen `handleClose`, SlotManagerModal.tsx, 2026-08-02 Fasa 6): "draf separuh
// siap yang tersimpan senyap ke DB TANPA EDITOR SEDAR lebih berbahaya daripada amaran ringkas."
// Kebimbangan sebenar ialah PELAYAN (rekod rasmi berubah tanpa tindakan sedar editor — boleh
// bercanggah dgn peraturan pemilikan draf/Tong Sampah/dll.), bukan penyelamatan kerja itu sendiri.
//
// Jadi cangkuk ni HANYA tulis ke localStorage pelayar (tak pernah sentuh pelayan) — snapshot tu
// tak wujud di mana-mana selain peranti editor sendiri, dan explicit "Simpan Draf"/"Terbit"
// (aksi sedar editor, tak berubah) kekal SATU-SATUNYA laluan yang benar-benar menulis ke DB.
// Ini terus menangani kebimbangan asal (tiada tulisan senyap ke pelayan) SAMBIL menyelesaikan
// kebimbangan baharu (kerja hilang bila pelayar/peranti crash sebelum sempat klik Simpan).
const LENGAH_MS = 8000;

export function useAutoSimpanTempatan<T>(kunci: string | null, nilai: T, aktif: boolean) {
  const [disimpanPada, setDisimpanPada] = useState<number | null>(null);
  const pemasa = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!kunci || !aktif) return;
    if (pemasa.current) clearTimeout(pemasa.current);
    pemasa.current = setTimeout(() => {
      try {
        window.localStorage.setItem(kunci, JSON.stringify({ nilai, pada: Date.now() }));
        setDisimpanPada(Date.now());
      } catch {
        // Storan penuh/disekat — tak kritikal, auto-simpan cuma tak berlaku kali ni.
      }
    }, LENGAH_MS);
    return () => { if (pemasa.current) clearTimeout(pemasa.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci, JSON.stringify(nilai), aktif]);

  return { disimpanPada };
}

/** Baca snapshot tempatan tersimpan (untuk tawaran "Pulihkan" semasa modal dibuka), tanpa
 *  melanggan pemasa auto-simpan. Panggil SEKALI semasa mount, bukan dalam render. */
export function bacaDrafTempatan<T>(kunci: string): { nilai: T; pada: number } | null {
  try {
    const mentah = window.localStorage.getItem(kunci);
    if (!mentah) return null;
    const parsed = JSON.parse(mentah);
    if (!parsed || typeof parsed.pada !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buangDrafTempatan(kunci: string) {
  try {
    window.localStorage.removeItem(kunci);
  } catch {
    // tak kritikal
  }
}

/** Label relatif ringkas ("beberapa saat lalu", "3 minit lalu") untuk indikator "Disimpan...". */
export function masaRelatifRingkas(pada: number): string {
  const saat = Math.round((Date.now() - pada) / 1000);
  if (saat < 10) return 'sebentar tadi';
  if (saat < 60) return `${saat} saat lalu`;
  const minit = Math.round(saat / 60);
  if (minit < 60) return `${minit} minit lalu`;
  const jam = Math.round(minit / 60);
  return `${jam} jam lalu`;
}

export default useAutoSimpanTempatan;
