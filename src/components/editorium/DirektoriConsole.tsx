import React, { useState } from 'react';
import { Tooltip } from '../common/Tooltip';

const formatTitleCase = (str: string) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface StaffProfile {
  id: string;
  fullName: string;
  role: 'Ketua Editor' | 'Editor';
  status: 'Aktif' | 'Cuti' | 'Tidak Aktif' | 'Ditamatkan';
  desk: string;
  joinDate: string;
  endDate?: string;
  email: string;
  accountCreated: string;

  // Mandat Editorial
  skop: string;
  slotMandat: string;

  // Aktiviti
  countProvided: number;
  countEdited: number;
  countPublished: number;

  // Sejarah Status Timeline
  history: Array<{ date: string; event: string }>;

  // Matriks Permission RBAC
  permissions: {
    view: string;
    edit: string;
    publish: string;
    assignSlot: string;
    manageSettings: string;
  };
}

interface DirektoriConsoleProps {
  currentUserRole?: 'KETUA_EDITOR' | 'EDITOR';
}

export const DirektoriConsole: React.FC<DirektoriConsoleProps> = ({
  currentUserRole = 'KETUA_EDITOR'
}) => {
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMandat, setEditingMandat] = useState(false);
  const [mandatInput, setMandatInput] = useState('');

  // No staff-directory table exists in the backend yet -- this console previously showed 4
  // hardcoded fake profiles (Izzat, Ahmad, Ali, Fatimah) with fabricated activity counts and
  // history instead of being honest that there's no real data source here. Empty until a real
  // multi-editor account system exists (see .agents/AGENTS.md -- solo Chief Editor for now).
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);

  const filteredStaff = staffList.filter(s =>
    s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.desk.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveMandatInProfile = () => {
    if (!selectedStaff) return;
    const updated = { ...selectedStaff, slotMandat: mandatInput };
    setSelectedStaff(updated);
    setStaffList(prev => prev.map(s => s.id === updated.id ? updated : s));
    setEditingMandat(false);
  };

  const handleToggleStatus = (newStatus: 'Aktif' | 'Cuti' | 'Tidak Aktif' | 'Ditamatkan') => {
    if (!selectedStaff) return;
    const updated = { ...selectedStaff, status: newStatus };
    setSelectedStaff(updated);
    setStaffList(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  return (
    <div className="space-y-6">
      {/* LAPISAN 1: SENARAI ANGGOTA EDITORIAL */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="font-serif text-base uppercase tracking-wider text-[#802334] font-bold mb-1">
            Direktori Editorial Adjung Brief
          </h2>
          <p className="font-sans text-xs text-stone-600">
            Pusat direktori pasukan editorial. Mengurus rekod keanggotaan, mandat slot, status perkhidmatan, dan matriks RBAC.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="🔍 Cari anggota, ID, atau desk..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 font-serif text-xs w-64"
          />

          {currentUserRole === 'KETUA_EDITOR' && (
            <Tooltip text="Belum dibina -- tiada sistem akaun pengguna berbilang lagi">
              <span
                className="bg-stone-100 text-stone-400 font-mono text-xs px-4 py-2 rounded font-bold border border-stone-200 cursor-not-allowed"
              >
                🚧 + TAMBAH ANGGOTA
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Directory Table List */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <thead>
            <tr className="bg-stone-100 border-b border-stone-200 font-sans text-xs uppercase text-stone-600 font-semibold">
              <th className="p-4">Nama Anggota</th>
              <th className="p-4">ID Pengguna</th>
              <th className="p-4">Peranan</th>
              <th className="p-4">Status</th>
              <th className="p-4">Mandat Editorial</th>
              <th className="p-4">Tarikh Sertai</th>
              <th className="p-4 text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 font-sans">
            {filteredStaff.length === 0 && (
              <tr>
                <td colSpan={7} className="p-12 text-center text-stone-500">
                  <div className="text-2xl mb-2">🗂️</div>
                  <div className="font-bold uppercase tracking-wider text-[11px] mb-1">Direktori Kosong</div>
                  <p className="text-xs max-w-sm mx-auto">
                    Belum ada anggota lain berdaftar -- sistem akaun pengguna berbilang belum dibina.
                    Sekarang hanya Ketua Editor seorang yang beroperasi.
                  </p>
                </td>
              </tr>
            )}
            {filteredStaff.map(staff => (
              <tr key={staff.id} className="hover:bg-stone-50 transition-colors">
                <td className="p-4 font-serif font-bold text-stone-900">{staff.fullName}</td>
                <td className="p-4 text-stone-500 font-mono font-bold text-xs">{staff.id}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-0.5 rounded font-bold text-[10px] ${
                    staff.role === 'Ketua Editor' ? 'bg-[#802334] text-white' : 'bg-stone-200 text-stone-800'
                  }`}>
                    {staff.role}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    staff.status === 'Aktif' ? 'bg-emerald-100 text-emerald-800 font-bold' :
                    staff.status === 'Cuti' ? 'bg-amber-100 text-amber-800 font-bold' :
                    staff.status === 'Tidak Aktif' ? 'bg-red-100 text-red-800 font-bold' : 'bg-stone-900 text-white font-bold'
                  }`}>
                    {staff.status === 'Aktif' && '🟢 '}
                    {staff.status === 'Cuti' && '🟡 '}
                    {staff.status === 'Tidak Aktif' && '🔴 '}
                    {staff.status === 'Ditamatkan' && '⚫ '}
                    {staff.status}
                  </span>
                </td>
                <td className="p-4">
                  <span className="bg-stone-100 border border-stone-200 text-stone-800 px-2 py-0.5 rounded font-semibold text-xs font-sans">
                    {staff.slotMandat}
                  </span>
                </td>
                <td className="p-4 text-stone-500 font-mono text-xs">{staff.joinDate}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => { setSelectedStaff(staff); setEditingMandat(false); }}
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

      {/* LAPISAN 2: PROFIL ANGGOTA EDITORIAL (DETAIL MODAL) */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            {/* Profile Modal Header */}
            <div className="flex justify-between items-start border-b border-stone-200 pb-4">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#802334] font-bold block mb-1">
                  PROFIL ANGGOTA EDITORIAL
                </span>
                <h3 className="font-serif text-xl font-bold text-stone-900">
                  {selectedStaff.fullName}
                </h3>
                <span className="font-mono text-xs text-stone-500">{selectedStaff.id} • {selectedStaff.email}</span>
              </div>
              <button
                onClick={() => setSelectedStaff(null)}
                className="text-stone-400 hover:text-stone-800 text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            {/* 1. Maklumat Identiti */}
            <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
              <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                1. MAKLUMAT IDENTITI
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><span className="text-stone-500 block text-[10px] font-semibold uppercase">Nama Penuh</span><strong className="text-stone-900 font-semibold">{selectedStaff.fullName}</strong></div>
                <div><span className="text-stone-500 block text-[10px] font-semibold uppercase">Peranan</span><strong className="text-[#802334] font-semibold">{selectedStaff.role}</strong></div>
                <div>
                  <span className="text-stone-500 block text-[10px] font-semibold uppercase">Status Perkhidmatan</span>
                  <span className="font-semibold text-emerald-800">{selectedStaff.status}</span>
                </div>
                <div><span className="text-stone-500 block text-[10px] font-semibold uppercase">Tarikh Sertai</span><strong className="font-mono font-bold">{selectedStaff.joinDate}</strong></div>
                <div><span className="text-stone-500 block text-[10px] font-semibold uppercase">Tarikh Berhenti</span><strong className="font-mono font-bold">{selectedStaff.endDate || '-'}</strong></div>
                <div><span className="text-stone-500 block text-[10px] font-semibold uppercase">Akaun Dicipta</span><strong className="font-mono font-bold">{selectedStaff.accountCreated}</strong></div>
              </div>
            </div>

            {/* 2. Mandat Editorial */}
            <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                  2. MANDAT EDITORIAL
                </h4>
                {currentUserRole === 'KETUA_EDITOR' && !editingMandat && (
                  <button
                    onClick={() => { setEditingMandat(true); setMandatInput(selectedStaff.slotMandat); }}
                    className="text-[#802334] hover:underline font-semibold text-xs cursor-pointer"
                  >
                    ✏️ Ubah Mandat
                  </button>
                )}
              </div>

              {editingMandat ? (
                <div className="flex items-center gap-2 bg-white p-2 rounded border border-stone-300">
                  <input
                    type="text"
                    value={mandatInput}
                    onChange={e => setMandatInput(e.target.value)}
                    className="bg-stone-50 border border-stone-300 rounded px-3 py-1 text-xs font-sans flex-1 font-semibold"
                  />
                  <button onClick={handleSaveMandatInProfile} className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 rounded-md font-semibold text-xs transition-colors">Simpan</button>
                  <button onClick={() => setEditingMandat(false)} className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-3 py-1 rounded-md font-semibold text-xs transition-colors">Batal</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-stone-500 block text-[10px] font-semibold uppercase">Skop Desk</span><strong className="text-stone-900 font-semibold">{selectedStaff.skop}</strong></div>
                  <div><span className="text-stone-500 block text-[10px] font-semibold uppercase">Slot Mandat</span><span className="bg-stone-200 text-stone-800 px-2 py-0.5 rounded font-semibold text-xs">{selectedStaff.slotMandat}</span></div>
                </div>
              )}
            </div>

            {/* 3. Ringkasan Aktiviti Kandungan */}
            <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
              <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                3. RINGKASAN AKTIVITI KANDUNGAN
              </h4>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white p-3 rounded border border-stone-200">
                  <div className="text-2xl font-bold font-serif text-stone-900 font-mono">{selectedStaff.countProvided}</div>
                  <span className="text-stone-500 text-[10px] uppercase font-semibold block mt-1">Kandungan Disediakan</span>
                </div>
                <div className="bg-white p-3 rounded border border-stone-200">
                  <div className="text-2xl font-bold font-serif text-stone-900 font-mono">{selectedStaff.countEdited}</div>
                  <span className="text-stone-500 text-[10px] uppercase font-semibold block mt-1">Kandungan Disunting</span>
                </div>
                <div className="bg-white p-3 rounded border border-stone-200">
                  <div className="text-2xl font-bold font-serif text-emerald-800 font-mono">{selectedStaff.countPublished}</div>
                  <span className="text-stone-500 text-[10px] uppercase font-semibold block mt-1">Kandungan Diterbitkan</span>
                </div>
              </div>
            </div>

            {/* 4. Sejarah Status Timeline */}
            <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
              <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                4. SEJARAH STATUS & PERGERAKAN
              </h4>
              <div className="space-y-2">
                {selectedStaff.history.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs border-b border-stone-200 pb-1.5">
                    <span className="text-stone-500 font-mono font-semibold text-xs w-24">{h.date}</span>
                    <span className="text-stone-800 font-semibold">{h.event}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Matriks Permission RBAC */}
            <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
              <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                5. MATRIKS PERMISSION RBAC
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>VIEW: <strong className="text-stone-800 font-semibold">{selectedStaff.permissions.view}</strong></div>
                <div>EDIT: <strong className="text-stone-800 font-semibold">{selectedStaff.permissions.edit}</strong></div>
                <div>PUBLISH: <strong className="text-stone-800 font-semibold">{selectedStaff.permissions.publish}</strong></div>
                <div>ASSIGN SLOT: <strong className="text-stone-800 font-semibold">{selectedStaff.permissions.assignSlot}</strong></div>
              </div>
            </div>

            {/* 6. Tindakan Sensitif (Khusus Ketua Editor) */}
            {currentUserRole === 'KETUA_EDITOR' && (
              <div className="border-t border-stone-200 pt-4 flex flex-wrap justify-between items-center gap-2 font-sans text-xs">
                <span className="text-stone-500 font-semibold text-xs">TINDAKAN SENSITIF KETUA EDITOR:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus('Aktif')}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer"
                  >
                    🟢 Aktifkan
                  </button>
                  <button
                    onClick={() => handleToggleStatus('Cuti')}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer"
                  >
                    🟡 Set Cuti
                  </button>
                  <button
                    onClick={() => handleToggleStatus('Tidak Aktif')}
                    className="bg-red-700 hover:bg-red-800 text-white px-3 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer"
                  >
                    🔴 Nyahaktif
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DirektoriConsole;
