import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Skrin degradasi sambungan pangkalan data (2026-08-08, dapatan audit UI/UX ChatGPT + kelulusan
// Izzat) — gantikan AmaranSambungan+kandungan REKAAN (mockDb) lama. Punca: bila /api/db-state
// gagal, App.tsx dahulu isi Frontpage dgn entri demo ("Tentang Adjung" dll.) bersama amaran
// "kandungan mungkin tak terkini" — tapi kandungan tu bukan LAPUK, ia REKAAN sepenuhnya.
// Pembaca tak boleh bezakan drpd kandungan sebenar. Skrin ni sebaliknya papar TIADA kandungan
// langsung semasa gangguan — jujur tentang keadaan, bukan cuba isi ruang dgn sesuatu yang nampak
// macam berita sebenar.
export interface SkrinDegradasiDBProps {
  sedangMenyemak: boolean;
  onCubaSemula: () => void;
}

export const SkrinDegradasiDB: React.FC<SkrinDegradasiDBProps> = ({ sedangMenyemak, onCubaSemula }) => (
  <div className="min-h-screen flex items-center justify-center px-6 bg-[#FDFDFD]">
    <div className="max-w-md w-full text-center space-y-4">
      <AlertTriangle className="w-8 h-8 text-[var(--color-error)] mx-auto" />
      <h1 className="font-serif text-xl font-medium text-stone-900">
        Adjung Brief tidak dapat memuatkan data terkini
      </h1>
      <p className="font-sans text-sm text-stone-600 leading-relaxed">
        Sambungan ke pelayan terputus buat sementara. Ini bukan masalah di pihak anda — sila cuba
        semula sebentar lagi.
      </p>
      <button
        type="button"
        onClick={onCubaSemula}
        disabled={sedangMenyemak}
        className="font-sans text-sm font-semibold text-white bg-[var(--color-Adjung-maroon)] hover:opacity-90 rounded px-5 py-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {sedangMenyemak ? 'Menyemak…' : 'Cuba Semula'}
      </button>
    </div>
  </div>
);

export default SkrinDegradasiDB;
