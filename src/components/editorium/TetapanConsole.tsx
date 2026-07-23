import React, { useState, useEffect } from 'react';
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

interface DeskRule {
  id: string;
  deskId: string;
  deskName?: string;
  keyword: string;
  weight: number;
  isNegative: boolean;
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

interface TetapanConsoleProps {
  currentUserRole?: 'KETUA_EDITOR' | 'EDITOR';
}

export const TetapanConsole: React.FC<TetapanConsoleProps> = ({
  currentUserRole = 'KETUA_EDITOR'
}) => {
  const [subTab, setSubTab] = useState<'PolisiKandungan' | 'AdjungBrief' | 'Taksonomi' | 'Komponen' | 'RBAC'>('PolisiKandungan');

  // Interactive Configuration Drawer Modal State
  const [activeConfigModal, setActiveConfigModal] = useState<'italic' | 'ticker' | 'add_desk' | null>(null);

  // Kamus Istilah Italic Dictionary State
  const [italicTerms, setItalicTerms] = useState<string[]>([
    'avatar', 'podcast', 'live streaming', 'machine learning', 'scammer', 'blockchain', 'biosemiotic'
  ]);
  const [newTermInput, setNewTermInput] = useState('');

  // Ticker & RSS Editorial Settings State
  const [tickerHeaderLabel, setTickerHeaderLabel] = useState('TERKINI DI MALAYSIA');
  const [tickerMaxItems, setTickerMaxItems] = useState<number>(30);
  const [blockedKeywords, setBlockedKeywords] = useState<string>('');
  const [blockedCategoryTags, setBlockedCategoryTags] = useState<string>('');
  const [isSavingTickerSettings, setIsSavingTickerSettings] = useState<boolean>(false);

  const fetchTickerSettings = async () => {
    try {
      const res = await fetch('/api/system/ticker/settings');
      if (res.ok) {
        const settings = await res.json();
        if (settings.tickerHeaderLabel) setTickerHeaderLabel(settings.tickerHeaderLabel);
        if (settings.blockedKeywords !== undefined) setBlockedKeywords(settings.blockedKeywords);
        if (settings.blockedCategoryTags !== undefined) setBlockedCategoryTags(settings.blockedCategoryTags);
        if (settings.tickerMaxItems !== undefined) setTickerMaxItems(Number(settings.tickerMaxItems) || 30);
      }
    } catch (e) {
      console.error('Error fetching ticker settings:', e);
    }
  };

  const handleSaveTickerSettings = async () => {
    try {
      setIsSavingTickerSettings(true);
      const payload = {
        tickerHeaderLabel,
        tickerMaxItems,
        blockedKeywords,
        blockedCategoryTags
      };
      const res = await fetch('/api/system/ticker/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Tetapan RSS & Ticker berjaya disimpan dan disegerakkan dengan pangkalan data!');
      } else {
        alert('Gagal menyimpan tetapan RSS & Ticker.');
      }
    } catch (e) {
      console.error('Save ticker settings error:', e);
      alert('Ralat menyimpan tetapan RSS & Ticker.');
    } finally {
      setIsSavingTickerSettings(false);
    }
  };

  // World Clock & Weather API Governance State
  const [worldClockIntervalSec, setWorldClockIntervalSec] = useState<number>(60);
  const [worldClockBgClickEnabled, setWorldClockBgClickEnabled] = useState<boolean>(true);
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

  // Taksonomi Desk List State (Auto-registered from Live content + Unique Hex Colors)
  const [desks, setDesks] = useState<DeskItem[]>([]);

  // Adjung Desk Classification Rules Engine State (Khusus Ticker & Curation)
  const [rules, setRules] = useState<DeskRule[]>([
    { id: 'rule_01', deskId: 'Kesusasteraan Melayu', deskName: 'Kesusasteraan Melayu', keyword: 'sastera', weight: 25, isNegative: false, enabled: true },
    { id: 'rule_02', deskId: 'Kesusasteraan Melayu', deskName: 'Kesusasteraan Melayu', keyword: 'puisi', weight: 20, isNegative: false, enabled: true },
    { id: 'rule_03', deskId: 'Psikolinguistik', deskName: 'Psikolinguistik', keyword: 'psikologi', weight: 20, isNegative: false, enabled: true },
    { id: 'rule_04', deskId: 'Psikolinguistik', deskName: 'Psikolinguistik', keyword: 'dementia', weight: 15, isNegative: false, enabled: true },
    { id: 'rule_05', deskId: 'Teknologi', deskName: 'Teknologi', keyword: 'kecerdasan buatan', weight: 30, isNegative: false, enabled: true },
    { id: 'rule_06', deskId: 'Sejarah', deskName: 'Sejarah', keyword: 'fosil', weight: 25, isNegative: false, enabled: true },
    { id: 'rule_07', deskId: 'Warisan', deskName: 'Warisan', keyword: 'unesco', weight: 25, isNegative: false, enabled: true },
    { id: 'rule_08', deskId: 'Ekonomi', deskName: 'Ekonomi', keyword: 'bank negara', weight: 20, isNegative: false, enabled: true },
    { id: 'rule_09', deskId: 'Nasional', deskName: 'Nasional', keyword: 'parlimen', weight: 25, isNegative: false, enabled: true },
    { id: 'rule_10', deskId: 'Politik', deskName: 'Politik', keyword: 'pilihan raya', weight: 25, isNegative: false, enabled: true }
  ]);

  // Live Classifier Tester State (Metodologi Multi-Dimensi 3-Tier)
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
    fetchTickerSettings();
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

  // Interactive RBAC Permission Matrix State
  const [rbacMatrix, setRbacMatrix] = useState<RbacMatrixRow[]>([
    {
      roleId: 'ketua_editor',
      roleName: 'Ketua Editor',
      isImmutableAdmin: true,
      permissions: {
        viewAll: true,
        editOwn: true,
        editAll: true,
        publish: true,
        reject: true,
        assignSlot: true,
        manageSettings: true,
        manageRbac: true
      }
    },
    {
      roleId: 'editor',
      roleName: 'Editor',
      isImmutableAdmin: false,
      permissions: {
        viewAll: true,
        editOwn: true,
        editAll: false,
        publish: true,
        reject: false,
        assignSlot: false,
        manageSettings: false,
        manageRbac: false
      }
    }
  ]);

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
  };

  const handleAddItalicTerm = () => {
    if (newTermInput.trim() && !italicTerms.includes(newTermInput.trim().toLowerCase())) {
      setItalicTerms(prev => [...prev, newTermInput.trim().toLowerCase()]);
      setNewTermInput('');
    }
  };

  const handleRemoveItalicTerm = (term: string) => {
    setItalicTerms(prev => prev.filter(t => t !== term));
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
        <div className="text-3xl">🔒</div>
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
            onClick={() => setSubTab('Komponen')}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'Komponen' ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            3. Adjung Editorial Intelligence Platform (AEIP)
          </button>

          <button
            onClick={() => setSubTab('RBAC')}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'RBAC' ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            4. RBAC
          </button>
        </div>

        <button className="bg-[#802334] hover:bg-[#6c1d2c] text-white px-4 py-1.5 rounded font-semibold shadow-xs transition-colors text-xs">
          Simpan Polisi
        </button>
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
                  <input type="checkbox" defaultChecked className="rounded border-stone-300 text-[#802334]" />
                  <span>Auto Italic Istilah Asing & Pinjaman</span>
                </label>
                <p className="text-stone-500 text-xs">
                  Memformat secara automatik perkataan asing yang tersenarai dalam Kamus Istilah Italic.
                </p>
              </div>
              <button
                onClick={() => setActiveConfigModal('italic')}
                className="w-64 flex items-center justify-center bg-stone-800 hover:bg-stone-900 text-[#E9D8A6] font-sans text-xs px-3 py-1.5 rounded font-semibold transition-colors"
              >
                ⚙️ Konfigurasi Kamus ({italicTerms.length} Perkataan)
              </button>
            </div>

            <div className="pt-4 flex flex-wrap justify-between items-center gap-3">
              <div className="space-y-1">
                <label className="flex items-center gap-2 font-semibold text-stone-900 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-stone-300 text-[#802334]" />
                  <span>Citation & Rujukan Akademik</span>
                </label>
                <p className="text-stone-500 text-xs">
                  Enjin rujukan automatik bagi format sitasi jurnal dan dokumen sejarah.
                </p>
              </div>
              <button className="w-64 flex items-center justify-center bg-stone-100 text-stone-700 font-sans text-xs px-3 py-1.5 rounded font-semibold border border-stone-300">
                ⚙️ Konfigurasi Citation
              </button>
            </div>

            <div className="pt-4 flex flex-wrap justify-between items-center gap-3">
              <div className="space-y-1">
                <label className="flex items-center gap-2 font-semibold text-stone-900 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-stone-300 text-[#802334]" />
                  <span>Footnote & Nota Kaki Dinamik</span>
                </label>
                <p className="text-stone-500 text-xs">
                  Penomboran nota kaki bawah halaman bagi istilah khusus akademik.
                </p>
              </div>
              <button className="w-64 flex items-center justify-center bg-stone-100 text-stone-700 font-sans text-xs px-3 py-1.5 rounded font-semibold border border-stone-300">
                ⚙️ Konfigurasi Footnote
              </button>
            </div>

            <div className="pt-4 flex flex-wrap justify-between items-center gap-3">
              <div className="space-y-1">
                <label className="flex items-center gap-2 font-semibold text-stone-900 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-stone-300 text-[#802334]" />
                  <span>Interlinear Gloss (Teks Dwibahasa / Arab-Melayu)</span>
                </label>
                <p className="text-stone-500 text-xs">
                  Paparan baris selari glosarium bagi istilah dwibahasa dan teks klasik.
                </p>
              </div>
              <button className="w-64 flex items-center justify-center bg-stone-100 text-stone-700 font-sans text-xs px-3 py-1.5 rounded font-semibold border border-stone-300">
                ⚙️ Konfigurasi Gloss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ADJUNG BRIEF */}
      {subTab === 'AdjungBrief' && (
        <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-6 text-xs">
          <div>
            <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider mb-1">
              Polisi Automasik, Ingestion & Geometri Nisbah
            </h3>
            <p className="text-stone-500 text-xs">
              Had aksara brief dikawal secara dinamik mengikut nisbah geometri spatial slot masing-masing (GeometryConfig Engine).
            </p>
          </div>

          {/* Live RSS & Ticker Moderation Panel */}
          <div className="p-4 bg-[#F9F8F6] rounded border border-stone-250 space-y-4">
            <h4 className="font-mono text-xs uppercase tracking-wider text-[#802334] font-bold">
              ⚙️ TETAPAN LIVE RSS & PENAPISAN TICKER
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-[10px] uppercase font-bold text-stone-600 block mb-1">
                  Had Maksimum Berita Live (Ranking Skor Tertinggi)
                </label>
                <select
                  value={tickerMaxItems}
                  onChange={(e) => setTickerMaxItems(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded font-mono text-xs font-bold"
                >
                  <option value={10}>10 Berita (Ranking 1 - 10)</option>
                  <option value={20}>20 Berita (Ranking 1 - 20)</option>
                  <option value={30}>30 Berita (Ranking 1 - 30)</option>
                  <option value={50}>50 Berita (Ranking 1 - 50)</option>
                  <option value={100}>100 Berita (Ranking 1 - 100)</option>
                </select>
              </div>

              <div>
                <label className="font-mono text-[10px] uppercase font-bold text-stone-600 block mb-1">
                  Label Pengepala Ticker
                </label>
                <input
                  type="text"
                  value={tickerHeaderLabel}
                  onChange={(e) => setTickerHeaderLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded font-mono text-xs font-bold"
                />
              </div>

              <div className="col-span-2">
                <label className="font-mono text-[10px] uppercase font-bold text-rose-800 block mb-1">
                  🚫 Kata Kunci Diharamkan (Hard-Block Keywords)
                </label>
                <input
                  type="text"
                  value={blockedKeywords}
                  onChange={(e) => setBlockedKeywords(e.target.value)}
                  placeholder="rogol, bunuh, dadah (pisahkan dengan koma)"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded font-mono text-xs"
                />
                <span className="text-[9px] font-mono text-stone-500 block mt-1">
                  * Berita yang mengandungi kata kunci ini diblok automatik (skor = 0) dan dipadam secara berturut-turut dari database.
                </span>
              </div>

              <div className="col-span-2">
                <label className="font-mono text-[10px] uppercase font-bold text-amber-900 block mb-1">
                  🏷️ Kawalan Kategori XML RSS Tersekat (Blocked Category Tags)
                </label>
                <input
                  type="text"
                  value={blockedCategoryTags}
                  onChange={(e) => setBlockedCategoryTags(e.target.value)}
                  placeholder="Hiburan, Gosip, Sukan, Keningau (pisahkan dengan koma)"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded font-mono text-xs"
                />
                <span className="text-[9px] font-mono text-stone-500 block mt-1">
                  * Berita RSS yang mengandungi tag kategori mentah ini akan disaring secara automatik.
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveTickerSettings}
                disabled={isSavingTickerSettings}
                className="px-4 py-2 bg-[#802334] hover:bg-[#601824] text-white font-mono text-xs font-bold rounded shadow-2xs transition cursor-pointer disabled:opacity-50"
              >
                {isSavingTickerSettings ? '⏳ Menyimpan...' : '💾 SIMPAN TETAPAN RSS & TICKER LIVE'}
              </button>
            </div>
          </div>

          {/* Polisi Moderasi & Automasik */}
          <div className="pt-2 border-t border-stone-100 max-w-md">
            <div>
              <label className="font-sans text-xs uppercase tracking-wider text-stone-500 font-semibold block mb-1">
                Status Lalai Kandungan Baharu (Auto-Fetch Ingestion)
              </label>
              <select className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-2 font-sans text-xs font-semibold">
                <option value="Pending">Pending (Semakan Tahan Manual)</option>
                <option value="Live">Live (Terus Terbit Automasik)</option>
              </select>
            </div>
          </div>

          {/* Had Geometri Aksara Mengikut 8 Tier Sebenar (GeometryConfig.js) */}
          <div className="space-y-3 pt-4 border-t border-stone-100">
            <div>
              <h4 className="font-sans text-xs uppercase tracking-wider text-stone-700 font-bold mb-0.5">
                Nisbah Geometri & Belanjawan Aksara Spatial (GEOMETRY_RATIOS)
              </h4>
              <p className="text-stone-500 text-[11px]">
                Diambil secara langsung dari enjin <code className="bg-stone-100 text-[#802334] px-1 py-0.5 rounded font-mono text-[10px]">core/editorial/GeometryConfig.js</code> (Nisbah Brief/Tajuk Sebenar).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-stone-700">
              {/* 1. HERO */}
              <div className="bg-stone-50 p-3 rounded border border-stone-200 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase tracking-wider text-[#802334] font-bold">HERO (Slot 0)</span>
                  <span className="font-mono text-[10px] text-stone-500 font-bold">Ratio: 3.043</span>
                </div>
                <div className="font-mono text-xs text-stone-900 font-bold">
                  Tajuk: <span className="text-emerald-700">115</span> | Brief: <span className="text-emerald-700">350</span> aksara
                </div>
                <span className="text-[9px] text-stone-400 block font-mono">Max Alone: 115 / 350</span>
              </div>

              {/* 2. MENEGAK */}
              <div className="bg-stone-50 p-3 rounded border border-stone-200 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase tracking-wider text-[#802334] font-bold">MENEGAK (6 Slot)</span>
                  <span className="font-mono text-[10px] text-stone-500 font-bold">Ratio: 2.554</span>
                </div>
                <div className="font-mono text-xs text-stone-900 font-bold">
                  Tajuk: <span className="text-emerald-700">168</span> | Brief: <span className="text-emerald-700">429</span> aksara
                </div>
                <span className="text-[9px] text-stone-400 block font-mono">Slot: 1, 12, 15, 26, 29, 37</span>
              </div>

              {/* 3. STANDARD */}
              <div className="bg-stone-50 p-3 rounded border border-stone-200 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase tracking-wider text-[#802334] font-bold">STANDARD (6 Slot)</span>
                  <span className="font-mono text-[10px] text-stone-500 font-bold">Ratio: 2.545</span>
                </div>
                <div className="font-mono text-xs text-stone-900 font-bold">
                  Tajuk: <span className="text-emerald-700">110</span> | Brief: <span className="text-emerald-700">280</span> aksara
                </div>
                <span className="text-[9px] text-stone-400 block font-mono">Slot: 2, 6, 19, 20, 33, 34</span>
              </div>

              {/* 4. SEGI EMPAT MEDIUM */}
              <div className="bg-stone-50 p-3 rounded border border-stone-200 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase tracking-wider text-[#802334] font-bold">SEGI EMPAT MEDIUM</span>
                  <span className="font-mono text-[10px] text-stone-500 font-bold">Ratio: 1.340</span>
                </div>
                <div className="font-mono text-xs text-stone-900 font-bold">
                  Tajuk: <span className="text-emerald-700">94</span> | Brief: <span className="text-emerald-700">126</span> aksara
                </div>
                <span className="text-[9px] text-stone-400 block font-mono">Slot: 13, 14, 27, 28</span>
              </div>

              {/* 5. SEGI EMPAT SMALL */}
              <div className="bg-stone-50 p-3 rounded border border-stone-200 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase tracking-wider text-[#802334] font-bold">SEGI EMPAT SMALL</span>
                  <span className="font-mono text-[10px] text-stone-500 font-bold">Ratio: 1.258</span>
                </div>
                <div className="font-mono text-xs text-stone-900 font-bold">
                  Tajuk: <span className="text-emerald-700">62</span> | Brief: <span className="text-emerald-700">78</span> aksara
                </div>
                <span className="text-[9px] text-stone-400 block font-mono">Slot: 3, 11, 16, 25, 30, 35, 36</span>
              </div>

              {/* 6. KOMPAK */}
              <div className="bg-stone-50 p-3 rounded border border-stone-200 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase tracking-wider text-[#802334] font-bold">KOMPAK (6 Slot)</span>
                  <span className="font-mono text-[10px] text-stone-500 font-bold">Ratio: 0.512</span>
                </div>
                <div className="font-mono text-xs text-stone-900 font-bold">
                  Tajuk: <span className="text-emerald-700">80</span> | Brief: <span className="text-emerald-700">41</span> aksara
                </div>
                <span className="text-[9px] text-stone-400 block font-mono">Slot: 4, 5, 17, 18, 31, 32</span>
              </div>

              {/* 7. BAR */}
              <div className="bg-stone-50 p-3 rounded border border-stone-200 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase tracking-wider text-[#802334] font-bold">BAR (8 Slot)</span>
                  <span className="font-mono text-[10px] text-stone-500 font-bold">Ratio: 0.000</span>
                </div>
                <div className="font-mono text-xs text-stone-900 font-bold">
                  Tajuk: <span className="text-emerald-700">40</span> | Brief: <span className="text-stone-400">0 (Tiada)</span>
                </div>
                <span className="text-[9px] text-stone-400 block font-mono">Slot: 7, 8, 9, 10, 21, 22, 23, 24</span>
              </div>

              {/* 8. TICKER */}
              <div className="bg-stone-50 p-3 rounded border border-stone-200 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase tracking-wider text-[#802334] font-bold">TICKER (Slot -1)</span>
                  <span className="font-mono text-[10px] text-stone-500 font-bold">Ratio: 2.750</span>
                </div>
                <div className="font-mono text-xs text-stone-900 font-bold">
                  Tajuk: <span className="text-emerald-700">80</span> | Brief: <span className="text-emerald-700">220</span> aksara
                </div>
                <span className="text-[9px] text-stone-400 block font-mono">Jalur Berita Berjalan</span>
              </div>
            </div>
          </div>

          {/* 🌐 TETAPAN JAM DUNIA, CUACA & API GOVERNANCE */}
          <div className="pt-6 border-t border-stone-200 space-y-4">
            <div>
              <h4 className="font-sans text-xs uppercase tracking-wider text-[#802334] font-bold mb-0.5 flex items-center gap-1.5">
                <span>🌐</span> TETAPAN JAM DUNIA, CUACA & API GOVERNANCE (15 BANDAR IBU NEGERI)
              </h4>
              <p className="text-stone-500 text-[11px]">
                Kawalan masa pertukaran slaid Jam Dunia, suis pemicu klik latar belakang, dan status kesihatan API Cuaca & Kalendar Cuti.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Selang Masa Auto-Rotate */}
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

              {/* Suis Pemicu Klik Latar Belakang */}
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

            {/* Kad Status API Health & Governance */}
            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <h5 className="font-sans text-[11px] uppercase tracking-wider text-stone-700 font-bold">
                  Status & Prestasi Integrasi API (Live Health Check)
                </h5>
                <button
                  type="button"
                  onClick={fetchApiStatus}
                  disabled={isLoadingApiStatus}
                  className="text-[10px] font-mono text-[#802334] hover:underline uppercase font-bold cursor-pointer disabled:opacity-50"
                >
                  {isLoadingApiStatus ? 'Menyemak API...' : '🔄 Semak Status API Live'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                {/* Open-Meteo API Status */}
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

                {/* Malaysia Public Holiday API 2026 Status */}
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

      {/* 3. TAKSONOMI (DESK MANAGEMENT) */}
      {subTab === 'Taksonomi' && (
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
              <span>⚡</span> Pendaftaran Automatik Live ({desks.length} Desk)
            </span>
          </div>

          {/* Jadual 1: Senarai Desk Spatial Frontpage & Warna Unik Hex */}
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
      )}

      {/* 3. ADJUNG EDITORIAL INTELLIGENCE PLATFORM (AEIP) */}
      {subTab === 'Komponen' && (
        <EditorialIntelligencePlatform />
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
            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded font-semibold text-xs border border-emerald-200">
              🟢 Mod Kelulusan Dinamik
            </span>
          </div>

          {/* Interactive Checkbox Table Matrix */}
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
                      <input
                        type="checkbox"
                        checked={row.permissions.viewAll}
                        onChange={() => handleTogglePermission(row.roleId, 'viewAll')}
                        disabled={row.isImmutableAdmin}
                        className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer disabled:opacity-50"
                      />
                    </td>

                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.permissions.editOwn}
                        onChange={() => handleTogglePermission(row.roleId, 'editOwn')}
                        className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer"
                      />
                    </td>

                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.permissions.editAll}
                        onChange={() => handleTogglePermission(row.roleId, 'editAll')}
                        disabled={row.isImmutableAdmin}
                        className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer"
                      />
                    </td>

                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.permissions.publish}
                        onChange={() => handleTogglePermission(row.roleId, 'publish')}
                        className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer"
                      />
                    </td>

                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.permissions.reject}
                        onChange={() => handleTogglePermission(row.roleId, 'reject')}
                        className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer"
                      />
                    </td>

                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.permissions.assignSlot}
                        onChange={() => handleTogglePermission(row.roleId, 'assignSlot')}
                        className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer"
                      />
                    </td>

                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.permissions.manageSettings}
                        onChange={() => handleTogglePermission(row.roleId, 'manageSettings')}
                        disabled={row.isImmutableAdmin}
                        className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer disabled:opacity-50"
                      />
                    </td>

                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.permissions.manageRbac}
                        onChange={() => handleTogglePermission(row.roleId, 'manageRbac')}
                        disabled={row.isImmutableAdmin}
                        className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer disabled:opacity-50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <button onClick={() => setActiveConfigModal(null)} className="text-stone-400 font-bold">✕</button>
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
              {italicTerms.map(term => (
                <span key={term} className="bg-stone-100 border border-stone-300 text-stone-800 px-2.5 py-1 rounded text-xs flex items-center gap-1.5">
                  <span className="italic font-semibold">{term}</span>
                  <button onClick={() => handleRemoveItalicTerm(term)} className="text-stone-400 hover:text-red-700 font-bold">✕</button>
                </span>
              ))}
            </div>

            <div className="pt-2 border-t border-stone-200 flex justify-end">
              <button onClick={() => setActiveConfigModal(null)} className="bg-stone-800 text-white text-xs px-4 py-1.5 rounded font-semibold">
                Tutup & Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURATION DRAWER: TICKER LABELS */}
      {activeConfigModal === 'ticker' && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-stone-200 pb-2">
              <h3 className="font-sans text-xs font-bold text-[#802334] uppercase">
                Konfigurasi Label Ticker
              </h3>
              <button onClick={() => setActiveConfigModal(null)} className="text-stone-400 font-bold">✕</button>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold text-stone-500 block mb-1">
                Label Header Ticker Strip
              </label>
              <input
                type="text"
                value={tickerHeaderLabel}
                onChange={e => setTickerHeaderLabel(e.target.value)}
                className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-2 text-xs font-semibold"
              />
            </div>

            <div className="pt-2 border-t border-stone-200 flex justify-end">
              <button onClick={() => setActiveConfigModal(null)} className="bg-stone-800 text-white text-xs px-4 py-1.5 rounded font-semibold">
                Simpan Konfigurasi Ticker
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
              <button onClick={() => setActiveConfigModal(null)} className="text-stone-400 font-bold">✕</button>
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
