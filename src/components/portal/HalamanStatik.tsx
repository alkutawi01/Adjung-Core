import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../../config/brand';

// Halaman awam ringkas (Fasa 11, 2026-08-02) — papar kandungan yang diisi Ketua Editor
// melalui panel "Halaman Awam" (Tetapan Sistem → Tetapan). Guna laluan sedia ada
// GET /api/pages/:key (core/routes/systemRoutes.js). Bukan bento — reka bentuk artikel
// ringkas dipusatkan, tiada peraturan geometri kad terpakai di sini.

interface HalamanStatikProps {
  pageKey: string;
  labelSandaran: string;
}

interface HalamanData {
  title: string;
  content: string;
  updatedAt?: string;
}

// Sokongan **tebal** ringkas (2026-08-05) — sepadan corak sedia ada di modal footer
// (FrontpageView.tsx), supaya sub-tajuk seksyen (cth "**Sumber kandungan**") dalam kandungan
// Dasar Penerbitan/Polisi Privasi/dll dipaparkan tebal, bukan tanda bintang mentah.
const paparTeksTebal = (teks: string) => {
  const bahagian = teks.split(/\*\*([^*]+)\*\*/g);
  return bahagian.map((bhg, i) => (i % 2 === 1 ? <strong key={i} className="text-[#802334] font-semibold">{bhg}</strong> : bhg));
};

export const HalamanStatik: React.FC<HalamanStatikProps> = ({ pageKey, labelSandaran }) => {
  const [data, setData] = useState<HalamanData | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [ralat, setRalat] = useState('');

  useEffect(() => {
    let dibatalkan = false;
    setMemuat(true);
    setRalat('');
    fetch(`/api/pages/${pageKey}`)
      .then(async (r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('Gagal memuatkan halaman.');
        return r.json();
      })
      .then((json) => {
        if (!dibatalkan) setData(json);
      })
      .catch((e) => {
        if (!dibatalkan) setRalat(e.message || 'Gagal memuatkan halaman.');
      })
      .finally(() => {
        if (!dibatalkan) setMemuat(false);
      });
    return () => {
      dibatalkan = true;
    };
  }, [pageKey]);

  const tajuk = data?.title || labelSandaran;
  const perenggan = (data?.content || '').split('\n\n').filter((p) => p.trim().length > 0);

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col">
      <header className="w-full max-w-2xl mx-auto px-6 pt-10">
        <Link
          to="/"
          className="font-serif text-2xl text-[#802334] tracking-tight hover:opacity-80 transition-opacity"
        >
          {BRAND.logoText}
        </Link>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-10">
        {memuat ? (
          <p className="font-sans text-sm text-stone-400">Memuatkan...</p>
        ) : ralat ? (
          <p className="font-sans text-sm text-red-700">{ralat}</p>
        ) : (
          <>
            <h1 className="font-serif text-3xl md:text-4xl text-stone-900 font-normal tracking-tight mb-6">
              {tajuk}
            </h1>
            {perenggan.length > 0 ? (
              <div className="flex flex-col gap-4">
                {perenggan.map((p, idx) => (
                  <p key={idx} className="font-serif text-[15px] leading-relaxed text-stone-700 whitespace-pre-line">
                    {paparTeksTebal(p)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="font-sans text-sm text-stone-400 italic">
                Kandungan belum disediakan.
              </p>
            )}
            {data?.updatedAt && (
              <p className="font-mono text-[9px] tracking-widest text-stone-400 uppercase font-bold mt-10">
                Kemas Kini Terakhir: {new Date(data.updatedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </>
        )}
      </main>

      <footer className="w-full max-w-2xl mx-auto px-6 pb-10 pt-6 border-t border-stone-200">
        <Link to="/" className="font-sans text-xs font-semibold text-stone-600 hover:text-[#802334] transition-colors">
          &larr; Kembali ke Laman Utama
        </Link>
      </footer>
    </div>
  );
};
