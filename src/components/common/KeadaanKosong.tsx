import React from 'react';

// Keadaan kosong ("Tiada …") kongsi (2026-08-07, Pelan 01 Fasa A5). Sebelum ni TIGA nada berbeza:
// teks kecil terpusat (DrafSayaConsole/NotaKetuaEditorConsole), blok ikon + tajuk huruf besar
// (LogAuditConsole), dan serif p-12 (IndeksConsole/TetapanConsole). Satu nada sahaja kini —
// tenang dan kecil, sebab keadaan kosong bukan ralat dan tak patut menjerit.
export interface KeadaanKosongProps {
  children: React.ReactNode;
  ikon?: React.ReactNode;
  className?: string;
  /** Tindakan boleh klik (2026-08-07, Audit §D5) — cth "Kosongkan Penapis". Keputusan SALINAN
   *  (teks butang) tinggal pada pemanggil; komponen ni cuma sediakan slot, tidak mereka teks. */
  tindakan?: React.ReactNode;
}

export const KeadaanKosong: React.FC<KeadaanKosongProps> = ({ children, ikon, className = '', tindakan }) => (
  <div className={`flex flex-col items-center justify-center gap-2 py-10 text-center ${className}`}>
    {ikon && <span className="text-stone-300">{ikon}</span>}
    <p className="font-sans text-xs text-stone-400">{children}</p>
    {tindakan}
  </div>
);

export default KeadaanKosong;
