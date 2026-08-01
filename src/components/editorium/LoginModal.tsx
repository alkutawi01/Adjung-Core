import React, { useEffect, useState } from 'react';
import { X, Lock } from 'lucide-react';

interface LoginModalProps {
  onClose: () => void;
  // id dibawa sekali (2026-08-01) — "Draf Saya" perlukannya untuk mencari slot yang ditugaskan
  // kepada editor ni (jadual slot_editors berkunci pada users.id, bukan nama pena). `roles`
  // (2026-08-02, Fasa 3) — senarai BERBILANG peranan (pentadbir/ketua_editor/
  // penolong_ketua_editor/editor); `role` legasi dikekalkan untuk paparan sahaja.
  onSuccess: (user: { id: string; username: string; penName: string; email: string; role: string; roles: string[] }, rememberMe: boolean) => void;
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

  // Escape menutup borang — sama seperti klik X atau kawasan gelap di luar.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
      }, rememberMe);
    } catch (err: any) {
      setError('Ralat sambungan: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[#802334]">
            <Lock className="w-4 h-4" />
            <h2 className="text-sm font-bold uppercase tracking-wider">Log Masuk ke Editorium</h2>
          </div>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">ID</label>
            <input
              type="text"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              autoFocus
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#802334]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Kata Laluan</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#802334]"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-stone-300 text-[#802334] w-3.5 h-3.5 cursor-pointer"
            />
            Ingat saya (kekal log masuk pada peranti ini)
          </label>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#802334] text-white text-sm font-semibold py-2 rounded hover:bg-[#6a1c2a] transition-colors disabled:opacity-50"
          >
            {loading ? 'Mengesahkan...' : 'Log Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
};
