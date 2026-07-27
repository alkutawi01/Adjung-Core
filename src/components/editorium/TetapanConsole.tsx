import React, { useState, useEffect } from 'react';
import {
  Lock, Settings, Construction, Zap, Newspaper, X, AlertTriangle, Save, RefreshCw, Check, Hourglass, Globe, Pencil, ChevronDown, ChevronUp, Upload
} from 'lucide-react';
import { EditorialIntelligencePlatform } from './EditorialIntelligencePlatform';
import { BidangIcon, BIDANG_ICON_MAP, BIDANG_ICON_NAMES } from '../common/BidangIcon';

// Bidang kini senarai tertutup kurasi Ketua Editor, disimpan di CategoryRegistry (jadual DB
// sebenar, bukan lagi dikira semula dari kandungan hidup) — lihat GET /api/system/categories/active.
interface ActiveBidang {
  id: string;
  slug: string;
  name: string;
  color: string;
  icon: string | null;
  /** Ikon SVG custom 13px bagi glif masthead. */
  iconSvg: string | null;
  /** Ada plat ilustrasi? Markup penuh TIDAK dihantar dalam senarai pukal — plat boleh ratusan
   *  kilobait. Diambil melalui GET /categories/illustration bila modal dibuka. */
  hasIllustration: boolean;
  usageCount: number;
  slots: number[];
}


interface TypographyTerm {
  id: string;
  term: string;
  style: string;
  status: string;
}

interface BlockedCategory {
  id: string;
  categoryName: string;
  enabled: boolean;
}

interface RbacMatrixRow {
  roleId: string;
  roleName: string;
  isImmutableAdmin: boolean;
  permissions: {
    viewAll: boolean;
    editOwn: boolean;
    editAll: boolean;
    publish: boolean;
    reject: boolean;
    assignSlot: boolean;
    manageSettings: boolean;
    manageRbac: boolean;
  };
}

const DEFAULT_RBAC_MATRIX: RbacMatrixRow[] = [
  {
    roleId: 'ketua_editor',
    roleName: 'Ketua Editor',
    isImmutableAdmin: true,
    permissions: {
      viewAll: true, editOwn: true, editAll: true, publish: true,
      reject: true, assignSlot: true, manageSettings: true, manageRbac: true
    }
  },
  {
    roleId: 'editor',
    roleName: 'Editor',
    isImmutableAdmin: false,
    permissions: {
      viewAll: true, editOwn: true, editAll: false, publish: true,
      reject: false, assignSlot: false, manageSettings: false, manageRbac: false
    }
  }
];

interface TetapanConsoleProps {
  currentUserRole?: 'KETUA_EDITOR' | 'EDITOR';
}

export const TetapanConsole: React.FC<TetapanConsoleProps> = ({
  currentUserRole = 'KETUA_EDITOR'
}) => {
  const [subTab, setSubTab] = useState<'PolisiKandungan' | 'Operasi' | 'Taksonomi' | 'Komponen' | 'RBAC'>('PolisiKandungan');

  // Interactive Configuration Drawer Modal State
  const [activeConfigModal, setActiveConfigModal] = useState<'italic' | 'add_desk' | null>(null);

  // Senarai Istilah Autocondong — backed by the same adjung_typography_rules table the main
  // frontpage settings drawer uses (core/routes/slotRoutes.js), not a separate local list. That
  // fuller drawer (Tetapan Slot) exposes scope/bahasa/keutamaan/exclude-terms + status toggle;
  // modal ni sengaja kekal ringkas (tambah/buang sahaja) untuk akses pantas, tapi papar status
  // (aktif/belum aktif) supaya tak sorok status yang diset di panel satu lagi.
  const [italicTerms, setItalicTerms] = useState<TypographyTerm[]>([]);
  const [loadingItalicTerms, setLoadingItalicTerms] = useState(false);
  const [newTermInput, setNewTermInput] = useState('');

  const fetchItalicTerms = async () => {
    setLoadingItalicTerms(true);
    try {
      const res = await fetch('/api/system/adjung-typography-rules');
      if (res.ok) {
        const rules = await res.json();
        setItalicTerms(
          (rules || [])
            .filter((r: any) => r.style === 'italic')
            .map((r: any) => ({ id: r.id, term: r.term, style: r.style, status: r.status || 'active' }))
        );
      }
    } catch (e) {
      console.error('Error fetching italic terms:', e);
    } finally {
      setLoadingItalicTerms(false);
    }
  };

  const handleAddItalicTerm = async () => {
    const term = newTermInput.trim().toLowerCase();
    if (!term || italicTerms.some(t => t.term === term)) return;
    try {
      const res = await fetch('/api/system/adjung-typography-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, style: 'italic', category: 'foreign_term' })
      });
      if (res.ok) {
        setNewTermInput('');
        fetchItalicTerms();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.error || 'Gagal menambah istilah.');
      }
    } catch (e) {
      console.error('Add italic term error:', e);
      alert('Ralat menambah istilah.');
    }
  };

  const handleRemoveItalicTerm = async (id: string) => {
    try {
      const res = await fetch(`/api/system/adjung-typography-rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItalicTerms(prev => prev.filter(t => t.id !== id));
      }
    } catch (e) {
      console.error('Remove italic term error:', e);
    }
  };

  // Governance Jam Dunia (World Clock) — these were previously local-only state with no
  // backing DB columns at all (WorldClockStrip.tsx has read systemSettings.worldClockIntervalSec
  // / worldClockBgClickEnabled from day one, but nothing ever wrote them). Now backed by real
  // columns on system_settings.
  const [worldClockIntervalSec, setWorldClockIntervalSec] = useState<number>(60);
  const [worldClockBgClickEnabled, setWorldClockBgClickEnabled] = useState<boolean>(true);
  const [savingWorldClock, setSavingWorldClock] = useState(false);
  const [worldClockSaveError, setWorldClockSaveError] = useState<string | null>(null);

  const [apiHealthStatus, setApiHealthStatus] = useState<any>(null);
  const [isLoadingApiStatus, setIsLoadingApiStatus] = useState<boolean>(false);

  // Badge colour must follow the REAL status, not default to green -- this panel used to hardcode
  // a green "ONLINE" badge even before any check ran (and the Holiday API side never actually
  // pinged anything at all). "Belum Disemak" (not yet checked) is the honest default state.
  const apiStatusBadgeClass = (status: string | undefined): string => {
    if (!status) return 'bg-stone-200 text-stone-600';
    if (status.startsWith('ONLINE')) return 'bg-emerald-100 text-emerald-800';
    if (status === 'DEGRADED') return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  const fetchApiStatus = async () => {
    setIsLoadingApiStatus(true);
    try {
      const res = await fetch('/api/system/weather-status');
      if (res.ok) {
        const data = await res.json();
        setApiHealthStatus(data);
      }
    } catch (e) {
      console.error('Fetch API status error:', e);
    } finally {
      setIsLoadingApiStatus(false);
    }
  };

  // Saving system_settings is a full INSERT OR REPLACE server-side (server.js POST
  // /api/system/settings) — always fetch the current row and merge in just the field(s) being
  // changed here, or unrelated settings saved elsewhere (frontpage title, banners, etc.) get
  // silently wiped.
  const saveSystemSettingsPatch = async (patch: Record<string, any>) => {
    const current = await fetch('/api/db-state').then(r => r.json());
    const merged = { ...(current.systemSettings || {}), ...patch };
    const res = await fetch('/api/system/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Gagal menyimpan tetapan.');
    }
    return merged;
  };

  const handleSaveWorldClockSettings = async () => {
    setSavingWorldClock(true);
    setWorldClockSaveError(null);
    try {
      await saveSystemSettingsPatch({
        worldClockIntervalSec,
        worldClockBgClickEnabled
      });
    } catch (e: any) {
      setWorldClockSaveError(e.message || 'Gagal menyimpan tetapan Jam Dunia.');
    } finally {
      setSavingWorldClock(false);
    }
  };

  // Taksonomi Bidang — senarai tertutup, dari CategoryRegistry (GET /categories/active).
  const [desks, setDesks] = useState<ActiveBidang[]>([]);
  const [desksLoading, setDesksLoading] = useState(true);
  const [expandedBidangId, setExpandedBidangId] = useState<string | null>(null);
  const [renamingBidangId, setRenamingBidangId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingSlotForBidang, setSavingSlotForBidang] = useState<number | null>(null);

  const fetchActiveBidang = () => {
    setDesksLoading(true);
    fetch('/api/system/categories/active')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDesks(data);
      })
      .catch(e => console.error('Error fetching active Bidang:', e))
      .finally(() => setDesksLoading(false));
  };

  // ---------------------------------------------------------------------------------------------
  // PERUNTUKAN SLOT — dipentaskan, bukan serta-merta.
  //
  // Sebelum ini setiap klik pada nombor slot terus memanggil assign-slot, dan kerana menukar Bidang
  // sesuatu slot memanggil archiveLiveContentInSlot(), SATU klik tersilap mengarkibkan kesemua
  // kandungan approved/pending dalam slot itu — sehingga 10 kandungan — tanpa pengesahan, tanpa
  // amaran, dan tanpa jalan pulang dalam UI.
  //
  // Sekarang: klik cuma mengubah pilihan tempatan. Tiada apa disimpan sehingga "Sahkan Perubahan"
  // ditekan, dan pengesahan itu menyenaraikan setiap slot yang terjejas dengan bilangan kandungan
  // sebenar yang akan diarkibkan.
  // ---------------------------------------------------------------------------------------------
  const [slotUsage, setSlotUsage] = useState<{ slotIndex: number; bidang: string; liveCount: number }[]>([]);
  const [pendingSlots, setPendingSlots] = useState<number[] | null>(null);
  const [slotBlockedMsg, setSlotBlockedMsg] = useState<string | null>(null);
  const [slotConfirmOpen, setSlotConfirmOpen] = useState(false);
  const [applyingSlots, setApplyingSlots] = useState(false);

  const fetchSlotUsage = () => {
    fetch('/api/system/categories/slot-usage')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setSlotUsage(data); })
      .catch(e => console.error('Error fetching slot usage:', e));
  };

  const usageFor = (slotIndex: number) => slotUsage.find(u => u.slotIndex === slotIndex);

  // Buka/tutup panel slot bagi satu Bidang. Membuka memulakan pilihan dipentaskan daripada keadaan
  // sebenar; menutup membuangnya, supaya pilihan yang tidak disahkan tidak pernah terbawa.
  const toggleSlotPanel = (d: ActiveBidang) => {
    if (expandedBidangId === d.id) {
      setExpandedBidangId(null);
      setPendingSlots(null);
    } else {
      setExpandedBidangId(d.id);
      setPendingSlots([...d.slots]);
      fetchSlotUsage();
    }
    setSlotBlockedMsg(null);
    setSlotConfirmOpen(false);
  };

  const toggleSlot = (slotIndex: number, d: ActiveBidang) => {
    setSlotBlockedMsg(null);
    const owner = (usageFor(slotIndex)?.bidang || '').trim();
    const milikBidangIni = owner.toLowerCase() === d.name.toLowerCase();

    // Slot milik Bidang lain tidak boleh dirampas dari sini. Buang dari Bidang itu dahulu — supaya
    // pemiliknya sedar slotnya hilang, dan bukan ia lenyap tanpa dia tahu.
    if (owner && !milikBidangIni) {
      setSlotBlockedMsg(`Slot ${slotIndex + 1} milik Bidang "${owner}". Buang slot itu daripada "${owner}" dahulu sebelum memberikannya kepada "${d.name}".`);
      return;
    }

    setPendingSlots(prev => {
      const cur = prev || [];
      return cur.includes(slotIndex) ? cur.filter(s => s !== slotIndex) : [...cur, slotIndex].sort((a, b) => a - b);
    });
  };

  // Apa yang benar-benar akan berubah, dan berapa kandungan yang akan diarkibkan.
  // archiveLiveContentInSlot() berjalan setiap kali Bidang slot BERUBAH — jadi menambah DAN
  // membuang sama-sama mengarkibkan kandungan slot itu. Kedua-duanya disenaraikan.
  const slotDiff = (d: ActiveBidang) => {
    const pending = pendingSlots || [];
    const tambah = pending.filter(s => !d.slots.includes(s));
    const buang = d.slots.filter(s => !pending.includes(s));
    const kiraArkib = (list: number[]) => list.reduce((n, s) => n + (usageFor(s)?.liveCount || 0), 0);
    return { tambah, buang, adaPerubahan: tambah.length > 0 || buang.length > 0, jumlahArkib: kiraArkib(tambah) + kiraArkib(buang) };
  };

  const applySlotChanges = async (d: ActiveBidang) => {
    const { tambah, buang } = slotDiff(d);
    setApplyingSlots(true);
    try {
      // Berturutan, bukan serentak: setiap panggilan menulis slots_config dan mengarkibkan
      // kandungan. Menjalankannya serentak bermakna satu kegagalan meninggalkan keadaan separuh
      // siap yang sukar dibaca.
      for (const s of buang) await postAssignSlot(s, '');
      for (const s of tambah) await postAssignSlot(s, d.name);
      setSlotConfirmOpen(false);
      setExpandedBidangId(null);
      setPendingSlots(null);
      fetchActiveBidang();
      fetchSlotUsage();
    } catch (e: any) {
      alert('Ralat: ' + (e.message || ''));
      fetchActiveBidang();
      fetchSlotUsage();
    } finally {
      setApplyingSlots(false);
    }
  };

  const postAssignSlot = async (slotIndex: number, bidangName: string) => {
    const res = await fetch('/api/system/categories/assign-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotIndex, bidangName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Gagal menetapkan slot ${slotIndex + 1}.`);
  };

  // Pemilih Ikon Bidang — klik badge ikon di Taksonomi buka modal ni (grid lucide + muat naik SVG).
  const [iconPickerBidangId, setIconPickerBidangId] = useState<string | null>(null);
  const [savingIconFor, setSavingIconFor] = useState<string | null>(null);
  const [svgUploadPreview, setSvgUploadPreview] = useState<string | null>(null);
  const [svgUploadError, setSvgUploadError] = useState<string | null>(null);
  const [uploadingSvg, setUploadingSvg] = useState(false);

  // Plat ilustrasi Bidang — SVG besar untuk kolum kanan Focus View. Berasingan daripada ikon di
  // atas: ikon 13px di jalur masthead, plat ~240px di permukaan bacaan. Spec dikuatkuasakan di
  // server (core/routes/categoryRoutes.js): viewBox 0 0 256 256, currentColor sahaja, had 256KB.
  const [illusPreview, setIllusPreview] = useState<string | null>(null);
  /** Markup plat SEMASA bagi Bidang yang modalnya terbuka, diambil atas permintaan. */
  const [illusCurrent, setIllusCurrent] = useState<string | null>(null);
  const [illusError, setIllusError] = useState<string | null>(null);
  const [uploadingIllus, setUploadingIllus] = useState(false);

  // Markup plat diambil HANYA bila modal dibuka — ia tidak lagi dibawa dalam senarai Bidang, kerana
  // satu plat boleh ratusan kilobait dan senarai itu dimuat oleh frontpage awam juga.
  const openIconPicker = (d: ActiveBidang) => {
    setIconPickerBidangId(d.id);
    setIllusCurrent(null);
    setIllusPreview(null);
    setIllusError(null);
    if (d.hasIllustration) {
      fetch('/api/system/categories/illustration?name=' + encodeURIComponent(d.name))
        .then(res => res.json())
        .then(data => setIllusCurrent(data?.illustrationSvg || null))
        .catch(e => console.error('Error fetching illustration:', e));
    }
  };

  const closeIconPicker = () => {
    setIconPickerBidangId(null);
    setSvgUploadPreview(null);
    setSvgUploadError(null);
    setIllusPreview(null);
    setIllusCurrent(null);
    setIllusError(null);
  };

  const handleIllusFileSelected = (file: File | null) => {
    setIllusError(null);
    setIllusPreview(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.svg')) {
      setIllusError('Pilih fail .svg sahaja.');
      return;
    }
    if (file.size > 256 * 1024) {
      setIllusError('Fail terlalu besar (had 256KB untuk plat ilustrasi).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setIllusPreview(String(reader.result || ''));
    reader.onerror = () => setIllusError('Gagal membaca fail.');
    reader.readAsText(file);
  };

  const handleUploadIllustration = async (id: string) => {
    if (!illusPreview) return;
    setUploadingIllus(true);
    setIllusError(null);
    try {
      const res = await fetch('/api/system/categories/set-illustration-svg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, svg: illusPreview })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat naik plat ilustrasi.');
      setIllusCurrent(illusPreview);
      setIllusPreview(null);
      fetchActiveBidang();
    } catch (e: any) {
      setIllusError(e.message || 'Gagal memuat naik plat ilustrasi.');
    } finally {
      setUploadingIllus(false);
    }
  };

  const handleClearIllustration = async (id: string) => {
    setUploadingIllus(true);
    setIllusError(null);
    try {
      const res = await fetch('/api/system/categories/clear-illustration-svg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuang plat ilustrasi.');
      setIllusCurrent(null);
      setIllusPreview(null);
      fetchActiveBidang();
    } catch (e: any) {
      setIllusError(e.message || 'Gagal membuang plat ilustrasi.');
    } finally {
      setUploadingIllus(false);
    }
  };

  const handlePickLucideIcon = async (id: string, iconName: string) => {
    setSavingIconFor(id);
    try {
      const res = await fetch('/api/system/categories/set-icon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, icon: iconName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menetapkan ikon.');
      closeIconPicker();
      fetchActiveBidang();
    } catch (e: any) {
      alert('Ralat: ' + (e.message || ''));
    } finally {
      setSavingIconFor(null);
    }
  };

  const handleSvgFileSelected = (file: File | null) => {
    setSvgUploadError(null);
    setSvgUploadPreview(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
      setSvgUploadError('Pilih fail .svg sahaja.');
      return;
    }
    if (file.size > 100 * 1024) {
      setSvgUploadError('Fail terlalu besar (had 100KB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSvgUploadPreview(String(reader.result || ''));
    reader.onerror = () => setSvgUploadError('Gagal membaca fail.');
    reader.readAsText(file);
  };

  const handleUploadSvgIcon = async (id: string) => {
    if (!svgUploadPreview) return;
    setUploadingSvg(true);
    setSvgUploadError(null);
    try {
      const res = await fetch('/api/system/categories/set-icon-svg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, svg: svgUploadPreview })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat naik SVG.');
      closeIconPicker();
      fetchActiveBidang();
    } catch (e: any) {
      setSvgUploadError(e.message || 'Gagal memuat naik SVG.');
    } finally {
      setUploadingSvg(false);
    }
  };

  const handleRenameBidang = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      const res = await fetch('/api/system/categories/rename-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, newName: renameValue.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menamakan semula Bidang.');
      setRenamingBidangId(null);
      fetchActiveBidang();
    } catch (e: any) {
      alert('Ralat: ' + (e.message || ''));
    }
  };

  // Blocked RSS categories — real CRUD table (rss_blocked_categories), managed here AND in the
  // main frontpage's Ticker Management modal; both point at the same backend so they can never
  // drift out of sync with each other.
  const [blockedCategories, setBlockedCategories] = useState<BlockedCategory[]>([]);
  const [newBlockedCategoryInput, setNewBlockedCategoryInput] = useState('');

  const fetchBlockedCategories = async () => {
    try {
      const res = await fetch('/api/system/rss-blocked-categories');
      if (res.ok) {
        const rows = await res.json();
        setBlockedCategories((rows || []).map((r: any) => ({ id: r.id, categoryName: r.categoryName, enabled: r.enabled === 1 || r.enabled === true })));
      }
    } catch (e) {
      console.error('Fetch blocked categories error:', e);
    }
  };

  const handleAddBlockedCategory = async () => {
    const name = newBlockedCategoryInput.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/system/rss-blocked-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryName: name })
      });
      if (res.ok) {
        setNewBlockedCategoryInput('');
        fetchBlockedCategories();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.error || 'Gagal menambah kategori.');
      }
    } catch (e) {
      console.error('Add blocked category error:', e);
    }
  };

  const handleRemoveBlockedCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/system/rss-blocked-categories/${id}`, { method: 'DELETE' });
      if (res.ok) setBlockedCategories(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      console.error('Remove blocked category error:', e);
    }
  };

  useEffect(() => {
    fetchItalicTerms();
    fetchBlockedCategories();

    fetch('/api/db-state')
      .then(res => res.json())
      .then(data => {
        const s = data.systemSettings || {};
        if (s.worldClockIntervalSec !== undefined) setWorldClockIntervalSec(Number(s.worldClockIntervalSec));
        if (s.worldClockBgClickEnabled !== undefined) setWorldClockBgClickEnabled(!!s.worldClockBgClickEnabled);
        if (s.rolePermissions && Array.isArray(s.rolePermissions) && s.rolePermissions.length > 0) {
          setRbacMatrix(s.rolePermissions);
        }
      })
      .catch(e => console.error('Error fetching system settings:', e));

    fetchActiveBidang();
  }, []);

  // Modal Tambah Bidang — Nama + Warna sahaja (schema CategoryRegistry tiada "kod"/"label ticker").
  const [newDeskName, setNewDeskName] = useState('');
  const [newDeskColor, setNewDeskColor] = useState('#802334');
  const [addingDesk, setAddingDesk] = useState(false);

  // Interactive RBAC Permission Matrix State — backed by system_settings.rolePermissions.
  const [rbacMatrix, setRbacMatrix] = useState<RbacMatrixRow[]>(DEFAULT_RBAC_MATRIX);
  const [savingRbac, setSavingRbac] = useState(false);
  const [rbacSaveError, setRbacSaveError] = useState<string | null>(null);
  const [rbacDirty, setRbacDirty] = useState(false);

  const handleTogglePermission = (roleId: string, permKey: keyof RbacMatrixRow['permissions']) => {
    setRbacMatrix(prev =>
      prev.map(row => {
        if (row.roleId !== roleId) return row;
        // Safeguard: Ketua Editor cannot uncheck core self-admin power (kecuali memecat dirinya sendiri)
        if (row.isImmutableAdmin && (permKey === 'manageRbac' || permKey === 'manageSettings' || permKey === 'viewAll')) {
          alert('Ketua Editor tidak dibenarkan menarik semula kuasa tadbir urus utama daripada akaun sendiri.');
          return row;
        }
        return {
          ...row,
          permissions: {
            ...row.permissions,
            [permKey]: !row.permissions[permKey]
          }
        };
      })
    );
    setRbacDirty(true);
  };

  const handleSaveRbac = async () => {
    setSavingRbac(true);
    setRbacSaveError(null);
    try {
      await saveSystemSettingsPatch({ rolePermissions: rbacMatrix });
      setRbacDirty(false);
    } catch (e: any) {
      setRbacSaveError(e.message || 'Gagal menyimpan matriks RBAC.');
    } finally {
      setSavingRbac(false);
    }
  };

  const handleAddDesk = async () => {
    if (!newDeskName.trim()) return;
    setAddingDesk(true);
    try {
      const res = await fetch('/api/system/categories/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeskName.trim(), color: newDeskColor })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah Bidang.');
      setNewDeskName('');
      setNewDeskColor('#802334');
      setActiveConfigModal(null);
      fetchActiveBidang();
    } catch (e: any) {
      alert('Ralat: ' + (e.message || ''));
    } finally {
      setAddingDesk(false);
    }
  };

  if (currentUserRole !== 'KETUA_EDITOR') {
    return (
      <div className="bg-white p-12 text-center rounded-lg border border-stone-200 shadow-sm space-y-3 font-serif">
        <div className="flex justify-center"><Lock className="w-8 h-8" /></div>
        <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
          Akses Terhad (Khusus Ketua Editor)
        </h3>
        <p className="text-xs text-stone-600">
          Modul Tetapan dan Pusat Konfigurasi Polisi hanya boleh diakses oleh Ketua Editor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Submodule Navigation Bar */}
      <div className="flex flex-wrap justify-between items-center border-b border-stone-200 pb-3 text-xs gap-2">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setSubTab('PolisiKandungan')}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'PolisiKandungan' ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            1. Polisi Kandungan
          </button>

          <button
            onClick={() => setSubTab('Taksonomi')}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'Taksonomi' ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            2. Taksonomi (Desk)
          </button>

          <button
            onClick={() => setSubTab('Operasi')}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'Operasi' ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            3. Operasi & Governance
          </button>

          <button
            onClick={() => setSubTab('Komponen')}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'Komponen' ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            4. Adjung Editorial Intelligence Platform (AEIP)
          </button>

          <button
            onClick={() => setSubTab('RBAC')}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'RBAC' ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            5. RBAC
          </button>
        </div>
      </div>

      {/* 1. POLISI KANDUNGAN */}
      {subTab === 'PolisiKandungan' && (
        <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
          <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
            Polisi Teks & Format Global
          </h3>
          <div className="space-y-4 divide-y divide-stone-100">
            <div className="pt-3 flex flex-wrap justify-between items-center gap-3">
              <div className="space-y-1">
                <label className="flex items-center gap-2 font-semibold text-stone-900 cursor-pointer">
                  <input type="checkbox" checked readOnly className="rounded border-stone-300 text-[#802334]" />
                  <span>Autocondong Istilah Asing & Pinjaman</span>
                </label>
                <p className="text-stone-500 text-xs">
                  Memformat secara automatik perkataan asing yang tersenarai dalam Senarai Istilah Autocondong.
                </p>
              </div>
              <button
                onClick={() => setActiveConfigModal('italic')}
                className="w-64 flex items-center justify-center gap-1.5 bg-stone-800 hover:bg-stone-900 text-[#E9D8A6] font-sans text-xs px-3 py-1.5 rounded font-semibold transition-colors"
              >
                <Settings className="w-3.5 h-3.5" /> Senarai Istilah Autocondong ({italicTerms.filter(t => t.status === 'active').length} Aktif)
              </button>
            </div>

            <div className="pt-4 flex flex-wrap justify-between items-center gap-3">
              <div className="space-y-1">
                <label className="flex items-center gap-2 font-semibold text-stone-400 cursor-not-allowed">
                  <input type="checkbox" disabled className="rounded border-stone-300" />
                  <span>Interlinear Gloss (Teks Dwibahasa / Arab-Melayu)</span>
                </label>
                <p className="text-stone-400 text-xs">
                  Paparan baris selari glosarium bagi istilah dwibahasa dan teks klasik.
                </p>
              </div>
              <span className="w-64 flex items-center justify-center gap-1.5 bg-stone-100 text-stone-400 font-sans text-xs px-3 py-1.5 rounded font-semibold border border-stone-200">
                <Construction className="w-3.5 h-3.5" /> Belum Dibina
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. TAKSONOMI (BIDANG — SENARAI TERTUTUP) */}
      {subTab === 'Taksonomi' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Taksonomi Bidang (Senarai Tertutup)
                </h3>
                <p className="text-stone-500 text-xs">
                  Senarai Bidang yang boleh dipilih untuk setiap slot (selain Ticker dan tier Bar) — dikurasi Ketua Editor sahaja. Menukar Bidang sesuatu slot akan mengarkibkan kandungan live sedia ada dalam slot tu.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-sans text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded font-semibold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> {desks.length} Bidang Aktif
                </span>
                <button
                  onClick={() => setActiveConfigModal('add_desk')}
                  className="bg-[#802334] hover:bg-[#601824] text-white px-3 py-1.5 rounded font-semibold text-xs"
                >
                  + Tambah Bidang
                </button>
              </div>
            </div>

            {desksLoading ? (
              <div className="text-stone-400 text-xs py-6 text-center">Memuatkan Taksonomi...</div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-200 font-sans text-xs uppercase text-stone-600 font-semibold">
                    <th className="p-3">Ikon</th>
                    <th className="p-3">Warna</th>
                    <th className="p-3">Nama Bidang</th>
                    <th className="p-3">Nombor Slot Diperuntukkan</th>
                    <th className="p-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {desks.map(d => (
                    <React.Fragment key={d.id}>
                      <tr className="hover:bg-stone-50">
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => openIconPicker(d)}
                            className="hover:ring-2 hover:ring-offset-1 hover:ring-stone-300 rounded-full transition-shadow relative"
                            title="Tukar ikon dan plat ilustrasi"
                          >
                            <BidangIcon iconName={d.icon} iconSvg={d.iconSvg} color={d.color} />
                            {/* Titik marun kecil: tanda Bidang ini sudah ada plat ilustrasi. Tanpa
                                ini tiada cara melihat Bidang mana yang sudah siap tanpa membuka
                                setiap satu modal. */}
                            {d.hasIllustration && (
                              <span
                                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#802334] border border-white"
                                title="Ada plat ilustrasi"
                              />
                            )}
                          </button>
                        </td>
                        <td className="p-3">
                          <span className="inline-block w-4 h-4 rounded-full border border-stone-300 shadow-xs" style={{ backgroundColor: d.color }}></span>
                        </td>
                        <td className="p-3 font-semibold text-stone-900">
                          {renamingBidangId === d.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                className="bg-stone-50 border border-stone-300 rounded px-2 py-1 text-xs font-semibold"
                                autoFocus
                              />
                              <button onClick={() => handleRenameBidang(d.id)} className="text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setRenamingBidangId(null)} className="text-stone-400"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          ) : d.name}
                        </td>
                        <td className="p-3 text-stone-600 font-sans text-[11px]">
                          {d.slots.length === 0 ? (
                            <span className="text-stone-400">Tiada slot</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {d.slots.map(s => (
                                <span key={s} className="bg-stone-100 text-stone-600 border border-stone-200 rounded px-1.5 py-0.5 font-mono text-[9px]">{s + 1}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => { setRenamingBidangId(d.id); setRenameValue(d.name); }}
                              className="text-stone-500 hover:text-[#802334]"
                              title="Tukar Nama"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleSlotPanel(d)}
                              className="text-stone-500 hover:text-[#802334] inline-flex items-center gap-1"
                            >
                              Urus Slot {expandedBidangId === d.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedBidangId === d.id && (() => {
                        const pending = pendingSlots || [];
                        const { tambah, buang, adaPerubahan, jumlahArkib } = slotDiff(d);
                        return (
                        <tr>
                          <td colSpan={5} className="p-4 bg-stone-50">
                            <div className="text-[9px] uppercase font-bold text-stone-500 mb-1">
                              Tanda slot untuk peruntukkan Bidang "{d.name}"
                            </div>
                            <p className="text-[10px] text-stone-500 mb-2">
                              Tiada apa disimpan sehingga anda tekan <strong className="font-semibold">Sahkan Perubahan</strong>.
                            </p>

                            {/* Petunjuk — tanpa ini slot milik Bidang lain nampak sama seperti slot kosong. */}
                            <div className="flex flex-wrap items-center gap-3 mb-2 text-[10px] text-stone-500">
                              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-xs bg-[#802334] border border-[#802334]" /> Bidang ini</span>
                              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-xs bg-white border border-stone-300" /> Kosong</span>
                              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-xs bg-stone-200 border border-stone-400" /> Milik Bidang lain</span>
                              <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-600" /> Ada kandungan live</span>
                            </div>

                            <div className="grid grid-cols-6 md:grid-cols-10 gap-2">
                              {Array.from({ length: 38 }, (_, i) => i).map(slotIndex => {
                                const u = usageFor(slotIndex);
                                const owner = (u?.bidang || '').trim();
                                const milikBidangIni = owner.toLowerCase() === d.name.toLowerCase();
                                const milikOrangLain = !!owner && !milikBidangIni;
                                const dipilih = pending.includes(slotIndex);
                                const live = u?.liveCount || 0;

                                const gaya = dipilih
                                  ? 'bg-[#802334] text-white border-[#802334]'
                                  : milikOrangLain
                                    ? 'bg-stone-200 text-stone-500 border-stone-400 cursor-not-allowed'
                                    : 'bg-white text-stone-600 border-stone-300 hover:border-[#802334]';

                                return (
                                  <button
                                    key={slotIndex}
                                    type="button"
                                    onClick={() => toggleSlot(slotIndex, d)}
                                    title={milikOrangLain
                                      ? `Milik Bidang "${owner}"${live ? ` — ${live} kandungan live` : ''}`
                                      : live ? `${live} kandungan live dalam slot ini` : 'Slot kosong'}
                                    className={`relative flex items-center justify-center border rounded px-1.5 py-1 text-[10px] font-mono transition-colors ${gaya}`}
                                  >
                                    {slotIndex + 1}
                                    {live > 0 && (
                                      <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold border ${dipilih ? 'bg-white text-[#802334] border-[#802334]' : 'bg-amber-100 text-amber-800 border-amber-400'}`}>
                                        {live}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {slotBlockedMsg && (
                              <p className="mt-2 text-[10px] text-amber-800 bg-amber-50 border border-amber-300 rounded px-2 py-1.5 flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {slotBlockedMsg}
                              </p>
                            )}

                            {/* Ringkasan + pengesahan. Butang hanya hidup apabila ada perubahan sebenar. */}
                            <div className="mt-3 pt-3 border-t border-stone-200 flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                disabled={!adaPerubahan || applyingSlots}
                                onClick={() => setSlotConfirmOpen(true)}
                                className="bg-[#802334] text-white px-3 py-1.5 rounded font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Sahkan Perubahan
                              </button>
                              <button
                                type="button"
                                disabled={!adaPerubahan || applyingSlots}
                                onClick={() => { setPendingSlots([...d.slots]); setSlotBlockedMsg(null); setSlotConfirmOpen(false); }}
                                className="bg-stone-200 text-stone-700 px-3 py-1.5 rounded font-semibold text-xs disabled:opacity-40"
                              >
                                Set Semula
                              </button>
                              <span className="text-[10px] text-stone-500">
                                {adaPerubahan
                                  ? `${tambah.length} ditambah, ${buang.length} dibuang`
                                  : 'Tiada perubahan'}
                              </span>
                            </div>

                            {slotConfirmOpen && adaPerubahan && (
                              <div className="mt-3 border border-amber-400 bg-amber-50 rounded p-3 space-y-2">
                                <p className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                                  <AlertTriangle className="w-4 h-4" /> Sahkan perubahan slot untuk "{d.name}"
                                </p>

                                {tambah.length > 0 && (
                                  <div className="text-[10px] text-stone-700">
                                    <span className="font-semibold">Diberikan kepada "{d.name}":</span>{' '}
                                    {tambah.map(s => `Slot ${s + 1}${usageFor(s)?.liveCount ? ` (${usageFor(s)?.liveCount} kandungan)` : ''}`).join(', ')}
                                  </div>
                                )}

                                {buang.length > 0 && (
                                  <div className="text-[10px] text-stone-700">
                                    <span className="font-semibold">Dikosongkan (slot jadi tiada Bidang):</span>{' '}
                                    {buang.map(s => `Slot ${s + 1}${usageFor(s)?.liveCount ? ` (${usageFor(s)?.liveCount} kandungan)` : ''}`).join(', ')}
                                  </div>
                                )}

                                <p className="text-[10px] text-amber-900 leading-relaxed border-t border-amber-300 pt-2">
                                  {jumlahArkib > 0 ? (
                                    <>
                                      <strong className="font-bold">{jumlahArkib} kandungan akan diarkibkan</strong> dan hilang daripada frontpage.
                                      Setiap slot yang bertukar Bidang akan dikosongkan — kandungan approved dan pending di dalamnya
                                      ditukar kepada status <em>archived</em>. Ia tidak dipadam, tetapi tidak lagi terpapar.
                                    </>
                                  ) : (
                                    <>Tiada kandungan live dalam slot yang terjejas — tiada apa akan diarkibkan.</>
                                  )}
                                </p>

                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    disabled={applyingSlots}
                                    onClick={() => applySlotChanges(d)}
                                    className="bg-[#802334] text-white px-3 py-1.5 rounded font-semibold text-xs disabled:opacity-50"
                                  >
                                    {applyingSlots ? 'Menyimpan...' : (jumlahArkib > 0 ? `Teruskan dan arkibkan ${jumlahArkib} kandungan` : 'Teruskan')}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={applyingSlots}
                                    onClick={() => setSlotConfirmOpen(false)}
                                    className="bg-white border border-stone-300 text-stone-700 px-3 py-1.5 rounded font-semibold text-xs disabled:opacity-50"
                                  >
                                    Batal
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                        );
                      })()}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 3. OPERASI & GOVERNANCE */}
      {subTab === 'Operasi' && (
        <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-6 text-xs">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-900">
            <Newspaper className="inline w-3.5 h-3.5 -mt-0.5 mr-1" /> Tetapan RSS &amp; penapisan Ticker (had berita live, kata kunci diharamkan, ambang skor) diuruskan di <strong>Frontpage → Urus Ticker</strong>, bukan di sini — supaya tiada dua tempat berasingan yang boleh terkeluar segerak antara satu sama lain.
          </div>

          {/* Kategori RSS Tersekat — shared with the Frontpage Ticker Management modal */}
          <div className="space-y-3">
            <div>
              <h4 className="font-sans text-xs uppercase tracking-wider text-stone-700 font-bold mb-0.5">
                Kategori RSS Tersekat
              </h4>
              <p className="text-stone-500 text-[11px]">
                Kategori mentah RSS yang disenaraikan di sini turut terpakai di modal Urus Ticker Frontpage — satu senarai kongsi.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {blockedCategories.map(c => (
                <span key={c.id} className="bg-stone-100 border border-stone-300 text-stone-800 px-2.5 py-1 rounded text-xs flex items-center gap-1.5">
                  <span>{c.categoryName}</span>
                  <button onClick={() => handleRemoveBlockedCategory(c.id)} className="text-stone-400 hover:text-red-700 font-bold"><X className="w-3 h-3" /></button>
                </span>
              ))}
              {blockedCategories.length === 0 && <span className="text-stone-400 italic">Tiada kategori disekat lagi.</span>}
            </div>
            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                placeholder="Cth: Hiburan, Gosip..."
                value={newBlockedCategoryInput}
                onChange={e => setNewBlockedCategoryInput(e.target.value)}
                className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs flex-1"
              />
              <button onClick={handleAddBlockedCategory} className="bg-[#802334] text-white px-3 py-1.5 rounded font-semibold text-xs">+ Tambah</button>
            </div>
          </div>

          {/* Had Geometri Aksara Mengikut 8 Tier — this used to be a hand-typed duplicate of
              core/editorial/GeometryConfig.js and had already drifted stale (BAR showed the old
              ratio 0.850 after GeometryConfig.js was corrected to 0). Removed in favour of the
              live chart on the Perlembagaan tab, which reads the same module directly so it can
              never drift again. */}
          <div className="pt-4 border-t border-stone-100">
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-sans text-xs uppercase tracking-wider text-stone-700 font-bold mb-0.5">
                  Nisbah Geometri & Belanjawan Aksara Spatial
                </h4>
                <p className="text-stone-500 text-[11px]">
                  Carta penuh (live, terus dari <code className="bg-stone-100 text-[#802334] px-1 py-0.5 rounded font-mono text-[10px]">core/editorial/GeometryConfig.js</code>) kini di tab <strong>Perlembagaan</strong> supaya tak pernah lapuk.
                </p>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#802334] font-bold whitespace-nowrap">
                → Perlembagaan
              </span>
            </div>
          </div>

          {/* Tetapan Jam Dunia & Cuaca */}
          <div className="pt-6 border-t border-stone-200 space-y-4">
            <div>
              <h4 className="font-sans text-xs uppercase tracking-wider text-[#802334] font-bold mb-0.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> TETAPAN JAM DUNIA, CUACA & API GOVERNANCE (15 BANDAR IBU NEGERI)
              </h4>
              <p className="text-stone-500 text-[11px]">
                Kawalan masa pertukaran slaid Jam Dunia, suis pemicu klik latar belakang, dan status kesihatan API Cuaca & Kalendar Cuti.
              </p>
            </div>

            {worldClockSaveError && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-3 py-2 rounded flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {worldClockSaveError}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-2">
                <label className="font-sans text-xs uppercase tracking-wider text-stone-700 font-bold block">
                  Selang Masa Auto-Slaid Jam Dunia
                </label>
                <select
                  value={worldClockIntervalSec}
                  onChange={(e) => setWorldClockIntervalSec(Number(e.target.value))}
                  className="w-full bg-white border border-stone-300 rounded px-3 py-1.5 font-sans text-xs font-semibold focus:outline-none focus:border-[#802334]"
                >
                  <option value={30}>30 Saat</option>
                  <option value={60}>60 Saat / 1 Minit</option>
                  <option value={120}>120 Saat / 2 Minit</option>
                  <option value={300}>300 Saat / 5 Minit</option>
                  <option value={0}>Matikan Auto-Slaid</option>
                </select>
                <span className="text-[10px] text-stone-400 block">
                  Paparan Jam Dunia akan bertukar set (Set 1 ➔ Set 2 ➔ Set 3) secara automatik mengikut masa ini.
                </span>
              </div>

              <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-2">
                <label className="font-sans text-xs uppercase tracking-wider text-stone-700 font-bold block">
                  Pemicu Pertukaran Klik Latar Belakang
                </label>
                <select
                  value={worldClockBgClickEnabled ? '1' : '0'}
                  onChange={(e) => setWorldClockBgClickEnabled(e.target.value === '1')}
                  className="w-full bg-white border border-stone-300 rounded px-3 py-1.5 font-sans text-xs font-semibold focus:outline-none focus:border-[#802334]"
                >
                  <option value="1">Aktif</option>
                  <option value="0">Tidak Aktif</option>
                </select>
                <span className="text-[10px] text-stone-400 block">
                  Apabila aktif, pengguna boleh menukar set paparan bandar dengan mengklik mana-mana ruang kosong di luar kad bento.
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveWorldClockSettings}
                disabled={savingWorldClock}
                className="bg-[#802334] hover:bg-[#601824] text-white px-4 py-2 rounded font-semibold text-xs shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {savingWorldClock ? <><Hourglass className="w-3.5 h-3.5" /> Menyimpan...</> : <><Save className="w-3.5 h-3.5" /> Simpan Tetapan Jam Dunia</>}
              </button>
            </div>

            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <h5 className="font-sans text-[11px] uppercase tracking-wider text-stone-700 font-bold">
                  Status & Prestasi Integrasi API (Live Health Check)
                </h5>
                <button
                  type="button"
                  onClick={fetchApiStatus}
                  disabled={isLoadingApiStatus}
                  className="text-[10px] font-mono text-[#802334] hover:underline uppercase font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {isLoadingApiStatus ? 'Menyemak API...' : <><RefreshCw className="w-3 h-3" /> Semak Status API Live</>}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                <div className="bg-stone-50 p-3 rounded border border-stone-200 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-800">Open-Meteo Weather API</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${apiStatusBadgeClass(apiHealthStatus?.openMeteo?.status)}`}>
                      {apiHealthStatus?.openMeteo?.status || 'Belum Disemak'}
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-500 space-y-0.5">
                    <div>Capaian Bandar: <strong className="text-stone-800">15 Bandar Ibu Negeri</strong></div>
                    <div>Latensi Rangkaian: <strong className="text-emerald-700">{apiHealthStatus?.openMeteo?.latencyMs !== undefined ? `${apiHealthStatus.openMeteo.latencyMs} ms` : '—'}</strong></div>
                    <div>Had Kuota: <span className="text-stone-700">Percuma (Tanpa Had API Key)</span></div>
                    <div className="text-stone-400 truncate">Endpoint: {apiHealthStatus?.openMeteo?.endpoint || 'api.open-meteo.com/v1/forecast'}</div>
                  </div>
                </div>

                <div className="bg-stone-50 p-3 rounded border border-stone-200 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-800">Malaysia Holiday API</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${apiStatusBadgeClass(apiHealthStatus?.holidayApi?.status)}`}>
                      {apiHealthStatus?.holidayApi?.status || 'Belum Disemak'}
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-500 space-y-0.5">
                    <div>Liputan Negeri: <strong className="text-stone-800">15 Negeri & Wilayah</strong></div>
                    <div>Tahun Kalendar: <strong className="text-stone-800">{apiHealthStatus?.holidayApi?.calendarYear || new Date().getFullYear()} (Group A &amp; Group B)</strong></div>
                    <div>Latensi Rangkaian: <strong className="text-emerald-700">{apiHealthStatus?.holidayApi?.latencyMs !== undefined ? `${apiHealthStatus.holidayApi.latencyMs} ms` : '—'}</strong></div>
                    <div className="text-stone-400 truncate">Endpoint: {apiHealthStatus?.holidayApi?.endpoint || 'malaysia-holiday.dydxsoft.my/api/v1/holidays'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. ADJUNG EDITORIAL INTELLIGENCE PLATFORM (AEIP) */}
      {subTab === 'Komponen' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs">
            <Construction className="inline w-3.5 h-3.5 -mt-0.5 mr-1" /> AEIP di bawah ini masih prototaip antara muka sahaja — tiada enjin rule-pack/experiment/release sebenar di belakangnya lagi. Ia bukan sekadar salah wiring (macam bahagian lain Tetapan yang baru dibaiki), sebaliknya keseluruhan sistem baru perlu dibina dari kosong. Ditangguhkan buat masa ini memandangkan skopnya jauh lebih besar daripada pembaikan lain dalam laluan ini — bincang dengan saya dahulu sebelum melabur masa membina backend penuh untuknya.
          </div>
          <EditorialIntelligencePlatform />
        </div>
      )}

      {/* 5. INTERACTIVE RBAC PERMISSION TABLE MATRIX */}
      {subTab === 'RBAC' && (
        <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-900">
            <AlertTriangle className="inline w-3.5 h-3.5 -mt-0.5 mr-1" /> Matriks ni disimpan betul-betul ke pangkalan data, tapi <strong>belum dikuatkuasakan</strong> di mana-mana bahagian sistem sebenar — semua semakan akses semasa (Indeks, Direktori, Tetapan sendiri) terus banding peranan dengan Ketua Editor secara tegar dalam kod, tanpa rujuk jadual ni langsung. Menanda/menyahtanda kebenaran di bawah <strong>tiada kesan</strong> pada apa yang seseorang benar-benar boleh buat buat masa ini.
          </div>
          <div className="flex flex-wrap justify-between items-center border-b border-stone-200 pb-3 gap-2">
            <div>
              <h3 className="font-sans text-xs font-bold text-[#802334] uppercase tracking-wider">
                MATRIKS KEBENARAN PERANAN (RBAC PERMISSION MATRIX TABLE)
              </h3>
              <p className="text-stone-500 text-xs mt-0.5">
                Ketua Editor boleh menanda atau membatalkan kebenaran peranan mengikut keperluan tadbir urus editorial.
              </p>
            </div>
          </div>

          {rbacSaveError && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-3 py-2 rounded flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {rbacSaveError}</div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 border-b border-stone-200 font-sans text-xs font-semibold text-stone-700">
                  <th className="p-3 min-w-36">Peranan Editorial</th>
                  <th className="p-3 text-center">Lihat Semua</th>
                  <th className="p-3 text-center">Sunting Saya</th>
                  <th className="p-3 text-center">Sunting Semua</th>
                  <th className="p-3 text-center">Publish</th>
                  <th className="p-3 text-center">Tolak</th>
                  <th className="p-3 text-center">Agihan Slot</th>
                  <th className="p-3 text-center">Polisi & Tetapan</th>
                  <th className="p-3 text-center">Tadbir RBAC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-sans">
                {rbacMatrix.map(row => (
                  <tr key={row.roleId} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3 font-bold text-stone-900 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${row.roleId === 'ketua_editor' ? 'bg-[#802334]' : 'bg-stone-500'}`} />
                      <span>{row.roleName}</span>
                    </td>

                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.viewAll} onChange={() => handleTogglePermission(row.roleId, 'viewAll')} disabled={row.isImmutableAdmin} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer disabled:opacity-50" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.editOwn} onChange={() => handleTogglePermission(row.roleId, 'editOwn')} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.editAll} onChange={() => handleTogglePermission(row.roleId, 'editAll')} disabled={row.isImmutableAdmin} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.publish} onChange={() => handleTogglePermission(row.roleId, 'publish')} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.reject} onChange={() => handleTogglePermission(row.roleId, 'reject')} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.assignSlot} onChange={() => handleTogglePermission(row.roleId, 'assignSlot')} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.manageSettings} onChange={() => handleTogglePermission(row.roleId, 'manageSettings')} disabled={row.isImmutableAdmin} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer disabled:opacity-50" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.manageRbac} onChange={() => handleTogglePermission(row.roleId, 'manageRbac')} disabled={row.isImmutableAdmin} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer disabled:opacity-50" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveRbac}
              disabled={savingRbac || !rbacDirty}
              className="bg-[#802334] hover:bg-[#601824] text-white px-4 py-2 rounded font-semibold text-xs shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {savingRbac ? <><Hourglass className="w-3.5 h-3.5" /> Menyimpan...</> : rbacDirty ? <><Save className="w-3.5 h-3.5" /> Simpan Matriks RBAC</> : <><Check className="w-3.5 h-3.5" /> Tersimpan</>}
            </button>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURATION DRAWER: SENARAI ISTILAH AUTOCONDONG */}
      {activeConfigModal === 'italic' && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-stone-200 pb-2">
              <h3 className="font-sans text-xs font-bold text-[#802334] uppercase">
                Senarai Istilah Autocondong
              </h3>
              <button onClick={() => setActiveConfigModal(null)} className="text-stone-400 font-bold"><X className="w-3.5 h-3.5" /></button>
            </div>

            <p className="text-stone-600 text-xs">
              Setiap perkataan di sini dicondongkan secara automatik oleh enjin tipografi Adjung semasa paparan
              (data asal tak diubah kekal). Senarai ni sama dengan yang di panel Peraturan Tipografi penuh
              (Tetapan Slot) — tambah/buang pantas di sini sahaja; untuk skop, bahasa, keutamaan atau
              kekecualian, guna panel penuh tu.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Tambah perkataan (e.g. machine learning)..."
                value={newTermInput}
                onChange={e => setNewTermInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddItalicTerm(); }}
                className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs flex-1"
              />
              <button
                onClick={handleAddItalicTerm}
                className="bg-[#802334] text-white px-3 py-1.5 rounded font-semibold text-xs"
              >
                + Tambah
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 max-h-48 overflow-y-auto">
              {loadingItalicTerms && <span className="text-stone-400">Memuatkan...</span>}
              {!loadingItalicTerms && italicTerms.length === 0 && <span className="text-stone-400 italic">Senarai masih kosong.</span>}
              {italicTerms.map(t => (
                <span key={t.id} className="bg-stone-100 border border-stone-300 text-stone-800 px-2.5 py-1 rounded text-xs flex items-center gap-1.5">
                  <span className="italic font-semibold">{t.term}</span>
                  {t.status !== 'active' && (
                    <span className="bg-amber-100 text-amber-800 border border-amber-200 px-1.5 rounded-sm text-[9px] font-mono uppercase">Belum Aktif</span>
                  )}
                  <button onClick={() => handleRemoveItalicTerm(t.id)} className="text-stone-400 hover:text-red-700 font-bold"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>

            <div className="pt-2 border-t border-stone-200 flex justify-end">
              <button onClick={() => setActiveConfigModal(null)} className="bg-stone-800 text-white text-xs px-4 py-1.5 rounded font-semibold">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PEMILIH IKON BIDANG */}
      {iconPickerBidangId && (() => {
        const target = desks.find(d => d.id === iconPickerBidangId);
        if (!target) return null;
        return (
          <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-lg w-full p-6 space-y-4 text-xs max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                <h3 className="font-sans text-xs font-bold text-[#802334] uppercase flex items-center gap-2">
                  <BidangIcon iconName={target.icon} iconSvg={target.iconSvg} color={target.color} />
                  Ikon &amp; Plat Ilustrasi — {target.name}
                </h3>
                <button onClick={closeIconPicker} className="text-stone-400 font-bold"><X className="w-3.5 h-3.5" /></button>
              </div>

              <div className="font-sans space-y-3">
                <div>
                  <label className="text-xs text-stone-500 font-semibold block mb-2">Pilih Ikon Sedia Ada</label>
                  <div className="grid grid-cols-8 gap-1.5">
                    {BIDANG_ICON_NAMES.map(name => {
                      const Icon = BIDANG_ICON_MAP[name];
                      const isCurrent = !target.iconSvg && target.icon === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          title={name}
                          disabled={savingIconFor === target.id}
                          onClick={() => handlePickLucideIcon(target.id, name)}
                          className={`flex items-center justify-center w-8 h-8 rounded border transition-colors disabled:opacity-40 ${
                            isCurrent ? 'bg-[#802334] border-[#802334] text-white' : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-[#802334] hover:text-[#802334]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-200">
                  <label className="text-xs text-stone-500 font-semibold block mb-2">Atau Muat Naik SVG Sendiri</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-900 text-[#E9D8A6] font-sans text-xs px-3 py-1.5 rounded font-semibold cursor-pointer">
                      <Upload className="w-3.5 h-3.5" /> Pilih Fail .svg
                      <input
                        type="file"
                        accept=".svg,image/svg+xml"
                        className="hidden"
                        onChange={e => handleSvgFileSelected(e.target.files?.[0] || null)}
                      />
                    </label>
                    {svgUploadPreview && (
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-stone-300 [&_svg]:w-4 [&_svg]:h-4"
                        style={{ color: target.color }}
                        dangerouslySetInnerHTML={{ __html: svgUploadPreview }}
                      />
                    )}
                  </div>
                  <p className="text-stone-400 text-[10px] mt-1.5">Had 100KB. Ditapis ketat di server sebelum disimpan (skrip/pengendali klik dibuang).</p>
                  {svgUploadError && <p className="text-red-600 text-[10px] mt-1">{svgUploadError}</p>}
                  {svgUploadPreview && (
                    <button
                      onClick={() => handleUploadSvgIcon(target.id)}
                      disabled={uploadingSvg}
                      className="mt-2 bg-[#802334] text-white px-3 py-1.5 rounded font-semibold text-xs disabled:opacity-50"
                    >
                      {uploadingSvg ? 'Memuat naik...' : 'Guna SVG Ini'}
                    </button>
                  )}
                </div>
                <div className="pt-3 border-t border-stone-200">
                  <label className="text-xs text-stone-500 font-semibold block mb-1">Plat Ilustrasi Bidang</label>
                  <p className="text-stone-400 text-[10px] mb-2 leading-relaxed">
                    Ilustrasi besar yang menutup kolum kanan Focus View apabila kandungan itu tiada grafik,
                    tiada kandungan berkaitan dan tiada nota editor. Ia mengalah kepada kandungan sebenar —
                    satu grafik atau satu nota sudah cukup untuk menyembunyikannya.
                  </p>

                  <p className="text-stone-500 text-[10px] font-semibold mb-1">Tiga syarat:</p>
                  <ul className="text-stone-500 text-[10px] leading-relaxed mb-2 pl-3 list-disc marker:text-stone-300">
                    <li>SVG mesti ada <code className="font-mono">viewBox</code>. Nombornya bebas — <code className="font-mono">0 0 1024 1024</code> sama sah seperti <code className="font-mono">0 0 256 256</code>.</li>
                    <li>Guna <code className="font-mono">currentColor</code> untuk fill/stroke. Warna tetap (hex/rgb) ditolak — plat mesti mengikut marun Adjung.</li>
                    <li>Had 256KB.</li>
                  </ul>
                  <p className="text-stone-400 text-[10px] leading-relaxed mb-2">
                    Cadangan (tidak dikuatkuasakan): nisbah segi empat sama duduk paling baik dalam kolum;
                    kekalkan karya sedikit dari tepi; garis halus supaya plat kekal senyap dan tidak menarik
                    perhatian daripada tajuk. Bukan ikon yang dibesarkan — ikon 24px jadi nipis pada saiz ini.
                  </p>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-900 text-[#E9D8A6] font-sans text-xs px-3 py-1.5 rounded font-semibold cursor-pointer">
                      <Upload className="w-3.5 h-3.5" /> Pilih Plat .svg
                      <input
                        type="file"
                        accept=".svg,image/svg+xml"
                        className="hidden"
                        onChange={e => handleIllusFileSelected(e.target.files?.[0] || null)}
                      />
                    </label>
                    {(illusPreview || illusCurrent) && (
                      <span
                        className="inline-flex items-center justify-center w-16 h-16 rounded border border-stone-200 bg-[#FDFDFD] [&_svg]:w-14 [&_svg]:h-14"
                        style={{ color: '#802334' }}
                        title={illusPreview ? 'Pratonton fail baharu' : 'Plat semasa'}
                        dangerouslySetInnerHTML={{ __html: (illusPreview || illusCurrent) as string }}
                      />
                    )}
                  </div>

                  {illusError && <p className="text-red-600 text-[10px] mt-1">{illusError}</p>}

                  <div className="flex items-center gap-2 mt-2">
                    {illusPreview && (
                      <button
                        onClick={() => handleUploadIllustration(target.id)}
                        disabled={uploadingIllus}
                        className="bg-[#802334] text-white px-3 py-1.5 rounded font-semibold text-xs disabled:opacity-50"
                      >
                        {uploadingIllus ? 'Memuat naik...' : 'Guna Plat Ini'}
                      </button>
                    )}
                    {target.hasIllustration && !illusPreview && (
                      <button
                        onClick={() => handleClearIllustration(target.id)}
                        disabled={uploadingIllus}
                        className="bg-stone-200 text-stone-700 px-3 py-1.5 rounded font-semibold text-xs disabled:opacity-50"
                      >
                        {uploadingIllus ? 'Membuang...' : 'Buang Plat'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-200 flex justify-end">
                <button onClick={closeIconPicker} className="bg-stone-200 text-stone-700 px-3 py-1.5 rounded font-semibold text-xs">Tutup</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL TAMBAH BIDANG */}
      {activeConfigModal === 'add_desk' && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-stone-200 pb-2">
              <h3 className="font-sans text-xs font-bold text-[#802334] uppercase">
                + Tambah Bidang Baharu
              </h3>
              <button onClick={() => setActiveConfigModal(null)} className="text-stone-400 font-bold"><X className="w-3.5 h-3.5" /></button>
            </div>

            <div className="space-y-3 font-sans">
              <div>
                <label className="text-xs text-stone-500 font-semibold block mb-1">Nama Bidang</label>
                <input type="text" placeholder="Astronomi" value={newDeskName} onChange={e => setNewDeskName(e.target.value)} className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs font-semibold" />
              </div>
              <div>
                <label className="text-xs text-stone-500 font-semibold block mb-1">Warna Bidang (Hex)</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={newDeskColor} onChange={e => setNewDeskColor(e.target.value)} className="w-9 h-8 rounded border border-stone-300 cursor-pointer p-0.5 bg-stone-50" />
                  <input type="text" value={newDeskColor} onChange={e => setNewDeskColor(e.target.value)} className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs font-mono font-bold" />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200 flex justify-end gap-2">
              <button onClick={() => setActiveConfigModal(null)} className="bg-stone-200 text-stone-700 px-3 py-1.5 rounded font-semibold text-xs">Batal</button>
              <button onClick={handleAddDesk} disabled={addingDesk} className="bg-[#802334] text-white px-4 py-1.5 rounded font-semibold text-xs disabled:opacity-50">
                {addingDesk ? 'Menambah...' : 'Tambah Bidang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TetapanConsole;
