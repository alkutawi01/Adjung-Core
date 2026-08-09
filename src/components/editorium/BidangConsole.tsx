import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Check, Pencil, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import { BidangIcon, BIDANG_ICON_MAP, BIDANG_ICON_NAMES } from '../common/BidangIcon';
import { StatusBadge } from '../common/StatusBadge';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { KeadaanMemuat } from '../common/KeadaanMemuat';
import { Button } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import { LABEL_BORANG, INPUT_BORANG, KEPALA_JADUAL, GARIS_BARIS } from '../common/gayaKongsi';
import { TIER_SLOTS } from '../../../core/editorial/GeometryConfig.js';
import { EditorDialog } from '../common/EditorDialog';

// Bidang (2026-07-30) — DIPINDAHKAN daripada Tetapan → "2. Taksonomi" ke tab Slot, atas permintaan
// pemilik projek: slot ialah kad, kad ialah slot, jadi segala tetapan yang mentakrifkan slot duduk
// di bawah satu bumbung. Skrin lama di Tetapan sudah DIPADAM — ini satu-satunya rumah Bidang
// sekarang; jangan hidupkan semula salinan kedua di mana-mana.
//
// Slot tier BAR (Ticker-bawah) ada peraturan khas — untuk event sahaja, tak boleh diperuntukkan
// kepada Bidang. Dibuang terus daripada grid pemilihan slot (bukan dipapar dilumpuhkan). Ticker
// (slot -1) pun tiada di sini: kedua-duanya ada rumah sendiri (Modul Khas).
const BAR_SLOT_SET = new Set(TIER_SLOTS.BAR);

// Bidang ialah senarai tertutup kurasi Ketua Editor, disimpan di CategoryRegistry (jadual DB
// sebenar, bukan lagi dikira semula dari kandungan hidup) — lihat GET /api/system/categories/active.
interface ActiveBidang {
  id: string;
  slug: string;
  name: string;
  color: string;
  icon: string | null;
  /** Ikon SVG custom 13px bagi glif masthead. */
  iconSvg: string | null;
  usageCount: number;
  slots: number[];
  /** Status arkib (2026-08-01, spesifikasi pemilik projek) — 1 aktif (boleh dipilih untuk
   *  kandungan baharu), 0 arkib (tak boleh dipilih baharu, tapi kandungan sedia ada terus hidup). */
  isActive: number;
  /** Nama asal (2026-08-01) — dicap sekali semasa Bidang dicipta, tak berubah bila dinamakan
   *  semula. Sama dengan `name` bermaksud tak pernah dinamakan semula sejak medan ni wujud. */
  originalName: string;
}

export const BidangConsole: React.FC = () => {
  const [desks, setDesks] = useState<ActiveBidang[]>([]);
  const [desksLoading, setDesksLoading] = useState(true);
  const [expandedBidangId, setExpandedBidangId] = useState<string | null>(null);
  const [renamingBidangId, setRenamingBidangId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [ralatBidang, setRalatBidang] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWarnaModal, setShowWarnaModal] = useState(false);

  // /categories/taksonomi (bukan /categories/active) — konsol ni perlukan DUA-DUA status
  // (aktif+arkib) supaya Ketua Editor boleh nampak dan pulihkan yang diarkib. /categories/active
  // (aktif sahaja) masih dipakai di tempat lain (dropdown borang kandungan, dll).
  const fetchActiveBidang = () => {
    setDesksLoading(true);
    fetch('/api/system/categories/taksonomi')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDesks(data);
      })
      .catch(e => console.error('Error fetching Bidang:', e))
      .finally(() => setDesksLoading(false));
  };

  // Papar Aktif sahaja secara lalai (sama kelakuan seperti dulu) — Arkib/Semua ditogol bila
  // benar-benar perlu, bukan membanjiri jadual utama dengan Bidang yang dah tak dipakai.
  const [paparanStatus, setPaparanStatus] = useState<'aktif' | 'arkib' | 'semua'>('aktif');
  const desksTertapis = desks.filter(d =>
    paparanStatus === 'semua' ? true : paparanStatus === 'aktif' ? d.isActive === 1 : d.isActive !== 1
  );
  // Bilangan setiap togol (2026-08-07, permintaan Izzat) — dahulu "Aktif"/"Arkib"/"Semua" tanpa
  // angka, editor terpaksa klik setiap satu untuk tahu berapa banyak sebelum tahu jadual mana
  // patut disemak dulu.
  const jumlahIkutStatus: Record<'aktif' | 'arkib' | 'semua', number> = {
    aktif: desks.filter(d => d.isActive === 1).length,
    arkib: desks.filter(d => d.isActive !== 1).length,
    semua: desks.length,
  };
  const [menukarStatusId, setMenukarStatusId] = useState<string | null>(null);
  // Maklum balas togol arkib/pulihkan (2026-08-08, Izzat: "byk tempat yg ada kotak tick... takde
  // makluman sama ada berjaya atau tak") — togolStatusBidang() SEBELUM ni guna alert() nyahaktifkan
  // bila gagal (kotak native pelayar, luar gaya reka bentuk Adjung sepenuhnya, sama isu fragile
  // macam window.confirm ditemui hari ni), dan TIADA apa-apa langsung bila berjaya.
  const [ralatTogolStatus, setRalatTogolStatus] = useState<string | null>(null);
  const [berjayaTogolStatus, setBerjayaTogolStatus] = useState<string | null>(null);

  const togolStatusBidang = async (d: ActiveBidang) => {
    setMenukarStatusId(d.id);
    setRalatTogolStatus(null);
    setBerjayaTogolStatus(null);
    const jadiAktif = d.isActive !== 1;
    try {
      const res = await fetch('/api/system/categories/set-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: d.id, isActive: jadiAktif }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengemas kini status Bidang.');
      fetchActiveBidang();
      setBerjayaTogolStatus(jadiAktif ? `"${d.name}" dipulihkan.` : `"${d.name}" diarkibkan.`);
      setTimeout(() => setBerjayaTogolStatus(null), 4000);
    } catch (e: any) {
      setRalatTogolStatus(e.message || 'Gagal mengemas kini status Bidang.');
    } finally {
      setMenukarStatusId(null);
    }
  };

  // Editor sesuatu Bidang TIDAK disimpan berasingan — ia dikira daripada penugasan slot (lihat
  // core/routes/slotEditorRoutes.js). Editor yang diamanahkan urus slot 1 dengan sendirinya
  // bertanggungjawab ke atas Bidang slot 1; dua senarai berasingan hanya akan bercanggah.
  const [penugasan, setPenugasan] = useState<{ slotIndex: number; editorId: string; nama: string }[]>([]);

  useEffect(() => {
    fetchActiveBidang();
    fetch('/api/system/slot-editors')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPenugasan(d); })
      .catch(e => console.error('Error fetching slot editors:', e));
  }, []);

  const editorBagiBidang = (slots: number[]) => {
    const nama = new Map<string, string>();
    for (const p of penugasan) {
      if (slots.includes(p.slotIndex)) nama.set(p.editorId, p.nama);
    }
    return [...nama.values()];
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
    if (BAR_SLOT_SET.has(slotIndex)) return; // Slot Bar untuk event sahaja, tak boleh diperuntukkan.
    const owner = (usageFor(slotIndex)?.bidang || '').trim();
    const milikBidangIni = owner.toLowerCase() === d.name.toLowerCase();
    // Cuma Bidang AKTIF (bukan diarkib, `desks` kini pegang kedua-dua status sejak togol
    // Aktif/Arkib/Semua ditambah) yang layak "memiliki" slot dan menyekat pengagihan semula.
    // Nilai manualDesk lama/anak yatim (cth "GENERAL") atau Bidang yang sudah diarkib tak ada
    // panel sendiri untuk "dibuang dahulu" — sekat di sini jadi deadlock mustahil diikuti. Rawat
    // macam slot kosong sebaliknya.
    const ownerAktif = owner && desks.some(x => x.isActive === 1 && x.name.toLowerCase() === owner.toLowerCase());

    // Slot milik Bidang lain (berdaftar) tidak boleh dirampas dari sini. Buang dari Bidang itu
    // dahulu — supaya pemiliknya sedar slotnya hilang, dan bukan ia lenyap tanpa dia tahu.
    if (ownerAktif && !milikBidangIni) {
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

  const postAssignSlot = async (slotIndex: number, bidangName: string) => {
    const res = await fetch('/api/system/categories/assign-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotIndex, bidangName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Gagal menetapkan slot ${slotIndex + 1}.`);
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
      setRalatBidang(e.message || 'Gagal mengemas kini slot.');
      fetchActiveBidang();
      fetchSlotUsage();
    } finally {
      setApplyingSlots(false);
    }
  };

  // Pemilih Ikon Bidang — klik badge ikon dalam jadual buka modal ni (grid lucide + muat naik SVG).
  // Modal (IkonWarnaModal, di bawah) diasingkan sebagai komponen sendiri (Audit UI/UX §G1/G2/G6) —
  // state ikon/warna/plat semuanya tempatan kepada modal itu, dimulakan semula setiap kali dibuka.
  const [iconPickerBidangId, setIconPickerBidangId] = useState<string | null>(null);
  const openIconPicker = (d: ActiveBidang) => setIconPickerBidangId(d.id);
  const closeIconPicker = () => setIconPickerBidangId(null);
  const iconPickerTarget = desks.find(d => d.id === iconPickerBidangId) || null;

  const handleRenameBidang = async (id: string) => {
    if (!renameValue.trim()) return;
    setRalatBidang(null);
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
      setRalatBidang(e.message || 'Gagal menamakan semula Bidang.');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <ModulTajuk
        tajuk="Bidang"
        huraian="Bidang bagi setiap slot (kecuali Ticker dan Slot Bar) hanya boleh dipilih oleh Ketua Editor. Menukar Bidang sesuatu slot akan mengarkibkan kandungan aktif dalam slot tersebut."
        tindakan={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowWarnaModal(true)}
            >
              Strategi Warna
            </Button>
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              + Tambah Bidang
            </Button>
          </>
        }
      />

      <PanelCard className="space-y-4 text-xs">
        {ralatBidang && <MesejStatus tone="error">{ralatBidang}</MesejStatus>}
        {ralatTogolStatus && <MesejStatus tone="error">{ralatTogolStatus}</MesejStatus>}
        {berjayaTogolStatus && <MesejStatus tone="success">{berjayaTogolStatus}</MesejStatus>}
        {/* Togol paparan status (2026-08-01) — lalai Aktif sahaja, sama kelakuan seperti dulu. */}
        <div className="flex items-center bg-stone-100 p-0.5 rounded border border-stone-200 text-xs w-max">
          {(['aktif', 'arkib', 'semua'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setPaparanStatus(s)}
              className={`px-3 py-1 rounded font-semibold transition-all capitalize cursor-pointer ${
                paparanStatus === s ? 'bg-white text-stone-900 shadow-[0_1px_2px_rgba(0,0,0,.04)]' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {s} ({jumlahIkutStatus[s]})
            </button>
          ))}
        </div>

        {desksLoading ? (
          <KeadaanMemuat baris={5} />
        ) : desksTertapis.length === 0 ? (
          <KeadaanKosong>Tiada Bidang dalam paparan ini.</KeadaanKosong>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={KEPALA_JADUAL}>
                <th className="p-3">Ikon</th>
                <th className="p-3">Warna</th>
                <th className="p-3">Nama Bidang</th>
                <th className="p-3">Nama Asal</th>
                <th className="p-3">Status</th>
                <th className="p-3">Nombor Slot Diperuntukkan</th>
                <th className="p-3">Editor</th>
              </tr>
            </thead>
            <tbody>
              {desksTertapis.map(d => (
                <React.Fragment key={d.id}>
                  <tr className={`hover:bg-stone-50 ${GARIS_BARIS}`}>
                    <td className="p-3">
                      <Tooltip text="Tukar ikon Bidang">
                        <button
                          type="button"
                          onClick={() => openIconPicker(d)}
                          aria-label="Tukar ikon Bidang"
                          className="hover:ring-2 hover:ring-offset-1 hover:ring-stone-300 rounded-full transition-shadow relative"
                        >
                          <BidangIcon iconName={d.icon} iconSvg={d.iconSvg} color={d.color} />
                        </button>
                      </Tooltip>
                    </td>
                    {/* Petak warna ini pintu kedua ke modal yang sama seperti ikon — dulu
                        satu-satunya jalan masuk ialah klik bulatan ikon, tanpa sebarang tanda ia
                        boleh diklik langsung. */}
                    <td className="p-3">
                      <Tooltip text="Tukar warna Bidang">
                        <button
                          type="button"
                          onClick={() => openIconPicker(d)}
                          aria-label="Tukar warna Bidang"
                          className="inline-flex items-center gap-1.5 group cursor-pointer"
                        >
                          <span className="inline-block w-4 h-4 rounded-full border border-stone-300 shadow-[0_1px_2px_rgba(0,0,0,.04)] group-hover:ring-2 group-hover:ring-offset-1 group-hover:ring-stone-300 transition-shadow" style={{ backgroundColor: d.color }}></span>
                          <span className="font-mono text-[10px] uppercase text-stone-400 group-hover:text-Adjung-maroon">{d.color}</span>
                        </button>
                      </Tooltip>
                    </td>
                    {/* Nama diklik terus untuk menamakan semula — corak sama seperti Senarai Slot
                        (klik nilai) dan Tier Kad (nilai itu sendiri medan). Tiada lajur "Tindakan"
                        berasingan; ia satu-satunya jadual dalam tab Slot yang pernah ada lajur
                        begitu, dan mengulang tiga arahan bertulis 26 kali cuma jadi bising. */}
                    <td className="p-3 font-semibold text-stone-900">
                      {renamingBidangId === d.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameBidang(d.id);
                              if (e.key === 'Escape') setRenamingBidangId(null);
                            }}
                            className={`${INPUT_BORANG} py-1 text-xs font-semibold`}
                            autoFocus
                          />
                          <Tooltip text="Simpan">
                            <button onClick={() => handleRenameBidang(d.id)} aria-label="Simpan" className="text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
                          </Tooltip>
                          <Tooltip text="Batal">
                            <button onClick={() => setRenamingBidangId(null)} aria-label="Batal" className="text-stone-400"><X className="w-3.5 h-3.5" /></button>
                          </Tooltip>
                        </div>
                      ) : (
                        <Tooltip text="Klik untuk menamakan semula">
                          <button
                            type="button"
                            onClick={() => { setRenamingBidangId(d.id); setRenameValue(d.name); }}
                            aria-label="Klik untuk menamakan semula"
                            className="inline-flex items-center gap-1.5 group cursor-pointer text-left"
                          >
                            {d.name}
                            <Pencil className="w-3 h-3 text-stone-300 group-hover:text-Adjung-maroon" />
                          </button>
                        </Tooltip>
                      )}
                    </td>
                    <td className="p-3 text-stone-500 text-[11px]">
                      {d.originalName && d.originalName !== d.name ? d.originalName : <span className="text-stone-300">—</span>}
                    </td>
                    <td className="p-3">
                      <Tooltip text={d.isActive === 1 ? 'Klik untuk arkibkan' : 'Klik untuk pulihkan'}>
                        <button
                          type="button"
                          onClick={() => togolStatusBidang(d)}
                          disabled={menukarStatusId === d.id}
                          aria-label={d.isActive === 1 ? 'Klik untuk arkibkan' : 'Klik untuk pulihkan'}
                          className="cursor-pointer disabled:opacity-50"
                        >
                          <StatusBadge tone={d.isActive === 1 ? 'success' : 'neutral'} label={d.isActive === 1 ? 'AKTIF' : 'ARKIB'} />
                        </button>
                      </Tooltip>
                    </td>
                    <td className="p-3 text-stone-600 font-sans text-[11px]">
                      <Tooltip text="Klik untuk menetapkan slot bagi Bidang ini">
                        <button
                          type="button"
                          onClick={() => toggleSlotPanel(d)}
                          aria-label="Klik untuk menetapkan slot bagi Bidang ini"
                          className="inline-flex items-center gap-1.5 group cursor-pointer text-left"
                        >
                          {d.slots.length === 0 ? (
                            <span className="text-stone-400 group-hover:text-Adjung-maroon">Tiada slot</span>
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {d.slots.map(s => (
                                <span key={s} className="bg-stone-100 text-stone-600 border border-stone-200 rounded px-1.5 py-0.5 font-mono text-[9px] group-hover:border-Adjung-maroon group-hover:text-Adjung-maroon">{s + 1}</span>
                              ))}
                            </span>
                          )}
                          {expandedBidangId === d.id
                            ? <ChevronUp className="w-3 h-3 text-stone-400 shrink-0" />
                            : <ChevronDown className="w-3 h-3 text-stone-300 group-hover:text-Adjung-maroon shrink-0" />}
                        </button>
                      </Tooltip>
                    </td>
                    <td className="p-3 text-stone-600 text-[11px]">
                      {(() => {
                        const senarai = editorBagiBidang(d.slots);
                        return senarai.length === 0
                          ? <span className="text-stone-400">Belum ditugaskan</span>
                          : senarai.join(', ');
                      })()}
                    </td>
                  </tr>
                  {expandedBidangId === d.id && (() => {
                    const pending = pendingSlots || [];
                    const { tambah, buang, adaPerubahan, jumlahArkib } = slotDiff(d);
                    return (
                    <tr>
                      <td colSpan={7} className="p-4 bg-stone-50">
                        <div className="text-[9px] uppercase font-bold text-stone-500 mb-1">
                          Tanda slot untuk peruntukkan Bidang "{d.name}"
                        </div>
                        <p className="text-[10px] text-stone-500 mb-2">
                          Tiada apa disimpan sehingga anda tekan <strong className="font-semibold">Sahkan Perubahan</strong>.
                        </p>

                        {/* Petunjuk — tanpa ini slot milik Bidang lain nampak sama seperti slot kosong. */}
                        <div className="flex flex-wrap items-center gap-3 mb-2 text-[10px] text-stone-500">
                          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-Adjung-maroon border border-Adjung-maroon" /> Bidang ini</span>
                          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-stone-300" /> Kosong</span>
                          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-stone-200 border border-stone-400" /> Milik Bidang lain</span>
                          <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-600" /> Ada kandungan aktif</span>
                        </div>

                        <div className="grid grid-cols-6 md:grid-cols-10 gap-2">
                          {Array.from({ length: 38 }, (_, i) => i).filter(i => !BAR_SLOT_SET.has(i)).map(slotIndex => {
                            const u = usageFor(slotIndex);
                            const owner = (u?.bidang || '').trim();
                            const milikBidangIni = owner.toLowerCase() === d.name.toLowerCase();
                            const ownerAktif = !!owner && desks.some(x => x.isActive === 1 && x.name.toLowerCase() === owner.toLowerCase());
                            const milikOrangLain = ownerAktif && !milikBidangIni;
                            const dipilih = pending.includes(slotIndex);
                            const live = u?.liveCount || 0;

                            const gaya = dipilih
                              ? 'bg-Adjung-maroon text-white border-Adjung-maroon'
                              : milikOrangLain
                                ? 'bg-stone-200 text-stone-500 border-stone-400 cursor-not-allowed'
                                : 'bg-white text-stone-600 border-stone-300 hover:border-Adjung-maroon';

                            return (
                              <Tooltip key={slotIndex} text={milikOrangLain
                                ? `Milik Bidang "${owner}"${live ? `, ${live} kandungan aktif` : ''}`
                                : live ? `${live} kandungan aktif dalam slot ini` : 'Slot kosong'}>
                              <button
                                type="button"
                                onClick={() => toggleSlot(slotIndex, d)}
                                className={`relative flex items-center justify-center border rounded px-1.5 py-1 text-[10px] font-mono transition-colors ${gaya}`}
                              >
                                {slotIndex + 1}
                                {live > 0 && (
                                  <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold border ${dipilih ? 'bg-white text-Adjung-maroon border-Adjung-maroon' : 'bg-amber-100 text-amber-800 border-amber-400'}`}>
                                    {live}
                                  </span>
                                )}
                              </button>
                              </Tooltip>
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
                          <Button
                            variant="primary"
                            disabled={!adaPerubahan || applyingSlots}
                            onClick={() => setSlotConfirmOpen(true)}
                          >
                            Sahkan Perubahan
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={!adaPerubahan || applyingSlots}
                            onClick={() => { setPendingSlots([...d.slots]); setSlotBlockedMsg(null); setSlotConfirmOpen(false); }}
                          >
                            Set Semula
                          </Button>
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
                                <>Tiada kandungan aktif dalam slot yang terjejas dan tiada kandungan yang akan diarkibkan.</>
                              )}
                            </p>

                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                variant="primary"
                                disabled={applyingSlots}
                                onClick={() => applySlotChanges(d)}
                              >
                                {applyingSlots ? 'Menyimpan…' : (jumlahArkib > 0 ? `Teruskan dan arkibkan ${jumlahArkib} kandungan` : 'Teruskan')}
                              </Button>
                              <Button
                                variant="secondary"
                                disabled={applyingSlots}
                                onClick={() => setSlotConfirmOpen(false)}
                              >
                                Batal
                              </Button>
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
          </div>
        )}
      </PanelCard>

      {iconPickerTarget && (
        <IkonWarnaModal
          target={iconPickerTarget}
          onTutup={closeIconPicker}
          onUpdated={fetchActiveBidang}
        />
      )}

      {showAddModal && (
        <TambahBidangModal
          onTutup={() => setShowAddModal(false)}
          onBerjaya={() => { setShowAddModal(false); fetchActiveBidang(); }}
        />
      )}

      {showWarnaModal && (
        <StrategiWarnaModal
          jumlahAktif={desks.filter(d => d.isActive === 1).length}
          onTutup={() => setShowWarnaModal(false)}
          fetchActiveBidang={fetchActiveBidang}
        />
      )}
    </div>
  );
};

// Modal ikon/warna Bidang (Audit UI/UX §G1/G2/G4/G6) — diasingkan daripada BidangConsole
// supaya perangkap fokus (kini dalam EditorDialog) hanya aktif selagi modal ni benar-benar dilekap. Semua state ikon/warna/plat
// kini tempatan kepada modal ni — dimulakan semula setiap kali dibuka (React melekapkannya semula),
// jadi kelakuannya sama seperti openIconPicker/closeIconPicker asal yang mengeset semula state tiap
// kali buka/tutup.
function IkonWarnaModal({
  target, onTutup, onUpdated,
}: {
  target: ActiveBidang;
  onTutup: () => void;
  onUpdated: () => void;
}) {
  const [savingIconFor, setSavingIconFor] = useState<string | null>(null);
  const [ikonError, setIkonError] = useState<string | null>(null);
  const [svgUploadPreview, setSvgUploadPreview] = useState<string | null>(null);
  const [svgUploadError, setSvgUploadError] = useState<string | null>(null);
  const [uploadingSvg, setUploadingSvg] = useState(false);

  // Warna Bidang — dipentaskan dalam state supaya pemilih warna boleh diseret tanpa menghantar
  // satu permintaan bagi setiap piksel pergerakan.
  const [warnaDraf, setWarnaDraf] = useState<string | null>(null);
  const [simpanWarna, setSimpanWarna] = useState(false);
  const [warnaError, setWarnaError] = useState<string | null>(null);

  const handleSaveColor = async (id: string) => {
    if (!warnaDraf) return;
    setSimpanWarna(true);
    setWarnaError(null);
    try {
      const res = await fetch('/api/system/categories/set-color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, color: warnaDraf })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menetapkan warna.');
      setWarnaDraf(null);
      onUpdated();
    } catch (e: any) {
      setWarnaError(e.message || 'Gagal menetapkan warna.');
    } finally {
      setSimpanWarna(false);
    }
  };

  const handlePickLucideIcon = async (id: string, iconName: string) => {
    setSavingIconFor(id);
    setIkonError(null);
    try {
      const res = await fetch('/api/system/categories/set-icon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, icon: iconName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menetapkan ikon.');
      onUpdated();
      onTutup();
    } catch (e: any) {
      setIkonError(e.message || 'Gagal menetapkan ikon.');
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
      onUpdated();
      onTutup();
    } catch (e: any) {
      setSvgUploadError(e.message || 'Gagal memuat naik SVG.');
    } finally {
      setUploadingSvg(false);
    }
  };

  return (
    <EditorDialog
      saiz="lg"
      onTutup={onTutup}
      tajuk={
        <>
          <BidangIcon iconName={target.icon} iconSvg={target.iconSvg} color={target.color} />
          Ikon, Warna &amp; Plat — {target.name}
        </>
      }
      tindakan={<Button variant="secondary" onClick={onTutup}>Tutup</Button>}
    >
        <div className="font-sans space-y-3">
          <div className="pb-3 border-b border-stone-200">
            <label className={LABEL_BORANG}>Warna Bidang</label>
            <div className="flex items-center gap-3">
              <Tooltip text="Pilih warna">
                <input
                  type="color"
                  value={warnaDraf || target.color || '#802334'}
                  onChange={e => { setWarnaDraf(e.target.value.toUpperCase()); setWarnaError(null); }}
                  aria-label="Pilih warna"
                  className="w-10 h-8 rounded border border-stone-300 bg-white cursor-pointer p-0.5"
                />
              </Tooltip>
              <input
                type="text"
                value={warnaDraf || target.color || ''}
                onChange={e => { setWarnaDraf(e.target.value.toUpperCase()); setWarnaError(null); }}
                placeholder="#802334"
                className="w-24 px-2 py-[calc(4px*var(--ed-kepadatan,1))] border border-stone-300 rounded font-mono text-[11px] uppercase focus:outline-none focus:border-Adjung-maroon focus:bg-white transition-colors"
              />
              {/* Pratonton dalam bentuk sebenar ia akan dipakai */}
              <span
                className="font-mono text-[10px] uppercase tracking-widest font-bold"
                style={{ color: warnaDraf || target.color }}
              >
                {target.name}
              </span>
              {warnaDraf && warnaDraf.toUpperCase() !== (target.color || '').toUpperCase() && (
                <Button variant="primary" onClick={() => handleSaveColor(target.id)} disabled={simpanWarna}>
                  {simpanWarna ? 'Menyimpan…' : 'Guna Warna Ini'}
                </Button>
              )}
            </div>
            {warnaError && <MesejStatus tone="error" className="mt-1">{warnaError}</MesejStatus>}
          </div>

          <div>
            <label className={LABEL_BORANG}>Pilih Ikon Sedia Ada</label>
            <div className="grid grid-cols-8 gap-1.5">
              {BIDANG_ICON_NAMES.map(name => {
                const Icon = BIDANG_ICON_MAP[name];
                const isCurrent = !target.iconSvg && target.icon === name;
                return (
                  <Tooltip key={name} text={name}>
                    <button
                      type="button"
                      aria-label={name}
                      disabled={savingIconFor === target.id}
                      onClick={() => handlePickLucideIcon(target.id, name)}
                      className={`flex items-center justify-center w-8 h-8 rounded border transition-colors disabled:opacity-40 ${
                        isCurrent ? 'bg-Adjung-maroon border-Adjung-maroon text-white' : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-Adjung-maroon hover:text-Adjung-maroon'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
            {ikonError && <MesejStatus tone="error" className="mt-1">{ikonError}</MesejStatus>}
          </div>

          <div className="pt-3 border-t border-stone-200">
            <label className={LABEL_BORANG}>Atau Muat Naik SVG Sendiri</label>
            <div className="flex items-center gap-3">
              {/* <label> membalut <input type="file"> — tak boleh jadi <Button> (elemen
                  <button> tak boleh mencetuskan pemilih fail), jadi ia meminjam bahasa
                  visual varian `secondary` secara langsung. */}
              <label className="inline-flex items-center justify-center gap-2 rounded-md font-semibold font-sans text-xs px-4 py-1.5 cursor-pointer transition-colors bg-white text-Adjung-maroon border border-stone-200 hover:bg-stone-50 hover:border-stone-300">
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
            <p className="text-stone-400 text-[10px] mt-1.5">Saiz maksimum 100 KB. Semua fail SVG akan disanitasi di pelayan sebelum disimpan.</p>
            {svgUploadError && <MesejStatus tone="error" className="mt-1">{svgUploadError}</MesejStatus>}
            {svgUploadPreview && (
              <Button
                variant="primary"
                onClick={() => handleUploadSvgIcon(target.id)}
                disabled={uploadingSvg}
                className="mt-2"
              >
                {uploadingSvg ? 'Memuat naik…' : 'Guna SVG Ini'}
              </Button>
            )}
          </div>
        </div>
    </EditorDialog>
  );
}

// Modal "Tambah Bidang" (Audit UI/UX §G1/G2/G4/G6) — diasingkan supaya perangkap fokus hanya aktif
// selagi modal ni dilekap.
function TambahBidangModal({ onTutup, onBerjaya }: { onTutup: () => void; onBerjaya: () => void }) {
  const [newDeskName, setNewDeskName] = useState('');
  const [newDeskColor, setNewDeskColor] = useState('#802334');
  const [addingDesk, setAddingDesk] = useState(false);
  const [ralatTambahDesk, setRalatTambahDesk] = useState<string | null>(null);

  const handleAddDesk = async () => {
    if (!newDeskName.trim()) return;
    setAddingDesk(true);
    setRalatTambahDesk(null);
    try {
      const res = await fetch('/api/system/categories/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeskName.trim(), color: newDeskColor })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah Bidang.');
      onBerjaya();
    } catch (e: any) {
      setRalatTambahDesk(e.message || 'Gagal menambah Bidang.');
    } finally {
      setAddingDesk(false);
    }
  };

  return (
    <EditorDialog
      saiz="sm"
      onTutup={onTutup}
      tajuk="+ Tambah Bidang Baharu"
      tindakan={
        <>
          <Button variant="secondary" onClick={onTutup}>Batal</Button>
          <Button variant="primary" onClick={handleAddDesk} disabled={addingDesk}>
            {addingDesk ? 'Menambah…' : 'Tambah Bidang'}
          </Button>
        </>
      }
    >
        <div className="space-y-3 font-sans">
          <div>
            <label className={LABEL_BORANG}>Nama Bidang</label>
            <input type="text" placeholder="Contoh: Astronomi" value={newDeskName} onChange={e => setNewDeskName(e.target.value)} className={INPUT_BORANG} />
          </div>
          <div>
            <label className={LABEL_BORANG}>Warna Bidang (Hex)</label>
            <div className="flex items-center gap-2">
              <input type="color" value={newDeskColor} onChange={e => setNewDeskColor(e.target.value)} className="w-9 h-8 shrink-0 rounded border border-stone-300 cursor-pointer p-0.5 bg-stone-50" />
              <input type="text" value={newDeskColor} onChange={e => setNewDeskColor(e.target.value)} className={`${INPUT_BORANG} font-mono font-bold`} />
            </div>
          </div>
          {ralatTambahDesk && <MesejStatus tone="error">{ralatTambahDesk}</MesejStatus>}
        </div>
    </EditorDialog>
  );
}

// Modal "Strategi Warna" (2026-08-06, dua tindakan berulang, bukan skrip sekali-guna) — diasingkan
// (Audit UI/UX §G1/G2/G4/G6). §D6: ralat menyelaraskan/mempelbagaikan warna dahulu tiada jalan
// pulih langsung — "Cuba Lagi" kini memuat semula senarai Bidang supaya paparan sentiasa padan
// dengan keadaan sebenar pada server sebelum editor cuba lagi.
function StrategiWarnaModal({
  jumlahAktif, onTutup, fetchActiveBidang,
}: {
  jumlahAktif: number;
  onTutup: () => void;
  fetchActiveBidang: () => void;
}) {
  const [warnaSeragam, setWarnaSeragam] = useState('#802334');
  const [memprosesWarna, setMemprosesWarna] = useState<'unify' | 'diversify' | null>(null);
  const [mesejWarna, setMesejWarna] = useState<string | null>(null);
  const [ralatWarna, setRalatWarna] = useState<string | null>(null);

  const selaraskanSatuWarna = async () => {
    setMemprosesWarna('unify');
    setRalatWarna(null);
    setMesejWarna(null);
    try {
      const res = await fetch('/api/system/categories/unify-colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: warnaSeragam }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyelaraskan warna.');
      setMesejWarna(`${data.dikemas} Bidang aktif kini guna warna yang sama.`);
      fetchActiveBidang();
    } catch (e: any) {
      setRalatWarna(e.message || 'Gagal menyelaraskan warna.');
    } finally {
      setMemprosesWarna(null);
    }
  };

  const pelbagaikanWarna = async () => {
    setMemprosesWarna('diversify');
    setRalatWarna(null);
    setMesejWarna(null);
    try {
      const res = await fetch('/api/system/categories/diversify-colors', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mempelbagaikan warna.');
      setMesejWarna(
        data.dikemas > 0
          ? `${data.dikemas} Bidang diagihkan warna baharu (yang sudah unik tak diusik).`
          : 'Semua Bidang aktif sudah ada warna unik — tiada perubahan diperlukan.'
      );
      fetchActiveBidang();
    } catch (e: any) {
      setRalatWarna(e.message || 'Gagal mempelbagaikan warna.');
    } finally {
      setMemprosesWarna(null);
    }
  };

  return (
    <EditorDialog
      saiz="sm"
      onTutup={onTutup}
      tajuk="Strategi Warna Bidang"
      tindakan={<Button variant="secondary" onClick={onTutup}>Tutup</Button>}
    >
        <div className="space-y-4 font-sans">
          <div className="space-y-2 border-b border-stone-200 pb-4">
            <p className="font-semibold text-stone-800">Selaraskan ke SATU warna</p>
            <p className="text-stone-500">Semua Bidang aktif ({jumlahAktif}) akan menggunakan warna yang dipilih.</p>
            <div className="flex items-center gap-2">
              <input type="color" value={warnaSeragam} onChange={e => setWarnaSeragam(e.target.value)} className="w-9 h-8 shrink-0 rounded border border-stone-300 cursor-pointer p-0.5 bg-stone-50" />
              <input type="text" value={warnaSeragam} onChange={e => setWarnaSeragam(e.target.value)} className={`${INPUT_BORANG} font-mono font-bold`} />
            </div>
            <Button variant="primary" onClick={selaraskanSatuWarna} disabled={memprosesWarna !== null}>
              {memprosesWarna === 'unify' ? 'Menyelaraskan…' : 'Selaraskan Semua'}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-stone-800">Pelbagaikan semula</p>
            <p className="text-stone-500">
              Bidang yang berkongsi warna yang sama akan diberikan warna baharu daripada palet
              sistem. Bidang yang sudah mempunyai warna unik tidak akan diubah.
            </p>
            <Button variant="secondary" onClick={pelbagaikanWarna} disabled={memprosesWarna !== null}>
              {memprosesWarna === 'diversify' ? 'Memproses…' : 'Pelbagaikan Semula'}
            </Button>
          </div>

          {mesejWarna && <MesejStatus tone="success">{mesejWarna}</MesejStatus>}
          {ralatWarna && <MesejStatus tone="error" onCubaLagi={fetchActiveBidang}>{ralatWarna}</MesejStatus>}
        </div>
    </EditorDialog>
  );
}

export default BidangConsole;
