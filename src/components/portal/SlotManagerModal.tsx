import React, { useCallback, useRef, useState } from 'react';
import { X, ChevronUp, ChevronDown, Trash2, Lock, Upload, AlertCircle } from 'lucide-react';
import { validateContentBudget, validateBidangTopik } from '../../../core/editorial/ContentBudget.js';
import { tierForSlot, ceilingForSlot, TIER_LABELS, topikCeilingForSlot } from '../../../core/editorial/GeometryConfig.js';
import { parseManualSummaryBlocks, serializeManualBentoQueue } from '../../../core/editorial/ManualBlockFormat.js';
import { BidangIcon } from '../common/BidangIcon';

interface Bidang { name: string; color: string; icon: string | null; iconSvg: string | null }

interface SlotManagerModalProps {
  editingSlotIndex: number;
  formConfig: any;
  setFormConfig: (updater: any) => void;
  activeBidangList: Bidang[];
  currentEditoriumRole: string;
  // Nama sebenar editor yang log masuk (2026-07-29) — papar di medan "Editor" (Maklumat slot +
  // Borang kandungan), lihat-sahaja. Kosong = belum log masuk (papar EDITOR_PLACEHOLDER).
  currentEditoriumName?: string;
  isSavingSlot: boolean;
  onClose: () => void;
  // Tukar slot terus dalam modal ni (2026-07-29, permintaan pemilik projek) — sebelum ni satu-
  // satunya cara tukar slot ialah Batal + buka pemilih semula. Pilihan (semua slot KECUALI Bar,
  // sama senarai macam pemilih asal) + panggilan balik ke openSlotEditor(idx) di App/Editorium.
  slotOptions?: { index: number; label: string }[];
  onSwitchSlot?: (idx: number) => void;
  // manualSummaryOverride: items (giliran kandungan) hidup sebagai state TEMPATAN modal ni (lihat
  // nota di useState items di bawah), bukan diterbitkan semula daripada formConfig.manualSummary
  // pada setiap keystroke. handleSubmit hantar serialize(items) TERUS sebagai argumen kedua di
  // sini — `onSave` ialah closure yang sudah tetap sejak render SEBELUM ia dipanggil, jadi ia
  // tetap membaca formConfig LAMA dari parent walau apa pun setFormConfig() buat pada render akan
  // datang. Hantar terus sebagai argumen elak kebergantungan pada timing React state sama sekali.
  onSave: (e: React.FormEvent, manualSummaryOverride?: string, opts?: { closeOnSuccess?: boolean }) => Promise<boolean | void> | void;
}

const TAB_LABEL: Record<string, string> = { borang: 'Borang kandungan', maklumat: 'Maklumat slot', ai: 'Arahan AI' };
const GEN_MODE_LABEL: Record<string, string> = { bebas: 'Bebas', dengan_rujukan: 'Dengan rujukan' };

const labelCls = 'font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500';

// Placeholder jujur untuk medan "Editor" bila `currentEditoriumName` tak dihantar (cth. sesi
// belum log masuk) — papar "—", bukan nama palsu.
const EDITOR_PLACEHOLDER = '—';

// Assembles a copy-pasteable prompt for an external AI chatbox — same source fields used
// elsewhere in this modal for the "Arahan AI" tab.
function buildAiPrompt(fc: any, ceiling: { maxTitle: number; maxBrief: number; maxBriefLong: number }, hadTopik: number) {
  const lines = [
    '[Peraturan am — sistem/global]', fc.masterPrompt || '-', '',
    '[Arahan khas — slot ini]', fc.promptText || '-', '',
    '[Had aksara]',
    `Tajuk: maksimum ${ceiling.maxTitle} aksara`,
    `Huraian ringkas: maksimum ${ceiling.maxBrief} aksara`,
    `Huraian panjang: maksimum ${ceiling.maxBriefLong} aksara`,
    `Topik: maksimum ${hadTopik} aksara`, '',
    `[Had usia sumber]: ${fc.aiPromptRecency || '-'}`,
    `[Bahasa sumber]: ${fc.aiPromptLanguage || '-'}`,
    `[Negara/Wilayah sumber]: ${fc.aiPromptRegion || '-'}`,
    `[Jumlah kandungan]: ${fc.generationLimit || 1}`,
    `[Mod janaan]: ${GEN_MODE_LABEL[fc.genMode] || fc.genMode || 'Bebas'}`, '',
    'Berikan output dalam format berikut sahaja, satu blok bagi setiap kandungan, dipisahkan dengan baris "____":',
    'Tajuk:', 'Topik:', 'Huraian ringkas:', 'Huraian panjang:', 'Sumber:', 'URL:', 'Tarikh sumber:',
  ];
  return lines.join('\n');
}

// Tajuk dan huraian KONGSI satu bajet ruang kad, bukan dua had berasingan — tajuk pendek
// membebaskan ruang untuk huraian lebih panjang, dan sebaliknya. Peraturan ni KEKAL dikuatkuasakan
// di peringkat simpan (validateContentBudget, ContentBudget.js) — meter ni beri amaran awal
// sebelum editor cuba simpan dan ditolak server.
function BudgetMeter({ slotIndex, ceiling, title, brief }: { slotIndex: number; ceiling: { maxTitle: number; maxBrief: number }; title: string; brief: string }) {
  const check = validateContentBudget(slotIndex, title || '', brief || '');
  const usedTitle = ceiling.maxTitle ? title.length / ceiling.maxTitle : 0;
  const usedBrief = ceiling.maxBrief ? brief.length / ceiling.maxBrief : 0;
  const used = usedTitle + usedBrief;
  const remainingBrief = ceiling.maxTitle ? Math.max(0, Math.round((1 - title.length / ceiling.maxTitle) * ceiling.maxBrief)) : ceiling.maxBrief;
  const remainingTitle = ceiling.maxBrief ? Math.max(0, Math.round((1 - brief.length / ceiling.maxBrief) * ceiling.maxTitle)) : ceiling.maxTitle;
  const tone = !check.isValid ? 'text-[#a8241f]' : used > 0.9 ? 'text-amber-700' : 'text-emerald-700';
  const barTone = !check.isValid ? 'bg-[#a8241f]' : used > 0.9 ? 'bg-amber-600' : 'bg-emerald-600';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={labelCls}>Bajet kandungan (Tajuk + Huraian ringkas)</span>
        <span className={`font-mono text-[10px] font-bold tabular-nums ${tone}`}>{Math.round(used * 100)}%</span>
      </div>
      <div className="h-[3px] w-full rounded-full bg-stone-200 overflow-hidden">
        <div className={`h-full transition-all duration-200 ${barTone}`} style={{ width: `${Math.min(used, 1) * 100}%` }} />
      </div>
      <span className="font-sans text-[10px] text-stone-400">
        Tajuk <span className={`font-mono tabular-nums ${!check.isValid ? 'text-[#a8241f]' : ''}`}>{title.length}</span>/<span className="font-mono tabular-nums">{ceiling.maxBrief > 0 ? remainingTitle : ceiling.maxTitle}</span>
        {ceiling.maxBrief > 0 && (
          <> · Huraian ringkas <span className={`font-mono tabular-nums ${!check.isValid ? 'text-[#a8241f]' : ''}`}>{brief.length}</span>/<span className="font-mono tabular-nums">{remainingBrief}</span></>
        )}
        {!check.isValid && <span className="text-[#a8241f]"> · pendekkan kandungan</span>}
      </span>
    </div>
  );
}

function Field({ label, value, onChange, rows, placeholder, maxLen, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; maxLen?: number; hint?: string }) {
  const over = typeof maxLen === 'number' && value.length > maxLen;
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className={`${labelCls} flex items-baseline gap-1.5`}>
          {label}
          {hint && <span className="font-sans normal-case tracking-normal font-normal text-stone-400">{hint}</span>}
        </span>
        {typeof maxLen === 'number' && (
          <span className={`font-mono text-[9px] tabular-nums ${over ? 'text-[#a8241f]' : 'text-stone-400'}`}>{value.length}/{maxLen}</span>
        )}
      </span>
      {rows ? (
        <textarea
          rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="w-full resize-none border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm leading-relaxed text-stone-800 py-1.5 transition-colors"
        />
      ) : (
        <input
          type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="w-full border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
        />
      )}
    </label>
  );
}

// Medan boleh taip (URL/nama fail sedia ada) DAN muat naik terus — butang panggil
// /api/media/upload (base64 di badan JSON, lihat core/routes/mediaRoutes.js), tukar respons
// { url } jadi nilai medan. Tidak buang keupayaan taip terus, sebab kandungan sedia ada mungkin
// sudah rujuk fail/URL yang bukan hasil muat naik baharu.
function ImageField({ label, value, onChange, onUploadFile, uploading, note }: {
  label: string; value: string; onChange: (v: string) => void; onUploadFile: (file: File) => void; uploading?: boolean; note?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className={labelCls}>{label}</span>
        {note && <span className="font-sans text-[9px] text-stone-400">{note}</span>}
      </span>
      <span className="flex items-center gap-2">
        <input
          type="text" value={value} placeholder="Nama fail / URL imej…" onChange={(e) => onChange(e.target.value)}
          className="w-0 flex-1 border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
        />
        <button
          type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2.5 py-1 border border-stone-300 rounded text-[11px] font-sans font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-wait"
        >
          <Upload className="w-3 h-3" />{uploading ? 'Memuat naik…' : 'Muat naik'}
        </button>
      </span>
      <input
        ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadFile(f); e.target.value = ''; }}
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={`${labelCls} flex items-center gap-1`}>{label} <Lock className="w-2.5 h-2.5 text-stone-300" /></span>
      <span className="font-serif text-sm text-stone-500 border-b border-stone-150 py-1.5">{value || '—'}</span>
    </div>
  );
}

// "Lulus" mesti gabung DUA pengesahan — bajet tajuk+huraian DAN had ruang eyebrow "Bidang | Topik"
// (validateBidangTopik) — bukan bajet sahaja. Dua-dua pengesahan ini KEKAL menyekat Simpan Slot di
// server.js (syncManualObjectsForSlot), jadi meter/lulus di sini mesti guna formula SAMA supaya
// tiada kandungan nampak "lulus" di modal tapi ditolak server semasa simpan.
function itemFits(slotIndex: number, desk: string, item: { title?: string; brief?: string; topik?: string }) {
  const budget = validateContentBudget(slotIndex, item.title || '', item.brief || '');
  if (!budget.isValid) return budget;
  return validateBidangTopik({ slotBidang: desk, itemBidang: desk, topik: item.topik || '', requireTopik: true, slotIndex });
}

// React.memo supaya baris sidebar yang TIDAK terjejas oleh keystroke semasa (biasanya 9
// daripada 10 kandungan) langkau render sepenuhnya, bukan sekadar cepat — mengelakkan React
// mendiffkan seluruh <ol> pada SETIAP aksara ditaip di kandungan aktif. Perbandingan shallow
// React.memo ni hanya berkesan kalau `item` kekal SAMA rujukan objek untuk kandungan yang tidak
// diedit (patch() hanya cipta objek baharu untuk index yang diedit) DAN onSelect/onMoveUp/
// onMoveDown/onRemove kekal STABIL merentasi render (useCallback([items.length]) di bawah).
const SidebarItem = React.memo(function SidebarItem({
  item, index, isActive, slotIndex, desk, onSelect, onMoveUp, onMoveDown, onRemove,
}: {
  item: any; index: number; isActive: boolean; slotIndex: number; desk: string;
  onSelect: (i: number) => void; onMoveUp: (i: number) => void; onMoveDown: (i: number) => void; onRemove: (i: number) => void;
}) {
  // Senarai ni HANYA draf (2026-07-29, permintaan pemilik projek) — ✓/✕ di sini sekadar
  // pratonton sama ada kandungan SUDAH sedia untuk ditekan Terbit (bajet+Topik lulus), bukan
  // status sebenar (tiada lagi "Tunggu"/"Live" — kesemuanya draf sehingga Terbit ditekan).
  const check = itemFits(slotIndex, desk, item);
  return (
    <li
      onClick={() => onSelect(index)}
      className={`group grid items-center gap-2.5 px-3 py-2.5 cursor-pointer border-b border-stone-150 last:border-b-0 transition-colors ${isActive ? 'bg-[#802334]/[0.04] shadow-[inset_2px_0_0_#802334]' : 'hover:bg-stone-50'}`}
      style={{ gridTemplateColumns: '26px 1fr auto' }}
    >
      <span className={`font-mono text-[11px] font-bold tabular-nums ${isActive ? 'text-[#802334]' : 'text-stone-400'}`}>{String(index + 1).padStart(2, '0')}</span>
      <span className={`font-serif text-[13px] leading-snug truncate ${isActive ? 'text-stone-900 font-medium' : 'text-stone-600'}`}>
        {item.title || <span className="text-stone-400 italic">Tiada tajuk</span>}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="hidden group-hover:flex items-center gap-1.5">
          <button type="button" aria-label="Naik" onClick={(e) => { e.stopPropagation(); onMoveUp(index); }} className="text-stone-500 hover:text-[#802334] px-0.5"><ChevronUp size={13} /></button>
          <button type="button" aria-label="Turun" onClick={(e) => { e.stopPropagation(); onMoveDown(index); }} className="text-stone-500 hover:text-[#802334] px-0.5"><ChevronDown size={13} /></button>
          <button type="button" aria-label="Buang" onClick={(e) => { e.stopPropagation(); onRemove(index); }} className="text-[#a8241f] px-0.5"><Trash2 size={12} /></button>
        </span>
        <span className={`group-hover:hidden font-mono text-[9px] ${check.isValid ? 'text-emerald-700' : 'text-[#a8241f]'}`} title={check.isValid ? 'Sedia untuk Terbit' : check.reason}>
          {check.isValid ? '✓' : '✕'}
        </span>
      </span>
    </li>
  );
});

export const SlotManagerModal: React.FC<SlotManagerModalProps> = ({
  editingSlotIndex, formConfig, setFormConfig, activeBidangList, currentEditoriumRole, currentEditoriumName, onClose, onSave,
  slotOptions, onSwitchSlot,
}) => {
  const editorName = currentEditoriumName || EDITOR_PLACEHOLDER;
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<'borang' | 'maklumat' | 'ai'>('borang');
  const [pasteNote, setPasteNote] = useState('');
  const [aiNote, setAiNote] = useState('');
  const [imageNote, setImageNote] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const tier = tierForSlot(editingSlotIndex) || 'STANDARD';
  const ceiling = ceilingForSlot(editingSlotIndex);
  const desk = formConfig.manualDesk || '';
  const bidang = activeBidangList.find((b) => b.name.toLowerCase() === desk.toLowerCase());
  const accent = bidang?.color || '#802334';
  const hadTopik = topikCeilingForSlot(editingSlotIndex, desk);

  // Giliran kandungan (items) hidup sebagai STATE TEMPATAN modal ni, BUKAN diterbitkan semula
  // daripada formConfig.manualSummary (rentetan teks) pada setiap keystroke. Menghurai SELURUH
  // blok teks (semua kandungan dalam giliran) + serialize semula pada SETIAP aksara ditaip di
  // MANA-MANA medan — untuk slot dengan banyak kandungan — cukup berat untuk keystroke tercicir
  // (bar ruang khususnya nampak paling terjejas). formConfig.manualSummary kini hanya di-SYNC
  // pada saat Simpan (handleSubmit di bawah, hantar serialize(items) TERUS sebagai argumen kepada
  // onSave — lihat nota manualSummaryOverride di SlotManagerModalProps) — bukan setiap keystroke.
  // useState() punya initializer hanya jalan SEKALI semasa mount; supaya ia betul-betul re-init
  // bila tukar slot (bukan bawa items lama), FrontpageView.tsx render komponen ni dengan
  // key={editingSlotIndex} — tukar slot = remount penuh, bukan sekadar prop baharu.
  const blankItem = (suffix: string | number = '') => ({
    uuid: `object-manual-slot${editingSlotIndex}-${Date.now()}${suffix}`,
    title: '', brief: '', briefLong: '', topik: '', source: '', url: '', date: '', note: '', image: '',
    // Alur kerja Draf/Terbit (2026-07-29, permintaan pemilik projek) — lalai DRAF untuk
    // kandungan BAHARU: tak sesekali live sehingga editor sedar-sedar tekan "Terbit". Kandungan
    // sedia ada yang dihurai daripada manualSummary (lihat parseManualSummaryBlocks) bawa status
    // sebenar tersimpan (lalai 'approved' kalau tiada baris Status: — blok lama sebelum ciri ni
    // wujud, memang live).
    status: 'draft',
  });

  // Bekalkan SEKURANG-KURANGNYA satu blok kosong bila slot benar-benar kosong (bukan senarai
  // kosong) — sebelum ni borang PAPAR medan yang nampak boleh disunting walhal items=[] bermakna
  // patch() memetakan array KOSONG (tiada kesan, taipan hilang senyap) sehingga "+ Masukkan"
  // ditekan dulu. Reprodusi hidup: isi borang bila giliran kosong, tiada apa tersimpan.
  const [items, setItems] = useState<any[]>(() => {
    const parsed = parseManualSummaryBlocks(formConfig.manualSummary || '');
    return parsed.length > 0 ? parsed : [blankItem()];
  });
  const activeIndex = Math.max(0, Math.min(active, items.length - 1));
  const current = items[activeIndex] || blankItem();

  const commit = (mutator: (prevItems: any[]) => any[]) => setItems((prev) => mutator(prev));
  const patch = (i: number, key: string, value: string) => commit((prevItems) => (
    // Sama pertahanan macam initializer di atas — kalau entah bagaimana items jadi kosong (cth.
    // remove() buang kandungan terakhir), patch() masih WAJIB ada sesuatu untuk disunting, bukan
    // no-op senyap.
    prevItems.length > 0
      ? prevItems.map((it, n) => (n === i ? { ...it, [key]: value } : it))
      : [{ ...blankItem(), [key]: value }]
  ));
  // useCallback([items.length]): identiti KEKAL STABIL sepanjang menaip biasa (panjang giliran tak
  // berubah bila sekadar mengedit medan), hanya berubah identiti bila kandungan ditambah/dibuang/
  // disusun semula. SidebarItem (React.memo) bergantung pada kestabilan ni untuk boleh melangkau
  // render baris sidebar yang tidak terjejas setiap keystroke.
  const move = useCallback((i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    commit((prevItems) => {
      const next = prevItems.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setActive(j);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);
  // Amaran sebelum padam — sebelum ni klik terus buang kandungan tanpa sebarang pengesahan,
  // langkah senyap dan tak boleh dibuat asal dalam tab ni (cuma window.confirm ringkas, bukan
  // mesej khusus nama kandungan — remove() perlu kekal stabil merentasi keystroke, lihat nota
  // useCallback di atas, jadi ia sengaja tidak bergantung pada `items` penuh untuk baca tajuk).
  const remove = useCallback((i: number) => {
    if (!window.confirm('Padam kandungan ini daripada giliran? Tindakan ini tidak boleh dibuat asal selepas disimpan.')) return;
    commit((prevItems) => prevItems.filter((_, n) => n !== i));
    setActive((a) => Math.max(0, Math.min(a, items.length - 2)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);
  const moveUp = useCallback((i: number) => move(i, -1), [move]);
  const moveDown = useCallback((i: number) => move(i, 1), [move]);
  const insert = () => {
    commit((prevItems) => [...prevItems, blankItem()]);
    setActive(items.length);
  };

  // AI luaran boleh pulangkan SATU kandungan (tampal ke medan aktif) atau BERBILANG kandungan
  // dipisah "____"/"----"/"====" (ikut [Jumlah kandungan] dalam prompt Arahan AI) — kes kedua
  // mesti dipisah dulu sebelum dihurai, atau setiap label ("Tajuk:", dll) yang berulang akan
  // saling timpa dan cuma blok TERAKHIR selamat.
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsedBlocks = parseManualSummaryBlocks(text);
      if (parsedBlocks.length === 0) {
        setPasteNote('Format tidak dikenali');
      } else {
        const replacement = parsedBlocks.map((b, i) => ({
          uuid: b.uuid || `object-manual-slot${editingSlotIndex}-${Date.now()}-${i}`,
          // Modal ni ruang draf sahaja (2026-07-29, permintaan pemilik projek) — apa jua ditampal
          // masuk sebagai draf, editor tekan Terbit sendiri bila sedia (tiada lagi status
          // "pending" separa-terbit tersembunyi sebelum Terbit ditekan).
          status: 'draft',
          title: b.title, topik: b.topik, brief: b.brief, briefLong: b.briefLong,
          source: b.source, url: b.url, date: b.date, note: b.note, image: b.image,
        }));
        commit((prevItems) => {
          const next = prevItems.slice();
          next.splice(activeIndex, 1, ...replacement);
          return next;
        });
        setActive(activeIndex);
        setPasteNote(parsedBlocks.length > 1 ? `${parsedBlocks.length} kandungan ditampal` : 'Ditampal ke medan berkaitan');
      }
    } catch (e) { setPasteNote('Akses papan klip ditolak'); }
    setTimeout(() => setPasteNote(''), 2400);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildAiPrompt(formConfig, ceiling, hadTopik));
      setAiNote('Disalin');
    } catch (e) { setAiNote('Akses papan klip ditolak'); }
    setTimeout(() => setAiNote(''), 2400);
  };

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  const uploadImage = async (i: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      setImageNote('Fail mesti imej');
      setTimeout(() => setImageNote(''), 2400);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageNote('Fail terlalu besar (had 5MB)');
      setTimeout(() => setImageNote(''), 2400);
      return;
    }
    setUploadingImage(true);
    try {
      const fileData: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Gagal baca fail'));
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, fileData }),
      });
      if (!res.ok) throw new Error('Muat naik gagal');
      const data = await res.json();
      patch(i, 'image', data.url);
      setImageNote('Dimuat naik');
    } catch (e) {
      setImageNote('Muat naik gagal — cuba lagi');
    } finally {
      setUploadingImage(false);
      setTimeout(() => setImageNote(''), 2400);
    }
  };

  // Butang "Terbit" (2026-07-29, permintaan pemilik projek) — AKSI SEGERA, bukan togol status.
  // Klik Terbit hantar SATU kandungan terus ke server (status='pending' utk permintaan ni
  // sahaja, tak diubah pada state tempatan), server cipta rekod Indeks rasmi & pulangkan
  // manualSummary draf-sahaja. Bila berjaya, kandungan tu terus BUANG daripada senarai draf
  // tempatan — modal ni kekal terbuka, ruang draf peribadi sahaja (tiada lagi kumpulan "Akan
  // Diterbitkan" — kandungan sama ada Draf DI SINI, atau sudah Pending DI Indeks, tiada keadaan
  // pertengahan yang kelihatan).
  const [publishingIndex, setPublishingIndex] = useState<number | null>(null);
  const [publishError, setPublishError] = useState('');
  const publishOne = async (i: number) => {
    const item = items[i];
    const check = itemFits(editingSlotIndex, desk, item);
    if (!check.isValid) {
      setPublishError(check.reason || 'Kandungan ini tidak lulus bajet ruang kad atau Topik.');
      setTimeout(() => setPublishError(''), 3600);
      return;
    }
    setPublishingIndex(i);
    const outgoing = items.map((it, n) => (n === i ? { ...it, status: 'pending' } : it));
    const remainingDrafts = items.filter((_, n) => n !== i);
    const ok = await onSave({ preventDefault: () => {} } as React.FormEvent, serializeManualBentoQueue(outgoing), { closeOnSuccess: false });
    setPublishingIndex(null);
    if (ok) {
      commit(() => remainingDrafts);
      setActive((a) => Math.max(0, Math.min(a, remainingDrafts.length - 1)));
      setFormConfig((prev: any) => ({ ...prev, manualSummary: serializeManualBentoQueue(remainingDrafts) }));
    }
  };

  // "Simpan sebagai draf" (2026-07-29, permintaan pemilik projek) — butang Batal/Simpan
  // keseluruhan modal di footer DIBUANG terus (tiada fungsi lagi selepas Terbit jadi aksai
  // segera per-kandungan). Ganti dengan aksi eksplisit di bawah borang, sama tempat macam
  // Terbit: hantar SELURUH giliran draf semasa ke server (persist), modal KEKAL terbuka.
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftNote, setDraftNote] = useState('');
  const saveDraft = async () => {
    setSavingDraft(true);
    const manualSummary = serializeManualBentoQueue(items);
    const ok = await onSave({ preventDefault: () => {} } as React.FormEvent, manualSummary, { closeOnSuccess: false });
    setSavingDraft(false);
    setFormConfig((prev: any) => ({ ...prev, manualSummary }));
    setDraftNote(ok ? 'Draf disimpan' : 'Gagal simpan draf');
    setTimeout(() => setDraftNote(''), 2400);
  };

  // Tukar slot terus dari sini (2026-07-29) — modal ni REMOUNT penuh bila editingSlotIndex ibu
  // bapa berubah (key={editingSlotIndex} di pemanggil), jadi `items` tempatan hilang tak
  // disimpan. Amaran dulu kalau ada apa-apa benar-benar ditaip (bukan cuma baris kosong "+
  // Masukkan" belum disentuh), sama falsafah macam amaran padam kandungan di atas.
  const handleSwitchSlot = (idx: number) => {
    if (idx === editingSlotIndex) return;
    const hasUnsavedWork = items.some((it) => (it.title || '').trim() || (it.brief || '').trim());
    if (hasUnsavedWork && !window.confirm('Tukar slot akan buang draf belum diterbitkan/disimpan dalam slot ni. Teruskan?')) return;
    onSwitchSlot?.(idx);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-white rounded-lg border border-stone-200 shadow-2xl w-full max-w-[1080px] h-[min(88vh,720px)] max-h-full flex flex-col overflow-hidden animate-fade-in">

        <header className="flex-none px-6 md:px-8 pt-5 pb-3.5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="font-serif text-xl md:text-2xl font-medium tracking-tight text-stone-900">
                Urus Slot <span className="font-mono text-lg" style={{ color: accent }}>{editingSlotIndex + 1}</span>
              </h2>
              <p className="mt-1.5 flex items-center gap-2.5 flex-wrap">
                {bidang && <BidangIcon iconName={bidang.icon} iconSvg={bidang.iconSvg} color={accent} variant="bare" size={13} title={desk} />}
                <span className="font-sans text-[10px] uppercase tracking-[0.15em] font-extrabold" style={{ color: accent }}>{desk || '— Belum ditetapkan —'}</span>
                <span className="text-stone-300">·</span>
                <span className="font-sans text-[11px] text-stone-500">{TIER_LABELS[tier] || tier}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Tukar slot (2026-07-29) — dropdown terus di sini gantikan kena Batal + buka
                  pemilih semula setiap kali nak tukar slot lain. */}
              {slotOptions && slotOptions.length > 0 && (
                <select
                  value={editingSlotIndex}
                  onChange={(e) => handleSwitchSlot(parseInt(e.target.value, 10))}
                  className="border border-stone-300 rounded px-2.5 py-1.5 font-sans text-xs font-semibold text-stone-600 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#802334]"
                >
                  {slotOptions.map((opt) => (
                    <option key={opt.index} value={opt.index}>{opt.label}</option>
                  ))}
                </select>
              )}
              <button type="button" aria-label="Tutup" onClick={onClose} className="text-stone-400 hover:text-stone-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
          </div>
          {/* UUID + bajet kandungan (2026-07-29, permintaan pemilik projek) — dipindah dari
              tengah borang ke header supaya editor sedar bajet sepanjang masa menaip, tanpa
              tatal. Hanya relevan untuk tab "Borang kandungan" (kandungan aktif semasa), tapi
              kekal kelihatan tanpa mengira tab supaya tak hilang bila beralih ke tab lain. */}
          {ceiling.maxBrief > 0 && (
            <div className="mt-3 flex items-end justify-between gap-6">
              <span className="font-mono text-[10px] text-stone-400">UUID <span className="text-stone-500">{current.uuid || '—'}</span></span>
              <div className="w-full max-w-[360px]">
                <BudgetMeter slotIndex={editingSlotIndex} ceiling={ceiling} title={current.title || ''} brief={current.brief || ''} />
              </div>
            </div>
          )}
        </header>
        <hr className="border-stone-150" />

        {/* Amaran kandungan demo (2026-07-29) — slot ni kosong sebenar, borang di bawah disintesis
            daripada kandungan demo "Tentang Adjung" (bukan simpanan sebenar). Insiden sebenar:
            tanpa amaran ni, teks demo tak dapat dibezakan langsung daripada kandungan tersimpan —
            hampir tersiar sebagai kandungan sebenar semasa audit UI/UX 2026-07-29. */}
        {formConfig.isDemoContent && (
          <div className="flex-none bg-amber-50 border-b border-amber-200 px-6 md:px-8 py-2 flex items-center gap-2 text-amber-900 font-sans text-[11px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span><strong>Kandungan contoh</strong> — slot ni belum ada kandungan tersimpan. Medan di bawah diisi teks demo "Tentang Adjung" sebagai templat sahaja; gantikan sebelum Simpan.</span>
          </div>
        )}

        <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: 'minmax(240px, 32%) 1fr' }}>

          <section className="min-h-0 flex flex-col border-r border-stone-150">
            <div className="flex-none flex items-baseline justify-between px-3 pt-3 pb-2">
              <span className={labelCls}>Draf</span>
              <span className="font-mono text-[10px] text-stone-400">{items.length}</span>
            </div>
            {/* Modal ni RUANG DRAF PERIBADI SAHAJA (2026-07-29, permintaan pemilik projek) —
                senarai FLAT, satu kumpulan "Draf" sahaja. Tiada lagi kumpulan "Akan Diterbitkan":
                Terbit (butang publishOne di atas) ialah AKSI SEGERA, bukan status yang ditogol —
                sebaik sahaja ditekan & berjaya, kandungan terus KELUAR daripada senarai ni (jadi
                rekod Indeks rasmi berstatus Pending), tiada keadaan pertengahan kelihatan di sini. */}
            <div className="flex-1 min-h-0 overflow-y-auto border-t border-stone-150">
              <ol className="list-none m-0 p-0">
                {items.map((it, i) => (
                  <SidebarItem
                    key={it.uuid || i}
                    item={it} index={i} isActive={i === activeIndex}
                    slotIndex={editingSlotIndex} desk={desk}
                    onSelect={setActive} onMoveUp={moveUp} onMoveDown={moveDown} onRemove={remove}
                  />
                ))}
              </ol>
            </div>
            <div className="flex-none border-t border-stone-150 p-2">
              <button type="button" onClick={insert} className="w-full text-center py-1.5 rounded font-sans text-[11px] font-semibold text-stone-600 hover:text-[#802334] hover:bg-[#802334]/[0.08] transition-colors cursor-pointer">
                + Tambah Kandungan Baharu
              </button>
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto px-6 md:px-8 py-5 flex flex-col gap-5">
            <div className="flex gap-4.5">
              {(Object.keys(TAB_LABEL) as Array<keyof typeof TAB_LABEL>).map((t) => (
                <button
                  key={t} type="button" onClick={() => setTab(t as any)}
                  className={`relative pb-2.5 font-sans text-xs font-semibold cursor-pointer ${tab === t ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  {TAB_LABEL[t]}
                  {tab === t && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#802334]" />}
                </button>
              ))}
            </div>

            {/* a. MAKLUMAT SLOT — semua medan lihat sahaja (*), diisi automatik oleh sistem. */}
            {tab === 'maklumat' && (
              <div className="grid grid-cols-2 gap-5">
                <ReadOnlyField label="Nombor" value={String(editingSlotIndex + 1)} />
                <ReadOnlyField label="Jenis" value={TIER_LABELS[tier] || tier} />
                <ReadOnlyField label="Bidang" value={desk} />
                <ReadOnlyField label="Editor" value={editorName} />
                <ReadOnlyField label="Bilangan kandungan" value={String(items.length)} />
                {/* Kadar putaran carousel (2026-07-29) — dipindah dari footer ke sini: tetapan
                    berkaitan SLOT (ditetapkan Ketua Editor), bukan urusan editor menulis kandungan. */}
                <ReadOnlyField label="Kadar putaran carousel" value={`${formConfig.carouselInterval || 10}s`} />
                <span className="col-span-2 font-sans text-[10px] text-stone-400 -mt-2">
                  Bidang ditetapkan di Tetapan Slot (bukan di sini). Tetapan warna slot hanya boleh dibuat oleh Ketua Editor.
                </span>
              </div>
            )}

            {/* b. BORANG KANDUNGAN */}
            {tab === 'borang' && (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <span className={labelCls}>Kandungan <span className="font-mono">{String(activeIndex + 1).padStart(2, '0')}</span></span>
                  <span className="flex items-center gap-2.5">
                    {pasteNote && <span className="font-sans text-[10px] text-stone-400">{pasteNote}</span>}
                    {/* Butang "Masukkan" berlebihan dibuang (2026-07-29) — sama fungsi persis
                        dengan "+ Masukkan" di bawah senarai Giliran carousel (kedua-duanya
                        panggil insert()); dua tempat untuk satu kelakuan cuma mengelirukan. */}
                    <button type="button" onClick={paste} className="px-2.5 py-1 border border-stone-300 rounded text-[11px] font-sans font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer">Tampal</button>
                  </span>
                </div>

                <Field label="Topik" value={current.topik || ''} placeholder="Topik kandungan…" maxLen={hadTopik} onChange={(v) => patch(activeIndex, 'topik', v)} />
                <Field label="Tajuk" value={current.title || ''} placeholder="Tajuk kandungan…" onChange={(v) => patch(activeIndex, 'title', v)} />
                {ceiling.maxBrief > 0 && (
                  <>
                    <Field label="Huraian ringkas" rows={4} value={current.brief || ''} placeholder="Huraian ringkas, dipapar pada kad…" onChange={(v) => patch(activeIndex, 'brief', v)} />
                    <Field label="Huraian panjang" rows={5} value={current.briefLong || ''} placeholder="Huraian panjang, untuk paparan menatal penuh — hanya di Focus View…" maxLen={ceiling.maxBriefLong} onChange={(v) => patch(activeIndex, 'briefLong', v)} />
                  </>
                )}

                <hr className="border-stone-150" />
                <div className="grid grid-cols-2 gap-5">
                  <Field label="Sumber" value={current.source || ''} placeholder="Adjung Editorial" maxLen={60} onChange={(v) => patch(activeIndex, 'source', v)} />
                  <Field label="URL" value={current.url || ''} placeholder="https://…" onChange={(v) => patch(activeIndex, 'url', v)} />
                  <Field label="Tarikh sumber" value={current.date || ''} placeholder="21.07.26" onChange={(v) => patch(activeIndex, 'date', v)} />
                  <ImageField label="Imej" value={current.image || ''} note={imageNote} uploading={uploadingImage} onChange={(v) => patch(activeIndex, 'image', v)} onUploadFile={(f) => uploadImage(activeIndex, f)} />
                </div>
                <Field label="Nota" rows={2} value={current.note || ''} placeholder="Nota editor (pilihan) — hanya di Focus View…" maxLen={280} onChange={(v) => patch(activeIndex, 'note', v)} />
                <ReadOnlyField label="Editor" value={editorName} />

                <hr className="border-stone-150" />
                {/* Butang Terbit (2026-07-29, permintaan pemilik projek) — AKSI SEGERA, bukan
                    togol status. Kandungan dalam modal ni SENTIASA draf sehingga butang ni
                    ditekan; klik terus hantar SATU kandungan ni ke Indeks (status Pending) dan
                    buang daripada senarai draf — jelas berasingan daripada butang Simpan
                    keseluruhan modal di footer (Simpan cuma simpan baki draf, tak terbitkan apa-
                    apa). */}
                <div className="flex items-center justify-between gap-4">
                  <span className="flex flex-col gap-0.5">
                    <span className={labelCls}>Kandungan ini masih draf</span>
                    {(publishError || draftNote) && (
                      <span className={`font-sans text-[10px] ${publishError ? 'text-[#a8241f]' : 'text-stone-500'}`}>{publishError || draftNote}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button" onClick={saveDraft} disabled={savingDraft || publishingIndex !== null}
                      className="px-4 py-1.5 border border-stone-300 text-stone-600 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-wait rounded text-[11px] font-sans font-semibold cursor-pointer transition-colors"
                    >
                      {savingDraft ? 'Menyimpan…' : 'Simpan sebagai draf'}
                    </button>
                    <button
                      type="button" onClick={() => publishOne(activeIndex)} disabled={publishingIndex !== null || savingDraft}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-wait text-white rounded text-[11px] font-sans font-semibold cursor-pointer transition-colors"
                    >
                      {publishingIndex === activeIndex ? 'Menerbitkan…' : 'Terbit sekarang'}
                    </button>
                  </span>
                </div>
              </>
            )}

            {/* c. ARAHAN AI */}
            {tab === 'ai' && (
              <>
                <div>
                  <span className={labelCls}>Had aksara</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                    <ReadOnlyField label="a. Tajuk" value={String(ceiling.maxTitle)} />
                    <ReadOnlyField label="b. Huraian ringkas" value={ceiling.maxBrief > 0 ? String(ceiling.maxBrief) : 'Tiada'} />
                    <ReadOnlyField label="c. Huraian panjang" value={ceiling.maxBrief > 0 ? String(ceiling.maxBriefLong) : 'Tiada'} />
                    <ReadOnlyField label="d. Topik" value={String(hadTopik)} />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className={labelCls}>Arahan am (Sistem/Global) <span className="font-sans normal-case tracking-normal text-stone-400">· auto</span></span>
                  <div className="font-serif text-[13px] leading-relaxed text-stone-500 bg-stone-50 rounded p-3">
                    {formConfig.masterPrompt || <span className="text-stone-400">Tiada arahan ditetapkan</span>}
                  </div>
                  <span className="font-sans text-[9px] text-stone-400">Ditetapkan oleh Ketua Editor di Editorium · auto</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className={labelCls}>Arahan khas (slot ini) <span className="font-sans normal-case tracking-normal text-stone-400">· auto</span></span>
                  <div className="font-serif text-[13px] leading-relaxed text-stone-500 bg-stone-50 rounded p-3">
                    {formConfig.promptText || <span className="text-stone-400">Tiada arahan ditetapkan</span>}
                  </div>
                  <span className="font-sans text-[9px] text-stone-400">Ditetapkan oleh Ketua Editor — tidak boleh diubah suai di modal dialog ini.</span>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <Field label="Had usia sumber" value={formConfig.aiPromptRecency || ''} placeholder="Cth. 24 jam, 1 minggu" onChange={(v) => setFormConfig((prev: any) => ({ ...prev, aiPromptRecency: v }))} />
                  <Field label="Bahasa sumber" value={formConfig.aiPromptLanguage || ''} onChange={(v) => setFormConfig((prev: any) => ({ ...prev, aiPromptLanguage: v }))} />
                  <Field label="Negara asal sumber" value={formConfig.aiPromptRegion || ''} onChange={(v) => setFormConfig((prev: any) => ({ ...prev, aiPromptRegion: v }))} />
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>Jumlah kandungan</span>
                    <input
                      type="number" min={1} value={formConfig.generationLimit || 1}
                      onChange={(e) => setFormConfig((prev: any) => ({ ...prev, generationLimit: Number(e.target.value) }))}
                      className="w-full border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-mono text-sm text-stone-800 py-1.5"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className={labelCls}>Mod janaan</span>
                  <div className="inline-flex border border-stone-300 rounded overflow-hidden w-fit">
                    {(['bebas', 'dengan_rujukan'] as const).map((v, i) => (
                      <button
                        key={v} type="button" onClick={() => setFormConfig((prev: any) => ({ ...prev, genMode: v }))}
                        className={`px-3.5 py-1.5 font-sans text-[11px] font-semibold cursor-pointer transition-colors ${i ? 'border-l border-stone-300' : ''} ${(formConfig.genMode || 'bebas') === v ? 'bg-[#802334] text-white' : 'bg-transparent text-stone-600'}`}
                      >
                        {GEN_MODE_LABEL[v]}
                      </button>
                    ))}
                  </div>
                </div>

                <hr className="border-stone-150" />
                <div className="flex items-center justify-between gap-4">
                  <span className="font-sans text-[11px] text-stone-500">Salin arahan ini untuk ditampal ke chatbox AI. Output AI ditampal semula di "Borang kandungan" (butang Tampal).</span>
                  <button type="button" onClick={copyPrompt} className="px-2.5 py-1 border border-stone-300 rounded text-[11px] font-sans font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer shrink-0">{aiNote || 'Salin prompt'}</button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
