import React, { useState } from 'react';
import { X } from 'lucide-react';
import { labelUi } from '../../config/istilah';

// Profil Editor (2026-08-01, spesifikasi pemilik projek — aksesori header "Profil editor",
// bukan destinasi sidebar). 2026-08-02: dipermudah atas arahan Izzat — "ni bukan medsos, hanya
// utk rujukan dalaman". Avatar/tandatangan/bio DIBUANG (bukan disorok — medan tu tak bermakna
// untuk portal editorial dalaman, bukan produk sosial). Nama Pena SAHAJA yang kekal di kad kad
// pertama, sebab itulah satu-satunya identiti yang pernah terpapar di luar Editorium (kolofon
// kandungan). Fasa 6b (2026-08-02) tambah tiga borang kelayakan sendiri di bawah — kata laluan,
// username, emel — ketiga-tiganya perlu pengesahan kata laluan SEMASA sebelum simpan, sama corak
// laluan `POST /api/auth/change-password` (Fasa 1) yang jadi rujukan untuk dua yang baharu.
interface ProfilEditor {
  id: string;
  penName: string;
  username: string;
  email: string;
  namaPenuh?: string;
  kelulusanKursus?: string;
  kelulusanUniversiti?: string;
  kelulusanTahun?: string;
  negeriMenetap?: string;
  nomborTelefon?: string;
}

// Butiran profil wajib (2026-08-05, permintaan Izzat) — diisi kali pertama di
// LengkapkanProfilModal.tsx (gerbang log masuk pertama), boleh disunting semula di sini bila-
// bila masa. Tiada pengesahan kata laluan diperlukan (bukan medan sensitif keselamatan,
// berbeza drpd username/emel/kata laluan di bawah).
const MEDAN_BUTIRAN_PROFIL: { kunci: keyof ProfilEditor; label: string }[] = [
  { kunci: 'namaPenuh', label: 'Nama Penuh' },
  { kunci: 'kelulusanKursus', label: 'Kelulusan — Nama Kursus' },
  { kunci: 'kelulusanUniversiti', label: 'Kelulusan — Universiti' },
  { kunci: 'kelulusanTahun', label: 'Kelulusan — Tahun Graduasi' },
  { kunci: 'negeriMenetap', label: 'Negeri Menetap' },
  { kunci: 'nomborTelefon', label: 'Nombor Telefon' },
];

interface ProfilEditorModalProps {
  profil: ProfilEditor;
  onTutup: () => void;
  // Dipanggil selepas simpan berjaya — App.tsx guna ni untuk kemas kini sesi log masuk (nama
  // pena dipapar di header/Editorium), supaya perubahan kelihatan serta-merta tanpa log keluar.
  onKemasKini: (patch: Partial<ProfilEditor>) => void;
}

const HAD_PEN_NAME = 60;

// Sub-borang generik satu medan + kata laluan pengesahan — tiga daripada empat borang di bawah
// (username, emel, kata laluan) berkongsi bentuk yang serupa: medan baharu + kata laluan semasa
// + Simpan. Satu komponen supaya ketiga-tiganya kekal konsisten (bukan tiga salinan JSX).
function BorangPengesahan({
  tajuk,
  labelMedan,
  jenisInput,
  placeholder,
  onSimpan,
  mesejBerjaya,
}: {
  tajuk: string;
  labelMedan: string;
  jenisInput: 'text' | 'email' | 'password';
  placeholder?: string;
  onSimpan: (nilaiBaharu: string, kataLaluanSemasa: string) => Promise<{ ok: boolean; ralat?: string }>;
  mesejBerjaya: string;
}) {
  const [dibuka, setDibuka] = useState(false);
  const [nilaiBaharu, setNilaiBaharu] = useState('');
  const [kataLaluanSemasa, setKataLaluanSemasa] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState('');
  const [mesej, setMesej] = useState('');

  const reset = () => {
    setDibuka(false);
    setNilaiBaharu('');
    setKataLaluanSemasa('');
    setRalat('');
  };

  const hantar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nilaiBaharu.trim() || !kataLaluanSemasa) return;
    setMenyimpan(true);
    setRalat('');
    const hasil = await onSimpan(nilaiBaharu.trim(), kataLaluanSemasa);
    setMenyimpan(false);
    if (hasil.ok) {
      setMesej(mesejBerjaya);
      setTimeout(() => setMesej(''), 2500);
      reset();
    } else {
      setRalat(hasil.ralat || 'Gagal menyimpan.');
    }
  };

  return (
    <div className="border-t border-stone-200 pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">{tajuk}</span>
        {!dibuka && (
          <button
            type="button"
            onClick={() => setDibuka(true)}
            className="text-[10px] font-semibold text-[#802334] hover:underline cursor-pointer"
          >
            Tukar
          </button>
        )}
        {mesej && <span className="text-emerald-700 text-[11px] font-semibold">{mesej}</span>}
      </div>

      {dibuka && (
        <form onSubmit={hantar} className="space-y-2 bg-stone-50 border border-stone-200 rounded p-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500">{labelMedan}</span>
            <input
              type={jenisInput === 'password' ? 'password' : jenisInput}
              value={nilaiBaharu}
              onChange={(e) => setNilaiBaharu(e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              className="bg-white border border-stone-300 rounded px-3 py-1.5 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500">Kata Laluan Semasa</span>
            <input
              type="password"
              value={kataLaluanSemasa}
              onChange={(e) => setKataLaluanSemasa(e.target.value)}
              placeholder="Untuk pengesahan"
              autoComplete="current-password"
              className="bg-white border border-stone-300 rounded px-3 py-1.5 text-xs"
            />
          </label>

          {ralat && (
            <p className="text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 text-[11px]">{ralat}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={reset}
              className="text-stone-500 hover:text-stone-700 text-[11px] font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={menyimpan || !nilaiBaharu.trim() || !kataLaluanSemasa}
              className="bg-[#802334] text-white px-3 py-1.5 rounded font-semibold text-[11px] hover:bg-[#6a1c2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export const ProfilEditorModal: React.FC<ProfilEditorModalProps> = ({ profil, onTutup, onKemasKini }) => {
  const [penName, setPenName] = useState(profil.penName || '');
  const [username, setUsername] = useState(profil.username || '');
  const [email, setEmail] = useState(profil.email || '');
  const [butiran, setButiran] = useState<Record<string, string>>(
    Object.fromEntries(MEDAN_BUTIRAN_PROFIL.map((m) => [m.kunci, profil[m.kunci] || '']))
  );
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState('');
  const [mesej, setMesej] = useState('');

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenyimpan(true);
    setRalat('');
    try {
      const res = await fetch(`/api/system/profile/${profil.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ penName, ...butiran }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan profil.');
      onKemasKini({ penName, ...butiran });
      setMesej(labelUi('toast.profil_disimpan'));
      setTimeout(() => setMesej(''), 2000);
    } catch (err: any) {
      setRalat(err.message || 'Gagal menyimpan profil.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onTutup}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs font-sans"
      >
        <div className="flex justify-between items-center border-b border-stone-200 pb-2">
          <h3 className="font-sans text-xs font-bold text-[#802334] uppercase tracking-wider">Profil Editor</h3>
          <button type="button" onClick={onTutup} className="text-stone-400 hover:text-stone-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        </div>

        <form onSubmit={simpan} className="space-y-3">
          <label className="flex flex-col gap-1">
            <span className="flex justify-between font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
              <span>Nama Pena</span>
              <span className={penName.length > HAD_PEN_NAME ? 'text-red-700' : 'text-stone-400'}>{penName.length}/{HAD_PEN_NAME}</span>
            </span>
            <input
              type="text"
              value={penName}
              onChange={(e) => setPenName(e.target.value)}
              placeholder="Dipaparkan pada kolofon kandungan"
              className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs"
            />
          </label>

          {/* Butiran profil wajib (2026-08-05) — diisi kali pertama semasa log masuk pertama
              (LengkapkanProfilModal.tsx), boleh dikemas kini di sini bila-bila masa. */}
          <div className="border-t border-stone-200 pt-3 space-y-2">
            <p className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400">Butiran Profil</p>
            {MEDAN_BUTIRAN_PROFIL.map((m) => (
              <label key={m.kunci} className="flex flex-col gap-1">
                <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500">{m.label}</span>
                <input
                  type="text"
                  value={butiran[m.kunci] || ''}
                  onChange={(e) => setButiran((p) => ({ ...p, [m.kunci]: e.target.value }))}
                  className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs"
                />
              </label>
            ))}
          </div>

          {ralat && (
            <p className="text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 text-[11px]">{ralat}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            {mesej && <span className="text-emerald-700 text-[11px] font-semibold">{mesej}</span>}
            <button
              type="submit"
              disabled={menyimpan || !penName.trim() || penName.length > HAD_PEN_NAME}
              className="bg-[#802334] text-white px-4 py-1.5 rounded font-semibold text-xs hover:bg-[#6a1c2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {menyimpan ? 'Menyimpan…' : 'Simpan Profil'}
            </button>
          </div>
        </form>

        {/* Kelayakan akaun (Fasa 6b) — kata laluan/username/emel SENDIRI, setiap satu perlu
            pengesahan kata laluan semasa dahulu. Berasingan daripada borang Nama Pena di atas
            sebab laluan API dan risiko keselamatan berbeza (bukan medan paparan semata-mata). */}
        <div className="space-y-3">
          <p className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400 pt-1">Kelayakan Akaun</p>

          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span>Username semasa</span>
            <span className="font-semibold text-stone-700">{username || '—'}</span>
          </div>
          <BorangPengesahan
            tajuk="Tukar Username"
            labelMedan="Username Baharu"
            jenisInput="text"
            placeholder="cth. izzat_editor"
            mesejBerjaya={labelUi('toast.username_ditukar')}
            onSimpan={async (nilaiBaharu, kataLaluanSemasa) => {
              try {
                const res = await fetch('/api/auth/change-username', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ newUsername: nilaiBaharu, currentPassword: kataLaluanSemasa }),
                });
                const data = await res.json();
                if (!res.ok) return { ok: false, ralat: data.error || 'Gagal menukar username.' };
                setUsername(data.username);
                return { ok: true };
              } catch {
                return { ok: false, ralat: 'Gagal menukar username. Semak sambungan rangkaian.' };
              }
            }}
          />

          <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
            <span>Emel semasa</span>
            <span className="font-semibold text-stone-700">{email || '—'}</span>
          </div>
          <BorangPengesahan
            tajuk="Tukar Emel"
            labelMedan="Emel Baharu"
            jenisInput="email"
            placeholder="cth. nama@contoh.com"
            mesejBerjaya={labelUi('toast.emel_ditukar')}
            onSimpan={async (nilaiBaharu, kataLaluanSemasa) => {
              try {
                const res = await fetch('/api/auth/change-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ newEmail: nilaiBaharu, currentPassword: kataLaluanSemasa }),
                });
                const data = await res.json();
                if (!res.ok) return { ok: false, ralat: data.error || 'Gagal menukar emel.' };
                setEmail(data.email);
                return { ok: true };
              } catch {
                return { ok: false, ralat: 'Gagal menukar emel. Semak sambungan rangkaian.' };
              }
            }}
          />

          <BorangPengesahan
            tajuk="Tukar Kata Laluan"
            labelMedan="Kata Laluan Baharu (min. 8 aksara)"
            jenisInput="password"
            placeholder="Kata laluan baharu"
            mesejBerjaya={labelUi('toast.kata_laluan_ditukar')}
            onSimpan={async (nilaiBaharu, kataLaluanSemasa) => {
              try {
                const res = await fetch('/api/auth/change-password', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ newPassword: nilaiBaharu, currentPassword: kataLaluanSemasa }),
                });
                const data = await res.json();
                if (!res.ok) return { ok: false, ralat: data.error || 'Gagal menukar kata laluan.' };
                return { ok: true };
              } catch {
                return { ok: false, ralat: 'Gagal menukar kata laluan. Semak sambungan rangkaian.' };
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ProfilEditorModal;
