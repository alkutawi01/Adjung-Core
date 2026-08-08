import React, { useState } from 'react';
import { X } from 'lucide-react';
import { MesejStatus } from '../common/MesejStatus';
import { KataLaluanInput } from '../common/KataLaluanInput';
import { LABEL_BORANG, INPUT_BORANG } from '../common/gayaKongsi';
import { useModalFokus } from '../../hooks/useModalFokus';

interface LoginModalProps {
  onClose: () => void;
  // id dibawa sekali (2026-08-01) — "Draf Saya" perlukannya untuk mencari slot yang ditugaskan
  // kepada editor ni (jadual slot_editors berkunci pada users.id, bukan nama pena). `roles`
  // (2026-08-02, Fasa 3) — senarai BERBILANG peranan (pentadbir/ketua_editor/
  // penolong_ketua_editor/editor); `role` legasi dikekalkan untuk paparan sahaja.
  onSuccess: (user: { id: string; username: string; penName: string; email: string; role: string; roles: string[]; termaDipersetujuiPada?: string | null }, rememberMe: boolean) => void;
}

// Log masuk Editorium (2026-07-29) — panggil /api/auth/login (core/routes/authRoutes.js,
// jadual `users`, password di-hash scrypt). Gantikan togol kosmetik lama yang tiada pengesahan
// langsung. SATU borang untuk semua orang: peranan (Ketua Editor/Editor/dll) datang daripada
// akaun yang log masuk, bukan daripada borang berasingan setiap peranan — jadi jangan sekali-kali
// namakan borang ni ikut satu peranan tertentu.
export const LoginModal: React.FC<LoginModalProps> = ({ onClose, onSuccess }) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Lupa kata laluan (2026-08-03, Fasa 1) — borang emel ringkas, tukar mod dalam modal yang
  // sama berbanding buka modal/laluan berasingan. Sengaja tak dedahkan sama ada emel wujud
  // (anti-enumeration) — mesej generik SAMA sentiasa dipaparkan, lihat authRoutes.js.
  const [modLupa, setModLupa] = useState(false);
  const [emelLupa, setEmelLupa] = useState('');
  const [mesejLupa, setMesejLupa] = useState('');
  const [menghantarLupa, setMenghantarLupa] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!usernameOrEmail.trim() || !password) {
      setError('Isi ID dan kata laluan.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Log masuk gagal.');
        return;
      }
      onSuccess({
        id: data.user.id,
        username: data.user.username,
        penName: data.user.penName || data.user.username,
        email: data.user.email || '',
        role: data.user.role,
        roles: Array.isArray(data.user.roles) ? data.user.roles : [],
        termaDipersetujuiPada: data.user.termaDipersetujuiPada || null,
      }, rememberMe);
    } catch (err: any) {
      setError('Ralat sambungan: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const hantarLupaKataLaluan = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenghantarLupa(true);
    setMesejLupa('');
    try {
      const res = await fetch('/api/auth/lupa-kata-laluan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emelLupa }),
      });
      const data = await res.json();
      setMesejLupa(data.message || 'Jika emel ini berdaftar, pautan set semula telah dihantar.');
    } catch {
      setMesejLupa('Jika emel ini berdaftar, pautan set semula telah dihantar.');
    } finally {
      setMenghantarLupa(false);
    }
  };

  // Tutup cuma bila mousedown DAN click kedua-duanya bermula pada backdrop — bukan tutup terus
  // atas onClick sahaja (2026-08-07, pepijat Izzat: modal tertutup sendiri bila drag-select teks
  // dalam medan ID/Kata Laluan lalu cursor terkeluar sempadan modal semasa butang tetikus
  // ditekan; mouseup/click tercetus pada backdrop walaupun drag bermula dari dalam modal).
  const mousedownPadaBackdrop = React.useRef(false);

  // Fokus & Escape (2026-08-07, Audit UI/UX §G1/G2/G6) — cangkuk kongsi memerangkap Tab dalam
  // modal, memulangkan fokus kepada pencetus apabila tutup, dan Escape menutup borang (gantikan
  // useEffect manual lama yang buat perkara sama tanpa perangkap fokus).
  const refModal = React.useRef<HTMLDivElement>(null);
  useModalFokus(refModal, onClose);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { mousedownPadaBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && mousedownPadaBackdrop.current) onClose(); }}
    >
      <div
        ref={refModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-tajuk"
        className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Kepala modal (2026-08-07, permintaan Izzat — "align center, buang ikon kunci") — tajuk
            dipusatkan sepenuhnya, bukan dijajar kiri berpasangan dengan ikon; grid 3-lajur supaya
            tajuk betul-betul tengah kotak walau kehadiran butang tutup di kanan (flex
            justify-between cuma tolak ke tepi, tak pusatkan). */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-4">
          <span />
          <h2 id="login-modal-tajuk" className="font-serif text-lg font-bold text-Adjung-maroon text-center">
            {modLupa ? 'Lupa Kata Laluan' : 'Log Masuk ke Editorium'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="justify-self-end text-stone-400 hover:text-stone-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!modLupa ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={LABEL_BORANG}>ID</label>
              <input
                type="text"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                autoFocus
                className={INPUT_BORANG}
              />
            </div>
            <div>
              <label className={LABEL_BORANG}>Kata Laluan</label>
              <KataLaluanInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT_BORANG}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-stone-300 text-Adjung-maroon w-3.5 h-3.5 cursor-pointer"
              />
              Ingat saya (kekal log masuk pada peranti ini)
            </label>

            {error && (
              <MesejStatus tone="error">{error}</MesejStatus>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-Adjung-maroon text-white text-sm font-semibold py-2 rounded hover:bg-Adjung-maroon-dark transition-colors disabled:opacity-50"
            >
              {loading ? 'Mengesahkan...' : 'Log Masuk'}
            </button>

            <button
              type="button"
              onClick={() => { setModLupa(true); setMesejLupa(''); setEmelLupa(usernameOrEmail.includes('@') ? usernameOrEmail : ''); }}
              className="w-full text-center text-xs text-stone-500 hover:text-Adjung-maroon underline underline-offset-2"
            >
              Lupa kata laluan?
            </button>
          </form>
        ) : (
          <form onSubmit={hantarLupaKataLaluan} className="space-y-3">
            <p className="text-xs text-stone-600">
              Masukkan emel akaun anda. Jika berdaftar, pautan set semula kata laluan akan dihantar.
            </p>
            <div>
              <label className={LABEL_BORANG}>Emel</label>
              <input
                type="email"
                value={emelLupa}
                onChange={(e) => setEmelLupa(e.target.value)}
                autoFocus
                className={INPUT_BORANG}
              />
            </div>

            {mesejLupa && (
              <MesejStatus tone="neutral">{mesejLupa}</MesejStatus>
            )}

            <button
              type="submit"
              disabled={menghantarLupa}
              className="w-full bg-Adjung-maroon text-white text-sm font-semibold py-2 rounded hover:bg-Adjung-maroon-dark transition-colors disabled:opacity-50"
            >
              {menghantarLupa ? 'Menghantar...' : 'Hantar Pautan Set Semula'}
            </button>

            <button
              type="button"
              onClick={() => setModLupa(false)}
              className="w-full text-center text-xs text-stone-500 hover:text-Adjung-maroon underline underline-offset-2"
            >
              Kembali ke log masuk
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
