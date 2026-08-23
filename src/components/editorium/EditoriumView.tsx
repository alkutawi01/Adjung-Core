import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Rss, Clock, CalendarDays, Handshake, Quote, X } from 'lucide-react';
import { BRAND, LOGO_SIZE } from '../../config/brand';
import { EditoriumLayout } from './EditoriumLayout';
import { Tooltip } from '../common/Tooltip';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { Button } from '../common/Button';
import { IndeksConsole } from './IndeksConsole';
import { DrafSayaConsole } from './DrafSayaConsole';
import { DashboardConsole } from './DashboardConsole';
import { NotaKetuaEditorConsole } from './NotaKetuaEditorConsole';
import { PenajaConsole } from './PenajaConsole';
import { PetikanConsole } from './PetikanConsole';
import { MaklumanDrawer } from './MaklumanDrawer';
import { ProfilEditorModal } from './ProfilEditorModal';
import { DirektoriConsole } from './DirektoriConsole';
import { TetapanConsole } from './TetapanConsole';
import { EditorialConsole } from './EditorialConsole';
import { SenaraiSlotConsole } from './SenaraiSlotConsole';
import { TierKadConsole } from './TierKadConsole';
import { BidangConsole } from './BidangConsole';
import { TetapanAmSlotConsole } from './TetapanAmSlotConsole';
import { LogAuditConsole } from './LogAuditConsole';
import { PerlembagaanConsole } from './PerlembagaanConsole';
import { PanduanConsole } from './PanduanConsole';
import { SistemRekaBentukConsole } from './SistemRekaBentukConsole';
import { ContentReview } from '../studio/ContentReview';
import { SlotManagerModal } from '../portal/SlotManagerModal';
import { BarSlotManagerModal } from '../portal/BarSlotManagerModal';
import { PenugasanEditorPopover } from './PenugasanEditorPopover';
import { useModalFokus } from '../../hooks/useModalFokus';
import { useSlotEditor } from '../../hooks/useSlotEditor';
import { useTickerEditor } from '../../hooks/useTickerEditor';
import { TickerManagementModal } from '../portal/TickerManagementModal';
import { ToastContainer, ToastMessage } from '../common/Toast';
import { validateContentBudget } from '../../../core/editorial/ContentBudget.js';
import { TIER_SLOTS } from '../../../core/editorial/GeometryConfig.js';

// 2026-08-02 (Fasa 3) — mesej kunci akses seragam. Nav sidebar (EditoriumLayout.tsx) dah pun
// sorok destinasi yang tak dibenarkan, jadi ni jaring keselamatan (URL terus, sidebar lapuk
// belum dimuat semula) — bukan laluan biasa, tapi tak patut papar skrin kosong bila berlaku.
function AksesDitolak({ mesej }: { mesej: string }) {
  return (
    <div className="bg-white p-6 rounded-lg border border-stone-200 text-center py-16 font-sans">
      <div className="mb-2 flex justify-center"><Lock className="w-6 h-6 text-stone-400" /></div>
      <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">Akses Terhad</h3>
      <p className="text-xs text-stone-500 max-w-sm mx-auto">{mesej}</p>
    </div>
  );
}

// Baris sub-tab kongsi (2026-08-01, permintaan pemilik projek — susun semula nav Editorium ikut
// kategori) — satu komponen untuk keempat-empat kategori (Kandungan, Slot, Pentadbiran, Rujukan),
// gantikan 2 salinan JSX serupa yang terpisah sebelum ni. `locked` untuk sub-tab bersekat peranan
// (cth Tetapan, Ketua Editor sahaja) — dipaparkan kelabu + ikon kunci, klik tiada kesan, sama gaya
// visual macam sekatan peringkat kategori yang wujud dulu.
// Corak ARIA tab sebenar (2026-08-09, F1-1 Pusingan 3B, audit ChatGPT) — klik menukar PANEL
// kandungan dalam konteks halaman yang sama (bukan navigasi ke destinasi lain), jadi ini tab
// sebenar mengikut definisi ARIA, bukan navigasi. role="tablist"/"tab"/aria-selected + navigasi
// papan kekunci Arrow Left/Right + Home/End (roving tabindex — hanya tab aktif dalam urutan Tab
// biasa, Arrow pindah fokus antara tab). aria-controls/aria-labelledby ke panel TIDAK disambung
// di sini kerana panel dirender berasingan di setiap tapak panggilan tanpa id sepadan — menambah
// aria-controls menghala ke id yang tak wujud lebih teruk daripada tiada langsung.
function SubTabBar<T extends string>({ items, active, onChange }: {
  items: { id: T; label: string; locked?: boolean; lockedTitle?: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  const kendaliPapanKekunci = (e: React.KeyboardEvent, index: number) => {
    const bolehDipilih = items.filter((it) => !it.locked);
    if (bolehDipilih.length === 0) return;
    let sasaran: T | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const arah = e.key === 'ArrowRight' ? 1 : -1;
      let i = index;
      for (let langkah = 0; langkah < items.length; langkah++) {
        i = (i + arah + items.length) % items.length;
        if (!items[i].locked) { sasaran = items[i].id; break; }
      }
    } else if (e.key === 'Home') {
      sasaran = bolehDipilih[0].id;
    } else if (e.key === 'End') {
      sasaran = bolehDipilih[bolehDipilih.length - 1].id;
    }
    if (sasaran) {
      e.preventDefault();
      onChange(sasaran);
      // Pindahkan fokus papan kekunci sekali dengan pertukaran tab (roving tabindex) — tanpa ni
      // fokus kekal pada tab lama walaupun tab baharu kini aktif secara visual/logik.
      requestAnimationFrame(() => {
        document.getElementById(`subtab-${sasaran}`)?.focus();
      });
    }
  };

  return (
    <div className="flex flex-wrap gap-1 border-b border-stone-200 text-xs" role="tablist">
      {items.map((it, index) => (
        <Tooltip key={it.id} text={it.locked ? it.lockedTitle : undefined}>
          <button
            id={`subtab-${it.id}`}
            type="button"
            role="tab"
            aria-selected={active === it.id}
            tabIndex={active === it.id ? 0 : -1}
            onClick={() => !it.locked && onChange(it.id)}
            onKeyDown={(e) => kendaliPapanKekunci(e, index)}
            disabled={it.locked}
            aria-disabled={it.locked}
            aria-label={it.locked ? it.lockedTitle : undefined}
            className={`flex items-center gap-1.5 px-4 py-2 font-semibold tracking-wide transition-all border-b-2 ${
              active === it.id
                ? 'border-Adjung-maroon text-Adjung-maroon bg-stone-50'
                : it.locked
                ? 'border-transparent text-stone-300 cursor-not-allowed'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {it.label}
            {it.locked && <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

interface EditoriumViewProps {
  // null = belum log masuk. Peranan (KETUA_EDITOR/EDITOR) datang terus daripada akaun yang log
  // masuk — bukan lagi togol manual. `roles` (2026-08-02, Fasa 3) — senarai BERBILANG peranan
  // sebenar (pentadbir/ketua_editor/penolong_ketua_editor/editor), satu akaun boleh pegang lebih
  // daripada satu serentak. `role` legasi kekal sebagai label paparan sahaja.
  currentUser: { id: string; name: string; role: 'KETUA_EDITOR' | 'EDITOR'; roles: string[]; sesiTanda?: string } | null;
  onRequestLogin: () => void;
  onLogout: () => void;
  // Profil Editor (2026-08-01) — kemas kini nama pena serta-merta di sesi App.tsx (header/
  // Editorium papar nama tu) tanpa perlu log keluar-masuk semula.
  onProfilKemasKini: (patch: { penName?: string }) => void;
}

// Sesi log masuk (currentUser) kini state kongsi diangkat naik ke App.tsx — supaya FrontpageView
// (borang Tetapan Slot Bidang, butang "Edit Kandungan") turut boleh baca sesi yang sama.
export const EditoriumView: React.FC<EditoriumViewProps> = ({ currentUser, onRequestLogin, onLogout, onProfilKemasKini }) => {
  const navigate = useNavigate();
  // Segerak tab/sub-tab semasa ke URL (?tab=...&sub=...), 2026-08-07, teguran Izzat — "setiap kali
  // saya refresh ia kembali ke paparan utama. ini annoying". Laluan /editorium dahulu SATU laluan
  // tunggal untuk kesemua 12 destinasi + sub-tabnya — `activeTab` cuma state React biasa, jadi muat
  // semula (atau kongsi pautan) sentiasa jatuh balik ke Paparan Utama tak kira di mana editor
  // sebenarnya berada. Dibaca SEKALI sebagai nilai awal (useState lazy init) — perubahan
  // seterusnya kekal state React biasa (tak baca ulang setiap render), URL cuma DICERMIN keluar
  // via useEffect di bawah supaya arah aliran data satu hala, bukan dua sumber kebenaran.
  const [searchParams, setSearchParams] = useSearchParams();
  // Backdrop-click guard modal "Pilih Slot" di bawah (lihat LoginModal.tsx, pepijat Izzat
  // 2026-08-07) — kekal false selagi mousedown tak bermula terus pada backdrop.
  const mousedownPadaBackdropSlotPicker = React.useRef(false);
  // Fokus & Escape modal "Pilih Slot" (Audit UI/UX §G1/G2/G6) — refModalSlotPicker dipasang pada
  // ref hanya apabila modal dibuka (guna ternary di bawah), jadi cangkuk ni selamat dipanggil
  // tanpa syarat di sini (peraturan Hook React), refModal.current tinggal null selagi tertutup.
  const refModalSlotPicker = React.useRef<HTMLDivElement>(null);
  // Kebenaran berbilang peranan (2026-08-02, Fasa 3) — lihat DEFAULT_RBAC_MATRIX di
  // TetapanConsole.tsx / DEFAULT_ROLE_PERMISSIONS di core/middleware/auth.js untuk padanan
  // penuh. Ini cuma bayang RINGKAS di client untuk sorok/tunjuk nav — kawalan SEBENAR tetap di
  // server (requirePermission). isKetuaEditor = Nota Ketua Editor (tulis) sahaja; isEditorialAdmin
  // = Bidang/Editorial/RSS/Jam Dunia (Ketua Editor + Penolong/Timbalan); isPentadbir = Direktori/
  // Tetapan Sistem/Kawalan Akses.
  const roles = currentUser?.roles || [];
  const isKetuaEditor = roles.includes('ketua_editor');
  const isEditorialAdmin = isKetuaEditor || roles.includes('penolong_ketua_editor');
  const isPentadbir = roles.includes('pentadbir');
  // Konsol daun (IndeksConsole dll.) masih terima prop `currentUserRole` binari lama — Penolong/
  // Timbalan Ketua Editor patut berkelakuan SAMA macam Ketua Editor di skrin ni (bukan disempitkan
  // macam Editor biasa), jadi dipadankan ke sini sekali sahaja.
  const effectiveEditorialRole: 'KETUA_EDITOR' | 'EDITOR' = isEditorialAdmin ? 'KETUA_EDITOR' : 'EDITOR';

  // Dasar Terbit Sendiri Editor (2026-08-19, laporan Izzat: "jika editor boleh terbitkan dan edit
  // sendiri tanpa kelulusan ketua editor, penapis kandungan di kandungan default tukar status
  // drpd menunggu kepada aktif") — dimuat SEKALI di sini (induk), bukan dalam IndeksConsole
  // sendiri, supaya nilai SUDAH sedia sebelum IndeksConsole buat kiraan DEFAULT_FILTERS pertama
  // kali (lihat nota penuh di IndeksConsoleProps). `undefined` sehingga fetch selesai — dilayan
  // sama seperti `false` (kekalkan tingkah laku sedia ada) di pihak IndeksConsole.
  const [benarkanSelfPublish, setBenarkanSelfPublish] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    fetch('/api/system/editor-publish-policy')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => { if (d && typeof d.benarkanSelfPublish === 'boolean') setBenarkanSelfPublish(d.benarkanSelfPublish); })
      .catch(() => { /* senyap — Indeks jatuh balik ke tingkah laku sedia ada (Status=Pending) */ });
  }, []);
  // Destinasi peringkat atas (2026-08-01, permintaan pemilik projek — sidebar dua kumpulan, satu
  // klik terus). Lihat EditoriumLayout.tsx untuk susunan Operasi Harian / Tata Kelola & Rujukan.
  // Paparan Utama (Fasa 5) — destinasi lalai selepas log masuk, ganti Kandungan.
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'paparan_utama');
  // Sub-tab sasaran bila masuk Tetapan Sistem daripada pautan luar (2026-08-02, Fasa 7) —
  // cth kad "Jam Dunia" di Modul Khas. undefined = lalai biasa (PolisiKandungan).
  const [tetapanTujuSubTab, setTetapanTujuSubTab] = useState<'Operasi' | undefined>(undefined);
  // Tukar tab MELALUI pembalut ni (2026-08-07, pepijat Audit UI/UX §C2) — dahulu
  // `tetapanTujuSubTab` tak PERNAH ditetapkan semula selepas digunakan: sekali pintasan
  // "Urus Jam Dunia" diklik, SETIAP lawatan Tetapan Sistem seterusnya (walaupun melalui sidebar
  // biasa) terus melompat ke Operasi sepanjang baki sesi. Kosongkan ia apabila TINGGALKAN
  // 'tetapan' (bukan semasa masuk — TetapanConsole baca nilai ni sekali sahaja semasa lekap,
  // jadi mengosongkan semasa masuk akan membatalkan pintasan sebelum sempat dibaca).
  const tukarTab = (tab: string) => {
    if (activeTab === 'tetapan' && tab !== 'tetapan') setTetapanTujuSubTab(undefined);
    setActiveTab(tab);
  };

  // Tajuk tab pelayar ikut modul semasa (2026-08-07, Audit UI/UX §C4) — dahulu `document.title`
  // tak pernah berubah, kekal "Adjung Brief" pada kesemua 15 modul; beberapa tab Editorium
  // terbuka jadi tak dapat dibezakan. Label sepadan LABEL SIDEBAR (EditoriumLayout.tsx) persis —
  // jangan biarkan dua bertukar berasingan.
  useEffect(() => {
    const label: Record<string, string> = {
      paparan_utama: 'Paparan Utama', draf_saya: 'Draf Saya', kandungan: 'Kandungan',
      slot: 'Slot', modul_khas: 'Modul Khas', editorial: 'Editorial',
      nota_ketua_editor: 'Nota Ketua Editor', direktori: 'Direktori', tetapan: 'Tetapan',
      panduan: 'Panduan', dokumentasi: 'Dokumentasi', log_sistem: 'Log Sistem', penaja: 'Penaja',
      petikan: 'Petikan',
    };
    document.title = label[activeTab]
      ? `${label[activeTab]} · Editorium · Adjung Brief`
      : 'Adjung Brief';
    return () => { document.title = 'Adjung Brief'; };
  }, [activeTab]);
  // Log keluar = keluar terus ke frontpage. Editorium bukan tempat untuk sesiapa yang tak log
  // masuk — dulu pengguna ditinggalkan di /editorium (skrin pagar) selepas log keluar.
  //
  // `sedangKeluar` wujud sebab peralihan laman ni beransur (AnimatePresence, 0.4s): sebaik sesi
  // dikosongkan, laman lama masih di skrin sepanjang animasi keluar tu — dan tanpa sesi ia
  // melukis skrin pagar "Log Masuk" untuk seketika sebelum frontpage muncul. Sepanjang kita
  // sedang beredar, jangan lukis skrin pagar langsung.
  const [sedangKeluar, setSedangKeluar] = useState(false);
  const handleLogoutAndLeave = () => {
    setSedangKeluar(true);
    navigate('/');
    onLogout();
  };
  // Sub-tab DALAMAN destinasi "Kandungan" (2026-07-29) — Indeks dan Semakan Kandungan sahaja.
  // Draf Saya, Nota Ketua Editor, Modul Khas kini destinasi SENDIRI di sidebar (2026-08-01), bukan
  // sub-tab kategori — satu klik terus, ikut susunan yang pemilik projek nak.
  // Nilai awal sub-tab dibaca daripada URL HANYA bila `tab` di URL sepadan destinasi tu — kalau
  // tidak, `sub` sisa daripada destinasi lain (cth ?tab=kandungan&sub=bidang lapuk) tak sepatutnya
  // bocor jadi sub-tab awal Slot.
  const subAwal = <T extends string>(tab: string, pilihan: readonly T[], lalai: T): T => {
    const nilai = searchParams.get('tab') === tab ? searchParams.get('sub') : null;
    return (pilihan as readonly string[]).includes(nilai || '') ? (nilai as T) : lalai;
  };
  const [kandunganSubTab, setKandunganSubTab] = useState<'indeks' | 'semakan'>(
    () => subAwal('kandungan', ['indeks', 'semakan'] as const, 'indeks')
  );
  // Sub-tab DALAMAN destinasi "Slot" (2026-07-30) — tidak berubah struktur.
  const [slotSubTab, setSlotSubTab] = useState<'senarai' | 'tier' | 'bidang' | 'tetapan_am'>(
    () => subAwal('slot', ['senarai', 'tier', 'bidang', 'tetapan_am'] as const, 'senarai')
  );
  // Sub-tab DALAMAN destinasi "Dokumentasi" (2026-08-01) — Peraturan Am (Perlembagaan) + Reka
  // Bentuk. Log Sistem kini destinasi sendiri, tak lagi sub-tab sini.
  const [rujukanSubTab, setRujukanSubTab] = useState<'peraturan_am' | 'reka_bentuk'>(
    () => subAwal('dokumentasi', ['peraturan_am', 'reka_bentuk'] as const, 'peraturan_am')
  );
  // Cerminkan activeTab + sub-tab BERKAITAN semasa ke URL (replace, bukan push — menukar tab
  // TIDAK sepatutnya menambah entri baharu pada sejarah pelayar setiap klik, cuma Undur/Maju
  // sepatutnya kekal tersedia untuk navigasi SEBENAR macam buka Focus View). `sub` cuma ditulis
  // untuk destinasi yang benar-benar ada sub-tab; destinasi lain buang parameter tu terus supaya
  // URL tak simpan sisa lapuk dari lawatan sebelumnya.
  useEffect(() => {
    const sub = activeTab === 'kandungan' ? kandunganSubTab
      : activeTab === 'slot' ? slotSubTab
      : activeTab === 'dokumentasi' ? rujukanSubTab
      : null;
    const semasa = new URLSearchParams(searchParams);
    semasa.set('tab', activeTab);
    if (sub) semasa.set('sub', sub); else semasa.delete('sub');
    if (semasa.toString() !== searchParams.toString()) setSearchParams(semasa, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, kandunganSubTab, slotSubTab, rujukanSubTab]);
  // Tulis Kandungan (2026-07-29) — mandiri sepenuhnya, lihat useSlotEditor.ts. Hantar nama editor
  // log masuk supaya setiap Simpan/Terbit catat siapa sebenarnya terbitkan kandungan tu.
  const slotEditor = useSlotEditor(currentUser?.name);
  // Fokus & Escape modal "Pilih Slot" (Audit UI/UX §G1/G2/G6) — `onTutup` cuma aktif apabila
  // modal sebenarnya terbuka, supaya Escape di tempat lain dalam Editorium tak disilap tangkap.
  // `terbuka` WAJIB dihantar eksplisit di sini (2026-08-16, pepijat kunci skrol — lihat nota di
  // useModalFokus.ts) — hook ni lekap SEKALI di peringkat cangkang halaman, bukan setiap kali
  // modal buka, jadi lalai `true` akan kunci skrol Editorium SELAMANYA sebaik dimuat.
  useModalFokus(
    refModalSlotPicker,
    slotEditor.showSlotPicker ? () => slotEditor.setShowSlotPicker(false) : undefined,
    slotEditor.showSlotPicker
  );
  // Slot Bar (2026-08-02, Fasa 7, item kedua terakhir) — native Editorium, gantikan borang LAMA
  // di FrontpageView.tsx yang tiada titik masuk UI langsung lagi (pencetus TERAKHIR isEditMode,
  // "?openTicker=1", dibuang sesi ni). useSlotEditor.ts SUDAH generik sepenuhnya (fetch/save
  // /api/system/slots untuk mana-mana slotIndex, tak kisah tier) — bukan dicipta hook berasingan
  // (useBarSlotEditor.ts) sebab itu cuma akan menyalin semula logik yang sama persis; instance
  // KEDUA di sini (state berasingan daripada slotEditor bukan-Bar di atas) semata-mata supaya dua
  // borang (SlotManagerModal biasa dan BarSlotManagerModal) tak berkongsi editingSlotIndex/
  // formConfig dan saling tindih apabila dibuka serentak.
  const barSlotEditor = useSlotEditor(currentUser?.name);
  // Ticker (2026-08-02, Fasa 7, item terakhir) — native Editorium, gantikan sambungan URL
  // "?openTicker=1" lama ke FrontpageView.tsx. Lihat useTickerEditor.ts untuk sejarah penuh.
  const tickerEditor = useTickerEditor();
  // Toast KONGSI seluruh Editorium (2026-08-08, Izzat: "terbit senyap-senyap tanpa makluman") —
  // dahulu skop hanya untuk Modul Ticker (tickerToasts), diselaraskan supaya mana-mana konsol
  // (Kandungan, Urus Slot) boleh papar toast SEBENAR selepas tindakan (Terbit/Arkib/Tolak), bukan
  // cuma mesej dalaman modal yang hilang lepas beberapa saat.
  const [editoriumToasts, setEditoriumToasts] = useState<ToastMessage[]>([]);
  const pushToast = (
    type: 'success' | 'error' | 'info',
    message: string,
    action?: { label: string; onClick: () => void },
    opts?: { bolehSalinAI?: boolean }
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setEditoriumToasts((prev) => [...prev, { id, type, message, action, bolehSalinAI: opts?.bolehSalinAI }]);
  };
  const dismissToast = (id: string) => {
    setEditoriumToasts((prev) => prev.filter((t) => t.id !== id));
  };
  // Navigasi terarah ke Indeks yang SUDAH ditapis (WF-01/WF-06, Pusingan 5, audit ChatGPT
  // 2026-08-09) — gantikan corak lama "keluar dari sini, tukar tab sendiri, cari semula secara
  // manual". `generasi` bertambah setiap panggilan supaya klik kedua pada slot/status SAMA
  // tetap mencetuskan semula useEffect IndeksConsole.
  const [penapisIndeksAwal, setPenapisIndeksAwal] = useState<{ slot?: string; status?: string; generasi: number }>({ generasi: 0 });
  const lihatDiIndeks = (opts: { slot?: string; status?: string }) => {
    setPenapisIndeksAwal((prev) => ({ ...opts, generasi: prev.generasi + 1 }));
    setKandunganSubTab('indeks');
    setActiveTab('kandungan');
  };
  // Konteks editor Direktori -> Senarai Slot (WF-05, Pusingan 5, audit ChatGPT 2026-08-09).
  const [editorAwalSlot, setEditorAwalSlot] = useState<{ nama: string; generasi: number }>({ nama: '', generasi: 0 });
  const urusPenugasanSlotUntuk = (nama: string) => {
    setEditorAwalSlot((prev) => ({ nama, generasi: prev.generasi + 1 }));
    setSlotSubTab('senarai');
    setActiveTab('slot');
  };
  // Draf yang diklik di "Draf Saya" (2026-08-01) — dihantar ke SlotManagerModal supaya modal
  // terbuka betul-betul pada draf itu, bukan pada kandungan pertama slot. Dikosongkan setiap kali
  // modal dibuka melalui laluan lain (pemilih slot, tukar slot dalam modal).
  const [drafDibuka, setDrafDibuka] = useState<string>('');
  const [drafVersi, setDrafVersi] = useState(0);
  const tutupRuangMenulis = () => {
    slotEditor.closeSlotEditor();
    setDrafVersi((v) => v + 1);
  };
  const bukaDraf = (slotIndex: number, uuid: string) => {
    setDrafDibuka(uuid);
    slotEditor.openSlotEditor(slotIndex);
  };

  // Peti Makluman (2026-08-01, spesifikasi pemilik projek) — senarai nota dimiliki di SINI, bukan
  // dalam EditoriumLayout, supaya lencana kiraan di header dan laci gelongsor membaca senarai yang
  // SAMA. Kalau setiap satu mengambil sendiri, kiraan boleh menunjukkan nombor yang tidak sepadan
  // dengan apa yang sebenarnya terpapar bila dibuka.
  const [notaMakluman, setNotaMakluman] = useState<any[]>([]);
  // Fasa 6b (2026-08-02) — notifikasi PER-EDITOR (`notifications`), berasingan daripada nota
  // Ketua Editor di atas (tiada resit baca). `kiraanBelumBaca` datang terus daripada laluan
  // kiraan khusus server (bukan senarai.filter di klien) supaya ia tepat walaupun senarai penuh
  // belum dimuatkan (drawer belum dibuka).
  const [notifikasiMakluman, setNotifikasiMakluman] = useState<any[]>([]);
  const [kiraanBelumBaca, setKiraanBelumBaca] = useState(0);
  const [memuatMakluman, setMemuatMakluman] = useState(true);
  const [makluanTerbuka, setMaklumanTerbuka] = useState(false);
  // Dinaikkan selepas konsol Nota menyimpan sesuatu, supaya lencana header tak kekal lapuk.
  const [maklumanVersi, setMaklumanVersi] = useState(0);

  // Profil Editor (2026-08-01, spesifikasi pemilik projek — aksesori header). Dipermudah
  // 2026-08-02 (Izzat: "ni bukan medsos, hanya utk rujukan dalaman") — Nama Pena sahaja, avatar/
  // tandatangan/bio dibuang. Nama pena tetap diambil dari /api/db-state bila modal dibuka (prop
  // `currentUser` cuma bawa id/name/role dari sesi log masuk, mungkin lapuk berbanding DB).
  const [profilTerbuka, setProfilTerbuka] = useState(false);
  const [profilData, setProfilData] = useState<{
    id: string; penName: string; username: string; email: string;
    namaPenuh?: string; kelulusanKursus?: string; kelulusanUniversiti?: string;
    kelulusanTahun?: string; negeriMenetap?: string; nomborTelefon?: string;
  } | null>(null);
  // 2026-08-05 (audit) — dahulu ambil emel/username sendiri drpd GET /api/db-state (laluan
  // AWAM). Pembetulan keselamatan hari sama (tutup kebocoran resetToken) buang `email` drpd
  // db-state — betul untuk laluan awam, tapi pecahkan paparan ni secara senyap. Kini guna
  // GET /api/system/profile/:id (perlu sesi, pemilik sendiri sahaja) yang dibina khusus.
  const bukaProfil = () => {
    fetch(`/api/system/profile/${currentUser?.id}`)
      .then((r) => r.json())
      .then((d) => {
        const u = d.user;
        setProfilData({
          id: currentUser!.id,
          penName: u?.penName || currentUser!.name,
          username: u?.username || '',
          email: u?.email || '',
          namaPenuh: u?.namaPenuh || '',
          kelulusanKursus: u?.kelulusanKursus || '',
          kelulusanUniversiti: u?.kelulusanUniversiti || '',
          kelulusanTahun: u?.kelulusanTahun || '',
          negeriMenetap: u?.negeriMenetap || '',
          nomborTelefon: u?.nomborTelefon || '',
        });
        setProfilTerbuka(true);
      })
      .catch(() => {
        setProfilData({ id: currentUser!.id, penName: currentUser!.name, username: '', email: '' });
        setProfilTerbuka(true);
      });
  };

  // Kiraan belum-baca (lencana header) — dimuatkan berasingan daripada senarai penuh (bawah)
  // supaya lencana tepat tanpa perlu buka laci dahulu. Muat semula lepas drawer ditutup (kiraan
  // mungkin berubah sebab tanda-dibaca) dan lepas maklumanVersi naik (nota baharu Ketua Editor).
  useEffect(() => {
    if (!currentUser) return;
    fetch('/api/system/notifications/unread-count')
      .then((r) => r.json())
      .then((d) => setKiraanBelumBaca(typeof d?.count === 'number' ? d.count : 0))
      // Audit UI/UX §D7 — dahulu ditelan senyap sepenuhnya; console.warn sekurang-kurangnya
      // memberi jejak bagi sesiapa yang menyiasat lencana kekal salah.
      .catch((e) => console.warn('Gagal muat kiraan makluman belum baca:', e.message));
  }, [currentUser, maklumanVersi, makluanTerbuka]);

  useEffect(() => {
    if (!currentUser) return;
    setMemuatMakluman(true);
    Promise.all([
      fetch('/api/system/editor-notes?status=aktif').then((r) => r.json()).catch(() => []),
      fetch('/api/system/notifications').then((r) => r.json()).catch(() => []),
    ]).then(([notaData, notifData]) => {
      setNotaMakluman(
        (Array.isArray(notaData) ? notaData : []).map((n: any) => ({ ...n, jenisSumber: 'nota_ketua_editor' }))
      );
      setNotifikasiMakluman(
        (Array.isArray(notifData) ? notifData : []).map((n: any) => ({ ...n, jenisSumber: 'notifikasi' }))
      );
    }).finally(() => setMemuatMakluman(false));
  }, [currentUser, maklumanVersi]);

  const bukaMakluman = () => {
    setMaklumanTerbuka(true);
  };

  // Tanda-dibaca bila drawer DITUTUP, BUKAN dibuka (2026-08-16, aduan Izzat — "kenapa tak flag
  // mesej yg baru?"). Punca sebenar: sebelum ni tanda-SEMUA-dibaca tercetus SEBAIK laci dibuka
  // (lihat sejarah git) — dalam masa SATU pusingan rangkaian (bilangan milisaat), setiap titik/
  // penonjol "baharu" pada senarai HILANG SEBELUM Izzat sempat nampak yang mana sebenarnya baharu.
  // Lencana bell janji "ada sesuatu baru", tapi bukti visual tu sendiri lesap serta-merta bila dia
  // cuba tengok. Kini tanda-dibaca tercetus di sini (bila laci TUTUP) — sepanjang laci terbuka,
  // titik/penonjol kekal kelihatan (Izzat ada masa penuh untuk imbas), cuma dikosongkan bila dia
  // dah selesai tengok dan tutup laci, iaitu isyarat "saya dah nampak semua ni" yang lebih tepat.
  const tutupMakluman = () => {
    setMaklumanTerbuka(false);
    fetch('/api/system/notifications/mark-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(() => {
        setNotifikasiMakluman((prev) => prev.map((n) => ({ ...n, dibaca: true })));
        setKiraanBelumBaca(0);
      })
      .catch((e) => console.warn('Gagal tanda semua makluman dibaca:', e.message));
  };

  // Padam notifikasi (2026-08-16, Izzat: "inbox saya masih belum dibersihkan... takde cara ke
  // nak delete kandungan secara manual?") — sebelum ni cuma tanda-dibaca wujud, TIADA cara buang
  // baris terus, jadi senarai membesar selama-lamanya. Kemas kini optimistik (sepadan corak
  // klikNotifikasi di atas) — buang dari paparan serta-merta, pulihkan kalau pelayan gagal.
  const padamNotifikasi = (id: string) => {
    const sandaran = notifikasiMakluman;
    setNotifikasiMakluman((prev) => prev.filter((n) => n.id !== id));
    fetch(`/api/system/notifications/${id}`, { method: 'DELETE' }).catch((e) => {
      console.warn('Gagal padam notifikasi, memulihkan paparan:', e.message);
      setNotifikasiMakluman(sandaran);
    });
  };

  const klikNotifikasi = (id: string) => {
    // Kemas kini optimistik (2026-08-07, Audit UI/UX §D7) — dahulu tak dipulihkan bila gagal:
    // lencana NAMPAK kosong walaupun server masih kira belum baca, ia muncul semula pada muat
    // semula seterusnya tanpa penjelasan. Kini dipulihkan (balikkan kedua-dua state) bila
    // permintaan gagal, supaya paparan sentiasa sepadan realiti server.
    setNotifikasiMakluman((prev) => prev.map((n) => (n.id === id ? { ...n, dibaca: true } : n)));
    setKiraanBelumBaca((c) => Math.max(0, c - 1));
    fetch('/api/system/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch((e) => {
      console.warn('Gagal tanda makluman dibaca, memulihkan paparan:', e.message);
      setNotifikasiMakluman((prev) => prev.map((n) => (n.id === id ? { ...n, dibaca: false } : n)));
      setKiraanBelumBaca((c) => c + 1);
    });
  };

  // Tetapkan editor terus daripada pemilih slot "Tulis Kandungan" (2026-08-01, permintaan pemilik
  // projek) — sebelum ni satu-satunya tempat menetapkan editor slot ialah Editorium → Slot →
  // Senarai Slot, jauh daripada tempat sebenar editor mula menulis. Dimuatkan lazily (hanya bila
  // pemilih dibuka) supaya Editorium tak menghantar panggilan API yang tak diperlukan setiap kali
  // dibuka, sebelum "Tulis Kandungan" pun diklik.
  const [pengguna, setPengguna] = useState<{ id: string; penName?: string; username?: string; isSuspended?: boolean }[]>([]);
  const [penugasanSlot, setPenugasanSlot] = useState<{ slotIndex: number; editorId: string; nama: string }[]>([]);
  const [popoverEditorSlot, setPopoverEditorSlot] = useState<number | null>(null);

  const muatPenugasanSlot = () =>
    fetch('/api/system/slot-editors').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setPenugasanSlot(d); }).catch(() => {});

  // Penugasan dimuatkan semasa LEKAPAN, bukan lagi lazily bila pemilih dibuka (2026-08-08,
  // Fasa 2) — ia kini menentukan slot mana editor boleh capai LANGSUNG, jadi ia diperlukan
  // walaupun pemilih tak pernah dibuka (cth. masuk terus melalui "Draf Saya", atau dropdown
  // tukar slot dalam ruang menulis). Senarai pengguna kekal lazy: ia cuma untuk popover
  // "tetapkan editor", yang memang hanya wujud dalam pemilih.
  useEffect(() => {
    if (!currentUser) return;
    muatPenugasanSlot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (!slotEditor.showSlotPicker) return;
    muatPenugasanSlot();
    fetch('/api/db-state').then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.users)) setPengguna(d.users.filter((u: any) => !u.isSuspended)); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotEditor.showSlotPicker]);

  const editorBagiSlot = (i: number) => penugasanSlot.filter((p) => p.slotIndex === i);

  // Gerbang akses slot di klien (2026-08-08, Fasa 2) — Ketua Editor/Penolong capai semua slot;
  // Editor biasa hanya slot yang DIA ditugaskan. Slot tanpa tugasan langsung TIDAK terbuka
  // kepada Editor biasa (keputusan Izzat) — ia milik Ketua Editor/Penolong sehingga ditugaskan.
  // Ini penapis PAPARAN sahaja; gerbang sebenar di server (POST /api/system/slots).
  const slotBolehDicapai = (i: number) =>
    isEditorialAdmin || penugasanSlot.some((p) => p.slotIndex === i && p.editorId === currentUser?.id);

  // Senarai slot bento (bukan Bar) yang pengguna semasa boleh tulis — dikongsi oleh pemilih slot
  // dan dropdown "tukar slot" dalam ruang menulis supaya kedua-duanya tak boleh terpesong.
  const slotBolehTulis = Array.from({ length: 38 }, (_, i) => i)
    .filter((i) => !TIER_SLOTS.BAR.includes(i) && slotBolehDicapai(i));

  const simpanEditorSlot = async (i: number, editorIds: string[]) => {
    try {
      const res = await fetch('/api/system/slot-editors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotIndex: i, editorIds }),
      });
      if (!res.ok) return false;
      await muatPenugasanSlot();
      setPopoverEditorSlot(null);
      return true;
    } catch {
      return false;
    }
  };

  // Buka borang log masuk SENDIRI sebaik /editorium dilawati tanpa sesi (2026-08-01, maklum
  // balas pemilik projek) — bukan tunggu pengguna klik satu butang dulu untuk "minta" borang.
  useEffect(() => {
    if (!currentUser && !sedangKeluar) onRequestLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, sedangKeluar]);

  // Sedang beredar ke frontpage selepas log keluar — biarkan kosong sepanjang animasi keluar,
  // jangan sesekali kelipkan skrin pagar.
  if (sedangKeluar) return null;

  if (!currentUser) {
    // Skrin pagar (2026-08-01, maklum balas pemilik projek — "view sebegini tidak patut wujud
    // sama sekali") — dulu skrin ni membalut EditoriumLayout PENUH: sidebar/header dengan
    // sebelas destinasi kelabu terkunci, cuma untuk papar SATU mesej + SATU butang di tengah.
    // Chrome penuh tu langsung tak berguna sebelum log masuk — tiada apa boleh diklik pun.
    // Kini TIADA EditoriumLayout langsung: skrin kosong minimum, dan borang log masuk dibuka
    // SENDIRI (useEffect di bawah) — pengguna nampak borang terus, tanpa perlu klik dulu untuk
    // "minta" borang yang sepatutnya sudah tersedia.
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-2 text-stone-400">
          <span className={`font-serif ${LOGO_SIZE.gate} text-stone-300`}>{BRAND.logoText}</span>
          <p className="text-xs">Log masuk diperlukan untuk mengakses Editorium.</p>
        </div>
      </div>
    );
  }

  return (
    <EditoriumLayout
      activeTab={activeTab}
      onTabChange={tukarTab}
      currentUser={currentUser}
      onRequestLogin={onRequestLogin}
      onLogout={handleLogoutAndLeave}
      onOpenSlotPicker={() => slotEditor.setShowSlotPicker(true)}
      onOpenMakluman={bukaMakluman}
      jumlahMakluman={kiraanBelumBaca}
      onOpenProfil={bukaProfil}
    >
      {/* Paparan Utama (Fasa 5) — destinasi lalai selepas log masuk. */}
      {activeTab === 'paparan_utama' && (
        <DashboardConsole onTukarTab={setActiveTab} />
      )}

      {/* OPERASI HARIAN — destinasi kerja editorial setiap hari. */}

      {/* Kandungan — Indeks rasmi + Semakan pukal. Draf Saya/Nota Ketua Editor/Modul Khas kini
          destinasi sendiri (2026-08-01), bukan sub-tab kategori sama. */}
      {activeTab === 'kandungan' && (
        <div className="space-y-4 font-sans">
          <SubTabBar
            items={[
              { id: 'indeks', label: '1. Indeks' },
              { id: 'semakan', label: '2. Semakan Kandungan' },
            ]}
            active={kandunganSubTab}
            onChange={setKandunganSubTab}
          />
          {kandunganSubTab === 'indeks' && (
            <IndeksConsole
              currentUserRole={effectiveEditorialRole}
              currentUserName={currentUser.name}
              sesiTanda={currentUser.sesiTanda}
              onToast={pushToast}
              penapisAwal={penapisIndeksAwal}
              benarkanSelfPublish={benarkanSelfPublish}
            />
          )}
          {kandunganSubTab === 'semakan' && <ContentReview />}
        </div>
      )}

      {activeTab === 'draf_saya' && (
        <DrafSayaConsole
          editorId={currentUser.id}
          editorName={currentUser.name}
          onBukaDraf={bukaDraf}
          versi={drafVersi}
          onTulisKandungan={() => slotEditor.setShowSlotPicker(true)}
        />
      )}

      {/* Nota Ketua Editor (2026-08-01, spesifikasi pemilik projek) — tempat Ketua Editor MENULIS
          nota, bukan destinasi Editor lain membaca. Ketua Editor sahaja (dikunci di
          EditoriumLayout.tsx sidebar); Editor terima nota yang diterbitkan melalui Peti
          Makluman, bukan dengan membuka destinasi ni. */}
      {activeTab === 'nota_ketua_editor' && !isKetuaEditor && (
        <AksesDitolak mesej="Nota Ketua Editor khusus untuk Ketua Editor." />
      )}
      {activeTab === 'nota_ketua_editor' && isKetuaEditor && (
        <NotaKetuaEditorConsole
          editorId={currentUser.id}
          editorName={currentUser.name}
          bolehUrus
          onBerubah={() => setMaklumanVersi((v) => v + 1)}
        />
      )}

      {/* Modul Khas dirender TERUS di sini (bukan fail *Console.tsx tersendiri) — sebab itulah ia
          terlepas daripada audit reka bentuk 2026-08-07 yang mengimbas fail Console sahaja, lalu
          tertinggal dengan tajuk sans-xs lama sedangkan 15 modul lain sudah bertukar. Kini ia
          mengikut templat modul yang SAMA (Pelan 01 Fasa C/D1). */}
      {activeTab === 'modul_khas' && (
        <div className="space-y-4 font-sans">
          <ModulTajuk
            tajuk="Modul Khas"
            huraian="Jam, Ticker, dan Slot Bar ada peraturan penyuntingan tersendiri, berasingan daripada kad bento biasa."
          />
          <PanelCard className="space-y-4">
          {/* Ikon + lebar butang diseragamkan (2026-08-07, Izzat tangkap: dua drpd empat baris ni
              tiada ikon langsung — Ticker/Slot Bar ada `Radio`, Jam Dunia/Penaja tiada — dan
              lebar butang "Urus X" ikut panjang teks label, jadi empat butang dlm satu lajur
              menegak nampak tak sejajar). Ikon `Radio` (isyarat penyiaran) turut diganti — ia
              sesuai utk Ticker (suapan berita) tapi tiada kaitan konsep dgn Slot Bar (acara/
              penganjur/lokasi). Setiap baris kini ikon sepadan konsepnya sendiri; keempat-empat
              butang `w-[136px]` tetap (muat selesa "Urus Jam Dunia", label terpanjang). */}
          <div className="flex items-center justify-between gap-4 border border-stone-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Rss className="w-4 h-4 text-Adjung-maroon" />
              <div>
                <div className="text-sm font-semibold text-stone-800">Ticker (Berita Semasa)</div>
                <div className="text-[11px] text-stone-500">RSS, animasi, status, tetapan penyuntingan khas.</div>
              </div>
            </div>
            {/* Modal Ticker (TickerManagementModal) kini render TERUS di Editorium (2026-08-02,
                Fasa 7) — lihat useTickerEditor.ts. Sambungan URL "?openTicker=1" lama ke
                FrontpageView.tsx dibuang; lihat nota di FrontpageView.tsx untuk sebab kekal. */}
            <Button
              onClick={() => tickerEditor.openTickerEditor()}
              className="shrink-0 w-[136px]"
              >
              Urus Ticker
            </Button>
          </div>
          {/* 2026-08-02 (Fasa 7) — kad ni dulu kata "Belum disambungkan ke Editorium", tapi
              tetapan Jam Dunia (selang auto-slaid, suis klik latar, status API Cuaca/Kalendar
              Cuti) SUDAH pun wujud & berfungsi di Tetapan Sistem → Operasi — cuma tersorok di
              sana, bukan sebenarnya tak disambung. Kad ni kini pautan terus ke situ. */}
          <div className="flex items-center justify-between gap-4 border border-stone-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-Adjung-maroon" />
              <div>
                <div className="text-sm font-semibold text-stone-800">Jam Dunia</div>
                <div className="text-[11px] text-stone-500">Selang auto-slaid, suis latar, status API Cuaca &amp; Kalendar Cuti.</div>
              </div>
            </div>
            <Button
              onClick={() => { setTetapanTujuSubTab('Operasi'); setActiveTab('tetapan'); }}
              className="shrink-0 w-[136px]"
              >
              Urus Jam Dunia
            </Button>
          </div>
          {/* Slot Bar (2026-08-02, Fasa 7) — kad ni dulu kata "Belum disambungkan ke Editorium",
              tapi laluan LAMA (klik kad Bar di FrontpageView semasa isEditMode) sudah tiada
              langsung titik masuk UI (pencetus terakhir isEditMode dibuang sesi ni). Kini native
              di sini — lihat BarSlotManagerModal.tsx. Buka pada slot Bar PERTAMA (indeks terkecil
              dalam TIER_SLOTS.BAR); dropdown dalam modal boleh tukar ke slot Bar lain. */}
          <div className="flex items-center justify-between gap-4 border border-stone-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="w-4 h-4 text-Adjung-maroon" />
              <div>
                <div className="text-sm font-semibold text-stone-800">Slot Bar</div>
                <div className="text-[11px] text-stone-500">Acara/Penganjur/Lokasi/Akses/Penerangan: {TIER_SLOTS.BAR.length} slot bar.</div>
              </div>
            </div>
            {/* Buka slot Bar PERTAMA yang pengguna boleh capai (2026-08-08, Fasa 2) — bukan lagi
                sentiasa indeks terkecil TIER_SLOTS.BAR tanpa syarat, sebab Editor biasa mungkin
                tak ditugaskan slot Bar pertama langsung. Butang dilumpuhkan kalau tiada satu pun
                slot Bar boleh dicapai. */}
            {(() => {
              const slotBarBoleh = TIER_SLOTS.BAR.filter((i: number) => slotBolehDicapai(i));
              return (
                <Button
                  onClick={() => slotBarBoleh.length > 0 && barSlotEditor.openSlotEditor(slotBarBoleh[0])}
                  disabled={slotBarBoleh.length === 0}
                  className="shrink-0 w-[136px]"
                  >
                  Tulis Acara
                </Button>
              );
            })()}
          </div>
          {/* Penaja (2026-08-05, Fasa 12) — tajaan bulanan, Pentadbir sahaja (keputusan
              perniagaan/penempatan, bukan editorial harian — kunci manageSettings sama macam
              Direktori/Tetapan). Editor/Ketua Editor biasa nampak kad ni tapi klik akan ditolak
              (AksesDitolak di destinasi 'penaja' di bawah), sama corak macam kad lain di sini
              tak sorok berdasarkan peranan pelawat. */}
          <div className="flex items-center justify-between gap-4 border border-stone-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Handshake className="w-4 h-4 text-Adjung-maroon" />
              <div>
                <div className="text-sm font-semibold text-stone-800">Penaja</div>
                <div className="text-[11px] text-stone-500">Tajaan bulanan: footer & halaman /penaja awam.</div>
              </div>
            </div>
            <Button
              onClick={() => setActiveTab('penaja')}
              className="shrink-0 w-[136px]"
              >
              Urus Penaja
            </Button>
          </div>
          {/* Petikan (2026-08-19, permintaan Izzat — "anggap je quote ni modul khas") — kandungan
              editorial sampingan di margin kiri Frontpage pada skrin lebar. Digerbang
              `manageEditorial` (editorial harian, BUKAN keputusan perniagaan) — jadi Ketua
              Editor/Penolong boleh urus, tidak seperti Penaja yang Pentadbir sahaja. */}
          <div className="flex items-center justify-between gap-4 border border-stone-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Quote className="w-4 h-4 text-Adjung-maroon" />
              <div>
                <div className="text-sm font-semibold text-stone-800">Petikan</div>
                <div className="text-[11px] text-stone-500">Petikan karya di margin kiri Frontpage (skrin lebar). Boleh dihidup/matikan.</div>
              </div>
            </div>
            <Button
              onClick={() => setActiveTab('petikan')}
              className="shrink-0 w-[136px]"
              >
              Urus Petikan
            </Button>
          </div>
          </PanelCard>
        </div>
      )}

      {activeTab === 'penaja' && (
        isPentadbir
          ? <PenajaConsole />
          : <AksesDitolak mesej="Penaja khusus untuk Pentadbir." />
      )}

      {/* Petikan (2026-08-19) — digerbang `isEditorialAdmin` supaya sepadan TEPAT dengan gerbang
          pelayan `manageEditorial` (petikanRoutes.js). Ketua Editor DAN Penolong boleh urus;
          Editor biasa ditolak di sini dan juga di pelayan (dua lapisan, bukan hanya UI). */}
      {activeTab === 'petikan' && (
        isEditorialAdmin
          ? <PetikanConsole />
          : <AksesDitolak mesej="Petikan khusus untuk Ketua Editor dan Penolong Ketua Editor." />
      )}

      {/* Slot — segala yang MENTAKRIFKAN slot: bentuk, Bidang, warna, had aksara, animasi.
          Senarai KANDUNGAN dalam slot sengaja tiada di sini — Ketua Editor menyunting kandungan
          di Kandungan → Semakan Kandungan. */}
      {activeTab === 'slot' && (
        <div className="space-y-4 font-sans">
          <SubTabBar
            items={[
              { id: 'senarai', label: '1. Senarai Slot' },
              { id: 'tier', label: '2. Tier Kad' },
              { id: 'bidang', label: '3. Bidang' },
              { id: 'tetapan_am', label: '4. Tetapan Am' },
            ]}
            active={slotSubTab}
            onChange={setSlotSubTab}
          />
          {slotSubTab === 'senarai' && <SenaraiSlotConsole currentEditoriumRole={effectiveEditorialRole} onLihatIndeks={lihatDiIndeks} editorAwal={editorAwalSlot} />}
          {slotSubTab === 'tier' && <TierKadConsole />}
          {slotSubTab === 'bidang' && <BidangConsole />}
          {slotSubTab === 'tetapan_am' && <TetapanAmSlotConsole />}
        </div>
      )}

      {/* TATA KELOLA & RUJUKAN — pentadbiran dan dokumen rujukan, bukan kerja editorial harian. */}

      {/* Editorial (2026-08-01, spesifikasi pemilik projek) — peraturan BAHASA: autocondong,
          glosari/penyelarasan ejaan, templat penjanaan AI. 2026-08-02 (Fasa 3): Ketua Editor
          DAN Penolong/Timbalan Ketua Editor (kuasa manageEditorial dikongsi) — bukan Ketua
          Editor sahaja lagi. */}
      {activeTab === 'editorial' && (
        isEditorialAdmin
          ? <EditorialConsole />
          : <AksesDitolak mesej="Editorial khusus untuk Ketua Editor / Penolong Ketua Editor." />
      )}

      {/* Direktori & Tetapan (2026-08-02, Fasa 3) — domain Pentadbir (teknikal), BUKAN Ketua
          Editor lagi kecuali dia turut dilantik Pentadbir. Dahulu terbuka untuk sesiapa log
          masuk (Direktori) atau Ketua Editor (Tetapan) — kini dikunci betul-betul. */}
      {activeTab === 'direktori' && (
        isPentadbir
          ? <DirektoriConsole isPentadbir={isPentadbir} onTukarTab={setActiveTab} onToast={pushToast} onUrusPenugasanSlotUntuk={urusPenugasanSlotUntuk} />
          : <AksesDitolak mesej="Direktori khusus untuk Pentadbir." />
      )}

      {activeTab === 'tetapan' && (
        isPentadbir
          ? <TetapanConsole isPentadbir={isPentadbir} initialSubTab={tetapanTujuSubTab} />
          : <AksesDitolak mesej="Tetapan Sistem khusus untuk Pentadbir." />
      )}

      {/* Panduan (Fasa 16, 2026-08-02) — panduan operasi harian sebenar, lihat PanduanConsole.tsx. */}
      {activeTab === 'panduan' && <PanduanConsole />}

      {/* Dokumentasi (2026-08-01) — Peraturan Am (Perlembagaan) dan Reka Bentuk, dua-duanya
          rujukan sistem sebenar. Log Sistem kini destinasi SENDIRI, tak lagi sub-tab di sini. */}
      {activeTab === 'dokumentasi' && (
        <div className="space-y-4 font-sans">
          <SubTabBar
            items={[
              { id: 'peraturan_am', label: '1. Peraturan Am' },
              { id: 'reka_bentuk', label: '2. Reka Bentuk' },
            ]}
            active={rujukanSubTab}
            onChange={setRujukanSubTab}
          />
          {rujukanSubTab === 'peraturan_am' && <PerlembagaanConsole />}
          {rujukanSubTab === 'reka_bentuk' && <SistemRekaBentukConsole />}
        </div>
      )}

      {/* Log Sistem (2026-08-05, keputusan Izzat) — jejak audit SEMUA orang (tindakan editor
          lain, akaun, Bidang, ralat pelayan). Dahulu terbuka kepada sesiapa yang log masuk;
          kini Pentadbir + Ketua Editor + Penolong. Gerbang SEBENAR di server
          (requirePermission('viewAuditLog'), core/routes/auditLogRoutes.js) — ini cuma bayang
          client supaya Editor tak nampak skrin kosong/ralat 403 mentah. */}
      {activeTab === 'log_sistem' && (
        (isPentadbir || isEditorialAdmin)
          ? <LogAuditConsole />
          : <AksesDitolak mesej="Log Sistem khusus untuk Pentadbir / Ketua Editor / Penolong Ketua Editor." />
      )}

      {makluanTerbuka && (
        <MaklumanDrawer
          nota={notaMakluman}
          notifikasi={notifikasiMakluman}
          memuat={memuatMakluman}
          onTutup={tutupMakluman}
          onKlikNotifikasi={klikNotifikasi}
          onPadamNotifikasi={padamNotifikasi}
        />
      )}

      {/* Modal Ticker native Editorium (2026-08-02, Fasa 7) — lihat useTickerEditor.ts. */}
      {/* Gerbang MOUNT di sini, bukan early-return dlm TickerManagementModal.tsx sendiri
          (2026-08-16, audit Izzat "benar2 berfungsi atau hiasan?" dedah pelanggaran Rules of
          Hooks — komponen tu sebelum ni SENTIASA mounted dgn `if (!isOpen || !formConfig) return
          null` SEBELUM sebarang useState/useEffect, jadi bilangan hook berbeza antara render
          dibuka/ditutup pada FIBER SAMA. Corak sepadan SlotManagerModal/BarSlotManagerModal
          sedia ada — parent gate mount, bukan komponen sendiri). */}
      {!!tickerEditor.formConfig && (
        <TickerManagementModal
          onClose={tickerEditor.closeTickerEditor}
          formConfig={tickerEditor.formConfig}
          setFormConfig={tickerEditor.setFormConfig}
          slotsConfig={tickerEditor.slotsConfig}
          handleSaveSlot={tickerEditor.handleSaveSlot}
          registeredRssSources={tickerEditor.registeredRssSources}
          loadRssSources={tickerEditor.loadRssSources}
          reviewQueue={tickerEditor.reviewQueue}
          loadReviewQueue={tickerEditor.loadReviewQueue}
          rssStatus={tickerEditor.rssStatus}
          adjungDesks={tickerEditor.adjungDesks}
          addToast={pushToast}
          validateContentBudget={validateContentBudget}
          handleOverrideTickerDesk={tickerEditor.handleOverrideTickerDesk}
        />
      )}
      <ToastContainer toasts={editoriumToasts} onDismiss={dismissToast} />

      {profilTerbuka && profilData && (
        <ProfilEditorModal
          profil={profilData}
          onTutup={() => setProfilTerbuka(false)}
          onKemasKini={(patch) => {
            if (patch.penName) onProfilKemasKini({ penName: patch.penName });
            // Pepijat "amaran belum simpan" palsu selepas Simpan Profil berjaya (2026-08-23,
            // Izzat: "saya rasa saya dah simpan semua tetapan, tp keluar pertanyaan lagi") —
            // dahulu cuma penName diteruskan ke atas, medan Butiran Profil (namaPenuh,
            // kelulusan*, dll) tak pernah dikemas kini dlm profilData. Perbandingan "kotor"
            // ProfilEditorModal (state dalaman vs prop profil) jadi silap anggap ada
            // perubahan belum simpan sebaik sahaja simpan BERJAYA, sebab profilData (sumber
            // prop) kekal versi lama sedangkan state modal dah ada nilai baharu. Kemas kini
            // profilData PENUH (semua medan patch, bukan penName sahaja) supaya kedua-dua
            // sumber sepadan semula.
            setProfilData((prev) => (prev ? { ...prev, ...patch } : prev));
          }}
        />
      )}

      {/* Pemilih slot "Tulis Kandungan" (2026-07-29) — senarai 38 slot KECUALI Bar (bentuk
          borangnya belum sepadan, kerja berasingan akan datang) dan Ticker (Modul Khas, laluan
          sendiri). Render TERUS di sini (bukan Frontpage) — Editorium mandiri sepenuhnya. */}
      {slotEditor.showSlotPicker && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-md"
          onMouseDown={(e) => { mousedownPadaBackdropSlotPicker.current = e.target === e.currentTarget; }}
          onClick={(e) => { if (e.target === e.currentTarget && mousedownPadaBackdropSlotPicker.current) slotEditor.setShowSlotPicker(false); }}
        >
          <div
            ref={refModalSlotPicker}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pilih-slot-modal-tajuk"
            className="bg-white rounded-lg border border-stone-200 shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-none px-5 py-4 border-b border-stone-150 flex items-center justify-between">
              <h2 id="pilih-slot-modal-tajuk" className="font-serif text-lg font-medium text-stone-900">Pilih Slot</h2>
              <button type="button" onClick={() => slotEditor.setShowSlotPicker(false)} aria-label="Tutup" className="text-stone-400 hover:text-stone-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
            <ol
              className="flex-1 min-h-0 overflow-y-auto list-none m-0 p-0"
              onClick={() => setPopoverEditorSlot(null)}
            >
              {slotBolehTulis.length === 0 && (
                <li className="px-5 py-8 text-center">
                  <p className="font-sans text-xs text-stone-500">Tiada slot ditugaskan kepada anda lagi.</p>
                  <p className="font-sans text-[11px] text-stone-400 mt-1">Hubungi Ketua Editor untuk ditugaskan sebelum mula menulis.</p>
                </li>
              )}
              {slotBolehTulis.map((i) => {
                const cfg = slotEditor.slotsConfig.find((s: any) => s.slotIndex === i);
                const editorSlot = editorBagiSlot(i);
                return (
                  <li key={i} className="relative border-b border-stone-100 last:border-b-0">
                    <div className="w-full flex items-center gap-2 pl-5 pr-2 py-2.5 hover:bg-stone-50">
                      <button
                        type="button"
                        onClick={() => { setDrafDibuka(''); slotEditor.openSlotEditor(i); }}
                        className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
                      >
                        <span className="font-mono text-xs font-bold text-stone-400 shrink-0">Slot {i + 1}</span>
                        <span className="font-sans text-xs text-stone-700 flex-1 truncate">{cfg?.manualDesk || <span className="text-stone-400 italic">— Belum ditetapkan —</span>}</span>
                      </button>
                      {/* Tetapkan editor terus dari sini (2026-08-01) — sama data/peraturan macam
                          Editorium → Slot → Senarai Slot, cuma dibawa ke tempat editor sebenarnya
                          mula menulis, supaya tak perlu keluar konteks pemilih slot ni. */}
                      <Tooltip text="Tetapkan editor yang menguruskan slot ini">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPopoverEditorSlot((prev) => (prev === i ? null : i)); }}
                          aria-label="Tetapkan editor yang menguruskan slot ini"
                          className="shrink-0 max-w-[7.5rem] truncate font-sans text-[10px] text-right cursor-pointer hover:text-Adjung-maroon"
                        >
                          {editorSlot.length === 0 ? (
                            <span className="text-stone-400 italic">+ Editor</span>
                          ) : (
                            <span className="text-stone-500">{editorSlot.map((p) => p.nama).join(', ')}</span>
                          )}
                        </button>
                      </Tooltip>
                    </div>
                    {popoverEditorSlot === i && (
                      <PenugasanEditorPopover
                        slotIndex={i}
                        pengguna={pengguna}
                        editorIdsSemasa={editorSlot.map((p) => p.editorId)}
                        onBatal={() => setPopoverEditorSlot(null)}
                        onSimpan={(editorIds) => simpanEditorSlot(i, editorIds)}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      {slotEditor.editingSlotIndex !== null && slotEditor.formConfig && !TIER_SLOTS.BAR.includes(slotEditor.editingSlotIndex) && (
        <SlotManagerModal
          key={slotEditor.editingSlotIndex}
          editingSlotIndex={slotEditor.editingSlotIndex}
          formConfig={slotEditor.formConfig}
          setFormConfig={slotEditor.setFormConfig}
          activeBidangList={slotEditor.activeBidangList}
          currentEditoriumRole={effectiveEditorialRole}
          currentEditoriumName={currentUser.name}
          isSavingSlot={slotEditor.isSavingSlot}
          saveError={slotEditor.saveError}
          saveErrorBolehSalinAI={slotEditor.saveErrorBolehSalinAI}
          onClose={tutupRuangMenulis}
          onSave={slotEditor.handleSaveSlot}
          // Slot yang sedang dibuka SENTIASA disertakan walaupun ia di luar tugasan pengguna
          // (cth. draf lama dalam slot yang kemudian ditugaskan kepada orang lain) — kalau
          // tidak, dropdown akan hilang slot semasa dan nampak rosak. Server tetap gerbang
          // sebenar bila cuba simpan.
          slotOptions={Array.from(new Set([...slotBolehTulis, slotEditor.editingSlotIndex]))
            .filter((i) => i !== null && !TIER_SLOTS.BAR.includes(i as number))
            .sort((a, b) => (a as number) - (b as number))
            .map((i) => ({
              index: i as number,
              label: `Slot ${(i as number) + 1}: ${slotEditor.slotsConfig.find((s: any) => s.slotIndex === i)?.manualDesk || 'Belum ditetapkan'}`,
            }))}
          onSwitchSlot={(i) => { setDrafDibuka(''); slotEditor.openSlotEditor(i); }}
          initialUuid={drafDibuka}
          onToast={pushToast}
          onLihatIndeks={lihatDiIndeks}
        />
      )}
      {/* Modal Slot Bar native Editorium (2026-08-02, Fasa 7) — lihat BarSlotManagerModal.tsx. */}
      {barSlotEditor.editingSlotIndex !== null && barSlotEditor.formConfig && (
        <BarSlotManagerModal
          key={barSlotEditor.editingSlotIndex}
          editingSlotIndex={barSlotEditor.editingSlotIndex}
          formConfig={barSlotEditor.formConfig}
          isSavingSlot={barSlotEditor.isSavingSlot}
          saveError={barSlotEditor.saveError}
          onClose={barSlotEditor.closeSlotEditor}
          onSave={barSlotEditor.handleSaveSlot}
          // Slot Bar ikut peraturan tugasan yang SAMA (2026-08-08, Fasa 2). Slot semasa sentiasa
          // disertakan atas sebab sama macam modal kandungan di atas.
          slotOptions={TIER_SLOTS.BAR
            .filter((i: number) => slotBolehDicapai(i) || i === barSlotEditor.editingSlotIndex)
            .map((i: number) => ({
              index: i,
              label: `Slot ${i + 1}: Bar`,
            }))}
          onSwitchSlot={(i) => barSlotEditor.openSlotEditor(i)}
          onToast={pushToast}
        />
      )}
    </EditoriumLayout>
  );
};

export default EditoriumView;
