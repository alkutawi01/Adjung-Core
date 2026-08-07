// Pemalar kelas kongsi Editorium (2026-08-07, Pelan 01 Fasa A6) — untuk corak yang tak sesuai
// dijadikan komponen penuh (label/input/jadual), tetapi tetap tidak boleh dibiarkan setiap konsol
// menulis versi sendiri. Import pemalar ni; JANGAN taip semula kelasnya.

/** Label medan borang — mono kecil huruf besar, bahasa label yang sama seperti frontpage.
 *  Menggantikan campuran mono (NotaKetuaEditorConsole) vs sans-tanpa-mono (IndeksConsole).
 *  10px (2026-08-07, Audit §H2, diluluskan Izzat) — 9px (~6.75pt) terlalu kecil utk label yang
 *  dibaca sepanjang hari; dinaikkan satu takat tanpa ganggu susun atur padat sedia ada. */
export const LABEL_BORANG =
  'block font-mono text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1';

/** Input/textarea/select piawai. Keadaan fokus maroon ni dahulunya HANYA wujud dalam
 *  TetapanConsole — borang lain langsung tiada maklum balas fokus. Kini sejagat. */
export const INPUT_BORANG =
  'w-full bg-stone-50 border border-stone-300 rounded px-3 py-2 font-sans text-sm text-stone-800 focus:outline-none focus:border-Adjung-maroon focus:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

/** Kepala jadual — gaya mono (DrafSayaConsole/LogAuditConsole) dipilih sebagai pemenang sebab ia
 *  paling hampir bahasa label frontpage. Latar guna token `--color-Adjung-paper`, bukan hex
 *  sebaris #F7F5F2 seperti dahulu. `sticky top-0 z-10` (2026-08-07, Audit §I1) — dahulu SEMUA
 *  8 jadual Editorium kehilangan kepala apabila ditatal; latar pejal wajib pada sticky supaya
 *  baris di bawahnya tidak lutsinar menerusinya.
 *  text-stone-600 pada 11px (2026-08-07, Audit §H1, diluluskan Izzat) — stone-400 atas
 *  --color-Adjung-paper diukur nisbah kontras 2.32, jauh gagal WCAG AA (ambang 4.5). stone-600
 *  beri 7.01, lulus selesa. */
export const KEPALA_JADUAL =
  'font-mono text-[11px] uppercase tracking-wider text-stone-600 bg-Adjung-paper sticky top-0 z-10';

/** Garis pemisah baris jadual — dahulu `style={{borderTop:'1px solid #F0EDE9'}}` sebaris atau
 *  `divide-y divide-stone-100`, bergantung fail. */
export const GARIS_BARIS = 'border-t border-Adjung-line';
