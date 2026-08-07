import React, { useEffect, useState } from 'react';
import { Search, Plus, X, Hourglass } from 'lucide-react';
import { StatusBadge, StatusTone } from '../common/StatusBadge';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { Button } from '../common/Button';
import { LABEL_BORANG, INPUT_BORANG, KEPALA_JADUAL, GARIS_BARIS } from '../common/gayaKongsi';

// 2026-08-02 (Fasa 3) — Direktori disambungkan ke data SEBENAR (jadual `users` + `user_roles`,
// core/routes/userAdminRoutes.js). Dahulu staffList array kosong berkod keras, "+ Tambah Anggota"
// hiasan (Tooltip "Belum dibina"), tindakan status/mandat cuma state React tempatan (hilang bila
// muat semula). Medan yang tak pernah ada sumber data sebenar (skop desk per-anggota, "slot
// mandat" bebas teks, sejarah pergerakan timeline) DIBUANG — bukan disorok, sebab tiada jadual
// pun untuk menyimpannya. Peranan editor↔slot sebenar diurus di destinasi Slot (slot_editors),
// bukan di sini.
const ROLE_META: Record<string, { label: string; warna: string }> = {
  pentadbir: { label: 'Pentadbir', warna: 'bg-stone-800 text-white' },
  ketua_editor: { label: 'Ketua Editor', warna: 'bg-Adjung-maroon text-white' },
  penolong_ketua_editor: { label: 'Penolong Ketua Editor', warna: 'bg-amber-700 text-white' },
  editor: { label: 'Editor', warna: 'bg-stone-200 text-stone-800' },
};
const ROLE_ORDER = ['pentadbir', 'ketua_editor', 'penolong_ketua_editor', 'editor'];
const STATUS_SAH = ['Aktif', 'Cuti', 'Tidak Aktif', 'Ditamatkan'] as const;
const STATUS_TONE: Record<typeof STATUS_SAH[number], StatusTone> = {
  Aktif: 'success',
  Cuti: 'warning',
  'Tidak Aktif': 'error',
  Ditamatkan: 'neutral',
};

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
  // Backdrop-click guard untuk dua modal di bawah (lihat LoginModal.tsx, pepijat Izzat
  // 2026-08-07) — kekal false selagi mousedown tak bermula terus pada backdrop.
  const mousedownPadaBackdropStaff = React.useRef(false);
  const mousedownPadaBackdropTamat = React.useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tambahTerbuka, setTambahTerbuka] = useState(false);
  const [mesejBerjaya, setMesejBerjaya] = useState('');
  // Pengesahan "Ditamatkan" (2026-08-05, permintaan Izzat: "adakah kandungan yg berstatus
  // menunggu dan draf masih ada? saya rasa yg arkib sahaja dikekalkan") — tukar status ke
  // Ditamatkan dahulu papar kiraan Draf+Menunggu kepunyaan akaun tu, Pentadbir kena tekan pilihan
  // eksplisit (bukan padam automatik senyap). Kandungan approved/archived TIDAK disentuh.
  const [konfirmasiTamat, setKonfirmasiTamat] = useState<{ staff: Staff; draf: any[]; menunggu: any[] } | null>(null);
  const [memuatKonfirmasi, setMemuatKonfirmasi] = useState(false);
  const [memproses, setMemproses] = useState(false);

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

  // "Ditamatkan" dipintas (bukan terus ubahStatus) — semak dulu Draf+Menunggu kepunyaannya
  // supaya Pentadbir buat keputusan termaklum, bukan terkejut kandungan hilang/tertinggal senyap.
  const klikTamatkan = async (staff: Staff) => {
    setMemuatKonfirmasi(true);
    try {
      const res = await fetch(`/api/system/users/${staff.id}/kandungan-belum-terbit`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyemak kandungan.');
      setKonfirmasiTamat({ staff, draf: data.draf || [], menunggu: data.menunggu || [] });
    } catch (e: any) {
      alert(e.message || 'Gagal menyemak kandungan belum terbit.');
    } finally {
      setMemuatKonfirmasi(false);
    }
  };

  const tamatkanSahaja = async () => {
    if (!konfirmasiTamat) return;
    setMemproses(true);
    try {
      await ubahStatus(konfirmasiTamat.staff, 'Ditamatkan');
      setKonfirmasiTamat(null);
      setMesejBerjaya('Akaun ditamatkan. Draf/Menunggu kepunyaannya dikekalkan.');
    } finally {
      setMemproses(false);
    }
  };

  const tamatkanDanPadam = async () => {
    if (!konfirmasiTamat) return;
    setMemproses(true);
    try {
      await ubahStatus(konfirmasiTamat.staff, 'Ditamatkan');
      const res = await fetch(`/api/system/users/${konfirmasiTamat.staff.id}/kandungan-belum-terbit/padam`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memadam kandungan.');
      setKonfirmasiTamat(null);
      setMesejBerjaya(`Akaun ditamatkan. ${data.drafDipadam} draf dan ${data.menungguDipadam} kandungan menunggu dipadam.`);
    } catch (e: any) {
      alert(e.message || 'Gagal memadam kandungan belum terbit.');
    } finally {
      setMemproses(false);
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
      <ModulTajuk
        tajuk="Direktori Editorial Adjung Brief"
        huraian="Pusat direktori pasukan editorial. Mengurus rekod keanggotaan, peranan, dan status perkhidmatan."
        tindakan={
          <>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <input
                type="text"
                placeholder="Cari anggota, username, atau emel..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`${INPUT_BORANG} pl-8 w-64`}
              />
            </div>

            {isPentadbir && (
              <Button onClick={() => setTambahTerbuka(true)} icon={<Plus className="w-3.5 h-3.5" />}>
                TAMBAH ANGGOTA
              </Button>
            )}
          </>
        }
      />

      {ralat && <MesejStatus tone="error">{ralat}</MesejStatus>}

      <PanelCard padding="p-0">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <thead>
            <tr className={`border-b border-stone-200 ${KEPALA_JADUAL}`}>
              <th className="p-4">Nama Anggota</th>
              <th className="p-4">ID Pengguna</th>
              <th className="p-4">Peranan</th>
              <th className="p-4">Status</th>
              <th className="p-4">Kandungan Diterbitkan</th>
              <th className="p-4">Akaun Dicipta</th>
              <th className="p-4 text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody className="font-sans">
            {memuat && (
              <tr><td colSpan={7} className="p-12 text-center text-stone-400"><Hourglass className="w-5 h-5 mx-auto mb-2 animate-pulse" />Memuatkan...</td></tr>
            )}
            {!memuat && filteredStaff.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <KeadaanKosong>Tiada Anggota Sepadan</KeadaanKosong>
                </td>
              </tr>
            )}
            {!memuat && filteredStaff.map(staff => (
              <tr key={staff.id} className={`hover:bg-stone-50 transition-colors ${GARIS_BARIS}`}>
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
                  <StatusBadge tone={STATUS_TONE[staff.status]} label={staff.status} />
                </td>
                <td className="p-4 text-stone-700 font-mono text-xs">{staff.countPublished}</td>
                <td className="p-4 text-stone-500 font-mono text-xs">{new Date(staff.createdAt).toLocaleDateString('ms-MY')}</td>
                <td className="p-4 text-right">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedStaff(staff)}>
                    Lihat Profil
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </PanelCard>

      {selectedStaff && (
        // Tutup cuma bila mousedown DAN click kedua-duanya pada backdrop (lihat LoginModal.tsx,
        // pepijat Izzat 2026-08-07: drag-select teks dalam modal + lepas tetikus di luar modal
        // tak patut tutup modal).
        <div
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onMouseDown={(e) => { mousedownPadaBackdropStaff.current = e.target === e.currentTarget; }}
          onClick={(e) => { if (e.target === e.currentTarget && mousedownPadaBackdropStaff.current) setSelectedStaff(null); }}
        >
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b border-stone-200 pb-4">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-Adjung-maroon font-bold block mb-1">
                  PROFIL ANGGOTA EDITORIAL
                </span>
                {/* Tajuk modal piawai (Pelan 01 Fasa D2): serif-lg maroon, bukan stone-900. */}
                <h3 className="font-serif text-lg font-bold text-Adjung-maroon">{selectedStaff.penName}</h3>
                <span className="font-mono text-xs text-stone-500">{selectedStaff.username} • {selectedStaff.email}</span>
              </div>
              <button onClick={() => setSelectedStaff(null)} className="text-stone-400 hover:text-stone-700 px-2 py-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
              <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">MAKLUMAT IDENTITI</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><span className="text-stone-500 block text-[10px] font-semibold uppercase">Nama Pena</span><strong className="text-stone-900 font-semibold">{selectedStaff.penName}</strong></div>
                <div><span className="text-stone-500 block text-[10px] font-semibold uppercase mb-1">Status</span><StatusBadge tone={STATUS_TONE[selectedStaff.status]} label={selectedStaff.status} /></div>
                <div><span className="text-stone-500 block text-[10px] font-semibold uppercase">Akaun Dicipta</span><strong className="font-mono font-bold">{new Date(selectedStaff.createdAt).toLocaleDateString('ms-MY')}</strong></div>
              </div>
            </div>

            <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
              <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">PERANAN (BOLEH BERBILANG)</h4>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_ORDER.map(roleId => (
                  <label key={roleId} className={`flex items-center gap-2 px-3 py-2 rounded border ${isPentadbir ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'} ${selectedStaff.roles.includes(roleId) ? 'border-Adjung-maroon bg-white' : 'border-stone-200 bg-stone-100'}`}>
                    <input
                      type="checkbox"
                      checked={selectedStaff.roles.includes(roleId)}
                      onChange={() => isPentadbir && togolPeranan(selectedStaff, roleId)}
                      disabled={!isPentadbir}
                      className="rounded border-stone-300 text-Adjung-maroon w-4 h-4"
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
                  {/* "Ditamatkan" ialah tindakan merbahaya — varian `bahaya`, dan pengesahan dua
                      langkah sedia ada (klikTamatkan → modal konfirmasiTamat) dikekalkan. */}
                  {STATUS_SAH.map(s => (
                    <Button
                      key={s}
                      variant={s === 'Ditamatkan' ? 'bahaya' : 'secondary'}
                      size="sm"
                      onClick={() => s === 'Ditamatkan' ? klikTamatkan(selectedStaff) : ubahStatus(selectedStaff, s)}
                      disabled={selectedStaff.status === s || (s === 'Ditamatkan' && memuatKonfirmasi)}
                    >
                      {s === 'Ditamatkan' && memuatKonfirmasi ? 'Menyemak…' : s}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {mesejBerjaya && (
        <MesejStatus tone="success" className="fixed bottom-4 right-4 z-[80] shadow-lg max-w-sm">
          {mesejBerjaya}
          <button type="button" onClick={() => setMesejBerjaya('')} className="ml-3 font-bold cursor-pointer">✕</button>
        </MesejStatus>
      )}

      {tambahTerbuka && (
        <TambahAnggotaModal
          onTutup={() => setTambahTerbuka(false)}
          onBerjaya={(emel: string) => {
            setTambahTerbuka(false);
            muatSemula();
            setMesejBerjaya(`Akaun dicipta. E-mel jemputan telah dihantar ke ${emel} untuk tetapkan kata laluan.`);
          }}
        />
      )}

      {konfirmasiTamat && (
        // Sama corak backdrop-guard — lihat komen di modal selectedStaff atas.
        <div
          className="fixed inset-0 z-[70] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onMouseDown={(e) => { mousedownPadaBackdropTamat.current = e.target === e.currentTarget; }}
          onClick={(e) => { if (e.target === e.currentTarget && mousedownPadaBackdropTamat.current && !memproses) setKonfirmasiTamat(null); }}
        >
          {/* Saiz modal piawai (Pelan 01 Fasa D2): `max-w-sm` untuk pengesahan, `max-w-2xl` untuk
              kandungan/jadual — tiada saiz ketiga. */}
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-sm w-full p-6 space-y-4 text-xs font-sans">
            <h3 className="font-serif text-lg font-bold text-Adjung-maroon border-b border-stone-200 pb-2">
              Tamatkan {konfirmasiTamat.staff.penName || konfirmasiTamat.staff.username}?
            </h3>

            {(konfirmasiTamat.draf.length === 0 && konfirmasiTamat.menunggu.length === 0) ? (
              <p className="text-stone-600 leading-relaxed">
                Tiada draf atau kandungan menunggu kepunyaan akaun ni — selamat ditamatkan.
              </p>
            ) : (
              <>
                <p className="text-stone-600 leading-relaxed">
                  Akaun ni ada <strong className="text-stone-900">{konfirmasiTamat.draf.length} draf</strong> dan{' '}
                  <strong className="text-stone-900">{konfirmasiTamat.menunggu.length} kandungan menunggu</strong> yang
                  belum pernah diterbitkan. Kandungan yang SUDAH diterbitkan (aktif/arkib) tidak terjejas — cuma
                  yang belum terbit ni pilihan awak.
                </p>
                <div className="max-h-32 overflow-y-auto border border-stone-200 rounded divide-y divide-stone-100">
                  {konfirmasiTamat.draf.map((d, i) => (
                    <div key={`draf-${i}`} className="px-3 py-1.5 flex justify-between gap-2">
                      <span className="text-stone-700 truncate">{d.tajuk}</span>
                      <span className="text-stone-400 shrink-0">Draf · Slot {d.slotIndex + 1}</span>
                    </div>
                  ))}
                  {konfirmasiTamat.menunggu.map((m, i) => (
                    <div key={`menunggu-${i}`} className="px-3 py-1.5 flex justify-between gap-2">
                      <span className="text-stone-700 truncate">{m.tajuk}</span>
                      <span className="text-stone-400 shrink-0">Menunggu</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Kaki modal disusun menegak (bukan sebaris) sebab label tindakannya panjang —
                susunan tetap mengikut keutamaan D2: tindakan merbahaya, tindakan biasa, Batal. */}
            <div className="flex flex-col gap-2 pt-2 border-t border-stone-200">
              <Button variant="bahaya" onClick={tamatkanDanPadam} disabled={memproses}>
                {memproses ? 'Memproses…' : 'Tamatkan + Padam draf/menunggu'}
              </Button>
              <Button variant="secondary" onClick={tamatkanSahaja} disabled={memproses}>
                Tamatkan sahaja (kekalkan draf/menunggu)
              </Button>
              <Button variant="ghost" onClick={() => setKonfirmasiTamat(null)} disabled={memproses}>
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function TambahAnggotaModal({ onTutup, onBerjaya }: { onTutup: () => void; onBerjaya: (emel: string) => void }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [penName, setPenName] = useState('');
  const [roles, setRoles] = useState<string[]>(['editor']);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState('');

  const togol = (roleId: string) => {
    setRoles(prev => prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]);
  };

  // 2026-08-03 (Fasa 1) — kata laluan awal DIBUANG dari borang ni: Pentadbir tak lagi memilih
  // kata laluan editor baharu (bocor keselamatan luar talian). Sistem hantar emel jemputan
  // bertoken supaya editor baharu tetapkan kata laluannya sendiri — lihat POST /api/system/users
  // (userAdminRoutes.js) & halaman awam /tetapkan-kata-laluan.
  const hantar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenyimpan(true);
    setRalat('');
    try {
      const res = await fetch('/api/system/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, penName, roles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mencipta akaun.');
      onBerjaya(email);
    } catch (err: any) {
      setRalat(err.message || 'Gagal mencipta akaun.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onTutup}>
      <form onSubmit={hantar} onClick={e => e.stopPropagation()} className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-sm w-full p-6 space-y-4 text-xs font-sans">
        <div className="flex justify-between items-center border-b border-stone-200 pb-2">
          <h3 className="font-serif text-lg font-bold text-Adjung-maroon">Tambah Anggota</h3>
          <button type="button" onClick={onTutup} className="text-stone-400 hover:text-stone-700 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        </div>

        <label className="block">
          <span className={LABEL_BORANG}>Nama Pena</span>
          <input type="text" value={penName} onChange={e => setPenName(e.target.value)} required className={INPUT_BORANG} />
        </label>
        <label className="block">
          <span className={LABEL_BORANG}>ID Pengguna</span>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className={INPUT_BORANG} />
        </label>
        <label className="block">
          <span className={LABEL_BORANG}>Emel</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={INPUT_BORANG} />
        </label>
        <p className="text-[10px] text-stone-500 leading-relaxed">
          Kata laluan tak ditetapkan di sini — e-mel jemputan bertoken akan dihantar ke alamat
          emel di atas supaya anggota baharu menetapkan kata laluannya sendiri.
        </p>

        <div>
          <span className={LABEL_BORANG}>Peranan</span>
          <div className="grid grid-cols-2 gap-2">
            {ROLE_ORDER.map(roleId => (
              <label key={roleId} className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer ${roles.includes(roleId) ? 'border-Adjung-maroon bg-stone-50' : 'border-stone-200'}`}>
                <input type="checkbox" checked={roles.includes(roleId)} onChange={() => togol(roleId)} className="rounded border-stone-300 text-Adjung-maroon w-4 h-4" />
                <span className="font-semibold text-stone-800">{ROLE_META[roleId].label}</span>
              </label>
            ))}
          </div>
        </div>

        {ralat && <MesejStatus tone="error">{ralat}</MesejStatus>}

        <div className="flex justify-end gap-2 pt-1 border-t border-stone-200">
          <Button type="submit" disabled={menyimpan || roles.length === 0}>
            {menyimpan ? 'Mencipta...' : 'Cipta Akaun'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default DirektoriConsole;
