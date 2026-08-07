import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Palang amaran sambungan pangkalan data (ditulis semula 2026-08-07, teguran Izzat — "banner ni
// awak tak pernah semak pun dari segi UI dan bahasa").
//
// Empat masalah sebenar pada versi lama, bukan sekadar kemasan:
//
//  1. BOCOR DALAMAN. Teksnya berbunyi "Gagal menyambung ke pangkalan data SQLite (server.js)".
//     Palang ni dirender pada laluan AWAM (frontpage "/" dan pautan artikel), jadi nama fail
//     sumber dan jenis enjin pangkalan data dipaparkan kepada pembaca biasa.
//  2. BAHASA BERCAMPUR. Ayat yang sama menyebut "pangkalan data" dan kemudian "database" —
//     melanggar peraturan label 100% Melayu, dan bercanggah dengan dirinya sendiri.
//  3. KHALAYAK SALAH. "sebarang suntingan tidak akan disimpan" ditulis untuk editor, tetapi
//     dipaparkan kepada pembaca yang memang tiada apa-apa untuk disunting. Ayat baharu bercakap
//     tentang perkara yang pembaca BOLEH lihat kesannya (kandungan mungkin tidak terkini) dan
//     kekal benar untuk editor juga.
//  4. DISALIN DUA KALI. JSX yang sama persis wujud dua tempat dalam App.tsx, jadi setiap
//     pembetulan perlu dibuat dua kali — punca hanyut klasik. Kini satu komponen.
//
// Gaya mengikut MesejStatus (bg-red-50 + token --color-error), bukan palang bg-red-700 pekat:
// projek ni ada token ralat semantik dan bahasa visualnya tenang. Amaran tetap jelas tanpa
// menjerit.
export interface AmaranSambunganProps {
  /** Percubaan menyambung semula sedang berjalan — butang dikunci sementara. */
  sedangMenyemak: boolean;
  onCubaSemula: () => void;
}

export const AmaranSambungan: React.FC<AmaranSambunganProps> = ({ sedangMenyemak, onCubaSemula }) => (
  <div
    role="alert"
    className="bg-red-50 border-b border-[var(--color-error)] text-[var(--color-error)] font-sans text-xs px-4 py-2.5 flex items-center justify-between gap-4"
  >
    <div className="flex items-center gap-2 min-w-0">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest shrink-0">
        Amaran
      </span>
      <span className="text-stone-700">
        Sambungan pangkalan data terputus. Kandungan yang dipaparkan mungkin tidak terkini dan
        sebarang perubahan tidak akan disimpan.
      </span>
    </div>
    <button
      type="button"
      onClick={onCubaSemula}
      disabled={sedangMenyemak}
      className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {sedangMenyemak ? 'Menyemak…' : 'Cuba semula'}
    </button>
  </div>
);

export default AmaranSambungan;
