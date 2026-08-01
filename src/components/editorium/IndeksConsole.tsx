import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, X, Search, Pin, Lock } from 'lucide-react';
import { tierForSlot, TIER_LABELS, TIER_LABEL_IS_ENGLISH } from '../../../core/editorial/GeometryConfig.js';
import { Tooltip } from '../common/Tooltip';
import { labelMod, labelStatus } from '../../config/istilah';

interface BriefRecord {
  id: string;
  title: string;
  summary: string;
  desk: string;
  topik: string;
  // Draf SENGAJA tiada di sini (2026-07-29) — draf ialah ruang peribadi editor dalam modal Tulis
  // Kandungan sahaja (slots_config.manualSummary), tak pernah punya baris editorial_objects,
  // jadi tak sesekali muncul dalam Indeks. Lihat nota alur kerja di server.js.
  status: 'Pending' | 'Live' | 'Archive';
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
  originalDate: string;
  url: string;
}

// Renders a tier label, condong (italic) whenever GeometryConfig flags it as an unapproved
// English/borrowed word — same rule and same source as PerlembagaanConsole.tsx's TierLabel.
const TierLabel: React.FC<{ tier: string }> = ({ tier }) =>
  TIER_LABEL_IS_ENGLISH[tier] ? <em className="italic">{TIER_LABELS[tier]}</em> : <>{TIER_LABELS[tier]}</>;

interface IndeksConsoleProps {
  currentUserRole?: 'KETUA_EDITOR' | 'EDITOR';
  currentUserName?: string;
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
};
const LABEL_TO_STATUS: Record<BriefRecord['status'], string> = {
  Live: 'approved',
  Pending: 'pending',
  Archive: 'archived',
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
  currentUserName = 'Izzat Anas'
}) => {
  const [items, setItems] = useState<BriefRecord[]>([]);
  const [loading, setLoading] = useState(true);
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
  //   - KETUA_EDITOR log masuk → Indeks lalai papar SEMUA editor tapi Status=Pending, susunan
  //     Paling Baharu — baris giliran kelulusan (apa yang perlu tindakan dia), bukan semua status.
  const DEFAULT_FILTERS: FilterState = currentUserRole === 'EDITOR'
    ? {
        search: '', status: 'Semua', cardType: 'Semua', source: '', creator: 'Semua', desk: 'Semua',
        slot: 'SemuaKecualiTicker', editor: currentUserName, sort: 'newest',
      }
    : {
        search: '', status: 'Pending', cardType: 'Semua', source: '', creator: 'Semua', desk: 'Semua',
        slot: 'SemuaKecualiTicker', editor: 'Semua', sort: 'newest',
      };
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const patchDraft = (patch: Partial<FilterState>) => setDraftFilters(f => ({ ...f, ...patch }));
  const filtersDirty = JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters);

  // Editor View Filter: Saya vs Semua (Read Only) — only meaningful once real EDITOR accounts
  // exist; KETUA_EDITOR always sees and can act on everything.
  const [editorViewMode, setEditorViewMode] = useState<'mine' | 'all'>(currentUserRole === 'EDITOR' ? 'mine' : 'all');

  // Detail Modal State
  const [activeItemModal, setActiveItemModal] = useState<BriefRecord | null>(null);

  // Siar-semula kandungan archived — Bidang/Topik/slot sasaran boleh diedit khusus untuk item
  // berstatus Archive (lihat "03 — Bidang & Topik" di Perlembagaan untuk peraturan penuh).
  const [activeBidangList, setActiveBidangList] = useState<{ name: string; color: string }[]>([]);
  const [allSlots, setAllSlots] = useState<{ slotIndex: number; manualDesk: string }[]>([]);
  const [reactivateDesk, setReactivateDesk] = useState('');
  const [reactivateTopik, setReactivateTopik] = useState('');
  const [reactivateSlotIndex, setReactivateSlotIndex] = useState<number | ''>('');
  const [reactivating, setReactivating] = useState(false);

  // Load Real Data from SQLite Endpoint
  useEffect(() => {
    setLoading(true);
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
            originalDate: item.originalDate || '',
            url: item.url || '',
          };
        });

        setItems(normalized);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading index data:', err);
        setLoading(false);
      });

    fetch('/api/system/categories/active')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setActiveBidangList(data.map((c: any) => ({ name: c.name, color: c.color }))); })
      .catch(e => console.error('Error fetching active Bidang:', e));

    fetch('/api/system/slots')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setAllSlots(data.map((s: any) => ({ slotIndex: s.slotIndex, manualDesk: s.manualDesk || '' }))); })
      .catch(e => console.error('Error fetching slots:', e));
  }, [currentUserName]);

  // Status Counters
  const statusCounts = useMemo(() => {
    return {
      Pending: items.filter(i => i.status === 'Pending').length,
      Live: items.filter(i => i.status === 'Live').length,
      Archive: items.filter(i => i.status === 'Archive').length,
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
      // Editor View Mode Filter — NOT enforced: item.creator is a machine token (which save path
      // wrote it — Manual/AI Generated/RSS Direct/dll., see formatCreatedBy above), not a real per-account
      // author, so it can never equal currentUserName. Without real multi-editor sign-in there is no
      // way to know which content belongs to which editor, so "Kandungan Saya" intentionally shows
      // the same set as "Semua Kandungan" for now (see the notice banner rendered when this mode is
      // active) rather than silently filtering everything out.

      // Search Query
      if (appliedFilters.search.trim()) {
        const q = appliedFilters.search.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.source.toLowerCase().includes(q) ||
          item.creator.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Filter: Status
      if (appliedFilters.status !== 'Semua' && item.status !== appliedFilters.status) return false;

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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Gagal kemas kini status (${res.status}).`);
      }
    } catch (err: any) {
      setItems(previous);
      if (activeItemModal && activeItemModal.id === id) {
        setActiveItemModal(previous.find(i => i.id === id) || null);
      }
      setActionError(err.message || 'Gagal kemas kini status.');
    }
  };

  // Tolak (2026-07-29, alur kerja Draf/Terbit) — BUKAN sekadar tanda status='rejected'. Item
  // betul-betul PULANG jadi draf peribadi semula (server salin kandungan penuh balik ke
  // slots_config.manualSummary slot asal, arkib rekod Indeks lama) — hilang terus daripada
  // senarai Indeks (draf tak pernah terpapar di sini), muncul semula dalam modal Tulis Kandungan.
  // Sebab penolakan (2026-08-02, Fasa 6) — dahulu Tolak pulangkan draf TANPA sebarang catatan
  // kepada penulis. `window.prompt` sengaja BUKAN modal borang penuh — Tolak ialah tindakan
  // pantas dalam senarai, bukan destinasi sendiri; sebab BOLEH dikosongkan (window.confirm
  // sebelum ni pun tak wajibkan apa-apa input).
  const handleRejectToDraft = async (id: string) => {
    const sebab = window.prompt('Tolak kandungan ini? Ia akan kembali jadi draf dalam modal Tulis Kandungan. Nyatakan sebab (pilihan, dipaparkan kepada penulis):', '');
    if (sebab === null) return; // Batal
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
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Gagal tolak kandungan (${res.status}).`);
      }
    } catch (err: any) {
      setItems(previous);
      setActionError(err.message || 'Gagal tolak kandungan.');
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
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Gagal siarkan semula (${res.status}).`);
      setItems(prev => prev.map(i => i.id === activeItemModal.id ? {
        ...i,
        status: 'Live',
        desk: formatTitleCase(reactivateDesk),
        topik: reactivateTopik,
        slotIndex: Number(reactivateSlotIndex),
        slot: `Slot ${Number(reactivateSlotIndex) + 1}`,
      } : i));
      setActiveItemModal(null);
    } catch (err: any) {
      setActionError(err.message || 'Gagal siarkan semula.');
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
      {/* MEJA KERJA EDITORIAL - SMART FILTER BAR */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200 space-y-4">
        <div className="flex flex-wrap justify-end items-center gap-4">
          {/* Quick Counter Badges */}
          <div className="flex items-center gap-2 font-sans text-[10px]">
            <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold">Menunggu: <span className="font-mono">{statusCounts.Pending}</span></span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold">Aktif: <span className="font-mono">{statusCounts.Live}</span></span>
            <span className="bg-stone-200 text-stone-700 px-2 py-1 rounded font-bold">Arkib: <span className="font-mono">{statusCounts.Archive}</span></span>
          </div>
        </div>

        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs font-sans px-3 py-2 rounded flex justify-between items-center">
            <span className="inline-flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {actionError}</span>
            <button onClick={() => setActionError(null)} className="font-bold px-2"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Search Input — draf sahaja, ditapis bila "Tapis" ditekan (lihat nota FilterState). */}
        <div className="w-full relative">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Cari tajuk, ID, atau kata kunci brief..."
            value={draftFilters.search}
            onChange={e => patchDraft({ search: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') handleApplyFilters(); }}
            className="w-full bg-stone-50 border border-stone-300 rounded pl-10 pr-4 py-2.5 font-sans text-xs shadow-xs"
          />
        </div>

        {/* 7 Dropdown Smart Filters + Susunan */}
        {/* lg:grid-cols-5 (bukan 9) — 2026-07-29, permintaan pemilik projek: paksa kesemua 9
            kawalan dalam SATU baris buat setiap kotak terlalu sempit/kecil pada lebar skrin
            biasa. 5 lajur bermakna 9 kawalan lipat jadi DUA baris (5+4) — lebih selesa dibaca
            tanpa mengira lebar tetingkap. */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 font-sans text-xs">
          {/* 1. Status Filter */}
          <div>
            <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">STATUS</label>
            <select
              value={draftFilters.status}
              onChange={e => patchDraft({ status: e.target.value })}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-semibold text-xs"
            >
              <option value="Semua">Semua Status</option>
              <option value="Pending">Menunggu</option>
              <option value="Live">Aktif</option>
              <option value="Archive">Arkib</option>
            </select>
          </div>

          {/* 2. Jenis Kad Filter */}
          <div>
            <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">JENIS KAD</label>
            <select
              value={draftFilters.cardType}
              onChange={e => patchDraft({ cardType: e.target.value })}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-semibold text-xs"
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
            <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">SUMBER</label>
            <input
              type="text"
              list="sumber-datalist"
              placeholder="Cari sumber…"
              value={draftFilters.source}
              onChange={e => patchDraft({ source: e.target.value })}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-semibold text-xs"
            />
            <datalist id="sumber-datalist">
              {sourceOptions.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          {/* 3b. Kaedah (cara kandungan dicipta — Manual/AI Generated/RSS Direct/dll.) Filter */}
          <div>
            <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">KAEDAH</label>
            <select
              value={draftFilters.creator}
              onChange={e => patchDraft({ creator: e.target.value })}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-semibold text-xs"
            >
              <option value="Semua">Semua Kaedah</option>
              {creatorOptions.map(c => <option key={c} value={c}>{labelMod(c)}</option>)}
            </select>
          </div>

          {/* 3c. Editor — nama editor SEBENAR yang log masuk semasa Terbit (2026-07-29). Kosong
              untuk kandungan sedia ada sebelum ciri ni wujud (papar "Tidak diketahui", bukan reka
              nama) — sebab tu editorNameOptions tak sumbang opsyen kosong. */}
          <div>
            <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">EDITOR</label>
            <select
              value={draftFilters.editor}
              onChange={e => patchDraft({ editor: e.target.value })}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-semibold text-xs"
            >
              <option value="Semua">Semua Editor</option>
              {editorNameOptions.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {/* 4. Desk Filter — HANYA bidang berdaftar aktif secara lalai; kumpulan "Mansuh"
              berasingan (lihat nota deskOptions/orphanDeskOptions di atas) untuk cari kandungan
              lama yang masih guna bidang yang dah dimansuhkan. */}
          <div>
            <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">BIDANG</label>
            <select
              value={draftFilters.desk}
              onChange={e => patchDraft({ desk: e.target.value })}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-semibold text-xs"
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
            <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">SLOT</label>
            <select
              value={draftFilters.slot}
              onChange={e => patchDraft({ slot: e.target.value })}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-semibold text-xs"
            >
              <option value="SemuaKecualiTicker">Semua Slot (kecuali Ticker)</option>
              <option value="Semua">Semua Slot (termasuk Ticker)</option>
              {slotOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* 6. Susunan */}
          <div>
            <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">SUSUNAN</label>
            <select
              value={draftFilters.sort}
              onChange={e => patchDraft({ sort: e.target.value as FilterState['sort'] })}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-semibold text-xs"
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
            <button
              onClick={handleApplyFilters}
              className="flex-1 bg-[#802334] hover:bg-[#601824] text-white font-semibold px-3 py-1.5 rounded transition-colors text-[11px] relative"
            >
              Tapis
              {filtersDirty && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 border border-white" title="Ada penapis belum ditapis" />}
            </button>
            <button
              onClick={handleResetFilters}
              className="flex-1 bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold px-3 py-1.5 rounded transition-colors text-[11px]"
            >
              Set Semula
            </button>
          </div>
        </div>
      </div>

      {/* Editor View Switcher (Kandungan Saya vs Semua Read Only) — relevant once real EDITOR accounts exist */}
      {currentUserRole === 'EDITOR' && (
        <div className="flex bg-stone-100 p-1 rounded font-sans text-xs w-max border border-stone-200">
          <button
            onClick={() => setEditorViewMode('mine')}
            className={`px-4 py-1.5 rounded font-bold transition-all inline-flex items-center gap-1.5 ${
              editorViewMode === 'mine' ? 'bg-[#802334] text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Pin className="w-3.5 h-3.5" /> Kandungan Saya (Boleh Sunting & Siar)
          </button>
          <button
            onClick={() => setEditorViewMode('all')}
            className={`px-4 py-1.5 rounded font-bold transition-all inline-flex items-center gap-1.5 ${
              editorViewMode === 'all' ? 'bg-[#802334] text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> Semua Kandungan (Baca Sahaja)
          </button>
        </div>
      )}

      {/* Jujur tentang had semasa: "Kandungan Saya" perlukan pengecaman siapa cipta apa mengikut
          akaun sebenar — sistem log masuk berbilang editor belum dibina (lihat formatCreatedBy di
          atas), jadi tapisan ni tak dapat dikuatkuasakan lagi. Papar penjelasan terus dan bukan
          senyap tunjuk 0 keputusan, yang lebih mengelirukan. */}
      {currentUserRole === 'EDITOR' && editorViewMode === 'mine' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs font-sans px-4 py-3 rounded flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Ciri "Kandungan Saya" memerlukan sistem log masuk berbilang editor yang belum dibina --
            sistem semasa tak dapat kenal pasti kandungan mana milik akaun anda secara individu.
            Buat masa ini, semua kandungan dipaparkan di bawah tab "Semua Kandungan".
          </span>
        </div>
      )}

      {/* Filtering Results Summary — julat halaman semasa (cth "1–100"), bukan sekadar jumlah
          keputusan tapisan, supaya editor tahu tepat baris mana sedang dipaparkan. */}
      <div className="flex justify-between items-center font-sans text-xs text-stone-500 px-1">
        <div>
          {sortedRecords.length === 0 ? (
            <>Menampilkan <strong className="font-mono font-bold">0</strong> daripada <span className="font-mono font-semibold">{items.length}</span> jumlah kandungan</>
          ) : (
            <>
              Menampilkan <strong className="font-mono font-bold">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sortedRecords.length)}</strong> daripada <strong className="font-mono font-bold">{sortedRecords.length}</strong> keputusan tapisan (<span className="font-mono font-semibold">{items.length}</span> jumlah kandungan)
            </>
          )}
        </div>
      </div>

      {/* Content List Table */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-lg border border-stone-200 font-sans text-xs text-stone-500">
          ⏳ Memuatkan meja kerja kandungan...
        </div>
      ) : sortedRecords.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-lg border border-stone-200 font-serif text-stone-500 text-xs">
          Tiada kandungan yang sepadan dengan kriteria filter pilihan anda.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs min-w-[850px] table-fixed">
            <thead>
              <tr className="bg-stone-100 border-b border-stone-200 font-sans text-xs uppercase text-stone-600 font-semibold">
                <th className="p-2.5 w-16">ID</th>
                {/* Tajuk dikecilkan lagi + Editor (2026-07-29, permintaan pemilik projek) — Topik/
                    Kaedah/Jenis Kad dibuang terus daripada jadual (kekal di penapis + modal
                    perincian) supaya jadual tak lebar sampai sembunyikan lajur Tindakan. Tajuk
                    penuh (dipotong di sini) boleh dibaca melalui tooltip bila hover, sama corak
                    macam lajur ID. */}
                <th className="p-2.5 w-40">Tajuk Brief</th>
                <th className="p-2.5 w-20">Status</th>
                <th className="p-2.5 w-24">Bidang</th>
                <th className="p-2.5 w-28">Sumber</th>
                <th className="p-2.5 w-24">Editor</th>
                <th className="p-2.5 w-16">Slot</th>
                <th className="p-2.5 w-16">Tarikh</th>
                <th className="p-2.5 w-20 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-sans">
              {pagedRecords.map(rec => {
                // Same caveat as the Editor View Mode filter above: rec.creator !== currentUserName
                // is always true today (no real per-account authorship yet), so this always evaluates
                // to read-only for an Editor browsing "Semua Kandungan" — treated as an acceptable
                // conservative default (better to under-permit than let an Editor edit content that
                // might not be theirs) rather than something to "fix" until real ownership exists.
                const isReadOnly = currentUserRole === 'EDITOR' && editorViewMode === 'all' && rec.creator !== currentUserName;

                return (
                  <tr
                    key={rec.id}
                    onClick={() => {
                      setActiveItemModal(rec);
                      const matchedBidang = activeBidangList.find(b => b.name.toLowerCase() === rec.desk.toLowerCase());
                      setReactivateDesk(matchedBidang ? matchedBidang.name : '');
                      setReactivateTopik(rec.topik);
                      setReactivateSlotIndex(rec.slotIndex);
                    }}
                    className="hover:bg-stone-50 cursor-pointer transition-colors"
                  >
                    <Tooltip text={rec.id}>
                      <td className="p-2.5 font-sans text-xs text-stone-500 font-semibold truncate max-w-[100px]">
                        {rec.id}
                      </td>
                    </Tooltip>
                    <Tooltip text={rec.title}>
                      <td className="p-2.5">
                        <div className="font-serif font-medium text-stone-900 leading-snug truncate">
                          {rec.title}
                        </div>
                        <div className="font-serif text-[11px] text-stone-500 truncate">
                          {rec.summary}
                        </div>
                      </td>
                    </Tooltip>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        rec.status === 'Live' ? 'bg-emerald-100 text-emerald-800' :
                        rec.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                        'bg-stone-200 text-stone-700'
                      }`}>
                        {labelStatus(rec.status)}
                      </span>
                    </td>
                    <td
                      className="p-2.5 font-sans text-xs font-semibold"
                      // Warna terus daripada activeBidangList (dimuat hidup daripada
                      // CategoryRegistry) — bukan nilai tetap disalin ke sini, jadi tukar warna
                      // di Taksonomi automatik terpapar di sini juga tanpa kerja tambahan.
                      style={{ color: activeBidangList.find(b => b.name.toLowerCase() === rec.desk.toLowerCase())?.color || '#44403c' }}
                    >
                      {formatTitleCase(rec.desk)}
                    </td>
                    <td className="p-2.5 font-serif text-stone-800 text-xs truncate">{rec.source || '-'}</td>
                    <td className="p-2.5 font-sans text-[10px] text-stone-500 truncate">{rec.editorName || 'Tidak diketahui'}</td>
                    <td className="p-2.5 font-sans text-xs font-semibold text-stone-700">{rec.slot}</td>
                    <td className="p-2.5 font-sans text-stone-500 text-[10px] whitespace-nowrap">{rec.date}</td>
                    <td className="p-2.5 text-right font-sans text-xs whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {rec.slot !== 'Ticker' && !isReadOnly ? (
                        <select
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'Live' || val === 'Archive') {
                              handleUpdateStatus(rec.id, val as any);
                            } else if (val === 'Tolak') {
                              handleRejectToDraft(rec.id);
                            }
                            e.target.value = '';
                          }}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 rounded px-1.5 py-1 font-sans text-[10px] font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#802334] max-w-full"
                        >
                          <option value="" disabled hidden>Tindakan ▾</option>
                          {rec.status !== 'Live' && <option value="Live">Siar</option>}
                          <option value="Tolak">Tolak (kembali jadi draf)</option>
                          {rec.status !== 'Archive' && <option value="Archive">Arkib</option>}
                        </select>
                      ) : (
                        <span className="text-stone-400 text-[11px] font-sans">{rec.slot === 'Ticker' ? 'Ticker — urus di Modul Khas' : 'Baca Sahaja'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Kawalan pagination (2026-07-29, permintaan pemilik projek) — 100 rekod setiap
              paparan, lihat nota PAGE_SIZE/pagedRecords di atas. Papar hanya bila lebih 1
              halaman — satu halaman sahaja tak perlu sebarang kawalan. */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-stone-200 font-sans text-xs">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                ← Sebelum
              </button>
              <span className="text-stone-500">
                Halaman <strong className="font-mono font-bold text-stone-800">{currentPage}</strong> daripada <strong className="font-mono font-bold text-stone-800">{totalPages}</strong>
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Seterusnya →
              </button>
            </div>
          )}
        </div>
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
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden">
            <div className="flex-none flex justify-between items-start border-b border-stone-200 px-6 pt-6 pb-3">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-stone-500 font-bold block mb-1">
                  DETAIL KANDUNGAN • {activeItemModal.id}
                </span>
                <h3 className="font-serif text-xl font-bold text-stone-900">
                  {activeItemModal.title}
                </h3>
              </div>
              <button onClick={() => setActiveItemModal(null)} className="text-stone-400 hover:text-stone-800 font-bold text-lg shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold">Huraian Ringkas</span>
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
                <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold">Huraian Panjang</span>
                <div className="font-serif text-sm text-stone-700 leading-relaxed bg-stone-50 p-4 rounded border border-stone-200">
                  {activeItemModal.summaryLong}
                </div>
              </div>
            )}

            {activeItemModal.note.trim() && (
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold">Nota Editor</span>
                <div className="font-serif text-sm text-stone-700 leading-relaxed bg-amber-50 p-4 rounded border border-amber-200">
                  {activeItemModal.note}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs bg-stone-100 p-3 rounded border border-stone-200">
              <div><span className="text-stone-500 text-[9px] block">STATUS</span><strong className="text-stone-900">{labelStatus(activeItemModal.status)}</strong></div>
              <div><span className="text-stone-500 text-[9px] block">BIDANG</span><strong className="text-stone-900">{formatTitleCase(activeItemModal.desk)}</strong></div>
              <div><span className="text-stone-500 text-[9px] block">TOPIK</span><strong className="text-stone-900">{activeItemModal.topik ? formatTitleCase(activeItemModal.topik) : '-'}</strong></div>
              <div><span className="text-stone-500 text-[9px] block">JENIS KAD</span><strong className="text-stone-900">{activeItemModal.cardType === '-' ? '-' : <TierLabel tier={activeItemModal.cardType} />}</strong></div>
              <div><span className="text-stone-500 text-[9px] block">SLOT</span><strong className="text-stone-900">{activeItemModal.slot}</strong></div>
              <div><span className="text-stone-500 text-[9px] block">SUMBER</span><strong className="text-stone-900">{activeItemModal.source || '-'}</strong></div>
              <div><span className="text-stone-500 text-[9px] block">KAEDAH</span><strong className="text-stone-900">{labelMod(activeItemModal.creator) || '-'}</strong></div>
              <div><span className="text-stone-500 text-[9px] block">EDITOR</span><strong className="text-stone-900">{activeItemModal.editorName || 'Tidak diketahui'}</strong></div>
              <div><span className="text-stone-500 text-[9px] block">TARIKH SUMBER</span><strong className="text-stone-900">{activeItemModal.originalDate || '-'}</strong></div>
              <div className="col-span-2 md:col-span-3 min-w-0">
                <span className="text-stone-500 text-[9px] block">URL</span>
                {activeItemModal.url && activeItemModal.url !== '#' ? (
                  <a href={activeItemModal.url} target="_blank" rel="noopener noreferrer" className="text-[#802334] underline break-all font-semibold">{activeItemModal.url}</a>
                ) : (
                  <strong className="text-stone-900">-</strong>
                )}
              </div>
            </div>

            {activeItemModal.status === 'Archive' && activeItemModal.slot !== 'Ticker' && (
              <div className="space-y-3 font-sans bg-amber-50 border border-amber-200 rounded p-4">
                <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                  Siar Semula — Bidang kandungan ni tak lagi sepadan slot asal. Pilih Bidang dan slot sasaran (Bidang boleh diubah supaya sepadan slot lain).
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">Bidang</label>
                    <select
                      value={reactivateDesk}
                      onChange={e => { setReactivateDesk(e.target.value); setReactivateSlotIndex(''); }}
                      className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 text-xs"
                    >
                      <option value="">— Pilih Bidang —</option>
                      {activeBidangList.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">Topik</label>
                    <input
                      type="text"
                      value={reactivateTopik}
                      onChange={e => setReactivateTopik(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">Slot Sasaran (Bidang sepadan sahaja)</label>
                  <select
                    value={reactivateSlotIndex}
                    onChange={e => setReactivateSlotIndex(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 text-xs"
                    disabled={!reactivateDesk}
                  >
                    <option value="">— Pilih Slot —</option>
                    {allSlots
                      .filter(s => s.manualDesk.toLowerCase() === reactivateDesk.toLowerCase())
                      .map(s => <option key={s.slotIndex} value={s.slotIndex}>Slot {s.slotIndex + 1}</option>)}
                  </select>
                  {reactivateDesk && allSlots.filter(s => s.manualDesk.toLowerCase() === reactivateDesk.toLowerCase()).length === 0 && (
                    <p className="text-[9px] text-amber-700 mt-1">Tiada slot ditetapkan untuk Bidang ni lagi — tetapkan dulu di Tetapan &gt; Taksonomi.</p>
                  )}
                </div>
                <button
                  onClick={handleReactivate}
                  disabled={reactivating || !reactivateDesk || !reactivateTopik.trim() || reactivateSlotIndex === ''}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-md font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {reactivating ? 'Menyiarkan...' : 'Siarkan Semula'}
                </button>
              </div>
            )}
            </div>

            <div className="flex-none flex justify-between items-center border-t border-stone-200 px-6 py-4 font-mono text-xs">
              <span className="text-stone-500">Tarikh: <strong>{activeItemModal.date}</strong></span>
              {activeItemModal.slot !== 'Ticker' ? (
                <div className="flex gap-2">
                  {activeItemModal.status !== 'Live' && activeItemModal.status !== 'Archive' && (
                    <button
                      onClick={() => handleUpdateStatus(activeItemModal.id, 'Live')}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-md font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Siar Brief
                    </button>
                  )}
                  <button
                    onClick={() => handleRejectToDraft(activeItemModal.id)}
                    className="bg-[#c00000] hover:bg-red-800 text-white px-4 py-2 rounded-md font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Tolak (kembali jadi draf)
                  </button>
                  <button
                    onClick={() => setActiveItemModal(null)}
                    className="bg-stone-800 hover:bg-stone-900 text-white px-4 py-2 rounded-md font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveItemModal(null)}
                  className="bg-stone-800 hover:bg-stone-900 text-white px-4 py-2 rounded-md font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndeksConsole;
