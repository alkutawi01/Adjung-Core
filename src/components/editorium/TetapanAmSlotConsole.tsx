import React from 'react';
import { Construction } from 'lucide-react';

// Tetapan Am Slot (2026-07-30) — rangka sahaja buat masa ini. Setiap tetapan di bawah perlukan
// storan baharu di server (system_settings kini lajur tetap, bukan pasangan kunci-nilai), jadi ia
// dibina peringkat seterusnya. Skrin ni sengaja TIDAK memapar kawalan palsu yang nampak boleh
// disimpan tetapi sebenarnya tidak — senarai jujur lebih berguna daripada suis yang menipu.
export const TetapanAmSlotConsole: React.FC = () => (
  <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs font-sans">
    <div>
      <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
        Tetapan Am Slot
      </h3>
      <p className="text-stone-500 text-xs">
        Tetapan yang terpakai pada SEMUA slot bento — tidak termasuk Ticker dan tier <em>Bar</em>.
      </p>
    </div>

    <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-900 leading-relaxed">
      <Construction className="inline w-3.5 h-3.5 -mt-0.5 mr-1" />
      Belum dibina. Empat tetapan berikut akan duduk di sini:
      <ul className="mt-2 space-y-1 pl-4 list-disc marker:text-amber-400">
        <li>
          <strong className="font-semibold">Mula carousel ikut masa akses</strong> — kandungan mana yang muncul dahulu
          ditentukan oleh jam semasa pembaca melawat, supaya pelawat jam 9.01 dan jam 9.05 tidak melihat kandungan yang sama.
        </li>
        <li><strong className="font-semibold">Had maksimum bilangan kandungan</strong> bagi setiap slot.</li>
        <li><strong className="font-semibold">Jenis animasi transisi</strong> — buat masa ini yang sedia ada sahaja (selang dan lengah pusingan).</li>
        <li><strong className="font-semibold">Had aksara</strong> bagi huraian panjang, sumber, topik, dan nota editor.</li>
      </ul>
    </div>
  </div>
);

export default TetapanAmSlotConsole;
