import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BRAND, LOGO_SIZE } from '../../config/brand';
import { KataLaluanInput } from '../common/KataLaluanInput';

// Halaman awam "Tetapkan Kata Laluan" (2026-08-03, Fasa 1) — destinasi SATU pautan
// `/tetapkan-kata-laluan?token=...` dikongsi oleh DUA aliran token emel sebenar:
// jemputan editor baharu (POST /api/system/users, userAdminRoutes.js) dan lupa-kata-laluan
// swadaya (POST /api/auth/lupa-kata-laluan, authRoutes.js). Token itu sendiri (bukan borang ni)
// yang tentukan aliran mana — halaman ni cuma minta kata laluan baharu + sahkan, hantar ke
// POST /api/auth/aktifkan-akaun. Gaya visual sama seperti TidakDijumpai.tsx (maroon #802334,
// serif tajuk) supaya konsisten dengan seluruh laman awam — lihat CLAUDE.md.
//
// Nama Pena/ID Pengguna (2026-08-16, permintaan Izzat) — Ketua Editor tak lagi tetapkan
// identiti ni semasa jemput (cuma emel+peranan); anggota baharu tetapkan sendiri DI SINI sekali
// dengan kata laluan. GET /api/auth/token-info panggil awal (sebelum borang dipapar) untuk tahu
// SAMA ADA token ni jemputan baharu (perlu medan identiti) atau set-semula akaun sedia ada
// (jangan papar/sentuh identiti sedia ada langsung) — lihat perluTetapkanIdentiti(),
// core/auth/TokenLaluan.js.
export const TetapkanKataLaluan: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [sahkan, setSahkan] = useState('');
  const [penName, setPenName] = useState('');
  const [username, setUsername] = useState('');
  const [perluIdentiti, setPerluIdentiti] = useState(false);
  const [semakToken, setSemakToken] = useState(true);
  const [ralat, setRalat] = useState('');
  const [menghantar, setMenghantar] = useState(false);
  const [berjaya, setBerjaya] = useState(false);

  useEffect(() => {
    if (!token) { setSemakToken(false); return; }
    fetch(`/api/auth/token-info?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setPerluIdentiti(!!d.requiresIdentity))
      .catch(() => {})
      .finally(() => setSemakToken(false));
  }, [token]);

  const hantar = async (e: React.FormEvent) => {
    e.preventDefault();
    setRalat('');
    if (!token) {
      setRalat('Pautan ini tidak sah, token tiada.');
      return;
    }
    if (perluIdentiti && (!penName.trim() || !username.trim())) {
      setRalat('Nama pena dan ID pengguna diperlukan.');
      return;
    }
    if (password.length < 8) {
      setRalat('Kata laluan mesti sekurang-kurangnya 8 aksara.');
      return;
    }
    if (password !== sahkan) {
      setRalat('Kata laluan dan sahkan kata laluan tidak sepadan.');
      return;
    }
    setMenghantar(true);
    try {
      const res = await fetch('/api/auth/aktifkan-akaun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perluIdentiti ? { token, password, penName, username } : { token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRalat(data.error || 'Gagal menetapkan kata laluan.');
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
    <div className="min-h-screen bg-[#802334] text-[#FDFDFD] flex flex-col items-center justify-center px-6 select-none">
      <div className="max-w-sm w-full flex flex-col items-center text-center space-y-4">
        <span className={`font-serif ${LOGO_SIZE.gate} font-semibold tracking-wider text-[#FDFDFD]`}>
          {BRAND.logoText}
        </span>
        <h1 className="font-serif text-lg md:text-xl font-normal tracking-tight">
          Tetapkan Kata Laluan
        </h1>

        {!token && (
          <>
            <p className="font-serif text-stone-200 text-[13px] md:text-[14px] tracking-wide">
              Pautan ini tidak sah — tiada token dijumpai. Sila guna pautan penuh daripada e-mel anda.
            </p>
            <Link
              to="/"
              className="mt-2 font-sans text-xs font-semibold bg-[#FDFDFD] text-[#802334] px-4 py-2 rounded hover:bg-stone-100 transition-colors"
            >
              Kembali ke Laman Utama
            </Link>
          </>
        )}

        {token && berjaya && (
          <>
            <p className="font-serif text-stone-200 text-[13px] md:text-[14px] tracking-wide">
              Kata laluan berjaya ditetapkan. Anda kini boleh log masuk ke Editorium.
            </p>
            <Link
              to="/editorium"
              className="mt-2 font-sans text-xs font-semibold bg-[#FDFDFD] text-[#802334] px-4 py-2 rounded hover:bg-stone-100 transition-colors"
            >
              Ke Editorium
            </Link>
          </>
        )}

        {token && !berjaya && semakToken && (
          <p className="font-serif text-stone-200 text-[13px] md:text-[14px] tracking-wide">Memuatkan…</p>
        )}

        {token && !berjaya && !semakToken && (
          <form onSubmit={hantar} className="w-full text-left space-y-3 select-text">
            {perluIdentiti && (
              <>
                <p className="font-serif text-stone-200 text-[12px] md:text-[13px] tracking-wide -mt-1 mb-1">
                  Tetapkan nama pena dan ID pengguna anda sebelum meneruskan.
                </p>
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-wider font-bold text-stone-200 mb-1">
                    Nama Pena
                  </label>
                  <input
                    type="text"
                    value={penName}
                    onChange={(e) => setPenName(e.target.value)}
                    autoFocus
                    className="w-full rounded px-3 py-2 text-sm text-stone-900 bg-[#FDFDFD] focus:outline-none focus:ring-2 focus:ring-white"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-wider font-bold text-stone-200 mb-1">
                    ID Pengguna
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded px-3 py-2 text-sm text-stone-900 bg-[#FDFDFD] focus:outline-none focus:ring-2 focus:ring-white"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-wider font-bold text-stone-200 mb-1">
                Kata Laluan Baharu
              </label>
              <KataLaluanInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                autoFocus={!perluIdentiti}
                className="w-full rounded px-3 py-2 text-sm text-stone-900 bg-[#FDFDFD] focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-wider font-bold text-stone-200 mb-1">
                Sahkan Kata Laluan
              </label>
              <KataLaluanInput
                value={sahkan}
                onChange={(e) => setSahkan(e.target.value)}
                minLength={8}
                className="w-full rounded px-3 py-2 text-sm text-stone-900 bg-[#FDFDFD] focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>

            {ralat && (
              <div className="text-xs text-red-100 bg-red-900/40 border border-red-300/50 rounded px-3 py-2">
                {ralat}
              </div>
            )}

            <button
              type="submit"
              disabled={menghantar}
              className="w-full font-sans text-xs font-semibold bg-[#FDFDFD] text-[#802334] py-2 rounded hover:bg-stone-100 transition-colors disabled:opacity-50"
            >
              {menghantar ? 'Menyimpan…' : 'Tetapkan Kata Laluan'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
