import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND, LOGO_SIZE } from '../../config/brand';

// Halaman awam "Sertai Pasukan Editorial" (2026-08-25, arahan Izzat — modul KIV 14/8 kini
// dibina). Borang permohonan terbuka untuk sesiapa yang mahu menyertai pasukan editor Adjung
// Brief. Reka bentuk mengikut keperluan Izzat 2026-08-16: borang MESTI mengumpul maklumat yang
// cukup untuk Ketua Editor menentukan Bidang/slot yang sesuai bagi calon — khususnya Kelulusan
// dan Bidang minat (dipilih daripada senarai Bidang sebenar sistem, bukan teks bebas) — bukan
// sekadar maklumat hubungan.
//
// Aliran penuh: borang ini -> POST /api/public/permohonan-editor (jadual permohonan_editor)
// -> notifikasi Peti Makluman Ketua Editor -> semakan di Editorium (Direktori -> Permohonan)
// -> Terima mencetuskan jemputan e-mel aliran token sedia ada (pemohon menetapkan ID pengguna,
// nama pena dan kata laluan sendiri di /tetapkan-kata-laluan — corak identiti swadaya 5848178).
//
// Susun atur mengikut HalamanStatik.tsx (halaman cerah, logo header, max-w-2xl) — bukan halaman
// maroon penuh TetapkanKataLaluan.tsx, kerana borang panjang lebih selesa dibaca di latar cerah.

interface BidangAwam {
  id: string;
  name: string;
  slug: string;
}

const INPUT_KELAS =
  'w-full border border-stone-300 rounded px-3 py-2 font-sans text-sm text-stone-800 bg-white focus:outline-none focus:border-[#802334] transition-colors';
const LABEL_KELAS = 'font-sans text-xs font-semibold text-stone-700';
const NOTA_KELAS = 'font-sans text-[11px] text-stone-500 mt-1';

export const HalamanSertai: React.FC = () => {
  const [senaraiBidang, setSenaraiBidang] = useState<BidangAwam[]>([]);

  const [namaPenuh, setNamaPenuh] = useState('');
  const [emel, setEmel] = useState('');
  const [telefon, setTelefon] = useState('');
  const [negeri, setNegeri] = useState('');
  const [kelulusan, setKelulusan] = useState('');
  const [bidangMinat, setBidangMinat] = useState<string[]>([]);
  const [pengalaman, setPengalaman] = useState('');
  const [pautanContoh, setPautanContoh] = useState('');
  const [motivasi, setMotivasi] = useState('');
  // Medan perangkap bot (honeypot) — tersembunyi daripada manusia melalui CSS; borang yang
  // mengisinya ditolak senyap di pelayan. Nama medan sengaja kelihatan "sah" kepada bot.
  const [laman, setLaman] = useState('');

  const [menghantar, setMenghantar] = useState(false);
  const [ralat, setRalat] = useState('');
  const [berjaya, setBerjaya] = useState(false);

  useEffect(() => {
    fetch('/api/system/categories/active')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSenaraiBidang(Array.isArray(d) ? d : []))
      .catch(() => setSenaraiBidang([]));
  }, []);

  const togolBidang = (nama: string) => {
    setBidangMinat((prev) =>
      prev.includes(nama) ? prev.filter((b) => b !== nama) : [...prev, nama]
    );
  };

  const hantar = async (e: React.FormEvent) => {
    e.preventDefault();
    setRalat('');
    if (!namaPenuh.trim() || !emel.trim() || !telefon.trim() || !negeri.trim() || !kelulusan.trim() || !motivasi.trim()) {
      setRalat('Sila lengkapkan semua medan wajib.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emel.trim())) {
      setRalat('Alamat e-mel tidak sah.');
      return;
    }
    if (bidangMinat.length === 0) {
      setRalat('Sila pilih sekurang-kurangnya satu Bidang yang anda berminat untuk menyumbang.');
      return;
    }
    setMenghantar(true);
    try {
      const res = await fetch('/api/public/permohonan-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namaPenuh: namaPenuh.trim(),
          emel: emel.trim(),
          telefon: telefon.trim(),
          negeri: negeri.trim(),
          kelulusan: kelulusan.trim(),
          bidangMinat,
          pengalaman: pengalaman.trim(),
          pautanContoh: pautanContoh.trim(),
          motivasi: motivasi.trim(),
          laman, // honeypot — mesti kosong daripada manusia sebenar
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRalat(data.error || 'Permohonan gagal dihantar. Sila cuba sekali lagi.');
        return;
      }
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
        <Link
          to="/"
          className={`font-serif ${LOGO_SIZE.header} text-[#802334] tracking-tight hover:opacity-80 transition-opacity`}
        >
          {BRAND.logoText}
        </Link>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-serif text-3xl md:text-4xl text-stone-900 font-normal tracking-tight mb-2">
          Sertai Pasukan Editorial
        </h1>
        <p className="font-serif text-[15px] leading-relaxed text-stone-700 mb-8">
          Adjung Brief sentiasa mencari penulis dan penyunting yang menghargai ketelitian bahasa
          dan integriti editorial. Lengkapkan borang di bawah — Ketua Editor akan menyemak setiap
          permohonan dan menghubungi anda melalui e-mel jika permohonan diterima.
        </p>

        {berjaya ? (
          <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-6">
            <h2 className="font-serif text-xl text-emerald-900 mb-2">Permohonan diterima sistem</h2>
            <p className="font-sans text-sm text-emerald-800 leading-relaxed">
              Terima kasih atas minat anda. Permohonan anda telah direkodkan dan akan disemak oleh
              Ketua Editor. Jika permohonan diterima, satu e-mel jemputan akan dihantar kepada
              alamat yang anda berikan untuk melengkapkan pendaftaran akaun.
            </p>
            <Link
              to="/"
              className="inline-block mt-4 font-sans text-xs font-semibold bg-[#802334] text-white px-4 py-2 rounded hover:opacity-90 transition-opacity"
            >
              Kembali ke Laman Utama
            </Link>
          </div>
        ) : (
          <form onSubmit={hantar} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={LABEL_KELAS} htmlFor="sertai-nama">Nama penuh *</label>
                <input id="sertai-nama" type="text" className={INPUT_KELAS} value={namaPenuh} onChange={(e) => setNamaPenuh(e.target.value)} maxLength={120} />
              </div>
              <div>
                <label className={LABEL_KELAS} htmlFor="sertai-emel">E-mel *</label>
                <input id="sertai-emel" type="email" className={INPUT_KELAS} value={emel} onChange={(e) => setEmel(e.target.value)} maxLength={160} />
              </div>
              <div>
                <label className={LABEL_KELAS} htmlFor="sertai-telefon">Nombor telefon *</label>
                <input id="sertai-telefon" type="tel" className={INPUT_KELAS} value={telefon} onChange={(e) => setTelefon(e.target.value)} maxLength={30} />
              </div>
              <div>
                <label className={LABEL_KELAS} htmlFor="sertai-negeri">Negeri menetap *</label>
                <input id="sertai-negeri" type="text" className={INPUT_KELAS} value={negeri} onChange={(e) => setNegeri(e.target.value)} maxLength={60} />
              </div>
            </div>

            <div>
              <label className={LABEL_KELAS} htmlFor="sertai-kelulusan">Kelulusan *</label>
              <input id="sertai-kelulusan" type="text" className={INPUT_KELAS} value={kelulusan} onChange={(e) => setKelulusan(e.target.value)} maxLength={200} placeholder="Contoh: Sarjana Muda Komunikasi, Universiti Malaya, 2022" />
              <p className={NOTA_KELAS}>Nama kursus, universiti dan tahun graduasi.</p>
            </div>

            <div>
              <span className={LABEL_KELAS}>Bidang yang anda berminat untuk menyumbang *</span>
              <p className={NOTA_KELAS}>Pilih satu atau lebih. Maklumat ini membantu Ketua Editor menentukan slot yang sesuai untuk anda.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {senaraiBidang.length === 0 && (
                  <span className="font-sans text-xs text-stone-400">Memuatkan senarai Bidang…</span>
                )}
                {senaraiBidang.map((b) => {
                  const dipilih = bidangMinat.includes(b.name);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => togolBidang(b.name)}
                      aria-pressed={dipilih}
                      className={`px-3 py-1.5 rounded-full border font-sans text-xs font-semibold transition-colors cursor-pointer ${
                        dipilih
                          ? 'bg-[#802334] border-[#802334] text-white'
                          : 'bg-white border-stone-300 text-stone-600 hover:border-[#802334] hover:text-[#802334]'
                      }`}
                    >
                      {b.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={LABEL_KELAS} htmlFor="sertai-pengalaman">Pengalaman penulisan (jika ada)</label>
              <textarea id="sertai-pengalaman" className={`${INPUT_KELAS} min-h-[80px]`} value={pengalaman} onChange={(e) => setPengalaman(e.target.value)} maxLength={1000} placeholder="Ceritakan secara ringkas pengalaman menulis, menyunting atau menerbit anda." />
            </div>

            <div>
              <label className={LABEL_KELAS} htmlFor="sertai-pautan">Pautan contoh penulisan (jika ada)</label>
              <input id="sertai-pautan" type="url" className={INPUT_KELAS} value={pautanContoh} onChange={(e) => setPautanContoh(e.target.value)} maxLength={300} placeholder="https://" />
              <p className={NOTA_KELAS}>Blog, portfolio, artikel yang pernah diterbitkan, atau dokumen awam.</p>
            </div>

            <div>
              <label className={LABEL_KELAS} htmlFor="sertai-motivasi">Mengapa anda mahu menyertai Adjung Brief? *</label>
              <textarea id="sertai-motivasi" className={`${INPUT_KELAS} min-h-[100px]`} value={motivasi} onChange={(e) => setMotivasi(e.target.value)} maxLength={1500} />
            </div>

            {/* Honeypot — disorok daripada manusia; bot yang mengisi medan ini ditolak pelayan. */}
            <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
              <label htmlFor="sertai-laman">Laman web</label>
              <input id="sertai-laman" type="text" tabIndex={-1} autoComplete="off" value={laman} onChange={(e) => setLaman(e.target.value)} />
            </div>

            {ralat && (
              <p className="font-sans text-xs text-[#a8241f] border border-red-200 bg-red-50 rounded px-3 py-2">{ralat}</p>
            )}

            <div className="flex items-center justify-between gap-4 pt-2">
              <p className="font-sans text-[11px] text-stone-500 max-w-sm">
                Dengan menghantar borang ini, anda bersetuju maklumat di atas digunakan untuk
                tujuan semakan permohonan sahaja, tertakluk kepada <Link to="/polisi-privasi" className="underline hover:text-[#802334]">Polisi Privasi</Link> kami.
              </p>
              <button
                type="submit"
                disabled={menghantar}
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

export default HalamanSertai;
