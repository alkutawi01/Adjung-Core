import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND, LOGO_SIZE } from '../../config/brand';

// Halaman Penaja (2026-08-05, Fasa 12 — permintaan Izzat). Senaraikan SEMUA penaja aktif (lama
// dan semasa), disusun bulan terbaru dahulu, dikumpul ikut bulan. Tajaan BULANAN — footer
// (FrontpageView.tsx) papar bulan SEMASA sahaja dan pautan ke sini; laman ni tujuan sejarah
// penuh. Reka bentuk ringkas dipusatkan, sama corak seperti HalamanStatik.tsx tapi struktur data
// tersendiri (senarai berkumpul, bukan prosa).

interface Penaja {
  id: string;
  nama: string;
  logoUrl: string;
  url: string;
  bulan: string;
}

const bulanRingkas = (bulan: string) => {
  const [tahun, bulanNo] = (bulan || '').split('-');
  if (!tahun || !bulanNo) return bulan || '—';
  const d = new Date(Number(tahun), Number(bulanNo) - 1, 1);
  if (Number.isNaN(d.getTime())) return bulan;
  return d.toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' });
};

export const HalamanPenaja: React.FC = () => {
  const [penaja, setPenaja] = useState<Penaja[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [ralat, setRalat] = useState('');

  useEffect(() => {
    let dibatalkan = false;
    fetch('/api/public/sponsors/semua')
      .then(async (r) => {
        if (!r.ok) throw new Error('Gagal memuatkan senarai penaja.');
        return r.json();
      })
      .then((data) => { if (!dibatalkan) setPenaja(Array.isArray(data) ? data : []); })
      .catch(() => { if (!dibatalkan) setRalat('Gagal memuatkan senarai penaja. Cuba lagi.'); })
      .finally(() => { if (!dibatalkan) setMemuat(false); });
    return () => { dibatalkan = true; };
  }, []);

  // Kumpul ikut bulan (senarai sudah disusun bulan terbaru dahulu oleh pelayan) — kekalkan
  // susunan tu, bukan susun semula di klien.
  const kumpulan: { bulan: string; senarai: Penaja[] }[] = [];
  for (const p of penaja) {
    const kumpulanSedia = kumpulan[kumpulan.length - 1];
    if (kumpulanSedia && kumpulanSedia.bulan === p.bulan) {
      kumpulanSedia.senarai.push(p);
    } else {
      kumpulan.push({ bulan: p.bulan, senarai: [p] });
    }
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col">
      <header className="w-full max-w-2xl mx-auto px-6 pt-10">
        <Link
          to="/"
          className={`font-serif ${LOGO_SIZE.header} text-[#802334] tracking-tight hover:opacity-80 transition-opacity`}
        >
          {BRAND.logoText}
        </Link>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-serif text-3xl md:text-4xl text-stone-900 font-normal tracking-tight mb-2">
          Penaja
        </h1>
        <p className="font-sans text-xs text-stone-500 mb-4">
          Adjung disokong secara bulanan oleh penaja yang dipilih. Terima kasih kepada semua yang menyokong.
        </p>
        <Link
          to="/jadi-penaja"
          className="inline-block mb-8 font-sans text-xs font-semibold bg-[#802334] text-white px-4 py-2 rounded hover:opacity-90 transition-opacity"
        >
          Jadi Penaja Adjung Brief →
        </Link>

        {memuat ? (
          <p className="font-sans text-sm text-stone-400">Memuatkan…</p>
        ) : ralat ? (
          <p className="font-sans text-sm text-red-700">{ralat}</p>
        ) : kumpulan.length === 0 ? (
          <p className="font-sans text-sm text-stone-400 italic">Tiada penaja disenaraikan buat masa ini.</p>
        ) : (
          <div className="flex flex-col gap-8">
            {kumpulan.map((k) => (
              <div key={k.bulan} className="flex flex-col gap-3">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-stone-400 font-bold border-b border-stone-200 pb-2">
                  {bulanRingkas(k.bulan)}
                </h2>
                <ul className="list-none m-0 p-0 flex flex-col gap-3">
                  {k.senarai.map((p) => (
                    <li key={p.id} className="flex items-center gap-3">
                      {p.logoUrl && (
                        <img src={p.logoUrl} alt={p.nama} className="h-8 object-contain border border-stone-150 rounded bg-white p-1 shrink-0" />
                      )}
                      {p.url ? (
                        <a
                          href={p.url} target="_blank" rel="noopener noreferrer"
                          className="font-serif text-[15px] text-stone-800 hover:text-[#802334] transition-colors"
                        >
                          {p.nama}
                        </a>
                      ) : (
                        <span className="font-serif text-[15px] text-stone-800">{p.nama}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
