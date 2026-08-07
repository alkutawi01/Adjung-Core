import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BidangIcon } from '../common/BidangIcon';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { Button } from '../common/Button';
import { LABEL_BORANG, INPUT_BORANG, KEPALA_JADUAL, GARIS_BARIS } from '../common/gayaKongsi';
import {
  GEOMETRY_RATIOS, TIER_SLOTS, TIER_LABELS, TIER_LABEL_IS_ENGLISH, tierForSlot,
} from '../../../core/editorial/GeometryConfig.js';

// Senarai Slot (2026-07-30, permintaan pemilik projek) — satu jadual, satu baris satu slot,
// memaparkan segala yang mentakrifkan slot itu.
//
// Ticker (slot -1) dan tier BAR sengaja TIADA di sini: kedua-duanya ada rumah sendiri di Modul
// Khas dan peraturannya berbeza (Bar untuk event, tiada medan huraian; Ticker RSS).
//
// HAD AKSARA diambil daripada GET /api/system/tier-settings — iaitu nilai lalai GeometryConfig
// DITAMBAH sebarang pindaan Ketua Editor di sub-menu "Tier Kad". Jangan sekali-kali papar nombor
// had daripada lajur maxTitle/maxBrief dalam slots_config: lajur DB itu salinan lama yang sudah
// terpesong (12 slot simpan nombor salah, 20 lagi kosong) dan tidak menghormati pindaan tier.
const BAR_SLOTS = new Set(TIER_SLOTS.BAR);
const SLOT_INDEXES = Array.from({ length: 38 }, (_, i) => i).filter(i => !BAR_SLOTS.has(i));

interface SlotRow {
  slotIndex: number;
  manualDesk?: string | null;
  carouselInterval?: number | null;
  carouselDelay?: number | null;
  bgColor?: string | null;
  borderColor?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

// Pratetap warna kad (2026-08-02, Fasa 7) — SAMA senarai seperti ADJUNG_COLOR_PRESETS di
// FrontpageView.tsx (borang "Tetapan Slot" lama yang cuma boleh dicapai lalui pautan bocor
// ?openTicker=1-macam sebelum ni). Jangan sekali-kali biar dua senarai ni terpesong.
const WARNA_PRATETAP = [
  { label: 'Maroon', value: '#802334' },
  { label: 'Hitam', value: '#1F1F1F' },
  { label: 'Kelabu', value: '#6B7280' },
  { label: 'Putih', value: '#FFFFFF' },
];

interface BidangRow {
  name: string;
  color: string;
  icon: string | null;
  iconSvg: string | null;
}

interface PenugasanEditor {
  slotIndex: number;
  editorId: string;
  nama: string;
}

interface Pengguna {
  id: string;
  penName?: string;
  username?: string;
  role?: string;
  isSuspended?: boolean;
}

// Lajur LEGASI `users.role` (satu nilai) — bukan matriks RBAC 4-peranan sebenar (`user_roles`).
// Dipetakan supaya tiada kod mentah huruf besar bocor ke UI; lihat nota di tapak render.
const LABEL_PERANAN_LEGASI: Record<string, string> = {
  KETUA_EDITOR: 'Ketua Editor',
  PENOLONG_KETUA_EDITOR: 'Penolong Ketua Editor',
  PENTADBIR: 'Pentadbir',
  EDITOR: 'Editor',
};

interface Props {
  currentEditoriumRole?: string;
}

export const SenaraiSlotConsole: React.FC<Props> = ({ currentEditoriumRole }) => {
  // `currentEditoriumRole` ialah peranan BERKESAN yang dipadankan di EditoriumView.tsx
  // (`effectiveEditorialRole`): Ketua Editor DAN Penolong Ketua Editor kedua-duanya sampai sini
  // sebagai 'KETUA_EDITOR', peranan lain sebagai 'EDITOR'. Sepadan lalai kunci `assignSlot` /
  // `manageEditorial` dalam matriks Kawalan Akses.
  const bolehAgihSlot = currentEditoriumRole === 'KETUA_EDITOR';
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [bidangList, setBidangList] = useState<BidangRow[]>([]);
  const [usage, setUsage] = useState<{ slotIndex: number; bidang: string; liveCount: number }[]>([]);
  const [hadTier, setHadTier] = useState<Record<string, { maxTitleAlone: number; maxBriefAlone: number; dipinda: boolean }>>({});
  const [penugasan, setPenugasan] = useState<PenugasanEditor[]>([]);
  const [pengguna, setPengguna] = useState<Pengguna[]>([]);
  const [loading, setLoading] = useState(true);

  // Status Aktif/Menunggu per-slot (2026-08-06, permintaan Izzat: "editor tahu status setiap
  // slot dan bersedia tambah kandungan supaya setiap slot sentiasa mempunyai kandungan baharu")
  // — dahulu lajur "Kandungan Aktif" gabungkan Aktif+Menunggu jadi SATU angka, tak boleh diklik,
  // tiada senarai/tarikh. Dibina drpd GET /api/system/content/all (sumber SAMA yang Indeks
  // guna) — bukan endpoint baharu, kiraan/senarai dibina client-side drpd data yang sama.
  interface KandunganRingkas { id: string; tajuk: string; scheduledPublishAt: string | null; scheduledExpiresAt: string | null; sebabMenunggu?: string }
  const [aktifPerSlot, setAktifPerSlot] = useState<Record<number, KandunganRingkas[]>>({});
  const [menungguPerSlot, setMenungguPerSlot] = useState<Record<number, KandunganRingkas[]>>({});
  // Panel senarai terbuka (klik angka Aktif/Menunggu) — satu pada satu masa.
  const [panelSenarai, setPanelSenarai] = useState<{ slotIndex: number; jenis: 'aktif' | 'menunggu' } | null>(null);
  // Backdrop-click guard untuk tiga modal di bawah (lihat LoginModal.tsx, pepijat Izzat
  // 2026-08-07) — kekal false selagi mousedown tak bermula terus pada backdrop.
  const mousedownPadaBackdropPanel = React.useRef(false);
  const mousedownPadaBackdropEditor = React.useRef(false);
  const mousedownPadaBackdropTetapan = React.useRef(false);

  // Penyuntingan editor: satu slot pada satu masa, disimpan sebagai senarai penuh (bukan
  // tambah/buang satu-satu) supaya tiada keadaan separuh siap.
  const [slotDisunting, setSlotDisunting] = useState<number | null>(null);
  const [drafEditor, setDrafEditor] = useState<string[]>([]);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);

  // Tetapan kad (Bidang/warna/carousel) — Fasa 7, "pintu masuk sah dalam Editorium untuk
  // tetapan per-slot". Sebelum ni satu-satunya jalan ubah medan ni ialah borang lama di
  // FrontpageView.tsx, dicapai lalui pautan bocor ?openTicker=1-macam — dibuang terus di sini
  // (bukan buka borang lama itu) sebab borang tu turut papar medan sunting KANDUNGAN, yang
  // sepatutnya cuma lalui SlotManagerModal Editorium sejak pemisahan 2026-07-29.
  const [slotTetapan, setSlotTetapan] = useState<number | null>(null);
  const [drafTetapan, setDrafTetapan] = useState<{ manualDesk: string; bgColor: string; borderColor: string; carouselInterval: number; carouselDelay: number; jenisAnimasiOverride: string; arahOverride: string; warnaPanelOverride: string; kelajuanOverride: string; logoTransisiMode: string } | null>(null);
  const [menyimpanTetapan, setMenyimpanTetapan] = useState(false);

  // Nilai Tetapan Am semasa (2026-08-07, Pelan 03) — dipapar dalam label kawalan per-slot supaya
  // Ketua Editor nampak apa yang sebenarnya diwarisi apabila kawalan dibiar "Ikut Am", bukan
  // sekadar perkataan "lalai" yang tak memberitahu apa-apa.
  const [amWarnaPanel, setAmWarnaPanel] = useState('#802334');
  const [amKelajuan, setAmKelajuan] = useState(1);
  useEffect(() => {
    let dibatal = false;
    fetch('/api/system/slot-am-settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (dibatal || !d) return;
        if (typeof d.warnaPanelTransisi === 'string' && d.warnaPanelTransisi) setAmWarnaPanel(d.warnaPanelTransisi);
        if (Number(d.kelajuanAnimasi) > 0) setAmKelajuan(Number(d.kelajuanAnimasi));
      })
      .catch(() => { /* tetapan am tak dapat dibaca — label kekal nilai lalai, bukan ralat */ });
    return () => { dibatal = true; };
  }, []);
  const [ralatTetapan, setRalatTetapan] = useState<string | null>(null);

  // Muat SEMULA baris penuh terus dari server semasa buka (bukan guna salinan `slots` dalam
  // ingatan) — sama sebab seperti useSlotEditor.openSlotEditor: elak menimpa simpanan terkini
  // orang lain, dan dapatkan token `updatedAt` segar untuk kawalan serentak (Fasa 6).
  const bukaTetapan = async (slotIndex: number) => {
    setRalatTetapan(null);
    try {
      const res = await fetch('/api/system/slots');
      const data = await res.json();
      const baris = Array.isArray(data) ? data.find((s: any) => s.slotIndex === slotIndex) : null;
      if (!baris) throw new Error('Slot tidak dijumpai.');
      setSlots((prev) => prev.map((s) => (s.slotIndex === slotIndex ? baris : s)));
      setDrafTetapan({
        manualDesk: baris.manualDesk || '',
        bgColor: baris.bgColor || 'transparent',
        borderColor: baris.borderColor || '',
        carouselInterval: baris.carouselInterval || 10,
        carouselDelay: baris.carouselDelay || 0,
        jenisAnimasiOverride: baris.jenisAnimasiOverride || '',
        arahOverride: baris.arahOverride || '',
        warnaPanelOverride: baris.warnaPanelOverride || '',
        kelajuanOverride: baris.kelajuanOverride || '',
        logoTransisiMode: baris.logoTransisiMode || '',
      });
      setSlotTetapan(slotIndex);
    } catch (e: any) {
      setRalatTetapan(e.message || 'Gagal memuatkan tetapan slot.');
    }
  };

  const simpanTetapan = async () => {
    if (slotTetapan === null || !drafTetapan) return;
    setMenyimpanTetapan(true);
    setRalatTetapan(null);
    try {
      const semasaRes = await fetch('/api/system/slots');
      const semasaData = await semasaRes.json();
      const semasa = Array.isArray(semasaData) ? semasaData.find((s: any) => s.slotIndex === slotTetapan) : null;
      if (!semasa) throw new Error('Slot tidak dijumpai.');
      const gabungan = { ...semasa, ...drafTetapan };
      const res = await fetch('/api/system/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gabungan),
      });
      const hasil = await res.json();
      if (!res.ok) throw new Error(hasil.error || 'Gagal menyimpan tetapan slot.');
      const senaraiBaru = await fetch('/api/system/slots').then((r) => r.json());
      if (Array.isArray(senaraiBaru)) setSlots(senaraiBaru);
      setSlotTetapan(null);
      setDrafTetapan(null);
    } catch (e: any) {
      setRalatTetapan(e.message || 'Gagal menyimpan tetapan slot.');
    } finally {
      setMenyimpanTetapan(false);
    }
  };

  const muatPenugasan = () =>
    fetch('/api/system/slot-editors')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPenugasan(d); })
      .catch(() => {});

  useEffect(() => {
    Promise.all([
      fetch('/api/system/slots').then(r => r.json()).catch(() => []),
      fetch('/api/system/categories/active').then(r => r.json()).catch(() => []),
      fetch('/api/system/categories/slot-usage').then(r => r.json()).catch(() => []),
      fetch('/api/system/tier-settings').then(r => r.json()).catch(() => []),
      fetch('/api/db-state').then(r => r.json()).catch(() => ({})),
      muatPenugasan(),
      fetch('/api/system/content/all').then(r => r.json()).catch(() => []),
    ])
      .then(([slotRows, bidangRows, usageRows, tierRows, dbState, , semuaKandungan]) => {
        if (Array.isArray(slotRows)) setSlots(slotRows);
        if (Array.isArray(bidangRows)) setBidangList(bidangRows);
        if (Array.isArray(usageRows)) setUsage(usageRows);
        if (Array.isArray(tierRows)) {
          setHadTier(Object.fromEntries(tierRows.map((t: any) => [t.tierKey, {
            maxTitleAlone: t.maxTitleAlone, maxBriefAlone: t.maxBriefAlone, dipinda: !!t.dipinda,
          }])));
        }
        if (Array.isArray(dbState?.users)) setPengguna(dbState.users.filter((u: Pengguna) => !u.isSuspended));
        // GET /api/system/content/all pulangkan { items, count } — bukan array terus.
        const senaraiKandungan = Array.isArray(semuaKandungan?.items) ? semuaKandungan.items : [];
        if (senaraiKandungan.length > 0) {
          const aktif: Record<number, KandunganRingkas[]> = {};
          const menunggu: Record<number, KandunganRingkas[]> = {};
          for (const r of senaraiKandungan) {
            if (r.status !== 'approved' && r.status !== 'pending') continue;
            const ringkas: KandunganRingkas = {
              id: r.id, tajuk: r.title || '(tiada tajuk)',
              scheduledPublishAt: r.scheduledPublishAt || null,
              scheduledExpiresAt: r.scheduledExpiresAt || null,
              sebabMenunggu: r.sebabMenunggu || '',
            };
            const kunci = r.status === 'approved' ? aktif : menunggu;
            (kunci[r.slotIndex] = kunci[r.slotIndex] || []).push(ringkas);
          }
          setAktifPerSlot(aktif);
          setMenungguPerSlot(menunggu);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const formatTarikhMasa = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return null; }
  };

  const editorBagiSlot = (slotIndex: number) => penugasan.filter(p => p.slotIndex === slotIndex);

  const bukaEditor = (slotIndex: number) => {
    setRalat(null);
    setSlotDisunting(slotIndex);
    setDrafEditor(editorBagiSlot(slotIndex).map(p => p.editorId));
  };

  const simpanEditor = async () => {
    if (slotDisunting === null) return;
    setMenyimpan(true);
    setRalat(null);
    try {
      const res = await fetch('/api/system/slot-editors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotIndex: slotDisunting, editorIds: drafEditor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan penugasan.');
      await muatPenugasan();
      setSlotDisunting(null);
    } catch (e: any) {
      setRalat(e.message || 'Gagal menyimpan penugasan.');
    } finally {
      setMenyimpan(false);
    }
  };

  const bidangFor = (nama: string) =>
    bidangList.find(b => b.name.toLowerCase() === (nama || '').trim().toLowerCase());

  // Dikira drpd aktifPerSlot/menungguPerSlot (sumber SAMA yang lajur Aktif/Menunggu guna) —
  // bukan `usage.liveCount` (yang gabungkan kedua-dua status jadi satu angka) supaya ringkasan
  // atas dan jadual bawah sentiasa sepadan, tak pernah berselisih.
  const jumlahAktif = SLOT_INDEXES.reduce((n, i) => n + (aktifPerSlot[i]?.length || 0), 0);
  const jumlahMenunggu = SLOT_INDEXES.reduce((n, i) => n + (menungguPerSlot[i]?.length || 0), 0);

  return (
    <div className="space-y-4 font-sans">
      <ModulTajuk
        tajuk="Senarai Slot"
        huraian={
          <>
            {SLOT_INDEXES.length} slot bento — tidak termasuk Ticker dan tier <em>Bar</em>, yang diuruskan di Modul Khas.
            Jumlah {jumlahAktif} kandungan aktif, {jumlahMenunggu} menunggu kelulusan.
          </>
        }
      />

      <PanelCard className="space-y-4 text-xs">
        {loading ? (
          <KeadaanKosong>Memuatkan senarai slot...</KeadaanKosong>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={KEPALA_JADUAL}>
                  <th className="p-2.5">Slot</th>
                  <th className="p-2.5">Bentuk</th>
                  <th className="p-2.5">Bidang</th>
                  <th className="p-2.5">Warna</th>
                  <th className="p-2.5 text-right">Had Tajuk</th>
                  <th className="p-2.5 text-right">Had Huraian</th>
                  {/* 2026-08-02 (Fasa 7) — label lama "Animasi Transisi" mengelirukan: lajur ni
                      SENTIASA papar selang/lengah putaran carousel, bukan jenis animasi (tetapan
                      jenis animasi itu global, di Tetapan Am Slot, bukan per-slot). */}
                  <th className="p-2.5">Carousel</th>
                  <th className="p-2.5 text-right">Aktif</th>
                  <th className="p-2.5 text-right">Menunggu</th>
                  <th className="p-2.5">Editor</th>
                  {currentEditoriumRole === 'KETUA_EDITOR' && <th className="p-2.5">Tetapan Kad</th>}
                </tr>
              </thead>
              <tbody>
                {SLOT_INDEXES.map(i => {
                  const tier = tierForSlot(i) as keyof typeof GEOMETRY_RATIOS;
                  // Nilai berkuat kuasa (termasuk pindaan Tier Kad); GEOMETRY_RATIOS cuma sandaran
                  // sekiranya panggilan API gagal.
                  const had = hadTier[tier] || GEOMETRY_RATIOS[tier];
                  const dipinda = !!hadTier[tier]?.dipinda;
                  const cfg = slots.find(s => s.slotIndex === i);
                  const namaBidang = (usage.find(u => u.slotIndex === i)?.bidang || cfg?.manualDesk || '').trim();
                  const bidang = bidangFor(namaBidang);
                  const live = usage.find(u => u.slotIndex === i)?.liveCount || 0;
                  const selang = cfg?.carouselInterval;
                  const lengah = cfg?.carouselDelay;
                  return (
                    <tr key={i} className={`hover:bg-stone-50 ${GARIS_BARIS}`}>
                      <td className="p-2.5 font-mono font-bold text-stone-800">{i + 1}</td>
                      <td className="p-2.5 text-stone-600">
                        {TIER_LABEL_IS_ENGLISH[tier] ? <em>{TIER_LABELS[tier]}</em> : TIER_LABELS[tier]}
                      </td>
                      <td className="p-2.5">
                        {namaBidang ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: bidang?.color || '#57534e' }}>
                            {bidang && <BidangIcon iconName={bidang.icon} iconSvg={bidang.iconSvg} color={bidang.color} />}
                            {namaBidang}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic">Belum ditetapkan</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        {bidang ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block w-3.5 h-3.5 rounded-full border border-stone-300" style={{ backgroundColor: bidang.color }} />
                            <span className="font-mono text-[10px] uppercase text-stone-500">{bidang.color}</span>
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className={`p-2.5 text-right font-mono ${dipinda ? 'text-amber-700 font-bold' : 'text-stone-700'}`} title={dipinda ? 'Had dipinda di Tier Kad' : undefined}>{had.maxTitleAlone}</td>
                      <td className={`p-2.5 text-right font-mono ${dipinda ? 'text-amber-700 font-bold' : 'text-stone-700'}`} title={dipinda ? 'Had dipinda di Tier Kad' : undefined}>{had.maxBriefAlone}</td>
                      <td className="p-2.5 text-stone-600">
                        {selang ? (
                          <span className="font-mono text-[10px]">
                            {selang}s{lengah ? ` · lengah ${lengah}s` : ''}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      {/* Aktif/Menunggu (2026-08-06) — dahulu SATU angka gabungan tak boleh diklik.
                          Klik buka panel senarai tajuk + tarikh jadual (kalau ada) — supaya editor
                          nampak status setiap slot dan bersedia tambah kandungan baharu. */}
                      <td className="p-2.5 text-right">
                        {(aktifPerSlot[i]?.length || 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() => setPanelSenarai({ slotIndex: i, jenis: 'aktif' })}
                            className="font-mono font-bold text-emerald-800 hover:underline cursor-pointer"
                          >
                            {aktifPerSlot[i].length}
                          </button>
                        ) : (
                          <span className="font-mono font-bold text-stone-300">0</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right">
                        {(menungguPerSlot[i]?.length || 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() => setPanelSenarai({ slotIndex: i, jenis: 'menunggu' })}
                            className="font-mono font-bold text-amber-700 hover:underline cursor-pointer"
                          >
                            {menungguPerSlot[i].length}
                          </button>
                        ) : (
                          <span className="font-mono font-bold text-stone-300">0</span>
                        )}
                      </td>
                      {/* Penugasan editor (2026-08-05, audit) — boleh DIUBAH hanya oleh peranan
                          berkunci `assignSlot` (Ketua Editor/Penolong). Editor biasa tetap NAMPAK
                          siapa ditugaskan (maklumat berguna, bukan rahsia) tapi sebagai teks
                          statik, bukan butang — dahulu sesiapa yang log masuk boleh klik dan
                          tukar penugasan mana-mana slot. Gerbang sebenar di server
                          (requirePermission('assignSlot'), core/routes/slotEditorRoutes.js). */}
                      <td className="p-2.5">
                        {bolehAgihSlot ? (
                          <button
                            type="button"
                            onClick={() => bukaEditor(i)}
                            title="Tetapkan editor yang menguruskan slot ini"
                            className="text-left hover:text-Adjung-maroon cursor-pointer group"
                          >
                            {editorBagiSlot(i).length === 0 ? (
                              <span className="text-stone-400 italic group-hover:text-Adjung-maroon">Belum ditugaskan</span>
                            ) : (
                              <span className="text-stone-700 group-hover:text-Adjung-maroon">
                                {editorBagiSlot(i).map(p => p.nama).join(', ')}
                              </span>
                            )}
                          </button>
                        ) : (
                          editorBagiSlot(i).length === 0 ? (
                            <span className="text-stone-400 italic">Belum ditugaskan</span>
                          ) : (
                            <span className="text-stone-700">{editorBagiSlot(i).map(p => p.nama).join(', ')}</span>
                          )
                        )}
                      </td>
                      {currentEditoriumRole === 'KETUA_EDITOR' && (
                        <td className="p-2.5">
                          <Button variant="secondary" size="sm" onClick={() => bukaTetapan(i)}>
                            Tetapan
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-Adjung-line pt-3 space-y-1.5 text-[10px] text-stone-500 leading-relaxed">
          <p>
            <strong className="font-semibold text-stone-700">Had aksara ikut bentuk, bukan ikut slot.</strong>{' '}
            Semua slot yang sama bentuk berkongsi had yang sama — ia datang daripada saiz fizikal kad itu sendiri.
            Tajuk dan huraian pula berkongsi SATU bajet ruang: tajuk panjang mengecilkan ruang huraian, dan sebaliknya.
            Nombor di atas ialah had setiap medan apabila medan satu lagi kosong. Untuk meminda, pergi ke
            sub-menu <strong className="font-semibold text-stone-700">Tier Kad</strong> — nilai yang dipinda dipapar
            berwarna kuning air di sini.
          </p>
          <p>
            <strong className="font-semibold text-stone-700">Editor.</strong>{' '}
            Klik nama (atau "Belum ditugaskan") untuk menetapkan siapa menguruskan slot itu. Satu slot boleh
            diuruskan lebih seorang editor, dan seorang editor boleh menguruskan lebih satu slot. Editor sesuatu
            Bidang tidak ditetapkan berasingan — ia terus mengikut slot milik Bidang tersebut.
          </p>
        </div>
      </PanelCard>

      {slotDisunting !== null && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onMouseDown={(e) => { mousedownPadaBackdropEditor.current = e.target === e.currentTarget; }}
          onClick={(e) => { if (e.target === e.currentTarget && mousedownPadaBackdropEditor.current && !menyimpan) setSlotDisunting(null); }}
        >
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-sm w-full p-5 space-y-3 text-xs" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-stone-200 pb-2">
              <h3 className="font-serif text-lg font-bold text-Adjung-maroon">
                Editor Slot {slotDisunting + 1}
              </h3>
              <button onClick={() => setSlotDisunting(null)} className="text-stone-400 hover:text-stone-700 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>

            <p className="text-stone-500 text-[10px] leading-relaxed">
              Tanda setiap editor yang diamanahkan menguruskan slot ini. Mereka juga secara automatik
              bertanggungjawab ke atas Bidang slot ini.
            </p>

            {pengguna.length === 0 ? (
              <KeadaanKosong>Tiada pengguna dalam sistem.</KeadaanKosong>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-Adjung-line border border-stone-200 rounded">
                {pengguna.map(u => {
                  const ditanda = drafEditor.includes(u.id);
                  return (
                    <label key={u.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-stone-50">
                      <input
                        type="checkbox"
                        checked={ditanda}
                        onChange={() => setDrafEditor(prev => ditanda ? prev.filter(x => x !== u.id) : [...prev, u.id])}
                        className="w-3.5 h-3.5 rounded border-stone-300 text-Adjung-maroon cursor-pointer"
                      />
                      <span className="font-semibold text-stone-800">{u.penName || u.username}</span>
                      {/* Label peranan (2026-08-05) — `u.role` ialah lajur LEGASI satu-nilai, bukan
                          `roles[]` RBAC 4-peranan sebenar (lihat core/middleware/auth.js). Ia tak
                          boleh dipercayai sebagai peranan sebenar seseorang: akaun boleh pegang
                          BERBILANG peranan, dan lajur legasi ni cuma gerbang binari lama. Dipapar
                          sebagai petunjuk kasar sahaja; dahulu nilai luar dua-duanya (cth
                          PENTADBIR) bocor sebagai kod mentah huruf besar. Peranan MUKTAMAD diurus
                          di Direktori, bukan skrin ni. */}
                      <span className="text-[10px] text-stone-400 ml-auto">{LABEL_PERANAN_LEGASI[u.role || ''] || '—'}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {ralat && <MesejStatus tone="error">{ralat}</MesejStatus>}

            <div className="pt-2 border-t border-stone-200 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSlotDisunting(null)} disabled={menyimpan}>
                Batal
              </Button>
              <Button variant="primary" onClick={simpanEditor} disabled={menyimpan}>
                {menyimpan ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {slotTetapan !== null && drafTetapan && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onMouseDown={(e) => { mousedownPadaBackdropTetapan.current = e.target === e.currentTarget; }}
          onClick={(e) => { if (e.target === e.currentTarget && mousedownPadaBackdropTetapan.current && !menyimpanTetapan) setSlotTetapan(null); }}
        >
          {/* max-w-2xl (bukan max-w-sm) — modal ni borang tetapan berbilang medan, dan Pelan 03
              akan MENAMBAH medan lagi di sini; anatomi modal piawai (Pelan 01 D2) cuma benarkan
              dua saiz, jadi saiz kandungan/borang panjang ialah pilihan yang betul. */}
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4 text-xs" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-stone-200 pb-2">
              <h3 className="font-serif text-lg font-bold text-Adjung-maroon">
                Tetapan Kad — Slot {slotTetapan + 1}
              </h3>
              <button onClick={() => setSlotTetapan(null)} className="text-stone-400 hover:text-stone-700 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>

            <div className="flex flex-col gap-1">
              <span className={LABEL_BORANG}>Bidang</span>
              <select
                value={drafTetapan.manualDesk}
                onChange={e => setDrafTetapan(p => p ? { ...p, manualDesk: e.target.value } : p)}
                className={INPUT_BORANG}
              >
                <option value="">— Belum ditetapkan —</option>
                {bidangList.map(b => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
              <p className="text-stone-400 text-[9px] leading-relaxed">
                Pertukaran Bidang tidak retroaktif — kandungan sedia ada dalam slot ini akan diarkibkan
                secara automatik jika Bidang ditukar (tidak lagi sepadan Bidang terkunci baharu).
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <span className={LABEL_BORANG}>Warna Latar Kad</span>
              <div className="flex gap-2 flex-wrap items-center">
                {[{ label: 'Telus', value: 'transparent' }, ...WARNA_PRATETAP].map(opt => {
                  const dipilih = (drafTetapan.bgColor || 'transparent') === opt.value;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      title={opt.label}
                      onClick={() => setDrafTetapan(p => p ? { ...p, bgColor: opt.value } : p)}
                      className={`w-7 h-7 rounded-full border-2 cursor-pointer flex items-center justify-center ${dipilih ? 'border-Adjung-maroon scale-110' : 'border-stone-300'}`}
                      style={{
                        backgroundColor: opt.value === 'transparent' ? '#ffffff' : opt.value,
                        backgroundImage: opt.value === 'transparent' ? 'repeating-conic-gradient(#d6d3d1 0% 25%, #ffffff 0% 50%)' : undefined,
                        backgroundSize: opt.value === 'transparent' ? '6px 6px' : undefined,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className={LABEL_BORANG}>Warna Bingkai Kad</span>
              <div className="flex gap-2 flex-wrap items-center">
                {[{ label: 'Auto', value: '' }, ...WARNA_PRATETAP].map(opt => {
                  const dipilih = (drafTetapan.borderColor || '') === opt.value;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      title={opt.label}
                      onClick={() => setDrafTetapan(p => p ? { ...p, borderColor: opt.value } : p)}
                      className={`w-7 h-7 rounded-full border-2 cursor-pointer flex items-center justify-center ${dipilih ? 'border-Adjung-maroon scale-110' : 'border-stone-300'}`}
                      style={{
                        backgroundColor: opt.value === '' ? '#ffffff' : opt.value,
                        backgroundImage: opt.value === '' ? 'repeating-conic-gradient(#d6d3d1 0% 25%, #ffffff 0% 50%)' : undefined,
                        backgroundSize: opt.value === '' ? '6px 6px' : undefined,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Selang Carousel (saat)</span>
                <input
                  type="number" min={1}
                  value={drafTetapan.carouselInterval}
                  onChange={e => setDrafTetapan(p => p ? { ...p, carouselInterval: Math.max(1, parseInt(e.target.value) || 10) } : p)}
                  className={INPUT_BORANG}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Lengah Mula (saat)</span>
                <input
                  type="number" min={0}
                  value={drafTetapan.carouselDelay}
                  onChange={e => setDrafTetapan(p => p ? { ...p, carouselDelay: Math.max(0, parseInt(e.target.value) || 0) } : p)}
                  className={INPUT_BORANG}
                />
              </div>
            </div>

            {/* Animasi transisi PER-SLOT (2026-08-07, permintaan Izzat eksplisit — "semua ni
                [jenis + arah animasi per-slot] boleh ditetapkan di modul Slot-Senarai Slot",
                BUKAN Tetapan Am Slot — Tetapan Am kekal hanya utk togol aktif/nyahaktif +
                kelajuan, lihat TetapanAmSlotConsole.tsx). '' = guna tetapan LALAI (Tetapan Am
                Slot); pilihan lain override slot NI SAHAJA. */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Jenis Animasi</span>
                <select
                  value={drafTetapan.jenisAnimasiOverride}
                  onChange={e => setDrafTetapan(p => p ? { ...p, jenisAnimasiOverride: e.target.value } : p)}
                  className={INPUT_BORANG}
                >
                  <option value="">Guna tetapan lalai</option>
                  <option value="pudar">Pudar (1 saat)</option>
                  <option value="colophon">Colophon (panel maroon menegak)</option>
                  <option value="sapuan_lajur">Sapuan Lajur (panel maroon sapu)</option>
                  <option value="gerak_susun">Gerak Susun (kandungan+logo bergerak)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Arah Animasi</span>
                <select
                  value={drafTetapan.arahOverride}
                  onChange={e => setDrafTetapan(p => p ? { ...p, arahOverride: e.target.value } : p)}
                  className={INPUT_BORANG}
                >
                  <option value="">Guna tetapan lalai</option>
                  <option value="kanan">Kanan</option>
                  <option value="kiri">Kiri</option>
                  <option value="atas">Atas</option>
                  <option value="bawah">Bawah</option>
                </select>
              </div>
            </div>
            <p className="text-stone-400 text-[10px] leading-relaxed -mt-1">
              Gerak Susun cuma sokong arah Kanan/Kiri — Atas/Bawah jatuh balik ke Kanan utknya.
              Animasi cuma berlaku bila slot ni ada &gt;1 kandungan (carousel) DAN togol animasi
              di Tetapan Am aktif.
            </p>

            {/* Warna panel / kelajuan / logo PER-SLOT (2026-08-07, Pelan 03 — arahan Izzat: "saya
                nak frontpage tidak membosankan"). Ikut konvensyen yang SAMA seperti dua kawalan di
                atas: kosong = warisi Tetapan Am, nilai = override slot ni sahaja. Nilai am semasa
                ditunjukkan dalam label supaya Ketua Editor nampak apa yang diwarisi. */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Warna Panel Transisi</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={drafTetapan.warnaPanelOverride || amWarnaPanel}
                    onChange={e => setDrafTetapan(p => p ? { ...p, warnaPanelOverride: e.target.value } : p)}
                    className="h-8 w-12 shrink-0 cursor-pointer rounded border border-stone-300 bg-white p-0.5"
                    aria-label="Warna panel transisi slot ini"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDrafTetapan(p => p ? { ...p, warnaPanelOverride: '' } : p)}
                    disabled={!drafTetapan.warnaPanelOverride}
                  >
                    Ikut Am
                  </Button>
                </div>
                <span className="text-stone-400 text-[10px]">
                  {drafTetapan.warnaPanelOverride
                    ? `Khusus slot ini: ${drafTetapan.warnaPanelOverride}`
                    : `Ikut Tetapan Am — kini ${amWarnaPanel}`}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Kelajuan Animasi</span>
                <select
                  value={drafTetapan.kelajuanOverride}
                  onChange={e => setDrafTetapan(p => p ? { ...p, kelajuanOverride: e.target.value } : p)}
                  className={INPUT_BORANG}
                >
                  <option value="">Guna tetapan lalai ({amKelajuan}&times;)</option>
                  <option value="0.5">0.5&times; (dua kali lebih pantas)</option>
                  <option value="1">1&times; (biasa)</option>
                  <option value="1.5">1.5&times;</option>
                  <option value="2">2&times; (dua kali lebih perlahan)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className={LABEL_BORANG}>Logo dalam Panel Transisi</span>
              <select
                value={drafTetapan.logoTransisiMode}
                onChange={e => setDrafTetapan(p => p ? { ...p, logoTransisiMode: e.target.value } : p)}
                className={INPUT_BORANG}
              >
                <option value="">Guna tetapan lalai (giliran Adjung &amp; penaja)</option>
                <option value="adjung">Logo Adjung sahaja</option>
                <option value="penaja">Logo penaja sahaja</option>
                <option value="tiada">Tanpa logo</option>
              </select>
              <span className="text-stone-400 text-[10px] leading-relaxed">
                &quot;Logo penaja sahaja&quot; jatuh balik ke logo Adjung apabila tiada penaja
                bertanda tayang bagi bulan semasa — panel tidak pernah kosong.
              </span>
            </div>

            {ralatTetapan && <MesejStatus tone="error">{ralatTetapan}</MesejStatus>}

            <div className="pt-2 border-t border-stone-200 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSlotTetapan(null)} disabled={menyimpanTetapan}>
                Batal
              </Button>
              <Button variant="primary" onClick={simpanTetapan} disabled={menyimpanTetapan}>
                {menyimpanTetapan ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Panel senarai Aktif/Menunggu (2026-08-06) — klik angka di jadual buka ni. Tarikh jadual
          (scheduledExpiresAt/scheduledPublishAt) cuma wujud kalau Ketua Editor/Penolong sengaja
          tetapkan Jadual Terbit/Luput (Fasa 8, pilihan — bukan wajib); kandungan tanpa jadual
          papar label jujur "Tiada jadual (manual)", bukan tarikh rekaan. */}
      {panelSenarai && (
        <div
          className="fixed inset-0 z-[60] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onMouseDown={(e) => { mousedownPadaBackdropPanel.current = e.target === e.currentTarget; }}
          onClick={(e) => { if (e.target === e.currentTarget && mousedownPadaBackdropPanel.current) setPanelSenarai(null); }}
        >
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-3 text-xs font-sans">
            <div className="flex justify-between items-center border-b border-stone-200 pb-2">
              <h3 className="font-serif text-lg font-bold text-Adjung-maroon">
                Slot {panelSenarai.slotIndex + 1} — {panelSenarai.jenis === 'aktif' ? 'Kandungan Aktif' : 'Kandungan Menunggu'}
              </h3>
              <button type="button" onClick={() => setPanelSenarai(null)} className="text-stone-400 hover:text-stone-700 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div>
              {(panelSenarai.jenis === 'aktif' ? aktifPerSlot[panelSenarai.slotIndex] : menungguPerSlot[panelSenarai.slotIndex] || [])?.map((k) => {
                const tarikh = panelSenarai.jenis === 'aktif' ? formatTarikhMasa(k.scheduledExpiresAt) : formatTarikhMasa(k.scheduledPublishAt);
                return (
                  <div key={k.id} className={`py-2.5 ${GARIS_BARIS}`}>
                    <p className="font-serif text-stone-800 font-semibold">{k.tajuk}</p>
                    <p className="text-[10px] text-stone-500 mt-0.5">
                      {panelSenarai.jenis === 'aktif' ? (
                        tarikh ? <>Akan terarkib: <span className="font-semibold text-stone-700">{tarikh}</span></> : 'Tiada jadual (kekal aktif sehingga digantikan manual)'
                      ) : tarikh ? (
                        <>Akan aktif: <span className="font-semibold text-stone-700">{tarikh}</span></>
                      ) : k.sebabMenunggu === 'slot_penuh' ? (
                        // Dua jenis Menunggu (2026-08-06) — dah lulus keputusan, cuma tunggu ruang
                        // kosong dalam slot (hadKandunganSlot). Naik taraf AUTOMATIK bila ruang
                        // wujud (Arkib/Tolak/Luput berjadual) — tiada tindakan manusia diperlukan.
                        <span className="text-amber-700 font-semibold">Sudah lulus — menunggu slot kosong (naik taraf automatik)</span>
                      ) : (
                        'Menunggu kelulusan Ketua Editor/Penolong (tiada jadual)'
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SenaraiSlotConsole;
