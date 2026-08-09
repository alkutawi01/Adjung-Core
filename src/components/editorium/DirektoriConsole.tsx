import React, { useEffect, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { StatusBadge, StatusTone } from '../common/StatusBadge';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { KeadaanMemuat } from '../common/KeadaanMemuat';
import { Button } from '../common/Button';
import { LABEL_BORANG, INPUT_BORANG, KEPALA_JADUAL, GARIS_BARIS } from '../common/gayaKongsi';
import { EditorDialog } from '../common/EditorDialog';
import { useAmaranBelumSimpan } from '../../hooks/useAmaranBelumSimpan';

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
  // Pautan konteks ke Slot (TEAM-01, audit ChatGPT 2026-08-08, "Cara A" — kelulusan Izzat) —
  // agihan editor↔slot SEBENAR diurus di destinasi Slot (lihat nota atas), bukan di sini.
  // Direktori dahulu tiada laluan terus ke sana, jadi Ketua Editor terpaksa teka. Bukan
  // penyusunan semula (RBAC/architecture kekal), sekadar pautan konteks dari profil anggota.
  onTukarTab?: (tabId: string) => void;
  // Toast kongsi Editorium (DIREKTORI-1, audit ChatGPT 2026-08-09) — dahulu Direktori bina
  // toast sendiri (MesejStatus fixed-position + butang tutup manual) sebab tak terima prop
  // ni langsung, dua pelaksanaan toast berbeza wujud serentak dlm aplikasi. Kini guna corak
  // sedia ada IndeksConsole/SlotManagerModal.
  onToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const DirektoriConsole: React.FC<DirektoriConsoleProps> = ({
  isPentadbir = true, onTukarTab, onToast
}) => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [ralat, setRalat] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tambahTerbuka, setTambahTerbuka] = useState(false);
  // Pengesahan "Ditamatkan" (2026-08-05, permintaan Izzat: "adakah kandungan yg berstatus
  // menunggu dan draf masih ada? saya rasa yg arkib sahaja dikekalkan") — tukar status ke
  // Ditamatkan dahulu papar kiraan Draf+Menunggu kepunyaan akaun tu, Pentadbir kena tekan pilihan
  // eksplisit (bukan padam automatik senyap). Kandungan approved/archived TIDAK disentuh.
  const [konfirmasiTamat, setKonfirmasiTamat] = useState<{ staff: Staff; draf: any[]; menunggu: any[] } | null>(null);
  const [memproses, setMemproses] = useState(false);
  // Ralat tindakan tamatkan (Audit UI/UX §E5) — dahulu alert() pelayar mentah, kini kotak ralat
  // dalam aplikasi, dipaparkan terus dalam modal konfirmasi yang mencetuskan tindakan tu.
  const [ralatTamat, setRalatTamat] = useState('');

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

  // Kemas kini rekod staf serentak dalam selectedStaff (jika modal profil masih terbuka pada
  // staf yang sama) dan staffList — dipanggil daripada ProfilAnggotaModal selepas tindakan
  // berjaya (tukar status, togol peranan).
  const kemaskiniStaff = (updated: Staff) => {
    setSelectedStaff(prev => (prev && prev.id === updated.id ? updated : prev));
    setStaffList(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const tamatkanSahaja = async () => {
    if (!konfirmasiTamat) return;
    setMemproses(true);
    setRalatTamat('');
    try {
      const res = await fetch(`/api/system/users/${konfirmasiTamat.staff.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Ditamatkan' }),
      });
      if (!res.ok) throw new Error('Gagal mengemas kini status.');
      kemaskiniStaff({ ...konfirmasiTamat.staff, status: 'Ditamatkan' });
      setKonfirmasiTamat(null);
      onToast?.('success', 'Akaun ditamatkan. Draf/Menunggu kepunyaannya dikekalkan.');
    } catch (e: any) {
      setRalatTamat(e.message || 'Gagal mengemas kini status.');
    } finally {
      setMemproses(false);
    }
  };

  const tamatkanDanPadam = async () => {
    if (!konfirmasiTamat) return;
    setMemproses(true);
    setRalatTamat('');
    try {
      const resStatus = await fetch(`/api/system/users/${konfirmasiTamat.staff.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Ditamatkan' }),
      });
      if (!resStatus.ok) throw new Error('Gagal mengemas kini status.');
      kemaskiniStaff({ ...konfirmasiTamat.staff, status: 'Ditamatkan' });
      const res = await fetch(`/api/system/users/${konfirmasiTamat.staff.id}/kandungan-belum-terbit/padam`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memadam kandungan.');
      setKonfirmasiTamat(null);
      onToast?.('success', `Akaun ditamatkan. ${data.drafDipadam} draf dan ${data.menungguDipadam} kandungan menunggu dipadam.`);
    } catch (e: any) {
      setRalatTamat(e.message || 'Gagal memadam kandungan belum terbit.');
    } finally {
      setMemproses(false);
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
                placeholder="Cari anggota, username, atau emel…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`${INPUT_BORANG} pl-8 w-64`}
              />
            </div>

            {isPentadbir && (
              <Button onClick={() => setTambahTerbuka(true)} icon={<Plus className="w-3.5 h-3.5" />}>
                Tambah Anggota
              </Button>
            )}
          </>
        }
      />

      {/* Butang "Cuba Lagi" (Audit UI/UX §D6) — muatSemula sudah wujud tapi dahulu tak pernah
          disambungkan kepada jalan pulih dalam UI; Pentadbir terpaksa muat semula seluruh laman. */}
      {ralat && <MesejStatus tone="error" onCubaLagi={muatSemula}>{ralat}</MesejStatus>}

      <PanelCard padding="p-0">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <caption className="sr-only">Senarai anggota editorial</caption>
          <thead>
            <tr className={`border-b border-stone-200 ${KEPALA_JADUAL}`}>
              <th scope="col" className="p-4">Nama Anggota</th>
              <th scope="col" className="p-4">ID Pengguna</th>
              <th scope="col" className="p-4">Peranan</th>
              <th scope="col" className="p-4">Status</th>
              <th scope="col" className="p-4">Kandungan Diterbitkan</th>
              <th scope="col" className="p-4">Akaun Dicipta</th>
              <th scope="col" className="p-4 text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody className="font-sans">
            {memuat && (
              // DIREKTORI-2 (2A, audit ChatGPT 2026-08-09; disegar semula DS-02, VR-01
              // 2026-08-09) — dahulu ikon Hourglass berputar sendiri, kemudian KeadaanKosong
              // (sama rupa dengan keadaan KOSONG sebenar, editor tak dapat bezakan sistem
              // sedang bekerja atau data memang tiada). Kini KeadaanMemuat (rangka berdenyut).
              <tr><td colSpan={7}><KeadaanMemuat baris={5} /></td></tr>
            )}
            {!memuat && filteredStaff.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <KeadaanKosong
                    tindakan={searchQuery && (
                      <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
                        Kosongkan Carian
                      </Button>
                    )}
                  >
                    Tiada Anggota Sepadan
                  </KeadaanKosong>
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
        <ProfilAnggotaModal
          staff={selectedStaff}
          isPentadbir={isPentadbir}
          onTutup={() => setSelectedStaff(null)}
          onUpdated={kemaskiniStaff}
          onSiapUntukTamat={setKonfirmasiTamat}
          onBerjaya={(mesej) => onToast?.('success', mesej)}
          onUrusPenugasanSlot={onTukarTab ? () => { setSelectedStaff(null); onTukarTab('slot'); } : undefined}
        />
      )}

      {tambahTerbuka && (
        <TambahAnggotaModal
          onTutup={() => setTambahTerbuka(false)}
          onBerjaya={(emel: string) => {
            setTambahTerbuka(false);
            muatSemula();
            onToast?.('success', `Akaun dicipta. E-mel jemputan telah dihantar ke ${emel} untuk tetapkan kata laluan.`);
          }}
        />
      )}

      {konfirmasiTamat && (
        <EditorDialog
          saiz="sm"
          tajuk={`Tamatkan ${konfirmasiTamat.staff.penName || konfirmasiTamat.staff.username}?`}
          onTutup={() => { if (!memproses) { setKonfirmasiTamat(null); setRalatTamat(''); } }}
        >
          <div className="space-y-4">
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

            {ralatTamat && <MesejStatus tone="error">{ralatTamat}</MesejStatus>}

            {/* Kaki modal disusun menegak (bukan sebaris) sebab label tindakannya panjang —
                susunan tetap mengikut keutamaan D2: tindakan merbahaya, tindakan biasa, Batal.
                Sebab itu ia kekal dalam `children` dan BUKAN dalam prop `tindakan` EditorDialog,
                yang menjajarkan butang sebaris ke kanan. */}
            <div className="flex flex-col gap-2 pt-2 border-t border-stone-200">
              <Button variant="bahaya" onClick={tamatkanDanPadam} disabled={memproses}>
                {memproses ? 'Memproses…' : 'Tamatkan + Padam draf/menunggu'}
              </Button>
              <Button variant="secondary" onClick={tamatkanSahaja} disabled={memproses}>
                Tamatkan sahaja (kekalkan draf/menunggu)
              </Button>
              <Button variant="ghost" onClick={() => { setKonfirmasiTamat(null); setRalatTamat(''); }} disabled={memproses}>
                Batal
              </Button>
            </div>
          </div>
        </EditorDialog>
      )}
    </div>
  );
};

// Modal profil anggota (Audit UI/UX §G1/G2/G4/G6, §E5) — diasingkan daripada DirektoriConsole
// supaya perangkap fokus (kini dalam EditorDialog) hanya aktif selagi modal ni dilekap (bukan sepanjang hayat
// konsol induk). ubahStatus/klikTamatkan/togolPeranan turut dipindahkan ke sini kerana
// kesemuanya cuma dicetuskan daripada dalam modal ni.
function ProfilAnggotaModal({
  staff, isPentadbir, onTutup, onUpdated, onSiapUntukTamat, onBerjaya, onUrusPenugasanSlot,
}: {
  staff: Staff;
  isPentadbir: boolean;
  onTutup: () => void;
  onUpdated: (updated: Staff) => void;
  onSiapUntukTamat: (payload: { staff: Staff; draf: any[]; menunggu: any[] }) => void;
  // 2026-08-08, Izzat: "byk tempat yg ada kotak tick... takde makluman sama ada berjaya atau tak"
  // — togolPeranan() auto-simpan tiap kali diklik; sebelum ni SENYAP bila berjaya (cuma ralat
  // dipapar bila gagal). Guna toast kejayaan SEDIA ADA konsol induk (mesejBerjaya), bukan bina baharu.
  onBerjaya: (mesej: string) => void;
  // Pautan konteks ke Slot (TEAM-01) — undefined kalau induk tak beri onTukarTab, butang tak papar.
  onUrusPenugasanSlot?: () => void;
}) {
  const [ralatStatus, setRalatStatus] = useState('');
  const [ralatPeranan, setRalatPeranan] = useState('');
  const [memuatKonfirmasi, setMemuatKonfirmasi] = useState(false);

  const ubahStatus = async (status: typeof STATUS_SAH[number]) => {
    setRalatStatus('');
    try {
      const res = await fetch(`/api/system/users/${staff.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      onUpdated({ ...staff, status });
    } catch {
      setRalatStatus('Gagal mengemas kini status.');
    }
  };

  // "Ditamatkan" dipintas (bukan terus ubahStatus) — semak dulu Draf+Menunggu kepunyaannya
  // supaya Pentadbir buat keputusan termaklum, bukan terkejut kandungan hilang/tertinggal senyap.
  const klikTamatkan = async () => {
    setMemuatKonfirmasi(true);
    setRalatStatus('');
    try {
      const res = await fetch(`/api/system/users/${staff.id}/kandungan-belum-terbit`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyemak kandungan.');
      onSiapUntukTamat({ staff, draf: data.draf || [], menunggu: data.menunggu || [] });
    } catch (e: any) {
      setRalatStatus(e.message || 'Gagal menyemak kandungan belum terbit.');
    } finally {
      setMemuatKonfirmasi(false);
    }
  };

  const togolPeranan = async (roleId: string) => {
    const roles = staff.roles.includes(roleId)
      ? staff.roles.filter(r => r !== roleId)
      : [...staff.roles, roleId];
    setRalatPeranan('');
    if (roles.length === 0) { setRalatPeranan('Akaun mesti pegang sekurang-kurangnya satu peranan.'); return; }
    try {
      const res = await fetch(`/api/system/users/${staff.id}/roles`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles }),
      });
      if (!res.ok) throw new Error();
      onUpdated({ ...staff, roles });
      onBerjaya('Peranan dikemas kini.');
    } catch {
      setRalatPeranan('Gagal mengemas kini peranan.');
    }
  };

  return (
    <EditorDialog
      saiz="lg"
      onTutup={onTutup}
      tajuk={
        // Tajuk modal ni berbilang baris (kicker + nama pena + emel), sebab itu prop `tajuk`
        // menerima ReactNode. Guna <span className="block"> — <div> dalam <h3> bukan HTML sah.
        <span className="block min-w-0">
          <span className="font-mono text-[9px] uppercase tracking-widest text-Adjung-maroon font-bold block mb-1">
            PROFIL ANGGOTA EDITORIAL
          </span>
          {/* Tajuk modal piawai (Pelan 01 Fasa D2): serif-lg maroon, bukan stone-900. */}
          <span className="block font-serif text-lg font-bold text-Adjung-maroon">{staff.penName}</span>
          <span className="block font-mono text-xs font-normal text-stone-500">{staff.username} • {staff.email}</span>
        </span>
      }
    >
      <div className="space-y-6">
        <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
          <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">MAKLUMAT IDENTITI</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><span className="text-stone-500 block text-[10px] font-semibold uppercase">Nama Pena</span><strong className="text-stone-900 font-semibold">{staff.penName}</strong></div>
            <div><span className="text-stone-500 block text-[10px] font-semibold uppercase mb-1">Status</span><StatusBadge tone={STATUS_TONE[staff.status]} label={staff.status} /></div>
            <div><span className="text-stone-500 block text-[10px] font-semibold uppercase">Akaun Dicipta</span><strong className="font-mono font-bold">{new Date(staff.createdAt).toLocaleDateString('ms-MY')}</strong></div>
          </div>
        </div>

        <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
          <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">PERANAN (BOLEH BERBILANG)</h4>
          <div className="grid grid-cols-2 gap-2">
            {ROLE_ORDER.map(roleId => (
              <label key={roleId} className={`flex items-center gap-2 px-3 py-2 rounded border ${isPentadbir ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'} ${staff.roles.includes(roleId) ? 'border-Adjung-maroon bg-white' : 'border-stone-200 bg-stone-100'}`}>
                <input
                  type="checkbox"
                  checked={staff.roles.includes(roleId)}
                  onChange={() => isPentadbir && togolPeranan(roleId)}
                  disabled={!isPentadbir}
                  className="rounded border-stone-300 text-Adjung-maroon w-4 h-4"
                />
                <span className="font-semibold text-stone-800">{ROLE_META[roleId].label}</span>
              </label>
            ))}
          </div>
          {ralatPeranan && <MesejStatus tone="error">{ralatPeranan}</MesejStatus>}
        </div>

        <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3 font-sans text-xs">
          <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">AKTIVITI KANDUNGAN</h4>
          <div className="bg-white p-3 rounded border border-stone-200 text-center max-w-[160px]">
            <div className="text-2xl font-bold font-serif text-emerald-800 font-mono">{staff.countPublished}</div>
            <span className="text-stone-500 text-[10px] uppercase font-semibold block mt-1">Kandungan Diterbitkan</span>
          </div>
        </div>

        {onUrusPenugasanSlot && (
          <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-2 font-sans text-xs">
            <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">PENUGASAN SLOT</h4>
            <p className="text-stone-500">Slot yang ditugaskan kepada anggota ini diurus di destinasi Slot, bukan di sini.</p>
            <Button variant="secondary" size="sm" onClick={onUrusPenugasanSlot}>
              Urus Penugasan Slot →
            </Button>
          </div>
        )}

        {isPentadbir && (
          <div className="border-t border-stone-200 pt-4 space-y-2 font-sans text-xs">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <span className="text-stone-500 font-semibold text-xs">TUKAR STATUS PERKHIDMATAN:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {/* "Ditamatkan" ialah tindakan merbahaya — varian `bahaya`, dan pengesahan dua
                    langkah sedia ada (klikTamatkan → modal konfirmasiTamat) dikekalkan. */}
                {STATUS_SAH.map(s => (
                  <Button
                    key={s}
                    variant={s === 'Ditamatkan' ? 'bahaya' : 'secondary'}
                    size="sm"
                    onClick={() => s === 'Ditamatkan' ? klikTamatkan() : ubahStatus(s)}
                    disabled={staff.status === s || (s === 'Ditamatkan' && memuatKonfirmasi)}
                  >
                    {s === 'Ditamatkan' && memuatKonfirmasi ? 'Menyemak…' : s}
                  </Button>
                ))}
              </div>
            </div>
            {ralatStatus && <MesejStatus tone="error">{ralatStatus}</MesejStatus>}
          </div>
        )}
      </div>
    </EditorDialog>
  );
}

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

  // Amaran belum-simpan (Audit UI/UX §B2) — kotor apabila mana-mana medan sudah diisi, atau
  // peranan lalai (`editor` sahaja) sudah ditukar. Sebelum ni klik latar/X menutup borang terus
  // walaupun editor sudah menaip nama/emel.
  const kotor = !!(username || email || penName) || roles.length !== 1 || roles[0] !== 'editor';
  const { cubaTutup, tunjukAmaran, batalTutup, sahkanTutup } = useAmaranBelumSimpan(kotor, onTutup);

  return (
    <EditorDialog
      saiz="sm"
      tajuk="Tambah Anggota"
      onTutup={cubaTutup}
      tindakan={
        // `form=` menyambung butang di kaki dialog kepada borang dalam `children` — EditorDialog
        // merender `tindakan` sebagai ADIK-BERADIK kepada children, jadi penghantaran tersirat
        // tidak berfungsi tanpa atribut ni.
        <Button type="submit" form="borang-tambah-anggota" disabled={menyimpan || roles.length === 0}>
          {menyimpan ? 'Mencipta…' : 'Cipta Akaun'}
        </Button>
      }
    >
      <form id="borang-tambah-anggota" onSubmit={hantar} className="space-y-4">
        {tunjukAmaran && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-Adjung-maroon/30 bg-Adjung-maroon/5 px-3 py-2">
            <span className="font-sans text-xs text-stone-700">Ada perubahan belum disimpan. Tutup dan buang perubahan ini?</span>
            <div className="flex items-center gap-2 shrink-0">
              <Button type="button" variant="ghost" size="sm" onClick={batalTutup}>Batal</Button>
              <Button type="button" variant="primary" size="sm" onClick={sahkanTutup}>Ya, teruskan</Button>
            </div>
          </div>
        )}
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
      </form>
    </EditorDialog>
  );
}

export default DirektoriConsole;
