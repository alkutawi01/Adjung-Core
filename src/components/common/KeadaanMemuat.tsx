import React from 'react';

// Keadaan memuat kongsi (2026-08-07, Audit UI/UX Editorium §D4). Sebelum ni EMPAT rupa berbeza
// merentas Editorium: rangka berdenyut sebenar (Paparan Utama/Indeks), ikon jam pasir dalam baris
// jadual (Direktori/Log Sistem), ayat kosong tenang (9 modul — SAMA seperti keadaan KOSONG,
// jadi editor tak dapat bezakan sistem sedang bekerja atau data memang tiada), dan
// `<p>Memuatkan...</p>` mentah (Tetapan Sistem). Komponen ni PADAN NADA dengan `KeadaanKosong`
// (bentuk serupa) tetapi rangka berdenyut, bukan ayat statik — supaya keduanya tak lagi kelihatan
// sama.
export interface KeadaanMemuatProps {
  baris?: number;
  className?: string;
}

export const KeadaanMemuat: React.FC<KeadaanMemuatProps> = ({ baris = 3, className = '' }) => (
  <div className={`animate-pulse space-y-2 py-4 ${className}`} role="status" aria-label="Memuatkan">
    {Array.from({ length: baris }).map((_, i) => (
      <div key={i} className="h-8 rounded bg-stone-150" style={{ width: `${100 - i * 12}%` }} />
    ))}
  </div>
);

export default KeadaanMemuat;
