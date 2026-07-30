import React, { useState, useEffect } from 'react';
import { Zap, X, AlertTriangle, Check, Pencil, Palette, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import { BidangIcon, BIDANG_ICON_MAP, BIDANG_ICON_NAMES } from '../common/BidangIcon';
import { TIER_SLOTS } from '../../../core/editorial/GeometryConfig.js';

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
  /** Ada plat ilustrasi? Markup penuh TIDAK dihantar dalam senarai pukal — plat boleh ratusan
   *  kilobait. Diambil melalui GET /categories/illustration bila modal dibuka. */
  hasIllustration: boolean;
  usageCount: number;
  slots: number[];
}

export const BidangConsole: React.FC = () => {
  const [desks, setDesks] = useState<ActiveBidang[]>([]);
  const [desksLoading, setDesksLoading] = useState(true);
  const [expandedBidangId, setExpandedBidangId] = useState<string | null>(null);
  const [renamingBidangId, setRenamingBidangId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

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
    // Cuma Bidang AKTIF/berdaftar (senarai `desks`) yang layak "memiliki" slot dan menyekat
    // pengagihan semula. Nilai manualDesk lama/anak yatim (cth "GENERAL") yang tak lagi wujud
    // dalam senarai Bidang tak ada panel sendiri untuk "dibuang dahulu" — sekat di sini jadi
    // deadlock mustahil diikuti. Rawat macam slot kosong sebaliknya.
    const ownerAktif = owner && desks.some(x => x.name.toLowerCase() === owner.toLowerCase());

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
      alert('Ralat: ' + (e.message || ''));
      fetchActiveBidang();
      fetchSlotUsage();
    } finally {
      setApplyingSlots(false);
    }
  };

  // Pemilih Ikon Bidang — klik badge ikon dalam jadual buka modal ni (grid lucide + muat naik SVG).
  const [iconPickerBidangId, setIconPickerBidangId] = useState<string | null>(null);
  const [savingIconFor, setSavingIconFor] = useState<string | null>(null);
  const [svgUploadPreview, setSvgUploadPreview] = useState<string | null>(null);
  const [svgUploadError, setSvgUploadError] = useState<string | null>(null);
  const [uploadingSvg, setUploadingSvg] = useState(false);

  // Plat ilustrasi Bidang — SVG besar untuk kolum kanan Focus View. Berasingan daripada ikon di
  // atas: ikon 13px di jalur masthead, plat ~240px di permukaan bacaan. Spec dikuatkuasakan di
  // server (core/routes/categoryRoutes.js): viewBox wajib, currentColor sahaja, had 256KB.
  const [illusPreview, setIllusPreview] = useState<string | null>(null);
  /** Markup plat SEMASA bagi Bidang yang modalnya terbuka, diambil atas permintaan. */
  const [illusCurrent, setIllusCurrent] = useState<string | null>(null);
  const [illusError, setIllusError] = useState<string | null>(null);
  /** Nota selepas muat naik, cth berapa nilai warna ditukar. Maklum, bukan ralat. */
  const [illusNote, setIllusNote] = useState<string | null>(null);
  const [uploadingIllus, setUploadingIllus] = useState(false);

  // Warna Bidang — dipentaskan dalam state supaya pemilih warna boleh diseret tanpa menghantar
  // satu permintaan bagi setiap piksel pergerakan.
  const [warnaDraf, setWarnaDraf] = useState<string | null>(null);
  const [simpanWarna, setSimpanWarna] = useState(false);
  const [warnaError, setWarnaError] = useState<string | null>(null);

  // Markup plat diambil HANYA bila modal dibuka — ia tidak dibawa dalam senarai Bidang, kerana
  // satu plat boleh ratusan kilobait dan senarai itu dimuat oleh frontpage awam juga.
  const openIconPicker = (d: ActiveBidang) => {
    setIconPickerBidangId(d.id);
    setIllusCurrent(null);
    setIllusPreview(null);
    setIllusError(null);
    setIllusNote(null);
    setWarnaDraf(null);
    setWarnaError(null);
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
    setIllusNote(null);
    setWarnaDraf(null);
    setWarnaError(null);
  };

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
      fetchActiveBidang();
    } catch (e: any) {
      setWarnaError(e.message || 'Gagal menetapkan warna.');
    } finally {
      setSimpanWarna(false);
    }
  };

  const handleIllusFileSelected = (file: File | null) => {
    setIllusError(null);
    setIllusNote(null);
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
      // Guna markup yang server benar-benar simpan, bukan fail mentah: warna sudah ditukar kepada
      // currentColor di sana, jadi pratonton menunjukkan plat sebenar (bermarun) dan bukan fail asal.
      setIllusCurrent(data.illustrationSvg || illusPreview);
      setIllusNote(data.warnaDitukar > 0
        ? `${data.warnaDitukar} nilai warna ditukar kepada currentColor — plat kini mengikut marun Adjung.`
        : null);
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

  const [newDeskName, setNewDeskName] = useState('');
  const [newDeskColor, setNewDeskColor] = useState('#802334');
  const [addingDesk, setAddingDesk] = useState(false);

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
      setShowAddModal(false);
      fetchActiveBidang();
    } catch (e: any) {
      alert('Ralat: ' + (e.message || ''));
    } finally {
      setAddingDesk(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
              Bidang (Senarai Tertutup)
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
              onClick={() => setShowAddModal(true)}
              className="bg-[#802334] hover:bg-[#601824] text-white px-3 py-1.5 rounded font-semibold text-xs"
            >
              + Tambah Bidang
            </button>
          </div>
        </div>

        {desksLoading ? (
          <div className="text-stone-400 text-xs py-6 text-center">Memuatkan Bidang...</div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-100 border-b border-stone-200 font-sans text-xs uppercase text-stone-600 font-semibold">
                <th className="p-3">Ikon</th>
                <th className="p-3">Warna</th>
                <th className="p-3">Nama Bidang</th>
                <th className="p-3">Nombor Slot Diperuntukkan</th>
                <th className="p-3">Editor</th>
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
                    {/* Petak warna ini pintu kedua ke modal yang sama seperti ikon — dulu
                        satu-satunya jalan masuk ialah klik bulatan ikon, tanpa sebarang tanda ia
                        boleh diklik langsung. */}
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => openIconPicker(d)}
                        title="Tukar warna Bidang"
                        className="inline-flex items-center gap-1.5 group cursor-pointer"
                      >
                        <span className="inline-block w-4 h-4 rounded-full border border-stone-300 shadow-xs group-hover:ring-2 group-hover:ring-offset-1 group-hover:ring-stone-300 transition-shadow" style={{ backgroundColor: d.color }}></span>
                        <span className="font-mono text-[10px] uppercase text-stone-400 group-hover:text-[#802334]">{d.color}</span>
                      </button>
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
                    <td className="p-3 text-stone-600 text-[11px]">
                      {(() => {
                        const senarai = editorBagiBidang(d.slots);
                        return senarai.length === 0
                          ? <span className="text-stone-400 italic">Belum ditugaskan</span>
                          : senarai.join(', ');
                      })()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setRenamingBidangId(d.id); setRenameValue(d.name); }}
                          className="text-stone-500 hover:text-[#802334] inline-flex items-center gap-1"
                          title="Tukar nama Bidang"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Nama
                        </button>
                        {/* Butang bertulis, bukan hanya ikon boleh klik dalam jadual — tanpa ini
                            tiada apa-apa memberitahu warna/ikon/plat boleh disunting langsung. */}
                        <button
                          onClick={() => openIconPicker(d)}
                          className="text-stone-500 hover:text-[#802334] inline-flex items-center gap-1"
                          title="Tukar warna, ikon dan plat ilustrasi"
                        >
                          <Palette className="w-3.5 h-3.5" /> Rupa
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
                      <td colSpan={6} className="p-4 bg-stone-50">
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
                          {Array.from({ length: 38 }, (_, i) => i).filter(i => !BAR_SLOT_SET.has(i)).map(slotIndex => {
                            const u = usageFor(slotIndex);
                            const owner = (u?.bidang || '').trim();
                            const milikBidangIni = owner.toLowerCase() === d.name.toLowerCase();
                            const ownerAktif = !!owner && desks.some(x => x.name.toLowerCase() === owner.toLowerCase());
                            const milikOrangLain = ownerAktif && !milikBidangIni;
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

      {iconPickerBidangId && (() => {
        const target = desks.find(d => d.id === iconPickerBidangId);
        if (!target) return null;
        return (
          <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-lg w-full p-6 space-y-4 text-xs max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                <h3 className="font-sans text-xs font-bold text-[#802334] uppercase flex items-center gap-2">
                  <BidangIcon iconName={target.icon} iconSvg={target.iconSvg} color={target.color} />
                  Ikon, Warna &amp; Plat — {target.name}
                </h3>
                <button onClick={closeIconPicker} className="text-stone-400 font-bold"><X className="w-3.5 h-3.5" /></button>
              </div>

              <div className="font-sans space-y-3">
                <div className="pb-3 border-b border-stone-200">
                  <label className="text-xs text-stone-500 font-semibold block mb-1">Warna Bidang</label>
                  <p className="text-stone-400 text-[10px] mb-2 leading-relaxed">
                    Dipakai pada eyebrow kad, glif Bidang, dan eyebrow Focus View — identiti visual Bidang ini
                    merentas seluruh portal. Warna diberi automatik semasa Bidang dicipta; tukar di sini kalau ia
                    tidak sesuai.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={warnaDraf || target.color || '#802334'}
                      onChange={e => { setWarnaDraf(e.target.value.toUpperCase()); setWarnaError(null); }}
                      className="w-10 h-8 rounded border border-stone-300 bg-white cursor-pointer p-0.5"
                      title="Pilih warna"
                    />
                    <input
                      type="text"
                      value={warnaDraf || target.color || ''}
                      onChange={e => { setWarnaDraf(e.target.value.toUpperCase()); setWarnaError(null); }}
                      placeholder="#802334"
                      className="w-24 px-2 py-1 border border-stone-300 rounded font-mono text-[11px] uppercase"
                    />
                    {/* Pratonton dalam bentuk sebenar ia akan dipakai */}
                    <span
                      className="font-mono text-[10px] uppercase tracking-widest font-bold"
                      style={{ color: warnaDraf || target.color }}
                    >
                      {target.name}
                    </span>
                    {warnaDraf && warnaDraf.toUpperCase() !== (target.color || '').toUpperCase() && (
                      <button
                        onClick={() => handleSaveColor(target.id)}
                        disabled={simpanWarna}
                        className="bg-[#802334] text-white px-3 py-1.5 rounded font-semibold text-xs disabled:opacity-50"
                      >
                        {simpanWarna ? 'Menyimpan...' : 'Guna Warna Ini'}
                      </button>
                    )}
                  </div>
                  {warnaError && <p className="text-red-600 text-[10px] mt-1">{warnaError}</p>}
                </div>

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

                  <p className="text-stone-500 text-[10px] font-semibold mb-1">Dua syarat:</p>
                  <ul className="text-stone-500 text-[10px] leading-relaxed mb-2 pl-3 list-disc marker:text-stone-300">
                    <li>SVG mesti ada <code className="font-mono">viewBox</code>. Nombornya bebas — <code className="font-mono">0 0 1024 1024</code> sama sah seperti <code className="font-mono">0 0 256 256</code>.</li>
                    <li>Had 256KB.</li>
                  </ul>
                  <p className="text-stone-400 text-[10px] leading-relaxed mb-2">
                    Warna tidak perlu disediakan: sistem menukar setiap fill/stroke kepada
                    <code className="font-mono"> currentColor</code> semasa simpan, jadi plat sentiasa mengikut
                    marun Adjung. Fail hitam putih pun boleh terus dimuat naik. <code className="font-mono">none</code>,
                    <code className="font-mono"> transparent</code> dan nilai legap dikekalkan.
                  </p>
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
                  {illusNote && <p className="text-emerald-700 text-[10px] mt-1">{illusNote}</p>}

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
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-stone-200 pb-2">
              <h3 className="font-sans text-xs font-bold text-[#802334] uppercase">
                + Tambah Bidang Baharu
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-stone-400 font-bold"><X className="w-3.5 h-3.5" /></button>
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
              <button onClick={() => setShowAddModal(false)} className="bg-stone-200 text-stone-700 px-3 py-1.5 rounded font-semibold text-xs">Batal</button>
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

export default BidangConsole;
