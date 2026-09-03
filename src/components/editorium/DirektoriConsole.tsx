import React, { useEffect, useState } from 'react';
import { bacaJsonSelamat } from '../../utils/bacaJson';
import { Search, Plus } from 'lucide-react';
import { StatusBadge, StatusTone } from '../common/StatusBadge';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { KeadaanMemuat } from '../common/KeadaanMemuat';
import { Button } from '../common/Button';
import { AmaranBelumSimpan } from '../common/AmaranBelumSimpan';
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

// Permohonan Editor (2026-08-25) — lihat core/routes/permohonanEditorRoutes.js.
interface Permohonan {
  id: string;
  namaPenuh: string;
  emel: string;
  telefon: string;
  negeri: string;
  kelulusan: string;
  bidangMinat: string[];
  pengalaman: string;
  pautanContoh: string;
  motivasi: string;
  status: 'baharu' | 'diterima' | 'ditolak';
  catatanSemakan: string | null;
  disemakOleh: string | null;
  disemakPada: string | null;
  createdAt: string;
}
const STATUS_PERMOHONAN_META: Record<Permohonan['status'], { label: string; tone: StatusTone }> = {
  baharu: { label: 'Baharu', tone: 'warning' },
  diterima: { label: 'Diterima', tone: 'success' },
  ditolak: { label: 'Ditolak', tone: 'error' },
};
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
  // autoTerbit (2026-08-28) — bila hidup, "Simpan sebagai draf" editor ni terus menerbitkan
  // (lihat core/routes/userAdminRoutes.js PATCH /users/:id/auto-terbit).
  autoTerbit: boolean;
  createdAt: string;
  updatedAt: string;
  roles: string[];
  countPublished: number;
  // Dasar Aktif Editorial (2026-08-16) — lihat core/routes/userAdminRoutes.js GET /users.
  tertaklukDasarAktif: boolean;
  hariTakAktif: number | null;
  tahapAmaran: number;
  ambangHariDasarAktif: { amaranPertama: number; amaranKedua: number; notisPenamatan: number };
}

// Tahap amaran -> ton/label lencana (2026-08-16) — 0 = belum ada amaran (Direktori tak papar
// lencana, cuma bilangan hari). 1/2 amaran (kuning/oren), 3 = digantung (merah, status.suspended
// pun turut Tidak Aktif, tapi lencana ni beri konteks SEBAB kenapa, bukan cuma status generik).
const TAHAP_AMARAN_META: Record<number, { label: string; tone: StatusTone }> = {
  1: { label: 'Amaran 1', tone: 'warning' },
  2: { label: 'Amaran 2', tone: 'warning' },
  3: { label: 'Digantung (tidak aktif)', tone: 'error' },
};

// Satu baris jadual anggota — diasingkan (2026-08-16) supaya boleh dipanggil dua tempat (kumpulan
// Aktif dan kumpulan Ditamatkan di bawahnya) tanpa duplikasi JSX. `className` pilihan membezakan
// baris ditamatkan secara visual (latar pudar) tanpa perlu dua salinan markup.
const BarisAnggota: React.FC<{ staff: Staff; onLihatProfil: () => void; className?: string }> = ({ staff, onLihatProfil, className = '' }) => (
  <tr className={`hover:bg-stone-50 transition-colors ${GARIS_BARIS} ${className}`}>
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
    <td className="p-4">
      {!staff.tertaklukDasarAktif || staff.hariTakAktif === null ? (
        <span className="text-stone-300">—</span>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs text-stone-600">{staff.hariTakAktif} hari</span>
          {staff.tahapAmaran > 0 && TAHAP_AMARAN_META[staff.tahapAmaran] && (
            <StatusBadge tone={TAHAP_AMARAN_META[staff.tahapAmaran].tone} label={TAHAP_AMARAN_META[staff.tahapAmaran].label} />
          )}
        </div>
      )}
    </td>
    <td className="p-4 text-stone-700 font-mono text-xs">{staff.countPublished}</td>
    <td className="p-4 text-stone-500 font-mono text-xs">{new Date(staff.createdAt).toLocaleDateString('ms-MY')}</td>
    <td className="p-4 text-right">
      <Button variant="secondary" size="sm" onClick={onLihatProfil}>
        Lihat Profil
      </Button>
    </td>
  </tr>
);

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
  // WF-05 (Pusingan 5, audit ChatGPT 2026-08-09) — "Urus Penugasan Slot" dahulu cuma tukar tab,
  // TIADA konteks editor dibawa — Ketua Editor kena scan 38 baris Senarai Slot sendiri cari
  // editor tu. Bila prop ni hadir, dipilih dahulu drpd onTukarTab supaya konteks (nama editor)
  // turut dibawa, bukan cuma nombor tab.
  onUrusPenugasanSlotUntuk?: (namaEditor: string) => void;
}

export const DirektoriConsole: React.FC<DirektoriConsoleProps> = ({
  isPentadbir = true, onTukarTab, onToast, onUrusPenugasanSlotUntuk
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
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setStaffList(Array.isArray(d) ? d : []); setRalat(''); })
      .catch(() => setRalat('Gagal memuatkan senarai anggota.'))
      .finally(() => setMemuat(false));
  };
  useEffect(muatSemula, []);

  // Dasar Aktif Editorial — tempoh boleh laras (2026-08-16, soalan Izzat: "macam mana nak check
  // dan adjust tempoh tu?"). Panel kecil terbenam di sini (bukan Tetapan berasingan) — Pentadbir
  // sedang melihat status editor tepat di jadual bawah, kawalan yang mengubah nasib status tu
  // patut berdekatan, bukan navigasi ke destinasi lain untuk cari semula.
  const [dasarAktif, setDasarAktif] = useState({ amaranPertamaHari: 7, amaranKeduaHari: 14, notisPenamatanHari: 21 });
  const [memuatDasarAktif, setMemuatDasarAktif] = useState(true);
  const [ralatDasarAktif, setRalatDasarAktif] = useState('');
  const [menyimpanDasarAktif, setMenyimpanDasarAktif] = useState(false);
  const [dasarAktifDibuka, setDasarAktifDibuka] = useState(false);

  const muatDasarAktif = () => {
    setMemuatDasarAktif(true);
    fetch('/api/system/dasar-aktif-editorial')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { if (d && typeof d.amaranPertamaHari === 'number') setDasarAktif(d); })
      .catch(() => setRalatDasarAktif('Gagal memuatkan Dasar Aktif Editorial.'))
      .finally(() => setMemuatDasarAktif(false));
  };
  useEffect(muatDasarAktif, []);

  const simpanDasarAktif = async () => {
    setMenyimpanDasarAktif(true);
    setRalatDasarAktif('');
    try {
      const res = await fetch('/api/system/dasar-aktif-editorial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dasarAktif),
      });
      const data = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan Dasar Aktif Editorial.');
      setDasarAktif({ amaranPertamaHari: data.amaranPertamaHari, amaranKeduaHari: data.amaranKeduaHari, notisPenamatanHari: data.notisPenamatanHari });
      onToast?.('success', 'Dasar Aktif Editorial dikemas kini. Semakan esok guna tempoh baharu.');
      muatSemula();
    } catch (e: any) {
      setRalatDasarAktif(e.message || 'Gagal menyimpan Dasar Aktif Editorial.');
    } finally {
      setMenyimpanDasarAktif(false);
    }
  };

  // Permohonan Editor (2026-08-25, arahan Izzat — borang awam "Sertai Pasukan Editorial",
  // lihat core/routes/permohonanEditorRoutes.js). Senarai permohonan 'baharu' dipaparkan di
  // sini supaya Ketua Editor/Pentadbir menyemak kelulusan + Bidang minat pemohon SEBELUM
  // memutuskan slot — Terima memanggil POST /api/system/users sedia ada (akaun + e-mel
  // jemputan), kemudian menanda keputusan; TIADA logik cipta-akaun berganda.
  const [permohonanList, setPermohonanList] = useState<Permohonan[]>([]);
  const [memuatPermohonan, setMemuatPermohonan] = useState(true);
  const [ralatPermohonan, setRalatPermohonan] = useState('');
  const [permohonanDibuka, setPermohonanDibuka] = useState(false);
  const [tapisanPermohonan, setTapisanPermohonan] = useState<'baharu' | 'diterima' | 'ditolak' | ''>('baharu');
  const [permohonanDipilih, setPermohonanDipilih] = useState<Permohonan | null>(null);

  const muatPermohonan = (status = tapisanPermohonan) => {
    setMemuatPermohonan(true);
    fetch(`/api/system/permohonan-editor${status ? `?status=${status}` : ''}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setPermohonanList(Array.isArray(d) ? d : []); setRalatPermohonan(''); })
      .catch(() => setRalatPermohonan('Gagal memuatkan senarai permohonan.'))
      .finally(() => setMemuatPermohonan(false));
  };
  useEffect(() => { if (isPentadbir) muatPermohonan('baharu'); }, [isPentadbir]);

  const filteredStaff = staffList.filter(s =>
    s.penName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Anggota Ditamatkan diasingkan ke bawah jadual (2026-08-16, permintaan Izzat: "sepatutnya
  // diletakkan berasingan... supaya tak bercampur dengan yg masih aktif") — dahulu susunan ikut
  // terus staffList (biasanya tarikh cipta), jadi akaun ditamatkan boleh terselit antara akaun
  // aktif tanpa corak jelas. Dipecah dua kumpulan (bukan diurut ikut status sahaja) supaya baris
  // pemisah "AKAUN DITAMATKAN" boleh dipaparkan di antaranya — susunan ASAL dikekalkan dalam
  // setiap kumpulan (filter, bukan sort, jadi stabil).
  const staffAktif = filteredStaff.filter(s => s.status !== 'Ditamatkan');
  const staffDitamatkan = filteredStaff.filter(s => s.status === 'Ditamatkan');

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
      const data = await bacaJsonSelamat(res);
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
                placeholder="Cari anggota, nama pengguna atau e-mel…"
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

      {/* Dasar Aktif Editorial (2026-08-16) — "editor mesti aktif dalam tempoh tertentu, kalau
          tak aktif akan digantung" (dasar sedia ada sejak 2026-08-05) kini boleh dilaras di sini,
          bukan lagi pemalar kod keras server.js. Ditutup lalai (accordion) — kawalan yang boleh
          menggantung akaun editor secara automatik tak patut jadi elemen pertama yang menonjol
          setiap kali Pentadbir buka Direktori, tapi tetap sentiasa boleh dicapai terus. */}
      {isPentadbir && (
        <PanelCard className="text-xs">
          <button
            type="button"
            onClick={() => setDasarAktifDibuka(v => !v)}
            className="w-full flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-Adjung-maroon font-bold block mb-1">
                DASAR AKTIF EDITORIAL
              </span>
              <p className="text-stone-500">
                Editor wajib terbitkan kandungan dalam tempoh ditetapkan, kalau tidak akaun digantung automatik.
                {!memuatDasarAktif && ` Semasa: amaran hari ke-${dasarAktif.amaranPertamaHari}, hari ke-${dasarAktif.amaranKeduaHari}, gantung automatik hari ke-${dasarAktif.notisPenamatanHari}.`}
              </p>
            </div>
            <span className="text-stone-400 font-mono text-[10px] shrink-0 ml-3">{dasarAktifDibuka ? 'Tutup ▲' : 'Laraskan ▼'}</span>
          </button>

          {dasarAktifDibuka && (
            <div className="mt-4 pt-4 border-t border-stone-200 space-y-3">
              {memuatDasarAktif ? (
                <KeadaanMemuat baris={1} />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-xl">
                    <label className="block">
                      <span className={LABEL_BORANG}>Amaran pertama (hari)</span>
                      <input
                        type="number" min={1}
                        value={dasarAktif.amaranPertamaHari}
                        onChange={e => setDasarAktif(prev => ({ ...prev, amaranPertamaHari: Number(e.target.value) }))}
                        className={INPUT_BORANG}
                      />
                    </label>
                    <label className="block">
                      <span className={LABEL_BORANG}>Amaran kedua (hari)</span>
                      <input
                        type="number" min={1}
                        value={dasarAktif.amaranKeduaHari}
                        onChange={e => setDasarAktif(prev => ({ ...prev, amaranKeduaHari: Number(e.target.value) }))}
                        className={INPUT_BORANG}
                      />
                    </label>
                    <label className="block">
                      <span className={LABEL_BORANG}>Gantung automatik (hari)</span>
                      <input
                        type="number" min={1}
                        value={dasarAktif.notisPenamatanHari}
                        onChange={e => setDasarAktif(prev => ({ ...prev, notisPenamatanHari: Number(e.target.value) }))}
                        className={INPUT_BORANG}
                      />
                    </label>
                  </div>
                  <p className="text-stone-400 text-[10px] leading-relaxed">
                    Tempoh mesti menaik (amaran pertama &lt; amaran kedua &lt; gantung automatik). "Aktif" ditakrif
                    sebagai kandungan diterbitkan, bukan sekadar log masuk. Pentadbir dikecualikan (struktur peranan
                    tak membenarkan Pentadbir menerbitkan kandungan). Semakan berjalan sekali sehari — perubahan
                    di sini terpakai pada semakan seterusnya, tidak retroaktif pada akaun yang sudah digantung.
                  </p>
                  {ralatDasarAktif && <MesejStatus tone="error">{ralatDasarAktif}</MesejStatus>}
                  <div className="flex justify-end">
                    <Button variant="primary" size="sm" onClick={simpanDasarAktif} disabled={menyimpanDasarAktif}>
                      {menyimpanDasarAktif ? 'Menyimpan…' : 'Simpan Dasar'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </PanelCard>
      )}

      {/* Permohonan Editor (2026-08-25) — semakan borang awam "Sertai Pasukan Editorial".
          Accordion sama corak Dasar Aktif di atas, tetapi dibuka automatik pentingnya jelas:
          kiraan permohonan baharu sentiasa kelihatan pada kepala walaupun tertutup. */}
      {isPentadbir && (
        <PanelCard className="text-xs">
          <button
            type="button"
            onClick={() => setPermohonanDibuka(v => !v)}
            className="w-full flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-Adjung-maroon font-bold block mb-1">
                PERMOHONAN EDITOR
              </span>
              <p className="text-stone-500">
                Permohonan daripada borang awam "Sertai Pasukan Editorial".
                {!memuatPermohonan && tapisanPermohonan === 'baharu' && ` ${permohonanList.length} permohonan baharu menunggu semakan.`}
              </p>
            </div>
            <span className="text-stone-400 font-mono text-[10px] shrink-0 ml-3">{permohonanDibuka ? 'Tutup ▲' : 'Semak ▼'}</span>
          </button>

          {permohonanDibuka && (
            <div className="mt-4 pt-4 border-t border-stone-200 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {([['baharu', 'Baharu'], ['diterima', 'Diterima'], ['ditolak', 'Ditolak'], ['', 'Semua']] as const).map(([nilai, label]) => (
                  <Button
                    key={label}
                    variant={tapisanPermohonan === nilai ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => { setTapisanPermohonan(nilai); muatPermohonan(nilai); }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {ralatPermohonan && <MesejStatus tone="error" onCubaLagi={() => muatPermohonan()}>{ralatPermohonan}</MesejStatus>}
              {memuatPermohonan ? (
                <KeadaanMemuat baris={3} />
              ) : permohonanList.length === 0 ? (
                <KeadaanKosong>Tiada Permohonan Dalam Tapisan Ini</KeadaanKosong>
              ) : (
                <div className="border border-stone-200 rounded divide-y divide-Adjung-line">
                  {permohonanList.map(p => (
                    <div key={p.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-serif font-bold text-stone-900">{p.namaPenuh}</span>
                          <StatusBadge tone={STATUS_PERMOHONAN_META[p.status].tone} label={STATUS_PERMOHONAN_META[p.status].label} />
                        </div>
                        <div className="text-stone-500 font-mono text-[10px] mt-0.5 truncate">
                          {p.emel} · {p.negeri} · {new Date(p.createdAt).toLocaleDateString('ms-MY')}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {p.bidangMinat.map(b => (
                            <span key={b} className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 text-[10px] font-semibold">{b}</span>
                          ))}
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => setPermohonanDipilih(p)}>
                        Semak
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </PanelCard>
      )}

      <PanelCard padding="p-0">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <caption className="sr-only">Senarai anggota editorial</caption>
          <thead>
            <tr className={KEPALA_JADUAL}>
              <th scope="col" className="p-4">Nama Anggota</th>
              <th scope="col" className="p-4">ID Pengguna</th>
              <th scope="col" className="p-4">Peranan</th>
              <th scope="col" className="p-4">Status</th>
              <th scope="col" className="p-4">Tidak Aktif</th>
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
              <tr><td colSpan={8}><KeadaanMemuat baris={5} /></td></tr>
            )}
            {!memuat && filteredStaff.length === 0 && (
              <tr>
                <td colSpan={8}>
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
            {!memuat && staffAktif.map(staff => (
              <BarisAnggota key={staff.id} staff={staff} onLihatProfil={() => setSelectedStaff(staff)} />
            ))}
            {!memuat && staffDitamatkan.length > 0 && (
              <tr>
                <td colSpan={8} className="px-4 pt-5 pb-1.5 bg-stone-50 border-t-2 border-stone-200">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-stone-400">
                    Akaun Ditamatkan ({staffDitamatkan.length})
                  </span>
                </td>
              </tr>
            )}
            {!memuat && staffDitamatkan.map(staff => (
              <BarisAnggota key={staff.id} staff={staff} onLihatProfil={() => setSelectedStaff(staff)} className="bg-stone-50/50" />
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
          onUrusPenugasanSlot={onTukarTab ? () => {
            const nama = selectedStaff.penName;
            setSelectedStaff(null);
            if (onUrusPenugasanSlotUntuk) onUrusPenugasanSlotUntuk(nama);
            else onTukarTab('slot');
          } : undefined}
        />
      )}

      {tambahTerbuka && (
        <TambahAnggotaModal
          onTutup={() => setTambahTerbuka(false)}
          onBerjaya={(emel: string, emelDihantar: boolean) => {
            setTambahTerbuka(false);
            muatSemula();
            // emelDihantar (2026-09-03, dapatan bug-hunt) — lihat nota sepadan di PermohonanModal
            // terima() di bawah: hantarEmel() gagal senyap, mesej dahulu tak pernah baca status
            // sebenar penghantaran.
            onToast?.(
              emelDihantar ? 'success' : 'error',
              emelDihantar
                ? `Akaun dicipta. E-mel jemputan telah dihantar ke ${emel} untuk menetapkan kata laluan.`
                : `Akaun dicipta untuk ${emel}, tetapi e-mel jemputan GAGAL dihantar. Sila hubungi anggota tersebut secara manual dan semak konfigurasi e-mel sistem.`
            );
          }}
        />
      )}

      {permohonanDipilih && (
        <PermohonanModal
          permohonan={permohonanDipilih}
          onTutup={() => setPermohonanDipilih(null)}
          onSelesai={(mesej, tone) => {
            setPermohonanDipilih(null);
            muatPermohonan();
            muatSemula();
            onToast?.(tone || 'success', mesej);
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
                Tiada draf atau kandungan menunggu kepunyaan akaun ini, selamat ditamatkan.
              </p>
            ) : (
              <>
                <p className="text-stone-600 leading-relaxed">
                  Akaun ini ada <strong className="text-stone-900">{konfirmasiTamat.draf.length} draf</strong> dan{' '}
                  <strong className="text-stone-900">{konfirmasiTamat.menunggu.length} kandungan menunggu</strong> yang
                  belum pernah diterbitkan. Kandungan yang SUDAH diterbitkan (aktif/arkib) tidak terjejas, cuma
                  yang belum terbit ini pilihan awak.
                </p>
                <div className="max-h-32 overflow-y-auto border border-stone-200 rounded divide-y divide-Adjung-line">
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
      const data = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengemas kini status.');
      onUpdated({ ...staff, status });
    } catch (e: any) {
      setRalatStatus(e.message || 'Gagal mengemas kini status.');
    }
  };

  const [ralatAutoTerbit, setRalatAutoTerbit] = useState('');
  const togolAutoTerbit = async (autoTerbit: boolean) => {
    setRalatAutoTerbit('');
    try {
      const res = await fetch(`/api/system/users/${staff.id}/auto-terbit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoTerbit }),
      });
      const data = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengemas kini togol auto-terbit.');
      onUpdated({ ...staff, autoTerbit });
      onBerjaya(autoTerbit ? 'Auto-terbit dihidupkan.' : 'Auto-terbit dimatikan.');
    } catch (e: any) {
      setRalatAutoTerbit(e.message || 'Gagal mengemas kini togol auto-terbit.');
    }
  };

  // "Ditamatkan" dipintas (bukan terus ubahStatus) — semak dulu Draf+Menunggu kepunyaannya
  // supaya Pentadbir buat keputusan termaklum, bukan terkejut kandungan hilang/tertinggal senyap.
  const klikTamatkan = async () => {
    setMemuatKonfirmasi(true);
    setRalatStatus('');
    try {
      const res = await fetch(`/api/system/users/${staff.id}/kandungan-belum-terbit`);
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menyemak kandungan.');
      onSiapUntukTamat({ staff, draf: data.draf || [], menunggu: data.menunggu || [] });
    } catch (e: any) {
      setRalatStatus(e.message || 'Gagal menyemak kandungan belum terbit.');
    } finally {
      setMemuatKonfirmasi(false);
    }
  };

  // Jemputan belum diaktifkan (2026-09-03, soalan terbuka bug-hunt, diluluskan Izzat) — username
  // sementara berawalan "pending_" (AWALAN_USERNAME_SEMENTARA, core/auth/TokenLaluan.js — literal
  // disalin di sini sebab modul server tak boleh diimport terus ke klien) bermaksud akaun ni
  // dicipta tapi editor belum tetapkan identiti/kata laluan sendiri melalui pautan jemputan.
  const jemputanBelumAktif = staff.username.startsWith('pending_');
  const [menghantarSemula, setMenghantarSemula] = useState(false);
  const [ralatHantarSemula, setRalatHantarSemula] = useState('');
  const hantarSemulaJemputan = async () => {
    setMenghantarSemula(true);
    setRalatHantarSemula('');
    try {
      const res = await fetch(`/api/system/users/${staff.id}/hantar-semula-jemputan`, { method: 'POST' });
      const data = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghantar semula jemputan.');
      onBerjaya(
        data.emelDihantar
          ? `E-mel jemputan dihantar semula ke ${staff.email}.`
          : `Token jemputan dijana semula, tetapi e-mel GAGAL dihantar ke ${staff.email}. Semak konfigurasi e-mel sistem.`
      );
    } catch (e: any) {
      setRalatHantarSemula(e.message || 'Gagal menghantar semula jemputan.');
    } finally {
      setMenghantarSemula(false);
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
      const data = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengemas kini peranan.');
      onUpdated({ ...staff, roles });
      onBerjaya('Peranan dikemas kini.');
    } catch (e: any) {
      setRalatPeranan(e.message || 'Gagal mengemas kini peranan.');
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
          {jemputanBelumAktif && (
            <div className="pt-2 border-t border-stone-200 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-stone-500 text-[11px]">Jemputan belum diaktifkan — editor belum tetapkan identiti/kata laluan sendiri.</span>
              <button
                type="button"
                onClick={hantarSemulaJemputan}
                disabled={menghantarSemula}
                className="px-3 py-1.5 rounded border border-Adjung-maroon text-Adjung-maroon text-[11px] font-semibold hover:bg-Adjung-maroon hover:text-white transition-colors disabled:opacity-50"
              >
                {menghantarSemula ? 'Menghantar…' : 'Hantar Semula Jemputan'}
              </button>
            </div>
          )}
          {ralatHantarSemula && <MesejStatus tone="error">{ralatHantarSemula}</MesejStatus>}
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
                    langkah sedia ada (klikTamatkan → modal konfirmasiTamat) dikekalkan.
                    IH-04 (Pusingan 6, audit ChatGPT 2026-08-09) — pemisah ruang+garis (bukan
                    warna sahaja) supaya kedudukan fizikal turut mencerminkan kelas tindakan
                    berbeza yang SUDAH wujud dalam logik (laluan/konfirmasi/consequence berbeza,
                    lihat komen di atas dan ubahStatus vs klikTamatkan). Tiada warna/logik/label/
                    susunan 3 status rutin diubah. */}
                {STATUS_SAH.filter(s => s !== 'Ditamatkan').map(s => (
                  <Button
                    key={s}
                    variant="secondary"
                    size="sm"
                    onClick={() => ubahStatus(s)}
                    disabled={staff.status === s}
                  >
                    {s}
                  </Button>
                ))}
                <span className="w-px self-stretch bg-stone-200 mx-1" aria-hidden="true" />
                <Button
                  variant="bahaya"
                  size="sm"
                  onClick={klikTamatkan}
                  disabled={staff.status === 'Ditamatkan' || memuatKonfirmasi}
                >
                  {memuatKonfirmasi ? 'Menyemak…' : 'Ditamatkan'}
                </Button>
              </div>
            </div>
            {ralatStatus && <MesejStatus tone="error">{ralatStatus}</MesejStatus>}

            {/* Auto-terbit (2026-08-28, permintaan Izzat) — utk editor/automasi yang boleh klik
                "Simpan sebagai draf" tapi tak boleh klik "Terbit sekarang" (had teknikal alat
                automasi luaran, cth Codex, terhadap sesetengah kawalan borang). Bila hidup, klik
                "Simpan sebagai draf" editor ni TERUS menerbitkan seluruh giliran draf slot tu —
                label butang KEKAL "Simpan sebagai draf" (keputusan Izzat), tiada laluan kebenaran
                pelayan baharu dibuka (lihat komen penuh core/routes/userAdminRoutes.js). */}
            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id={`auto-terbit-${staff.id}`}
                checked={staff.autoTerbit}
                onChange={(e) => togolAutoTerbit(e.target.checked)}
                className="mt-0.5 cursor-pointer"
              />
              <label htmlFor={`auto-terbit-${staff.id}`} className="cursor-pointer">
                <span className="text-stone-700 font-semibold">Auto-terbit</span>
                <p className="text-stone-500 font-normal mt-0.5">
                  Butang "Simpan sebagai draf" untuk editor ini terus menerbitkan kandungan, bukan
                  sekadar simpan sebagai draf. Guna untuk editor/automasi yang tidak boleh klik
                  "Terbit sekarang" sendiri.
                </p>
              </label>
            </div>
            {ralatAutoTerbit && <MesejStatus tone="error">{ralatAutoTerbit}</MesejStatus>}
          </div>
        )}
      </div>
    </EditorDialog>
  );
}

// Modal semakan satu permohonan editor (2026-08-25) — papar SEMUA maklumat pemohon (kelulusan
// + Bidang minat ialah input triage utama Ketua Editor untuk menentukan slot). Terima memanggil
// POST /api/system/users SEDIA ADA dahulu (cipta akaun + e-mel jemputan bertoken — lihat nota
// TambahAnggotaModal di bawah), KEMUDIAN merekodkan keputusan pada permohonan; kalau langkah
// kedua gagal, akaun sudah wujud dan permohonan kekal 'baharu' — cuba semula keputusan sahaja
// akan gagal 409 pada /api/system/users (e-mel sudah wujud), jadi ralat dipaparkan jelas.
function PermohonanModal({ permohonan, onTutup, onSelesai }: {
  permohonan: Permohonan;
  onTutup: () => void;
  onSelesai: (mesej: string, tone?: 'success' | 'error') => void;
}) {
  const [roles, setRoles] = useState<string[]>(['editor']);
  const [catatan, setCatatan] = useState('');
  const [memproses, setMemproses] = useState(false);
  const [ralat, setRalat] = useState('');
  const bolehDiputuskan = permohonan.status === 'baharu';

  const rekodKeputusan = async (keputusan: 'diterima' | 'ditolak') => {
    const res = await fetch(`/api/system/permohonan-editor/${permohonan.id}/keputusan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keputusan, catatan }),
    });
    const data = await bacaJsonSelamat(res).catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Gagal merekodkan keputusan.');
    return data;
  };

  const terima = async () => {
    if (roles.length === 0) { setRalat('Pilih sekurang-kurangnya satu peranan.'); return; }
    setMemproses(true);
    setRalat('');
    try {
      const res = await fetch('/api/system/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: permohonan.emel, roles }),
      });
      const data = await bacaJsonSelamat(res).catch(() => ({}));
      // Pulih daripada percubaan terputus (2026-09-03, dapatan bug-hunt, diluluskan Izzat) —
      // Terima ialah DUA langkah tak-atomik (cipta akaun, kemudian rekodKeputusan). Kalau
      // langkah PERTAMA berjaya tapi rangkaian putus SEBELUM langkah KEDUA (rekodKeputusan)
      // sempat jalan, permohonan kekal 'baharu' (butang Terima masih aktif) tapi akaun DAH
      // wujud — cuba Terima lagi akan gagal 409 SELAMANYA sebab emel "sudah digunakan", tiada
      // cara pulih dalam UI. `bolehDiputuskan` (status masih 'baharu') jamin laluan ni cuma
      // boleh dicapai SEKALI untuk permohonan ni — 409 pada titik ni hampir pasti bermaksud
      // akaun tu ialah SISA percubaan lalu untuk PERMOHONAN NI SENDIRI (bukan pertembungan emel
      // dgn permohonan lain, yang mustahil janakan Terima aktif serentak), jadi selamat teruskan
      // ke rekodKeputusan dgn amaran (bukan gagal keras) — jauh lebih baik drpd disekat 409
      // selama-lamanya tanpa jalan pulih.
      const akaunSudahWujud = !res.ok && res.status === 409;
      if (!res.ok && !akaunSudahWujud) throw new Error(data.error || 'Gagal mencipta akaun.');
      await rekodKeputusan('diterima');
      // emelDihantar (2026-09-03, dapatan bug-hunt) — POST /api/system/users pulangkan status
      // penghantaran SEBENAR (hantarEmel() gagal senyap bila RESEND_API_KEY tak dikonfigurasi
      // atau Resend API bermasalah, TAK PERNAH baling ralat — lihat MailSender.js), tapi mesej
      // di sini dahulu KEKAL menyatakan "telah dihantar" tanpa baca medan ni langsung. Ketua
      // Editor sangka jemputan sampai sedangkan akaun tercipta tanpa cara pemohon tahu/log masuk
      // (tiada laluan "hantar semula jemputan" — lihat nota di userAdminRoutes.js).
      if (akaunSudahWujud) {
        onSelesai(
          `Permohonan ditandakan diterima. Akaun untuk ${permohonan.emel} nampaknya SUDAH wujud (kemungkinan percubaan lalu terputus) — sila semak peranan/jemputan akaun tu di Direktori secara manual.`,
          'error'
        );
      } else {
        onSelesai(
          data.emelDihantar
            ? `Permohonan diterima. E-mel jemputan telah dihantar ke ${permohonan.emel}.`
            : `Permohonan diterima dan akaun dicipta, tetapi e-mel jemputan GAGAL dihantar ke ${permohonan.emel}. Sila hubungi pemohon secara manual dan semak konfigurasi e-mel sistem.`,
          data.emelDihantar ? 'success' : 'error'
        );
      }
    } catch (e: any) {
      setRalat(e.message || 'Gagal menerima permohonan.');
    } finally {
      setMemproses(false);
    }
  };

  const tolak = async () => {
    setMemproses(true);
    setRalat('');
    try {
      // E-mel makluman penolakan (2026-09-03, soalan terbuka bug-hunt, diluluskan Izzat) —
      // permohonanEditorRoutes.js kini hantar e-mel neutral ke pemohon bila ditolak, pulangkan
      // emelDihantar SEBENAR (sama corak terima() di atas) — jangan dakwa "dimaklumkan" kalau
      // hantaran sebenarnya gagal.
      const data = await rekodKeputusan('ditolak');
      onSelesai(
        data?.emelDihantar
          ? 'Permohonan ditolak dan direkodkan. Pemohon dimaklumkan melalui e-mel.'
          : 'Permohonan ditolak dan direkodkan, tetapi e-mel makluman GAGAL dihantar ke pemohon.',
        data?.emelDihantar ? 'success' : 'error'
      );
    } catch (e: any) {
      setRalat(e.message || 'Gagal menolak permohonan.');
    } finally {
      setMemproses(false);
    }
  };

  const Medan = ({ label, nilai }: { label: string; nilai: React.ReactNode }) => (
    <div>
      <span className="text-stone-500 block text-[10px] font-semibold uppercase">{label}</span>
      <div className="text-stone-900 whitespace-pre-wrap break-words">{nilai || <span className="text-stone-300">—</span>}</div>
    </div>
  );

  return (
    <EditorDialog
      saiz="lg"
      onTutup={() => { if (!memproses) onTutup(); }}
      tajuk={
        <span className="block min-w-0">
          <span className="font-mono text-[9px] uppercase tracking-widest text-Adjung-maroon font-bold block mb-1">
            SEMAKAN PERMOHONAN EDITOR
          </span>
          <span className="block font-serif text-lg font-bold text-Adjung-maroon">{permohonan.namaPenuh}</span>
          <span className="block font-mono text-xs font-normal text-stone-500">{permohonan.emel} • {new Date(permohonan.createdAt).toLocaleDateString('ms-MY')}</span>
        </span>
      }
    >
      <div className="space-y-5 font-sans text-xs">
        <div className="bg-stone-50 p-4 rounded border border-stone-200 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Medan label="Telefon" nilai={permohonan.telefon} />
          <Medan label="Negeri" nilai={permohonan.negeri} />
          <Medan label="Kelulusan" nilai={permohonan.kelulusan} />
          <div>
            <span className="text-stone-500 block text-[10px] font-semibold uppercase mb-1">Bidang Minat</span>
            <div className="flex flex-wrap gap-1">
              {permohonan.bidangMinat.map(b => (
                <span key={b} className="px-2 py-0.5 rounded bg-Adjung-maroon text-white text-[10px] font-bold">{b}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3">
          <Medan label="Pengalaman Penulisan" nilai={permohonan.pengalaman} />
          <Medan label="Pautan Contoh Penulisan" nilai={permohonan.pautanContoh && (
            <a href={permohonan.pautanContoh} target="_blank" rel="noopener noreferrer" className="text-Adjung-maroon underline break-all">{permohonan.pautanContoh}</a>
          )} />
          <Medan label="Motivasi" nilai={permohonan.motivasi} />
        </div>

        {permohonan.status !== 'baharu' && (
          <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-2">
            <div className="flex items-center gap-2">
              <StatusBadge tone={STATUS_PERMOHONAN_META[permohonan.status].tone} label={STATUS_PERMOHONAN_META[permohonan.status].label} />
              {permohonan.disemakOleh && (
                <span className="text-stone-500 font-mono text-[10px]">
                  oleh {permohonan.disemakOleh}{permohonan.disemakPada ? ` · ${new Date(permohonan.disemakPada).toLocaleDateString('ms-MY')}` : ''}
                </span>
              )}
            </div>
            {permohonan.catatanSemakan && <p className="text-stone-600 whitespace-pre-wrap">{permohonan.catatanSemakan}</p>}
          </div>
        )}

        {bolehDiputuskan && (
          <div className="border-t border-stone-200 pt-4 space-y-3">
            <div>
              <span className={LABEL_BORANG}>Peranan jika diterima</span>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_ORDER.map(roleId => (
                  <label key={roleId} className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer ${roles.includes(roleId) ? 'border-Adjung-maroon bg-stone-50' : 'border-stone-200'}`}>
                    <input
                      type="checkbox"
                      checked={roles.includes(roleId)}
                      onChange={() => setRoles(prev => prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId])}
                      className="rounded border-stone-300 text-Adjung-maroon w-4 h-4"
                    />
                    <span className="font-semibold text-stone-800">{ROLE_META[roleId].label}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="block">
              <span className={LABEL_BORANG}>Catatan semakan (pilihan)</span>
              <textarea
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
                rows={2}
                className={INPUT_BORANG}
                placeholder="Sebab keputusan, nota untuk rekod dalaman…"
              />
            </label>
            <p className="text-stone-400 text-[10px] leading-relaxed">
              Terima akan mencipta akaun dan menghantar e-mel jemputan bertoken ke {permohonan.emel} supaya
              pemohon menetapkan nama pena, ID pengguna dan kata laluan sendiri. Penugasan slot diurus
              kemudian di destinasi Slot.
            </p>
            {ralat && <MesejStatus tone="error">{ralat}</MesejStatus>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="bahaya" onClick={tolak} disabled={memproses}>
                {memproses ? 'Memproses…' : 'Tolak'}
              </Button>
              <Button variant="primary" onClick={terima} disabled={memproses || roles.length === 0}>
                {memproses ? 'Memproses…' : 'Terima + Hantar Jemputan'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </EditorDialog>
  );
}

function TambahAnggotaModal({ onTutup, onBerjaya }: { onTutup: () => void; onBerjaya: (emel: string, emelDihantar: boolean) => void }) {
  const [email, setEmail] = useState('');
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
  //
  // Nama Pena/ID Pengguna DIBUANG juga (2026-08-16, permintaan Izzat — "ni menyusahkan ketua
  // editor utk fikir nama pena editor") — Ketua Editor cuma perlu Emel+Peranan; anggota baharu
  // tetapkan identiti (username+nama pena) sendiri sekali dengan kata laluan di
  // /tetapkan-kata-laluan (lihat perluTetapkanIdentiti(), TokenLaluan.js).
  const hantar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenyimpan(true);
    setRalat('');
    try {
      const res = await fetch('/api/system/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, roles }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mencipta akaun.');
      onBerjaya(email, !!data.emelDihantar);
    } catch (err: any) {
      setRalat(err.message || 'Gagal mencipta akaun.');
    } finally {
      setMenyimpan(false);
    }
  };

  // Amaran belum-simpan (Audit UI/UX §B2) — kotor apabila mana-mana medan sudah diisi, atau
  // peranan lalai (`editor` sahaja) sudah ditukar. Sebelum ni klik latar/X menutup borang terus
  // walaupun editor sudah menaip nama/emel.
  const kotor = !!email || roles.length !== 1 || roles[0] !== 'editor';
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
        {tunjukAmaran && <AmaranBelumSimpan onBatal={batalTutup} onSahkan={sahkanTutup} />}
        <label className="block">
          <span className={LABEL_BORANG}>Emel</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={INPUT_BORANG} />
        </label>
        <p className="text-[10px] text-stone-500 leading-relaxed">
          Nama pena, ID pengguna dan kata laluan tidak ditetapkan di sini; e-mel jemputan bertoken
          akan dihantar ke alamat emel di atas supaya anggota baharu menetapkan ketiga-tiganya sendiri.
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
