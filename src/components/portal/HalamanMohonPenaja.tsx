import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND, LOGO_SIZE } from '../../config/brand';

// Halaman awam "Mohon Jadi Penaja" (2026-08-30) — reka bentuk dikunci selepas 10 pusingan
// perbincangan Izzat/ChatGPT (rujuk core/routes/permohonanPenajaRoutes.js untuk carta status
// penuh + rujukan profesional). Borang ni SENGAJA pendek — logo, bukti bayaran, IC/dokumen,
// nombor telefon dan "motivasi" semuanya TIDAK diminta di sini; semua itu berlaku SELEPAS
// permohonan diluluskan (lihat HalamanLengkapkanPenajaan.tsx). Nada borang: mengalu-alukan
// dahulu, standard/tapisan dinyatakan dengan tenang — bukan borang polisi yang kering.
//
// Aliran: borang ini -> POST /api/public/permohonan-penaja -> notifikasi Peti Makluman Ketua
// Editor/Pentadbir -> semakan di Editorium (Penaja -> Permohonan) -> lulus/tolak melalui e-mel.

const INPUT_KELAS =
  'w-full border border-stone-300 rounded px-3 py-2 font-sans text-sm text-stone-800 bg-white focus:outline-none focus:border-[#802334] transition-colors';
const LABEL_KELAS = 'font-sans text-xs font-semibold text-stone-700';
const NOTA_KELAS = 'font-sans text-[11px] text-stone-500 mt-1';

export const HalamanMohonPenaja: React.FC = () => {
  const [jenisPemohon, setJenisPemohon] = useState<'individu' | 'organisasi'>('individu');
  const [namaSebenar, setNamaSebenar] = useState('');
  const [namaOrganisasi, setNamaOrganisasi] = useState('');
  const [namaWakil, setNamaWakil] = useState('');
  const [emel, setEmel] = useState('');
  const [lamanRasmi, setLamanRasmi] = useState('');
  const [noPendaftaran, setNoPendaftaran] = useState('');
  const [aktivitiUtama, setAktivitiUtama] = useState('');
  const [penerangan, setPenerangan] = useState('');
  const [pilihanPaparan, setPilihanPaparan] = useState<'nama' | 'hamba_allah'>('nama');
  const [pilihanTajaan, setPilihanTajaan] = useState('');
  const [catatan, setCatatan] = useState('');
  const [laman, setLaman] = useState(''); // honeypot

  const [menghantar, setMenghantar] = useState(false);
  const [ralat, setRalat] = useState('');
  const [berjaya, setBerjaya] = useState(false);
  const [rujukan, setRujukan] = useState('');

  const hantar = async (e: React.FormEvent) => {
    e.preventDefault();
    setRalat('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emel.trim())) {
      setRalat('Sila isi alamat e-mel yang sah.');
      return;
    }
    if (jenisPemohon === 'individu' && !namaSebenar.trim()) {
      setRalat('Sila isi nama sebenar anda.');
      return;
    }
    if (jenisPemohon === 'organisasi' && (!namaOrganisasi.trim() || !namaWakil.trim() || !aktivitiUtama.trim())) {
      setRalat('Sila lengkapkan nama organisasi, nama wakil dan aktiviti utama.');
      return;
    }
    setMenghantar(true);
    try {
      const res = await fetch('/api/public/permohonan-penaja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenisPemohon,
          namaSebenar: namaSebenar.trim(),
          namaOrganisasi: namaOrganisasi.trim(),
          namaWakil: namaWakil.trim(),
          emel: emel.trim(),
          lamanRasmi: lamanRasmi.trim(),
          noPendaftaran: noPendaftaran.trim(),
          aktivitiUtama: aktivitiUtama.trim(),
          penerangan: penerangan.trim(),
          pilihanPaparan,
          pilihanTajaan: pilihanTajaan.trim(),
          catatan: catatan.trim(),
          laman,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRalat(data.error || 'Permohonan gagal dihantar. Sila cuba sekali lagi.');
        return;
      }
      setRujukan(data.id || '');
      setBerjaya(true);
    } catch {
      setRalat('Ralat sambungan. Sila cuba sekali lagi.');
    } finally {
      setMenghantar(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col">
      <header className="w-full max-w-2xl mx-auto px-6 pt-10">
        <Link to="/" className={`font-serif ${LOGO_SIZE.header} text-[#802334] tracking-tight hover:opacity-80 transition-opacity`}>
          {BRAND.logoText}
        </Link>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-serif text-3xl md:text-4xl text-stone-900 font-normal tracking-tight mb-2">
          Jadi Penaja Adjung Brief
        </h1>
        <p className="font-serif text-[15px] leading-relaxed text-stone-700 mb-2">
          Ambil bahagian dalam menyokong penerbitan ilmu dan kandungan Bahasa Melayu. Sebagai
          pengiktirafan, nama atau logo penaja yang diluluskan akan dipaparkan di Adjung Brief
          sepanjang tempoh penajaan.
        </p>
        <p className="font-sans text-xs text-stone-500 mb-8">
          Untuk menjaga nilai dan kebebasan editorial Adjung Brief, setiap permohonan disemak
          terlebih dahulu sebelum diterima. Lihat{' '}
          <Link to="/penaja" className="underline hover:text-[#802334]">Dasar Penajaan</Link> kami.
        </p>

        {berjaya ? (
          <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-6">
            <h2 className="font-serif text-xl text-emerald-900 mb-2">Permohonan diterima</h2>
            <p className="font-sans text-sm text-emerald-800 leading-relaxed">
              Rujukan: <strong>{rujukan}</strong>
            </p>
            <p className="font-sans text-sm text-emerald-800 leading-relaxed mt-2">
              Adjung Brief akan menyemak permohonan ini terlebih dahulu. Semua urusan seterusnya,
              termasuk keputusan permohonan dan urusan bayaran sekiranya diluluskan, akan dibuat
              melalui e-mel.
            </p>
            <Link to="/" className="inline-block mt-4 font-sans text-xs font-semibold bg-[#802334] text-white px-4 py-2 rounded hover:opacity-90 transition-opacity">
              Kembali ke Laman Utama
            </Link>
          </div>
        ) : (
          <form onSubmit={hantar} className="flex flex-col gap-5">
            <div>
              <span className={LABEL_KELAS}>Anda memohon sebagai *</span>
              <div className="mt-2 flex gap-2">
                {(['individu', 'organisasi'] as const).map((j) => (
                  <button
                    key={j} type="button" onClick={() => setJenisPemohon(j)}
                    aria-pressed={jenisPemohon === j}
                    className={`px-4 py-1.5 rounded-full border font-sans text-xs font-semibold transition-colors cursor-pointer ${
                      jenisPemohon === j ? 'bg-[#802334] border-[#802334] text-white' : 'bg-white border-stone-300 text-stone-600 hover:border-[#802334] hover:text-[#802334]'
                    }`}
                  >
                    {j === 'individu' ? 'Individu' : 'Organisasi'}
                  </button>
                ))}
              </div>
            </div>

            {jenisPemohon === 'individu' ? (
              <>
                <div>
                  <label className={LABEL_KELAS} htmlFor="mp-nama">Nama sebenar *</label>
                  <input id="mp-nama" type="text" className={INPUT_KELAS} value={namaSebenar} onChange={(e) => setNamaSebenar(e.target.value)} maxLength={120} />
                </div>
                <div>
                  <span className={LABEL_KELAS}>Bagaimana nama anda hendak dipaparkan jika diluluskan? *</span>
                  <div className="mt-2 flex flex-col gap-2">
                    <label className="flex items-center gap-2 font-sans text-sm text-stone-700 cursor-pointer">
                      <input type="radio" checked={pilihanPaparan === 'nama'} onChange={() => setPilihanPaparan('nama')} /> Nama saya
                    </label>
                    <label className="flex items-center gap-2 font-sans text-sm text-stone-700 cursor-pointer">
                      <input type="radio" checked={pilihanPaparan === 'hamba_allah'} onChange={() => setPilihanPaparan('hamba_allah')} /> Hamba Allah
                    </label>
                  </div>
                  <p className={NOTA_KELAS}>
                    Identiti sebenar tetap direkodkan oleh Adjung untuk tujuan semakan dalaman dan
                    tidak akan dipaparkan jika pilihan Hamba Allah digunakan.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={LABEL_KELAS} htmlFor="mp-org">Nama organisasi *</label>
                    <input id="mp-org" type="text" className={INPUT_KELAS} value={namaOrganisasi} onChange={(e) => setNamaOrganisasi(e.target.value)} maxLength={150} />
                  </div>
                  <div>
                    <label className={LABEL_KELAS} htmlFor="mp-wakil">Nama wakil *</label>
                    <input id="mp-wakil" type="text" className={INPUT_KELAS} value={namaWakil} onChange={(e) => setNamaWakil(e.target.value)} maxLength={120} />
                  </div>
                  <div>
                    <label className={LABEL_KELAS} htmlFor="mp-laman">Laman web / media sosial rasmi</label>
                    <input id="mp-laman" type="text" className={INPUT_KELAS} value={lamanRasmi} onChange={(e) => setLamanRasmi(e.target.value)} maxLength={300} placeholder="https:// (atau taip &quot;Tiada&quot;)" />
                  </div>
                  <div>
                    <label className={LABEL_KELAS} htmlFor="mp-daftar">No. pendaftaran (jika berkenaan)</label>
                    <input id="mp-daftar" type="text" className={INPUT_KELAS} value={noPendaftaran} onChange={(e) => setNoPendaftaran(e.target.value)} maxLength={60} />
                  </div>
                </div>
                <div>
                  <label className={LABEL_KELAS} htmlFor="mp-aktiviti">Bidang/aktiviti utama organisasi *</label>
                  <input id="mp-aktiviti" type="text" className={INPUT_KELAS} value={aktivitiUtama} onChange={(e) => setAktivitiUtama(e.target.value)} maxLength={200} />
                </div>
                <div>
                  <label className={LABEL_KELAS} htmlFor="mp-terang">Terangkan secara ringkas produk atau perkhidmatan utama</label>
                  <textarea id="mp-terang" className={`${INPUT_KELAS} min-h-[70px]`} value={penerangan} onChange={(e) => setPenerangan(e.target.value)} maxLength={300} />
                </div>
              </>
            )}

            <div>
              <label className={LABEL_KELAS} htmlFor="mp-emel">E-mel *</label>
              <input id="mp-emel" type="email" className={INPUT_KELAS} value={emel} onChange={(e) => setEmel(e.target.value)} maxLength={160} placeholder="nama@contoh.com" />
              <p className={NOTA_KELAS}>Semua urusan seterusnya (keputusan, arahan bayaran) akan dibuat melalui e-mel ini.</p>
            </div>

            <div>
              <label className={LABEL_KELAS} htmlFor="mp-pakej">Pilihan penajaan yang diminati / anggaran tempoh</label>
              <input id="mp-pakej" type="text" className={INPUT_KELAS} value={pilihanTajaan} onChange={(e) => setPilihanTajaan(e.target.value)} maxLength={200} placeholder="Contoh: 1 bulan" />
            </div>

            <div>
              <label className={LABEL_KELAS} htmlFor="mp-catatan">Catatan tambahan (pilihan)</label>
              <textarea id="mp-catatan" className={`${INPUT_KELAS} min-h-[60px]`} value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={800} />
            </div>

            {/* Honeypot */}
            <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
              <label htmlFor="mp-laman-honeypot">Laman web</label>
              <input id="mp-laman-honeypot" type="text" tabIndex={-1} autoComplete="off" value={laman} onChange={(e) => setLaman(e.target.value)} />
            </div>

            <p className="font-sans text-[11px] text-stone-500">
              Dengan menghantar borang ini, anda mengesahkan maklumat yang diberikan adalah benar
              dan memahami bahawa permohonan ini tertakluk kepada Dasar Penajaan Adjung serta
              semakan dan kelulusan Adjung Brief. Penajaan tidak memberikan hak untuk menentukan,
              menyemak atau mempengaruhi keputusan dan kandungan editorial Adjung Brief.
            </p>

            {ralat && (
              <p className="font-sans text-xs text-[#a8241f] border border-red-200 bg-red-50 rounded px-3 py-2">{ralat}</p>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit" disabled={menghantar}
                className="shrink-0 font-sans text-sm font-semibold bg-[#802334] text-white px-6 py-2.5 rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-wait transition-opacity cursor-pointer"
              >
                {menghantar ? 'Menghantar…' : 'Hantar Permohonan'}
              </button>
            </div>
          </form>
        )}
      </main>

      <footer className="w-full max-w-2xl mx-auto px-6 pb-10">
        <p className="font-mono text-[9px] tracking-widest text-stone-400 uppercase font-bold">{BRAND.copyright}</p>
      </footer>
    </div>
  );
};

export default HalamanMohonPenaja;
