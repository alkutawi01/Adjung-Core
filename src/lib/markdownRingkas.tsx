import React from 'react';

// Render markdown MINIMAL (bukan editor WYSIWYG penuh — lihat nota di titik guna) untuk
// kandungan static_pages (Syarat & Peraturan Editor, dll) yang ditulis guna sintaks ringkas:
// "# "/"## " tajuk, "---" garis pemisah, "**tebal**", dan perenggan biasa (dipisah baris kosong).
// Sengaja TIDAK menyokong markdown penuh (senarai bertanda, pautan, dll) — skop cukup untuk
// dokumen dasar/terma yang setakat ni ditulis, bukan enjin markdown umum.
export function renderMarkdownRingkas(teks: string, opsyen?: { kelasPerenggan?: string }): React.ReactNode[] {
  const kelasPerenggan = opsyen?.kelasPerenggan;
  const paparTebal = (baris: string) => {
    const bahagian = baris.split(/\*\*([^*]+)\*\*/g);
    return bahagian.map((bhg, i) => (i % 2 === 1 ? <strong key={i} className="text-[#802334] font-semibold">{bhg}</strong> : bhg));
  };

  return teks.split(/\n{2,}/).map((blok, i) => {
    const trimmed = blok.trim();
    if (/^-{3,}$/.test(trimmed)) {
      return <hr key={i} className="border-stone-300 my-3" />;
    }
    const padananTajuk = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (padananTajuk) {
      const tahap = padananTajuk[1].length;
      const isiTajuk = paparTebal(padananTajuk[2]);
      if (tahap === 1) return <h2 key={i} className="text-sm font-bold text-stone-900 mt-1">{isiTajuk}</h2>;
      if (tahap === 2) return <h3 key={i} className="text-xs font-bold text-stone-800 uppercase tracking-wide mt-1">{isiTajuk}</h3>;
      return <h4 key={i} className="text-xs font-semibold text-stone-700">{isiTajuk}</h4>;
    }
    return <p key={i} className={kelasPerenggan}>{paparTebal(blok)}</p>;
  });
}
