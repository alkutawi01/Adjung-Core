import React, { useState } from 'react';
import { Search, Construction, FolderOpen, X, Pencil } from 'lucide-react';
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
  role: 'Ketua Editor' | 'Timbalan Ketua Editor' | 'Editor';
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
  const [subTab, setSubTab] = useState<'senarai' | 'carta'>('senarai');
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMandat, setEditingMandat] = useState(false);
  const [mandatInput, setMandatInput] = useState('');

  const [staffList, setStaffList] = useState<StaffProfile[]>([
    {
      id: 'ED-001',
      fullName: 'Izzat Anas',
      role: 'Ketua Editor',
      status: 'Aktif',
      desk: 'Utama & Pengurusan',
      joinDate: '2026-01-01',
      email: 'chief@adjung.my',
      accountCreated: '2026-01-01',
      skop: 'Semua Desk & Polisi',
      slotMandat: 'Slot 0 (HERO) - Slot 37',
      countProvided: 142,
      countEdited: 98,
      countPublished: 85,
      history: [{ date: '2026-01-01', event: 'Pelantikan Ketua Editor Rasmi' }],
      permissions: { view: 'Full', edit: 'Full', publish: 'Full', assignSlot: 'Full', manageSettings: 'Full' }
    },
    {
      id: 'ED-002',
      fullName: 'Timbalan Editor Brief',
      role: 'Timbalan Ketua Editor',
      status: 'Aktif',
      desk: 'Semakan & Kualiti',
      joinDate: '2026-02-01',
      email: 'deputy@adjung.my',
      accountCreated: '2026-02-01',
      skop: 'Semakan Kandungan Pukal',
      slotMandat: 'Slot 1 - Slot 10',
      countProvided: 64,
      countEdited: 120,
      countPublished: 40,
      history: [{ date: '2026-02-01', event: 'Pelantikan Timbalan Ketua Editor' }],
      permissions: { view: 'Full', edit: 'Full', publish: 'Full', assignSlot: 'Restricted', manageSettings: 'Read-only' }
    },
    {
      id: 'ED-003',
      fullName: 'Editor Berita Semasa',
      role: 'Editor',
      status: 'Aktif',
      desk: 'Nasional & Politik',
      joinDate: '2026-03-01',
      email: 'editor@adjung.my',
      accountCreated: '2026-03-01',
      skop: 'Desk Semasa & Ekonomi',
      slotMandat: 'Slot 11 - Slot 20',
      countProvided: 90,
      countEdited: 45,
      countPublished: 30,
      history: [{ date: '2026-03-01', event: 'Pendaftaran Editor Desk' }],
      permissions: { view: 'Full', edit: 'Mandated Slots', publish: 'Review Needed', assignSlot: 'None', manageSettings: 'None' }
    }
  ]);

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
    <div className="space-y-6 font-sans bg-[#FDFDFD] text-[#1F1F1F]">
      {/* Editorial Header Banner */}
      <div className="pb-4 border-b border-stone-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-900">
            Direktori Anggota Editorial
          </h2>
          <p className="text-xs text-stone-500 font-sans mt-0.5">
            Senarai rasmi staf, editor, dan pentadbir sistem Adjung Brief.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs font-medium">
          <button
            onClick={() => setSubTab('senarai')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              subTab === 'senarai' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Senarai Anggota ({staffList.length})
          </button>
          <button
            onClick={() => setSubTab('carta')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              subTab === 'carta' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Carta Organisasi (3 Tingkat)
          </button>
        </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari anggota, ID, atau desk..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded pl-8 pr-3 py-1.5 font-sans text-xs w-64 focus:outline-none focus:border-[#802334]"
            />
          </div>

          {currentUserRole === 'KETUA_EDITOR' && (
            <Tooltip text="Belum dibina — tiada sistem akaun pengguna berbilang lagi">
              <span
                className="inline-flex items-center gap-1.5 bg-stone-100 text-stone-400 font-mono text-xs px-3 py-1.5 rounded font-semibold border border-stone-200 cursor-not-allowed"
              >
                <Construction className="w-3.5 h-3.5" />
                + TAMBAH ANGGOTA
              </span>
            </Tooltip>
          )}
        </div>

      {/* SUBTAB 2: CARTA ORGANISASI (3 TINGKAT) */}
      {subTab === 'carta' && (
        <div className="space-y-6">
          <div className="p-4 border border-stone-200 rounded-xl bg-white space-y-4">
            <h3 className="font-serif font-bold text-sm text-stone-900 border-b border-stone-200 pb-2">
              Carta Organisasi Newsroom Adjung Brief (Canonical 3-Tier Model)
            </h3>
            
            <div className="space-y-4">
              {/* TIER 1: KETUA EDITOR */}
              <div className="p-4 border-2 border-[#802334] rounded-xl bg-[#802334]/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#802334] bg-white px-2 py-0.5 rounded border border-[#802334]">
                    Tingkat 1 · Ketua Editor (Chief Editor / System Admin)
                  </span>
                  <span className="text-[11px] font-mono text-stone-500">Kuasa Mutlak Sistem</span>
                </div>
                {staffList.filter(s => s.role === 'Ketua Editor').map(s => (
                  <div key={s.id} className="p-3 bg-white border border-stone-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-serif font-bold text-stone-900 text-sm">{s.fullName} ({s.id})</div>
                      <div className="text-xs text-stone-500 font-sans">{s.desk} · {s.email}</div>
                    </div>
                    <span className="px-2 py-0.5 bg-[#802334] text-white text-[10px] font-bold rounded">
                      Mandat: {s.slotMandat}
                    </span>
                  </div>
                ))}
              </div>

              {/* TIER 2: TIMBALAN KETUA EDITOR */}
              <div className="p-4 border border-amber-300 rounded-xl bg-amber-50/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-300">
                    Tingkat 2 · Timbalan Ketua Editor (Senior Editor)
                  </span>
                  <span className="text-[11px] font-mono text-stone-500">Kelulusan & Semakan Pukal</span>
                </div>
                {staffList.filter(s => s.role === 'Timbalan Ketua Editor').map(s => (
                  <div key={s.id} className="p-3 bg-white border border-stone-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-serif font-bold text-stone-900 text-sm">{s.fullName} ({s.id})</div>
                      <div className="text-xs text-stone-500 font-sans">{s.desk} · {s.email}</div>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold rounded">
                      Mandat: {s.slotMandat}
                    </span>
                  </div>
                ))}
              </div>

              {/* TIER 3: EDITOR */}
              <div className="p-4 border border-stone-300 rounded-xl bg-stone-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-700 bg-white px-2 py-0.5 rounded border border-stone-300">
                    Tingkat 3 · Editor (Editor & Research Editor)
                  </span>
                  <span className="text-[11px] font-mono text-stone-500">Penyuntingan & Curation Desk</span>
                </div>
                {staffList.filter(s => s.role === 'Editor').map(s => (
                  <div key={s.id} className="p-3 bg-white border border-stone-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-serif font-bold text-stone-900 text-sm">{s.fullName} ({s.id})</div>
                      <div className="text-xs text-stone-500 font-sans">{s.desk} · {s.email}</div>
                    </div>
                    <span className="px-2 py-0.5 bg-stone-100 text-stone-700 border border-stone-300 text-[10px] font-bold rounded">
                      Mandat: {s.slotMandat}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 1: SENARAI ANGGOTA */}
      {subTab === 'senarai' && (
      <div className="w-full">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <thead>
            <tr className="border-b border-stone-300 text-[10px] font-sans uppercase tracking-widest text-stone-400 font-bold">
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
                  <div className="mb-2 flex justify-center">
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <div className="font-bold uppercase tracking-wider text-[11px] mb-1">Direktori Kosong</div>
                  <p className="text-xs max-w-sm mx-auto">
                    Belum ada anggota lain berdaftar — sistem akaun pengguna berbilang belum dibina.
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
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                    staff.status === 'Aktif' ? 'bg-emerald-100 text-emerald-800 font-bold' :
                    staff.status === 'Cuti' ? 'bg-amber-100 text-amber-800 font-bold' :
                    staff.status === 'Tidak Aktif' ? 'bg-red-100 text-red-800 font-bold' : 'bg-stone-900 text-white font-bold'
                  }`}>
                    {staff.status === 'Aktif' && <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />}
                    {staff.status === 'Cuti' && <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />}
                    {staff.status === 'Tidak Aktif' && <span className="inline-block w-2 h-2 rounded-full bg-red-500" />}
                    {staff.status === 'Ditamatkan' && <span className="inline-block w-2 h-2 rounded-full bg-stone-500" />}
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
      )}

      {/* LAPISAN 2: PROFIL ANGGOTA EDITORIAL (DETAIL MODAL) */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FDFDFD] rounded-xl border border-stone-300 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            {/* Profile Modal Header */}
            <div className="flex justify-between items-start border-b border-stone-200 pb-4">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#802334] font-bold block mb-1">
                  PROFIL ANGGOTA EDITORIAL
                </span>
                <h3 className="font-serif text-xl font-bold text-stone-900">
                  {selectedStaff.fullName}
                </h3>
              </div>
              <button onClick={() => setSelectedStaff(null)} className="text-stone-400 hover:text-stone-800 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Maklumat Asas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs bg-stone-50 p-4 rounded border border-stone-200">
              <div><span className="text-stone-500 block text-[9px]">ID STAF</span><strong className="text-stone-900">{selectedStaff.id}</strong></div>
              <div><span className="text-stone-500 block text-[9px]">PERANAN</span><strong className="text-[#802334]">{selectedStaff.role}</strong></div>
              <div><span className="text-stone-500 block text-[9px]">STATUS</span><strong className="text-stone-900">{selectedStaff.status}</strong></div>
              <div><span className="text-stone-500 block text-[9px]">E-MEL</span><strong className="text-stone-900">{selectedStaff.email}</strong></div>
            </div>

            {/* 2. Skop & Slot Mandat */}
            <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                  2. SKOP &amp; SLOT MANDAT
                </h4>
                {currentUserRole === 'KETUA_EDITOR' && !editingMandat && (
                  <button onClick={() => { setEditingMandat(true); setMandatInput(selectedStaff.slotMandat); }} className="text-[#802334] font-semibold text-xs flex items-center gap-1 hover:underline">
                    <Pencil className="w-3.5 h-3.5" /> Kemaskini Mandat
                  </button>
                )}
              </div>

              {editingMandat ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mandatInput}
                    onChange={e => setMandatInput(e.target.value)}
                    className="bg-stone-50 border border-stone-300 rounded px-3 py-1 text-xs font-sans flex-1 font-semibold"
                  />
                  <button onClick={handleSaveMandatInProfile} className="bg-[#3d6b4c] hover:bg-[#2e5239] text-white px-3 py-1 rounded font-semibold text-xs transition-colors cursor-pointer">Simpan</button>
                  <button onClick={() => setEditingMandat(false)} className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-3 py-1 rounded font-semibold text-xs transition-colors cursor-pointer">Batal</button>
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
                <div className="bg-stone-100 p-3 rounded border border-stone-200">
                  <div className="text-2xl font-bold font-serif text-stone-900 font-mono">{selectedStaff.countProvided}</div>
                  <span className="text-stone-500 text-[10px] uppercase font-semibold block mt-1">Kandungan Disediakan</span>
                </div>
                <div className="bg-stone-100 p-3 rounded border border-stone-200">
                  <div className="text-2xl font-bold font-serif text-stone-900 font-mono">{selectedStaff.countEdited}</div>
                  <span className="text-stone-500 text-[10px] uppercase font-semibold block mt-1">Kandungan Disunting</span>
                </div>
                <div className="bg-stone-100 p-3 rounded border border-stone-200">
                  <div className="text-2xl font-bold font-serif text-[#3d6b4c] font-mono">{selectedStaff.countPublished}</div>
                  <span className="text-stone-500 text-[10px] uppercase font-semibold block mt-1">Kandungan Diterbitkan</span>
                </div>
              </div>
            </div>

            {/* 4. Sejarah Status Timeline */}
            <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
              <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                4. SEJARAH STATUS &amp; PERGERAKAN
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
                    className="inline-flex items-center gap-1.5 bg-[#3d6b4c] hover:bg-[#2e5239] text-white px-3 py-1.5 rounded font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    Aktifkan
                  </button>
                  <button
                    onClick={() => handleToggleStatus('Cuti')}
                    className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                    Set Cuti
                  </button>
                  <button
                    onClick={() => handleToggleStatus('Tidak Aktif')}
                    className="inline-flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white px-3 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                    Nyahaktif
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
