import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Radio, X } from 'lucide-react';
import { BRAND } from '../../config/brand';
import { EditoriumLayout } from './EditoriumLayout';
import { IndeksConsole } from './IndeksConsole';
import { DrafSayaConsole } from './DrafSayaConsole';
import { DashboardConsole } from './DashboardConsole';
import { NotaKetuaEditorConsole } from './NotaKetuaEditorConsole';
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
import { SistemRekaBentukConsole } from './SistemRekaBentukConsole';
import { ContentReview } from '../studio/ContentReview';
import { SlotManagerModal } from '../portal/SlotManagerModal';
import { PenugasanEditorPopover } from './PenugasanEditorPopover';
import { useSlotEditor } from '../../hooks/useSlotEditor';
import { TIER_SLOTS } from '../../../core/editorial/GeometryConfig.js';

// 2026-08-02 (Fasa 3) — mesej kunci akses seragam. Nav sidebar (EditoriumLayout.tsx) dah pun
// sorok destinasi yang tak dibenarkan, jadi ni jaring keselamatan (URL terus, sidebar lapuk
// belum dimuat semula) — bukan laluan biasa, tapi tak patut papar skrin kosong bila berlaku.
function AksesDitolak({ mesej }: { mesej: string }) {
  return (
    <div className="bg-white p-6 rounded-lg border border-stone-200 text-center py-16 font-sans">
      <div className="mb-2 flex justify-center"><Lock className="w-6 h-6 text-stone-400" /></div>
      <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">Tiada Kebenaran</h3>
      <p className="text-xs text-stone-500 max-w-sm mx-auto">{mesej}</p>
    </div>
  );
}

// Baris sub-tab kongsi (2026-08-01, permintaan pemilik projek — susun semula nav Editorium ikut
// kategori) — satu komponen untuk keempat-empat kategori (Kandungan, Slot, Pentadbiran, Rujukan),
// gantikan 2 salinan JSX serupa yang terpisah sebelum ni. `locked` untuk sub-tab bersekat peranan
// (cth Tetapan, Ketua Editor sahaja) — dipaparkan kelabu + ikon kunci, klik tiada kesan, sama gaya
// visual macam sekatan peringkat kategori yang wujud dulu.
function SubTabBar<T extends string>({ items, active, onChange }: {
  items: { id: T; label: string; locked?: boolean; lockedTitle?: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-stone-200 text-xs">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => !it.locked && onChange(it.id)}
          disabled={it.locked}
          aria-disabled={it.locked}
          title={it.locked ? it.lockedTitle : undefined}
          className={`flex items-center gap-1.5 px-4 py-2 font-semibold tracking-wide transition-all border-b-2 ${
            active === it.id
              ? 'border-[#802334] text-[#802334] bg-stone-50'
              : it.locked
              ? 'border-transparent text-stone-300 cursor-not-allowed'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {it.label}
          {it.locked && <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />}
        </button>
      ))}
    </div>
  );
}

interface EditoriumViewProps {
  // null = belum log masuk. Peranan (KETUA_EDITOR/EDITOR) datang terus daripada akaun yang log
  // masuk — bukan lagi togol manual. `roles` (2026-08-02, Fasa 3) — senarai BERBILANG peranan
  // sebenar (pentadbir/ketua_editor/penolong_ketua_editor/editor), satu akaun boleh pegang lebih
  // daripada satu serentak. `role` legasi kekal sebagai label paparan sahaja.
  currentUser: { id: string; name: string; role: 'KETUA_EDITOR' | 'EDITOR'; roles: string[] } | null;
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
  // Destinasi peringkat atas (2026-08-01, permintaan pemilik projek — sidebar dua kumpulan, satu
  // klik terus). Lihat EditoriumLayout.tsx untuk susunan Operasi Harian / Tata Kelola & Rujukan.
  // Paparan Utama (Fasa 5) — destinasi lalai selepas log masuk, ganti Kandungan.
  const [activeTab, setActiveTab] = useState('paparan_utama');
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
  const [kandunganSubTab, setKandunganSubTab] = useState<'indeks' | 'semakan'>('indeks');
  // Sub-tab DALAMAN destinasi "Slot" (2026-07-30) — tidak berubah struktur.
  const [slotSubTab, setSlotSubTab] = useState<'senarai' | 'tier' | 'bidang' | 'tetapan_am'>('senarai');
  // Sub-tab DALAMAN destinasi "Dokumentasi" (2026-08-01) — Peraturan Am (Perlembagaan) + Reka
  // Bentuk. Log Sistem kini destinasi sendiri, tak lagi sub-tab sini.
  const [rujukanSubTab, setRujukanSubTab] = useState<'peraturan_am' | 'reka_bentuk'>('peraturan_am');
  // Tulis Kandungan (2026-07-29) — mandiri sepenuhnya, lihat useSlotEditor.ts. Hantar nama editor
  // log masuk supaya setiap Simpan/Terbit catat siapa sebenarnya terbitkan kandungan tu.
  const slotEditor = useSlotEditor(currentUser?.name);
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
  const [memuatMakluman, setMemuatMakluman] = useState(true);
  const [makluanTerbuka, setMaklumanTerbuka] = useState(false);
  // Dinaikkan selepas konsol Nota menyimpan sesuatu, supaya lencana header tak kekal lapuk.
  const [maklumanVersi, setMaklumanVersi] = useState(0);

  // Profil Editor (2026-08-01, spesifikasi pemilik projek — aksesori header). Dipermudah
  // 2026-08-02 (Izzat: "ni bukan medsos, hanya utk rujukan dalaman") — Nama Pena sahaja, avatar/
  // tandatangan/bio dibuang. Nama pena tetap diambil dari /api/db-state bila modal dibuka (prop
  // `currentUser` cuma bawa id/name/role dari sesi log masuk, mungkin lapuk berbanding DB).
  const [profilTerbuka, setProfilTerbuka] = useState(false);
  const [profilData, setProfilData] = useState<{ id: string; penName: string } | null>(null);
  const bukaProfil = () => {
    fetch('/api/db-state')
      .then((r) => r.json())
      .then((d) => {
        const u = (d.users || []).find((x: any) => x.id === currentUser?.id);
        setProfilData({ id: currentUser!.id, penName: u?.penName || currentUser!.name });
        setProfilTerbuka(true);
      })
      .catch(() => {
        setProfilData({ id: currentUser!.id, penName: currentUser!.name });
        setProfilTerbuka(true);
      });
  };

  useEffect(() => {
    if (!currentUser) return;
    setMemuatMakluman(true);
    fetch('/api/system/editor-notes?status=aktif')
      .then((r) => r.json())
      .then((d) => setNotaMakluman(Array.isArray(d) ? d : []))
      .catch(() => setNotaMakluman([]))
      .finally(() => setMemuatMakluman(false));
  }, [currentUser, maklumanVersi]);

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

  useEffect(() => {
    if (!slotEditor.showSlotPicker) return;
    muatPenugasanSlot();
    fetch('/api/db-state').then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.users)) setPengguna(d.users.filter((u: any) => !u.isSuspended)); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotEditor.showSlotPicker]);

  const editorBagiSlot = (i: number) => penugasanSlot.filter((p) => p.slotIndex === i);

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
          <span className="font-serif text-2xl text-stone-300">{BRAND.logoText}</span>
          <p className="text-xs">Log masuk diperlukan untuk mengakses Editorium.</p>
        </div>
      </div>
    );
  }

  return (
    <EditoriumLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      currentUser={currentUser}
      onRequestLogin={onRequestLogin}
      onLogout={handleLogoutAndLeave}
      onOpenSlotPicker={() => slotEditor.setShowSlotPicker(true)}
      onOpenMakluman={() => setMaklumanTerbuka(true)}
      jumlahMakluman={notaMakluman.length}
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

      {activeTab === 'modul_khas' && (
        <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 font-sans">
          <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">Modul Khas</h3>
          <p className="text-xs text-stone-500">
            Jam, Ticker, dan Slot Bar ada peraturan penyuntingan tersendiri, berasingan daripada kad bento biasa.
          </p>
          <div className="flex items-center justify-between gap-4 border border-stone-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Radio className="w-4 h-4 text-[#802334]" />
              <div>
                <div className="text-sm font-semibold text-stone-800">Ticker (Berita Semasa)</div>
                <div className="text-[11px] text-stone-500">RSS, animasi, status, tetapan penyuntingan khas.</div>
              </div>
            </div>
            {/* Modal Ticker sebenar (TickerManagementModal) masih hidup di FrontpageView.tsx —
                lihat nota "+ Tulis Kandungan" di EditoriumLayout.tsx untuk sebab yang sama. */}
            <a
              href="/?openTicker=1"
              className="px-3 py-1.5 bg-[#802334] text-white rounded text-xs font-semibold hover:bg-[#6a1c2a] transition-colors shrink-0"
            >
              Urus Ticker
            </a>
          </div>
          <div className="flex items-center justify-between gap-4 border border-stone-200 rounded-lg p-4 opacity-50">
            <div>
              <div className="text-sm font-semibold text-stone-800">Jam Dunia</div>
              <div className="text-[11px] text-stone-500">Belum disambungkan ke Editorium.</div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 border border-stone-200 rounded-lg p-4 opacity-50">
            <div>
              <div className="text-sm font-semibold text-stone-800">Slot Bar</div>
              <div className="text-[11px] text-stone-500">Belum disambungkan ke Editorium (kekal guna laluan sedia ada di frontpage).</div>
            </div>
          </div>
        </div>
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
          {slotSubTab === 'senarai' && <SenaraiSlotConsole currentEditoriumRole={effectiveEditorialRole} />}
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
          ? <DirektoriConsole isPentadbir={isPentadbir} />
          : <AksesDitolak mesej="Direktori khusus untuk Pentadbir." />
      )}

      {activeTab === 'tetapan' && (
        isPentadbir
          ? <TetapanConsole isPentadbir={isPentadbir} />
          : <AksesDitolak mesej="Tetapan Sistem khusus untuk Pentadbir." />
      )}

      {/* Panduan (2026-08-01) — panduan penggunaan Editorium. Belum dibina; papar status jujur
          bukan reka kandungan kosong seolah-olah siap. */}
      {activeTab === 'panduan' && (
        <div className="bg-white p-6 rounded-lg border border-stone-200 text-center py-16 font-sans">
          <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">Panduan Belum Dibina</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            Panduan penggunaan Editorium — cara menulis, terbit, dan urus kandungan langkah demi langkah — akan diletak di sini.
          </p>
        </div>
      )}

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

      {activeTab === 'log_sistem' && <LogAuditConsole />}

      {makluanTerbuka && (
        <MaklumanDrawer
          nota={notaMakluman}
          memuat={memuatMakluman}
          onTutup={() => setMaklumanTerbuka(false)}
        />
      )}

      {profilTerbuka && profilData && (
        <ProfilEditorModal
          profil={profilData}
          onTutup={() => setProfilTerbuka(false)}
          onKemasKini={(patch) => {
            if (patch.penName) onProfilKemasKini({ penName: patch.penName });
          }}
        />
      )}

      {/* Pemilih slot "Tulis Kandungan" (2026-07-29) — senarai 38 slot KECUALI Bar (bentuk
          borangnya belum sepadan, kerja berasingan akan datang) dan Ticker (Modul Khas, laluan
          sendiri). Render TERUS di sini (bukan Frontpage) — Editorium mandiri sepenuhnya. */}
      {slotEditor.showSlotPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-md" onClick={() => slotEditor.setShowSlotPicker(false)}>
          <div className="bg-white rounded-lg border border-stone-200 shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex-none px-5 py-4 border-b border-stone-150 flex items-center justify-between">
              <h2 className="font-serif text-lg font-medium text-stone-900">Pilih Slot</h2>
              <button type="button" onClick={() => slotEditor.setShowSlotPicker(false)} className="text-stone-400 hover:text-stone-600 cursor-pointer"><X size={18} /></button>
            </div>
            <ol
              className="flex-1 min-h-0 overflow-y-auto list-none m-0 p-0"
              onClick={() => setPopoverEditorSlot(null)}
            >
              {Array.from({ length: 38 }, (_, i) => i).filter((i) => !TIER_SLOTS.BAR.includes(i)).map((i) => {
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
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPopoverEditorSlot((prev) => (prev === i ? null : i)); }}
                        title="Tetapkan editor yang menguruskan slot ini"
                        className="shrink-0 max-w-[7.5rem] truncate font-sans text-[10px] text-right cursor-pointer hover:text-[#802334]"
                      >
                        {editorSlot.length === 0 ? (
                          <span className="text-stone-400 italic">+ Editor</span>
                        ) : (
                          <span className="text-stone-500">{editorSlot.map((p) => p.nama).join(', ')}</span>
                        )}
                      </button>
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
          onClose={tutupRuangMenulis}
          onSave={slotEditor.handleSaveSlot}
          slotOptions={Array.from({ length: 38 }, (_, i) => i)
            .filter((i) => !TIER_SLOTS.BAR.includes(i))
            .map((i) => ({
              index: i,
              label: `Slot ${i + 1} — ${slotEditor.slotsConfig.find((s: any) => s.slotIndex === i)?.manualDesk || 'Belum ditetapkan'}`,
            }))}
          onSwitchSlot={(i) => { setDrafDibuka(''); slotEditor.openSlotEditor(i); }}
          initialUuid={drafDibuka}
        />
      )}
      {slotEditor.saveError && (
        <div className="fixed bottom-4 right-4 z-[60] bg-red-50 border border-red-200 text-red-800 text-xs px-4 py-3 rounded shadow-lg max-w-sm">
          {slotEditor.saveError}
        </div>
      )}
    </EditoriumLayout>
  );
};

export default EditoriumView;
