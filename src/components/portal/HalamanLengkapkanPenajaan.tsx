import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BRAND, LOGO_SIZE } from '../../config/brand';

// Halaman awam "Lengkapkan Penajaan" (2026-08-30) — destinasi pautan peribadi berjangka
// `/lengkapkan-penajaan?token=...` dihantar selepas permohonan diluluskan. TIADA log masuk
// (keputusan Izzat) — token itu sendiri ialah kebenaran. Boleh dihantar semula (bukan
// sekali-guna literal) selagi token belum tamat (7 hari) dan bayaran belum disahkan pelayan,
// supaya pemohon yang tersalah muat naik boleh cuba semula. Corak visual & struktur token
// mengikut TetapkanKataLaluan.tsx (GET semak status dahulu, borang selepas itu).
//
// Guna /api/public/lengkapkan-penajaan/:token/upload (BUKAN /api/media/upload — laluan tu
// digerbang requireAuthForWrites di server.js, borang ni sengaja TANPA sesi) — kelayakan
// disahkan token, bukan sesi. Sama had jenis fail (imej sahaja, PNG/JPEG/WEBP/GIF/SVG) — bukti
// bayaran V1 sengaja dihadkan format screenshot/imej resit, BUKAN PDF.

interface MaklumatToken {
  id: string;
  jenisPemohon: 'individu' | 'organisasi';
  namaPapar: string;
  jumlahDipersetujui: number;
  status: string;
  buktiBayaranUrl: string;
  logoUrl: string;
  perluLogo: boolean;
}

export const HalamanLengkapkanPenajaan: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [memuat, setMemuat] = useState(true);
  const [ralatMuat, setRalatMuat] = useState('');
  const [maklumat, setMaklumat] = useState<MaklumatToken | null>(null);

  const [buktiBayaranUrl, setBuktiBayaranUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [tarikhBayaran, setTarikhBayaran] = useState('');
  const [memuatNaikBukti, setMemuatNaikBukti] = useState(false);
  const [memuatNaikLogo, setMemuatNaikLogo] = useState(false);
  const [menghantar, setMenghantar] = useState(false);
  const [ralat, setRalat] = useState('');
  const [berjaya, setBerjaya] = useState(false);

  useEffect(() => {
    if (!token) { setMemuat(false); setRalatMuat('Pautan ini tidak sah — tiada token dijumpai.'); return; }
    fetch(`/api/public/lengkapkan-penajaan/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Pautan tidak sah.');
        return d as MaklumatToken;
      })
      .then((d) => {
        setMaklumat(d);
        setBuktiBayaranUrl(d.buktiBayaranUrl || '');
        setLogoUrl(d.logoUrl || '');
      })
      .catch((e) => setRalatMuat(e.message || 'Pautan tidak sah.'))
      .finally(() => setMemuat(false));
  }, [token]);

  const muatNaikFail = async (file: File, jenis: 'bukti' | 'logo') => {
    if (!file.type.startsWith('image/')) {
      setRalat('Fail mesti imej (PNG/JPEG/WEBP/GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setRalat('Fail terlalu besar (had 5MB).');
      return;
    }
    setRalat('');
    (jenis === 'bukti' ? setMemuatNaikBukti : setMemuatNaikLogo)(true);
    try {
      const fileData: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Gagal baca fail'));
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/public/lengkapkan-penajaan/${encodeURIComponent(token)}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, fileData }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Muat naik gagal');
      if (jenis === 'bukti') setBuktiBayaranUrl(data.url);
      else setLogoUrl(data.url);
    } catch (e: any) {
      setRalat(e.message || 'Muat naik gagal, cuba lagi.');
    } finally {
      (jenis === 'bukti' ? setMemuatNaikBukti : setMemuatNaikLogo)(false);
    }
  };

  const hantar = async (e: React.FormEvent) => {
    e.preventDefault();
    setRalat('');
    if (!buktiBayaranUrl) { setRalat('Sila muat naik bukti bayaran.'); return; }
    if (maklumat?.perluLogo && !logoUrl) { setRalat('Sila muat naik logo organisasi.'); return; }
    setMenghantar(true);
    try {
      const res = await fetch(`/api/public/lengkapkan-penajaan/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buktiBayaranUrl, logoUrl: logoUrl || undefined, tarikhBayaran }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setRalat(data.error || 'Gagal menghantar.'); return; }
      setBerjaya(true);
    } catch {
      setRalat('Ralat sambungan. Sila cuba sekali lagi.');
    } finally {
      setMenghantar(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col">
      <header className="w-full max-w-lg mx-auto px-6 pt-10">
        <Link to="/" className={`font-serif ${LOGO_SIZE.header} text-[#802334] tracking-tight hover:opacity-80 transition-opacity`}>
          {BRAND.logoText}
        </Link>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-6 py-10">
        <h1 className="font-serif text-2xl md:text-3xl text-stone-900 font-normal tracking-tight mb-6">
          Lengkapkan Penajaan
        </h1>

        {memuat && <p className="font-sans text-sm text-stone-400">Memuatkan…</p>}

        {!memuat && ralatMuat && (
          <p className="font-sans text-sm text-red-700 border border-red-200 bg-red-50 rounded px-3 py-2">{ralatMuat}</p>
        )}

        {!memuat && !ralatMuat && maklumat && !berjaya && (
          <>
            <div className="font-sans text-sm text-stone-700 mb-6 space-y-1">
              <p><span className="text-stone-400">Rujukan:</span> <strong>{maklumat.id}</strong></p>
              <p><span className="text-stone-400">Nama:</span> {maklumat.namaPapar}</p>
              <p><span className="text-stone-400">Jumlah dipersetujui:</span> RM{Number(maklumat.jumlahDipersetujui || 0).toLocaleString('ms-MY')}</p>
            </div>

            <form onSubmit={hantar} className="flex flex-col gap-5">
              <div>
                <label className="font-sans text-xs font-semibold text-stone-700">Bukti bayaran *</label>
                <p className="font-sans text-[11px] text-stone-500 mb-1">Muat naik resit/tangkapan skrin bayaran (imej PNG/JPEG, maksimum 5MB).</p>
                <input
                  type="file" accept="image/*"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) muatNaikFail(f, 'bukti'); e.target.value = ''; }}
                  className="font-sans text-xs"
                />
                {memuatNaikBukti && <p className="font-sans text-[11px] text-stone-400 mt-1">Memuat naik…</p>}
                {buktiBayaranUrl && <img src={buktiBayaranUrl} alt="Bukti bayaran" className="mt-2 h-20 object-contain border border-stone-150 rounded bg-white p-1" />}
              </div>

              {maklumat.perluLogo && (
                <div>
                  <label className="font-sans text-xs font-semibold text-stone-700">Logo organisasi *</label>
                  <p className="font-sans text-[11px] text-stone-500 mb-1">PNG berlatar telus digalakkan, sekurang-kurangnya 800px pada sisi terpanjang.</p>
                  <input
                    type="file" accept="image/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) muatNaikFail(f, 'logo'); e.target.value = ''; }}
                    className="font-sans text-xs"
                  />
                  {memuatNaikLogo && <p className="font-sans text-[11px] text-stone-400 mt-1">Memuat naik…</p>}
                  {logoUrl && <img src={logoUrl} alt="Logo" className="mt-2 h-16 object-contain border border-stone-150 rounded bg-white p-1" />}
                </div>
              )}

              <div>
                <label className="font-sans text-xs font-semibold text-stone-700" htmlFor="lp-tarikh">Tarikh bayaran</label>
                <input id="lp-tarikh" type="date" value={tarikhBayaran} onChange={(e) => setTarikhBayaran(e.target.value)} className="w-full border border-stone-300 rounded px-3 py-2 font-sans text-sm text-stone-800 bg-white focus:outline-none focus:border-[#802334]" />
              </div>

              {ralat && <p className="font-sans text-xs text-[#a8241f] border border-red-200 bg-red-50 rounded px-3 py-2">{ralat}</p>}

              <button
                type="submit" disabled={menghantar || memuatNaikBukti || memuatNaikLogo}
                className="font-sans text-sm font-semibold bg-[#802334] text-white px-6 py-2.5 rounded hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
              >
                {menghantar ? 'Menghantar…' : 'Hantar'}
              </button>
            </form>
          </>
        )}

        {berjaya && (
          <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-6">
            <h2 className="font-serif text-xl text-emerald-900 mb-2">Diterima</h2>
            <p className="font-sans text-sm text-emerald-800 leading-relaxed">
              Terima kasih. Adjung Brief akan mengesahkan bayaran anda dan mengaktifkan penajaan
              tidak lama lagi. Anda akan menerima e-mel sebaik penajaan aktif.
            </p>
          </div>
        )}
      </main>

      <footer className="w-full max-w-lg mx-auto px-6 pb-10">
        <p className="font-mono text-[9px] tracking-widest text-stone-400 uppercase font-bold">{BRAND.copyright}</p>
      </footer>
    </div>
  );
};

export default HalamanLengkapkanPenajaan;
