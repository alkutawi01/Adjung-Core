import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, ArchiveRestore, Pencil, Upload } from 'lucide-react';

// Penaja (2026-08-05, Fasa 12 — permintaan Izzat). Tajaan BULANAN, boleh berbilang penaja
// serentak dalam satu bulan. Halaman awam /penaja senaraikan SEMUA penaja aktif (lama + semasa,
// bulan terbaru dahulu); footer papar penaja bulan SEMASA sahaja — lihat FrontpageView.tsx dan
// HalamanPenaja.tsx. Gerbang server `manageSettings` (Pentadbir sahaja) — keputusan perniagaan/
// penempatan, bukan editorial harian, sama corak macam Direktori/Tetapan/Halaman Awam.
//
// `tayangSemasaTransisi` — togol DATA sahaja buat masa ini (keputusan Izzat 2026-08-05): bina
// tetapan/wiring dulu, overlay transisi carousel sebenar KEMUDIAN selepas reka bentuk/kelakuan
// disahkan — JSX carousel tu rapuh (lihat CLAUDE.md). Togol ni belum beri sebarang kesan visual.
interface Penaja {
  id: string;
  nama: string;
  logoUrl: string;
  url: string;
  bulan: string; // 'YYYY-MM'
  tayangSemasaTransisi: boolean;
  // Jumlah bayaran (2026-08-05, permintaan Izzat) — utk kegunaan DALAMAN sahaja buat masa ini:
  // halaman /penaja akan dinaik taraf supaya saiz "kotak" setiap penaja berkadar terus dgn
  // jumlah tajaan (cth RM1000 = kotak 10x lebih besar drpd RM100), tapi pengiraan/lukisan
  // sebenar ialah kerja fasa akan datang — angka ni TIDAK dipaparkan di /penaja sekarang
  // (maklumat sensitif, laluan awam sengaja tak pulangkan medan ni — lihat sponsorRoutes.js).
  jumlahBayaran: number;
  status: 'aktif' | 'arkib';
  dikemasPada: string;
}

const HAD_NAMA = 100;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const bulanRingkas = (bulan: string) => {
  const [tahun, bulanNo] = (bulan || '').split('-');
  if (!tahun || !bulanNo) return bulan || '—';
  const d = new Date(Number(tahun), Number(bulanNo) - 1, 1);
  if (Number.isNaN(d.getTime())) return bulan;
  return d.toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' });
};

const bulanSemasaInput = () => new Date().toISOString().slice(0, 7);

export const PenajaConsole: React.FC = () => {
  const [senarai, setSenarai] = useState<Penaja[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [ralat, setRalat] = useState('');
  const [paparanArkib, setPaparanArkib] = useState(false);

  const [menyunting, setMenyunting] = useState<string>('');
  const [nama, setNama] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [url, setUrl] = useState('');
  const [bulan, setBulan] = useState(bulanSemasaInput());
  const [tayangSemasaTransisi, setTayangSemasaTransisi] = useState(false);
  const [jumlahBayaran, setJumlahBayaran] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralatBorang, setRalatBorang] = useState('');
  const [mesej, setMesej] = useState('');
  const [memuatNaik, setMemuatNaik] = useState(false);
  const [notaLogo, setNotaLogo] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const muat = useCallback(() => {
    setMemuat(true);
    setRalat('');
    fetch('/api/system/sponsors')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal membaca senarai penaja.');
        return data;
      })
      .then((d) => setSenarai(Array.isArray(d) ? d : []))
      .catch((e) => setRalat(e.message || 'Gagal membaca senarai penaja.'))
      .finally(() => setMemuat(false));
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const kosongkanBorang = () => {
    setMenyunting('');
    setNama('');
    setLogoUrl('');
    setUrl('');
    setBulan(bulanSemasaInput());
    setTayangSemasaTransisi(false);
    setJumlahBayaran('');
    setRalatBorang('');
  };

  const mulaSunting = (p: Penaja) => {
    setMenyunting(p.id);
    setNama(p.nama);
    setLogoUrl(p.logoUrl);
    setUrl(p.url);
    setBulan(p.bulan);
    setTayangSemasaTransisi(p.tayangSemasaTransisi);
    setJumlahBayaran(p.jumlahBayaran ? String(p.jumlahBayaran) : '');
    setRalatBorang('');
  };

  const muatNaikLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setNotaLogo('Fail mesti imej');
      setTimeout(() => setNotaLogo(''), 2400);
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setNotaLogo('Fail terlalu besar (had 5MB)');
      setTimeout(() => setNotaLogo(''), 2400);
      return;
    }
    setMemuatNaik(true);
    try {
      const fileData: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Gagal baca fail'));
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, fileData }),
      });
      if (!res.ok) throw new Error('Muat naik gagal');
      const data = await res.json();
      setLogoUrl(data.url);
      setNotaLogo('Dimuat naik');
    } catch (e) {
      setNotaLogo('Muat naik gagal — cuba lagi');
    } finally {
      setMemuatNaik(false);
      setTimeout(() => setNotaLogo(''), 2400);
    }
  };

  const hantar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenyimpan(true);
    setRalatBorang('');
    try {
      const menyuntingSedia = !!menyunting;
      const res = await fetch(
        menyuntingSedia ? `/api/system/sponsors/${menyunting}` : '/api/system/sponsors',
        {
          method: menyuntingSedia ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nama, logoUrl, url, bulan, tayangSemasaTransisi, jumlahBayaran: jumlahBayaran === '' ? 0 : Number(jumlahBayaran) }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan penaja.');
      kosongkanBorang();
      setMesej(menyuntingSedia ? 'Penaja dikemas kini' : 'Penaja ditambah');
      setTimeout(() => setMesej(''), 2400);
      muat();
    } catch (err: any) {
      setRalatBorang(err.message || 'Gagal menyimpan penaja.');
    } finally {
      setMenyimpan(false);
    }
  };

  const ubahStatus = async (id: string, status: 'aktif' | 'arkib') => {
    try {
      const res = await fetch(`/api/system/sponsors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengemas kini penaja.');
      muat();
    } catch (err: any) {
      setRalat(err.message || 'Gagal mengemas kini penaja.');
    }
  };

  const senaraiDipapar = senarai.filter((p) => (paparanArkib ? p.status === 'arkib' : p.status === 'aktif'));

  return (
    <div className="space-y-4 font-sans">
      <form onSubmit={hantar} className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
              {menyunting ? 'Sunting Penaja' : 'Tambah Penaja'}
            </h3>
            <p className="text-stone-500 text-xs">
              Papar di footer Frontpage ("Portal ini disokong oleh:") hanya untuk bulan yang dipilih. Halaman /penaja senaraikan semua penaja aktif.
            </p>
          </div>
          {menyunting && (
            <button
              type="button"
              onClick={kosongkanBorang}
              className="px-3 py-1.5 border border-stone-300 rounded text-[11px] font-semibold text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
            >
              Batal Sunting
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="flex justify-between font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
              <span>Nama Penaja</span>
              <span className={nama.length > HAD_NAMA ? 'text-red-700' : 'text-stone-400'}>{nama.length}/{HAD_NAMA}</span>
            </span>
            <input
              type="text" value={nama} onChange={(e) => setNama(e.target.value)}
              placeholder="Nama syarikat/penaja…"
              className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Bulan Tajaan</span>
            <input
              type="month" value={bulan} onChange={(e) => setBulan(e.target.value)}
              className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs cursor-pointer"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">URL Laman Penaja (pilihan)</span>
          <input
            type="text" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Jumlah Bayaran (RM)</span>
          <input
            type="number" min="0" step="1" value={jumlahBayaran} onChange={(e) => setJumlahBayaran(e.target.value)}
            placeholder="0"
            className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs"
          />
          <span className="text-stone-400 text-[10px]">
            Untuk kegunaan dalaman — akan tentukan saiz visual penaja di /penaja apabila ciri visualisasi dibina. Tidak dipaparkan kepada awam.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Logo</span>
            {notaLogo && <span className="font-sans text-[9px] text-stone-400">{notaLogo}</span>}
          </span>
          <span className="flex items-center gap-2">
            <input
              type="text" value={logoUrl} placeholder="Nama fail / URL logo…" onChange={(e) => setLogoUrl(e.target.value)}
              className="w-0 flex-1 border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
            />
            <button
              type="button" disabled={memuatNaik} onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 border border-stone-300 rounded text-[11px] font-sans font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-wait"
            >
              <Upload className="w-3 h-3" />{memuatNaik ? 'Memuat naik…' : 'Muat naik'}
            </button>
          </span>
          <input
            ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) muatNaikLogo(f); e.target.value = ''; }}
          />
          {logoUrl && (
            <img src={logoUrl} alt="Pratonton logo" className="mt-1 h-10 object-contain border border-stone-150 rounded bg-white p-1" />
          )}
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox" checked={tayangSemasaTransisi}
            onChange={(e) => setTayangSemasaTransisi(e.target.checked)}
            className="cursor-pointer"
          />
          <span className="text-stone-600 text-xs">
            Papar semasa transisi carousel <span className="text-stone-400">(akan datang — togol data sahaja, belum aktif secara visual)</span>
          </span>
        </label>

        {ralatBorang && (
          <p className="text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 text-[11px]">{ralatBorang}</p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          {mesej && <span className="text-emerald-700 text-[11px] font-semibold">{mesej}</span>}
          <button
            type="submit"
            disabled={menyimpan || !nama.trim() || nama.length > HAD_NAMA || !/^\d{4}-\d{2}$/.test(bulan)}
            className="bg-[#802334] text-white px-4 py-1.5 rounded font-semibold text-xs hover:bg-[#6a1c2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {menyimpan ? 'Menyimpan…' : menyunting ? 'Simpan Perubahan' : 'Tambah Penaja'}
          </button>
        </div>
      </form>

      <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
              {paparanArkib ? 'Penaja Diarkibkan' : 'Penaja Aktif'}
            </h3>
            <p className="text-stone-500 text-xs">
              {paparanArkib
                ? 'Penaja yang ditarik balik. Boleh dipulihkan bila-bila.'
                : 'Semua penaja aktif (lama & semasa) — susun bulan terbaru dahulu.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPaparanArkib((v) => !v)}
            className="px-3 py-1.5 border border-stone-300 rounded text-[11px] font-semibold text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
          >
            {paparanArkib ? 'Lihat Aktif' : 'Lihat Arkib'}
          </button>
        </div>

        {ralat && <p className="text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 text-[11px]">{ralat}</p>}

        {memuat ? (
          <p className="text-stone-400 text-xs">Memuatkan…</p>
        ) : senaraiDipapar.length === 0 ? (
          <p className="text-stone-400 text-xs italic">{paparanArkib ? 'Tiada penaja diarkibkan.' : 'Tiada penaja aktif.'}</p>
        ) : (
          <ul className="list-none m-0 p-0 divide-y divide-stone-100">
            {senaraiDipapar.map((p) => (
              <li key={p.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 flex items-center gap-3">
                  {p.logoUrl ? (
                    <img src={p.logoUrl} alt={p.nama} className="h-8 w-8 object-contain border border-stone-150 rounded bg-white p-1 shrink-0" />
                  ) : (
                    <div className="h-8 w-8 shrink-0 border border-stone-150 rounded bg-stone-50" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-[#802334] border border-[#802334]/30 bg-[#802334]/[0.06] px-1.5 py-0.5 rounded">
                        {bulanRingkas(p.bulan)}
                      </span>
                      {p.tayangSemasaTransisi && (
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400">Transisi diaktifkan</span>
                      )}
                    </div>
                    <p className="font-serif text-sm text-stone-900 truncate">{p.nama}</p>
                    <p className="text-stone-400 text-[10px] truncate">
                      {p.url}{p.url && p.jumlahBayaran > 0 ? ' · ' : ''}{p.jumlahBayaran > 0 ? `RM${p.jumlahBayaran.toLocaleString('ms-MY')}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!paparanArkib && (
                    <button
                      type="button" onClick={() => mulaSunting(p)}
                      title="Sunting" className="p-1.5 text-stone-500 hover:text-[#802334] cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => ubahStatus(p.id, paparanArkib ? 'aktif' : 'arkib')}
                    title={paparanArkib ? 'Pulihkan' : 'Arkibkan'}
                    className="p-1.5 text-stone-500 hover:text-[#802334] cursor-pointer"
                  >
                    {paparanArkib ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
