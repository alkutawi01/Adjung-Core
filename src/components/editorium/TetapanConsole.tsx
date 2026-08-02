import React, { useState, useEffect } from 'react';
import {
  Lock, Newspaper, X, AlertTriangle, Save, RefreshCw, Check, Hourglass, Globe
} from 'lucide-react';
import { SEMUA_LABEL_LALAI, labelUi } from '../../config/istilah';
import { muatPindaanLabel } from '../../config/labelOverrides';


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
    // 2026-08-02 (Fasa 3) — tiga kunci baharu, disahkan sebagai sumber kebenaran SEBENAR
    // (bukan hiasan lagi — lihat requirePermission() di core/middleware/auth.js). Sepadan
    // EXACT dengan DEFAULT_ROLE_PERMISSIONS di core/middleware/auth.js; ubah satu, ubah dua-dua.
    manageEditorial: boolean; // Bidang, Editorial (tipografi/glosari), RSS admin, Jam Dunia admin
    manageAccounts: boolean;  // Direktori — urus akaun/status/peranan editor lain
    manageEditorNotes: boolean; // Nota Ketua Editor (tulis) — Ketua Editor sahaja secara lalai
  };
}

// Empat peranan (2026-07-29, permintaan pemilik projek): Pentadbir, Ketua Editor, Penolong Ketua
// Editor, Editor — turutan ni juga ROLE_ORDER di bawah (susunan paparan jadual).
//
// 2026-08-02 — disahkan Izzat sebagai sumber kebenaran SEBENAR (bukan hiasan): Pentadbir =
// teknikal sahaja (tetapan sistem, Direktori/akaun, Kawalan Akses) BUKAN editorial; Ketua Editor
// & Penolong/Timbalan Ketua Editor kongsi kuasa editorial PENUH kecuali Nota Ketua Editor
// (Ketua Editor sahaja) dan urus akaun (Pentadbir sahaja); SATU akaun (cth Izzat) boleh pegang
// BERBILANG peranan serentak — lihat jadual user_roles di server.js.
const DEFAULT_RBAC_MATRIX: RbacMatrixRow[] = [
  {
    roleId: 'pentadbir',
    roleName: 'Pentadbir',
    isImmutableAdmin: false,
    permissions: {
      viewAll: true, editOwn: false, editAll: false, publish: false,
      reject: false, assignSlot: false, manageSettings: true, manageRbac: true,
      manageEditorial: false, manageAccounts: true, manageEditorNotes: false
    }
  },
  {
    roleId: 'ketua_editor',
    roleName: 'Ketua Editor',
    isImmutableAdmin: true,
    permissions: {
      viewAll: true, editOwn: true, editAll: true, publish: true,
      reject: true, assignSlot: true, manageSettings: false, manageRbac: false,
      manageEditorial: true, manageAccounts: false, manageEditorNotes: true
    }
  },
  {
    roleId: 'penolong_ketua_editor',
    roleName: 'Penolong Ketua Editor',
    isImmutableAdmin: false,
    permissions: {
      viewAll: true, editOwn: true, editAll: true, publish: true,
      reject: true, assignSlot: true, manageSettings: false, manageRbac: false,
      manageEditorial: true, manageAccounts: false, manageEditorNotes: false
    }
  },
  {
    roleId: 'editor',
    roleName: 'Editor',
    isImmutableAdmin: false,
    permissions: {
      viewAll: true, editOwn: true, editAll: false, publish: true,
      reject: false, assignSlot: false, manageSettings: false, manageRbac: false,
      manageEditorial: false, manageAccounts: false, manageEditorNotes: false
    }
  }
];

interface TetapanConsoleProps {
  // 2026-08-02 (Fasa 3) — Tetapan Sistem domain Pentadbir sahaja (dahulu currentUserRole
  // 'KETUA_EDITOR', tapi Ketua Editor tak automatik dapat akses ni lagi kecuali dia turut
  // dilantik Pentadbir — lihat EditoriumView.tsx pemanggil komponen ni).
  isPentadbir?: boolean;
  // Mendarat terus pada sub-tab tertentu (2026-08-02, Fasa 7) — cth pautan "Jam Dunia" di
  // kad Modul Khas, yang tetapannya sebenar hidup di sini (sub-tab Operasi), bukan tempat
  // berasingan. Kosong = lalai PolisiKandungan seperti biasa.
  initialSubTab?: 'PolisiKandungan' | 'HalamanAwam' | 'Operasi' | 'RBAC' | 'LabelSistem';
}

export const TetapanConsole: React.FC<TetapanConsoleProps> = ({
  isPentadbir = true, initialSubTab
}) => {
  const [subTab, setSubTab] = useState<'PolisiKandungan' | 'HalamanAwam' | 'Operasi' | 'RBAC' | 'LabelSistem'>(initialSubTab || 'PolisiKandungan');

  // Governance Jam Dunia (World Clock) — these were previously local-only state with no
  // backing DB columns at all (WorldClockStrip.tsx has read systemSettings.worldClockIntervalSec
  // / worldClockBgClickEnabled from day one, but nothing ever wrote them). Now backed by real
  // columns on system_settings.
  const [worldClockIntervalSec, setWorldClockIntervalSec] = useState<number>(60);
  const [worldClockBgClickEnabled, setWorldClockBgClickEnabled] = useState<boolean>(true);
  const [savingWorldClock, setSavingWorldClock] = useState(false);
  const [worldClockSaveError, setWorldClockSaveError] = useState<string | null>(null);

  // Cuti sekolah (2026-08-02, Fasa 7) — sebelum ni berkod keras di worldClockRoutes.js, tarikh
  // 2026/27 sahaja, akan basi senyap lepas tu. Dimuat daripada laluan EFEKTIF sebenar
  // (GET /clock-holidays, yang sendiri jatuh balik ke lalai berkod keras kalau DB kosong) —
  // BUKAN terus daripada systemSettings.schoolHolidaysJson — supaya borang ni sentiasa papar
  // apa yang Jam Dunia SEBENARNYA guna sekarang, bukan cuma apa yang tersimpan.
  const [schoolHolidays, setSchoolHolidays] = useState<{ start: string; end: string; group: string; name: string }[]>([]);

  // Glos Selari (2026-08-02, Fasa 6) — dahulu checkbox hiasan tanpa kesan. Ciri anotasi
  // interlinear (`[kata](gloss:makna)`, utils.tsx parseInlineFormatting) SUDAH aktif tanpa
  // syarat pada setiap tajuk/huraian kad — togol ni kini benar-benar kawal ia (FrontpageView.tsx
  // semak glosSelariEnabled sebelum membenarkan sintaks gloss; jika dimatikan, sintaks dipapar
  // sebagai label biasa sahaja, anotasi diabaikan).
  const [glosSelariEnabled, setGlosSelariEnabled] = useState<boolean>(false);
  const [savingGlosSelari, setSavingGlosSelari] = useState(false);
  const [glosSelariSaveError, setGlosSelariSaveError] = useState<string | null>(null);

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

  const handleToggleGlosSelari = async () => {
    const next = !glosSelariEnabled;
    setGlosSelariEnabled(next);
    setSavingGlosSelari(true);
    setGlosSelariSaveError(null);
    try {
      await saveSystemSettingsPatch({ glosSelariEnabled: next });
    } catch (e: any) {
      setGlosSelariEnabled(!next);
      setGlosSelariSaveError(e.message || 'Gagal menyimpan tetapan Glos Selari.');
    } finally {
      setSavingGlosSelari(false);
    }
  };

  const handleSaveWorldClockSettings = async () => {
    setSavingWorldClock(true);
    setWorldClockSaveError(null);
    const cutiSah = schoolHolidays.filter((c) => c.start.trim() && c.end.trim() && c.name.trim());
    if (cutiSah.length !== schoolHolidays.length) {
      setWorldClockSaveError('Setiap baris cuti sekolah mesti ada Tarikh Mula, Tarikh Tamat, dan Nama diisi (baris kosong dibuang).');
      setSavingWorldClock(false);
      return;
    }
    try {
      await saveSystemSettingsPatch({
        worldClockIntervalSec,
        worldClockBgClickEnabled,
        schoolHolidaysJson: JSON.stringify(cutiSah)
      });
      setSchoolHolidays(cutiSah);
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
        if (s.glosSelariEnabled !== undefined) setGlosSelariEnabled(!!s.glosSelariEnabled);
        fetch('/api/system/clock-holidays')
          .then(r => r.json())
          .then(d => { if (Array.isArray(d.schoolHolidays)) setSchoolHolidays(d.schoolHolidays); })
          .catch(() => {});
        if (s.rolePermissions && Array.isArray(s.rolePermissions) && s.rolePermissions.length > 0) {
          // Gabung (bukan ganti terus, 2026-07-29) — matriks tersimpan di DB mungkin masih 2 baris
          // lama (dari sebelum Pentadbir/Penolong Ketua Editor wujud). Baris baharu dalam
          // DEFAULT_RBAC_MATRIX yang roleId-nya belum ada dalam simpanan ditambah, bukan hilang
          // senyap kerana simpanan lama "menang" wholesale. Disusun ikut ROLE_ORDER supaya jadual
          // sentiasa papar turutan sama tak kira campuran simpanan lama/baharu.
          //
          // 2026-08-02 (Fasa 3) — pepijat sebenar ditemui semasa ujian: baris SEDIA ADA (cth
          // ketua_editor) boleh juga tiada KUNCI baharu (manageEditorial/manageAccounts/
          // manageEditorNotes, ditambah selepas matriks lama disimpan kali terakhir), bukan
          // sekadar BARIS peranan yang hilang. Gabung KUNCI di dalam setiap baris juga — kalau
          // tidak checkbox baharu papar tak bertanda walaupun server anggap lalainya true.
          const byId = new Map(s.rolePermissions.map((r: RbacMatrixRow) => [r.roleId, r]));
          const merged = DEFAULT_RBAC_MATRIX.map(defRow => {
            const saved = byId.get(defRow.roleId) as RbacMatrixRow | undefined;
            if (!saved) return defRow;
            return { ...saved, permissions: { ...defRow.permissions, ...saved.permissions } };
          });
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
        // Kunci keselamatan: Ketua Editor tak boleh nyahtanda kuasa EDITORIAL teras sendiri
        // (2026-08-02, disemak semula — manageSettings/manageRbac BUKAN lagi domain Ketua Editor
        // secara lalai, itu Pentadbir; kunci "tak boleh dibuang" yang bermakna sekarang ialah
        // kuasa editorial supaya Ketua Editor tak sesekali terkunci keluar daripada kerja
        // editorial sendiri melalui klik tersilap).
        if (row.isImmutableAdmin && (permKey === 'viewAll' || permKey === 'editAll' || permKey === 'publish' || permKey === 'reject')) {
          alert('Ketua Editor tidak dibenarkan menarik semula kuasa editorial teras daripada akaun sendiri.');
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

  if (!isPentadbir) {
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
            onClick={() => setSubTab('HalamanAwam')}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'HalamanAwam' ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            2. Halaman Awam
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
            onClick={() => setSubTab('RBAC')}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'RBAC' ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            4. Kawalan Akses
          </button>

          <button
            onClick={() => setSubTab('LabelSistem')}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'LabelSistem' ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            5. Label Sistem
          </button>
        </div>
      </div>

      {/* 5. LABEL SISTEM (2026-08-02, Fasa 6 "Editor label & tooltip") — kamus label boleh
          sunting: MOD_KANDUNGAN_LABEL/STATUS_LABEL/MESEJ_SISTEM_LABEL di src/config/istilah.ts,
          disimpan di jadual `ui_labels` (core/routes/uiLabelRoutes.js). */}
      {subTab === 'LabelSistem' && <LabelSistemPanel />}

      {/* 2. HALAMAN AWAM (2026-08-02, Fasa 6) — ruang edit kandungan Tentang/Hubungi/Polisi
          disediakan SEKARANG (Izzat: "sedia ruang edit sekarang"), papar di frontpage bila
          halaman awam sendiri dibina (Fasa 11). Guna static_pages sedia ada
          (GET/POST /api/pages/:key, systemRoutes.js). */}
      {subTab === 'HalamanAwam' && <HalamanAwamPanel />}

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
                <label className="flex items-center gap-2 font-semibold text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={glosSelariEnabled}
                    onChange={handleToggleGlosSelari}
                    disabled={savingGlosSelari}
                    className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer disabled:opacity-50"
                  />
                  <span>Glos Selari (Anotasi Interlinear Dwibahasa / Arab-Melayu)</span>
                </label>
                <p className="text-stone-500 text-xs">
                  Benarkan editor guna sintaks <code className="bg-stone-100 px-1 rounded">[kata](gloss:makna)</code> dalam
                  tajuk/huraian — makna terpapar sebagai anotasi kecil di atas kata pada frontpage. Dimatikan lalai;
                  sintaks yang wujud dipapar sebagai teks biasa (anotasi diabaikan) selagi togol ni tak dihidupkan.
                </p>
                {glosSelariSaveError && <p className="text-red-700 text-xs">{glosSelariSaveError}</p>}
              </div>
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

            {/* Cuti Sekolah (2026-08-02, Fasa 7) — sebelum ni berkod keras, tarikh 2026/27
                sahaja, akan basi senyap lepas tempoh tu. Kini boleh sunting terus di sini. */}
            <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="font-sans text-xs uppercase tracking-wider text-stone-700 font-bold block">
                  Tempoh Cuti Sekolah
                </label>
                <button
                  type="button"
                  onClick={() => setSchoolHolidays((p) => [...p, { start: '', end: '', group: 'A', name: '' }])}
                  className="px-2.5 py-1 border border-stone-300 rounded text-[10px] font-sans font-semibold text-stone-600 hover:bg-white cursor-pointer"
                >
                  + Tambah Tempoh
                </button>
              </div>
              <span className="text-[10px] text-stone-400 block -mt-1.5">
                Kumpulan A/B ialah pembahagian rasmi Kementerian Pendidikan (negeri berlainan cuti pada tarikh sedikit berbeza). Senarai kosong = Jam Dunia tidak papar cuti sekolah langsung.
              </span>
              {schoolHolidays.length === 0 && (
                <p className="text-stone-400 italic text-[11px] py-2">Tiada tempoh cuti sekolah ditetapkan.</p>
              )}
              <div className="space-y-2">
                {schoolHolidays.map((cuti, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_70px_1.4fr_auto] gap-2 items-center">
                    <input
                      type="date" value={cuti.start}
                      onChange={(e) => setSchoolHolidays((p) => p.map((c, n) => n === i ? { ...c, start: e.target.value } : c))}
                      className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 font-mono text-[11px] focus:outline-none focus:border-[#802334]"
                    />
                    <input
                      type="date" value={cuti.end}
                      onChange={(e) => setSchoolHolidays((p) => p.map((c, n) => n === i ? { ...c, end: e.target.value } : c))}
                      className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 font-mono text-[11px] focus:outline-none focus:border-[#802334]"
                    />
                    <select
                      value={cuti.group}
                      onChange={(e) => setSchoolHolidays((p) => p.map((c, n) => n === i ? { ...c, group: e.target.value } : c))}
                      className="w-full bg-white border border-stone-300 rounded px-1.5 py-1.5 font-mono text-[11px] focus:outline-none focus:border-[#802334]"
                    >
                      <option value="A">Kump. A</option>
                      <option value="B">Kump. B</option>
                    </select>
                    <input
                      type="text" value={cuti.name} placeholder="Nama cuti (cth. Cuti Penggal 1 Sekolah)"
                      onChange={(e) => setSchoolHolidays((p) => p.map((c, n) => n === i ? { ...c, name: e.target.value } : c))}
                      className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 font-sans text-[11px] focus:outline-none focus:border-[#802334]"
                    />
                    <button
                      type="button"
                      onClick={() => setSchoolHolidays((p) => p.filter((_, n) => n !== i))}
                      className="text-stone-400 hover:text-red-700 cursor-pointer p-1"
                      title="Buang tempoh ini"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
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
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-emerald-900">
            {/* 2026-08-02 (Fasa 3) — matriks ni kini SUMBER KEBENARAN SEBENAR (bukan hiasan lagi).
                Setiap laluan API tulis semak matriks ni secara langsung (requirePermission,
                core/middleware/auth.js), disegarkan serta-merta selepas simpan — tiada perlu
                mulakan semula server. Menanda/menyahtanda kebenaran DI BAWAH mengubah apa
                setiap peranan BENAR-BENAR boleh buat, serta-merta selepas "Simpan Kawalan Akses". */}
            Matriks ni <strong>sumber kebenaran sebenar</strong> — setiap laluan API tulis semak
            terus daripada sini, berkuat kuasa serta-merta selepas disimpan. Berhati-hati menanda/
            menyahtanda: kesannya nyata pada apa setiap peranan boleh buat.
          </div>
          <div className="flex flex-wrap justify-between items-center border-b border-stone-200 pb-3 gap-2">
            <div>
              <h3 className="font-sans text-xs font-bold text-[#802334] uppercase tracking-wider">
                KAWALAN AKSES — MATRIKS KEBENARAN PERANAN
              </h3>
              <p className="text-stone-500 text-xs mt-0.5">
                Pentadbir boleh menanda atau membatalkan kebenaran peranan mengikut keperluan tadbir urus sistem. Perubahan berkuat kuasa serta-merta selepas disimpan.
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
                  <th className="p-3 text-center">Siar</th>
                  <th className="p-3 text-center">Tolak</th>
                  <th className="p-3 text-center">Agihan Slot</th>
                  <th className="p-3 text-center">Bidang & Editorial</th>
                  <th className="p-3 text-center">Nota Ketua Editor</th>
                  <th className="p-3 text-center">Direktori & Akaun</th>
                  <th className="p-3 text-center">Polisi & Tetapan</th>
                  <th className="p-3 text-center">Tadbir RBAC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-sans">
                {rbacMatrix.map(row => {
                  const kunciEditorial = row.isImmutableAdmin;
                  return (
                  <tr key={row.roleId} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3 font-bold text-stone-900 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${row.roleId === 'ketua_editor' ? 'bg-[#802334]' : 'bg-stone-500'}`} />
                      <span>{row.roleName}</span>
                    </td>

                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.viewAll} onChange={() => handleTogglePermission(row.roleId, 'viewAll')} disabled={kunciEditorial} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer disabled:opacity-50" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.editOwn} onChange={() => handleTogglePermission(row.roleId, 'editOwn')} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.editAll} onChange={() => handleTogglePermission(row.roleId, 'editAll')} disabled={kunciEditorial} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer disabled:opacity-50" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.publish} onChange={() => handleTogglePermission(row.roleId, 'publish')} disabled={kunciEditorial} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer disabled:opacity-50" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.reject} onChange={() => handleTogglePermission(row.roleId, 'reject')} disabled={kunciEditorial} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer disabled:opacity-50" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.assignSlot} onChange={() => handleTogglePermission(row.roleId, 'assignSlot')} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.manageEditorial} onChange={() => handleTogglePermission(row.roleId, 'manageEditorial')} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.manageEditorNotes} onChange={() => handleTogglePermission(row.roleId, 'manageEditorNotes')} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.manageAccounts} onChange={() => handleTogglePermission(row.roleId, 'manageAccounts')} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.manageSettings} onChange={() => handleTogglePermission(row.roleId, 'manageSettings')} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.manageRbac} onChange={() => handleTogglePermission(row.roleId, 'manageRbac')} className="rounded border-stone-300 text-[#802334] w-4 h-4 cursor-pointer" />
                    </td>
                  </tr>
                  );
                })}
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

// Halaman Awam (2026-08-02, Fasa 6) — ruang edit Tentang/Hubungi/Polisi & Penafian. Guna
// static_pages sedia ada (GET/POST /api/pages/:key). Sengaja TIDAK papar apa-apa halaman awam
// sebenar di sini — itu Fasa 11; ini cuma tempat isi kandungan supaya tak tertangguh sepenuhnya.
const HALAMAN_AWAM_SENARAI: { key: string; label: string }[] = [
  { key: 'tentang', label: 'Tentang' },
  { key: 'hubungi', label: 'Hubungi' },
  { key: 'polisi-penafian', label: 'Polisi & Penafian' },
];

function HalamanAwamPanel() {
  const [halamanAktif, setHalamanAktif] = useState(HALAMAN_AWAM_SENARAI[0].key);
  const [tajuk, setTajuk] = useState('');
  const [kandungan, setKandungan] = useState('');
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState('');
  const [mesej, setMesej] = useState('');

  useEffect(() => {
    setMemuat(true);
    setRalat('');
    fetch(`/api/pages/${halamanAktif}`)
      .then(async (r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('Gagal memuatkan halaman.');
        return r.json();
      })
      .then((data) => {
        setTajuk(data?.title || HALAMAN_AWAM_SENARAI.find(h => h.key === halamanAktif)?.label || '');
        setKandungan(data?.content || '');
      })
      .catch((e) => setRalat(e.message || 'Gagal memuatkan halaman.'))
      .finally(() => setMemuat(false));
  }, [halamanAktif]);

  const simpan = async () => {
    setMenyimpan(true);
    setRalat('');
    try {
      const res = await fetch(`/api/pages/${halamanAktif}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: tajuk, content: kandungan }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Gagal menyimpan halaman.');
      }
      setMesej(labelUi('toast.tetapan_disimpan'));
      setTimeout(() => setMesej(''), 2000);
    } catch (e: any) {
      setRalat(e.message || 'Gagal menyimpan halaman.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
      <div>
        <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
          Kandungan Halaman Awam
        </h3>
        <p className="text-stone-500 text-xs mt-1">
          Ruang isi kandungan sahaja — halaman awam sebenar (URL, reka bentuk, pautan footer) belum
          dibina (Fasa 11). Kandungan yang disimpan di sini akan dipaparkan bila halaman tu siap.
        </p>
      </div>

      <div className="flex gap-1.5 border-b border-stone-200 pb-2">
        {HALAMAN_AWAM_SENARAI.map(h => (
          <button
            key={h.key}
            onClick={() => setHalamanAktif(h.key)}
            className={`px-3 py-1.5 rounded font-semibold text-xs transition-colors ${
              halamanAktif === h.key ? 'bg-[#802334] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {h.label}
          </button>
        ))}
      </div>

      {memuat ? (
        <p className="text-stone-400">Memuatkan...</p>
      ) : (
        <div className="space-y-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Tajuk Halaman</span>
            <input
              type="text"
              value={tajuk}
              onChange={(e) => setTajuk(e.target.value)}
              className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs font-sans"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Kandungan</span>
            <textarea
              value={kandungan}
              onChange={(e) => setKandungan(e.target.value)}
              rows={10}
              className="bg-stone-50 border border-stone-300 rounded px-3 py-2 text-xs font-sans resize-y"
              placeholder="Taip kandungan halaman di sini..."
            />
          </label>

          {ralat && <p className="text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 text-[11px]">{ralat}</p>}

          <div className="flex items-center justify-end gap-3">
            {mesej && <span className="text-emerald-700 text-[11px] font-semibold">{mesej}</span>}
            <button
              onClick={simpan}
              disabled={menyimpan || !tajuk.trim()}
              className="bg-[#802334] hover:bg-[#601824] text-white px-4 py-1.5 rounded font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {menyimpan ? 'Menyimpan...' : 'Simpan Halaman'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Panel Label Sistem (2026-08-02, Fasa 6 "Editor label & tooltip") — kamus label terkurasi
// (Mod Kandungan/Status/Mesej Sistem, src/config/istilah.ts) boleh disunting di sini. Simpan
// terus ke jadual `ui_labels` (POST /api/system/ui-labels), "Set semula" pulangkan SATU kunci
// kepada nilai lalai (POST /api/system/ui-labels/reset). Selepas simpan/set semula, panggil
// muatPindaanLabel() supaya label di seluruh Editorium/frontpage bertukar serta-merta tanpa
// muat semula halaman.
function LabelSistemPanel() {
  const [nilaiSemasa, setNilaiSemasa] = useState<Record<string, string>>({});
  const [suntingan, setSuntingan] = useState<Record<string, string>>({});
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState('');
  const [mesej, setMesej] = useState('');

  const muatSemula = () => {
    setMemuat(true);
    setRalat('');
    fetch('/api/system/ui-labels')
      .then(async (r) => {
        if (!r.ok) throw new Error('Gagal memuatkan kamus label.');
        return r.json();
      })
      .then((data) => setNilaiSemasa(data && typeof data === 'object' ? data : {}))
      .catch((e) => setRalat(e.message || 'Gagal memuatkan kamus label.'))
      .finally(() => setMemuat(false));
  };

  useEffect(() => { muatSemula(); }, []);

  const nilaiPapar = (kunci: string, lalai: string) => suntingan[kunci] ?? nilaiSemasa[kunci] ?? lalai;

  const simpanSemua = async () => {
    if (Object.keys(suntingan).length === 0) return;
    setMenyimpan(true);
    setRalat('');
    try {
      const res = await fetch('/api/system/ui-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suntingan),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Gagal menyimpan label.');
      }
      setSuntingan({});
      muatSemula();
      await muatPindaanLabel();
      setMesej(labelUi('toast.tetapan_disimpan'));
      setTimeout(() => setMesej(''), 2000);
    } catch (e: any) {
      setRalat(e.message || 'Gagal menyimpan label.');
    } finally {
      setMenyimpan(false);
    }
  };

  const setSemula = async (kunci: string, lalai: string, kategori: string) => {
    setMenyimpan(true);
    setRalat('');
    try {
      const res = await fetch('/api/system/ui-labels/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: kunci, lalai, kategori }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Gagal mengembalikan nilai lalai.');
      }
      setSuntingan((prev) => {
        const salinan = { ...prev };
        delete salinan[kunci];
        return salinan;
      });
      muatSemula();
      await muatPindaanLabel();
    } catch (e: any) {
      setRalat(e.message || 'Gagal mengembalikan nilai lalai.');
    } finally {
      setMenyimpan(false);
    }
  };

  const kumpulan = SEMUA_LABEL_LALAI.reduce<Record<string, typeof SEMUA_LABEL_LALAI>>((acc, item) => {
    (acc[item.kategori] ||= []).push(item);
    return acc;
  }, {});

  const adaSuntingan = Object.keys(suntingan).length > 0;

  return (
    <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-6 text-xs">
      <div>
        <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
          Kamus Label Sistem
        </h3>
        <p className="text-stone-500 text-xs mt-1">
          Perkataan yang dipaparkan kepada editor (label Mod Kandungan, Status, dan mesej ringkas
          simpan/terbit). Menyunting di sini TIDAK mengubah apa yang disimpan dalam pangkalan
          data — cuma perkataan yang dipaparkan. Guna "Set semula" untuk kembalikan satu label
          kepada perkataan asal.
        </p>
      </div>

      {ralat && <p className="text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 text-[11px]">{ralat}</p>}

      {memuat ? (
        <p className="text-stone-400">Memuatkan...</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(kumpulan).map(([kategori, senarai]) => (
            <div key={kategori} className="space-y-2">
              <h4 className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500 border-b border-stone-200 pb-1">
                {kategori}
              </h4>
              <div className="space-y-2">
                {senarai.map((item) => {
                  const semasa = nilaiPapar(item.kunci, item.lalai);
                  const dipinda = semasa !== item.lalai;
                  return (
                    <div key={item.kunci} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={semasa}
                        onChange={(e) => setSuntingan((prev) => ({ ...prev, [item.kunci]: e.target.value }))}
                        className="flex-1 bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs font-sans"
                      />
                      {dipinda && (
                        <button
                          onClick={() => setSemula(item.kunci, item.lalai, kategori)}
                          disabled={menyimpan}
                          className="shrink-0 text-stone-500 hover:text-[#802334] font-semibold text-[11px] px-2 py-1.5 rounded border border-stone-300 hover:border-[#802334] transition-colors disabled:opacity-50 cursor-pointer"
                          title={`Nilai asal: ${item.lalai}`}
                        >
                          Set semula
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-end gap-3 border-t border-stone-200 pt-4">
            {mesej && <span className="text-emerald-700 text-[11px] font-semibold">{mesej}</span>}
            <button
              onClick={simpanSemua}
              disabled={menyimpan || !adaSuntingan}
              className="bg-[#802334] hover:bg-[#601824] text-white px-4 py-1.5 rounded font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {menyimpan ? 'Menyimpan...' : 'Simpan Label'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TetapanConsole;
