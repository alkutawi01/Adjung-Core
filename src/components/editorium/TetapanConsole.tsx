import React, { useState, useEffect } from 'react';
import {
  Lock, Construction, Newspaper, X, AlertTriangle, Save, RefreshCw, Check, Hourglass, Globe
} from 'lucide-react';


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

// Empat peranan (2026-07-29, permintaan pemilik projek): Pentadbir, Ketua Editor, Penolong Ketua
// Editor, Editor — turutan ni juga ROLE_ORDER di bawah (susunan paparan jadual). Pentadbir dan
// Penolong Ketua Editor BAHARU ditambah dengan SEMUA kebenaran tak ditanda (isImmutableAdmin:
// false, permissions semua false) — pemilik projek akan tanda sendiri akses yang dibenarkan bagi
// kedua-dua peranan ni, jadi sengaja tiada andaian dibuat di sini tentang apa mereka patut boleh
// buat.
const ROLE_ORDER = ['pentadbir', 'ketua_editor', 'penolong_ketua_editor', 'editor'];
const DEFAULT_RBAC_MATRIX: RbacMatrixRow[] = [
  {
    roleId: 'pentadbir',
    roleName: 'Pentadbir',
    isImmutableAdmin: false,
    permissions: {
      viewAll: false, editOwn: false, editAll: false, publish: false,
      reject: false, assignSlot: false, manageSettings: false, manageRbac: false
    }
  },
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
    roleId: 'penolong_ketua_editor',
    roleName: 'Penolong Ketua Editor',
    isImmutableAdmin: false,
    permissions: {
      viewAll: false, editOwn: false, editAll: false, publish: false,
      reject: false, assignSlot: false, manageSettings: false, manageRbac: false
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
  const [subTab, setSubTab] = useState<'PolisiKandungan' | 'Operasi' | 'RBAC'>('PolisiKandungan');

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
    fetchBlockedCategories();

    fetch('/api/db-state')
      .then(res => res.json())
      .then(data => {
        const s = data.systemSettings || {};
        if (s.worldClockIntervalSec !== undefined) setWorldClockIntervalSec(Number(s.worldClockIntervalSec));
        if (s.worldClockBgClickEnabled !== undefined) setWorldClockBgClickEnabled(!!s.worldClockBgClickEnabled);
        if (s.rolePermissions && Array.isArray(s.rolePermissions) && s.rolePermissions.length > 0) {
          // Gabung (bukan ganti terus, 2026-07-29) — matriks tersimpan di DB mungkin masih 2 baris
          // lama (dari sebelum Pentadbir/Penolong Ketua Editor wujud). Baris baharu dalam
          // DEFAULT_RBAC_MATRIX yang roleId-nya belum ada dalam simpanan ditambah, bukan hilang
          // senyap kerana simpanan lama "menang" wholesale. Disusun ikut ROLE_ORDER supaya jadual
          // sentiasa papar turutan sama tak kira campuran simpanan lama/baharu.
          const savedIds = new Set(s.rolePermissions.map((r: RbacMatrixRow) => r.roleId));
          const merged = [
            ...s.rolePermissions,
            ...DEFAULT_RBAC_MATRIX.filter(r => !savedIds.has(r.roleId)),
          ].sort((a, b) => ROLE_ORDER.indexOf(a.roleId) - ROLE_ORDER.indexOf(b.roleId));
          setRbacMatrix(merged);
        }
      })
      .catch(e => console.error('Error fetching system settings:', e));

  }, []);


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
            onClick={() => setSubTab('Operasi')}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'Operasi' ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            2. Operasi & Governance
          </button>

          <button
            onClick={() => setSubTab('RBAC')}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'RBAC' ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            3. Kawalan Akses
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
            {/* Autocondong Istilah Asing & Pinjaman (2026-08-01) — DIPINDAHKAN ke Pentadbiran →
                Editorial → Autocondong, sebahagian daripada spesifikasi konsol Editorial pemilik
                projek. Bukan dibuang; jangan cipta semula di sini. */}
            <div className="pt-3 flex flex-wrap justify-between items-center gap-3">
              <div className="space-y-1">
                <label className="flex items-center gap-2 font-semibold text-stone-400 cursor-not-allowed">
                  <input type="checkbox" disabled className="rounded border-stone-300" />
                  <span>Glos Selari (Teks Dwibahasa / Arab-Melayu)</span>
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
      {/* 2. OPERASI & GOVERNANCE */}
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

      {/* 4. INTERACTIVE RBAC PERMISSION TABLE MATRIX */}
      {subTab === 'RBAC' && (
        <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-900">
            <AlertTriangle className="inline w-3.5 h-3.5 -mt-0.5 mr-1" /> Matriks ni disimpan betul-betul ke pangkalan data, tapi <strong>belum dikuatkuasakan</strong> di mana-mana bahagian sistem sebenar — semua semakan akses semasa (Indeks, Direktori, Tetapan sendiri) terus banding peranan dengan Ketua Editor secara tegar dalam kod, tanpa rujuk jadual ni langsung. Menanda/menyahtanda kebenaran di bawah <strong>tiada kesan</strong> pada apa yang seseorang benar-benar boleh buat buat masa ini.
          </div>
          <div className="flex flex-wrap justify-between items-center border-b border-stone-200 pb-3 gap-2">
            <div>
              <h3 className="font-sans text-xs font-bold text-[#802334] uppercase tracking-wider">
                KAWALAN AKSES — MATRIKS KEBENARAN PERANAN
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
              {savingRbac ? <><Hourglass className="w-3.5 h-3.5" /> Menyimpan...</> : rbacDirty ? <><Save className="w-3.5 h-3.5" /> Simpan Kawalan Akses</> : <><Check className="w-3.5 h-3.5" /> Tersimpan</>}
            </button>
          </div>
        </div>
      )}

      {/* MODAL PEMILIH IKON BIDANG */}
    </div>
  );
};

export default TetapanConsole;
