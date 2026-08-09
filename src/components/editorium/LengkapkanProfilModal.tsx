import React, { useEffect, useState } from 'react';
import { bacaJsonSelamat } from '../../utils/bacaJson';
import { MesejStatus } from '../common/MesejStatus';
import { renderMarkdownRingkas } from '../../lib/markdownRingkas';
import { useModalFokus } from '../../hooks/useModalFokus';

// Gerbang log masuk PERTAMA (2026-08-05, permintaan Izzat) — "saya nak editor masa daftar
// masuk kali pertama baca dan setuju beberapa syarat dan peraturan", digabung dengan lima
// medan profil wajib yang diminta serentak (Nama Penuh, Kelulusan x3, Negeri Menetap, Nombor
// Telefon) — satu borang onboarding, bukan dua langkah berasingan, sebab kedua-duanya
// data pendaftaran pertama yang sama sekali gus. Modal ni TIDAK BOLEH ditutup/langkau (tiada
// butang X, tiada klik-luar-tutup, tiada Escape) — App.tsx render IA SAHAJA (bukan Editorium/
// frontpage di sebaliknya) selagi `authUser.termaDipersetujuiPada` masih kosong.
interface LengkapkanProfilProps {
  userId: string;
  onSelesai: (patch: Record<string, string>) => void;
}

const MEDAN_PROFIL: { kunci: string; label: string; placeholder: string }[] = [
  { kunci: 'namaPenuh', label: 'Nama Penuh', placeholder: 'Seperti dalam kad pengenalan' },
  { kunci: 'kelulusanKursus', label: 'Kelulusan: Nama Kursus', placeholder: 'cth. Sarjana Muda Komunikasi' },
  { kunci: 'kelulusanUniversiti', label: 'Kelulusan: Universiti', placeholder: 'cth. Universiti Malaya' },
  { kunci: 'kelulusanTahun', label: 'Kelulusan: Tahun Graduasi', placeholder: 'cth. 2022' },
  { kunci: 'negeriMenetap', label: 'Negeri Menetap', placeholder: 'cth. Selangor' },
  { kunci: 'nomborTelefon', label: 'Nombor Telefon', placeholder: 'cth. 012-3456789' },
];

export const LengkapkanProfilModal: React.FC<LengkapkanProfilProps> = ({ userId, onSelesai }) => {
  const [nilai, setNilai] = useState<Record<string, string>>(
    Object.fromEntries(MEDAN_PROFIL.map((m) => [m.kunci, '']))
  );
  const [terma, setTerma] = useState('');
  const [memuatTerma, setMemuatTerma] = useState(true);
  const [bersetuju, setBersetuju] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState('');

  // Fokus terperangkap sahaja (Audit UI/UX §G1) — `onTutup` sengaja `undefined` sebab modal ni
  // gerbang terma wajib, TIDAK BOLEH ditutup dengan Escape/X/klik-luar (lihat nota fail di atas).
  const refModal = React.useRef<HTMLDivElement>(null);
  useModalFokus(refModal, undefined);

  useEffect(() => {
    fetch('/api/pages/syarat-editor')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTerma(d?.content || ''))
      .catch(() => {})
      .finally(() => setMemuatTerma(false));
  }, []);

  const semuaTerisi = MEDAN_PROFIL.every((m) => nilai[m.kunci].trim().length > 0);
  const bolehHantar = semuaTerisi && bersetuju && !menyimpan;

  const hantar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bolehHantar) return;
    setMenyimpan(true);
    setRalat('');
    try {
      const res = await fetch(`/api/system/profile/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nilai, terimaTerma: true }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan profil.');
      onSelesai({ ...nilai, termaDipersetujuiPada: data.user?.termaDipersetujuiPada || new Date().toISOString() });
    } catch (err: any) {
      setRalat(err.message || 'Gagal menyimpan profil.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        ref={refModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lengkapkan-profil-modal-tajuk"
        className="bg-white rounded-lg shadow-2xl border border-stone-300 max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 space-y-4 text-xs font-sans"
      >
        <div className="border-b border-stone-200 pb-3">
          <h2 id="lengkapkan-profil-modal-tajuk" className="font-serif text-lg font-bold text-Adjung-maroon">Lengkapkan Profil &amp; Terima Syarat</h2>
          <p className="text-stone-500 text-[11px] mt-1">
            Sebelum meneruskan ke Editorium, sila lengkapkan butiran di bawah dan baca Syarat &amp; Peraturan
            Editor. Ini hanya perlu sekali sahaja.
          </p>
        </div>

        <form onSubmit={hantar} className="space-y-4">
          <div className="space-y-3">
            <p className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400">Butiran Profil</p>
            {MEDAN_PROFIL.map((m) => (
              <label key={m.kunci} className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-stone-500">{m.label}</span>
                <input
                  type="text"
                  value={nilai[m.kunci]}
                  onChange={(e) => setNilai((p) => ({ ...p, [m.kunci]: e.target.value }))}
                  placeholder={m.placeholder}
                  className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs"
                />
              </label>
            ))}
          </div>

          <div className="space-y-2 border-t border-stone-200 pt-3">
            <p className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400">Syarat &amp; Peraturan Editor</p>
            <div className="bg-stone-50 border border-stone-200 rounded p-3 max-h-48 overflow-y-auto text-[11px] text-stone-700 leading-relaxed space-y-2">
              {memuatTerma ? (
                'Memuatkan…'
              ) : terma ? (
                renderMarkdownRingkas(terma)
              ) : (
                'Syarat belum diisi oleh pentadbiran.'
              )}
            </div>
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bersetuju}
                onChange={(e) => setBersetuju(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer"
              />
              <span className="text-stone-700 text-[11px]">
                Saya telah membaca dan bersetuju dengan Syarat &amp; Peraturan Editor di atas.
              </span>
            </label>
          </div>

          {ralat && (
            <MesejStatus tone="error">{ralat}</MesejStatus>
          )}

          <button
            type="submit"
            disabled={!bolehHantar}
            className="w-full bg-Adjung-maroon text-white px-4 py-2.5 rounded font-semibold text-xs hover:bg-Adjung-maroon-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {menyimpan ? 'Menyimpan…' : 'Sahkan & Teruskan'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LengkapkanProfilModal;
