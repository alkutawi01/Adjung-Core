import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BidangIcon } from '../common/BidangIcon';
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

interface Props {
  currentEditoriumRole?: string;
}

export const SenaraiSlotConsole: React.FC<Props> = ({ currentEditoriumRole }) => {
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [bidangList, setBidangList] = useState<BidangRow[]>([]);
  const [usage, setUsage] = useState<{ slotIndex: number; bidang: string; liveCount: number }[]>([]);
  const [hadTier, setHadTier] = useState<Record<string, { maxTitleAlone: number; maxBriefAlone: number; dipinda: boolean }>>({});
  const [penugasan, setPenugasan] = useState<PenugasanEditor[]>([]);
  const [pengguna, setPengguna] = useState<Pengguna[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [drafTetapan, setDrafTetapan] = useState<{ manualDesk: string; bgColor: string; borderColor: string; carouselInterval: number; carouselDelay: number } | null>(null);
  const [menyimpanTetapan, setMenyimpanTetapan] = useState(false);
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
    ])
      .then(([slotRows, bidangRows, usageRows, tierRows, dbState]) => {
        if (Array.isArray(slotRows)) setSlots(slotRows);
        if (Array.isArray(bidangRows)) setBidangList(bidangRows);
        if (Array.isArray(usageRows)) setUsage(usageRows);
        if (Array.isArray(tierRows)) {
          setHadTier(Object.fromEntries(tierRows.map((t: any) => [t.tierKey, {
            maxTitleAlone: t.maxTitleAlone, maxBriefAlone: t.maxBriefAlone, dipinda: !!t.dipinda,
          }])));
        }
        if (Array.isArray(dbState?.users)) setPengguna(dbState.users.filter((u: Pengguna) => !u.isSuspended));
      })
      .finally(() => setLoading(false));
  }, []);

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

  const jumlahKandungan = SLOT_INDEXES.reduce(
    (n, i) => n + (usage.find(u => u.slotIndex === i)?.liveCount || 0), 0
  );

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
              Senarai Slot
            </h3>
            <p className="text-stone-500 text-xs">
              {SLOT_INDEXES.length} slot bento — tidak termasuk Ticker dan tier <em>Bar</em>, yang diuruskan di Modul Khas.
              Jumlah {jumlahKandungan} kandungan aktif.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-stone-400 text-xs py-6 text-center">Memuatkan senarai slot...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 border-b border-stone-200 font-sans text-[10px] uppercase text-stone-600 font-semibold">
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
                  <th className="p-2.5 text-right">Kandungan Aktif</th>
                  <th className="p-2.5">Editor</th>
                  {currentEditoriumRole === 'KETUA_EDITOR' && <th className="p-2.5">Tetapan Kad</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
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
                    <tr key={i} className="hover:bg-stone-50">
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
                      <td className="p-2.5 text-right font-mono font-bold text-stone-800">{live}</td>
                      <td className="p-2.5">
                        <button
                          type="button"
                          onClick={() => bukaEditor(i)}
                          title="Tetapkan editor yang menguruskan slot ini"
                          className="text-left hover:text-[#802334] cursor-pointer group"
                        >
                          {editorBagiSlot(i).length === 0 ? (
                            <span className="text-stone-400 italic group-hover:text-[#802334]">Belum ditugaskan</span>
                          ) : (
                            <span className="text-stone-700 group-hover:text-[#802334]">
                              {editorBagiSlot(i).map(p => p.nama).join(', ')}
                            </span>
                          )}
                        </button>
                      </td>
                      {currentEditoriumRole === 'KETUA_EDITOR' && (
                        <td className="p-2.5">
                          <button
                            type="button"
                            onClick={() => bukaTetapan(i)}
                            className="px-2 py-1 border border-stone-300 rounded text-[10px] font-sans font-semibold text-stone-600 hover:bg-stone-50 hover:text-[#802334] cursor-pointer"
                          >
                            Tetapan
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-stone-200 pt-3 space-y-1.5 text-[10px] text-stone-500 leading-relaxed">
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
      </div>

      {slotDisunting !== null && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => !menyimpan && setSlotDisunting(null)}>
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-sm w-full p-5 space-y-3 text-xs" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-stone-200 pb-2">
              <h3 className="font-sans text-xs font-bold text-[#802334] uppercase">
                Editor Slot {slotDisunting + 1}
              </h3>
              <button onClick={() => setSlotDisunting(null)} className="text-stone-400"><X className="w-3.5 h-3.5" /></button>
            </div>

            <p className="text-stone-500 text-[10px] leading-relaxed">
              Tanda setiap editor yang diamanahkan menguruskan slot ini. Mereka juga secara automatik
              bertanggungjawab ke atas Bidang slot ini.
            </p>

            {pengguna.length === 0 ? (
              <p className="text-stone-400 italic py-3">Tiada pengguna dalam sistem.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded">
                {pengguna.map(u => {
                  const ditanda = drafEditor.includes(u.id);
                  return (
                    <label key={u.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-stone-50">
                      <input
                        type="checkbox"
                        checked={ditanda}
                        onChange={() => setDrafEditor(prev => ditanda ? prev.filter(x => x !== u.id) : [...prev, u.id])}
                        className="w-3.5 h-3.5 rounded border-stone-300 text-[#802334] cursor-pointer"
                      />
                      <span className="font-semibold text-stone-800">{u.penName || u.username}</span>
                      <span className="text-[10px] text-stone-400 ml-auto">
                        {u.role === 'KETUA_EDITOR' ? 'Ketua Editor' : u.role === 'EDITOR' ? 'Editor' : u.role}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {ralat && <p className="text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5 text-[10px]">{ralat}</p>}

            <div className="pt-2 border-t border-stone-200 flex justify-end gap-2">
              <button
                onClick={() => setSlotDisunting(null)}
                disabled={menyimpan}
                className="bg-stone-200 text-stone-700 px-3 py-1.5 rounded font-semibold text-xs disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={simpanEditor}
                disabled={menyimpan}
                className="bg-[#802334] text-white px-4 py-1.5 rounded font-semibold text-xs disabled:opacity-50"
              >
                {menyimpan ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {slotTetapan !== null && drafTetapan && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => !menyimpanTetapan && setSlotTetapan(null)}>
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-sm w-full p-5 space-y-4 text-xs" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-stone-200 pb-2">
              <h3 className="font-sans text-xs font-bold text-[#802334] uppercase">
                Tetapan Kad — Slot {slotTetapan + 1}
              </h3>
              <button onClick={() => setSlotTetapan(null)} className="text-stone-400"><X className="w-3.5 h-3.5" /></button>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Bidang</span>
              <select
                value={drafTetapan.manualDesk}
                onChange={e => setDrafTetapan(p => p ? { ...p, manualDesk: e.target.value } : p)}
                className="w-full px-2.5 py-1.5 border border-stone-300 rounded font-sans text-xs bg-white"
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
              <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Warna Latar Kad</span>
              <div className="flex gap-2 flex-wrap items-center">
                {[{ label: 'Telus', value: 'transparent' }, ...WARNA_PRATETAP].map(opt => {
                  const dipilih = (drafTetapan.bgColor || 'transparent') === opt.value;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      title={opt.label}
                      onClick={() => setDrafTetapan(p => p ? { ...p, bgColor: opt.value } : p)}
                      className={`w-7 h-7 rounded-full border-2 cursor-pointer flex items-center justify-center ${dipilih ? 'border-[#802334] scale-110' : 'border-stone-300'}`}
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
              <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Warna Bingkai Kad</span>
              <div className="flex gap-2 flex-wrap items-center">
                {[{ label: 'Auto', value: '' }, ...WARNA_PRATETAP].map(opt => {
                  const dipilih = (drafTetapan.borderColor || '') === opt.value;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      title={opt.label}
                      onClick={() => setDrafTetapan(p => p ? { ...p, borderColor: opt.value } : p)}
                      className={`w-7 h-7 rounded-full border-2 cursor-pointer flex items-center justify-center ${dipilih ? 'border-[#802334] scale-110' : 'border-stone-300'}`}
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
                <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Selang Carousel (saat)</span>
                <input
                  type="number" min={1}
                  value={drafTetapan.carouselInterval}
                  onChange={e => setDrafTetapan(p => p ? { ...p, carouselInterval: Math.max(1, parseInt(e.target.value) || 10) } : p)}
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Lengah Mula (saat)</span>
                <input
                  type="number" min={0}
                  value={drafTetapan.carouselDelay}
                  onChange={e => setDrafTetapan(p => p ? { ...p, carouselDelay: Math.max(0, parseInt(e.target.value) || 0) } : p)}
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded font-mono text-xs"
                />
              </div>
            </div>

            {ralatTetapan && <p className="text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5 text-[10px]">{ralatTetapan}</p>}

            <div className="pt-2 border-t border-stone-200 flex justify-end gap-2">
              <button
                onClick={() => setSlotTetapan(null)}
                disabled={menyimpanTetapan}
                className="bg-stone-200 text-stone-700 px-3 py-1.5 rounded font-semibold text-xs disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={simpanTetapan}
                disabled={menyimpanTetapan}
                className="bg-[#802334] text-white px-4 py-1.5 rounded font-semibold text-xs disabled:opacity-50"
              >
                {menyimpanTetapan ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SenaraiSlotConsole;
