import React, { useState, useEffect, useRef, useMemo } from 'react';
import { bacaJsonSelamat } from '../../utils/bacaJson';
import { statusLuputCutiSekolah } from '../../../core/utils/kitaranCutiSekolah.js';
import {
  Lock, Newspaper, X, AlertTriangle, Save, RefreshCw, Check, Hourglass, Globe
} from 'lucide-react';
import { SEMUA_LABEL_LALAI, labelUi } from '../../config/istilah';
import { muatPindaanLabel } from '../../config/labelOverrides';
import { renderMarkdownRingkas } from '../../lib/markdownRingkas';
import { StatusBadge, StatusTone } from '../common/StatusBadge';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { SectionLabel } from '../common/SectionLabel';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { KeadaanMemuat } from '../common/KeadaanMemuat';
import { Button } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import { LABEL_BORANG, INPUT_BORANG, KEPALA_JADUAL, GARIS_BARIS } from '../common/gayaKongsi';
import { FormColumn } from '../common/FormColumn';
import { ToastContainer, ToastMessage } from '../common/Toast';


// Corak ARIA tab sebenar (2026-08-09, F1-1 Pusingan 3B, audit ChatGPT) — 6 sub-tab ni menukar
// PANEL dalam halaman yang sama, jadi tab sebenar ikut definisi ARIA. Urutan tetap ikut susunan
// paparan (1-6) untuk navigasi Arrow Left/Right/Home/End.
const TETAPAN_SUBTAB_ORDER = ['PolisiKandungan', 'HalamanAwam', 'Operasi', 'RBAC', 'LabelSistem', 'RupaEditorium'] as const;

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
    viewAuditLog: boolean; // Log Sistem (baca jejak audit semua orang) — Editor biasa tidak
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
      manageEditorial: false, manageAccounts: true, manageEditorNotes: false,
      viewAuditLog: true
    }
  },
  {
    roleId: 'ketua_editor',
    roleName: 'Ketua Editor',
    isImmutableAdmin: true,
    permissions: {
      viewAll: true, editOwn: true, editAll: true, publish: true,
      reject: true, assignSlot: true, manageSettings: false, manageRbac: false,
      manageEditorial: true, manageAccounts: false, manageEditorNotes: true,
      viewAuditLog: true
    }
  },
  {
    roleId: 'penolong_ketua_editor',
    roleName: 'Penolong Ketua Editor',
    isImmutableAdmin: false,
    permissions: {
      viewAll: true, editOwn: true, editAll: true, publish: true,
      reject: true, assignSlot: true, manageSettings: false, manageRbac: false,
      manageEditorial: true, manageAccounts: false, manageEditorNotes: false,
      viewAuditLog: true
    }
  },
  {
    roleId: 'editor',
    roleName: 'Editor',
    isImmutableAdmin: false,
    permissions: {
      viewAll: true, editOwn: true, editAll: false, publish: true,
      reject: false, assignSlot: false, manageSettings: false, manageRbac: false,
      manageEditorial: false, manageAccounts: false, manageEditorNotes: false,
      viewAuditLog: false
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
  initialSubTab?: 'PolisiKandungan' | 'HalamanAwam' | 'Operasi' | 'RBAC' | 'LabelSistem' | 'RupaEditorium';
}

export const TetapanConsole: React.FC<TetapanConsoleProps> = ({
  isPentadbir = true, initialSubTab
}) => {
  const [subTab, setSubTab] = useState<'PolisiKandungan' | 'HalamanAwam' | 'Operasi' | 'RBAC' | 'LabelSistem' | 'RupaEditorium'>(initialSubTab || 'PolisiKandungan');

  const kendaliPapanKekunciSubTab = (e: React.KeyboardEvent) => {
    const i = TETAPAN_SUBTAB_ORDER.indexOf(subTab);
    let sasaran: typeof TETAPAN_SUBTAB_ORDER[number] | null = null;
    if (e.key === 'ArrowRight') sasaran = TETAPAN_SUBTAB_ORDER[(i + 1) % TETAPAN_SUBTAB_ORDER.length];
    else if (e.key === 'ArrowLeft') sasaran = TETAPAN_SUBTAB_ORDER[(i - 1 + TETAPAN_SUBTAB_ORDER.length) % TETAPAN_SUBTAB_ORDER.length];
    else if (e.key === 'Home') sasaran = TETAPAN_SUBTAB_ORDER[0];
    else if (e.key === 'End') sasaran = TETAPAN_SUBTAB_ORDER[TETAPAN_SUBTAB_ORDER.length - 1];
    if (sasaran) {
      e.preventDefault();
      setSubTab(sasaran);
      requestAnimationFrame(() => document.getElementById(`tetapan-subtab-${sasaran}`)?.focus());
    }
  };

  // Toast simpan (2026-08-07, Audit §D3) — butang simpan seksyen ni bertaburan beratus baris
  // (Jam Dunia, Focus View, Ticker Overlay, RBAC) dengan mesej inline jauh di bawah, mudah
  // terlepas pandang selepas menatal. Toast muncul dekat penjuru skrin tak kira kedudukan
  // tatalan — corak sama seperti toast Ticker di EditoriumView.tsx.
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: ToastMessage['type'], message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  };
  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

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

  // Maklum balas "+ Tambah Tempoh" (aduan Izzat 2026-08-13) — butang tu duduk di ATAS senarai,
  // tetapi tempoh baharu ditambah di HUJUNG. Dengan lapan tempoh sedia ada, baris kosong baharu
  // muncul jauh di bawah skrin dan editor langsung tak nampak apa-apa berlaku — Izzat tekan tiga
  // kali (tiga baris kosong dalam screenshotnya) sebab ingat butang tu tak berfungsi. Kini baris
  // baharu digulung ke pandangan dan medan pertamanya difokus, jadi tindakan itu ada kesan yang
  // JELAS tanpa memindahkan butang atau menyongsangkan susunan senarai.
  const senaraiCutiRef = useRef<HTMLDivElement>(null);
  const [fokusTempohBaharu, setFokusTempohBaharu] = useState(false);
  useEffect(() => {
    if (!fokusTempohBaharu) return;
    setFokusTempohBaharu(false);
    const bekas = senaraiCutiRef.current;
    const barisAkhir = bekas?.lastElementChild as HTMLElement | undefined;
    if (!barisAkhir) return;
    barisAkhir.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (barisAkhir.querySelector('input') as HTMLInputElement | null)?.focus({ preventScroll: true });
  }, [fokusTempohBaharu, schoolHolidays.length]);

  // Kitaran hayat senarai cuti sekolah (SCHOOL-HOLIDAY-SOURCE-001, 2026-08-13). Cuti sekolah
  // TIDAK datang daripada API — API cuti yang disambungkan bekalkan cuti UMUM sahaja (disahkan
  // dgn panggilan sebenar: 49 rekod, sifar menyebut sekolah). Bila DB kosong, sistem jatuh balik
  // ke SCHOOL_HOLIDAYS_LALAI, senarai berkod keras dalam worldClockRoutes.js yang entri
  // terakhirnya tamat pertengahan Feb 2027. Selepas tarikh itu Jam Dunia berhenti memapar cuti
  // sekolah SECARA SENYAP — tiada amaran, tiada sandaran, dan komen kod sendiri sudah akui ini.
  // Masalah teras bukan "berkod keras" (sandaran berkod keras kadang wajar) tetapi TIADA
  // pengurusan kitaran hayat: tiada sesiapa tahu bila ia tamat. Amaran di bawah menutup jurang
  // SENYAP itu; ia sengaja TIDAK memilih strategi sumber (manual/KPM/hibrid) — itu keputusan
  // pemilik projek, bukan keputusan kod.
  // Logik sebenar hidup dalam core/utils/kitaranCutiSekolah.js sebagai fungsi TULEN supaya ia
  // boleh diuji (lihat tests/kitaranCutiSekolah.test.js) — dengan data semasa amaran ni belum
  // tercetus (~185 hari lagi), jadi cabang "hampir tamat"/"sudah tamat" mustahil disahkan
  // dengan mata pada skrin hari ni. Komponen cuma memformat hasilnya.
  const statusLuputCuti = useMemo(() => {
    const hariIni = new Date().toISOString().slice(0, 10);
    const asas = statusLuputCutiSekolah(schoolHolidays, hariIni);
    if (!asas) return null;
    return {
      ...asas,
      tone: asas.tamat ? ('error' as const) : ('neutral' as const),
      dipapar: new Date(`${asas.tarikhAkhir}T00:00:00`).toLocaleDateString('ms-MY', {
        day: 'numeric', month: 'long', year: 'numeric',
      }),
    };
  }, [schoolHolidays]);

  // Glos Selari (2026-08-02, Fasa 6) — dahulu checkbox hiasan tanpa kesan. Ciri anotasi
  // interlinear (`[kata](gloss:makna)`, utils.tsx parseInlineFormatting) SUDAH aktif tanpa
  // syarat pada setiap tajuk/huraian kad — togol ni kini benar-benar kawal ia (FrontpageView.tsx
  // semak glosSelariEnabled sebelum membenarkan sintaks gloss; jika dimatikan, sintaks dipapar
  // sebagai label biasa sahaja, anotasi diabaikan).
  const [glosSelariEnabled, setGlosSelariEnabled] = useState<boolean>(false);
  const [savingGlosSelari, setSavingGlosSelari] = useState(false);
  const [glosSelariSaveError, setGlosSelariSaveError] = useState<string | null>(null);

  // Nota editor Focus View (2026-08-02, Fasa 7) — had pemotongan sebelum ni berkod keras
  // `NOTA_MAX = 180` di FocusView.tsx, sifar tetapan. Bukan sebahagian bajet ruang tajuk/huraian
  // (GeometryConfig/ContentBudget) — nota editor medan berasingan, tak muncul di kad bento.
  const [focusViewNotaMaxAksara, setFocusViewNotaMaxAksara] = useState<number>(180);
  // Tatal automatik Focus View (2026-08-13, keputusan Izzat) — tempoh sebelum ni berkod keras
  // `AUTOSCROLL_MS = 14000` di FocusView.tsx. Izzat pilih kekalkan model tempoh TETAP (bukan
  // skala ikut panjang artikel), tapi boleh dilaraskan Ketua Editor/Pentadbir di sini.
  const [focusViewAutoAdvanceSec, setFocusViewAutoAdvanceSec] = useState<number>(14);
  const [savingFocusView, setSavingFocusView] = useState(false);
  const [focusViewSaveError, setFocusViewSaveError] = useState<string | null>(null);

  // Saiz fon overlay skrin PENUH Ticker (2026-08-02) — bila marquee Ticker diklik
  // (FrontpageView.tsx `showNewsOverlay`), BUKAN Focus View kad biasa. Sebelum ni berkod
  // keras, sifar tetapan. Kunci pratetap ('S'/'M'/'L'/'XL'), bukan kelas Tailwind mentah —
  // lihat TICKER_OVERLAY_TITLE_SIZE_CLASS/TICKER_OVERLAY_BRIEF_SIZE_CLASS di FrontpageView.tsx.
  const [tickerOverlayTitleSize, setTickerOverlayTitleSize] = useState<string>('L');
  const [tickerOverlayBriefSize, setTickerOverlayBriefSize] = useState<string>('M');
  const [savingTickerOverlay, setSavingTickerOverlay] = useState(false);
  const [tickerOverlaySaveError, setTickerOverlaySaveError] = useState<string | null>(null);

  const [apiHealthStatus, setApiHealthStatus] = useState<any>(null);
  const [isLoadingApiStatus, setIsLoadingApiStatus] = useState<boolean>(false);

  // Badge colour must follow the REAL status, not default to green -- this panel used to hardcode
  // a green "ONLINE" badge even before any check ran (and the Holiday API side never actually
  // pinged anything at all). "Belum Disemak" (not yet checked) is the honest default state.
  const apiStatusTone = (status: string | undefined): StatusTone => {
    if (!status) return 'neutral';
    if (status.startsWith('ONLINE')) return 'success';
    if (status === 'DEGRADED') return 'warning';
    return 'error';
  };

  const fetchApiStatus = async () => {
    setIsLoadingApiStatus(true);
    try {
      const res = await fetch('/api/system/weather-status');
      if (res.ok) {
        const data = await bacaJsonSelamat(res);
        setApiHealthStatus(data);
      }
    } catch (e) {
      console.error('Fetch API status error:', e);
    } finally {
      setIsLoadingApiStatus(false);
    }
  };

  // POST /api/system/settings kini UPDATE separa berpandukan whitelist di pelayan (2026-08-08,
  // Fasa 2 susulan audit keselamatan ChatGPT P2-01) — medan yang TAK dihantar dikekalkan terus
  // di pelayan, jadi hantar CUMA medan yang berubah di sini sudah selamat. Dahulu (baca db-state
  // penuh → gabung tempatan → hantar objek gabungan) perlu wujud sebab pelayan lama INSERT OR
  // REPLACE seluruh baris setiap panggilan (medan tak disertakan hilang terus) — corak tu kini
  // lapuk (dan ia sendiri punca db-state kekal terpaksa bawa systemSettings PENUH kepada semua
  // pengguna log masuk, bukan cuma yang perlu).
  const saveSystemSettingsPatch = async (patch: Record<string, any>) => {
    const res = await fetch('/api/system/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (!res.ok) {
      const body = await bacaJsonSelamat(res).catch(() => ({}));
      throw new Error(body.error || 'Gagal menyimpan tetapan.');
    }
    return patch;
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
    // Baris KOSONG SEPENUHNYA digugurkan senyap; baris SEPARUH diisi sahaja yang menahan simpanan
    // (dibaiki 2026-08-13 selepas aduan Izzat). Dahulu mana-mana baris tak lengkap — termasuk baris
    // yang betul-betul kosong — menolak keseluruhan simpanan, dengan mesej yang JANJI "baris kosong
    // dibuang" sedangkan ia sebenarnya enggan menyimpan. Itu perangkap berlapis: butang "+ Tambah
    // Tempoh" tiada maklum balas kelihatan, jadi editor menekannya beberapa kali, dan setiap tekanan
    // tambahan itu terus mengunci butang Simpan tanpa sebab yang jelas. Baris kosong ialah kesan
    // sampingan klik, bukan niat editor — gugurkan sahaja, seperti yang mesej asal sendiri janjikan.
    const adaIsi = (c: { start: string; end: string; name: string }) =>
      !!(c.start.trim() || c.end.trim() || c.name.trim());
    const lengkap = (c: { start: string; end: string; name: string }) =>
      !!(c.start.trim() && c.end.trim() && c.name.trim());
    const barisDisentuh = schoolHolidays.filter(adaIsi);
    const cutiSah = barisDisentuh.filter(lengkap);
    if (cutiSah.length !== barisDisentuh.length) {
      setWorldClockSaveError('Ada tempoh cuti yang separuh diisi — setiap satu mesti ada Tarikh Mula, Tarikh Tamat dan Nama. Baris yang langsung kosong tidak mengapa, ia digugurkan sendiri.');
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
      addToast('success', 'Tetapan Jam Dunia disimpan.');
    } catch (e: any) {
      const mesejRalat = e.message || 'Gagal menyimpan tetapan Jam Dunia.';
      setWorldClockSaveError(mesejRalat);
      addToast('error', mesejRalat);
    } finally {
      setSavingWorldClock(false);
    }
  };

  const handleSaveFocusViewSettings = async () => {
    setSavingFocusView(true);
    setFocusViewSaveError(null);
    try {
      await saveSystemSettingsPatch({ focusViewNotaMaxAksara, focusViewAutoAdvanceSec });
      addToast('success', 'Tetapan Focus View disimpan.');
    } catch (e: any) {
      const mesejRalat = e.message || 'Gagal menyimpan tetapan Focus View.';
      setFocusViewSaveError(mesejRalat);
      addToast('error', mesejRalat);
    } finally {
      setSavingFocusView(false);
    }
  };

  const handleSaveTickerOverlaySettings = async () => {
    setSavingTickerOverlay(true);
    setTickerOverlaySaveError(null);
    try {
      await saveSystemSettingsPatch({ tickerOverlayTitleSize, tickerOverlayBriefSize });
      addToast('success', 'Tetapan paparan penuh Ticker disimpan.');
    } catch (e: any) {
      const mesejRalat = e.message || 'Gagal menyimpan tetapan paparan penuh Ticker.';
      setTickerOverlaySaveError(mesejRalat);
      addToast('error', mesejRalat);
    } finally {
      setSavingTickerOverlay(false);
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
        const rows = await bacaJsonSelamat(res);
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
        const body = await bacaJsonSelamat(res).catch(() => ({}));
        addToast('error', body.error || 'Gagal menambah kategori.');
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
        if (s.focusViewNotaMaxAksara !== undefined && s.focusViewNotaMaxAksara !== null) setFocusViewNotaMaxAksara(Number(s.focusViewNotaMaxAksara));
        if (s.focusViewAutoAdvanceSec !== undefined && s.focusViewAutoAdvanceSec !== null) setFocusViewAutoAdvanceSec(Number(s.focusViewAutoAdvanceSec));
        if (s.tickerOverlayTitleSize) setTickerOverlayTitleSize(s.tickerOverlayTitleSize);
        if (s.tickerOverlayBriefSize) setTickerOverlayBriefSize(s.tickerOverlayBriefSize);
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
          addToast('error', 'Ketua Editor tidak dibenarkan menarik semula kuasa editorial teras daripada akaun sendiri.');
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
      addToast('success', 'Kawalan Akses disimpan.');
    } catch (e: any) {
      const mesejRalat = e.message || 'Gagal menyimpan matriks RBAC.';
      setRbacSaveError(mesejRalat);
      addToast('error', mesejRalat);
    } finally {
      setSavingRbac(false);
    }
  };

  if (!isPentadbir) {
    return (
      <PanelCard>
        <KeadaanKosong ikon={<Lock className="w-8 h-8" />}>
          <span className="block font-serif text-base uppercase tracking-wider text-Adjung-maroon font-bold mb-1">
            Akses Terhad (Khusus Ketua Editor)
          </span>
          <span className="block text-stone-600">
            Modul Tetapan dan Pusat Konfigurasi Polisi hanya boleh diakses oleh Ketua Editor.
          </span>
        </KeadaanKosong>
      </PanelCard>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Struktur modul (Pelan 01 Fasa D1, dibetulkan 2026-08-08 — Izzat: "penomboran ...
          memeningkan dan mengecewakan"). Nombor seksyen SEBELUM ni berterusan 01–09 merentas
          kelima-lima sub-tab (cth sub-tab "3. Operasi & Governance" memaparkan seksyen "03"–"07"
          — dua sistem nombor berlainan makna tapi rupa sama, mengelirukan). Kini seksyen bersarang
          ikut nombor tab sendiri (3.1, 3.2, 3.3 ...), padan terus dengan apa yang dilihat editor. */}
      <ModulTajuk
        tajuk="Tetapan"
        huraian="Polisi kandungan, kandungan halaman awam dan dalaman, tetapan operasi (RSS, jam dunia, Focus View, Ticker), kawalan akses peranan, dan kamus label sistem."
      />

      {/* Submodule Navigation Bar */}
      <div className="flex flex-wrap justify-between items-center border-b border-stone-200 pb-3 text-xs gap-2">
        <div className="flex flex-wrap gap-1" role="tablist">
          <button
            id="tetapan-subtab-PolisiKandungan"
            role="tab"
            aria-selected={subTab === 'PolisiKandungan'}
            tabIndex={subTab === 'PolisiKandungan' ? 0 : -1}
            onClick={() => setSubTab('PolisiKandungan')}
            onKeyDown={kendaliPapanKekunciSubTab}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'PolisiKandungan' ? 'border-Adjung-maroon text-Adjung-maroon bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            1. Polisi Kandungan
          </button>

          <button
            id="tetapan-subtab-HalamanAwam"
            role="tab"
            aria-selected={subTab === 'HalamanAwam'}
            tabIndex={subTab === 'HalamanAwam' ? 0 : -1}
            onClick={() => setSubTab('HalamanAwam')}
            onKeyDown={kendaliPapanKekunciSubTab}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'HalamanAwam' ? 'border-Adjung-maroon text-Adjung-maroon bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            2. Halaman Awam & Dalaman
          </button>

          <button
            id="tetapan-subtab-Operasi"
            role="tab"
            aria-selected={subTab === 'Operasi'}
            tabIndex={subTab === 'Operasi' ? 0 : -1}
            onClick={() => setSubTab('Operasi')}
            onKeyDown={kendaliPapanKekunciSubTab}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'Operasi' ? 'border-Adjung-maroon text-Adjung-maroon bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            3. Operasi & Tadbir Urus
          </button>

          <button
            id="tetapan-subtab-RBAC"
            role="tab"
            aria-selected={subTab === 'RBAC'}
            tabIndex={subTab === 'RBAC' ? 0 : -1}
            onClick={() => setSubTab('RBAC')}
            onKeyDown={kendaliPapanKekunciSubTab}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'RBAC' ? 'border-Adjung-maroon text-Adjung-maroon bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            4. Kawalan Akses
          </button>

          <button
            id="tetapan-subtab-LabelSistem"
            role="tab"
            aria-selected={subTab === 'LabelSistem'}
            tabIndex={subTab === 'LabelSistem' ? 0 : -1}
            onClick={() => setSubTab('LabelSistem')}
            onKeyDown={kendaliPapanKekunciSubTab}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'LabelSistem' ? 'border-Adjung-maroon text-Adjung-maroon bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            5. Label Sistem
          </button>

          <button
            id="tetapan-subtab-RupaEditorium"
            role="tab"
            aria-selected={subTab === 'RupaEditorium'}
            tabIndex={subTab === 'RupaEditorium' ? 0 : -1}
            onClick={() => setSubTab('RupaEditorium')}
            onKeyDown={kendaliPapanKekunciSubTab}
            className={`px-4 py-2 font-semibold transition-all border-b-2 ${
              subTab === 'RupaEditorium' ? 'border-Adjung-maroon text-Adjung-maroon bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            6. Rupa Editorium
          </button>
        </div>
      </div>

      {/* 5. LABEL SISTEM (2026-08-02, Fasa 6 "Editor label & tooltip") — kamus label boleh
          sunting: MOD_KANDUNGAN_LABEL/STATUS_LABEL/MESEJ_SISTEM_LABEL di src/config/istilah.ts,
          disimpan di jadual `ui_labels` (core/routes/uiLabelRoutes.js). */}
      {subTab === 'LabelSistem' && <LabelSistemPanel />}

      {/* 6. RUPA EDITORIUM (2026-08-08, Izzat: "buat satu tempat di mana pentadbir boleh
          laraskan saiz font dan UI lain di editorium supaya tak perlu bantuan awak selalu"). */}
      {subTab === 'RupaEditorium' && <RupaEditoriumPanel />}

      {/* 2. HALAMAN AWAM (2026-08-02, Fasa 6) — ruang edit kandungan Tentang/Hubungi/Polisi
          disediakan SEKARANG (Izzat: "sedia ruang edit sekarang"), papar di frontpage bila
          halaman awam sendiri dibina (Fasa 11). Guna static_pages sedia ada
          (GET/POST /api/pages/:key, systemRoutes.js). */}
      {subTab === 'HalamanAwam' && <HalamanAwamPanel />}

      {/* 1. POLISI KANDUNGAN */}
      {subTab === 'PolisiKandungan' && (
        <PanelCard className="space-y-4 text-xs">
          <SectionLabel>1.1 — Polisi Teks &amp; Format Global</SectionLabel>
          <div className="space-y-4 divide-y divide-Adjung-line">
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
                    className="rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer disabled:opacity-50"
                  />
                  <span>Glos Selari (Anotasi Interlinear Dwibahasa / Arab-Melayu)</span>
                </label>
                <p className="text-stone-500 text-xs">
                  Benarkan editor guna sintaks <code className="bg-stone-100 px-1 rounded">[kata](gloss:makna)</code> dalam
                  tajuk/huraian — makna terpapar sebagai anotasi kecil di atas kata pada frontpage. Dimatikan lalai;
                  sintaks yang wujud dipapar sebagai teks biasa (anotasi diabaikan) selagi togol ni tak dihidupkan.
                </p>
                {glosSelariSaveError && <MesejStatus tone="error">{glosSelariSaveError}</MesejStatus>}
              </div>
            </div>
          </div>
        </PanelCard>
      )}

      {/* 3. OPERASI & TADBIR URUS */}
      {subTab === 'Operasi' && (
        <PanelCard className="space-y-6 text-xs">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-900">
            <Newspaper className="inline w-3.5 h-3.5 -mt-0.5 mr-1" /> Tetapan RSS &amp; penapisan Ticker (had berita live, kata kunci diharamkan, ambang skor) diuruskan di <strong>Modul Khas → Urus Ticker</strong>, bukan di sini — supaya tiada dua tempat berasingan yang boleh terkeluar segerak antara satu sama lain.
          </div>

          {/* Kategori RSS Tersekat — shared with the Frontpage Ticker Management modal */}
          <div className="space-y-3">
            <div>
              <SectionLabel>3.1 — Kategori RSS Tersekat</SectionLabel>
              <p className="text-stone-500 text-[11px]">
                Kategori mentah RSS yang disenaraikan di sini turut terpakai di modal Urus Ticker (Editorium → Modul Khas) — satu senarai kongsi.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {blockedCategories.map(c => (
                <span key={c.id} className="bg-stone-100 border border-stone-300 text-stone-800 px-2.5 py-1 rounded text-xs flex items-center gap-1.5">
                  <span>{c.categoryName}</span>
                  <button type="button" onClick={() => handleRemoveBlockedCategory(c.id)} className="text-stone-400 hover:text-[var(--color-error)] font-bold cursor-pointer"><X className="w-3 h-3" /></button>
                </span>
              ))}
              {blockedCategories.length === 0 && <KeadaanKosong className="w-full">Tiada kategori disekat lagi.</KeadaanKosong>}
            </div>
            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                placeholder="Cth: Hiburan, Gosip…"
                value={newBlockedCategoryInput}
                onChange={e => setNewBlockedCategoryInput(e.target.value)}
                className={`${INPUT_BORANG} flex-1`}
              />
              <Button type="button" variant="primary" size="md" onClick={handleAddBlockedCategory}>+ Tambah</Button>
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
                <SectionLabel>3.2 — Had Aksara Ikut Bentuk Kad</SectionLabel>
                <p className="text-stone-500 text-[11px]">
                  Carta penuh (live, terus dari <code className="bg-stone-100 text-Adjung-maroon px-1 py-0.5 rounded font-mono text-[10px]">core/editorial/GeometryConfig.js</code>) kini di tab <strong>Perlembagaan</strong> supaya tak pernah lapuk.
                </p>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-Adjung-maroon font-bold whitespace-nowrap">
                → Perlembagaan
              </span>
            </div>
          </div>

          {/* Tetapan Jam Dunia & Cuaca */}
          <div className="pt-6 border-t border-stone-200 space-y-4">
            <div>
              <SectionLabel className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> 3.3 — Tetapan Jam Dunia, Cuaca &amp; Status API (15 Bandar Ibu Negeri)
              </SectionLabel>
              <p className="text-stone-500 text-[11px]">
                Kawalan masa pertukaran slaid Jam Dunia, suis pemicu klik latar belakang, dan status kesihatan API Cuaca & Kalendar Cuti.
              </p>
            </div>

            {worldClockSaveError && (
              <MesejStatus tone="error" className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {worldClockSaveError}</MesejStatus>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-2">
                <label className={LABEL_BORANG}>
                  Selang Masa Auto-Slaid Jam Dunia
                </label>
                {/* `sm`, bukan `md` — pilihannya cuma beberapa perkataan ("30 Saat"), jadi kotak
                    selebar lajur borang penuh memberi isyarat salah tentang panjang nilainya. */}
                <FormColumn saiz="sm">
                  <select
                    value={worldClockIntervalSec}
                    onChange={(e) => setWorldClockIntervalSec(Number(e.target.value))}
                    className={INPUT_BORANG}
                  >
                    <option value={30}>30 Saat</option>
                    <option value={60}>60 Saat / 1 Minit</option>
                    <option value={120}>120 Saat / 2 Minit</option>
                    <option value={300}>300 Saat / 5 Minit</option>
                    <option value={0}>Matikan Auto-Slaid</option>
                  </select>
                </FormColumn>
                <span className="text-[10px] text-stone-400 block">
                  Paparan Jam Dunia akan bertukar set (Set 1 ➔ Set 2 ➔ Set 3) secara automatik mengikut masa ini.
                </span>
              </div>

              <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-2">
                <label className={LABEL_BORANG}>
                  Pemicu Pertukaran Klik Latar Belakang
                </label>
                <FormColumn saiz="sm">
                  <select
                    value={worldClockBgClickEnabled ? '1' : '0'}
                    onChange={(e) => setWorldClockBgClickEnabled(e.target.value === '1')}
                    className={INPUT_BORANG}
                  >
                    <option value="1">Aktif</option>
                    <option value="0">Tidak Aktif</option>
                  </select>
                </FormColumn>
                <span className="text-[10px] text-stone-400 block">
                  Apabila aktif, pengguna boleh menukar set paparan bandar dengan mengklik mana-mana ruang kosong di luar kad bento.
                </span>
              </div>
            </div>

            {/* Cuti Sekolah (2026-08-02, Fasa 7) — sebelum ni berkod keras, tarikh 2026/27
                sahaja, akan basi senyap lepas tempoh tu. Kini boleh sunting terus di sini. */}
            <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className={LABEL_BORANG}>
                  Tempoh Cuti Sekolah
                </label>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSchoolHolidays((p) => [...p, { start: '', end: '', group: 'A', name: '' }]);
                    setFokusTempohBaharu(true);
                  }}
                >
                  + Tambah Tempoh
                </Button>
              </div>
              <span className="text-[10px] text-stone-400 block -mt-1.5">
                Kumpulan A/B ialah pembahagian rasmi Kementerian Pendidikan (negeri berlainan cuti pada tarikh sedikit berbeza) — ia BUKAN jenis cuti. Senarai kosong = Jam Dunia tidak papar cuti sekolah langsung.
              </span>
              <span className="text-[10px] text-stone-400 block">
                Cuti sekolah dimasukkan manual: API cuti yang disambungkan hanya membekalkan <strong className="text-stone-500">cuti umum</strong> (kebangsaan/negeri), bukan takwim persekolahan KPM.
              </span>
              {statusLuputCuti && (
                <MesejStatus tone={statusLuputCuti.tone}>
                  {statusLuputCuti.tamat
                    ? `Senarai cuti sekolah ini sudah tamat pada ${statusLuputCuti.dipapar}. Jam Dunia tidak lagi memapar sebarang cuti sekolah sehingga tempoh baharu dimasukkan.`
                    : `Senarai cuti sekolah ini tamat pada ${statusLuputCuti.dipapar} (${statusLuputCuti.bezaHari} hari lagi). Masukkan tempoh tahun berikutnya sebelum tarikh itu — selepas tamat, Jam Dunia berhenti memapar cuti sekolah tanpa sebarang amaran lain.`}
                </MesejStatus>
              )}
              {schoolHolidays.length === 0 && (
                <KeadaanKosong>Tiada tempoh cuti sekolah ditetapkan.</KeadaanKosong>
              )}
              {/* Kedekatan menentukan pengumpulan (aduan Izzat 2026-08-13: "pembahagi antara
                  tempoh cuti dan kumpulan tak jelas... seolah-olah Kumpulan A dan B tu sendiri
                  kategori cuti"). Sebabnya jarak DALAM satu tempoh (gap-2 = 8px, antara baris
                  tarikh dan baris kumpulan+nama) hampir SAMA dengan jarak ANTARA tempoh
                  (space-y-2 = 8px) — mata tiada petunjuk mana yang satu unit. Kini 4px di dalam
                  lawan 20px di antara: nisbah 1:5 menjadikan setiap tempoh terbaca sebagai SATU
                  blok, tanpa menambah kotak/border baharu (pemilik projek tak suka chrome bekas
                  yang tak perlu — lihat nota "no unnecessary boxes"). */}
              <div ref={senaraiCutiRef} className="space-y-5">
                {/* Susun atur telefon (SETTINGS-MOBILE-001, dibaiki 2026-08-13) — baris ni dahulu
                    satu grid 5 lajur TETAP pada semua lebar. Lebar minimum intrinsik dua medan
                    tarikh + pilihan Kumpulan + medan nama melebihi 375px, dan trek grid `1fr`
                    tidak boleh susut bawah kandungannya — jadi baris ni memaksa SELURUH halaman
                    Editorium melebar lalu pelayar telefon zum keluar keseluruhan antara muka
                    (simptom sama seperti pepijat `<main>` 2026-08-13, punca berbeza).
                    Kini: telefon dapat DUA baris (tarikh berpasangan, kemudian kumpulan+nama+buang),
                    desktop kekal SATU baris 5 lajur yang sama macam sebelum ni — `sm:contents`
                    melarutkan pembalut telefon supaya kelima-lima medan kembali jadi anak terus
                    grid pada sm ke atas. `min-w-0` pada medan fleks WAJIB: input teks ada lebar
                    minimum intrinsik sendiri dan takkan susut tanpanya. */}
                {schoolHolidays.map((cuti, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_1fr_70px_1.4fr_auto] sm:items-center sm:gap-2"
                  >
                    <div className="flex gap-2 sm:contents">
                      <input
                        type="date" value={cuti.start} aria-label="Tarikh mula cuti"
                        onChange={(e) => setSchoolHolidays((p) => p.map((c, n) => n === i ? { ...c, start: e.target.value } : c))}
                        className={`${INPUT_BORANG} min-w-0 flex-1 sm:flex-none`}
                      />
                      <input
                        type="date" value={cuti.end} aria-label="Tarikh tamat cuti"
                        onChange={(e) => setSchoolHolidays((p) => p.map((c, n) => n === i ? { ...c, end: e.target.value } : c))}
                        className={`${INPUT_BORANG} min-w-0 flex-1 sm:flex-none`}
                      />
                    </div>
                    <div className="flex items-center gap-2 sm:contents">
                      {/* Pembalut lebar tetap, BUKAN `w-[92px]` terus pada <select> — INPUT_BORANG
                          sudah membawa `w-full`, dan dua utiliti lebar Tailwind pada elemen SAMA
                          ada kekhususan sama, jadi `w-full` menang senyap (disahkan dgn ukuran:
                          select jadi 311px, bukan 92px, lalu menolak baris ke 369px pada skrin
                          375px — persis pepijat yang sepatutnya dibaiki). Melawan `w-full` dgn
                          utiliti lebar lain tak boleh dipercayai; letak had pada IBU supaya
                          `w-full` bermakna "penuh 92px itu". Pada sm ke atas pembalut ni jadi
                          anak grid (trek 70px) via `sm:contents` ibunya, jadi desktop kekal sama.
                          Lihat juga nota Tailwind-kalah-CSS dalam dokumentasi projek. */}
                      <div className="w-[92px] shrink-0 sm:w-auto">
                        <select
                          value={cuti.group} aria-label="Kumpulan cuti"
                          onChange={(e) => setSchoolHolidays((p) => p.map((c, n) => n === i ? { ...c, group: e.target.value } : c))}
                          className={INPUT_BORANG}
                        >
                          <option value="A">Kump. A</option>
                          <option value="B">Kump. B</option>
                        </select>
                      </div>
                      <input
                        type="text" value={cuti.name} placeholder="Nama cuti (cth. Cuti Penggal 1 Sekolah)"
                        aria-label="Nama cuti"
                        onChange={(e) => setSchoolHolidays((p) => p.map((c, n) => n === i ? { ...c, name: e.target.value } : c))}
                        className={`${INPUT_BORANG} min-w-0 flex-1 sm:flex-none`}
                      />
                      <Tooltip text="Buang tempoh ini">
                        <button
                          type="button"
                          onClick={() => setSchoolHolidays((p) => p.filter((_, n) => n !== i))}
                          className="shrink-0 text-stone-400 hover:text-[var(--color-error)] cursor-pointer p-1"
                          aria-label="Buang tempoh ini"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" size="md" onClick={handleSaveWorldClockSettings} disabled={savingWorldClock}>
                {savingWorldClock ? <><Hourglass className="w-3.5 h-3.5" /> Menyimpan…</> : <><Save className="w-3.5 h-3.5" /> Simpan Tetapan Jam Dunia</>}
              </Button>
            </div>

            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <h5 className={LABEL_BORANG}>
                  Status &amp; Prestasi Integrasi API (Live Health Check)
                </h5>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={fetchApiStatus}
                  disabled={isLoadingApiStatus}
                >
                  {isLoadingApiStatus ? 'Menyemak API…' : <><RefreshCw className="w-3 h-3" /> Semak Status API Live</>}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                <div className="bg-stone-50 p-3 rounded border border-stone-200 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-800">Open-Meteo Weather API</span>
                    <StatusBadge
                      tone={apiStatusTone(apiHealthStatus?.openMeteo?.status)}
                      label={apiHealthStatus?.openMeteo?.status || 'Belum Disemak'}
                    />
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
                    <StatusBadge
                      tone={apiStatusTone(apiHealthStatus?.holidayApi?.status)}
                      label={apiHealthStatus?.holidayApi?.status || 'Belum Disemak'}
                    />
                  </div>
                  <div className="text-[10px] text-stone-500 space-y-0.5">
                    <div>Liputan Negeri: <strong className="text-stone-800">15 Negeri & Wilayah</strong></div>
                    {/* Label lama berbunyi "(Group A & Group B)" — SALAH dan mengelirukan
                        (dilaporkan Izzat 2026-08-13: dia ingat cuti sekolah dikemas kini
                        automatik oleh API ni). "Kumpulan A/B" ialah istilah takwim PERSEKOLAHAN
                        KPM; API ni (malaysia-holiday.dydxsoft.my, lihat worldClockRoutes.js
                        /clock-holidays) membekalkan CUTI UMUM sahaja berserta state_codes, dan
                        langsung tidak menyentuh cuti sekolah — cuti sekolah datang daripada
                        system_settings.schoolHolidaysJson yang disunting tangan di atas. */}
                    <div>Liputan: <strong className="text-stone-800">Cuti umum {apiHealthStatus?.holidayApi?.calendarYear || new Date().getFullYear()} (kebangsaan &amp; negeri)</strong></div>
                    <div className="text-stone-400">Tidak termasuk cuti sekolah — itu disunting manual di 3.3 di atas.</div>
                    <div>Latensi Rangkaian: <strong className="text-emerald-700">{apiHealthStatus?.holidayApi?.latencyMs !== undefined ? `${apiHealthStatus.holidayApi.latencyMs} ms` : '—'}</strong></div>
                    <div className="text-stone-400 truncate">Endpoint: {apiHealthStatus?.holidayApi?.endpoint || 'malaysia-holiday.dydxsoft.my/api/v1/holidays'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tetapan Focus View (2026-08-02, Fasa 7) — had pemotongan "Nota editor" sebelum ni
              berkod keras (`NOTA_MAX = 180`, FocusView.tsx), sifar tetapan. Kini boleh sunting
              di sini; lalai 180 aksara kekal sehingga disunting. */}
          <div className="pt-6 border-t border-stone-200 space-y-4">
            <div>
              <SectionLabel className="flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5" /> 3.4 — Tetapan Focus View (Paparan Bacaan Skrin Penuh)
              </SectionLabel>
              <p className="text-stone-500 text-[11px]">
                Had pemotongan Nota Editor yang dipapar di kolofon Focus View. Nota melebihi had ini dipotong pada sempadan perkataan terdekat.
              </p>
            </div>

            {focusViewSaveError && (
              <MesejStatus tone="error" className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {focusViewSaveError}</MesejStatus>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-2">
                <label className={LABEL_BORANG}>
                  Had Aksara Nota Editor
                </label>
                <FormColumn saiz="sm">
                  <input
                    type="number" min={20} max={2000} step={10}
                    value={focusViewNotaMaxAksara}
                    onChange={(e) => setFocusViewNotaMaxAksara(Math.max(20, Number(e.target.value) || 0))}
                    className={INPUT_BORANG}
                  />
                </FormColumn>
                <span className="text-[10px] text-stone-400 block">
                  Lalai 180 aksara. Tidak berkaitan bajet ruang tajuk/huraian kad bento (Tier Kad) — nota editor medan berasingan, tak dipapar pada kad.
                </span>
              </div>

              <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-2">
                <label className={LABEL_BORANG}>
                  Tempoh Tatal Automatik (saat)
                </label>
                <FormColumn saiz="sm">
                  <input
                    type="number" min={3} max={120} step={1}
                    value={focusViewAutoAdvanceSec}
                    onChange={(e) => setFocusViewAutoAdvanceSec(Math.max(3, Number(e.target.value) || 0))}
                    className={INPUT_BORANG}
                  />
                </FormColumn>
                <span className="text-[10px] text-stone-400 block">
                  Lalai 14 saat. Masa sebelum Focus View lompat sendiri ke kandungan seterusnya — pembaca boleh jeda bila-bila (butang Auto atau kekunci Space).
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" size="md" onClick={handleSaveFocusViewSettings} disabled={savingFocusView}>
                {savingFocusView ? <><Hourglass className="w-3.5 h-3.5" /> Menyimpan…</> : <><Save className="w-3.5 h-3.5" /> Simpan Tetapan Focus View</>}
              </Button>
            </div>
          </div>

          {/* Tetapan Paparan Penuh Ticker (2026-08-02) — overlay skrin penuh bila marquee
              Ticker diklik (showNewsOverlay, FrontpageView.tsx), BUKAN Focus View kad biasa —
              dua overlay berlainan. Sebelum ni berkod keras, sifar tetapan. */}
          <div className="pt-6 border-t border-stone-200 space-y-4">
            <div>
              <SectionLabel className="flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5" /> 3.5 — Tetapan Paparan Penuh Ticker
              </SectionLabel>
              <p className="text-stone-500 text-[11px]">
                Saiz fon tajuk dan huraian pada overlay skrin penuh yang terbuka bila jalur Ticker diklik. Berasingan daripada Focus View kad biasa.
              </p>
            </div>

            {tickerOverlaySaveError && (
              <MesejStatus tone="error" className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {tickerOverlaySaveError}</MesejStatus>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-2">
                <label className={LABEL_BORANG}>
                  Saiz Tajuk
                </label>
                <FormColumn saiz="sm">
                  <select
                    value={tickerOverlayTitleSize}
                    onChange={(e) => setTickerOverlayTitleSize(e.target.value)}
                    className={INPUT_BORANG}
                  >
                    <option value="S">Kecil</option>
                    <option value="M">Sederhana</option>
                    <option value="L">Besar (lalai)</option>
                    <option value="XL">Sangat Besar</option>
                  </select>
                </FormColumn>
              </div>

              <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-2">
                <label className={LABEL_BORANG}>
                  Saiz Huraian
                </label>
                <FormColumn saiz="sm">
                  <select
                    value={tickerOverlayBriefSize}
                    onChange={(e) => setTickerOverlayBriefSize(e.target.value)}
                    className={INPUT_BORANG}
                  >
                    <option value="S">Kecil</option>
                    <option value="M">Sederhana (lalai)</option>
                    <option value="L">Besar</option>
                  </select>
                </FormColumn>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" size="md" onClick={handleSaveTickerOverlaySettings} disabled={savingTickerOverlay}>
                {savingTickerOverlay ? <><Hourglass className="w-3.5 h-3.5" /> Menyimpan…</> : <><Save className="w-3.5 h-3.5" /> Simpan Tetapan Paparan Penuh Ticker</>}
              </Button>
            </div>
          </div>
        </PanelCard>
      )}

      {/* 4. INTERACTIVE RBAC PERMISSION TABLE MATRIX */}
      {subTab === 'RBAC' && (
        <PanelCard className="space-y-4 text-xs">
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
              <SectionLabel>4.1 — Matriks Kebenaran Peranan</SectionLabel>
              <p className="text-stone-500 text-xs mt-0.5">
                Pentadbir boleh menanda atau membatalkan kebenaran peranan mengikut keperluan tadbir urus sistem. Perubahan berkuat kuasa serta-merta selepas disimpan.
              </p>
            </div>
          </div>

          {rbacSaveError && (
            <MesejStatus tone="error" className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {rbacSaveError}</MesejStatus>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={KEPALA_JADUAL}>
                  <th className="p-3 min-w-36">Peranan Editorial</th>
                  <th className="p-3 text-center">Lihat Semua</th>
                  <th className="p-3 text-center">Sunting Saya</th>
                  <th className="p-3 text-center">Sunting Semua</th>
                  <th className="p-3 text-center">Siar</th>
                  <th className="p-3 text-center">Tolak</th>
                  <th className="p-3 text-center">Agihan Slot</th>
                  <th className="p-3 text-center">Bidang & Editorial</th>
                  <th className="p-3 text-center">Nota Ketua Editor</th>
                  <th className="p-3 text-center">Log Sistem</th>
                  <th className="p-3 text-center">Direktori & Akaun</th>
                  <th className="p-3 text-center">Polisi & Tetapan</th>
                  <th className="p-3 text-center">Tadbir RBAC</th>
                </tr>
              </thead>
              <tbody className="font-sans">
                {rbacMatrix.map(row => {
                  const kunciEditorial = row.isImmutableAdmin;
                  return (
                  <tr key={row.roleId} className={`hover:bg-stone-50 transition-colors ${GARIS_BARIS}`}>
                    <td className="p-3 font-bold text-stone-900 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${row.roleId === 'ketua_editor' ? 'bg-Adjung-maroon' : 'bg-stone-500'}`} />
                      <span>{row.roleName}</span>
                    </td>

                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.viewAll} onChange={() => handleTogglePermission(row.roleId, 'viewAll')} disabled={kunciEditorial} className="rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer disabled:opacity-50" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.editOwn} onChange={() => handleTogglePermission(row.roleId, 'editOwn')} className="rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.editAll} onChange={() => handleTogglePermission(row.roleId, 'editAll')} disabled={kunciEditorial} className="rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer disabled:opacity-50" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.publish} onChange={() => handleTogglePermission(row.roleId, 'publish')} disabled={kunciEditorial} className="rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer disabled:opacity-50" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.reject} onChange={() => handleTogglePermission(row.roleId, 'reject')} disabled={kunciEditorial} className="rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer disabled:opacity-50" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.assignSlot} onChange={() => handleTogglePermission(row.roleId, 'assignSlot')} className="rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.manageEditorial} onChange={() => handleTogglePermission(row.roleId, 'manageEditorial')} className="rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.manageEditorNotes} onChange={() => handleTogglePermission(row.roleId, 'manageEditorNotes')} className="rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.viewAuditLog} onChange={() => handleTogglePermission(row.roleId, 'viewAuditLog')} className="rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.manageAccounts} onChange={() => handleTogglePermission(row.roleId, 'manageAccounts')} className="rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.manageSettings} onChange={() => handleTogglePermission(row.roleId, 'manageSettings')} className="rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={row.permissions.manageRbac} onChange={() => handleTogglePermission(row.roleId, 'manageRbac')} className="rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer" />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" size="md" onClick={handleSaveRbac} disabled={savingRbac || !rbacDirty}>
              {savingRbac ? <><Hourglass className="w-3.5 h-3.5" /> Menyimpan…</> : rbacDirty ? <><Save className="w-3.5 h-3.5" /> Simpan Kawalan Akses</> : <><Check className="w-3.5 h-3.5" /> Tersimpan</>}
            </Button>
          </div>
        </PanelCard>
      )}

      {/* MODAL PEMILIH IKON BIDANG */}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

// Halaman Awam (2026-08-02, Fasa 6) — ruang edit Tentang/Hubungi/Polisi & Penafian. Guna
// static_pages sedia ada (GET/POST /api/pages/:key). Sengaja TIDAK papar apa-apa halaman awam
// sebenar di sini — itu Fasa 11; ini cuma tempat isi kandungan supaya tak tertangguh sepenuhnya.
// `kumpulan` (2026-08-06, pembetulan label — Izzat: "kenapa letak di Halaman Awam? logik ke?")
// — 'awam' = pembaca portal boleh nampak, 'dalaman' = editor sahaja (LengkapkanProfilModal.tsx).
// Dua kumpulan ni kongsi mekanisme belakang tabir SAMA (static_pages) sengaja untuk elak laluan
// berganda, tapi perlu dibezakan SECARA VISUAL di sini supaya tak nampak macam salah kategori.
const HALAMAN_AWAM_SENARAI: { key: string; label: string; kumpulan: 'awam' | 'dalaman' }[] = [
  // 'tentang' DIBUANG (2026-08-08, audit halaman mati Izzat) — laluan /tentang wujud dan boleh
  // disunting sepenuhnya, tapi TIADA satu pautan/butang pun di seluruh kod yang membawa ke sana
  // sejak "Mengenai Adjung" (kunci 'about', modal footer) menggantikannya semasa reka bentuk
  // footer disusun semula. Cuma boleh dicapai dengan menaip URL terus — laluan mati sebenar,
  // bukan halaman yang cuma belum diisi. Baris <Route path="/tentang"> di App.tsx turut dibuang.
  { key: 'hubungi', label: 'Hubungi', kumpulan: 'awam' },
  // Empat halaman modal footer (2026-08-08, pepijat Izzat: "kenapa keluar toast kalau klik semua
  // menu tu?"). Pautannya wujud di footer sejak reka bentuk (FrontpageView.tsx —
  // handleFooterLinkClick 'about'/'editorial-board'/'publishing-policies'/'version-history') tapi
  // kuncinya TIDAK pernah disenaraikan di sini, jadi tiada satu skrin pun dalam Editorium boleh
  // menciptanya — GET /api/pages/:key kekal 404 SELAMA-LAMANYA dan setiap klik pembaca memancarkan
  // toast ralat. Bukan kandungan yang tertinggal: laluan menulisnya memang tak pernah wujud.
  { key: 'about', label: 'Mengenai Adjung', kumpulan: 'awam' },
  { key: 'editorial-board', label: 'Lembaga Editorial', kumpulan: 'awam' },
  { key: 'publishing-policies', label: 'Dasar Penerbitan', kumpulan: 'awam' },
  { key: 'version-history', label: 'Sejarah Versi', kumpulan: 'awam' },
  // "Polisi & Penafian" dipecah kepada TIGA halaman berasingan (2026-08-05, permintaan Izzat —
  // susun atur footer baharu). Kunci 'polisi-penafian' lama DIKEKALKAN wujud di static_pages
  // (tak dipadam) sekiranya ada kandungan lama tersimpan — cuma tak diedit/dipaparkan di sini
  // lagi, tiga kunci baharu ni yang aktif.
  { key: 'polisi-privasi', label: 'Polisi Privasi', kumpulan: 'awam' },
  { key: 'terma-penggunaan', label: 'Terma Penggunaan', kumpulan: 'awam' },
  { key: 'penafian', label: 'Penafian', kumpulan: 'awam' },
  // Syarat & Peraturan Editor (2026-08-05, permintaan Izzat) — KANDUNGAN DALAMAN untuk editor
  // sahaja (dasar aktif, kerahsiaan draf, dll), BUKAN halaman awam pembaca — sengaja BERASINGAN
  // drpd "Terma Penggunaan" di atas (tu untuk pembaca portal, dah ada kandungan sebenar).
  // Dipapar di LengkapkanProfilModal.tsx (gerbang log masuk pertama editor), diedit di sini
  // guna mekanisme static_pages SAMA (GET/POST /api/pages/:key) supaya satu corak, tiada laluan
  // baharu diperlukan.
  { key: 'syarat-editor', label: 'Syarat & Peraturan Editor', kumpulan: 'dalaman' },
];

function HalamanAwamPanel() {
  const [halamanAktif, setHalamanAktif] = useState(HALAMAN_AWAM_SENARAI[0].key);
  const [tajuk, setTajuk] = useState('');
  const [kandungan, setKandungan] = useState('');
  // Suis "Aktif di Footer" (2026-08-08, permintaan Izzat — "macam mana nak nyahaktifkan Lembaga
  // Editorial dan halaman lain untuk sementara?"). Lalai true untuk halaman BAHARU (tiada baris
  // static_pages lagi) — sepatutnya nampak di footer sebaik disimpan kali pertama, bukan
  // tersembunyi senyap sehingga editor perasan dan hidupkan sendiri.
  const [aktifFooter, setAktifFooter] = useState(true);
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState('');
  const [mesej, setMesej] = useState('');
  // Pratonton (2026-08-06, Izzat: "saya tak pasti mcm mana rupa dia bila di modal") — render
  // markdown ringkas SAMA renderer macam LengkapkanProfilModal.tsx/HalamanStatik.tsx supaya
  // rupa di sini SEPADAN rupa sebenar tanpa perlu simpan dulu untuk semak.
  const [pratonton, setPratonton] = useState(false);

  const muatHalaman = () => {
    setMemuat(true);
    setRalat('');
    setPratonton(false);
    fetch(`/api/pages/${halamanAktif}`)
      .then(async (r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('Gagal memuatkan halaman.');
        return r.json();
      })
      .then((data) => {
        setTajuk(data?.title || HALAMAN_AWAM_SENARAI.find(h => h.key === halamanAktif)?.label || '');
        setKandungan(data?.content || '');
        setAktifFooter(data ? data.aktif !== 0 : true);
      })
      .catch((e) => setRalat(e.message || 'Gagal memuatkan halaman.'))
      .finally(() => setMemuat(false));
  };

  // 2026-08-07 (Audit §D6) — muatHalaman() ditakrif di atas supaya boleh dipanggil semula
  // daripada butang "Cuba Lagi" dalam MesejStatus, bukan hanya sekali semasa lekapan.
  useEffect(muatHalaman, [halamanAktif]);

  const simpan = async () => {
    setMenyimpan(true);
    setRalat('');
    try {
      const res = await fetch(`/api/pages/${halamanAktif}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: tajuk, content: kandungan, aktif: aktifFooter }),
      });
      if (!res.ok) {
        const body = await bacaJsonSelamat(res).catch(() => ({}));
        throw new Error(body.error || 'Gagal menyimpan halaman.');
      }
      setMesej(labelUi('toast.tetapan_disimpan'));
      // 2026-08-07 (Audit §D2) — 2000ms terlalu pantas bagi editor yang mengalih pandangan
      // sebentar (borang panjang, banyak medan); dinaikkan ke 6000ms.
      setTimeout(() => setMesej(''), 6000);
    } catch (e: any) {
      setRalat(e.message || 'Gagal menyimpan halaman.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <PanelCard className="space-y-4 text-xs max-w-3xl mx-auto">
      <div>
        <SectionLabel>2.1 — Kandungan Halaman Awam &amp; Dalaman</SectionLabel>
        <p className="text-stone-500 text-xs mt-1">
          Halaman awam sudah hidup di footer portal sebenar. Halaman "Aktif di Footer" boleh
          disunting sambil pautannya kekal kelihatan; nyahaktifkan suis untuk sembunyikan pautan
          buat sementara tanpa kehilangan kandungan tersimpan.
        </p>
      </div>

      <div className="space-y-2 border-b border-stone-200 pb-3">
        <div>
          <span className={LABEL_BORANG}>
            Halaman awam — pembaca portal boleh nampak
          </span>
          <div className="flex flex-wrap gap-1.5">
            {HALAMAN_AWAM_SENARAI.filter(h => h.kumpulan === 'awam').map(h => (
              <button
                key={h.key}
                onClick={() => setHalamanAktif(h.key)}
                className={`px-3 py-1.5 rounded font-semibold text-xs transition-colors ${
                  halamanAktif === h.key ? 'bg-Adjung-maroon text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={LABEL_BORANG}>
            Dalaman — editor sahaja, tak dipaparkan kepada pembaca
          </span>
          <div className="flex flex-wrap gap-1.5">
            {HALAMAN_AWAM_SENARAI.filter(h => h.kumpulan === 'dalaman').map(h => (
              <button
                key={h.key}
                onClick={() => setHalamanAktif(h.key)}
                className={`px-3 py-1.5 rounded font-semibold text-xs transition-colors ${
                  halamanAktif === h.key ? 'bg-Adjung-maroon text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {memuat ? (
        <KeadaanMemuat baris={4} />
      ) : (
        <div className="space-y-3">
          {HALAMAN_AWAM_SENARAI.find(h => h.key === halamanAktif)?.kumpulan === 'awam' && (
            <label className="flex items-center gap-2 font-semibold text-stone-800 cursor-pointer bg-stone-50 border border-stone-200 rounded px-3 py-2">
              <input
                type="checkbox"
                checked={aktifFooter}
                onChange={(e) => setAktifFooter(e.target.checked)}
                className="rounded border-stone-300 text-Adjung-maroon w-4 h-4 cursor-pointer"
              />
              <span className="text-xs">Aktif di Footer</span>
              <span className="text-[10px] text-stone-500 font-normal ml-1">
                {aktifFooter ? '(pautan kelihatan di footer portal)' : '(pautan tersembunyi, kandungan kekal tersimpan)'}
              </span>
            </label>
          )}
          <label className="block">
            <span className={LABEL_BORANG}>Tajuk Halaman</span>
            <input
              type="text"
              value={tajuk}
              onChange={(e) => setTajuk(e.target.value)}
              className={INPUT_BORANG}
            />
          </label>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className={LABEL_BORANG}>Kandungan</span>
              <button
                type="button"
                onClick={() => setPratonton((p) => !p)}
                className="font-mono text-[9px] uppercase tracking-wider font-bold text-Adjung-maroon hover:underline cursor-pointer"
              >
                {pratonton ? '✎ Sunting' : '👁 Pratonton'}
              </button>
            </div>
            {pratonton ? (
              <div className="bg-stone-50 border border-stone-200 rounded px-3 py-2 min-h-[15rem] text-[11px] text-stone-700 leading-relaxed space-y-2">
                {kandungan.trim() ? renderMarkdownRingkas(kandungan) : (
                  <KeadaanKosong>Tiada kandungan untuk pratonton.</KeadaanKosong>
                )}
              </div>
            ) : (
              <textarea
                value={kandungan}
                onChange={(e) => setKandungan(e.target.value)}
                rows={10}
                className={`${INPUT_BORANG} resize-y`}
                placeholder="Taip kandungan halaman di sini... (sokongan ringkas: # / ## tajuk, --- garis pemisah, **tebal**)"
              />
            )}
          </div>

          {ralat && <MesejStatus tone="error" onCubaLagi={muatHalaman}>{ralat}</MesejStatus>}

          <div className="flex items-center justify-end gap-3">
            {mesej && <span className="text-[var(--color-success)] text-[11px] font-semibold">{mesej}</span>}
            <Button variant="primary" size="md" onClick={simpan} disabled={menyimpan || !tajuk.trim()}>
              {menyimpan ? 'Menyimpan…' : 'Simpan Halaman'}
            </Button>
          </div>
        </div>
      )}
    </PanelCard>
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
        const body = await bacaJsonSelamat(res).catch(() => ({}));
        throw new Error(body.error || 'Gagal menyimpan label.');
      }
      setSuntingan({});
      muatSemula();
      await muatPindaanLabel();
      setMesej(labelUi('toast.tetapan_disimpan'));
      // 2026-08-07 (Audit §D2) — 2000ms terlalu pantas; dinaikkan ke 6000ms.
      setTimeout(() => setMesej(''), 6000);
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
        const body = await bacaJsonSelamat(res).catch(() => ({}));
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
    <PanelCard className="space-y-6 text-xs">
      <div>
        <SectionLabel>5.1 — Kamus Label Sistem</SectionLabel>
        <p className="text-stone-500 text-xs mt-1">
          Perkataan yang dipaparkan kepada editor (label Mod Kandungan, Status, dan mesej ringkas
          simpan/terbit). Menyunting di sini TIDAK mengubah apa yang disimpan dalam pangkalan
          data — cuma perkataan yang dipaparkan. Guna "Set semula" untuk kembalikan satu label
          kepada perkataan asal.
        </p>
      </div>

      {ralat && <MesejStatus tone="error" onCubaLagi={muatSemula}>{ralat}</MesejStatus>}

      {memuat ? (
        <KeadaanMemuat baris={4} />
      ) : (
        <div className="space-y-6">
          {Object.entries(kumpulan).map(([kategori, senarai]) => (
            <div key={kategori} className="space-y-2">
              <h4 className={`${LABEL_BORANG} border-b border-stone-200 pb-1`}>
                {kategori}
              </h4>
              <div className="space-y-2">
                {senarai.map((item) => {
                  const semasa = nilaiPapar(item.kunci, item.lalai);
                  const dipinda = semasa !== item.lalai;
                  return (
                    // `sm`: setiap label sistem satu perkataan sahaja ("Aktif", "Arkib") — baris
                    // dihadkan seluruhnya supaya butang "Set semula" rapat dengan medannya.
                    <FormColumn key={item.kunci} saiz="sm" className="flex items-center gap-2">
                      <input
                        type="text"
                        value={semasa}
                        onChange={(e) => setSuntingan((prev) => ({ ...prev, [item.kunci]: e.target.value }))}
                        className={`${INPUT_BORANG} flex-1`}
                      />
                      {dipinda && (
                        <Tooltip text={`Nilai asal: ${item.lalai}`}>
                          <span className="inline-flex shrink-0">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSemula(item.kunci, item.lalai, kategori)}
                              disabled={menyimpan}
                            >
                              Set semula
                            </Button>
                          </span>
                        </Tooltip>
                      )}
                    </FormColumn>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-end gap-3 border-t border-stone-200 pt-4">
            {mesej && <span className="text-[var(--color-success)] text-[11px] font-semibold">{mesej}</span>}
            <Button variant="primary" size="md" onClick={simpanSemua} disabled={menyimpan || !adaSuntingan}>
              {menyimpan ? 'Menyimpan…' : 'Simpan Label'}
            </Button>
          </div>
        </div>
      )}
    </PanelCard>
  );
}

// Rupa Editorium (2026-08-08, Izzat: "saiz font dlm kotak2 tu terlalu besar sila guna saiz yg
// sesuai... dan pastikan ia universal... buat satu tempat di mana pentadbir boleh laraskan saiz
// font dan UI lain di editorium supaya tak perlu bantuan awak selalu untuk laraskan"). Token
// dilaras di sini disuntik sebagai CSS custom properties pada `.editorium-root`
// (EditoriumLayout.tsx) yang MENANGKAP SEMULA kelas Tailwind sedia ada (text-xs/text-sm/dll.,
// lihat src/index.css) — jadi ia terpakai kepada SEMUA 23 fail Editorium serentak, bukan
// tempat-tempat yang sempat disunting tangan. Global untuk semua kakitangan (keputusan Izzat,
// bukan per-editor).
const RUPA_LALAI = {
  textMikro: 9, textKecil: 10, textLabel: 11, textBadan: 12, textMedan: 13,
  textSederhana: 15, textTajuk: 18, textTajukBesar: 20, textTajukUtama: 24,
  kepadatan: 1, lebarMaks: 'none',
};

const TAKAT_TEKS: { kunci: keyof typeof RUPA_LALAI; label: string; contoh: string }[] = [
  { kunci: 'textMikro', label: 'Mikro', contoh: 'Label mono kecil (cth "KANDUNGAN DIHANTAR")' },
  { kunci: 'textKecil', label: 'Kecil', contoh: 'Tarikh ringkas, catatan sampingan' },
  { kunci: 'textLabel', label: 'Label', contoh: 'Label medan borang, tab, badge status' },
  { kunci: 'textBadan', label: 'Badan', contoh: 'Perenggan huraian dalam jadual/kad' },
  { kunci: 'textMedan', label: 'Medan borang', contoh: 'Teks ditaip dalam kotak input/textarea' },
  { kunci: 'textSederhana', label: 'Sederhana', contoh: 'Perenggan huraian utama, isi modal' },
  { kunci: 'textTajuk', label: 'Tajuk kecil', contoh: 'Tajuk seksyen dalam modal' },
  { kunci: 'textTajukBesar', label: 'Tajuk besar', contoh: 'Tajuk modal/dialog' },
  { kunci: 'textTajukUtama', label: 'Tajuk utama', contoh: 'Tajuk modul (cth "Indeks Kandungan")' },
];

const PRESET_KEPADATAN: { label: string; nilai: number }[] = [
  { label: 'Padat', nilai: 0.75 },
  { label: 'Sederhana (lalai)', nilai: 1 },
  { label: 'Lapang', nilai: 1.35 },
];

function RupaEditoriumPanel() {
  const [semasa, setSemasa] = useState<typeof RUPA_LALAI>(RUPA_LALAI);
  const [suntingan, setSuntingan] = useState<typeof RUPA_LALAI | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState('');
  const [mesej, setMesej] = useState('');

  const muatSemula = () => {
    setMemuat(true);
    setRalat('');
    fetch('/api/editorium-ui-prefs')
      .then(async (r) => {
        if (!r.ok) throw new Error('Gagal memuatkan tetapan rupa Editorium.');
        return r.json();
      })
      .then((data) => { setSemasa({ ...RUPA_LALAI, ...data }); setSuntingan(null); })
      .catch((e) => setRalat(e.message || 'Gagal memuatkan tetapan rupa Editorium.'))
      .finally(() => setMemuat(false));
  };

  useEffect(() => { muatSemula(); }, []);

  const nilaiPapar = suntingan ?? semasa;
  const adaSuntingan = suntingan !== null;
  const ubah = (patch: Partial<typeof RUPA_LALAI>) => setSuntingan({ ...nilaiPapar, ...patch });

  const simpan = async () => {
    if (!suntingan) return;
    setMenyimpan(true);
    setRalat('');
    try {
      const res = await fetch('/api/editorium-ui-prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suntingan),
      });
      if (!res.ok) {
        const body = await bacaJsonSelamat(res).catch(() => ({}));
        throw new Error(body.error || 'Gagal menyimpan tetapan rupa Editorium.');
      }
      setSemasa(suntingan);
      setSuntingan(null);
      // Semua tab Editorium terbuka (termasuk tab ni sendiri) dengar peristiwa ni supaya kesan
      // kelihatan SERTA-MERTA, tanpa refresh — lihat EditoriumLayout.tsx.
      window.dispatchEvent(new CustomEvent('adjung-rupa-editorium-berubah'));
      setMesej(labelUi('toast.tetapan_disimpan'));
      setTimeout(() => setMesej(''), 6000);
    } catch (e: any) {
      setRalat(e.message || 'Gagal menyimpan tetapan rupa Editorium.');
    } finally {
      setMenyimpan(false);
    }
  };

  const setSemulaLalai = () => setSuntingan(RUPA_LALAI);

  if (memuat) {
    return (
      <PanelCard className="text-xs">
        <KeadaanMemuat baris={5} />
      </PanelCard>
    );
  }

  return (
    <PanelCard className="space-y-6 text-xs">
      <div>
        <SectionLabel>6.1 — Skala Teks</SectionLabel>
        <p className="text-stone-500 text-xs max-w-[680px]">
          Sembilan takat saiz teks yang dipakai merentas SEMUA konsol Editorium (jadual, borang,
          modal, tab). Terpakai serta-merta kepada kesemua fail sekali gus — bukan perlu disunting
          satu-satu. Tetapan ni global untuk semua kakitangan.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        {TAKAT_TEKS.map((t) => (
          <label key={t.kunci} className="block">
            <span className={LABEL_BORANG}>
              {t.label} <span className="text-stone-400 normal-case font-normal">({nilaiPapar[t.kunci]}px)</span>
            </span>
            <input
              type="range"
              min={7}
              max={t.kunci === 'textTajukUtama' ? 32 : t.kunci === 'textMikro' ? 12 : 24}
              step={1}
              value={nilaiPapar[t.kunci] as number}
              onChange={(e) => ubah({ [t.kunci]: Number(e.target.value) } as Partial<typeof RUPA_LALAI>)}
              className="w-full accent-Adjung-maroon"
            />
            <span className="text-stone-400 text-[10px]">{t.contoh}</span>
          </label>
        ))}
      </div>

      <div className="border-t border-stone-200 pt-5">
        <SectionLabel>6.2 — Kepadatan</SectionLabel>
        <p className="text-stone-500 text-xs max-w-[680px] mb-3">
          Jarak dalam kotak panel dan medan borang. Nota: ini setakat ni terpakai pada kotak panel
          dan medan borang sahaja (komponen kongsi sebenar) — bukan setiap ruang dalam jadual
          (setiap jadual masih tulis jaraknya sendiri, skop berasingan).
        </p>
        <div className="flex gap-2">
          {PRESET_KEPADATAN.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => ubah({ kepadatan: p.nilai })}
              className={`px-3 py-1.5 rounded border font-semibold transition-colors cursor-pointer ${
                Math.abs(nilaiPapar.kepadatan - p.nilai) < 0.01
                  ? 'border-Adjung-maroon text-Adjung-maroon bg-stone-50'
                  : 'border-stone-300 text-stone-600 hover:border-stone-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-stone-200 pt-5">
        <SectionLabel>6.3 — Lebar Kawasan Kerja</SectionLabel>
        <p className="text-stone-500 text-xs max-w-[680px] mb-3">
          Had lebar maksimum jadual/borang pada skrin lebar. "Tiada had" (lalai) guna lebar penuh
          ruang yang ada.
        </p>
        <FormColumn saiz="sm">
          <select
            value={nilaiPapar.lebarMaks === 'none' ? 'none' : nilaiPapar.lebarMaks}
            onChange={(e) => ubah({ lebarMaks: e.target.value })}
            className={INPUT_BORANG}
          >
            <option value="none">Tiada had (lalai)</option>
            <option value="1400px">1400px</option>
            <option value="1200px">1200px</option>
            <option value="1000px">1000px</option>
          </select>
        </FormColumn>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-stone-200 pt-4">
        {ralat && <span className="text-[var(--color-error)] text-[11px] font-semibold">{ralat}</span>}
        {mesej && <span className="text-[var(--color-success)] text-[11px] font-semibold">{mesej}</span>}
        <Button variant="secondary" size="md" onClick={setSemulaLalai} disabled={menyimpan}>
          Set Semula Lalai
        </Button>
        <Button variant="primary" size="md" onClick={simpan} disabled={menyimpan || !adaSuntingan}>
          {menyimpan ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </div>
    </PanelCard>
  );
}

export default TetapanConsole;
