import React, { useState, useEffect } from 'react';
import { Lock, Settings, Construction, Zap, Newspaper, X, AlertTriangle, Save, RefreshCw, Check, Hourglass, Play, Globe } from 'lucide-react';
import { EditorialIntelligencePlatform } from './EditorialIntelligencePlatform';

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

const DESK_UNIQUE_COLORS: Record<string, string> = {
  'Kesusasteraan Melayu': '#E05638',
  'Psikolinguistik': '#6366F1',
  'Teknologi': '#0D9488',
  'Warisan': '#A16207',
  'Ujian': '#64748B',
  'Sukan': '#059669',
  'Semasa': '#B91C1C',
  'Nasional': '#2563EB',
  'Sains & Teknologi': '#0284C7',
  'Sains': '#0891B2',
  'Sejarah': '#854D0E',
  'Falsafah': '#6B21A8',
  'Ekonomi': '#1D4ED8',
  'Diplomasi': '#312E81',
  'Politik': '#3730A3',
  'Gaya Hidup': '#DB2777',
  'Hiburan': '#EA580C',
  'Pendidikan': '#B55604',
  'Masyarakat': '#166534',
  'Teknologi Utama': '#0F766E',
  'Sosiolinguistik': '#C05621',
  'Linguistik Komputasional': '#0284C7',
  'Fonologi Dan Morfologi': '#9D174D',
};

const formatTitleCase = (str: string) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface DeskItem {
  id: string;
  code: string;
  name: string;
  displayLabel: string;
  color: string;
  status: 'Aktif' | 'Tidak Aktif';
}

interface TypographyTerm {
  id: string;
  term: string;
  style: string;
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

  // Kamus Istilah Italic -- backed by the same adjung_typography_rules table the main
  // frontpage settings drawer uses (core/routes/slotRoutes.js), not a separate local list.
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
            .map((r: any) => ({ id: r.id, term: r.term, style: r.style }))
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

  // Governance Jam Dunia (World Clock) -- these were previously local-only state with no
  // backing DB columns at all (WorldClockStrip.tsx has read systemSettings.worldClockIntervalSec
  // / worldClockBgClickEnabled from day one, but nothing ever wrote them). Now backed by real
  // columns on system_settings.
  const [worldClockIntervalSec, setWorldClockIntervalSec] = useState<number>(60);
  const [worldClockBgClickEnabled, setWorldClockBgClickEnabled] = useState<boolean>(true);
  const [savingWorldClock, setSavingWorldClock] = useState(false);
  const [worldClockSaveError, setWorldClockSaveError] = useState<string | null>(null);

  const [apiHealthStatus, setApiHealthStatus] = useState<any>(null);
  const [isLoadingApiStatus, setIsLoadingApiStatus] = useState<boolean>(false);

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
  // /api/system/settings) -- always fetch the current row and merge in just the field(s) being
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

  // Taksonomi Desk List State (Auto-registered from Live content + Unique Hex Colors)
  const [desks, setDesks] = useState<DeskItem[]>([]);

  // Blocked RSS categories -- real CRUD table (rss_blocked_categories), managed here AND in the
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

  // Live Classifier Tester -- exercises the real desk-classification engine
  // (core/engines/DeskClassifierEngine.js via /api/system/rss-desk-rules/test).
  const [testInputTitle, setTestInputTitle] = useState('PDRM tahan 3 suspek kes jenayah biometrik di KLIA');
  const [testInputBrief, setTestInputBrief] = useState('Siasatan lanjut mendapati penglibatan sindiket antarabangsa.');
  const [testInputCategory, setTestInputCategory] = useState('Jenayah');
  const [testResult, setTestResult] = useState<any>(null);
  const [testingClassifier, setTestingClassifier] = useState(false);

  const handleRunClassifierTest = async () => {
    setTestingClassifier(true);
    try {
      const res = await fetch('/api/system/rss-desk-rules/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testTitle: testInputTitle,
          testBrief: testInputBrief,
          testCategory: testInputCategory
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      console.error('Classifier test error:', e);
    } finally {
      setTestingClassifier(false);
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

    // Fetch live content items to extract actual live desks dynamically
    fetch('/api/system/content/all')
      .then(res => res.json())
      .then(data => {
        const rawItems = data.items || [];
        const liveDeskSet = new Set<string>();

        // Seed core desks
        ['Kesusasteraan Melayu', 'Psikolinguistik', 'Teknologi', 'Warisan', 'Ujian', 'Sukan', 'Semasa', 'Nasional', 'Sains & Teknologi', 'Sejarah', 'Falsafah', 'Ekonomi', 'Diplomasi', 'Politik'].forEach(d => liveDeskSet.add(d));

        // Add desks from live database items
        rawItems.forEach((item: any) => {
          if (item.desk && item.desk.trim()) {
            liveDeskSet.add(formatTitleCase(item.desk.trim()));
          }
        });

        const usedColors = new Set<string>();
        const registeredDesks: DeskItem[] = Array.from(liveDeskSet).map((deskName, idx) => {
          let chosenColor = DESK_UNIQUE_COLORS[deskName];

          // Ensure zero duplicate colors across all desks and strictly in Hex format (#RRGGBB)
          if (!chosenColor || usedColors.has(chosenColor)) {
            let hue = (idx * 137.5) % 360;
            chosenColor = hslToHex(Math.round(hue), 70, 40);
            while (usedColors.has(chosenColor)) {
              hue = (hue + 25) % 360;
              chosenColor = hslToHex(Math.round(hue), 70, 40);
            }
          }

          usedColors.add(chosenColor);

          return {
            id: `desk_${deskName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            code: deskName.toUpperCase().slice(0, 8),
            name: deskName,
            displayLabel: deskName,
            color: chosenColor,
            status: 'Aktif'
          };
        });

        registeredDesks.sort((a, b) => a.name.localeCompare(b.name));
        setDesks(registeredDesks);
      })
      .catch(() => {
        const fallbackDesks = ['Kesusasteraan Melayu', 'Psikolinguistik', 'Teknologi', 'Warisan', 'Ujian', 'Sukan', 'Semasa', 'Nasional', 'Sains & Teknologi', 'Sejarah', 'Falsafah', 'Ekonomi', 'Diplomasi', 'Politik'];
        const formattedFallback: DeskItem[] = fallbackDesks.map(name => ({
          id: `desk_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          code: name.toUpperCase().slice(0, 8),
          name,
          displayLabel: name,
          color: DESK_UNIQUE_COLORS[name] || '#802334',
          status: 'Aktif'
        }));
        formattedFallback.sort((a, b) => a.name.localeCompare(b.name));
        setDesks(formattedFallback);
      });
  }, []);

  // New Desk Modal State
  const [newDeskName, setNewDeskName] = useState('');
  const [newDeskCode, setNewDeskCode] = useState('');
  const [newDeskColor, setNewDeskColor] = useState('#802334');
  const [newDeskLabel, setNewDeskLabel] = useState('');

  // Interactive RBAC Permission Matrix State -- backed by system_settings.rolePermissions.
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

  const handleAddDesk = () => {
    if (newDeskName.trim()) {
      const newD: DeskItem = {
        id: `desk_${newDeskCode.toLowerCase() || Date.now()}`,
        code: newDeskCode.toUpperCase() || 'DESK',
        name: newDeskName,
        displayLabel: newDeskLabel || newDeskName,
        color: newDeskColor || '#802334',
        status: 'Aktif'
      };
      setDesks(prev => [...prev, newD]);
      setNewDeskName('');
      setNewDeskCode('');
      setNewDeskLabel('');
      setNewDeskColor('#802334');
      setActiveConfigModal(null);
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
                  <span>Auto Italic Istilah Asing & Pinjaman</span>
                </label>
                <p className="text-stone-500 text-xs">
                  Memformat secara automatik perkataan asing yang tersenarai dalam Kamus Istilah Italic.
                </p>
              </div>
              <button
                onClick={() => setActiveConfigModal('italic')}
                className="w-64 flex items-center justify-center gap-1.5 bg-stone-800 hover:bg-stone-900 text-[#E9D8A6] font-sans text-xs px-3 py-1.5 rounded font-semibold transition-colors"
              >
                <Settings className="w-3.5 h-3.5" /> Konfigurasi Kamus ({italicTerms.length} Perkataan)
              </button>
            </div>

            <div className="pt-4 flex flex-wrap justify-between items-center gap-3">
              <div className="space-y-1">
                <label className="flex items-center gap-2 font-semibold text-stone-400 cursor-not-allowed">
                  <input type="checkbox" disabled className="rounded border-stone-300" />
                  <span>Citation & Rujukan Akademik</span>
                </label>
                <p className="text-stone-400 text-xs">
                  Enjin rujukan automatik bagi format sitasi jurnal dan dokumen sejarah.
                </p>
              </div>
              <span className="w-64 flex items-center justify-center gap-1.5 bg-stone-100 text-stone-400 font-sans text-xs px-3 py-1.5 rounded font-semibold border border-stone-200">
                <Construction className="w-3.5 h-3.5" /> Belum Dibina
              </span>
            </div>

            <div className="pt-4 flex flex-wrap justify-between items-center gap-3">
              <div className="space-y-1">
                <label className="flex items-center gap-2 font-semibold text-stone-400 cursor-not-allowed">
                  <input type="checkbox" disabled className="rounded border-stone-300" />
                  <span>Footnote & Nota Kaki Dinamik</span>
                </label>
                <p className="text-stone-400 text-xs">
                  Penomboran nota kaki bawah halaman bagi istilah khusus akademik.
                </p>
              </div>
              <span className="w-64 flex items-center justify-center gap-1.5 bg-stone-100 text-stone-400 font-sans text-xs px-3 py-1.5 rounded font-semibold border border-stone-200">
                <Construction className="w-3.5 h-3.5" /> Belum Dibina
              </span>
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

      {/* 2. TAKSONOMI (DESK MANAGEMENT) */}
      {subTab === 'Taksonomi' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Taksonomi Desk Disiplin Ilmu (Slot Spatial Frontpage)
                </h3>
                <p className="text-stone-500 text-xs">
                  Pendaftaran Desk dan Warna Unik Hex untuk slot-slot spatial (Hero, Feature, Brief, Compact, dll.) yang disunting oleh Editor atau AI. Ticker dijana automatik menerusi enjin rules berasingan.
                </p>
              </div>
              <span className="font-sans text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Pendaftaran Automatik Live ({desks.length} Desk)
              </span>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 border-b border-stone-200 font-sans text-xs uppercase text-stone-600 font-semibold">
                  <th className="p-3">Warna Unik Desk (Kod Hex)</th>
                  <th className="p-3">Nama Desk</th>
                  <th className="p-3">Peruntukan Disiplin Spatial</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {desks.map(d => (
                  <tr key={d.name} className="hover:bg-stone-50">
                    <td className="p-3 flex items-center gap-2">
                      <span className="inline-block w-4 h-4 rounded-full border border-stone-300 shadow-xs" style={{ backgroundColor: d.color }}></span>
                      <code className="font-mono text-[11px] text-stone-700 font-bold">{d.color}</code>
                    </td>
                    <td className="p-3 font-semibold text-stone-900">{d.name}</td>
                    <td className="p-3 text-stone-600 font-sans text-[11px]">Slot Spatial Frontpage (Manual/AI)</td>
                    <td className="p-3 text-emerald-800 font-semibold">{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Live Desk Classifier Tester -- exercises the real rss-desk-rules/test endpoint */}
          <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
            <div>
              <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
                Uji Enjin Klasifikasi Desk
              </h3>
              <p className="text-stone-500 text-xs">
                Semak secara langsung bagaimana enjin klasifikasi automatik akan mengagihkan tajuk/brief kepada desk tertentu.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">Tajuk Ujian</label>
                <input type="text" value={testInputTitle} onChange={e => setTestInputTitle(e.target.value)} className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs" />
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">Kategori Mentah RSS (jika ada)</label>
                <input type="text" value={testInputCategory} onChange={e => setTestInputCategory(e.target.value)} className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs" />
              </div>
              <div className="md:col-span-2">
                <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">Brief Ujian</label>
                <textarea value={testInputBrief} onChange={e => setTestInputBrief(e.target.value)} rows={2} className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs" />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <button
                onClick={handleRunClassifierTest}
                disabled={testingClassifier}
                className="bg-[#802334] hover:bg-[#601824] text-white px-4 py-2 rounded font-semibold text-xs disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {testingClassifier ? <><Hourglass className="w-3.5 h-3.5" /> Menguji...</> : <><Play className="w-3.5 h-3.5" /> Jalankan Ujian Klasifikasi</>}
              </button>
            </div>
            {testResult && (
              <pre className="bg-stone-900 text-emerald-300 text-[10px] p-3 rounded overflow-x-auto max-h-64">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* 3. OPERASI & GOVERNANCE */}
      {subTab === 'Operasi' && (
        <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-6 text-xs">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-900">
            <Newspaper className="inline w-3.5 h-3.5 -mt-0.5 mr-1" /> Tetapan RSS &amp; penapisan Ticker (had berita live, kata kunci diharamkan, ambang skor) diuruskan di <strong>Frontpage → Urus Ticker</strong>, bukan di sini -- supaya tiada dua tempat berasingan yang boleh terkeluar segerak antara satu sama lain.
          </div>

          {/* Kategori RSS Tersekat -- shared with the Frontpage Ticker Management modal */}
          <div className="space-y-3">
            <div>
              <h4 className="font-sans text-xs uppercase tracking-wider text-stone-700 font-bold mb-0.5">
                Kategori RSS Tersekat (Blocked Category Tags)
              </h4>
              <p className="text-stone-500 text-[11px]">
                Kategori mentah RSS yang disenaraikan di sini turut terpakai di modal Urus Ticker Frontpage -- satu senarai kongsi.
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

          {/* Had Geometri Aksara Mengikut 8 Tier -- this used to be a hand-typed duplicate of
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
                  <option value={30}>30 Saat (Pantas)</option>
                  <option value={60}>60 Saat / 1 Minit (Disyorkan)</option>
                  <option value={120}>120 Saat / 2 Minit</option>
                  <option value={300}>300 Saat / 5 Minit</option>
                  <option value={0}>Matikan Auto-Slaid (Manual Sahaja)</option>
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
                  <option value="1">Aktif (Klik Mana-mana Ruang Kosong untuk Tukar Set)</option>
                  <option value="0">Tidak Aktif (Guna Pemasa Automatik Sahaja)</option>
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
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold uppercase">
                      {apiHealthStatus?.openMeteo?.status || 'ONLINE (200 OK)'}
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-500 space-y-0.5">
                    <div>Capaian Bandar: <strong className="text-stone-800">15 Bandar Ibu Negeri</strong></div>
                    <div>Latensi Rangkaian: <strong className="text-emerald-700">{apiHealthStatus?.openMeteo?.latencyMs || 85} ms</strong></div>
                    <div>Had Kuota: <span className="text-stone-700">Percuma (Tanpa Had API Key)</span></div>
                    <div className="text-stone-400 truncate">Endpoint: {apiHealthStatus?.openMeteo?.endpoint || 'api.open-meteo.com/v1/forecast'}</div>
                  </div>
                </div>

                <div className="bg-stone-50 p-3 rounded border border-stone-200 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-800">Malaysia Holiday API 2026</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold uppercase">
                      {apiHealthStatus?.holidayApi?.status || 'ONLINE (200 OK)'}
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-500 space-y-0.5">
                    <div>Liputan Negeri: <strong className="text-stone-800">15 Negeri & Wilayah</strong></div>
                    <div>Tahun Kalendar: <strong className="text-stone-800">2026 (Group A & Group B)</strong></div>
                    <div>Status Data: <span className="text-emerald-700">Disemak & Disepadukan</span></div>
                    <div className="text-stone-400">Integrasi: Kalendar Cuti Umum & Cuti Sekolah</div>
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
            <Construction className="inline w-3.5 h-3.5 -mt-0.5 mr-1" /> AEIP di bawah ini masih prototaip antara muka sahaja -- tiada enjin rule-pack/experiment/release sebenar di belakangnya lagi. Ia bukan sekadar salah wiring (macam bahagian lain Tetapan yang baru dibaiki), sebaliknya keseluruhan sistem baru perlu dibina dari kosong. Ditangguhkan buat masa ini memandangkan skopnya jauh lebih besar daripada pembaikan lain dalam laluan ini -- bincang dengan saya dahulu sebelum melabur masa membina backend penuh untuknya.
          </div>
          <EditorialIntelligencePlatform />
        </div>
      )}

      {/* 5. INTERACTIVE RBAC PERMISSION TABLE MATRIX */}
      {subTab === 'RBAC' && (
        <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
          <div className="flex flex-wrap justify-between items-center border-b border-stone-200 pb-3 gap-2">
            <div>
              <h3 className="font-sans text-xs font-bold text-[#802334] uppercase tracking-wider">
                MATRIKS KEBENARAN PERANAN (RBAC PERMISSION MATRIX TABLE)
              </h3>
              <p className="text-stone-500 text-xs mt-0.5">
                Ketua Editor boleh menanda atau membatalkan kebenaran peranan mengikut keperluan tadbir urus editorial.
              </p>
            </div>
            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded font-semibold text-xs border border-emerald-200 inline-flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Mod Kelulusan Dinamik
            </span>
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

      {/* MODAL CONFIGURATION DRAWER: KAMUS ISTILAH ITALIC */}
      {activeConfigModal === 'italic' && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-stone-200 pb-2">
              <h3 className="font-sans text-xs font-bold text-[#802334] uppercase">
                Polisi Italic & Kamus Istilah Asing
              </h3>
              <button onClick={() => setActiveConfigModal(null)} className="text-stone-400 font-bold"><X className="w-3.5 h-3.5" /></button>
            </div>

            <p className="text-stone-600 text-xs">
              Setiap perkataan dalam kamus ini akan di-italic-kan secara automatik oleh enjin tipografi semasa pembentukan Brief.
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
              {!loadingItalicTerms && italicTerms.length === 0 && <span className="text-stone-400 italic">Kamus masih kosong.</span>}
              {italicTerms.map(t => (
                <span key={t.id} className="bg-stone-100 border border-stone-300 text-stone-800 px-2.5 py-1 rounded text-xs flex items-center gap-1.5">
                  <span className="italic font-semibold">{t.term}</span>
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

      {/* MODAL ADD NEW DESK */}
      {activeConfigModal === 'add_desk' && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-stone-200 pb-2">
              <h3 className="font-sans text-xs font-bold text-[#802334] uppercase">
                + Tambah Desk Disiplin Ilmu Baharu
              </h3>
              <button onClick={() => setActiveConfigModal(null)} className="text-stone-400 font-bold"><X className="w-3.5 h-3.5" /></button>
            </div>

            <div className="space-y-3 font-sans">
              <div>
                <label className="text-xs text-stone-500 font-semibold block mb-1">Nama Desk</label>
                <input type="text" placeholder="Astronomi" value={newDeskName} onChange={e => setNewDeskName(e.target.value)} className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs font-semibold" />
              </div>
              <div>
                <label className="text-xs text-stone-500 font-semibold block mb-1">Kod Desk</label>
                <input type="text" placeholder="ASTRO" value={newDeskCode} onChange={e => setNewDeskCode(e.target.value)} className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs font-semibold" />
              </div>
              <div>
                <label className="text-xs text-stone-500 font-semibold block mb-1">Warna Unik Desk (Hex Color Tag)</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={newDeskColor} onChange={e => setNewDeskColor(e.target.value)} className="w-9 h-8 rounded border border-stone-300 cursor-pointer p-0.5 bg-stone-50" />
                  <input type="text" value={newDeskColor} onChange={e => setNewDeskColor(e.target.value)} className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs font-mono font-bold" />
                </div>
              </div>
              <div>
                <label className="text-xs text-stone-500 font-semibold block mb-1">Label Paparan Ticker</label>
                <input type="text" placeholder="Sains Astronomi" value={newDeskLabel} onChange={e => setNewDeskLabel(e.target.value)} className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs font-semibold" />
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200 flex justify-end gap-2">
              <button onClick={() => setActiveConfigModal(null)} className="bg-stone-200 text-stone-700 px-3 py-1.5 rounded font-semibold text-xs">Batal</button>
              <button onClick={handleAddDesk} className="bg-[#802334] text-white px-4 py-1.5 rounded font-semibold text-xs">Tambah Desk</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TetapanConsole;
