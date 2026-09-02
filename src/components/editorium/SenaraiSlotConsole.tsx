import React, { useEffect, useState } from 'react';
import { bacaJsonSelamat } from '../../utils/bacaJson';
import { Check } from 'lucide-react';
import { BidangIcon } from '../common/BidangIcon';
import { Tooltip } from '../common/Tooltip';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { KeadaanMemuat } from '../common/KeadaanMemuat';
import { Button } from '../common/Button';
import { AmaranBelumSimpan } from '../common/AmaranBelumSimpan';
import { FormColumn } from '../common/FormColumn';
import { LABEL_BORANG, INPUT_BORANG, KEPALA_JADUAL, GARIS_BARIS } from '../common/gayaKongsi';
import { EditorDialog } from '../common/EditorDialog';
import { AnimasiPratonton } from './AnimasiPratonton';
import { useAmaranBelumSimpan } from '../../hooks/useAmaranBelumSimpan';
import {
  GEOMETRY_RATIOS, TIER_SLOTS, TIER_LABELS, TIER_LABEL_IS_ENGLISH, tierForSlot,
} from '../../../core/editorial/GeometryConfig.js';
import { JENIS_ANIMASI_ASAS, pilihJenisRawak } from '../../../core/editorial/AnimasiConfig.js';

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
  carouselIntervalOverride?: number | null;
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

// Bentuk draf modal "Tetapan Kad" — dikongsi antara komponen induk dan `TetapanSlotModal`
// supaya nilai semasa dan nilai-awal (untuk semakan kotor §B2) sentiasa sepadan jenis.
interface DrafTetapan {
  manualDesk: string; bgColor: string; borderColor: string; carouselIntervalOverride: number | null; carouselDelay: number;
  jenisAnimasiOverride: string; arahOverride: string; warnaPanelOverride: string; kelajuanOverride: string; logoTransisiMode: string;
  nisbahPenajaTransisiOverride: string;
}

interface Props {
  currentEditoriumRole?: string;
  // Navigasi terarah ke Indeks yang sudah ditapis (WF-06, Pusingan 5, audit ChatGPT
  // 2026-08-09) — klik kiraan "Menunggu" terus ke Indeks (Slot + Status=Menunggu Semakan)
  // dgn tindakan Lulus/Tolak sebenar, gantikan panel baca-sahaja lama yang cuma senaraikan
  // tajuk tanpa apa-apa boleh dibuat terhadapnya.
  onLihatIndeks?: (opts: { slot?: string; status?: string }) => void;
  // Konteks editor dibawa dari Direktori (WF-05, Pusingan 5, audit ChatGPT 2026-08-09) —
  // "Urus Penugasan Slot" dahulu cuma tukar tab, Ketua Editor kena scan 38 baris sendiri cari
  // editor tu. `generasi` bertambah setiap panggilan supaya klik pada editor SAMA dua kali
  // berturut-turut tetap mencetuskan semula penapis (cth selepas "Kosongkan" ditekan).
  editorAwal?: { nama: string; generasi: number };
}

export const SenaraiSlotConsole: React.FC<Props> = ({ currentEditoriumRole, onLihatIndeks, editorAwal }) => {
  const [filterEditor, setFilterEditor] = useState<string | null>(null);
  useEffect(() => {
    if (editorAwal?.nama) setFilterEditor(editorAwal.nama);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorAwal?.generasi]);
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
  // Bendera kegagalan (UX-08 lanjutan, audit ChatGPT 2026-08-08) — Promise.all di bawah
  // dahulu senyap jatuh balik ke [] bagi SETIAP fetch apabila gagal, lalu jadual terus papar
  // "Aktif: 0, Menunggu: 0" utk semua slot — tak boleh dibezakan drpd sistem sihat yang
  // memang kosong. Kini kegagalan disahkan status semula (bukan reka data).
  const [gagalMuat, setGagalMuat] = useState(false);

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
  // Backdrop-click guard untuk modal-modal di bawah (lihat LoginModal.tsx, pepijat Izzat
  // 2026-08-07) — dipindahkan ke dalam setiap komponen modal sendiri (§G1/G2/B2, 2026-08-07)
  // supaya perangkap fokus EditorDialog/`useAmaranBelumSimpan` mempunyai kitaran hayat lekap/lucutkan
  // sebenar (modal buka/tutup = komponen dilekap/dilucutkan), bukan sekadar JSX bersyarat
  // dalam komponen induk yang sentiasa hidup.

  // Penyuntingan editor: satu slot pada satu masa, disimpan sebagai senarai penuh (bukan
  // tambah/buang satu-satu) supaya tiada keadaan separuh siap.
  const [slotDisunting, setSlotDisunting] = useState<number | null>(null);
  const [drafEditor, setDrafEditor] = useState<string[]>([]);
  // Nilai draf SEMASA modal dibuka (§B2) — perbandingan drafEditor semasa dengan ni menentukan
  // "kotor" (ada perubahan belum disimpan), tanpa kira susunan tanda/nyahtanda.
  const [drafEditorAwal, setDrafEditorAwal] = useState<string[]>([]);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);

  // Tetapan kad (Bidang/warna/carousel) — Fasa 7, "pintu masuk sah dalam Editorium untuk
  // tetapan per-slot". Sebelum ni satu-satunya jalan ubah medan ni ialah borang lama di
  // FrontpageView.tsx, dicapai lalui pautan bocor ?openTicker=1-macam — dibuang terus di sini
  // (bukan buka borang lama itu) sebab borang tu turut papar medan sunting KANDUNGAN, yang
  // sepatutnya cuma lalui SlotManagerModal Editorium sejak pemisahan 2026-07-29.
  const [slotTetapan, setSlotTetapan] = useState<number | null>(null);
  const [drafTetapan, setDrafTetapan] = useState<DrafTetapan | null>(null);
  // Nilai draf SEMASA modal dibuka (§B2) — sama tujuan seperti drafEditorAwal di atas.
  const [drafTetapanAwal, setDrafTetapanAwal] = useState<DrafTetapan | null>(null);
  const [menyimpanTetapan, setMenyimpanTetapan] = useState(false);

  // Nilai Tetapan Am semasa (2026-08-07, Pelan 03) — dipapar dalam label kawalan per-slot supaya
  // Ketua Editor nampak apa yang sebenarnya diwarisi apabila kawalan dibiar "Ikut Am", bukan
  // sekadar perkataan "lalai" yang tak memberitahu apa-apa.
  const [amWarnaPanel, setAmWarnaPanel] = useState('#802334');
  const [amKelajuan, setAmKelajuan] = useState(1);
  // Jenis animasi LALAI am (2026-08-16, keputusan Izzat: Arah/3b baca "Tidak berkaitan" bila
  // jenis EFEKTIF ialah Pudar) — perlu tahu jenis am supaya slot yang tak override langsung
  // (jenisAnimasiOverride='') tetap tunjuk "Tidak berkaitan" dgn betul, bukan cuma slot yang
  // override 'pudar' secara eksplisit. Corak sama seperti amWarnaPanel/amKelajuan di atas.
  const [amJenis, setAmJenis] = useState('pudar');
  // Arah LALAI am (2026-08-16, keperluan Pratonton Animasi — Tetapan Kad perlu tahu arah
  // EFEKTIF slot, sama rasional amJenis di atas).
  const [amArah, setAmArah] = useState('kanan');
  // Kolam mod Rawak (2026-08-18) — sama rasional amJenis di atas: slot yang TAK override jenis
  // sendiri (jenisAnimasiOverride='') boleh jatuh balik ke jenisAnimasi am, yang kini boleh
  // bernilai 'rawak' — pratonton Tetapan Kad perlu tahu kolam ni utk resolusi jujur (§4 corak
  // sama TetapanAmSlotConsole.tsx).
  const [amJenisAnimasiRawakPool, setAmJenisAnimasiRawakPool] = useState<string[]>(JENIS_ANIMASI_ASAS);
  // Tempoh pertukaran carousel LALAI am (2026-08-26, permintaan Izzat: "kawalan tempoh akan jadi
  // tetapan global...kecuali ada slot yg guna tetapan sendiri") — sama rasional amJenis/amArah di
  // atas: medan "Tempoh Carousel" di bawah kini OVERRIDE (kosong = ikut ni), perlu tahu nilai am
  // supaya slot yang tak override tunjuk nilai EFEKTIF sebenar, bukan cuma placeholder teka.
  const [amCarouselTempohLalai, setAmCarouselTempohLalai] = useState(10);
  // Nisbah penaja transisi LALAI am (2026-08-26, permintaan Izzat: parity 100% dgn Tetapan Am) —
  // sama rasional amKelajuan di atas: medan "Nisbah Penaja" di bawah kini OVERRIDE (kosong = ikut
  // ni), perlu tahu nilai am supaya slot yang tak override tunjuk nilai EFEKTIF sebenar.
  const [amNisbahPenajaTransisi, setAmNisbahPenajaTransisi] = useState(0);
  useEffect(() => {
    let dibatal = false;
    fetch('/api/system/slot-am-settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (dibatal || !d) return;
        if (typeof d.warnaPanelTransisi === 'string' && d.warnaPanelTransisi) setAmWarnaPanel(d.warnaPanelTransisi);
        if (Number(d.kelajuanAnimasi) > 0) setAmKelajuan(Number(d.kelajuanAnimasi));
        if (typeof d.jenisAnimasi === 'string' && d.jenisAnimasi) setAmJenis(d.jenisAnimasi);
        if (typeof d.arahAnimasi === 'string' && d.arahAnimasi) setAmArah(d.arahAnimasi);
        if (Array.isArray(d.jenisAnimasiRawakPool) && d.jenisAnimasiRawakPool.length) setAmJenisAnimasiRawakPool(d.jenisAnimasiRawakPool);
        if (Number(d.carouselTempohLalai) > 0) setAmCarouselTempohLalai(Number(d.carouselTempohLalai));
        if (Number.isInteger(Number(d.nisbahPenajaTransisi)) && Number(d.nisbahPenajaTransisi) >= 0) setAmNisbahPenajaTransisi(Number(d.nisbahPenajaTransisi));
      })
      .catch(() => { /* tetapan am tak dapat dibaca — label kekal nilai lalai, bukan ralat */ });
    return () => { dibatal = true; };
  }, []);
  const [ralatTetapan, setRalatTetapan] = useState<string | null>(null);
  // Kegagalan buka Tetapan Kad SEBELUM modal sempat mount (2A, audit ChatGPT 2026-08-09) —
  // dahulu setRalatTetapan() dipanggil tapi TetapanSlotModal cuma render bila slotTetapan
  // DAN drafTetapan kedua-duanya ada (baris 573), yang cuma ditetapkan pada KEJAYAAN. Jadi
  // ralat tersimpan dalam state yang tak pernah dirender — kegagalan senyap sepenuhnya. Guna
  // banner peringkat-halaman (sama corak macam gagalMuat) supaya sentiasa kelihatan + boleh
  // cuba lagi tanpa muat semula seluruh halaman.
  const [slotTetapanGagalUntuk, setSlotTetapanGagalUntuk] = useState<number | null>(null);
  // Konflik penyuntingan serentak (§F3) — true khusus apabila pelayan menolak simpan dengan 409
  // (slot ni sudah disimpan orang lain sejak dibuka). Menentukan sama ada butang "Salin draf
  // saya ke papan klip" dipapar di sebelah mesej ralat.
  const [ralatTetapanKonflik, setRalatTetapanKonflik] = useState(false);

  // Muat SEMULA baris penuh terus dari server semasa buka (bukan guna salinan `slots` dalam
  // ingatan) — sama sebab seperti useSlotEditor.openSlotEditor: elak menimpa simpanan terkini
  // orang lain, dan dapatkan token `updatedAt` segar untuk kawalan serentak (Fasa 6).
  const bukaTetapan = async (slotIndex: number) => {
    setRalatTetapan(null);
    setRalatTetapanKonflik(false);
    setSlotTetapanGagalUntuk(null);
    try {
      const res = await fetch('/api/system/slots');
      const data = await bacaJsonSelamat(res);
      const baris = Array.isArray(data) ? data.find((s: any) => s.slotIndex === slotIndex) : null;
      if (!baris) throw new Error('Slot tidak dijumpai.');
      setSlots((prev) => prev.map((s) => (s.slotIndex === slotIndex ? baris : s)));
      const nilaiAwal: DrafTetapan = {
        manualDesk: baris.manualDesk || '',
        bgColor: baris.bgColor || 'transparent',
        borderColor: baris.borderColor || '',
        carouselIntervalOverride: Number(baris.carouselIntervalOverride) > 0 ? Number(baris.carouselIntervalOverride) : null,
        carouselDelay: baris.carouselDelay || 0,
        jenisAnimasiOverride: baris.jenisAnimasiOverride || '',
        arahOverride: baris.arahOverride || '',
        warnaPanelOverride: baris.warnaPanelOverride || '',
        kelajuanOverride: baris.kelajuanOverride || '',
        logoTransisiMode: baris.logoTransisiMode || '',
        nisbahPenajaTransisiOverride: baris.nisbahPenajaTransisiOverride ?? '',
      };
      setDrafTetapan(nilaiAwal);
      setDrafTetapanAwal(nilaiAwal);
      setSlotTetapan(slotIndex);
    } catch (e: any) {
      // Modal Tetapan Kad TAK PERNAH mount (perlukan slotTetapan+drafTetapan kedua-duanya),
      // jadi ralatTetapan sahaja senyap. Simpan slotIndex ni supaya banner halaman kekal
      // kelihatan + "Cuba Lagi" boleh cuba slot yang SAMA semula.
      setRalatTetapan(e.message || 'Gagal memuatkan tetapan slot.');
      setSlotTetapanGagalUntuk(slotIndex);
    }
  };

  const tutupTetapan = () => {
    setSlotTetapan(null);
    setDrafTetapan(null);
    setDrafTetapanAwal(null);
    setRalatTetapan(null);
    setRalatTetapanKonflik(false);
  };

  const simpanTetapan = async () => {
    if (slotTetapan === null || !drafTetapan) return;
    setMenyimpanTetapan(true);
    setRalatTetapan(null);
    setRalatTetapanKonflik(false);
    try {
      // PEMBETULAN (2026-09-02, dapatan bug-hunt pusingan 9) — dahulu terus `.json()` tanpa
      // semak `res.ok`/bacaJsonSelamat (tak macam laluan POST simpan di bawah, yang sudah betul).
      // Respons rosak/ralat pelayan pada GET muat-semula ni (proksi timeout, 5xx HTML) jatuh ke
      // "Slot tidak dijumpai" yang mengelirukan (bukan sebab sebenar) — corak sama yang CLAUDE.md
      // catat sebagai bendera merah am ("throw new Error() tanpa mesej sebenar").
      const semasaRes = await fetch('/api/system/slots');
      const semasaData = await bacaJsonSelamat(semasaRes);
      if (!semasaRes.ok) throw new Error(semasaData?.error || 'Gagal memuat semula tetapan slot semasa.');
      const semasa = Array.isArray(semasaData) ? semasaData.find((s: any) => s.slotIndex === slotTetapan) : null;
      if (!semasa) throw new Error('Slot tidak dijumpai.');
      const gabungan = { ...semasa, ...drafTetapan };
      const res = await fetch('/api/system/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gabungan),
      });
      const hasil = await bacaJsonSelamat(res);
      if (!res.ok) {
        setRalatTetapanKonflik(res.status === 409);
        throw new Error(hasil.error || 'Gagal menyimpan tetapan slot.');
      }
      const senaraiBaru = await fetch('/api/system/slots').then((r) => r.json());
      if (Array.isArray(senaraiBaru)) setSlots(senaraiBaru);
      setSlotTetapan(null);
      setDrafTetapan(null);
      setDrafTetapanAwal(null);
    } catch (e: any) {
      setRalatTetapan(e.message || 'Gagal menyimpan tetapan slot.');
    } finally {
      setMenyimpanTetapan(false);
    }
  };

  // Salin draf "Tetapan Kad" belum disimpan ke papan klip (§F3) — dipanggil oleh butang di
  // sebelah mesej konflik 409 supaya Ketua Editor tak perlu menaip semula selepas muat semula.
  const salinDrafTetapanKePapanKlip = async () => {
    if (slotTetapan === null || !drafTetapan) return;
    const teks = [
      `Slot: ${slotTetapan + 1}`,
      `Bidang: ${drafTetapan.manualDesk || ''}`,
      `Warna Latar: ${drafTetapan.bgColor || ''}`,
      `Warna Bingkai: ${drafTetapan.borderColor || ''}`,
      `Selang Carousel (saat): ${drafTetapan.carouselIntervalOverride ?? '(guna tetapan lalai)'}`,
      `Lengah Mula (saat): ${drafTetapan.carouselDelay}`,
      `Jenis Animasi: ${drafTetapan.jenisAnimasiOverride || '(guna tetapan lalai)'}`,
      `Arah Animasi: ${drafTetapan.arahOverride || '(guna tetapan lalai)'}`,
      `Warna Panel Transisi: ${drafTetapan.warnaPanelOverride || '(guna tetapan lalai)'}`,
      `Kelajuan Animasi: ${drafTetapan.kelajuanOverride || '(guna tetapan lalai)'}`,
      `Logo dalam Panel: ${drafTetapan.logoTransisiMode || '(guna tetapan lalai)'}`,
      `Nisbah Penaja Transisi: ${drafTetapan.nisbahPenajaTransisiOverride !== '' ? drafTetapan.nisbahPenajaTransisiOverride : '(guna tetapan lalai)'}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(teks);
    } catch (e) {
      console.error('Gagal menyalin draf tetapan ke papan klip:', e);
    }
  };

  const muatPenugasan = () =>
    fetch('/api/system/slot-editors')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPenugasan(d); })
      .catch(() => {});

  // Diasingkan jadi fungsi boleh panggil semula (2A, audit ChatGPT 2026-08-09, SLOT-1) —
  // dahulu terus dalam useEffect, jadi satu-satunya jalan pulih bila gagal ialah muat semula
  // SELURUH halaman pelayar. Kini boleh cuba semula tanpa refresh, ikut corak onCubaLagi
  // sedia ada di IndeksConsole/DrafSayaConsole.
  const muatSemuaData = () => {
    setLoading(true);
    const GAGAL = Symbol('gagal');
    Promise.all([
      fetch('/api/system/slots').then(r => r.json()).catch(() => GAGAL),
      fetch('/api/system/categories/active').then(r => r.json()).catch(() => GAGAL),
      fetch('/api/system/categories/slot-usage').then(r => r.json()).catch(() => GAGAL),
      fetch('/api/system/tier-settings').then(r => r.json()).catch(() => GAGAL),
      fetch('/api/db-state').then(r => r.json()).catch(() => GAGAL),
      muatPenugasan(),
      fetch('/api/system/content/all').then(r => r.json()).catch(() => GAGAL),
    ])
      .then(([slotRows, bidangRows, usageRows, tierRows, dbState, , semuaKandungan]) => {
        setGagalMuat([slotRows, bidangRows, usageRows, tierRows, dbState, semuaKandungan].some(r => r === GAGAL));
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
  };

  useEffect(() => { muatSemuaData(); }, []);

  const formatTarikhMasa = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return null; }
  };

  const editorBagiSlot = (slotIndex: number) => penugasan.filter(p => p.slotIndex === slotIndex);
  const barisDipapar = filterEditor
    ? SLOT_INDEXES.filter(i => editorBagiSlot(i).some(p => p.nama === filterEditor))
    : SLOT_INDEXES;

  const bukaEditor = (slotIndex: number) => {
    setRalat(null);
    setSlotDisunting(slotIndex);
    const awal = editorBagiSlot(slotIndex).map(p => p.editorId);
    setDrafEditor(awal);
    setDrafEditorAwal(awal);
  };

  const tutupEditor = () => {
    setSlotDisunting(null);
    setDrafEditorAwal([]);
    setRalat(null);
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
      const data = await bacaJsonSelamat(res);
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
            {SLOT_INDEXES.length} slot bento, tidak termasuk Ticker dan tier <em>Bar</em>, yang diuruskan di Modul Khas.
            Jumlah {jumlahAktif} kandungan aktif, {jumlahMenunggu} menunggu kelulusan.
          </>
        }
      />

      {/* Kegagalan buka Tetapan Kad (2A, audit ChatGPT 2026-08-09) — dahulu senyap, modal tak
          pernah mount jadi ralat tak pernah kelihatan. Banner peringkat-halaman + Cuba Lagi. */}
      {slotTetapanGagalUntuk !== null && ralatTetapan && (
        <MesejStatus tone="error" onCubaLagi={() => bukaTetapan(slotTetapanGagalUntuk)}>
          {ralatTetapan}
        </MesejStatus>
      )}

      <PanelCard className="space-y-4 text-xs">
        {loading ? (
          <KeadaanMemuat baris={6} />
        ) : gagalMuat ? (
          // SLOT-1 (2A, audit ChatGPT 2026-08-09) — ini RALAT, bukan keadaan kosong; dahulu
          // KeadaanKosong (salah semantik) + tiada jalan pulih selain muat semula seluruh
          // halaman. MesejStatus + onCubaLagi ikut corak sedia ada di IndeksConsole/DrafSaya.
          <MesejStatus tone="error" onCubaLagi={muatSemuaData}>
            Gagal memuatkan sebahagian data slot.
          </MesejStatus>
        ) : (
          <>
            {filterEditor && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-Adjung-maroon/30 bg-Adjung-maroon/5 px-3 py-2 mb-3 text-xs">
                <span className="text-stone-700">
                  Menapis slot kepunyaan: <span className="font-semibold">{filterEditor}</span>
                  {' '}({barisDipapar.length} slot)
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setFilterEditor(null)}>Kosongkan</Button>
              </div>
            )}
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
                {barisDipapar.map(i => {
                  const tier = tierForSlot(i) as keyof typeof GEOMETRY_RATIOS;
                  // Nilai berkuat kuasa (termasuk pindaan Tier Kad); GEOMETRY_RATIOS cuma sandaran
                  // sekiranya panggilan API gagal.
                  const had = hadTier[tier] || GEOMETRY_RATIOS[tier];
                  const dipinda = !!hadTier[tier]?.dipinda;
                  const cfg = slots.find(s => s.slotIndex === i);
                  const namaBidang = (usage.find(u => u.slotIndex === i)?.bidang || cfg?.manualDesk || '').trim();
                  const bidang = bidangFor(namaBidang);
                  const live = usage.find(u => u.slotIndex === i)?.liveCount || 0;
                  // Nilai EFEKTIF (2026-08-26) — override per-slot (cfg.carouselIntervalOverride)
                  // MENGATASI lalai global (amCarouselTempohLalai, Tetapan Am Slot); lajur
                  // carouselInterval LAMA tak lagi dibaca di sini (vestigial, lihat server.js).
                  const selangOverride = Number(cfg?.carouselIntervalOverride) > 0 ? Number(cfg?.carouselIntervalOverride) : null;
                  const selang = selangOverride ?? amCarouselTempohLalai;
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
                      <Tooltip text={dipinda ? 'Had dipinda di Tier Kad' : undefined}>
                        <td className={`p-2.5 text-right font-mono ${dipinda ? 'text-amber-700 font-bold' : 'text-stone-700'}`}>{had.maxTitleAlone}</td>
                      </Tooltip>
                      <Tooltip text={dipinda ? 'Had dipinda di Tier Kad' : undefined}>
                        <td className={`p-2.5 text-right font-mono ${dipinda ? 'text-amber-700 font-bold' : 'text-stone-700'}`}>{had.maxBriefAlone}</td>
                      </Tooltip>
                      <td className="p-2.5 text-stone-600">
                        {selang ? (
                          <span className="font-mono text-[10px]">
                            {selang}s{!selangOverride ? ' (lalai)' : ''}{lengah ? ` · lengah ${lengah}s` : ''}
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
                            onClick={() => onLihatIndeks
                              ? onLihatIndeks({ slot: `Slot ${i + 1}`, status: 'Pending' })
                              : setPanelSenarai({ slotIndex: i, jenis: 'menunggu' })}
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
                          <Tooltip text="Tetapkan editor yang menguruskan slot ini">
                            <button
                              type="button"
                              onClick={() => bukaEditor(i)}
                              aria-label="Tetapkan editor yang menguruskan slot ini"
                              className="text-left hover:text-Adjung-maroon cursor-pointer group"
                            >
                              {editorBagiSlot(i).length === 0 ? (
                                <span className="text-stone-400 group-hover:text-Adjung-maroon">Belum ditugaskan</span>
                              ) : (
                                <span className="text-stone-700 group-hover:text-Adjung-maroon">
                                  {editorBagiSlot(i).map(p => p.nama).join(', ')}
                                </span>
                              )}
                            </button>
                          </Tooltip>
                        ) : (
                          editorBagiSlot(i).length === 0 ? (
                            <span className="text-stone-400">Belum ditugaskan</span>
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
          </>
        )}

        <div className="border-t border-Adjung-line pt-3 space-y-1.5 text-[10px] text-stone-500 leading-relaxed">
          <p>
            <strong className="font-semibold text-stone-700">Had aksara ikut bentuk, bukan ikut slot.</strong>{' '}
            Semua slot yang sama bentuk berkongsi had yang sama, ia datang daripada saiz fizikal kad itu sendiri.
            Tajuk dan huraian pula berkongsi SATU bajet ruang: tajuk panjang mengecilkan ruang huraian, dan sebaliknya.
            Nombor di atas ialah had setiap medan apabila medan satu lagi kosong. Untuk meminda, pergi ke
            sub-menu <strong className="font-semibold text-stone-700">Tier Kad</strong>; nilai yang dipinda dipapar
            berwarna kuning air di sini.
          </p>
          <p>
            <strong className="font-semibold text-stone-700">Editor.</strong>{' '}
            Klik nama (atau "Belum ditugaskan") untuk menetapkan siapa menguruskan slot itu. Satu slot boleh
            diuruskan lebih seorang editor, dan seorang editor boleh menguruskan lebih satu slot. Editor sesuatu
            Bidang tidak ditetapkan berasingan, ia terus mengikut slot milik Bidang tersebut.
          </p>
        </div>
      </PanelCard>

      {slotDisunting !== null && (
        <EditorSlotModal
          slotIndex={slotDisunting}
          pengguna={pengguna}
          drafEditor={drafEditor}
          setDrafEditor={setDrafEditor}
          drafEditorAwal={drafEditorAwal}
          menyimpan={menyimpan}
          ralat={ralat}
          onSimpan={simpanEditor}
          onTutup={tutupEditor}
        />
      )}

      {slotTetapan !== null && drafTetapan && (
        <TetapanSlotModal
          slotIndex={slotTetapan}
          bidangList={bidangList}
          draf={drafTetapan}
          setDraf={setDrafTetapan}
          drafAwal={drafTetapanAwal}
          amWarnaPanel={amWarnaPanel}
          amKelajuan={amKelajuan}
          amJenis={amJenis}
          amArah={amArah}
          amJenisAnimasiRawakPool={amJenisAnimasiRawakPool}
          amCarouselTempohLalai={amCarouselTempohLalai}
          amNisbahPenajaTransisi={amNisbahPenajaTransisi}
          menyimpan={menyimpanTetapan}
          ralat={ralatTetapan}
          ralatKonflik={ralatTetapanKonflik}
          onSalinDraf={salinDrafTetapanKePapanKlip}
          onSimpan={simpanTetapan}
          onTutup={tutupTetapan}
        />
      )}

      {/* Panel senarai Aktif/Menunggu (2026-08-06) — klik angka di jadual buka ni. Tarikh jadual
          (scheduledExpiresAt/scheduledPublishAt) cuma wujud kalau Ketua Editor/Penolong sengaja
          tetapkan Jadual Terbit/Luput (Fasa 8, pilihan — bukan wajib); kandungan tanpa jadual
          papar label jujur "Tiada jadual (manual)", bukan tarikh rekaan. */}
      {panelSenarai && (
        <PanelSenaraiModal
          slotIndex={panelSenarai.slotIndex}
          jenis={panelSenarai.jenis}
          senarai={(panelSenarai.jenis === 'aktif' ? aktifPerSlot[panelSenarai.slotIndex] : menungguPerSlot[panelSenarai.slotIndex]) || []}
          formatTarikhMasa={formatTarikhMasa}
          onTutup={() => setPanelSenarai(null)}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-komponen modal (2026-08-07, Audit UI/UX Editorium §G1/G2/G4/G6/B2/J5/F3)
//
// Dipisahkan drpd JSX bersyarat dalam induk supaya perangkap fokus EditorDialog/`useAmaranBelumSimpan`
// dapat kitaran hayat lekap/lucutkan React SEBENAR — modal buka/tutup = komponen
// dilekap/dilucutkan, bukan cuma `{kondisi && <div>...}` dalam komponen induk yang sentiasa
// hidup (kalau cangkuk diletak di induk, `useEffect`-nya cuma jalan sekali semasa induk lekap,
// bukan setiap kali modal dibuka).
// ---------------------------------------------------------------------------

interface EditorSlotModalProps {
  slotIndex: number;
  pengguna: Pengguna[];
  drafEditor: string[];
  setDrafEditor: React.Dispatch<React.SetStateAction<string[]>>;
  drafEditorAwal: string[];
  menyimpan: boolean;
  ralat: string | null;
  onSimpan: () => void;
  onTutup: () => void;
}

const EditorSlotModal: React.FC<EditorSlotModalProps> = ({
  slotIndex, pengguna, drafEditor, setDrafEditor, drafEditorAwal, menyimpan, ralat, onSimpan, onTutup,
}) => {
  const kotor = drafEditor.length !== drafEditorAwal.length || !drafEditor.every(id => drafEditorAwal.includes(id));
  const { cubaTutup, tunjukAmaran, batalTutup, sahkanTutup } = useAmaranBelumSimpan(kotor, onTutup);

  return (
    <EditorDialog
      saiz="sm"
      tajuk={`Editor Slot ${slotIndex + 1}`}
      onTutup={() => { if (!menyimpan) cubaTutup(); }}
      tindakan={
        <>
          <Button variant="secondary" onClick={cubaTutup} disabled={menyimpan}>
            Batal
          </Button>
          <Button variant="primary" onClick={onSimpan} disabled={menyimpan}>
            {menyimpan ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {tunjukAmaran && <AmaranBelumSimpan onBatal={batalTutup} onSahkan={sahkanTutup} />}
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
      </div>
    </EditorDialog>
  );
};

interface TetapanSlotModalProps {
  slotIndex: number;
  bidangList: BidangRow[];
  draf: DrafTetapan;
  setDraf: React.Dispatch<React.SetStateAction<DrafTetapan | null>>;
  drafAwal: DrafTetapan | null;
  amWarnaPanel: string;
  amKelajuan: number;
  amJenis: string;
  amArah: string;
  amJenisAnimasiRawakPool: string[];
  amCarouselTempohLalai: number;
  amNisbahPenajaTransisi: number;
  menyimpan: boolean;
  ralat: string | null;
  ralatKonflik: boolean;
  onSalinDraf: () => void;
  onSimpan: () => void;
  onTutup: () => void;
}

const TetapanSlotModal: React.FC<TetapanSlotModalProps> = ({
  slotIndex, bidangList, draf, setDraf, drafAwal, amWarnaPanel, amKelajuan, amJenis, amArah, amJenisAnimasiRawakPool, amCarouselTempohLalai, amNisbahPenajaTransisi, menyimpan, ralat, ralatKonflik,
  onSalinDraf, onSimpan, onTutup,
}) => {
  // Jenis/arah/kelajuan/warna EFEKTIF slot ni — override sendiri, atau jatuh balik ke tetapan am
  // (2026-08-16). Perlu SEMUA empat untuk Pratonton Animasi papar kesan SEBENAR slot ni, sama
  // rasional jenisEfektifSlot yang sedia ada (Arah/3b "Tidak berkaitan"). Override
  // jenisAnimasiOverride TAK PERNAH 'rawak' (senarai pilihan override sengaja terhad 4 jenis
  // sedia ada, FrontpageView.tsx) — 'rawak' cuma boleh datang drpd `amJenis` (fallback global).
  const jenisEfektifSlot = draf.jenisAnimasiOverride || amJenis;
  const arahEfektifSlot = draf.arahOverride || amArah;
  const kelajuanEfektifSlot = Number(draf.kelajuanOverride) > 0 ? Number(draf.kelajuanOverride) : amKelajuan;
  const warnaEfektifSlot = draf.warnaPanelOverride || amWarnaPanel;
  // Nisbah EFEKTIF (2026-08-26, parity) — '' tidak boleh guna `||` (0 ialah nilai SAH "Adjung
  // sahaja", `0 || amNisbah` akan silap jatuh ke am walau editor sengaja pilih 0).
  const nisbahEfektifSlot = draf.nisbahPenajaTransisiOverride !== '' ? Number(draf.nisbahPenajaTransisiOverride) : amNisbahPenajaTransisi;
  const kotor = JSON.stringify(draf) !== JSON.stringify(drafAwal);
  const { cubaTutup, tunjukAmaran, batalTutup, sahkanTutup } = useAmaranBelumSimpan(kotor, onTutup);

  return (
    /* saiz="lg" (max-w-2xl, bukan "sm") — modal ni borang tetapan berbilang medan, dan Pelan 03
       akan MENAMBAH medan lagi di sini; anatomi modal piawai (Pelan 01 D2) cuma benarkan
       dua saiz, jadi saiz kandungan/borang panjang ialah pilihan yang betul. */
    <EditorDialog
      saiz="lg"
      tajuk={`Tetapan Kad, Slot ${slotIndex + 1}`}
      onTutup={() => { if (!menyimpan) cubaTutup(); }}
      tindakan={
        <>
          <Button variant="secondary" onClick={cubaTutup} disabled={menyimpan}>
            Batal
          </Button>
          <Button variant="primary" onClick={onSimpan} disabled={menyimpan}>
            {menyimpan ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {tunjukAmaran && <AmaranBelumSimpan onBatal={batalTutup} onSahkan={sahkanTutup} />}
        <div className="flex flex-col gap-1">
          <span className={LABEL_BORANG}>Bidang</span>
          {/* `sm` — senarai Bidang ialah nama pendek satu perkataan ("Ekonomi", "Kebudayaan");
              selebar modal 2xl ia memberi isyarat salah tentang panjang yang dijangka. Nota di
              bawah sengaja di LUAR lajur — ia teks penjelasan, bukan medan. */}
          <FormColumn saiz="sm">
            <select
              value={draf.manualDesk}
              onChange={e => setDraf(p => p ? { ...p, manualDesk: e.target.value } : p)}
              className={INPUT_BORANG}
            >
              <option value="">— Belum ditetapkan —</option>
              {bidangList.map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </FormColumn>
          <p className="text-stone-400 text-[9px] leading-relaxed">
            Pertukaran Bidang tidak retroaktif; kandungan sedia ada dalam slot ini akan diarkibkan
            secara automatik jika Bidang ditukar (tidak lagi sepadan Bidang terkunci baharu).
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <span className={LABEL_BORANG}>Warna Latar Kad</span>
          <div className="flex gap-2 flex-wrap items-center">
            {[{ label: 'Telus', value: 'transparent' }, ...WARNA_PRATETAP].map(opt => {
              const dipilih = (draf.bgColor || 'transparent') === opt.value;
              // Tanda semak (2026-08-07, Audit §J5) — dahulu pilihan semasa cuma ditanda dengan
              // bingkai+skala, isyarat WARNA sahaja. Kini ada tanda semak (bentuk) DAN
              // `aria-pressed` supaya pengguna buta warna/pembaca skrin juga tahu mana dipilih.
              return (
                <Tooltip key={opt.label} text={opt.label}>
                  <button
                    type="button"
                    aria-label={opt.label}
                    aria-pressed={dipilih}
                    onClick={() => setDraf(p => p ? { ...p, bgColor: opt.value } : p)}
                    className={`relative w-7 h-7 rounded-full border-2 cursor-pointer flex items-center justify-center ${dipilih ? 'border-Adjung-maroon scale-110' : 'border-stone-300'}`}
                    style={{
                      backgroundColor: opt.value === 'transparent' ? '#ffffff' : opt.value,
                      backgroundImage: opt.value === 'transparent' ? 'repeating-conic-gradient(#d6d3d1 0% 25%, #ffffff 0% 50%)' : undefined,
                      backgroundSize: opt.value === 'transparent' ? '6px 6px' : undefined,
                    }}
                  >
                    {dipilih && (
                      <Check
                        className="w-3.5 h-3.5 pointer-events-none"
                        strokeWidth={3}
                        style={{ color: (opt.value === 'transparent' || opt.value === '#FFFFFF') ? '#1F1F1F' : '#FFFFFF' }}
                      />
                    )}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className={LABEL_BORANG}>Warna Bingkai Kad</span>
          <div className="flex gap-2 flex-wrap items-center">
            {[{ label: 'Auto', value: '' }, ...WARNA_PRATETAP].map(opt => {
              const dipilih = (draf.borderColor || '') === opt.value;
              return (
                <Tooltip key={opt.label} text={opt.label}>
                  <button
                    type="button"
                    aria-label={opt.label}
                    aria-pressed={dipilih}
                    onClick={() => setDraf(p => p ? { ...p, borderColor: opt.value } : p)}
                    className={`relative w-7 h-7 rounded-full border-2 cursor-pointer flex items-center justify-center ${dipilih ? 'border-Adjung-maroon scale-110' : 'border-stone-300'}`}
                    style={{
                      backgroundColor: opt.value === '' ? '#ffffff' : opt.value,
                      backgroundImage: opt.value === '' ? 'repeating-conic-gradient(#d6d3d1 0% 25%, #ffffff 0% 50%)' : undefined,
                      backgroundSize: opt.value === '' ? '6px 6px' : undefined,
                    }}
                  >
                    {dipilih && (
                      <Check
                        className="w-3.5 h-3.5 pointer-events-none"
                        strokeWidth={3}
                        style={{ color: (opt.value === '' || opt.value === '#FFFFFF') ? '#1F1F1F' : '#FFFFFF' }}
                      />
                    )}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className={LABEL_BORANG}>Selang Carousel (saat)</span>
            {/* Override (2026-08-26, permintaan Izzat: "kawalan tempoh akan jadi tetapan global...
                kecuali ada slot yg guna tetapan sendiri") — KOSONG = ikut tetapan lalai (Tetapan Am
                Slot -> 1a), placeholder tunjuk nilai lalai SEMASA supaya Ketua Editor nampak apa
                yang sebenarnya diwarisi, bukan teka. Isi nombor = override slot NI SAHAJA. */}
            <input
              type="number" min={1} max={300}
              placeholder={`${amCarouselTempohLalai} (lalai)`}
              value={draf.carouselIntervalOverride ?? ''}
              onChange={e => {
                const teks = e.target.value;
                setDraf(p => p ? { ...p, carouselIntervalOverride: teks === '' ? null : Math.max(1, parseInt(teks) || 1) } : p);
              }}
              className={INPUT_BORANG}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={LABEL_BORANG}>Lengah Mula (saat)</span>
            <input
              type="number" min={0}
              value={draf.carouselDelay}
              onChange={e => setDraf(p => p ? { ...p, carouselDelay: Math.max(0, parseInt(e.target.value) || 0) } : p)}
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
              value={draf.jenisAnimasiOverride}
              onChange={e => setDraf(p => p ? { ...p, jenisAnimasiOverride: e.target.value } : p)}
              className={INPUT_BORANG}
            >
              <option value="">Guna tetapan lalai</option>
              <option value="pudar">Pudar</option>
              <option value="colophon">Colophon (panel maroon menegak)</option>
              <option value="sapuan_lajur">Sapuan Lajur (panel maroon sapu)</option>
              <option value="gerak_susun">Gerak Susun (kandungan+logo bergerak)</option>
              <option value="swipe">Swipe (kandungan menolak keluar/masuk)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={LABEL_BORANG}>Arah Animasi</span>
            {/* Pudar tiada arah — sama rasional TetapanAmSlotConsole.tsx 3b (2026-08-16, keputusan
                Izzat). `jenisEfektifSlot` (override slot ni ATAU jenis am) yang tentukan, bukan
                `draf.jenisAnimasiOverride` mentah — slot yang langsung tak override pun perlu
                tunjuk keadaan ni dgn betul bila jenis am semasa ialah Pudar. */}
            {jenisEfektifSlot === 'pudar' ? (
              <div className={`${INPUT_BORANG} bg-stone-100 text-stone-400 italic`}>
                Tidak berkaitan — Pudar tiada arah
              </div>
            ) : (
              <select
                value={draf.arahOverride}
                onChange={e => setDraf(p => p ? { ...p, arahOverride: e.target.value } : p)}
                className={INPUT_BORANG}
              >
                <option value="">Guna tetapan lalai</option>
                <option value="kanan">Kanan</option>
                <option value="kiri">Kiri</option>
                <option value="atas">Atas</option>
                <option value="bawah">Bawah</option>
              </select>
            )}
          </div>
        </div>
        <p className="text-stone-400 text-[10px] leading-relaxed -mt-1">
          Gerak Susun cuma sokong arah Kanan/Kiri; Atas/Bawah jatuh balik ke Kanan utknya.
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
                value={draf.warnaPanelOverride || amWarnaPanel}
                onChange={e => setDraf(p => p ? { ...p, warnaPanelOverride: e.target.value } : p)}
                className="h-8 w-12 shrink-0 cursor-pointer rounded border border-stone-300 bg-white p-0.5"
                aria-label="Warna panel transisi slot ini"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDraf(p => p ? { ...p, warnaPanelOverride: '' } : p)}
                disabled={!draf.warnaPanelOverride}
              >
                Ikut Am
              </Button>
            </div>
            <span className="text-stone-400 text-[10px]">
              {draf.warnaPanelOverride
                ? `Khusus slot ini: ${draf.warnaPanelOverride}`
                : `Ikut Tetapan Am, kini ${amWarnaPanel}`}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className={LABEL_BORANG}>Kelajuan Animasi</span>
            <select
              value={draf.kelajuanOverride}
              onChange={e => setDraf(p => p ? { ...p, kelajuanOverride: e.target.value } : p)}
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
          {/* `md`, bukan `sm` — teks pilihan terpanjang di sini ialah satu frasa penuh. */}
          <FormColumn saiz="md">
            <select
              value={draf.logoTransisiMode}
              onChange={e => setDraf(p => p ? { ...p, logoTransisiMode: e.target.value } : p)}
              className={INPUT_BORANG}
            >
              <option value="">Guna tetapan lalai (giliran Adjung &amp; penaja)</option>
              <option value="adjung">Logo Adjung sahaja</option>
              <option value="penaja">Logo penaja sahaja</option>
              <option value="tiada">Tanpa logo</option>
            </select>
          </FormColumn>
          <span className="text-stone-400 text-[10px] leading-relaxed">
            &quot;Logo penaja sahaja&quot; jatuh balik ke logo Adjung apabila tiada penaja
            bertanda tayang bagi bulan semasa; panel tidak pernah kosong.
          </span>
        </div>

        {/* Nisbah Penaja Transisi PER-SLOT (2026-08-26, permintaan Izzat: parity 100% dgn Tetapan
            Am) — corak IDENTIK medan Kelajuan Animasi di atas. Terpisah drpd "Logo dalam Panel
            Transisi" di atas: medan tu pilih SIAPA (Adjung/penaja/tiada) untuk slot ni khusus,
            medan ni pilih KEKERAPAN giliran penaja masuk (bila mod ikut giliran am, '' di atas). */}
        <div className="flex flex-col gap-1">
          <span className={LABEL_BORANG}>Nisbah Penaja Transisi</span>
          <select
            value={draf.nisbahPenajaTransisiOverride}
            onChange={e => setDraf(p => p ? { ...p, nisbahPenajaTransisiOverride: e.target.value } : p)}
            className={INPUT_BORANG}
          >
            <option value="">Guna tetapan lalai ({amNisbahPenajaTransisi === 0 ? 'Adjung sahaja' : `1 Adjung : ${amNisbahPenajaTransisi} penaja`})</option>
            <option value="0">Logo Adjung sahaja (tiada logo penaja)</option>
            <option value="1">1 Adjung : 1 penaja</option>
            <option value="2">1 Adjung : 2 penaja</option>
            <option value="3">1 Adjung : 3 penaja</option>
          </select>
        </div>

        {/* Pratonton — permintaan Izzat, papar kesan EFEKTIF slot ni (override sendiri ATAU
            warisan Tetapan Am), bukan cuma medan yang diisi di modal ni. Andaian: togol 3
            "Animasi transisi aktif" (Tetapan Am) dianggap HIDUP — modal ni tak fetch status togol
            tu sendiri, jadi kalau ia dinyahaktifkan semua slot sebenarnya pudar tak kira tetapan
            di sini (sama peraturan FrontpageView.tsx). */}
        <div className="border border-stone-200 rounded p-3">
          <span className={`${LABEL_BORANG} block mb-2`}>Pratonton (kesan sebenar slot ini)</span>
          <AnimasiPratonton
            jenis={
              jenisEfektifSlot === 'rawak'
                ? () => pilihJenisRawak(amJenisAnimasiRawakPool)
                : jenisEfektifSlot
            }
            arah={arahEfektifSlot}
            kelajuan={kelajuanEfektifSlot}
            warnaPanel={warnaEfektifSlot}
            logoMode={draf.logoTransisiMode || 'adjung'}
          />
          {/* AnimasiPratonton SENGAJA tak render logo penaja sebenar (lihat CLAUDE.md — cuma
              placeholder "Ruang Logo Penaja"/wordmark Adjung), jadi nisbah efektif dipaparkan
              sebagai teks di sini supaya editor nampak kesan medan di atas walau pratonton visual
              tak turut berubah. */}
          <p className="text-stone-400 text-[10px] mt-2">
            Nisbah penaja efektif: {nisbahEfektifSlot === 0 ? 'Logo Adjung sahaja' : `1 Adjung : ${nisbahEfektifSlot} penaja`}
          </p>
        </div>

        {ralat && (
          <MesejStatus tone="error">
            <span>
              {ralat}
              {/* Salin draf ke papan klip pada konflik 409 (Audit §F3) — Ketua Editor tak perlu
                  menaip semula tetapan ni selepas muat semula slot yang dicadangkan mesej ralat. */}
              {ralatKonflik && (
                <button
                  type="button"
                  onClick={onSalinDraf}
                  className="ml-2 font-semibold underline underline-offset-2 hover:no-underline cursor-pointer"
                >
                  Salin draf saya ke papan klip
                </button>
              )}
            </span>
          </MesejStatus>
        )}
      </div>
    </EditorDialog>
  );
};

interface PanelSenaraiModalProps {
  slotIndex: number;
  jenis: 'aktif' | 'menunggu';
  senarai: { id: string; tajuk: string; scheduledPublishAt: string | null; scheduledExpiresAt: string | null; sebabMenunggu?: string }[];
  formatTarikhMasa: (iso: string | null) => string | null;
  onTutup: () => void;
}

// Panel senarai Aktif/Menunggu (2026-08-06) — klik angka di jadual buka ni. Tarikh jadual
// (scheduledExpiresAt/scheduledPublishAt) cuma wujud kalau Ketua Editor/Penolong sengaja
// tetapkan Jadual Terbit/Luput (Fasa 8, pilihan — bukan wajib); kandungan tanpa jadual
// papar label jujur "Tiada jadual (manual)", bukan tarikh rekaan. PANEL NI BACA SAHAJA —
// tiada `useAmaranBelumSimpan` (tiada draf untuk hilang), tapi tetap dapat pengurusan fokus
// (§G1/G2/G6) sepadan dua modal boleh-sunting di atas.
const PanelSenaraiModal: React.FC<PanelSenaraiModalProps> = ({ slotIndex, jenis, senarai, formatTarikhMasa, onTutup }) => {
  return (
    <EditorDialog
      saiz="lg"
      tajuk={`Slot ${slotIndex + 1}: ${jenis === 'aktif' ? 'Kandungan Aktif' : 'Kandungan Menunggu'}`}
      onTutup={onTutup}
    >
        <div>
          {senarai.map((k) => {
            const tarikh = jenis === 'aktif' ? formatTarikhMasa(k.scheduledExpiresAt) : formatTarikhMasa(k.scheduledPublishAt);
            return (
              <div key={k.id} className={`py-2.5 ${GARIS_BARIS}`}>
                <p className="font-serif text-stone-800 font-semibold">{k.tajuk}</p>
                <p className="text-[10px] text-stone-500 mt-0.5">
                  {jenis === 'aktif' ? (
                    tarikh ? <>Akan terarkib: <span className="font-semibold text-stone-700">{tarikh}</span></> : 'Tiada jadual (kekal aktif sehingga digantikan manual)'
                  ) : tarikh ? (
                    <>Akan aktif: <span className="font-semibold text-stone-700">{tarikh}</span></>
                  ) : k.sebabMenunggu === 'slot_penuh' ? (
                    // Dua jenis Menunggu (2026-08-06) — dah lulus keputusan, cuma tunggu ruang
                    // kosong dalam slot (hadKandunganSlot). Naik taraf AUTOMATIK bila ruang
                    // wujud (Arkib/Tolak/Luput berjadual) — tiada tindakan manusia diperlukan.
                    <span className="text-amber-700 font-semibold">Sudah lulus, menunggu slot kosong (naik taraf automatik)</span>
                  ) : (
                    'Menunggu kelulusan Ketua Editor/Penolong (tiada jadual)'
                  )}
                </p>
              </div>
            );
          })}
        </div>
    </EditorDialog>
  );
};

export default SenaraiSlotConsole;
