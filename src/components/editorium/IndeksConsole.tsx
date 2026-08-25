import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { bacaJsonSelamat } from '../../utils/bacaJson';
import { AlertTriangle, X, Search, Pin, Lock, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { tierForSlot, TIER_LABELS, TIER_LABEL_IS_ENGLISH } from '../../../core/editorial/GeometryConfig.js';
import { Tooltip } from '../common/Tooltip';
import { EditorDialog } from '../common/EditorDialog';
import { StatusBadge, StatusTone } from '../common/StatusBadge';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { SectionLabel } from '../common/SectionLabel';
import { Button } from '../common/Button';
import { LABEL_BORANG, INPUT_BORANG, KEPALA_JADUAL, GARIS_BARIS } from '../common/gayaKongsi';
import { FormColumn } from '../common/FormColumn';
import { tanganiKekunciItalic } from '../../utils.tsx';
import { labelMod, labelStatus } from '../../config/istilah';
import { formatKlDisplay, klLocalToIso, isoToKlLocalInput } from '../../../core/editorial/Scheduling.js';
import { useTapisanSesi } from '../../hooks/useTapisanSesi';

interface BriefRecord {
  id: string;
  title: string;
  summary: string;
  desk: string;
  topik: string;
  // Draf SENGAJA tiada di sini (2026-07-29) — draf ialah ruang peribadi editor dalam modal Tulis
  // Kandungan sahaja (slots_config.manualSummary), tak pernah punya baris editorial_objects,
  // jadi tak sesekali muncul dalam Indeks. Lihat nota alur kerja di server.js.
  status: 'Pending' | 'Live' | 'Archive' | 'Scheduled' | 'Dipadam';
  // Jadual Terbit/Luput (2026-08-02) — ISO 8601, null bermakna tiada jadual ditetapkan.
  scheduledPublishAt: string | null;
  scheduledExpiresAt: string | null;
  source: string;
  creator: string;
  cardType: string;
  slot: string;
  slotIndex: number;
  date: string;
  // Cap masa mentah (ISO, bukan diformat) — khusus untuk penyusunan "Paling Baharu"/"Paling Lama".
  // `date` di atas sudah diformat ms-MY untuk paparan, tak sesuai untuk susun kronologi.
  createdAtRaw: string;
  // Nama editor SEBENAR yang log masuk semasa Terbit (2026-07-29) — kosong untuk kandungan
  // sedia ada sebelum ciri ni wujud (papar "Tidak diketahui", bukan reka nama).
  editorName: string;
  // Maklumat penuh (2026-07-29, permintaan pemilik projek) — modal Detail Kandungan sebelum ni
  // cuma papar medan ringkas (Status/Bidang/Topik/dll.), senyap buang Huraian Panjang/Nota/Tarikh
  // Sumber/URL walaupun /api/system/content/all sentiasa pulangkan kesemuanya (lihat
  // contentRoutes.js — sama medan yang dah dibetulkan di ContentReview.tsx punya paparan pukal).
  summaryLong: string;
  note: string;
  // Tandatangan Nota (2026-08-08, Fasa 4) — peranan sahaja ("Ketua Editor"/"Penolong Ketua
  // Editor"), kosong bila penulis asal kandungan sendiri yang menulis notanya.
  notaOleh: string;
  originalDate: string;
  url: string;
}

// Renders a tier label, condong (italic) whenever GeometryConfig flags it as an unapproved
// English/borrowed word — same rule and same source as PerlembagaanConsole.tsx's TierLabel.
const TierLabel: React.FC<{ tier: string }> = ({ tier }) =>
  TIER_LABEL_IS_ENGLISH[tier] ? <em className="italic">{TIER_LABELS[tier]}</em> : <>{TIER_LABELS[tier]}</>;

// Tona StatusBadge ikut status kandungan — Aktif/Dijadualkan = success, Menunggu = warning,
// Arkib = neutral (status akhir normal, bukan kegagalan).
const STATUS_TONE: Record<string, StatusTone> = {
  Live: 'success',
  Scheduled: 'success',
  Pending: 'warning',
  Archive: 'neutral',
  Dipadam: 'error',
};

interface IndeksConsoleProps {
  currentUserRole?: 'KETUA_EDITOR' | 'EDITOR';
  currentUserName?: string;
  // Tanda sesi log masuk (2026-08-08) — lihat src/hooks/useTapisanSesi.ts. Dibiarkan undefined
  // sengaja bila belum sedia (bermakna tapisan tersimpan tak dipulihkan sehingga ia muncul).
  sesiTanda?: string;
  // Toast kongsi Editorium (2026-08-08) — makluman SEBENAR selepas Arkib/Tolak/Siar, bukan
  // senyap-senyap macam sebelum ni (rec.status bertukar dalam jadual tanpa sebarang isyarat lain).
  onToast?: (type: 'success' | 'error' | 'info', message: string) => void;
  // Penapis awal terarah (WF-01/WF-06, Pusingan 5, audit ChatGPT 2026-08-09) — bila permukaan
  // lain (SlotManagerModal lepas Terbit, Senarai Slot lepas klik kiraan Menunggu) mahu bawa
  // pembaca terus ke Indeks yang SUDAH ditapis, bukan suruh cari semula secara manual.
  // `generasi` WAJIB bertambah setiap permintaan (bukan objek sama literal) supaya klik kedua
  // pada slot/status yang SAMA tetap mencetuskan semula useEffect (dependency array React
  // bandingkan rujukan/nilai primitif, bukan "adakah ini permintaan baharu").
  penapisAwal?: { slot?: string; status?: string; generasi: number };
  // Dasar Terbit Sendiri Editor (2026-08-19, laporan Izzat: "jika editor boleh terbitkan dan edit
  // sendiri tanpa kelulusan ketua editor, penapis kandungan di kandungan default tukar status
  // drpd menunggu kepada aktif"). Dibaca daripada GET /api/system/editor-publish-policy di
  // EditoriumView.tsx (induk) dan dihantar turun sebagai prop — BUKAN diambil terus dalam
  // komponen ni, sebab DEFAULT_FILTERS (di bawah) dikira SEGERAK semasa render pertama dan
  // disuap ke useTapisanSesi() yang cuma baca nilai lalai SEKALI (useState lazy initializer);
  // kalau nilai ni tiba lewat (fetch async DALAM komponen ni), tapisan awal sesi baharu akan
  // terperangkap pada nilai lama sebelum fetch selesai. `undefined` semasa belum sedia (induk
  // masih memuat) — dilayan SAMA seperti `false` (anggap kelulusan masih diperlukan, iaitu
  // tingkah laku SEDIA ADA), bukan meneka.
  benarkanSelfPublish?: boolean;
}

// Format ringkas DD/MM/YY untuk jadual Indeks (2026-07-29, permintaan pemilik projek) — jimat
// ruang lajur berbanding toLocaleDateString('ms-MY') (yang keluarkan "29 Julai 2026" penuh).
const formatDateShort = (iso: string | null): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

const formatTitleCase = (str: string) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Backend stores a lowercase status on editorial_revisions; the console displays the Malay/title
// case labels the rest of the UI already uses.
const STATUS_TO_LABEL: Record<string, BriefRecord['status']> = {
  approved: 'Live',
  pending: 'Pending',
  archived: 'Archive',
  scheduled: 'Scheduled',
  dipadam: 'Dipadam',
};
const LABEL_TO_STATUS: Record<BriefRecord['status'], string> = {
  Live: 'approved',
  Pending: 'pending',
  Archive: 'archived',
  Scheduled: 'scheduled',
  Dipadam: 'dipadam',
};

// Label yang DIPAPAR kepada editor tinggal di src/config/istilah.ts (labelStatus/labelMod) — satu
// tempat untuk semua skrin. Kunci dalaman (Live/Pending/Archive) di atas sengaja TIDAK ditukar:
// ia dipadankan dengan nilai status pangkalan data di banyak tempat.
//
// Status "Rejected" DIBUANG (2026-07-30): "Tolak" memulangkan kandungan jadi draf peribadi editor
// dan menandakan rekod lama sebagai arkib — tiada laluan dalam sistem yang menghasilkan status
// rejected, jadi menawarkannya sebagai penapis hanya menjanjikan sesuatu yang tak boleh wujud.
// (Ticker ada dunia berasingan: rss_ticker_items ada status 'rejected' sendiri, diuruskan di
// Modul Khas → Urus Ticker.)

// "Kaedah" ni sepatutnya sama konsep dengan "Mod Kandungan" yang dah sedia ada & user-facing di
// borang Urus Slot/Ticker (FrontpageView.tsx/TickerManagementModal.tsx): Manual / AI Generated /
// RSS Direct (Ticker sahaja). createdBy ialah token mentah (laluan kod/skrin mana yang tulis baris
// ni), BUKAN mod itu sendiri — beberapa token berlainan sebenarnya sama mod:
//   - manual-slot-save (Tetapan Slot), content-review (Semakan Kandungan, disahkan hanya ditulis
//     semasa CIPTA oleh POST /content, tak pernah disentuh PATCH), migration-manual-blob (import
//     dari sistem lama — server.js:1873 "Exclude Manual-origin rows" sendiri kumpulkan ketiga-tiga
//     token ni sebagai SATU kumpulan "Manual" untuk resolveSlotContent) — kesemuanya "Manual".
//   - pipeline-slot-* — "AI Generated" (nama ditukar drpd "AI Pipeline" supaya sepadan istilah Mod
//     Kandungan sebenar, bukan reka istilah baharu).
// Migrasi/"content-review" bukan mod berasingan — ia jawab soalan lain (asal-usul/skrin mana),
// bukan "apa mod yang digunakan". Tiada sistem log masuk berbilang editor lagi, jadi medan ni
// jawab *macam mana* dicipta, bukan *oleh siapa*.
//
// Ticker: contentRoutes.js kini hantar mod SEBENAR terus (Manual/AI Generated/RSS Direct, dihurai
// dari baris "Mode:" dalam blok teks Ticker) — bukan konstan 'ticker' tetap macam dulu. Nilai-nilai
// tu dah sepadan istilah di bawah secara semula jadi, jatuh ke `return createdBy` di penghujung
// tanpa perlu pemetaan khas. Blok Ticker lama (sebelum medan Mode: wujud) hantar '' — jatuh ke
// "Tidak diketahui", jujur tentang jurang data, bukan silap paparan.
const formatCreatedBy = (createdBy: string): string => {
  if (
    createdBy === 'manual-user' ||
    createdBy === 'manual-slot-save' ||
    createdBy === 'content-review' ||
    createdBy === 'migration-manual-blob'
  ) return 'Manual';
  if (createdBy.startsWith('pipeline-slot-')) return 'AI Generated';
  if (!createdBy) return 'Tidak diketahui'; // data sebenar hilang — genuine gap, patut kelihatan
  return createdBy;
};

// Real geometry tier per slot (same source of truth the frontpage itself uses) instead of a
// random rotation — see core/editorial/GeometryConfig.js. Stores the tier KEY (e.g. 'HERO'),
// not a display label — TIER_LABELS (also from GeometryConfig.js) supplies the label at render
// time, so this file carries no label copy of its own and can't drift from PerlembagaanConsole.
const cardTypeForSlot = (slotIndex: number): string => {
  if (slotIndex === -1) return 'TICKER';
  return tierForSlot(slotIndex) || '-';
};

export const IndeksConsole: React.FC<IndeksConsoleProps> = ({
  currentUserRole = 'KETUA_EDITOR',
  currentUserName = 'Izzat Anas',
  sesiTanda,
  onToast,
  penapisAwal,
  benarkanSelfPublish,
}) => {
  const [items, setItems] = useState<BriefRecord[]>([]);
  const [loading, setLoading] = useState(true);
  // Bendera kegagalan (UX-08 lanjutan, audit ChatGPT 2026-08-08) — dahulu kegagalan fetch
  // senyap tinggalkan `items` kosong, jadual terus papar "Tiada kandungan yang sepadan" macam
  // senarai memang kosong, bukan gagal dimuatkan.
  const [gagalMuatSenarai, setGagalMuatSenarai] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Smart Filter Bar States
  // Tapis-on-demand (2026-07-29, permintaan pemilik projek): penapis TIDAK terpakai serta-merta
  // bila editor tukar mana-mana kawalan — semua kawalan (carian, 6 dropdown, susunan) menulis ke
  // `draftFilters` sahaja; `appliedFilters` (dibaca oleh filteredRecords/sortedRecords di bawah)
  // hanya dikemas kini bila butang "Tapis" ditekan. Ni sengaja walaupun penapisan semasa 100%
  // client-side (senarai `items` sudah dimuat penuh dalam memori) — bersedia untuk seni bina
  // masa depan (paginasi/carian sisi-pelayan bila rekod cecah 10,000+), dan kurangkan bilangan
  // recompute filteredRecords/sortedRecords semasa editor tukar >1 kawalan sekali gus. "Set
  // Semula Penapis" terus kesan (bukan tunggu Tapis) — ia tindakan "kosongkan", bukan "tambah
  // beban carian baharu".
  interface FilterState {
    search: string;
    status: string;
    cardType: string;
    source: string;
    creator: string;
    desk: string;
    slot: string;
    editor: string;
    sort: 'newest' | 'oldest' | 'az' | 'za';
  }
  // "SemuaKecualiTicker" ialah pilihan BERASINGAN daripada "Semua" (yang kekal bermaksud literal
  // semua slot + Ticker) — Ticker papar kandungan RSS automatik, bukan kandungan yang dihasilkan
  // editor, jadi ia mengelirukan bercampur dalam senarai kerja editorial lalai. Editor masih boleh
  // pilih "Semua" secara eksplisit bila perlu nampak Ticker sekali.
  //
  // Tetapan lalai ikut peranan (2026-07-29, permintaan pemilik projek):
  //   - EDITOR log masuk → Indeks lalai papar KANDUNGAN DIA SENDIRI sahaja ("Editor" = nama dia),
  //     susunan Paling Baharu — meja kerja peribadi, bukan semua kandungan sistem sekali gus.
  //   - KETUA_EDITOR log masuk → Indeks lalai papar SEMUA editor, susunan Paling Baharu.
  //     Status lalai BERGANTUNG pada Dasar Terbit Sendiri Editor (2026-08-19, laporan Izzat:
  //     "jika editor boleh terbitkan dan edit sendiri tanpa kelulusan ketua editor, penapis
  //     kandungan di kandungan default tukar status drpd menunggu kepada aktif"):
  //       - Kelulusan MASIH diperlukan (benarkanSelfPublish=false/belum sedia) → Status=Pending,
  //         baris giliran kelulusan (apa yang perlu tindakan dia) — tingkah laku SEDIA ADA.
  //       - Editor DIBENARKAN terbit sendiri (benarkanSelfPublish=true) → baris giliran Pending
  //         nyaris SENTIASA kosong (editor tak pernah perlu tunggu kelulusan), jadi lalai
  //         "berguna" bertukar ke Status=Live — paparan kandungan AKTIF sebenar, bukan senarai
  //         kosong yang tak bermakna setiap kali Indeks dibuka.
  const DEFAULT_FILTERS: FilterState = currentUserRole === 'EDITOR'
    ? {
        search: '', status: 'Semua', cardType: 'Semua', source: '', creator: 'Semua', desk: 'Semua',
        slot: 'SemuaKecualiTicker', editor: currentUserName, sort: 'newest',
      }
    : {
        search: '', status: benarkanSelfPublish ? 'Live' : 'Pending', cardType: 'Semua', source: '', creator: 'Semua', desk: 'Semua',
        slot: 'SemuaKecualiTicker', editor: 'Semua', sort: 'newest',
      };
  // Tapisan kekal sepanjang sesi log masuk (2026-08-08, permintaan pemilik projek) — "apabila
  // saya ubah tetapan, kemudian saya refresh, ia kembali ke tetapan lalai... refresh ke tetapan
  // lalai hanya apabila log masuk baru". Guna cangkuk kongsi (src/hooks/useTapisanSesi.ts) — TAPI
  // hanya `appliedFilters` (tapisan yang BENAR-BENAR terpakai) yang disimpan; `draftFilters`
  // (borang, sebelum "Tapis" ditekan) kekal state tempatan biasa, disegerakkan drpd appliedFilters
  // bila sesi berubah. Kalau kedua-dua dipersist berasingan bawah kunci sama, setiap taip di
  // borang (patchDraft) akan menimpa nilai TERSIMPAN sebelum "Tapis" ditekan — refresh lepas tu
  // pulihkan tapisan separuh-taip, bukan yang sebenarnya terpakai. Kunci storan ikut peranan
  // (lalai sendiri berbeza bagi EDITOR vs KETUA_EDITOR) supaya pertukaran akaun tak warisi
  // tapisan peranan lain secara silap.
  const [appliedFilters, setAppliedFilters] = useTapisanSesi<FilterState>(
    `adjung-indeks-tapisan-${currentUserRole}`, sesiTanda, DEFAULT_FILTERS
  );
  const [draftFilters, setDraftFilters] = useState<FilterState>(appliedFilters);
  useEffect(() => { setDraftFilters(appliedFilters); }, [sesiTanda]);
  // Terapkan penapis awal terarah (WF-01/WF-06) — timpa draf DAN applied sekali gus supaya
  // pembaca nampak senarai TERUS ditapis, bukan penapis diisi tetapi belum "Tapis" ditekan.
  useEffect(() => {
    if (!penapisAwal) return;
    const gabung = (asas: FilterState): FilterState => ({
      ...asas,
      ...(penapisAwal.slot !== undefined ? { slot: penapisAwal.slot } : {}),
      ...(penapisAwal.status !== undefined ? { status: penapisAwal.status } : {}),
    });
    setAppliedFilters(gabung(appliedFilters));
    setDraftFilters((prev) => gabung(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penapisAwal?.generasi]);
  const patchDraft = (patch: Partial<FilterState>) => setDraftFilters({ ...draftFilters, ...patch });
  const filtersDirty = JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters);

  // Panel "Penapis" boleh lipat (2026-08-08, dapatan audit UI/UX ChatGPT) — dahulu 9 kawalan
  // tapisan terpapar serentak tiap kali Indeks dibuka, walhal majoriti editor cuma perlukan
  // carian pada kunjungan harian biasa (lalai peranan dah tapiskan Status/Editor/Slot yang
  // munasabah). Carian kekal SENTIASA nampak; 8 kawalan lain (7 dropdown + Susunan) di sebalik
  // satu butang, dgn lencana bilangan tapisan bukan-lalai supaya editor tetap sedar tapisan
  // aktif walau panel tertutup.
  const [panelTapisanTerbuka, setPanelTapisanTerbuka] = useState(false);
  const bilanganTapisanAktif = useMemo(() => {
    const medanDikira: (keyof FilterState)[] = ['status', 'cardType', 'source', 'creator', 'editor', 'desk', 'slot'];
    return medanDikira.filter((k) => appliedFilters[k] !== DEFAULT_FILTERS[k]).length;
  }, [appliedFilters]);

  // Editor View Filter: Saya vs Semua (Read Only) — only meaningful once real EDITOR accounts
  // exist; KETUA_EDITOR always sees and can act on everything.
  const [editorViewMode, setEditorViewMode] = useState<'mine' | 'all'>(currentUserRole === 'EDITOR' ? 'mine' : 'all');

  // Detail Modal State
  const [activeItemModal, setActiveItemModal] = useState<BriefRecord | null>(null);
  // Nota Editor daripada Indeks (2026-08-08, Fasa 4 pemilikan kandungan) — draf sunting
  // berasingan daripada activeItemModal.note supaya butang Simpan/Batal ada sesuatu jelas untuk
  // dibandingkan. Direset setiap kali kandungan berbeza dibuka (lihat useEffect di bawah).
  const [drafNota, setDrafNota] = useState('');
  const [suntingNota, setSuntingNota] = useState(false);
  const [menyimpanNota, setMenyimpanNota] = useState(false);
  const [ralatNota, setRalatNota] = useState('');
  useEffect(() => {
    setDrafNota(activeItemModal?.note || '');
    setSuntingNota(false);
    setRalatNota('');
  }, [activeItemModal?.id]);
  // Pengurusan fokus modal (Audit UI/UX Editorium §G1/G2/G6) — perangkap Tab, fokus elemen
  // pertama semasa buka, pulangkan fokus ke pencetus semasa tutup, Escape menutup modal.

  // Siar-semula kandungan archived — Bidang/Topik/slot sasaran boleh diedit khusus untuk item
  // berstatus Archive (lihat "03 — Bidang & Topik" di Perlembagaan untuk peraturan penuh).
  const [activeBidangList, setActiveBidangList] = useState<{ name: string; color: string }[]>([]);
  const [allSlots, setAllSlots] = useState<{ slotIndex: number; manualDesk: string }[]>([]);
  const [reactivateDesk, setReactivateDesk] = useState('');
  const [reactivateTopik, setReactivateTopik] = useState('');
  const [reactivateSlotIndex, setReactivateSlotIndex] = useState<number | ''>('');
  const [reactivating, setReactivating] = useState(false);

  // Jadual Terbit/Luput (2026-08-02) — draf input (waktu tempatan Malaysia, format
  // datetime-local) untuk item detail modal semasa. Hanya KETUA_EDITOR/Penolong boleh sunting
  // (gerbang sebenar di server; UI ni sekadar sembunyi/nyahaktif untuk EDITOR — sama corak
  // "Tetapan Kad" di SenaraiSlotConsole.tsx).
  const [draftJadualTerbit, setDraftJadualTerbit] = useState('');
  const [draftJadualLuput, setDraftJadualLuput] = useState('');
  const [savingJadual, setSavingJadual] = useState(false);
  const [jadualError, setJadualError] = useState<string | null>(null);
  useEffect(() => {
    if (activeItemModal) {
      setDraftJadualTerbit(isoToKlLocalInput(activeItemModal.scheduledPublishAt));
      setDraftJadualLuput(isoToKlLocalInput(activeItemModal.scheduledExpiresAt));
      setJadualError(null);
    }
  }, [activeItemModal?.id]);

  // SEJARAH VERSI (2026-08-12, keputusan Izzat selepas simulasi UX #20) — data revisi, API
  // (/revisions) dan komponen paparan semuanya SUDAH wujud, cuma tiada laluan UI yang membawa
  // kandungan TERBIT kepadanya: tab "Sejarah versi" hanya hidup dalam SlotManagerModal, yang
  // memuatkan giliran DRAF sahaja (kandungan terbit keluar daripada `items` sebaik diterbitkan),
  // jadi syarat isPublished di sana praktikalnya tak pernah benar untuk 30 slot biasa. Modal
  // butiran Indeks inilah tempat kandungan terbit memang sudah dibuka, jadi sejarah disambung
  // di sini — guna semula endpoint sedia ada, bukan bina mekanisme baharu.
  const [revisions, setRevisions] = useState<any[] | null>(null);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState('');
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const muatSejarah = useCallback((id: string) => {
    setRevisionsLoading(true);
    setRevisionsError('');
    fetch(`/api/system/content/${encodeURIComponent(id)}/revisions`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) { setRevisionsError(data?.error || 'Gagal memuatkan sejarah versi.'); setRevisions([]); return; }
        setRevisions(Array.isArray(data) ? data : []);
      })
      .catch(() => { setRevisionsError('Gagal memuatkan sejarah versi.'); setRevisions([]); })
      .finally(() => setRevisionsLoading(false));
  }, []);
  useEffect(() => {
    if (!activeItemModal) { setRevisions(null); setRevisionsError(''); return; }
    // Ticker tiada rekod editorial_objects, jadi tiada sejarah untuk dimuatkan.
    if (activeItemModal.slot === 'Ticker') { setRevisions(null); return; }
    muatSejarah(activeItemModal.id);
  }, [activeItemModal?.id]);

  // Pulih versi lama — endpoint SAMA yang SlotManagerModal guna. Server mencipta revisi BAHARU
  // daripada versi lama (bukan memadam sejarah), jadi tindakan ini boleh diundur dengan memulihkan
  // versi lain sekali lagi. Senarai dimuat semula selepas berjaya supaya nombor versi terkini betul.
  const handlePulihVersi = async (revisionId: number) => {
    if (!activeItemModal) return;
    setRestoringId(revisionId);
    setRevisionsError('');
    try {
      const res = await fetch(`/api/system/content/${encodeURIComponent(activeItemModal.id)}/revisions/${revisionId}/restore`, { method: 'POST' });
      const data = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) { setRevisionsError(data?.error || 'Gagal memulihkan versi.'); return; }
      muatSejarah(activeItemModal.id);
      muatSemula();
    } catch {
      setRevisionsError('Gagal memulihkan versi.');
    } finally {
      setRestoringId(null);
    }
  };

  const handleSimpanJadual = async () => {
    if (!activeItemModal) return;
    setSavingJadual(true);
    setJadualError(null);
    try {
      const body: any = {
        scheduledPublishAt: draftJadualTerbit ? klLocalToIso(draftJadualTerbit) : null,
        scheduledExpiresAt: draftJadualLuput ? klLocalToIso(draftJadualLuput) : null,
      };
      const res = await fetch(`/api/system/content/${encodeURIComponent(activeItemModal.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const resBody = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(resBody.error || 'Gagal menyimpan jadual terbit/luput. Cuba lagi.');
      // Status diambil daripada RESPONS SERVER (#33.2-A, dibaiki 2026-08-13), bukan diteka di
      // sini. Baris lama: `body.scheduledPublishAt && i.status === 'Pending' ? 'Scheduled' :
      // i.status` — ia hanya menaik taraf kandungan yang sedang MENUNGGU, sedangkan server
      // menjadikan kandungan 'scheduled' walaupun ia sedang AKTIF. Akibatnya menetapkan jadual
      // pada kandungan aktif meninggalkan baris Indeks memapar "Aktif" (dan kekal dalam penapis
      // Aktif) sedangkan rekod sebenar sudah 'scheduled', sehingga muat semula penuh. Client
      // TIDAK sepatutnya menyalin peraturan peralihan status server — ia akan terpesong setiap
      // kali peraturan server berubah.
      const statusMuktamad = resBody.status ? STATUS_TO_LABEL[resBody.status] : undefined;
      setItems(prev => prev.map(i => i.id === activeItemModal.id ? {
        ...i,
        scheduledPublishAt: body.scheduledPublishAt,
        scheduledExpiresAt: body.scheduledExpiresAt,
        status: statusMuktamad || i.status,
      } : i));
      setActiveItemModal({
        ...activeItemModal,
        scheduledPublishAt: body.scheduledPublishAt,
        scheduledExpiresAt: body.scheduledExpiresAt,
        status: statusMuktamad || activeItemModal.status,
      });
    } catch (err: any) {
      setJadualError(err.message || 'Gagal simpan jadual.');
    } finally {
      setSavingJadual(false);
    }
  };

  // Load Real Data from SQLite Endpoint
  // Muat semula senarai kandungan sahaja (2026-08-08) — diasingkan daripada useEffect pemuatan
  // awal supaya tindakan pukal boleh menyegarkan keadaan sebenar daripada server, bukan meneka
  // kesan sampingan (naik taraf giliran slot-penuh, Tolak yang membuang rekod terus).
  const muatSemula = useCallback(() => {
    setLoading(true);
    setGagalMuatSenarai(false);
    fetch('/api/system/content/all')
      .then(res => res.json())
      .then(data => {
        const rawItems = data.items || [];

        const normalized: BriefRecord[] = rawItems.map((item: any, idx: number) => {
          const isTicker = item.slotIndex === -1 || item.id?.startsWith('ticker-');
          const slot = isTicker ? 'Ticker' : `Slot ${item.slotIndex + 1}`;

          return {
            id: item.id || `cnt_${idx}`,
            title: item.title || 'Kandungan Tanpa Tajuk',
            summary: item.summary || item.brief || '',
            desk: formatTitleCase(item.desk || 'Umum'),
            topik: item.topik || '',
            status: STATUS_TO_LABEL[item.status] || 'Live',
            source: item.source || '',
            creator: formatCreatedBy(item.createdBy || ''),
            cardType: cardTypeForSlot(item.slotIndex),
            slot,
            slotIndex: item.slotIndex,
            date: formatDateShort(item.createdAt),
            createdAtRaw: item.createdAt || '',
            editorName: item.editorName || '',
            summaryLong: item.summaryLong || '',
            note: item.note || '',
            notaOleh: item.notaOleh || '',
            originalDate: item.originalDate || '',
            url: item.url || '',
            scheduledPublishAt: item.scheduledPublishAt || null,
            scheduledExpiresAt: item.scheduledExpiresAt || null,
          };
        });

        setItems(normalized);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading index data:', err);
        setGagalMuatSenarai(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    muatSemula();

    fetch('/api/system/categories/active')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setActiveBidangList(data.map((c: any) => ({ name: c.name, color: c.color }))); })
      .catch(e => console.error('Error fetching active Bidang:', e));

    fetch('/api/system/slots')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setAllSlots(data.map((s: any) => ({ slotIndex: s.slotIndex, manualDesk: s.manualDesk || '' }))); })
      .catch(e => console.error('Error fetching slots:', e));
  }, [currentUserName, muatSemula]);

  // Status Counters
  const statusCounts = useMemo(() => {
    return {
      Pending: items.filter(i => i.status === 'Pending').length,
      Live: items.filter(i => i.status === 'Live').length,
      Archive: items.filter(i => i.status === 'Archive').length,
      Scheduled: items.filter(i => i.status === 'Scheduled').length,
      Total: items.length
    };
  }, [items]);

  // Bidang dropdown (2026-07-29, permintaan pemilik projek): HANYA bidang berdaftar aktif
  // (activeBidangList, terus daripada CategoryRegistry) — bukan disenaraikan daripada kandungan
  // sedia ada, supaya bidang yang dah dimansuhkan tak muncul sebagai pilihan biasa lagi.
  // Mekanisme khas untuk cari kandungan lama guna bidang mansuh: kumpulan KEDUA "orphanDeskOptions"
  // — bidang yang muncul dalam kandungan SEBENAR tapi tak lagi wujud dalam activeBidangList —
  // dipaparkan berasingan (<optgroup> "Bidang Tidak Berdaftar (Mansuh)") supaya kekal boleh
  // dicari tanpa bercampur dengan senarai bidang aktif biasa.
  const registeredDeskNames = useMemo(() => new Set(activeBidangList.map(b => b.name.toLowerCase())), [activeBidangList]);
  const deskOptions = useMemo(() => activeBidangList.map(b => b.name).sort(), [activeBidangList]);
  const orphanDeskOptions = useMemo(() => {
    const allDesks: string[] = Array.from(new Set(items.map(i => i.desk).filter(Boolean)));
    return allDesks.filter(d => !registeredDeskNames.has(d.toLowerCase())).sort();
  }, [items, registeredDeskNames]);
  // Sumber sebenar (Astro Awani, Bernama, dll.) — berasingan daripada creator/Kaedah di bawah.
  // Ticker (source sentiasa kosong — disimpan sebagai blob teks, bukan rekod berasingan) tak
  // sumbang opsyen di sini. Guna sebagai senarai cadangan <datalist> (medan carian/autocomplete,
  // 2026-07-29) — BUKAN dropdown terpilih tetap, sebab senarai sumber sebenar boleh cecah ratusan/
  // ribuan bila sistem berkembang, dropdown biasa tak lagi praktikal pada skala tu.
  const sourceOptions = useMemo(() => Array.from(new Set(items.map(i => i.source).filter(Boolean))).sort(), [items]);
  // Ticker rows carry an empty creator (see formatCreatedBy) since Ticker isn't a "Kaedah" choice
  // among Manual/AI Generated/dll. — filtered out here so it can't show up as a blank option.
  const creatorOptions = useMemo(() => Array.from(new Set(items.map(i => i.creator).filter(Boolean))).sort(), [items]);
  // Editor (2026-07-29) — nama editor sebenar yang log masuk semasa Terbit, kosong untuk
  // kandungan sedia ada sebelum ciri ni wujud (tak sumbang opsyen di sini, sama corak macam
  // creator/source di atas).
  const editorNameOptions = useMemo(() => Array.from(new Set(items.map(i => i.editorName).filter(Boolean))).sort(), [items]);
  // 2026-08-02 — DAHULU terbitan daripada `items` (slot yang wujud dalam kandungan sedia ada
  // sahaja), jadi mana-mana slot yang langsung tiada kandungan (cth Slot 1/Hero, ditemui semasa
  // ujian: sifar rekod editorial_objects) terus HILANG daripada senarai penapis — editor tak
  // dapat pilih slot tu langsung untuk sahkan ia memang kosong. Kini senarai TETAP (Ticker +
  // Slot 1-38), tak kira ada kandungan atau tidak — penapis patut benarkan pilih mana-mana slot.
  const slotOptions = useMemo(() => ['Ticker', ...Array.from({ length: 38 }, (_, i) => `Slot ${i + 1}`)], []);

  // Smart Filtering Logic
  const filteredRecords = useMemo(() => {
    return items.filter(item => {
      // Tapisan "Kandungan Saya" (2026-08-08, dapatan audit UI/UX ChatGPT + pembetulan) — dahulu
      // langsung tak dikuatkuasakan (banding `item.creator`, TOKEN MESIN cth "Manual"/"AI
      // Generated", bukan identiti orang, jadi mustahil sama dgn currentUserName). Guna
      // `item.editorName` sebaliknya — medan SAMA yang dropdown "Editor" di bawah dan seluruh
      // Fasa pemilikan kandungan sesi ni dah guna berjaya (nama editor sebenar, dicap semasa
      // Terbit). Sistem log masuk berbilang editor pun DAH wujud (express-session sebenar) —
      // premis lama "belum dibina" dah lapuk.
      if (currentUserRole === 'EDITOR' && editorViewMode === 'mine' && item.editorName !== currentUserName) {
        return false;
      }

      // Search Query
      if (appliedFilters.search.trim()) {
        const q = appliedFilters.search.trim().toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.source.toLowerCase().includes(q) ||
          item.creator.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Filter: Status — "Semua" sengaja TAK termasuk Tong Sampah (Dipadam), sama macam sebarang
      // bakul sampah lazim (kekal tersembunyi drpd senarai utama, kena pilih "Tong Sampah" terang-
      // terang untuk lihat). Dipapar dalam Tong Sampah menunggu Pulihkan/Padam Kekal sahaja.
      if (appliedFilters.status === 'Semua') {
        if (item.status === 'Dipadam') return false;
      } else if (item.status !== appliedFilters.status) {
        return false;
      }

      // Filter: Jenis Kad
      if (appliedFilters.cardType !== 'Semua' && item.cardType !== appliedFilters.cardType) return false;

      // Filter: Sumber (medan carian/autocomplete, 2026-07-29 — padanan separa/tidak sensitif huruf
      // besar-kecil, bukan sepadan-tepat, sebab editor mungkin belum siap menaip nama penuh persis).
      if (appliedFilters.source.trim() && !item.source.toLowerCase().includes(appliedFilters.source.trim().toLowerCase())) return false;

      // Filter: Kaedah (cara kandungan dicipta — Manual/AI Generated/RSS Direct/dll.)
      if (appliedFilters.creator !== 'Semua' && item.creator !== appliedFilters.creator) return false;

      // Filter: Editor (nama editor sebenar yang log masuk semasa Terbit — 2026-07-29)
      if (appliedFilters.editor !== 'Semua' && item.editorName !== appliedFilters.editor) return false;

      // Filter: Desk
      if (appliedFilters.desk !== 'Semua' && item.desk.toLowerCase() !== appliedFilters.desk.toLowerCase()) return false;

      // Filter: Slot
      if (appliedFilters.slot === 'SemuaKecualiTicker') {
        if (item.slot === 'Ticker') return false;
      } else if (appliedFilters.slot !== 'Semua' && item.slot !== appliedFilters.slot) {
        return false;
      }

      return true;
    });
  }, [items, currentUserRole, editorViewMode, currentUserName, appliedFilters]);

  // Susunan (2026-07-29) — dipisahkan daripada penapisan di atas supaya urutan pilihan penapis
  // tak jejas kestabilan susunan; guna createdAtRaw untuk kronologi, title untuk abjad.
  const sortedRecords = useMemo(() => {
    const arr = filteredRecords.slice();
    switch (appliedFilters.sort) {
      case 'newest':
        return arr.sort((a, b) => (b.createdAtRaw || '').localeCompare(a.createdAtRaw || ''));
      case 'oldest':
        return arr.sort((a, b) => (a.createdAtRaw || '').localeCompare(b.createdAtRaw || ''));
      case 'az':
        return arr.sort((a, b) => a.title.localeCompare(b.title, 'ms'));
      case 'za':
        return arr.sort((a, b) => b.title.localeCompare(a.title, 'ms'));
      default:
        return arr;
    }
  }, [filteredRecords, appliedFilters.sort]);

  // Pagination (2026-07-29, permintaan pemilik projek) — 100 rekod setiap paparan, supaya jadual
  // tak pernah render lebih 100 baris DOM sekali gus tanpa mengira berapa banyak kandungan lepas
  // tapisan. Ni pagination CLIENT-SIDE sahaja (senarai penuh masih dimuat dalam memori — tetap
  // sepadan seni bina semasa `/api/system/content/all`); pindah ke pagination SISI-PELAYAN
  // sebenar (had+ofset dalam query DB) ialah kerja BERASINGAN, perlu bila kandungan sebenar cecah
  // skala yang menjadikan muat-semua-sekali sendiri satu masalah (lihat cadangan sebelum ni).
  const PAGE_SIZE = 100;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / PAGE_SIZE));
  // Reset ke halaman 1 bila-bila senarai terhasil berubah (penapis baharu ditapis, susunan
  // ditukar) — kalau tidak, editor boleh terkandas di halaman 5 walhal keputusan tapisan baharu
  // cuma ada 2 halaman, jadual nampak "kosong" tanpa penjelasan.
  useEffect(() => { setCurrentPage(1); }, [sortedRecords]);
  const pagedRecords = useMemo(
    () => sortedRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sortedRecords, currentPage]
  );

  // Pilihan pukal (2026-08-08, permintaan Izzat — "pilih kandungan supaya boleh ubah tindakan
  // secara pukal"). Skop pilihan sengaja HALAMAN SEMASA sahaja (bukan seluruh keputusan tapisan):
  // tindakan pukal ke atas rekod yang editor tak pernah lihat ialah cara paling mudah memusnahkan
  // kandungan tanpa sedar. Ticker dan baris baca-sahaja tak boleh dipilih langsung.
  const [pilihan, setPilihan] = useState<Set<string>>(new Set());
  const [tindakanPukalBerjalan, setTindakanPukalBerjalan] = useState(false);
  const [confirmPukal, setConfirmPukal] = useState<'' | 'Archive' | 'Live' | 'Padam'>('');
  const idBolehPilihHalamanIni = useMemo(
    () => pagedRecords
      .filter(r => r.slot !== 'Ticker' && !(currentUserRole === 'EDITOR' && editorViewMode === 'all' && r.editorName !== currentUserName))
      .map(r => r.id),
    [pagedRecords, currentUserRole, editorViewMode, currentUserName]
  );
  // Buang pilihan yang tak lagi kelihatan (tukar halaman/penapis) — kalau tidak, tindakan pukal
  // boleh mengenai rekod yang dah lama hilang daripada skrin, tanpa editor sedar.
  useEffect(() => {
    setPilihan(prev => {
      const dibenarkan = new Set(idBolehPilihHalamanIni);
      const baharu = new Set([...prev].filter(id => dibenarkan.has(id)));
      return baharu.size === prev.size ? prev : baharu;
    });
  }, [idBolehPilihHalamanIni]);
  const togglePilih = (id: string) => {
    setPilihan(prev => {
      const baharu = new Set(prev);
      if (baharu.has(id)) baharu.delete(id); else baharu.add(id);
      return baharu;
    });
  };
  const togglePilihSemua = (pilihSemua: boolean) => {
    setPilihan(pilihSemua ? new Set(idBolehPilihHalamanIni) : new Set());
  };

  const handleUpdateStatus = async (id: string, newStatus: BriefRecord['status']) => {
    setActionError(null);
    const previous = items;
    // Optimistic update, rolled back on failure.
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
    if (activeItemModal && activeItemModal.id === id) {
      setActiveItemModal({ ...activeItemModal, status: newStatus });
    }

    try {
      const res = await fetch(`/api/system/content/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: LABEL_TO_STATUS[newStatus] }),
      });
      const body = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Gagal mengemas kini status kandungan. Cuba lagi.');
      }
      // LIFE-02 (audit ChatGPT 2026-08-08) — server dah pulangkan slotPenuh (Bidang lulus, cuma
      // tiada ruang lagi, kandungan kekal 'pending' menunggu slot lapang), dahulu diabaikan terus
      // di sini: mesej sentiasa papar "disiarkan" DAN status tempatan tersilap ditukar ke Live
      // walaupun rekod sebenar masih Menunggu — betulkan kedua-duanya.
      if (body.slotPenuh) {
        setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'Pending' } : i));
        if (activeItemModal && activeItemModal.id === id) {
          setActiveItemModal(prev => prev ? { ...prev, status: 'Pending' } : prev);
        }
        onToast?.('success', 'Kandungan menunggu, slot penuh.');
      } else {
        onToast?.('success', newStatus === 'Archive' ? 'Kandungan diarkibkan.' : 'Kandungan disiarkan.');
      }
    } catch (err: any) {
      setItems(previous);
      if (activeItemModal && activeItemModal.id === id) {
        setActiveItemModal(previous.find(i => i.id === id) || null);
      }
      const mesej = err.message || 'Gagal kemas kini status.';
      setActionError(mesej);
      onToast?.('error', mesej);
    }
  };

  // Tolak (2026-07-29, alur kerja Draf/Terbit) — BUKAN sekadar tanda status='rejected'. Item
  // betul-betul PULANG jadi draf peribadi semula (server salin kandungan penuh balik ke
  // slots_config.manualSummary slot asal, arkib rekod Indeks lama) — hilang terus daripada
  // senarai Indeks (draf tak pernah terpapar di sini), muncul semula dalam modal Tulis Kandungan.
  // Sebab penolakan (2026-08-02, Fasa 6) — Tolak pulangkan draf, sebab dipaparkan kepada
  // penulis. Dahulu window.prompt(); ditukar ke pengesahan sebaris (DLG-08, audit ChatGPT
  // 2026-08-09) — sebab dahulu PILIHAN. Dijadikan WAJIB (2026-08-18, Izzat: "kenapa saya
  // berjaya arkibkan tanpa perlu masukkan sebarang alasan?") — editor asal terima draf
  // pulangan tanpa petunjuk apa isunya kalau sebab dibiarkan kosong.
  const handleRejectToDraft = async (id: string, sebab: string) => {
    setConfirmTolakId('');
    setTolakSebab('');
    setActionError(null);
    const previous = items;
    setItems(prev => prev.filter(i => i.id !== id));
    if (activeItemModal && activeItemModal.id === id) setActiveItemModal(null);
    try {
      const res = await fetch(`/api/system/content/${encodeURIComponent(id)}/reject-to-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sebab }),
      });
      if (!res.ok) {
        const body = await bacaJsonSelamat(res).catch(() => ({}));
        throw new Error(body.error || 'Gagal menolak kandungan. Cuba lagi.');
      }
      onToast?.('success', 'Kandungan ditolak, kembali jadi draf.');
    } catch (err: any) {
      setItems(previous);
      const mesej = err.message || 'Gagal tolak kandungan.';
      setActionError(mesej);
      onToast?.('error', mesej);
    }
  };

  // Tong Sampah (2026-08-08, permintaan Izzat — "boleh je yg dipadam tu masuk dlm satu tempat yg
  // boleh restore semula"). Padam kandungan Aktif/Menunggu/Arkib tak lagi hilang terus — ia
  // pindah ke status 'dipadam' (boleh Pulihkan), auto-padam KEKAL lepas 30 hari (server-side,
  // runSchedulingTick). Reversible, jadi tiada keperluan pengesahan berat macam Padam Kekal.
  const handlePadamLembut = async (id: string) => {
    setActionError(null);
    const previous = items;
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'Dipadam' } : i));
    try {
      const res = await fetch(`/api/system/content/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const body = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Gagal memindahkan kandungan ke Tong Sampah. Cuba lagi.');
      onToast?.('success', 'Kandungan dipindah ke Tong Sampah.');
    } catch (err: any) {
      setItems(previous);
      const mesej = err.message || 'Gagal padam kandungan.';
      setActionError(mesej);
      onToast?.('error', mesej);
    }
  };

  const handlePulihkanTongSampah = async (id: string) => {
    setActionError(null);
    const previous = items;
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      const res = await fetch(`/api/system/content/${encodeURIComponent(id)}/pulihkan-sampah`, { method: 'POST' });
      const body = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Gagal memulihkan kandungan. Cuba lagi.');
      onToast?.('success', 'Kandungan dipulihkan.');
    } catch (err: any) {
      setItems(previous);
      const mesej = err.message || 'Gagal pulihkan kandungan.';
      setActionError(mesej);
      onToast?.('error', mesej);
    }
  };

  // Padam KEKAL (2026-08-08) — tindakan kedua DELETE pada kandungan yang DAH pun 'Dipadam'
  // (Tong Sampah). Betul-betul DELETE FROM, tiada laluan pulih lepas ni — pengesahan dalam-
  // aplikasi (confirmPadamKekalId, bukan window.confirm — lihat pepijat butang Tutup Urus Slot
  // hari ni: dialog native boleh disenyapkan pelayar) WAJIB sebelum panggil.
  const [confirmPadamKekalId, setConfirmPadamKekalId] = useState('');
  // DLG-08 (2B, audit ChatGPT 2026-08-09) — dahulu window.prompt() utk Tolak (sebab pilihan).
  // window.prompt native tak boleh distyle/disahkan input; ditukar ke pengesahan sebaris
  // dalam-aplikasi, sama corak macam confirmPadamKekalId di atas.
  const [confirmTolakId, setConfirmTolakId] = useState('');
  // Pengesahan Siar (2026-08-12, keputusan Izzat selepas simulasi UX #28) — Siar ialah SATU-SATUNYA
  // tindakan dalam dropdown ni yang MENDEDAHKAN kandungan kepada pembaca awam serta-merta, tetapi
  // dahulu ia satu-satunya yang bertindak tanpa sebarang pengesahan (Tolak dan Padam kekal sudah
  // ada). Arkib sengaja TIDAK diberi pengesahan: ia menyembunyikan, bukan mendedahkan, jadi salah
  // klik di situ tidak menjejaskan pembaca dan kerja harian kekal pantas.
  const [confirmSiarId, setConfirmSiarId] = useState('');
  const [tolakSebab, setTolakSebab] = useState('');

  // Pengesahan tindakan baris sebagai DIALOG, bukan inline dalam sel jadual (keputusan Izzat
  // 2026-08-13: "terbit dan padam draf" perlu pengesahan; punca asal ialah tiket "Mobile Action
  // Confirmation Pattern"). Pengesahan inline dahulu MELEBARKAN jadual yang boleh diskrol
  // mendatar, jadi di telefon butang "Ya, siar" terdorong KELUAR skrin — editor perlu meneka
  // yang dia kena skrol lagi ke kanan, tanpa sebarang petunjuk. Dialog berpusat tidak boleh
  // terdorong keluar pada mana-mana lebar, dan EditorDialog saiz `sm` memang direka untuk
  // pengesahan (perangkap fokus + Escape sudah terbina).
  //
  // Pengesahan dalam MODAL butiran (confirmSiarId di bawah) sengaja DIKEKALKAN inline — ia sudah
  // berada dalam dialog, bukan dalam jadual boleh skrol, jadi masalah asal tak terpakai di situ.
  const [dialogSah, setDialogSah] = useState<{ jenis: 'siar' | 'padam'; id: string; tajuk: string } | null>(null);
  const handlePadamKekal = async (id: string) => {
    setConfirmPadamKekalId('');
    setActionError(null);
    const previous = items;
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      const res = await fetch(`/api/system/content/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const body = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Gagal memadam kandungan secara kekal. Cuba lagi.');
      onToast?.('success', 'Kandungan dipadam kekal.');
    } catch (err: any) {
      setItems(previous);
      const mesej = err.message || 'Gagal padam kekal.';
      setActionError(mesej);
      onToast?.('error', mesej);
    }
  };

  // Tindakan PUKAL (2026-08-08, permintaan Izzat). Dijalankan SATU-PERSATU, bukan serentak:
  // server siri-kan setiap tulisan kandungan (denganKunciKandungan) jadi hantar serentak cuma
  // memenuhkan baris gilirannya tanpa apa-apa keuntungan, DAN gerbang seperti hadKandunganSlot
  // perlu melihat kesan item sebelumnya untuk memutuskan item berikutnya dengan betul.
  //
  // Kegagalan SATU item tidak membatalkan yang lain (setiap kandungan ialah keputusan editorial
  // berasingan) — sebaliknya dikira dan dilaporkan sekali di hujung, jadi editor nampak dengan
  // tepat berapa yang menjadi dan kenapa yang lain gagal.
  const jalankanTindakanPukal = async (tindakan: 'Archive' | 'Live' | 'Tolak' | 'Padam') => {
    const idTerpilih = [...pilihan];
    if (idTerpilih.length === 0) return;
    setConfirmPukal('');
    setActionError(null);
    setTindakanPukalBerjalan(true);
    let berjaya = 0;
    const gagal: string[] = [];
    for (const id of idTerpilih) {
      try {
        let res: Response;
        if (tindakan === 'Padam') {
          res = await fetch(`/api/system/content/${encodeURIComponent(id)}`, { method: 'DELETE' });
        } else if (tindakan === 'Tolak') {
          res = await fetch(`/api/system/content/${encodeURIComponent(id)}/reject-to-draft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sebab: '' }),
          });
        } else {
          res = await fetch(`/api/system/content/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: LABEL_TO_STATUS[tindakan] }),
          });
        }
        const body = await bacaJsonSelamat(res).catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Tindakan gagal untuk kandungan ini.');
        berjaya++;
      } catch (err: any) {
        gagal.push(err.message || 'Ralat tidak diketahui');
      }
    }
    setPilihan(new Set());
    setTindakanPukalBerjalan(false);
    // Muat semula daripada server, bukan tekaan optimistik: satu tindakan pukal boleh mencetuskan
    // kesan sampingan yang klien tak boleh ramal (naik taraf giliran slot-penuh, Tolak buang
    // rekod terus daripada Indeks) — mengagak keadaan baharu di sini pasti terpesong.
    muatSemula();
    if (gagal.length === 0) {
      onToast?.('success', `${berjaya} kandungan dikemas kini.`);
    } else {
      const mesej = `${berjaya} berjaya, ${gagal.length} gagal. Sebab pertama: ${gagal[0]}`;
      setActionError(mesej);
      onToast?.('error', mesej);
    }
  };

  // Nota Editor daripada Indeks (2026-08-08, Fasa 4). Gerbang SEBENAR di server
  // (PATCH /content/:id) — UI di sini cuma sembunyi kawalan untuk yang tak layak, bukan
  // keselamatan. Kandungan disegarkan optimistik lepas berjaya (nota + tandatangan) supaya
  // editor nampak hasil serta-merta tanpa muat semula seluruh senarai.
  const handleSimpanNota = async () => {
    if (!activeItemModal) return;
    setMenyimpanNota(true);
    setRalatNota('');
    try {
      const res = await fetch(`/api/system/content/${encodeURIComponent(activeItemModal.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: drafNota }),
      });
      const body = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Gagal menyimpan nota. Cuba lagi.');
      const notaOlehBaharu = body.notaOleh || '';
      setItems(prev => prev.map(i => i.id === activeItemModal.id ? { ...i, note: drafNota, notaOleh: notaOlehBaharu } : i));
      setActiveItemModal(prev => prev ? { ...prev, note: drafNota, notaOleh: notaOlehBaharu } : prev);
      setSuntingNota(false);
      onToast?.('success', 'Nota Editor disimpan.');
    } catch (err: any) {
      const mesej = err.message || 'Gagal simpan nota.';
      setRalatNota(mesej);
      onToast?.('error', mesej);
    } finally {
      setMenyimpanNota(false);
    }
  };

  // Siarkan Semula: kandungan archived boleh diaktifkan semula ke slot yang Bidangnya sepadan
  // (asal atau lain) — Bidang/Topik boleh diedit khusus di sini sebab item ni tak lagi terikat
  // slot aktif. validateBidangTopik() di server semak semula terhadap slot SASARAN.
  const handleReactivate = async () => {
    if (!activeItemModal || reactivateSlotIndex === '') return;
    setReactivating(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/system/content/${encodeURIComponent(activeItemModal.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          desk: reactivateDesk,
          topik: reactivateTopik,
          slotIndex: reactivateSlotIndex,
        }),
      });
      const body = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Gagal menyiarkan semula kandungan. Cuba lagi.');
      setItems(prev => prev.map(i => i.id === activeItemModal.id ? {
        ...i,
        status: 'Live',
        // reactivateDesk sumber terus daripada activeBidangList (dropdown) — sudah betul kes
        // hurufnya, formatTitleCase() di sini dulu SILAP tekabalik nama yang dah pun betul.
        desk: reactivateDesk,
        topik: reactivateTopik,
        slotIndex: Number(reactivateSlotIndex),
        slot: `Slot ${Number(reactivateSlotIndex) + 1}`,
      } : i));
      onToast?.('success', 'Kandungan disiarkan semula.');
      setActiveItemModal(null);
    } catch (err: any) {
      setActionError(err.message || 'Gagal siarkan semula.');
      onToast?.('error', err.message || 'Gagal siarkan semula.');
    } finally {
      setReactivating(false);
    }
  };

  // Reset kesan SERTA-MERTA (bukan tunggu Tapis) — ia tindakan "kosongkan", bukan carian baharu.
  const handleResetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };
  const handleApplyFilters = () => setAppliedFilters(draftFilters);

  return (
    <div className="space-y-6">
      {/* Modul ni dahulu langsung tiada tajuk (Pelan 01 Fasa C, baris #2) — kini memperkenalkan
          dirinya seperti modul lain, dengan kiraan status sebagai tindakan di hujung kanan. */}
      <ModulTajuk
        tajuk="Indeks Kandungan"
        huraian="Senarai induk semua kandungan editorial yang sudah direkodkan. Tapis mengikut status, Bidang, sumber, slot atau editor, dan uruskan penyiaran setiap kandungan."
        tindakan={
          <div className="flex items-center gap-2 font-sans text-[10px]">
            <StatusBadge tone="warning" label={`MENUNGGU: ${statusCounts.Pending}`} />
            <StatusBadge tone="success" label={`AKTIF: ${statusCounts.Live}`} />
            <StatusBadge tone="neutral" label={`ARKIB: ${statusCounts.Archive}`} />
          </div>
        }
      />

      {actionError && (
        <MesejStatus tone="error" className="flex justify-between items-center">
          <span className="inline-flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {actionError}</span>
          <button onClick={() => setActionError(null)} aria-label="Tutup" className="font-bold px-2 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        </MesejStatus>
      )}

      {/* MEJA KERJA EDITORIAL - SMART FILTER BAR */}
      <PanelCard className="space-y-4">
        <SectionLabel>01 — Penapis Kandungan</SectionLabel>

        {/* Search Input — draf sahaja, ditapis bila "Tapis" ditekan (lihat nota FilterState).
            Carian kekal SENTIASA nampak (bukan sebahagian panel boleh lipat di bawah) — ini
            tindakan paling kerap editor buat, tak patut perlu satu klik tambahan. */}
        <div className="flex items-center gap-2">
          <FormColumn saiz="md" className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Cari tajuk, ID, atau kata kunci kandungan…"
              value={draftFilters.search}
              onChange={e => patchDraft({ search: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') handleApplyFilters(); }}
              className={`${INPUT_BORANG} pl-10`}
            />
          </FormColumn>
          <Button
            variant="secondary" size="sm"
            onClick={() => setPanelTapisanTerbuka((v) => !v)}
            className="relative shrink-0"
            aria-expanded={panelTapisanTerbuka}
            aria-controls="panel-tapisan-lanjutan"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 inline" />
            Penapis
            {panelTapisanTerbuka ? <ChevronUp className="w-3.5 h-3.5 ml-1.5 inline" /> : <ChevronDown className="w-3.5 h-3.5 ml-1.5 inline" />}
            {bilanganTapisanAktif > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-Adjung-maroon text-white text-[9px] font-bold flex items-center justify-center">
                {bilanganTapisanAktif}
              </span>
            )}
          </Button>
        </div>

        {/* 7 Dropdown Smart Filters + Susunan — di sebalik butang "Penapis" (2026-08-08, dapatan
            audit UI/UX ChatGPT: "9 kawalan tapisan terpapar serentak" terlalu ramai keputusan
            sebelum editor boleh mula kerja; lalai peranan (Status=Menunggu utk Ketua Editor,
            Editor=nama sendiri utk Editor) dah tapiskan yang munasabah tanpa perlu editor nampak
            lapan kotak lagi setiap kunjungan). */}
        {panelTapisanTerbuka && (
        <div id="panel-tapisan-lanjutan" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 font-sans text-xs">
          {/* 1. Status Filter */}
          <div>
            <label className={LABEL_BORANG} htmlFor="tapis-status">STATUS</label>
            <select
              id="tapis-status"
              value={draftFilters.status}
              onChange={e => patchDraft({ status: e.target.value })}
              className={INPUT_BORANG}
            >
              <option value="Semua">Semua Status</option>
              <option value="Pending">Menunggu</option>
              <option value="Live">Aktif</option>
              <option value="Scheduled">Dijadualkan</option>
              <option value="Archive">Arkib</option>
              <option value="Dipadam">Tong Sampah</option>
            </select>
          </div>

          {/* 2. Jenis Kad Filter */}
          <div>
            <label className={LABEL_BORANG} htmlFor="tapis-jenis-kad">JENIS KAD</label>
            <select
              id="tapis-jenis-kad"
              value={draftFilters.cardType}
              onChange={e => patchDraft({ cardType: e.target.value })}
              className={INPUT_BORANG}
            >
              <option value="Semua">Semua Kad</option>
              <option value="HERO">{TIER_LABELS.HERO}</option>
              <option value="MENEGAK">{TIER_LABELS.MENEGAK}</option>
              <option value="STANDARD">{TIER_LABELS.STANDARD}</option>
              <option value="SEGI_EMPAT_MEDIUM">{TIER_LABELS.SEGI_EMPAT_MEDIUM}</option>
              <option value="SEGI_EMPAT_SMALL">{TIER_LABELS.SEGI_EMPAT_SMALL}</option>
              <option value="KOMPAK">{TIER_LABELS.KOMPAK}</option>
              <option value="BAR">{TIER_LABELS.BAR}</option>
              <option value="TICKER">{TIER_LABELS.TICKER}</option>
            </select>
          </div>

          {/* 3. Sumber — medan carian/autocomplete (2026-07-29), BUKAN dropdown terpilih tetap.
              <datalist> beri cadangan daripada sourceOptions sambil editor menaip, tapi nilai
              akhir teks bebas (padanan separa, lihat filteredRecords) — senarai sumber sebenar
              boleh cecah ratusan/ribuan bila sistem berkembang, dropdown biasa tak lagi praktikal. */}
          <div>
            <label className={LABEL_BORANG} htmlFor="tapis-sumber">SUMBER</label>
            <input
              id="tapis-sumber"
              type="text"
              list="sumber-datalist"
              placeholder="Cari sumber"
              value={draftFilters.source}
              onChange={e => patchDraft({ source: e.target.value })}
              className={INPUT_BORANG}
            />
            <datalist id="sumber-datalist">
              {sourceOptions.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          {/* 3b. Kaedah (cara kandungan dicipta — Manual/AI Generated/RSS Direct/dll.) Filter */}
          <div>
            <label className={LABEL_BORANG} htmlFor="tapis-kaedah">KAEDAH</label>
            <select
              id="tapis-kaedah"
              value={draftFilters.creator}
              onChange={e => patchDraft({ creator: e.target.value })}
              className={INPUT_BORANG}
            >
              <option value="Semua">Semua Kaedah</option>
              {creatorOptions.map(c => <option key={c} value={c}>{labelMod(c)}</option>)}
            </select>
          </div>

          {/* 3c. Editor — nama editor SEBENAR yang log masuk semasa Terbit (2026-07-29). Kosong
              untuk kandungan sedia ada sebelum ciri ni wujud (papar "Tidak diketahui", bukan reka
              nama) — sebab tu editorNameOptions tak sumbang opsyen kosong. */}
          <div>
            <label className={LABEL_BORANG} htmlFor="tapis-editor">EDITOR</label>
            <select
              id="tapis-editor"
              value={draftFilters.editor}
              onChange={e => patchDraft({ editor: e.target.value })}
              className={INPUT_BORANG}
            >
              <option value="Semua">Semua Editor</option>
              {editorNameOptions.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {/* 4. Desk Filter — HANYA bidang berdaftar aktif secara lalai; kumpulan "Mansuh"
              berasingan (lihat nota deskOptions/orphanDeskOptions di atas) untuk cari kandungan
              lama yang masih guna bidang yang dah dimansuhkan. */}
          <div>
            <label className={LABEL_BORANG} htmlFor="tapis-bidang">BIDANG</label>
            <select
              id="tapis-bidang"
              value={draftFilters.desk}
              onChange={e => patchDraft({ desk: e.target.value })}
              className={INPUT_BORANG}
            >
              <option value="Semua">Semua Bidang</option>
              <optgroup label="Bidang Berdaftar">
                {deskOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </optgroup>
              {orphanDeskOptions.length > 0 && (
                <optgroup label="Bidang Tidak Berdaftar (Mansuh)">
                  {orphanDeskOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </optgroup>
              )}
            </select>
          </div>

          {/* 5. Slot Filter */}
          <div>
            <label className={LABEL_BORANG} htmlFor="tapis-slot">SLOT</label>
            <select
              id="tapis-slot"
              value={draftFilters.slot}
              onChange={e => patchDraft({ slot: e.target.value })}
              className={INPUT_BORANG}
            >
              <option value="SemuaKecualiTicker">Semua Slot (kecuali Ticker)</option>
              <option value="Semua">Semua Slot (termasuk Ticker)</option>
              {slotOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* 6. Susunan */}
          <div>
            <label className={LABEL_BORANG} htmlFor="tapis-susunan">SUSUNAN</label>
            <select
              id="tapis-susunan"
              value={draftFilters.sort}
              onChange={e => patchDraft({ sort: e.target.value as FilterState['sort'] })}
              className={INPUT_BORANG}
            >
              <option value="newest">Paling Baharu</option>
              <option value="oldest">Paling Lama</option>
              <option value="az">Abjad (A–Z)</option>
              <option value="za">Abjad (Z–A)</option>
            </select>
          </div>

          {/* Tapis + Reset — penapis TIDAK terpakai sehingga "Tapis" ditekan (lihat nota
              FilterState di atas); "Set Semula Penapis" kekal serta-merta. */}
          <div className="flex items-end gap-2">
            <Button onClick={handleApplyFilters} size="sm" className="flex-1 relative">
              Tapis
              {filtersDirty && (
                <Tooltip text="Ada penapis belum ditapis">
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 border border-white" />
                </Tooltip>
              )}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleResetFilters} className="flex-1">
              Set Semula
            </Button>
          </div>
        </div>
        )}
      </PanelCard>

      {/* Editor View Switcher (Kandungan Saya vs Semua Read Only) — relevant once real EDITOR accounts exist */}
      {currentUserRole === 'EDITOR' && (
        <div className="flex bg-stone-100 p-1 rounded font-sans text-xs w-max border border-stone-200">
          <button
            onClick={() => setEditorViewMode('mine')}
            className={`px-4 py-1.5 rounded font-bold transition-all inline-flex items-center gap-1.5 ${
              editorViewMode === 'mine' ? 'bg-Adjung-maroon text-white' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Pin className="w-3.5 h-3.5" /> Kandungan Saya (Boleh Sunting & Siar)
          </button>
          <button
            onClick={() => setEditorViewMode('all')}
            className={`px-4 py-1.5 rounded font-bold transition-all inline-flex items-center gap-1.5 ${
              editorViewMode === 'all' ? 'bg-Adjung-maroon text-white' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> Semua Kandungan (Baca Sahaja)
          </button>
        </div>
      )}

      {/* Filtering Results Summary — julat halaman semasa (cth "1–100"), bukan sekadar jumlah
          keputusan tapisan, supaya editor tahu tepat baris mana sedang dipaparkan. */}
      <div className="px-1">
        <SectionLabel className="!mb-2">02 — Senarai Kandungan</SectionLabel>
        <div className="font-sans text-xs text-stone-500">
          {sortedRecords.length === 0 ? (
            <>Menampilkan <strong className="font-mono font-bold">0</strong> daripada <span className="font-mono font-semibold">{items.length}</span> jumlah kandungan</>
          ) : (
            <>
              Menampilkan <strong className="font-mono font-bold">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sortedRecords.length)}</strong> daripada <strong className="font-mono font-bold">{sortedRecords.length}</strong> keputusan tapisan (<span className="font-mono font-semibold">{items.length}</span> jumlah kandungan)
            </>
          )}
        </div>
      </div>

      {/* Bar tindakan pukal (2026-08-08) — muncul HANYA bila ada pilihan, jadi jadual kekal bersih
          dalam kerja harian biasa. Arkib/Siar boleh terus (kesan boleh diundur); Tolak dan Padam
          minta pengesahan dahulu sebab kesannya lebih jauh (Tolak buang rekod daripada Indeks,
          Padam pindah ke Tong Sampah). */}
      {pilihan.size > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap rounded-md border border-Adjung-maroon/30 bg-Adjung-maroon/5 px-4 py-2.5">
          <span className="font-sans text-xs font-semibold text-stone-700">
            {pilihan.size} kandungan dipilih
            <button type="button" onClick={() => setPilihan(new Set())} className="ml-2.5 font-normal text-stone-500 hover:text-stone-800 underline underline-offset-2 cursor-pointer">
              Kosongkan
            </button>
          </span>
          {tindakanPukalBerjalan ? (
            <span className="font-sans text-xs text-stone-500">Memproses…</span>
          ) : confirmPukal ? (
            <span className="flex items-center gap-2 font-sans text-xs">
              <span className="text-[var(--color-error)] font-semibold">
                {confirmPukal === 'Padam' ? `Padam ${pilihan.size} kandungan ke Tong Sampah?` : `Siarkan ${pilihan.size} kandungan?`}
              </span>
              <Button type="button" variant="primary" size="sm" onClick={() => jalankanTindakanPukal(confirmPukal as any)}>Ya, teruskan</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmPukal('')}>Batal</Button>
            </span>
          ) : (
            <span className="flex items-center gap-2 font-sans text-xs">
              <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmPukal('Live')}>Siar</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => jalankanTindakanPukal('Archive')}>Arkib</Button>
              {currentUserRole === 'KETUA_EDITOR' && (
                <Button type="button" variant="bahaya" size="sm" onClick={() => setConfirmPukal('Padam')}>Padam</Button>
              )}
            </span>
          )}
        </div>
      )}

      {/* Content List Table */}
      {loading ? (
        // Rangka pulsa (Fasa 18, 2026-08-05) — baris jadual kasar gantikan teks statik lama,
        // bayang bentuk senarai akan datang.
        <div className="bg-white rounded-lg border border-stone-200 overflow-hidden animate-pulse">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-stone-150 last:border-b-0">
              <div className="h-2.5 w-24 bg-stone-150 rounded shrink-0" />
              <div className="h-2.5 flex-1 bg-stone-150 rounded" />
              <div className="h-2.5 w-14 bg-stone-200 rounded shrink-0" />
            </div>
          ))}
        </div>
      ) : gagalMuatSenarai ? (
        <PanelCard>
          <KeadaanKosong
            tindakan={
              <Button variant="secondary" size="sm" onClick={muatSemula}>
                Cuba Semula
              </Button>
            }
          >
            Gagal memuatkan senarai kandungan.
          </KeadaanKosong>
        </PanelCard>
      ) : sortedRecords.length === 0 ? (
        <PanelCard>
          <KeadaanKosong
            tindakan={
              <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                Kembali ke Paparan Lalai
              </Button>
            }
          >
            {/* Paparan lalai (2026-08-14, dapatan #52 -- audit ChatGPT) -- "Kosongkan Penapis"
                sebelum ni membawa maksud tersirat "tunjuk semua", tapi Set Semula sebenarnya
                kembali ke penapis LALAI PERANAN (Ketua Editor = status Pending sahaja, "baris
                giliran kelulusan"), bukan "Semua". Bila giliran memang kosong, editor nampak
                "0 keputusan" lepas tekan set semula dan sangka sistem rosak. Mesej + label
                butang kini jelaskan ini ialah paparan LALAI, bukan hasil carian yang gagal. */}
            {appliedFilters.status === 'Pending' && !appliedFilters.search.trim()
              ? 'Tiada kandungan menunggu kelulusan buat masa ini -- paparan lalai anda ialah baris giliran kelulusan. Pilih status lain (cth "Semua Status") untuk lihat kandungan yang sudah diterbitkan.'
              : 'Tiada kandungan yang sepadan dengan kriteria filter pilihan anda.'}
          </KeadaanKosong>
        </PanelCard>
      ) : (
        <PanelCard padding="p-0">
          {/* Bekas skrol mendatar (2026-08-13, dapatan #38.3 mobile) -- w-full + min-w-0 di SINI
              (bukan pada PanelCard, komponen kongsi merentasi banyak konsol lain) supaya bekas ni
              sendiri terikat pada lebar induk dahulu sebelum overflow-x-auto berkuat kuasa. Tanpa
              w-full+min-w-0, bekas cuma besar ikut kandungan (table min-w-[850px]) dan limpahan
              merambat naik ke <main>, cetuskan pelayar mudah alih zum KELUAR SELURUH halaman
              Editorium (disahkan window.innerWidth jadi 930 pada peranti 375px) -- bukan cuma
              jadual skrol dlm sempadannya sendiri spt patut. */}
          <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs min-w-[850px] table-fixed">
            <caption className="sr-only">Senarai kandungan mengikut slot dan status</caption>
            <thead>
              <tr className={KEPALA_JADUAL}>
                <th scope="col" className="p-2.5 w-8">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua kandungan dalam halaman ini"
                    checked={idBolehPilihHalamanIni.length > 0 && idBolehPilihHalamanIni.every(id => pilihan.has(id))}
                    // Separa-pilih (indeterminate) tak boleh ditetapkan melalui atribut JSX —
                    // hanya melalui DOM property, jadi ref callback.
                    ref={(el) => { if (el) el.indeterminate = idBolehPilihHalamanIni.some(id => pilihan.has(id)) && !idBolehPilihHalamanIni.every(id => pilihan.has(id)); }}
                    onChange={(e) => togglePilihSemua(e.target.checked)}
                    disabled={idBolehPilihHalamanIni.length === 0}
                    className="cursor-pointer accent-Adjung-maroon disabled:cursor-not-allowed"
                  />
                </th>
                <th scope="col" className="p-2.5 w-16">ID</th>
                {/* Tajuk dikecilkan lagi + Editor (2026-07-29, permintaan pemilik projek) — Topik/
                    Kaedah/Jenis Kad dibuang terus daripada jadual (kekal di penapis + modal
                    perincian) supaya jadual tak lebar sampai sembunyikan lajur Tindakan. Tajuk
                    penuh (dipotong di sini) boleh dibaca melalui tooltip bila hover, sama corak
                    macam lajur ID. */}
                <th scope="col" className="p-2.5 w-40">Tajuk Kandungan</th>
                <th scope="col" className="p-2.5 w-32">Status</th>
                <th scope="col" className="p-2.5 w-24">Bidang</th>
                <th scope="col" className="p-2.5 w-28">Sumber</th>
                <th scope="col" className="p-2.5 w-24">Editor</th>
                <th scope="col" className="p-2.5 w-16">Slot</th>
                <th scope="col" className="p-2.5 w-16">Tarikh</th>
                <th scope="col" className="p-2.5 w-20 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="font-sans">
              {pagedRecords.map(rec => {
                // Guna rec.editorName (2026-08-08, pembetulan sama macam tapisan Kandungan Saya
                // di atas) — kandungan editor lain baca sahaja dlm tab "Semua Kandungan", tapi
                // kandungan sendiri kekal boleh sunting walau dalam tab tu.
                const isReadOnly = currentUserRole === 'EDITOR' && editorViewMode === 'all' && rec.editorName !== currentUserName;

                // Buka modal detail kandungan — dahulu dicetuskan hanya oleh onClick pada <tr>,
                // langsung tidak boleh dicapai papan kekunci (Audit UI/UX Editorium §G3, laluan
                // kerja harian utama modul ni). Kini dicetuskan oleh <button> sebenar dalam sel
                // Tajuk Brief supaya Tab/Enter/Space berfungsi sama macam klik tetikus.
                const bukaDetail = () => {
                  setActiveItemModal(rec);
                  const matchedBidang = activeBidangList.find(b => b.name.toLowerCase() === rec.desk.toLowerCase());
                  setReactivateDesk(matchedBidang ? matchedBidang.name : '');
                  setReactivateTopik(rec.topik);
                  setReactivateSlotIndex(rec.slotIndex);
                };

                // Nama & warna Bidang sebenar (2026-08-08, pepijat "Al-quran Dan Sunnah") — rec.desk
                // disimpan HURUF BESAR di DB (lihat finalCategory di contentRoutes.js), formatTitleCase()
                // lama cuma tekaan naif (tak tahu "Al-Quran" ada huruf besar lepas sengkang, capitalize
                // "dan" buta). Cari nama SEBENAR daripada Taksonomi (activeBidangList) dahulu — cuma
                // fallback ke tekaan kalau Bidang tu dah tak wujud/didaftar (kandungan lapuk).
                const bidangSepadanRec = activeBidangList.find(b => b.name.toLowerCase() === rec.desk.toLowerCase());

                return (
                  <tr
                    key={rec.id}
                    className={`hover:bg-stone-50 transition-colors ${GARIS_BARIS} ${pilihan.has(rec.id) ? 'bg-Adjung-maroon/[0.04]' : ''}`}
                  >
                    <td className="p-2.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Pilih: ${rec.title}`}
                        checked={pilihan.has(rec.id)}
                        onChange={() => togglePilih(rec.id)}
                        disabled={rec.slot === 'Ticker' || isReadOnly}
                        className="cursor-pointer accent-Adjung-maroon disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </td>
                    <Tooltip text={rec.id}>
                      <td className="p-2.5 font-sans text-xs text-stone-500 font-semibold truncate max-w-[100px]">
                        {rec.id}
                      </td>
                    </Tooltip>
                    <Tooltip text={rec.title}>
                      <td className="p-2.5">
                        <button
                          type="button"
                          onClick={bukaDetail}
                          className="w-full text-left cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-Adjung-maroon rounded-sm"
                        >
                          <div className="font-serif font-medium text-stone-900 leading-snug truncate">
                            {rec.title}
                          </div>
                          <div className="font-serif text-[11px] text-stone-500 truncate">
                            {rec.summary}
                          </div>
                        </button>
                      </td>
                    </Tooltip>
                    <td className="p-2.5">
                      <StatusBadge tone={STATUS_TONE[rec.status] || 'neutral'} label={labelStatus(rec.status).toUpperCase()} />
                    </td>
                    <td
                      className="p-2.5 font-sans text-xs font-semibold"
                      // Warna terus daripada activeBidangList (dimuat hidup daripada
                      // CategoryRegistry) — bukan nilai tetap disalin ke sini, jadi tukar warna
                      // di Taksonomi automatik terpapar di sini juga tanpa kerja tambahan.
                      style={{ color: bidangSepadanRec?.color || 'var(--stone-700)' }}
                    >
                      {bidangSepadanRec?.name || formatTitleCase(rec.desk)}
                    </td>
                    <td className="p-2.5 font-serif text-stone-800 text-xs truncate">{rec.source || '-'}</td>
                    <td className="p-2.5 font-sans text-[10px] text-stone-500 truncate">{rec.editorName || 'Tidak diketahui'}</td>
                    <td className="p-2.5 font-sans text-xs font-semibold text-stone-700">{rec.slot}</td>
                    <td className="p-2.5 font-sans text-stone-500 text-[10px] whitespace-nowrap">{rec.date}</td>
                    <td className="p-2.5 text-right font-sans text-xs whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {confirmPadamKekalId === rec.id ? (
                        // DLG-10 (2B, audit ChatGPT 2026-08-09) — dahulu label butang sahaja
                        // ("Padam kekal?"), tak terangkan ia tak boleh dibuat asal.
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-[var(--color-error)] font-semibold">Padam kekal, tak boleh dibuat asal?</span>
                          <Button type="button" variant="primary" size="sm" onClick={() => handlePadamKekal(rec.id)}>Padam Kekal</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmPadamKekalId('')}>Batal</Button>
                        </span>
                      ) : confirmTolakId === rec.id ? (
                        // Sebab kini WAJIB (2026-08-18, keputusan Izzat: "kenapa saya berjaya
                        // arkibkan tanpa perlu masukkan sebarang alasan?") — dahulu baris ni
                        // hantar sebab KOSONG terus (DLG-08, "tiada ruang utk medan sebab"),
                        // editor asal terima draf pulangan tanpa petunjuk apa isunya langsung.
                        // Kini kotak teks kecil terus di baris (bukan hantar terus ke modal) —
                        // butang "Ya" dilumpuhkan sehingga diisi. Gerbang pelayan (contentRoutes.js
                        // reject-to-draft) turut tolak sebab kosong — pertahanan dua lapis.
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-[var(--color-error)] font-semibold">Sebab ditolak:</span>
                          <input
                            type="text"
                            autoFocus
                            value={tolakSebab}
                            onChange={(e) => setTolakSebab(e.target.value)}
                            placeholder="Wajib diisi — dipaparkan kepada penulis"
                            className="min-w-[220px] px-2 py-1 border border-stone-300 rounded font-sans text-[11px] focus:outline-none focus:border-Adjung-maroon"
                          />
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={!tolakSebab.trim()}
                            onClick={() => handleRejectToDraft(rec.id, tolakSebab)}
                          >
                            Ya
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => { setConfirmTolakId(''); setTolakSebab(''); }}>Batal</Button>
                        </span>
                      ) : rec.slot !== 'Ticker' && !isReadOnly && rec.status === 'Dipadam' ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Button type="button" variant="secondary" size="sm" onClick={() => handlePulihkanTongSampah(rec.id)}>Pulihkan</Button>
                          {currentUserRole === 'KETUA_EDITOR' && (
                            <Button type="button" variant="bahaya" size="sm" onClick={() => setConfirmPadamKekalId(rec.id)}>Padam kekal</Button>
                          )}
                        </span>
                      ) : rec.slot !== 'Ticker' && !isReadOnly ? (
                        <select
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'Live') {
                              // Terbit & Padam disahkan melalui dialog (lihat nota dialogSah).
                              // Arkib sengaja TIDAK — ia menyembunyikan, bukan mendedahkan, dan
                              // boleh dibuat asal terus dari baris yang sama.
                              setDialogSah({ jenis: 'siar', id: rec.id, tajuk: rec.title });
                            } else if (val === 'Archive') {
                              handleUpdateStatus(rec.id, val as any);
                            } else if (val === 'Tolak') {
                              setConfirmTolakId(rec.id);
                              setTolakSebab('');
                            } else if (val === 'Padam') {
                              setDialogSah({ jenis: 'padam', id: rec.id, tajuk: rec.title });
                            }
                            e.target.value = '';
                          }}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 rounded px-1.5 py-1 font-sans text-[10px] font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-Adjung-maroon max-w-full"
                        >
                          {/* IH-01 (Pusingan 4, audit ChatGPT 2026-08-09) — susunan progresif
                              tindakan penerbitan -> pengurusan kandungan -> tindakan editorial ->
                              tindakan paling merosakkan (sepadan bar tindakan pukal Siar->Arkib->
                              Padam sebelah). Dahulu "Tolak" (agak berkesan) diselitkan antara Siar
                              dan Arkib, dua tindakan rutin selamat -- <select> native tiada beza
                              warna/berat visual antara opsyen, jadi susunan sahaja pembeza. */}
                          <option value="" disabled hidden>Tindakan ▾</option>
                          {rec.status !== 'Live' && <option value="Live">Siar</option>}
                          {rec.status !== 'Archive' && <option value="Archive">Arkib</option>}
                          <option value="Tolak">Tolak (arkib &amp; pulangkan draf)</option>
                          {currentUserRole === 'KETUA_EDITOR' && <option value="Padam">Padam (ke Tong Sampah)</option>}
                        </select>
                      ) : (
                        <span className="text-stone-400 text-[11px] font-sans">{rec.slot === 'Ticker' ? 'Ticker, urus di Modul Khas' : 'Baca Sahaja'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {/* Kawalan pagination (2026-07-29, permintaan pemilik projek) — 100 rekod setiap
              paparan, lihat nota PAGE_SIZE/pagedRecords di atas. Papar hanya bila lebih 1
              halaman — satu halaman sahaja tak perlu sebarang kawalan. */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-stone-200 font-sans text-xs">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ← Sebelum
              </Button>
              <span className="text-stone-500">
                Halaman <strong className="font-mono font-bold text-stone-800">{currentPage}</strong> daripada <strong className="font-mono font-bold text-stone-800">{totalPages}</strong>
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Seterusnya →
              </Button>
            </div>
          )}
        </PanelCard>
      )}

      {/* Pengesahan Terbit / Padam draf (keputusan Izzat 2026-08-13) — dialog berpusat, BUKAN
          inline dalam sel jadual. Lihat nota dialogSah: pengesahan inline dahulu melebarkan
          jadual boleh skrol dan menolak butang sahkan keluar skrin telefon. */}
      {dialogSah && (
        <EditorDialog
          saiz="sm"
          tajuk={dialogSah.jenis === 'siar' ? 'Siarkan kepada pembaca?' : 'Padam kandungan ini?'}
          onTutup={() => setDialogSah(null)}
          tindakan={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDialogSah(null)}>
                Batal
              </Button>
              <Button
                type="button"
                variant={dialogSah.jenis === 'siar' ? 'primary' : 'bahaya'}
                size="sm"
                onClick={() => {
                  const { jenis, id } = dialogSah;
                  setDialogSah(null);
                  if (jenis === 'siar') handleUpdateStatus(id, 'Live' as any);
                  else handlePadamLembut(id);
                }}
              >
                {dialogSah.jenis === 'siar' ? 'Ya, siarkan' : 'Ya, padam'}
              </Button>
            </>
          }
        >
          <div className="space-y-2 font-sans text-xs text-stone-600">
            <p className="font-semibold text-stone-800 break-words">{dialogSah.tajuk || '(tiada tajuk)'}</p>
            <p>
              {dialogSah.jenis === 'siar'
                ? 'Kandungan ini akan terus kelihatan kepada pembaca di muka depan sebaik sahaja disiarkan.'
                : 'Kandungan ini dihantar ke Tong Sampah. Ia masih boleh dipulihkan dari sana sebelum dipadam kekal.'}
            </p>
          </div>
        </EditorDialog>
      )}

      {/* BRIEF DETAIL MODAL */}
      {/* Tinggi tetap + tajuk/footer melekat (2026-07-29) — sebelum ni modal ni membesar ikut
          kandungan tanpa had (space-y-5 mudah, tiada overflow/tinggi maksimum), jadi bila
          Huraian Panjang/Nota panjang, butang tutup (✕) di header tertolak jauh ke atas luar
          skrin dan editor terpaksa tatal SELURUH HALAMAN belakang modal (bukan modal sendiri)
          untuk kembali ke atas dan jumpa ia — corak sama macam SlotManagerModal.tsx
          (flex-col + header/footer flex-none, badan sahaja overflow-y-auto). Butang "Tutup" di
          footer sentiasa jadi laluan kedua yang sedia ada. */}
      {activeItemModal && (
        <EditorDialog
          tajuk={(
            <div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-stone-500 font-bold block mb-1">
                DETAIL KANDUNGAN • {activeItemModal.id}
              </span>
              {/* Tajuk modal piawai (Pelan 01 Fasa D2): serif-lg maroon. */}
              <span className="font-serif text-lg font-bold text-Adjung-maroon">
                {activeItemModal.title}
              </span>
            </div>
          )}
          onTutup={() => setActiveItemModal(null)}
          saiz="lg"
          badanMenatal
          tindakanKiri={<span className="text-stone-500">Tarikh: <strong>{activeItemModal.date}</strong></span>}
          tindakan={confirmTolakId === activeItemModal.id ? (
            <Button variant="bahaya" disabled={!tolakSebab.trim()} onClick={() => handleRejectToDraft(activeItemModal.id, tolakSebab)}>
              Ya, tolak kandungan
            </Button>
          ) : confirmSiarId === activeItemModal.id ? (
            // Pengesahan Siar dalam modal (lihat nota confirmSiarId) — sama corak dgn Tolak.
            <>
              <Button variant="ghost" onClick={() => setConfirmSiarId('')}>
                Batal
              </Button>
              <Button onClick={() => { setConfirmSiarId(''); handleUpdateStatus(activeItemModal.id, 'Live'); }}>
                Ya, siar kepada pembaca
              </Button>
            </>
          ) : activeItemModal.slot !== 'Ticker' ? (
            // Susunan kaki modal (Pelan 01 Fasa D2): tindakan utama paling kanan, tindakan
            // merbahaya di kiri. "Tolak" (DLG-08, audit ChatGPT 2026-08-09) — dahulu
            // window.prompt(), kini pengesahan sebaris dalam-aplikasi (lihat blok di atas).
            <>
              <Button variant="ghost" onClick={() => setActiveItemModal(null)}>
                Tutup
              </Button>
              {/* Teks tepat (2026-08-12, keputusan Izzat selepas simulasi UX #27) — dahulu
                  "Tolak (kembali jadi draf)" menjanjikan SATU kandungan bertukar status, walhal
                  laluan /reject-to-draft sebenarnya ARKIBKAN rekod asal DAN cipta salinan draf
                  BAHARU (uuid '...-reject') untuk penulis asal. Editor yang percaya label lama
                  akan tercari-cari kandungan asalnya dalam senarai draf. */}
              <Button variant="bahaya" onClick={() => { setConfirmTolakId(activeItemModal.id); setTolakSebab(''); }}>
                Tolak (arkib &amp; pulangkan draf)
              </Button>
              {activeItemModal.status !== 'Live' && activeItemModal.status !== 'Archive' && (
                <Button onClick={() => setConfirmSiarId(activeItemModal.id)}>
                  Siar Kandungan
                </Button>
              )}
            </>
          ) : (
            <Button variant="ghost" onClick={() => setActiveItemModal(null)}>
              Tutup
            </Button>
          )}
        >
            {confirmTolakId === activeItemModal.id && (
              <div className="flex flex-col gap-2 rounded-md border border-Adjung-maroon/30 bg-Adjung-maroon/5 p-3">
                <span className="font-sans text-xs font-semibold text-stone-700">
                  Tolak kandungan ini? Ia akan kembali jadi draf dalam modal Tulis Kandungan.
                </span>
                <label className="flex flex-col gap-1">
                  <span className={LABEL_BORANG}>Sebab (wajib, dipaparkan kepada penulis)</span>
                  <textarea
                    value={tolakSebab}
                    onChange={(e) => setTolakSebab(e.target.value)}
                    rows={2}
                    autoFocus
                    className={INPUT_BORANG}
                  />
                </label>
                <div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setConfirmTolakId(''); setTolakSebab(''); }}>
                    Batal
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className={LABEL_BORANG}>Huraian Ringkas</span>
              <div className="font-serif text-sm text-stone-700 leading-relaxed bg-stone-50 p-4 rounded border border-stone-200">
                {activeItemModal.summary}
              </div>
            </div>

            {/* Huraian Panjang/Nota (2026-07-29, permintaan pemilik projek) — sebelum ni senyap
                dibuang daripada modal ni walaupun /api/system/content/all sentiasa pulangkannya.
                Papar hanya bila ada nilai (kebanyakan kandungan lama tiada) supaya modal tak
                bertambah panjang tanpa faedah untuk kandungan yang tak pernah isi medan ni. */}
            {activeItemModal.summaryLong.trim() && (
              <div className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Huraian Panjang</span>
                <div className="font-serif text-sm text-stone-700 leading-relaxed bg-stone-50 p-4 rounded border border-stone-200">
                  {activeItemModal.summaryLong}
                </div>
              </div>
            )}

            {/* Nota Editor (2026-08-08, Fasa 4 pemilikan kandungan) — boleh disunting terus dari
                sini oleh penulis asal kandungan (tiada tandatangan) atau Ketua Editor/Penolong
                (tandatangan peranan sahaja, cth "— Ketua Editor"). Editor lain nampak nota
                sedia ada (kalau ada) tapi TIADA kawalan sunting — gerbang sebenar di server. */}
            {(() => {
              const bolehSuntingNota = currentUserRole === 'KETUA_EDITOR' || activeItemModal.editorName === currentUserName;
              if (!activeItemModal.note.trim() && !bolehSuntingNota) return null;
              return (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className={LABEL_BORANG}>Nota Editor</span>
                    {bolehSuntingNota && !suntingNota && (
                      <button
                        type="button"
                        onClick={() => setSuntingNota(true)}
                        className="font-mono text-[9px] uppercase tracking-wider font-bold text-Adjung-maroon hover:underline cursor-pointer"
                      >
                        {activeItemModal.note.trim() ? '✎ Sunting' : '+ Tambah nota'}
                      </button>
                    )}
                  </div>
                  {suntingNota ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={drafNota}
                        onChange={(e) => setDrafNota(e.target.value)}
                        onKeyDown={(e) => tanganiKekunciItalic(e, drafNota, setDrafNota)}
                        rows={3}
                        maxLength={280}
                        className="font-serif text-sm text-stone-700 leading-relaxed bg-amber-50 p-4 rounded border border-amber-200 resize-y focus:outline-none focus:ring-1 focus:ring-Adjung-maroon"
                        placeholder="Nota untuk penulis kandungan ini"
                      />
                      {ralatNota && <MesejStatus tone="error">{ralatNota}</MesejStatus>}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => { setSuntingNota(false); setDrafNota(activeItemModal.note); setRalatNota(''); }}
                          disabled={menyimpanNota}
                          className="font-sans text-xs font-semibold text-stone-500 hover:text-stone-700 px-3 py-1.5 cursor-pointer disabled:opacity-50"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={handleSimpanNota}
                          disabled={menyimpanNota}
                          className="font-sans text-xs font-semibold text-white bg-Adjung-maroon hover:bg-Adjung-maroon-dark rounded px-3 py-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {menyimpanNota ? 'Menyimpan…' : 'Simpan Nota'}
                        </button>
                      </div>
                    </div>
                  ) : activeItemModal.note.trim() ? (
                    <div className="font-serif text-sm text-stone-700 leading-relaxed bg-amber-50 p-4 rounded border border-amber-200">
                      {activeItemModal.note}
                      {activeItemModal.notaOleh && (
                        <div className="font-sans text-[10px] text-stone-500 mt-2 text-right">— {activeItemModal.notaOleh}</div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })()}

            {/* SEJARAH VERSI (2026-08-12, keputusan Izzat selepas simulasi UX #20) — lihat nota
                penuh di sisi state `revisions` di atas: data/API/paparan semuanya sudah wujud,
                cuma tiada laluan UI ke kandungan TERBIT. Ticker dikecualikan (tiada rekod
                editorial_objects, jadi tiada revisi). */}
            {activeItemModal.slot !== 'Ticker' && (
              <div className="space-y-2">
                <span className="text-stone-400 text-[9px] uppercase tracking-widest font-bold block border-b border-stone-200 pb-1">Sejarah Versi</span>
                {revisionsLoading && <span className="font-sans text-xs text-stone-500">Memuatkan sejarah versi…</span>}
                {!revisionsLoading && revisionsError && <MesejStatus tone="error">{revisionsError}</MesejStatus>}
                {!revisionsLoading && !revisionsError && revisions && revisions.length === 0 && (
                  <span className="font-sans text-xs text-stone-500">Tiada sejarah versi direkodkan.</span>
                )}
                {!revisionsLoading && revisions && revisions.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {revisions.map((r, i) => {
                      const isTerkini = i === 0;
                      return (
                        <div key={r.id} className="flex items-start justify-between gap-4 border border-stone-200 rounded p-3">
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Versi {r.version}</span>
                              {isTerkini && <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-emerald-700">· Semasa</span>}
                              <span className="font-sans text-[10px] text-stone-400">{new Date(r.updatedAt || r.createdAt).toLocaleString('ms-MY')}</span>
                            </span>
                            <span className="font-serif text-[13px] text-stone-800 truncate">{r.title || <span className="text-stone-400">(tiada tajuk)</span>}</span>
                            <span className="font-sans text-[11px] text-stone-500 truncate">{r.summary || ''}</span>
                            {/* Label manusia, bukan token mentah (2026-08-14, dapatan #54 -- audit
                                ChatGPT) -- sebelum ni papar terus "manual-slot-save · approved",
                                lebih teknikal drpd senarai induk yang dah lalu formatCreatedBy()/
                                STATUS_TO_LABEL() konsisten. Selaraskan sejarah versi dgn senarai. */}
                            <span className="font-mono text-[9px] text-stone-400">{formatCreatedBy(r.createdBy || '')} · {STATUS_TO_LABEL[r.status] || r.status}</span>
                          </div>
                          {/* Editor biasa yang melihat kandungan orang lain (mod "Semua
                              Kandungan", baca sahaja) tidak boleh memulihkan versi — sama gerbang
                              pemilikan macam baris senarai di atas. */}
                          {!isTerkini && !(currentUserRole === 'EDITOR' && editorViewMode === 'all' && activeItemModal.editorName !== currentUserName) && (
                            <Button
                              type="button" variant="secondary" size="sm"
                              onClick={() => handlePulihVersi(r.id)}
                              disabled={restoringId !== null}
                            >
                              {restoringId === r.id ? 'Memulihkan…' : 'Pulih versi ini'}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* IH-03 (Pusingan 6, audit ChatGPT 2026-08-09) — dahulu 9 medan grid seragam,
                berat visual sama walau kepentingan keputusan berbeza nyata (Status/Bidang/Topik
                menggerak tindakan Siar/Tolak; Sumber/Tarikh Sumber/URL cuma provenans, relevan
                terutamanya kandungan asal RSS). Dikumpul 3 klasifikasi semantik yang disokong
                kod sedia ada (bukan kumpulan reka-reka) — tiada medan dibuang, tiada data/logik
                diubah, cuma susunan+heading kumpulan. Tahap primary/secondary dalam setiap
                kumpulan KEKAL sama (belum keputusan Izzat), semua guna heading konsisten. */}
            <div className="space-y-3 font-mono text-xs bg-stone-100 p-3 rounded border border-stone-200">
              <div>
                <span className="text-stone-400 text-[9px] uppercase tracking-widest font-bold block mb-1.5 border-b border-stone-200 pb-1">Kandungan</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><span className="text-stone-500 text-[9px] block">STATUS</span><strong className="text-stone-900">{labelStatus(activeItemModal.status)}</strong></div>
                  <div><span className="text-stone-500 text-[9px] block">BIDANG</span><strong className="text-stone-900">{activeBidangList.find(b => b.name.toLowerCase() === activeItemModal.desk.toLowerCase())?.name || formatTitleCase(activeItemModal.desk)}</strong></div>
                  {/* TIADA formatTitleCase() di sini (2026-08-16, pepijat ditemui simulasi Slot 3) — Topik
                      medan bebas taip-sendiri editor (BUKAN taksonomi tak-konsisten macam desk RSS di atas),
                      DB simpan tepat apa editor taip (cth "Zakat Pendeposit TH"). formatTitleCase() lower-
                      case-then-recapitalize SILAP rosakkan akronim (TH -> Th) yang editor sengaja besarkan. */}
                  <div><span className="text-stone-500 text-[9px] block">TOPIK</span><strong className="text-stone-900">{activeItemModal.topik || '-'}</strong></div>
                </div>
              </div>
              <div>
                <span className="text-stone-400 text-[9px] uppercase tracking-widest font-bold block mb-1.5 border-b border-stone-200 pb-1">Penerbitan</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><span className="text-stone-500 text-[9px] block">JENIS KAD</span><strong className="text-stone-900">{activeItemModal.cardType === '-' ? '-' : <TierLabel tier={activeItemModal.cardType} />}</strong></div>
                  <div><span className="text-stone-500 text-[9px] block">SLOT</span><strong className="text-stone-900">{activeItemModal.slot}</strong></div>
                  <div><span className="text-stone-500 text-[9px] block">KAEDAH</span><strong className="text-stone-900">{labelMod(activeItemModal.creator) || '-'}</strong></div>
                  <div><span className="text-stone-500 text-[9px] block">EDITOR</span><strong className="text-stone-900">{activeItemModal.editorName || 'Tidak diketahui'}</strong></div>
                </div>
              </div>
              <div>
                <span className="text-stone-400 text-[9px] uppercase tracking-widest font-bold block mb-1.5 border-b border-stone-200 pb-1">Sumber</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><span className="text-stone-500 text-[9px] block">SUMBER</span><strong className="text-stone-900">{activeItemModal.source || '-'}</strong></div>
                  <div><span className="text-stone-500 text-[9px] block">TARIKH SUMBER</span><strong className="text-stone-900">{activeItemModal.originalDate || '-'}</strong></div>
                  <div className="col-span-2 md:col-span-2 min-w-0">
                    <span className="text-stone-500 text-[9px] block">URL</span>
                    {activeItemModal.url && activeItemModal.url !== '#' ? (
                      <a href={activeItemModal.url} target="_blank" rel="noopener noreferrer" className="text-Adjung-maroon underline break-all font-semibold">{activeItemModal.url}</a>
                    ) : (
                      <strong className="text-stone-900">-</strong>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Jadual Terbit/Luput (2026-08-02) — tidak terpakai pada Ticker (disegarkan terus
                daripada suapan RSS). Medan kekal KELIHATAN untuk EDITOR biasa (papar nilai
                sedia ada) tapi dinyahaktifkan supaya dia faham ciri ni wujud walaupun bukan
                kebenaran dia — gerbang SEBENAR di server (PATCH /api/system/content/:id). */}
            {activeItemModal.slot !== 'Ticker' && (
              <div className="space-y-3 font-sans bg-sky-50 border border-sky-200 rounded p-4">
                <div className="text-[10px] font-bold text-sky-900 uppercase tracking-wider">
                  Jadual Terbit &amp; Jadual Luput (waktu Malaysia)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_BORANG}>Dijadualkan terbit</label>
                    {/* Penyeragaman tooltip 25/8 (arahan Izzat): title= pelayar asal ditukar ke
                        Tooltip kongsi. Span pembalut perlu: input disabled tidak menembak event
                        hover React. */}
                    <Tooltip text={currentUserRole !== 'KETUA_EDITOR' ? 'Hanya Ketua Editor/Penolong Ketua Editor boleh menetapkan jadual penerbitan.' : undefined}>
                      <span className="inline-flex w-full">
                        <input
                          type="datetime-local"
                          value={draftJadualTerbit}
                          disabled={currentUserRole !== 'KETUA_EDITOR'}
                          onChange={e => setDraftJadualTerbit(e.target.value)}
                          className={`${INPUT_BORANG} bg-white`}
                        />
                      </span>
                    </Tooltip>
                    {activeItemModal.scheduledPublishAt && (
                      <p className="text-[9px] text-sky-700 mt-1">Dijadualkan terbit: {formatKlDisplay(activeItemModal.scheduledPublishAt)}</p>
                    )}
                  </div>
                  <div>
                    <label className={LABEL_BORANG}>Dijadualkan luput</label>
                    <Tooltip text={currentUserRole !== 'KETUA_EDITOR' ? 'Hanya Ketua Editor/Penolong Ketua Editor boleh menetapkan jadual penerbitan.' : undefined}>
                      <span className="inline-flex w-full">
                        <input
                          type="datetime-local"
                          value={draftJadualLuput}
                          disabled={currentUserRole !== 'KETUA_EDITOR'}
                          onChange={e => setDraftJadualLuput(e.target.value)}
                          className={`${INPUT_BORANG} bg-white`}
                        />
                      </span>
                    </Tooltip>
                    {activeItemModal.scheduledExpiresAt && (
                      <p className="text-[9px] text-sky-700 mt-1">Dijadualkan luput: {formatKlDisplay(activeItemModal.scheduledExpiresAt)}</p>
                    )}
                  </div>
                </div>
                {currentUserRole !== 'KETUA_EDITOR' && (
                  <p className="text-[9px] text-stone-500">Hanya Ketua Editor/Penolong Ketua Editor boleh menetapkan jadual.</p>
                )}
                {jadualError && <MesejStatus tone="error">{jadualError}</MesejStatus>}
                {currentUserRole === 'KETUA_EDITOR' && (
                  <Button onClick={handleSimpanJadual} disabled={savingJadual}>
                    {savingJadual ? 'Menyimpan…' : 'Simpan Jadual'}
                  </Button>
                )}
              </div>
            )}

            {activeItemModal.status === 'Archive' && activeItemModal.slot !== 'Ticker' && (
              <div className="space-y-3 font-sans bg-amber-50 border border-amber-200 rounded p-4">
                <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                  Siar Semula. Bidang kandungan ni tak lagi sepadan slot asal, pilih Bidang dan slot sasaran (Bidang boleh diubah supaya sepadan slot lain).
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_BORANG}>Bidang</label>
                    <select
                      value={reactivateDesk}
                      onChange={e => { setReactivateDesk(e.target.value); setReactivateSlotIndex(''); }}
                      className={`${INPUT_BORANG} bg-white`}
                    >
                      <option value="">— Pilih Bidang —</option>
                      {activeBidangList.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_BORANG}>Topik</label>
                    <input
                      type="text"
                      value={reactivateTopik}
                      onChange={e => setReactivateTopik(e.target.value)}
                      className={`${INPUT_BORANG} bg-white`}
                    />
                  </div>
                </div>
                <div>
                  <label className={LABEL_BORANG}>Slot Sasaran (Bidang sepadan sahaja)</label>
                  <select
                    value={reactivateSlotIndex}
                    onChange={e => setReactivateSlotIndex(e.target.value === '' ? '' : Number(e.target.value))}
                    className={`${INPUT_BORANG} bg-white`}
                    disabled={!reactivateDesk}
                  >
                    <option value="">— Pilih Slot —</option>
                    {allSlots
                      .filter(s => s.manualDesk.toLowerCase() === reactivateDesk.toLowerCase())
                      .map(s => <option key={s.slotIndex} value={s.slotIndex}>Slot {s.slotIndex + 1}</option>)}
                  </select>
                  {reactivateDesk && allSlots.filter(s => s.manualDesk.toLowerCase() === reactivateDesk.toLowerCase()).length === 0 && (
                    <p className="text-[9px] text-amber-700 mt-1">Tiada slot ditetapkan untuk Bidang ni lagi. Tetapkan dulu di Tetapan &gt; Taksonomi.</p>
                  )}
                </div>
                <Button
                  onClick={handleReactivate}
                  disabled={reactivating || !reactivateDesk || !reactivateTopik.trim() || reactivateSlotIndex === ''}
                >
                  {reactivating ? 'Menyiarkan…' : 'Siarkan Semula'}
                </Button>
              </div>
            )}
        </EditorDialog>
      )}
    </div>
  );
};

export default IndeksConsole;
