import React, { useEffect, useState } from 'react';
import { Search, Plus, X, Hourglass } from 'lucide-react';

// 2026-08-02 (Fasa 3) — Direktori disambungkan ke data SEBENAR (jadual `users` + `user_roles`,
// core/routes/userAdminRoutes.js). Dahulu staffList array kosong berkod keras, "+ Tambah Anggota"
// hiasan (Tooltip "Belum dibina"), tindakan status/mandat cuma state React tempatan (hilang bila
// muat semula). Medan yang tak pernah ada sumber data sebenar (skop desk per-anggota, "slot
// mandat" bebas teks, sejarah pergerakan timeline) DIBUANG — bukan disorok, sebab tiada jadual
// pun untuk menyimpannya. Peranan editor↔slot sebenar diurus di destinasi Slot (slot_editors),
// bukan di sini.
const ROLE_META: Record<string, { label: string; warna: string }> = {
  pentadbir: { label: 'Pentadbir', warna: 'bg-stone-800 text-white' },
  ketua_editor: { label: 'Ketua Editor', warna: 'bg-[#802334] text-white' },
  penolong_ketua_editor: { label: 'Penolong Ketua Editor', warna: 'bg-amber-700 text-white' },
  editor: { label: 'Editor', warna: 'bg-stone-200 text-stone-800' },
};
const ROLE_ORDER = ['pentadbir', 'ketua_editor', 'penolong_ketua_editor', 'editor'];
const STATUS_SAH = ['Aktif', 'Cuti', 'Tidak Aktif', 'Ditamatkan'] as const;

interface Staff {
  id: string;
  username: string;
  email: string;
  penName: string;
  status: typeof STATUS_SAH[number];
  suspended: boolean;
  createdAt: string;
  updatedAt: string;
  roles: string[];
  countPublished: number;
}

interface DirektoriConsoleProps {
  // 2026-08-02 (Fasa 3) — Direktori domain Pentadbir sahaja (dahulu currentUserRole 'KETUA_EDITOR'
  // vs 'EDITOR', tapi Ketua Editor pun tak automatik dapat akses Direktori lagi melainkan dia
  // turut dilantik Pentadbir — lihat EditoriumView.tsx pemanggil komponen ni).
  isPentadbir?: boolean;
}

export const DirektoriConsole: React.FC<DirektoriConsoleProps> = ({
  isPentadbir = true
}) => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [ralat, setRalat] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tambahTerbuka, setTambahTerbuka] = useState(false);

  const muatSemula = () => {
    setMemuat(true);
    fetch('/api/system/users')
      .then(r => r.json())
      .then(d => { setStaffList(Array.isArray(d) ? d : []); setRalat(''); })
      .catch(() => setRalat('Gagal memuatkan senarai anggota.'))
      .finally(() => setMemuat(false));
  };
  useEffect(muatSemula, []);

  const filteredStaff = staffList.filter(s =>
    s.penName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ubahStatus = async (staff: Staff, status: typeof STATUS_SAH[number]) => {
    try {
      const res = await fetch(`/api/system/users/${staff.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const updated = { ...staff, status };
      setSelectedStaff(updated);
      setStaffList(prev => prev.map(s => s.id === staff.id ? updated : s));
    } catch {
      alert('Gagal mengemas kini status.');
    }
  };

  const togolPeranan = async (staff: Staff, roleId: string) => {
    const roles = staff.roles.includes(roleId)
      ? staff.roles.filter(r => r !== roleId)
      : [...staff.roles, roleId];
    if (roles.length === 0) { alert('Akaun mesti pegang sekurang-kurangnya satu peranan.'); return; }
    try {
      const res = await fetch(`/api/system/users/${staff.id}/roles`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles }),
      });
      if (!res.ok) throw new Error();
      const updated = { ...staff, roles };
      setSelectedStaff(updated);
      setStaffList(prev => prev.map(s => s.id === staff.id ? updated : s));
    } catch {
      alert('Gagal mengemas kini peranan.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="font-serif text-base uppercase tracking-wider text-[#802334] font-bold mb-1">
            Direktori Editorial Adjung Brief
          </h2>
          <p className="font-sans text-xs text-stone-600">
            Pusat direktori pasukan editorial. Mengurus rekod keanggotaan, peranan, dan status perkhidmatan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari anggota, username, atau emel..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-stone-50 border border-stone-300 rounded pl-8 pr-3 py-1.5 font-serif text-xs w-64"
            />
          </div>

          {isPentadbir && (
            <button
              onClick={() => setTambahTerbuka(true)}
              className="inline-flex items-center gap-1.5 bg-[#802334] hover:bg-[#601824] text-white font-mono text-xs px-4 py-2 rounded font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              TAMBAH ANGGOTA
            </button>
          )}
        </div>
      </div>

      {ralat && <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-3 py-2 rounded">{ralat}</div>}

      <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <thead>
            <tr className="bg-stone-100 border-b border-stone-200 font-sans text-xs uppercase text-stone-600 font-semibold">
              <th className="p-4">Nama Anggota</th>
              <th className="p-4">Username</th>
              <th className="p-4">Peranan</th>
              <th className="p-4">Status</th>
              <th className="p-4">Kandungan Diterbitkan</th>
              <th className="p-4">Akaun Dicipta</th>
              <th className="p-4 text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 font-sans">
            {memuat && (
              <tr><td colSpan={7} className="p-12 text-center text-stone-400"><Hourglass className="w-5 h-5 mx-auto mb-2 animate-pulse" />Memuatkan...</td></tr>
            )}
            {!memuat && filteredStaff.length === 0 && (
              <tr>
                <td colSpan={7} className="p-12 text-center text-stone-500">
                  <div className="font-bold uppercase tracking-wider text-[11px] mb-1">Tiada Anggota Sepadan</div>
                </td>
              </tr>
            )}
            {!memuat && filteredStaff.map(staff => (
              <tr key={staff.id} className="hover:bg-stone-50 transition-colors">
                <td className="p-4 font-serif font-bold text-stone-900">{staff.penName}</td>
                <td className="p-4 text-stone-500 font-mono font-bold text-xs">{staff.username}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {staff.roles.map(r => (
                      <span key={r} className={`px-2 py-0.5 rounded font-bold text-[10px] ${ROLE_META[r]?.warna || 'bg-stone-200 text-stone-800'}`}>
                        {ROLE_META[r]?.label || r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                    staff.status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' :
                    staff.status === 'Cuti' ? 'bg-amber-100 text-amber-800' :
                    staff.status === 'Tidak Aktif' ? 'bg-red-100 text-red-800' : 'bg-stone-900 text-white'
                  }`}>
                    {staff.status}
                  </span>
                </td>
                <td className="p-4 text-stone-700 font-mono text-xs">{staff.countPublished}</td>
                <td className="p-4 text-stone-500 font-mono text-xs">{new Date(staff.createdAt).toLocaleDateString('ms-MY')}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => setSelectedStaff(staff)}
                    className="bg-stone-800 hover:bg-stone-900 text-[#E9D8A6] px-3 py-1 rounded font-bold text-[10px] transition-colors"
                  >
                    Lihat Profil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedStaff && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setSelectedStaff(null)}>
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b border-stone-200 pb-4">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#802334] font-bold block mb-1">
                  PROFIL ANGGOTA EDITORIAL
                </span>
                <h3 className="font-serif text-xl font-bold text-stone-900">{selectedStaff.penName}</h3>
                <span className="font-mono text-xs text-stone-500">{selectedStaff.username} • {selectedStaff.email}</span>
              </div>
              <button onClick={() => setSelectedStaff(null)} className="text-stone-400 hover:text-stone-800 px-2 py-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
              <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">MAKLUMAT IDENTITI</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><span className="text-stone-500 block text-[10px] font-semibold uppercase">Nama Pena</span><strong className="text-stone-900 font-semibold">{selectedStaff.penName}</strong></div>
                <div><span className="text-stone-500 block text-[10px] font-semibold uppercase">Status</span><strong className="text-stone-900 font-semibold">{selectedStaff.status}</strong></div>
                <div><span className="text-stone-500 block text-[10px] font-semibold uppercase">Akaun Dicipta</span><strong className="font-mono font-bold">{new Date(selectedStaff.createdAt).toLocaleDateString('ms-MY')}</strong></div>
              </div>
            </div>

            <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
              <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">PERANAN (BOLEH BERBILANG)</h4>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_ORDER.map(roleId => (
                  <label key={roleId} className={`flex items-center gap-2 px-3 py-2 rounded border ${isPentadbir ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'} ${selectedStaff.roles.includes(roleId) ? 'border-[#802334] bg-white' : 'border-stone-200 bg-stone-100'}`}>
                    <input
                      type="checkbox"
                      checked={selectedStaff.roles.includes(roleId)}
                      onChange={() => isPentadbir && togolPeranan(selectedStaff, roleId)}
                      disabled={!isPentadbir}
                      className="rounded border-stone-300 text-[#802334] w-4 h-4"
                    />
                    <span className="font-semibold text-stone-800">{ROLE_META[roleId].label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
              <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">AKTIVITI KANDUNGAN</h4>
              <div className="bg-white p-3 rounded border border-stone-200 text-center max-w-[160px]">
                <div className="text-2xl font-bold font-serif text-emerald-800 font-mono">{selectedStaff.countPublished}</div>
                <span className="text-stone-500 text-[10px] uppercase font-semibold block mt-1">Kandungan Diterbitkan</span>
              </div>
            </div>

            {isPentadbir && (
              <div className="border-t border-stone-200 pt-4 flex flex-wrap justify-between items-center gap-2 font-sans text-xs">
                <span className="text-stone-500 font-semibold text-xs">TUKAR STATUS PERKHIDMATAN:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {STATUS_SAH.map(s => (
                    <button
                      key={s}
                      onClick={() => ubahStatus(selectedStaff, s)}
                      disabled={selectedStaff.status === s}
                      className="inline-flex items-center gap-1.5 bg-stone-700 hover:bg-stone-900 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tambahTerbuka && (
        <TambahAnggotaModal
          onTutup={() => setTambahTerbuka(false)}
          onBerjaya={() => { setTambahTerbuka(false); muatSemula(); }}
        />
      )}
    </div>
  );
};

function TambahAnggotaModal({ onTutup, onBerjaya }: { onTutup: () => void; onBerjaya: () => void }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [penName, setPenName] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<string[]>(['editor']);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState('');

  const togol = (roleId: string) => {
    setRoles(prev => prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]);
  };

  const hantar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenyimpan(true);
    setRalat('');
    try {
      const res = await fetch('/api/system/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, penName, password, roles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mencipta akaun.');
      onBerjaya();
    } catch (err: any) {
      setRalat(err.message || 'Gagal mencipta akaun.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onTutup}>
      <form onSubmit={hantar} onClick={e => e.stopPropagation()} className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-md w-full p-6 space-y-4 text-xs font-sans">
        <div className="flex justify-between items-center border-b border-stone-200 pb-2">
          <h3 className="font-sans text-xs font-bold text-[#802334] uppercase tracking-wider">Tambah Anggota</h3>
          <button type="button" onClick={onTutup} className="text-stone-400 hover:text-stone-600"><X className="w-3.5 h-3.5" /></button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Nama Pena</span>
          <input type="text" value={penName} onChange={e => setPenName(e.target.value)} required className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Username</span>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Emel</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Kata Laluan Awal</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs" />
        </label>

        <div className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Peranan</span>
          <div className="grid grid-cols-2 gap-2">
            {ROLE_ORDER.map(roleId => (
              <label key={roleId} className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer ${roles.includes(roleId) ? 'border-[#802334] bg-stone-50' : 'border-stone-200'}`}>
                <input type="checkbox" checked={roles.includes(roleId)} onChange={() => togol(roleId)} className="rounded border-stone-300 text-[#802334] w-4 h-4" />
                <span className="font-semibold text-stone-800">{ROLE_META[roleId].label}</span>
              </label>
            ))}
          </div>
        </div>

        {ralat && <p className="text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 text-[11px]">{ralat}</p>}

        <div className="flex justify-end pt-1 border-t border-stone-200">
          <button type="submit" disabled={menyimpan || roles.length === 0} className="bg-[#802334] text-white px-4 py-1.5 rounded font-semibold text-xs hover:bg-[#6a1c2a] transition-colors disabled:opacity-50 cursor-pointer">
            {menyimpan ? 'Mencipta...' : 'Cipta Akaun'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default DirektoriConsole;
