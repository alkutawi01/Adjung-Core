import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronUp, ChevronDown, Trash2, Lock, Upload, AlertCircle } from 'lucide-react';
import { validateContentBudget, validateBidangTopik } from '../../../core/editorial/ContentBudget.js';
import { tierForSlot, ceilingForSlot, TIER_LABELS, topikCeilingForSlot, MIN_BRIEF_LONG_CHARS } from '../../../core/editorial/GeometryConfig.js';
import { parseManualSummaryBlocks, serializeManualBentoQueue } from '../../../core/editorial/ManualBlockFormat.js';
import { BidangIcon } from '../common/BidangIcon';
import { Tooltip } from '../common/Tooltip';
import { labelUi } from '../../config/istilah';
import { usePhoneViewport } from '../../hooks/usePhoneViewport';
import { useModalFokus } from '../../hooks/useModalFokus';

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
  // Mesej ralat simpan terkini daripada useSlotEditor (2026-08-02) — sebelum ni `onSave` cuma
  // pulangkan boolean `ok`, jadi sebab kegagalan sebenar (termasuk konflik serentak Fasa 6) tak
  // pernah sampai ke UI langsung. Dibaca oleh publishOne/saveDraft di bawah bila `ok` palsu.
  saveError?: string;
  onClose: () => void;
  // Tukar slot terus dalam modal ni (2026-07-29, permintaan pemilik projek) — sebelum ni satu-
  // satunya cara tukar slot ialah Batal + buka pemilih semula. Pilihan (semua slot KECUALI Bar,
  // sama senarai macam pemilih asal) + panggilan balik ke openSlotEditor(idx) di App/Editorium.
  slotOptions?: { index: number; label: string }[];
  onSwitchSlot?: (idx: number) => void;
  // Buka terus pada SATU kandungan dalam giliran slot (2026-08-01) — dihantar oleh "Draf Saya",
  // supaya klik pada draf mendarat betul-betul pada draf itu, bukan pada kandungan pertama slot.
  // Kosong/tak dijumpai = kelakuan asal (kandungan pertama).
  initialUuid?: string;
  // manualSummaryOverride: items (giliran kandungan) hidup sebagai state TEMPATAN modal ni (lihat
  // nota di useState items di bawah), bukan diterbitkan semula daripada formConfig.manualSummary
  // pada setiap keystroke. handleSubmit hantar serialize(items) TERUS sebagai argumen kedua di
  // sini — `onSave` ialah closure yang sudah tetap sejak render SEBELUM ia dipanggil, jadi ia
  // tetap membaca formConfig LAMA dari parent walau apa pun setFormConfig() buat pada render akan
  // datang. Hantar terus sebagai argumen elak kebergantungan pada timing React state sama sekali.
  onSave: (e: React.FormEvent, manualSummaryOverride?: string, opts?: { closeOnSuccess?: boolean }) => Promise<boolean | void> | void;
}

const TAB_LABEL: Record<string, string> = { borang: 'Borang kandungan', maklumat: 'Maklumat slot', ai: 'Arahan AI', sejarah: 'Sejarah versi' };
const GEN_MODE_LABEL: Record<string, string> = { bebas: 'Bebas', dengan_rujukan: 'Dengan rujukan' };

const labelCls = 'font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500';

// Placeholder jujur untuk medan "Editor" bila `currentEditoriumName` tak dihantar (cth. sesi
// belum log masuk) — papar "—", bukan nama palsu.
const EDITOR_PLACEHOLDER = '—';

// Assembles a copy-pasteable prompt for an external AI chatbox — same source fields used
// elsewhere in this modal for the "Arahan AI" tab.
// titleTarget/briefTarget (2026-08-07, pepijat kritikal Izzat) — editor laraskan slider SATU
// pasangan nombor yang SUDAH sah ikut formula bajet kongsi (titleTarget/maxTitle +
// briefTarget/maxBrief <= 1, dikira di caller — lihat pengendali slider di JSX), bukan hantar
// dua had solo (maxTitle, maxBrief) berasingan macam sebelum ni ke AI luaran seolah-olah kedua
// boleh dicapai PENUH serentak — itu mustahil ikut formula sebenar, validateContentBudget tolak
// 100% terjamin bila AI ikut arahan literal. AI cuma perlu DUA nombor mudah, bukan penjelasan
// formula — pengiraan/keselarasan jadi tanggungjawab UI (slider), bukan tanggungjawab AI.
function buildAiPrompt(fc: any, ceiling: { maxBriefLong: number }, hadTopik: number, titleTarget: number, briefTarget: number) {
  const desk = fc.manualDesk || '';
  const lines = [
    '[Bidang — subjek terkunci untuk slot ini, kandungan MESTI berkaitan]', desk || '(belum ditetapkan — hubungi Ketua Editor sebelum jana)', '',
    '[Peraturan am — sistem/global]', fc.masterPrompt || '-', '',
    '[Arahan khas — slot ini]', fc.promptText || '-', '',
    '[Had aksara]',
    `Topik: maksimum ${hadTopik} aksara`,
    `Tajuk: maksimum ${titleTarget} aksara`,
    `Huraian ringkas: maksimum ${briefTarget} aksara`,
    `Huraian panjang: minimum ${MIN_BRIEF_LONG_CHARS}, maksimum ${ceiling.maxBriefLong} aksara`, '',
    `[Had usia sumber]: ${fc.aiPromptRecency || '-'}`,
    `[Bahasa sumber]: ${fc.aiPromptLanguage || '-'}`,
    `[Negara/Wilayah sumber]: ${fc.aiPromptRegion || '-'}`,
    `[Jumlah kandungan]: ${fc.generationLimit || 1}`,
    `[Mod janaan]: ${GEN_MODE_LABEL[fc.genMode] || fc.genMode || 'Bebas'}`, '',
    'Berikan output dalam format berikut sahaja, satu blok bagi setiap kandungan, dipisahkan dengan baris "____":',
    'Topik:', 'Tajuk:', 'Huraian ringkas:', 'Huraian panjang:', 'Sumber:', 'URL:', 'Tarikh sumber:',
  ];
  return lines.join('\n');
}

// Tajuk dan huraian KONGSI satu bajet ruang kad, bukan dua had berasingan — tajuk pendek
// membebaskan ruang untuk huraian lebih panjang, dan sebaliknya. Peraturan ni KEKAL dikuatkuasakan
// di peringkat simpan (validateContentBudget, ContentBudget.js) — meter ni beri amaran awal
// sebelum editor cuba simpan dan ditolak server.
// Export (2026-08-07, Audit UI/UX §F1) — TickerManagementModal.tsx guna komponen SAMA ni untuk
// meter bajet langsung per-blok, bukan salinan berasingan. Kekalkan formula/tone identik supaya
// dua tempat tak boleh terpesong sesama sendiri.
export function BudgetMeter({ slotIndex, ceiling, title, brief }: { slotIndex: number; ceiling: { maxTitle: number; maxBrief: number }; title: string; brief: string }) {
  const check = validateContentBudget(slotIndex, title || '', brief || '');
  const usedTitle = ceiling.maxTitle ? title.length / ceiling.maxTitle : 0;
  const usedBrief = ceiling.maxBrief ? brief.length / ceiling.maxBrief : 0;
  const used = usedTitle + usedBrief;
  // Math.floor (BUKAN Math.round) — round-KE-ATAS boleh papar "baki N aksara" yang sebenarnya
  // SATU aksara lebih daripada had sebenar (ditemui semasa ujian 2026-08-07 pada slider serupa di
  // buildAiPrompt), editor taip sampai angka yang dipaparkan lalu ditolak validateContentBudget
  // walaupun ikut meter ni betul-betul. floor jamin baki yang dipapar SENTIASA selamat ditaip penuh.
  const remainingBrief = ceiling.maxTitle ? Math.max(0, Math.floor((1 - title.length / ceiling.maxTitle) * ceiling.maxBrief)) : ceiling.maxBrief;
  const remainingTitle = ceiling.maxBrief ? Math.max(0, Math.floor((1 - brief.length / ceiling.maxBrief) * ceiling.maxTitle)) : ceiling.maxTitle;
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

function Field({ label, value, onChange, rows, placeholder, maxLen, minLen, hint, type }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; maxLen?: number; minLen?: number; hint?: string; type?: 'text' | 'date' }) {
  const over = typeof maxLen === 'number' && value.length > maxLen;
  const under = typeof minLen === 'number' && value.length > 0 && value.length < minLen;
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className={`${labelCls} flex items-baseline gap-1.5`}>
          {label}
          {hint && <span className="font-sans normal-case tracking-normal font-normal text-stone-400">{hint}</span>}
        </span>
        {typeof maxLen === 'number' && (
          <span className={`font-mono text-[9px] tabular-nums ${over || under ? 'text-[#a8241f]' : 'text-stone-400'}`}>
            {value.length}/{maxLen}{typeof minLen === 'number' && <> · min {minLen}</>}
          </span>
        )}
      </span>
      {under && <span className="font-sans text-[9px] text-[#a8241f] -mt-0.5">{minLen - value.length} aksara lagi diperlukan (minimum {minLen})</span>}
      {rows ? (
        <textarea
          rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="w-full resize-none border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm leading-relaxed text-stone-800 py-1.5 transition-colors"
        />
      ) : (
        <input
          type={type || 'text'} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="w-full border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
        />
      )}
    </label>
  );
}

// Jenis Sumber (Fasa 8b, 2026-08-05) — dropdown Teks/Audio/Video. Adjung Brief cuma ambil
// sumber daripada URL (laman web/audio/video dalam talian), tiada bahan bercetak fizikal — jadi
// "Teks" (nilai simpanan 'web', sepadan SourceDetector.js) meliputi laman web/artikel/PDF, bukan
// cuma laman web sempit. Dikesan automatik daripada URL/teks (core/editorial/SourceDetector.js)
// bila editor tak override — medan ni bagi editor pilihan tulis ganti bila auto-kesan tersasar.
const JENIS_SUMBER_PILIHAN: { value: string; label: string }[] = [
  { value: 'web', label: 'Teks' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
];

// Pilihan tetap (2026-08-07, permintaan Izzat) — sebelum ini medan teks bebas, editor kena
// taip sendiri setiap kali walaupun cuma segelintir nilai munasabah wujud.
const HAD_USIA_SUMBER_PILIHAN: { value: string; label: string }[] = [
  { value: '24 jam', label: '24 jam' },
  { value: '1 minggu', label: '1 minggu' },
  { value: '1 bulan', label: '1 bulan' },
  { value: '1 tahun', label: '1 tahun' },
];
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <select
        value={value || options[0].value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
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
        <Tooltip text={check.isValid ? 'Sedia untuk Terbit' : check.reason}>
          <span className={`group-hover:hidden font-mono text-[9px] ${check.isValid ? 'text-emerald-700' : 'text-[#a8241f]'}`}>
            {check.isValid ? '✓' : '✕'}
          </span>
        </Tooltip>
      </span>
    </li>
  );
});

export const SlotManagerModal: React.FC<SlotManagerModalProps> = ({
  editingSlotIndex, formConfig, setFormConfig, activeBidangList, currentEditoriumRole, currentEditoriumName, onClose, onSave,
  slotOptions, onSwitchSlot, initialUuid, saveError,
}) => {
  // Kandungan mana yang terbuka dahulu. Lalai yang pertama; bila dibuka daripada "Draf Saya"
  // (initialUuid), terus mendarat pada draf yang diklik. Sengaja dikira dalam initializer useState
  // (dijalankan SEKALI semasa mount, sama macam `items` di bawah) dan bukan useEffect selepas
  // render — kalau tidak, kandungan pertama sempat terpapar sekelip mata sebelum bertukar.
  const [active, setActive] = useState(() => {
    if (!initialUuid) return 0;
    const i = parseManualSummaryBlocks(formConfig.manualSummary || '').findIndex((b: any) => b.uuid === initialUuid);
    return i >= 0 ? i : 0;
  });
  const [tab, setTab] = useState<'borang' | 'maklumat' | 'ai' | 'sejarah'>('borang');
  const [pasteNote, setPasteNote] = useState('');
  const [aiNote, setAiNote] = useState('');
  const [imageNote, setImageNote] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Editor(s) DITUGASKAN kepada slot ni (2026-08-01, permintaan pemilik projek) — maklumat
  // PERINGKAT SLOT (ditetapkan di Senarai Slot), berasingan daripada `editorName`/Penulis blok
  // (siapa MENULIS satu kandungan). Satu slot boleh ada lebih seorang editor, jadi ini senarai,
  // bukan satu nama. Dimuatkan sekali sahaja bila slot dibuka (key={editingSlotIndex} di
  // EditoriumView memaksa remount setiap tukar slot, sama corak macam `items` di atas).
  const [editorSlot, setEditorSlot] = useState<{ nama: string }[] | null>(null);
  useEffect(() => {
    let batal = false;
    fetch('/api/system/slot-editors')
      .then((res) => res.json())
      .then((rows) => {
        if (batal || !Array.isArray(rows)) return;
        setEditorSlot(rows.filter((r: any) => r.slotIndex === editingSlotIndex));
      })
      .catch(() => { if (!batal) setEditorSlot([]); });
    return () => { batal = true; };
  }, [editingSlotIndex]);

  // Susun atur telefon (2026-08-05, permintaan Izzat — "modal urus slot utk versi telefon
  // bermasalah sangat") — grid tetap `minmax(240px, 32%) 1fr` di bawah paksa jalur Draf
  // sekurang-kurangnya 240px lebar walaupun modal sendiri cuma ~360-420px di telefon, tinggalkan
  // borang utama dikelar sangat sempit (~120-180px) — punca skrin tangkap Izzat tunjuk (borang
  // terpotong, perlu tatal mendatar). Struktur DUA-LAJUR SEBELAH-MENYEBELAH (Draf | Borang)
  // ditukar jadi SATU LAJUR bertindan (Draf jalur nipis atas, Borang penuh bawah) di telefon.
  const isPhone = usePhoneViewport();
  // Senarai Draf di telefon lalai TERTUTUP (2026-08-04, permintaan pemilik projek) — dengan
  // banyak draf (cth 100+) jalur senarai terbuka automatik akan makan ruang skrin telefon
  // yang terhad; dibuka bila diklik sahaja.
  const [drafTerbukaPhone, setDrafTerbukaPhone] = useState(false);
  const tier = tierForSlot(editingSlotIndex) || 'STANDARD';
  const ceiling = ceilingForSlot(editingSlotIndex);
  const desk = formConfig.manualDesk || '';
  const bidang = activeBidangList.find((b) => b.name.toLowerCase() === desk.toLowerCase());
  const accent = bidang?.color || '#802334';
  const hadTopik = topikCeilingForSlot(editingSlotIndex);

  // Slider bajet Tajuk/Huraian ringkas untuk prompt AI (2026-08-07, pepijat kritikal Izzat) —
  // editor laraskan SATU nilai (Tajuk), Huraian ringkas dikira automatik ikut formula bajet kongsi
  // sedia ada (sama formula BudgetMeter di atas: brief = (1 - title/maxTitle) * maxBrief), supaya
  // pasangan yang dihantar ke AI SENTIASA sah, tak pernah minta dua had solo yang mustahil dicapai
  // serentak. Sengaja state SESI modal ini sahaja (tak disimpan ke slots_config) — nilai selamat
  // lalai (separuh-separuh) setiap kali modal dibuka semula.
  const [aiTitleTarget, setAiTitleTarget] = useState<number | null>(null);
  const titleTarget = Math.min(ceiling.maxTitle, aiTitleTarget ?? Math.floor(ceiling.maxTitle / 2));
  // Math.floor (BUKAN Math.round) — dibuktikan perlu semasa ujian sebenar 2026-08-07: slider
  // pernah tunjuk 43/61 (Tajuk/Huraian) untuk HERO (maxTitle 52, maxBrief 350) sebagai "sentiasa
  // sah", tapi round-KE-ATAS 60.58 jadi 61 menolak titik sut sebenar (43/52 + 61/350 = 1.0012 >
  // 1) — validateContentBudget tolak PATCH ujian sebenar walaupun ikut slider betul-betul. floor
  // sentiasa bulat ke BAWAH, jamin jumlah nisbah <= 1 tanpa pengecualian.
  const briefTarget = ceiling.maxBrief > 0 ? Math.max(0, Math.floor((1 - titleTarget / ceiling.maxTitle) * ceiling.maxBrief)) : 0;

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
    title: '', brief: '', briefLong: '', topik: '', source: '', url: '', sources: [], sourceType: '', date: '', note: '', image: '',
    // Alur kerja Draf/Terbit (2026-07-29, permintaan pemilik projek) — lalai DRAF untuk
    // kandungan BAHARU: tak sesekali live sehingga editor sedar-sedar tekan "Terbit". Kandungan
    // sedia ada yang dihurai daripada manualSummary (lihat parseManualSummaryBlocks) bawa status
    // sebenar tersimpan (lalai 'approved' kalau tiada baris Status: — blok lama sebelum ciri ni
    // wujud, memang live).
    status: 'draft',
    // Penulis (2026-08-01, permintaan pemilik projek — modul "Draf Saya"): dicap SEKALI semasa
    // blok dicipta, bukan pada setiap simpan — draf kekal milik orang yang memulakannya walaupun
    // editor lain dalam slot yang sama menyuntingnya kemudian. Kosong bila tiada sesi log masuk
    // (JANGAN cap EDITOR_PLACEHOLDER "—" di sini; itu simbol paparan, bukan nama orang).
    penulis: currentEditoriumName || '',
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
  // Penjaga dirty (2026-08-02, Fasa 6) — sebelum ni tutup modal (X) buang draf ditaip tanpa
  // sebarang amaran; hanya laluan "tukar slot" (handleSwitchSlot di bawah) yang disemak. Definisi
  // sama macam di sana: ada tajuk/huraian sebenar ditaip (bukan cuma baris kosong "+ Masukkan"
  // belum disentuh) di MANA-MANA kandungan dalam giliran.
  //
  // Skop diperluas (2026-08-07, Audit UI/UX §B5) — sebelum ni HANYA title/brief disemak, jadi
  // menyunting briefLong/topik/source/url/imej langsung TIDAK mencetuskan amaran tutup langsung
  // (kerja hilang senyap). Semak SEMUA medan boleh sunting dalam `blankItem()` di atas, bukan dua
  // sahaja.
  const itemHasContent = (it: any) => (
    (it.title || '').trim() || (it.brief || '').trim() || (it.briefLong || '').trim() ||
    (it.topik || '').trim() || (it.source || '').trim() || (it.url || '').trim() ||
    (it.image || '').trim() ||
    (Array.isArray(it.sources) && it.sources.some((s: any) => (s?.name || '').trim() || (s?.url || '').trim()))
  );
  const hasUnsavedWork = items.some(itemHasContent);

  const commit = (mutator: (prevItems: any[]) => any[]) => setItems((prev) => mutator(prev));
  const patch = (i: number, key: string, value: string) => commit((prevItems) => (
    // Sama pertahanan macam initializer di atas — kalau entah bagaimana items jadi kosong (cth.
    // remove() buang kandungan terakhir), patch() masih WAJIB ada sesuatu untuk disunting, bukan
    // no-op senyap.
    prevItems.length > 0
      ? prevItems.map((it, n) => (n === i ? { ...it, [key]: value } : it))
      : [{ ...blankItem(), [key]: value }]
  ));

  // Sumber berbilang (2026-08-05, permintaan Izzat) — `it.sources` senarai {name,url}[]. `source`/
  // `url` tunggal legasi diselaraskan SEKALI di sini (entri pertama) supaya kad/pautan lama yang
  // masih baca medan tunggal terus betul tanpa perlu ubah kod lain — satu tempat sahaja.
  const selarasSumberLegasi = (it: any) => ({
    ...it,
    source: (it.sources && it.sources[0]?.name) || '',
    url: (it.sources && it.sources[0]?.url) || '',
  });
  const patchSumber = (i: number, sIdx: number, field: 'name' | 'url', value: string) => commit((prevItems) => (
    prevItems.map((it, n) => {
      if (n !== i) return it;
      const sources = (it.sources && it.sources.length > 0) ? [...it.sources] : [{ name: it.source || '', url: it.url || '' }];
      sources[sIdx] = { ...sources[sIdx], [field]: value };
      return selarasSumberLegasi({ ...it, sources });
    })
  ));
  const tambahSumber = (i: number) => commit((prevItems) => (
    prevItems.map((it, n) => {
      if (n !== i) return it;
      const sources = (it.sources && it.sources.length > 0) ? [...it.sources] : [{ name: it.source || '', url: it.url || '' }];
      sources.push({ name: '', url: '' });
      return selarasSumberLegasi({ ...it, sources });
    })
  ));
  const buangSumber = (i: number, sIdx: number) => commit((prevItems) => (
    prevItems.map((it, n) => {
      if (n !== i) return it;
      const sources = (it.sources && it.sources.length > 0) ? [...it.sources] : [{ name: it.source || '', url: it.url || '' }];
      const next = sources.filter((_: any, idx: number) => idx !== sIdx);
      return selarasSumberLegasi({ ...it, sources: next.length > 0 ? next : [{ name: '', url: '' }] });
    })
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
          source: b.source, url: b.url, sources: b.sources, sourceType: b.sourceType, date: b.date, note: b.note, image: b.image,
          // Blok yang ditampal biasanya datang daripada AI luaran (tiada baris Penulis:) — yang
          // menampal itulah penulisnya. Kalau teks yang ditampal MEMANG sudah membawa nama
          // (cth. draf disalin daripada slot lain), nama asal itu dikekalkan.
          penulis: b.penulis || currentEditoriumName || '',
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
      await navigator.clipboard.writeText(buildAiPrompt(formConfig, ceiling, hadTopik, titleTarget, briefTarget));
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
      setTimeout(() => setPublishError(''), 8000);
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
    } else {
      setPublishError(saveError || labelUi('toast.gagal_terbit'));
      setTimeout(() => setPublishError(''), 5000);
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
    if (ok) {
      setFormConfig((prev: any) => ({ ...prev, manualSummary }));
      setDraftNote(labelUi('toast.draf_disimpan'));
      setTimeout(() => setDraftNote(''), 2400);
    } else {
      setPublishError(saveError || labelUi('toast.gagal_simpan_draf'));
      setTimeout(() => setPublishError(''), 5000);
    }
  };

  // Sejarah versi sebenar (Fasa 6, 2026-08-02) — item DRAF (status 'draft', belum tekan Terbit)
  // tiada baris editorial_objects langsung, jadi tiada sejarah untuk dipapar. Item yang sudah
  // punya rekod sebenar (bukan draf — 'pending'/'approved'/'rejected'/'archived') pasti wujud di
  // editorial_objects dengan id = current.uuid (Bar tier kekal dalam giliran ni selepas Terbit;
  // tier lain hilang daripada `items` selepas publishOne, jadi status draf ialah isyarat betul,
  // bukan sekadar ada/tiada uuid — SETIAP item, draf atau tidak, sudah ada uuid tempatan).
  const [revisions, setRevisions] = useState<any[] | null>(null);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState('');
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const isPublished = current.status && current.status !== 'draft';
  const fetchRevisions = useCallback(() => {
    if (!isPublished || !current.uuid) { setRevisions(null); return; }
    setRevisionsLoading(true);
    setRevisionsError('');
    fetch(`/api/system/content/${encodeURIComponent(current.uuid)}/revisions`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) { setRevisionsError(data?.error || labelUi('toast.gagal_muat_sejarah')); setRevisions([]); return; }
        setRevisions(Array.isArray(data) ? data : []);
      })
      .catch(() => setRevisionsError(labelUi('toast.gagal_muat_sejarah')))
      .finally(() => setRevisionsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.uuid, isPublished]);
  useEffect(() => {
    if (tab === 'sejarah') fetchRevisions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, current.uuid]);
  const restoreVersion = async (revisionId: number) => {
    if (!current.uuid) return;
    setRestoringId(revisionId);
    setRevisionsError('');
    try {
      const res = await fetch(`/api/system/content/${encodeURIComponent(current.uuid)}/revisions/${revisionId}/restore`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setRevisionsError(data?.error || 'Gagal memulihkan versi.');
        return;
      }
      // Kandungan sebenar (server-side) sudah berubah — cerminkan segera pada borang tempatan
      // (tajuk/huraian) supaya editor nampak kesan pulihan tanpa perlu tutup-buka modal, walaupun
      // simpanan penuh giliran (Terbit/Simpan draf) masih perlu dilakukan berasingan kalau nak
      // ubah suai lanjut selepas pulih.
      const restored = (revisions || []).find((r) => r.id === revisionId);
      if (restored) {
        commit((prevItems) => prevItems.map((it, n) => (
          n === activeIndex ? { ...it, title: restored.title, brief: restored.summary } : it
        )));
      }
      fetchRevisions();
    } catch {
      setRevisionsError('Gagal memulihkan versi.');
    } finally {
      setRestoringId(null);
    }
  };

  // Tukar slot terus dari sini (2026-07-29) — modal ni REMOUNT penuh bila editingSlotIndex ibu
  // bapa berubah (key={editingSlotIndex} di pemanggil), jadi `items` tempatan hilang tak
  // disimpan. Amaran dulu kalau ada apa-apa benar-benar ditaip (bukan cuma baris kosong "+
  // Masukkan" belum disentuh), sama falsafah macam amaran padam kandungan di atas.
  const handleSwitchSlot = (idx: number) => {
    if (idx === editingSlotIndex) return;
    if (hasUnsavedWork && !window.confirm('Tukar slot akan buang draf belum diterbitkan/disimpan dalam slot ni. Teruskan?')) return;
    onSwitchSlot?.(idx);
  };

  // Amaran tutup modal (2026-08-02, Fasa 6, "Auto-simpan / penjaga dirty") — sama falsafah macam
  // handleSwitchSlot di atas, tapi untuk butang X (satu-satunya laluan tutup modal ni). Auto-
  // simpan sebenar (draf tersimpan tanpa tindakan editor) DIBUANG daripada skop: kandungan
  // editorial ialah tulisan sebenar (lihat CLAUDE.md), draf separuh siap yang tersimpan senyap
  // ke DB tanpa editor sedar lebih berbahaya daripada amaran ringkas ni.
  const handleClose = () => {
    if (hasUnsavedWork && !window.confirm('Tutup borang ni akan buang draf belum diterbitkan/disimpan dalam slot ni. Teruskan?')) return;
    onClose();
  };

  // Amaran tutup TAB/muat semula pelayar (2026-08-02) — hasUnsavedWork tak boleh dibaca terus
  // dalam handler beforeunload (closure lapuk), jadi bergantung pada ref yang sentiasa disegarkan.
  const hasUnsavedWorkRef = useRef(hasUnsavedWork);
  hasUnsavedWorkRef.current = hasUnsavedWork;
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedWorkRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Perangkap fokus + Escape + pulangkan fokus (2026-08-07) — modal ni TERBESAR dalam aplikasi
  // tetapi satu-satunya yang terlepas semasa cangkuk `useModalFokus` diperkenalkan (Audit UI/UX
  // §G1/G2 melengkapkan 15 tapak panggilan lain). Kesannya nyata: Tab boleh keluar terus ke
  // frontpage di belakang, jadi pengguna papan kekunci menaip ke medan yang tidak kelihatan.
  // Sengaja TIDAK dimigrasikan ke <EditorDialog> — modal ni ada susun atur tersendiri (tinggi
  // tetap `h-[min(88vh,720px)]`, kepala/kaki flex-none dengan badan menatal, lebar 1080px yang
  // lebih besar daripada mana-mana saiz EditorDialog). Memaksanya masuk akan menjadi reka
  // bentuk semula, bukan penyatuan.
  const refModal = useRef<HTMLDivElement>(null);
  useModalFokus(refModal, onClose);

  // Gerbang klik-backdrop-untuk-tutup (2026-08-07, sama pepijat/pembetulan macam LoginModal.tsx)
  // — tanpa gerbang mousedown+click ni, menyeret untuk memilih teks dalam modal dan melepaskan
  // tetikus di luar (di atas backdrop) akan tersalah tutup modal, buang draf belum disimpan.
  // Modal ni sebelum ni TIADA klik-backdrop langsung (tak boleh ditutup klik luar pun) — tambah
  // sekali dengan gerbang supaya konsisten dengan corak modal lain, bukan tanpa gerbang.
  const mousedownPadaBackdrop = React.useRef(false);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-md"
      onMouseDown={(e) => { mousedownPadaBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && mousedownPadaBackdrop.current) handleClose(); }}
    >
      <div
        ref={refModal}
        role="dialog"
        aria-modal="true"
        aria-label={`Urus Slot ${editingSlotIndex + 1}`}
        className="bg-white rounded-lg border border-stone-200 shadow-2xl w-full max-w-[1080px] h-[min(88vh,720px)] max-h-full flex flex-col overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >

        <header className="flex-none px-4 md:px-8 pt-5 pb-3.5">
          {/* Telefon: tindan menegak (tajuk atas, kawalan slot+tutup bawah) — bukan sebelah-
              menyebelah `justify-between` desktop, yang paksa "Urus Slot 3" mengecut ke lajur
              sempit (~100px) bila dropdown slot (teks panjang cth "Slot 3 — Teknologi Digital")
              ambil baki ruang, punca "Urus / Slot / 3" patah 3 baris dalam skrin tangkap Izzat. */}
          {isPhone ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-serif text-xl font-medium tracking-tight text-stone-900">
                  Urus Slot <span className="font-mono text-lg" style={{ color: accent }}>{editingSlotIndex + 1}</span>
                </h2>
                <button type="button" aria-label="Tutup" onClick={handleClose} className="text-stone-400 hover:text-stone-600 cursor-pointer shrink-0 mt-1">
                  <X size={20} />
                </button>
              </div>
              <p className="flex items-center gap-2.5 flex-wrap">
                {bidang && <BidangIcon iconName={bidang.icon} iconSvg={bidang.iconSvg} color={accent} variant="bare" size={13} title={desk} />}
                <span className="font-sans text-[10px] uppercase tracking-[0.15em] font-extrabold" style={{ color: accent }}>{desk || '— Belum ditetapkan —'}</span>
                <span className="text-stone-300">·</span>
                <span className="font-sans text-[11px] text-stone-500">{TIER_LABELS[tier] || tier}</span>
              </p>
              {/* Tukar slot — lebar penuh di telefon (bukan sebelah butang Tutup, ruang tak cukup
                  untuk teks pilihan panjang cth "Slot 3 — Teknologi Digital"). */}
              {slotOptions && slotOptions.length > 0 && (
                <select
                  value={editingSlotIndex}
                  onChange={(e) => handleSwitchSlot(parseInt(e.target.value, 10))}
                  className="w-full border border-stone-300 rounded px-2.5 py-2 font-sans text-xs font-semibold text-stone-600 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#802334]"
                >
                  {slotOptions.map((opt) => (
                    <option key={opt.index} value={opt.index}>{opt.label}</option>
                  ))}
                </select>
              )}
            </div>
          ) : (
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
                <button type="button" aria-label="Tutup" onClick={handleClose} className="text-stone-400 hover:text-stone-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>
            </div>
          )}
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

        {/* Draf | Borang: DUA LAJUR sebelah-menyebelah di desktop (grid `minmax(240px, 32%) 1fr`),
            tapi lantai 240px tu paksa jalur Draf ambil LEBIH SEPARUH lebar modal telefon (~360-
            420px total), tinggalkan Borang dikelar ~120-180px — punca sebenar skrin tangkap Izzat
            (borang terpotong, kena tatal mendatar). Telefon: SATU LAJUR bertindan (Draf jalur
            nipis mendatar atas, tinggi terhad+boleh tatal, Borang penuh lebar bawah). */}
        <div className={isPhone ? 'flex-1 min-h-0 flex flex-col' : 'flex-1 min-h-0 grid'} style={isPhone ? undefined : { gridTemplateColumns: 'minmax(240px, 32%) 1fr' }}>

          <section className={isPhone ? 'flex-none flex flex-col border-b border-stone-150' + (drafTerbukaPhone ? ' max-h-[30vh]' : '') : 'min-h-0 flex flex-col border-r border-stone-150'}>
            {isPhone ? (
              <button
                type="button"
                onClick={() => setDrafTerbukaPhone((v) => !v)}
                className="flex-none flex items-baseline justify-between px-3 pt-3 pb-2 w-full cursor-pointer"
              >
                <span className={labelCls}>Draf</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-stone-400">{items.length}</span>
                  <span className="font-mono text-[10px] text-stone-400">{drafTerbukaPhone ? '▲' : '▼'}</span>
                </span>
              </button>
            ) : (
              <div className="flex-none flex items-baseline justify-between px-3 pt-3 pb-2">
                <span className={labelCls}>Draf</span>
                <span className="font-mono text-[10px] text-stone-400">{items.length}</span>
              </div>
            )}
            {/* Modal ni RUANG DRAF PERIBADI SAHAJA (2026-07-29, permintaan pemilik projek) —
                senarai FLAT, satu kumpulan "Draf" sahaja. Tiada lagi kumpulan "Akan Diterbitkan":
                Terbit (butang publishOne di atas) ialah AKSI SEGERA, bukan status yang ditogol —
                sebaik sahaja ditekan & berjaya, kandungan terus KELUAR daripada senarai ni (jadi
                rekod Indeks rasmi berstatus Pending), tiada keadaan pertengahan kelihatan di sini. */}
            {(!isPhone || drafTerbukaPhone) && (
              <div className={isPhone ? 'min-h-0 overflow-y-auto border-t border-stone-150' : 'flex-1 min-h-0 overflow-y-auto border-t border-stone-150'}>
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
            )}
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
                {/* Editor DITUGASKAN kepada slot (2026-08-01) — bukan lagi orang yang sedang log
                    masuk. Ditetapkan di Editorium → Slot → Senarai Slot, bukan di sini (lihat nota
                    warna di bawah). Kosong = belum ditugaskan sesiapa. */}
                <ReadOnlyField
                  label="Editor"
                  value={
                    editorSlot === null
                      ? 'Memuatkan…'
                      : editorSlot.length > 0
                        ? editorSlot.map((e) => e.nama).join(', ')
                        : 'Belum ditugaskan'
                  }
                />
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
            {/* Papar mesej ruang kosong bila senarai Draf kosong (2026-08-05, jumpa semasa
                simulasi editor) — sebelum ni borang "Kandungan 01" kosong tetap kekal papar
                lepas draf terakhir berjaya Terbit (DRAF jadi 0), buat editor keliru ingatkan
                masih ada kerja belum simpan padahal tiada. `current` guna blankItem() sebagai
                fallback (lihat atas), jadi tanpa semakan ni borang nampak "aktif" walhal palsu. */}
            {tab === 'borang' && items.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="font-sans text-sm text-stone-500">Tiada draf lagi dalam slot ini.</span>
                <button type="button" onClick={insert} className="font-sans text-[11px] font-semibold text-[#802334] hover:underline cursor-pointer">+ Tambah Kandungan Baharu</button>
              </div>
            )}
            {tab === 'borang' && items.length > 0 && (
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
                <Field label="Tajuk" value={current.title || ''} placeholder="Tajuk kandungan…" maxLen={ceiling.maxTitle} onChange={(v) => patch(activeIndex, 'title', v)} />
                {ceiling.maxBrief > 0 && (
                  <>
                    <Field label="Huraian ringkas" rows={4} value={current.brief || ''} placeholder="Huraian ringkas, dipapar pada kad…" onChange={(v) => patch(activeIndex, 'brief', v)} />
                    <Field label="Huraian panjang" rows={5} value={current.briefLong || ''} placeholder="Huraian panjang, untuk paparan menatal penuh — hanya di Focus View…" maxLen={ceiling.maxBriefLong} minLen={MIN_BRIEF_LONG_CHARS} onChange={(v) => patch(activeIndex, 'briefLong', v)} />
                  </>
                )}

                <hr className="border-stone-150" />
                {/* Sumber berbilang (2026-08-05, permintaan Izzat) — editor boleh tambah lebih
                    daripada satu sumber untuk SATU kandungan (cth digubah drpd pelbagai bahan).
                    Kad terhad ruang: label kad papar "Editorial Adjung" secara automatik bila
                    >1 sumber (lihat FrontpageView.tsx), bukan senarai penuh. Focus View (ruang
                    lebih) senaraikan SEMUA. */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between">
                    <span className={labelCls}>Sumber {(current.sources && current.sources.length > 1) && <span className="font-sans normal-case tracking-normal font-normal text-stone-400">— kad papar "Editorial Adjung" (&gt;1 sumber)</span>}</span>
                    <button type="button" onClick={() => tambahSumber(activeIndex)} className="text-[11px] font-sans font-semibold text-[#802334] hover:underline cursor-pointer">+ Tambah sumber</button>
                  </div>
                  {((current.sources && current.sources.length > 0) ? current.sources : [{ name: current.source || '', url: current.url || '' }]).map((s: any, sIdx: number) => (
                    <div key={sIdx} className="grid grid-cols-2 gap-3 items-end">
                      <label className="flex flex-col gap-1">
                        {sIdx === 0 && <span className={labelCls}>Nama sumber</span>}
                        <input
                          type="text" value={s.name || ''} placeholder="Adjung Editorial" maxLength={60}
                          onChange={(e) => patchSumber(activeIndex, sIdx, 'name', e.target.value)}
                          className="w-full border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
                        />
                      </label>
                      <span className="flex items-end gap-2">
                        <label className="flex-1 flex flex-col gap-1">
                          {sIdx === 0 && <span className={labelCls}>URL</span>}
                          <input
                            type="text" value={s.url || ''} placeholder="https://…"
                            onChange={(e) => patchSumber(activeIndex, sIdx, 'url', e.target.value)}
                            className="w-full border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
                          />
                        </label>
                        {(current.sources && current.sources.length > 1) && (
                          <button type="button" onClick={() => buangSumber(activeIndex, sIdx)} aria-label="Buang sumber ini" className="text-stone-400 hover:text-[#a8241f] cursor-pointer pb-1.5">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <SelectField label="Jenis sumber" value={current.sourceType || ''} options={JENIS_SUMBER_PILIHAN} onChange={(v) => patch(activeIndex, 'sourceType', v)} />
                  <Field label="Tarikh sumber" type="date" value={current.date || ''} onChange={(v) => patch(activeIndex, 'date', v)} />
                  <ImageField label="Imej" value={current.image || ''} note={imageNote} uploading={uploadingImage} onChange={(v) => patch(activeIndex, 'image', v)} onUploadFile={(f) => uploadImage(activeIndex, f)} />
                </div>
                <Field label="Nota" rows={2} value={current.note || ''} placeholder="Nota editor (pilihan) — hanya di Focus View…" maxLen={280} onChange={(v) => patch(activeIndex, 'note', v)} />
                {/* Penulis KANDUNGAN INI (2026-08-01, permintaan pemilik projek) — bukan lagi
                    sesiapa yang kebetulan sedang log masuk. Satu slot boleh dikendalikan lebih
                    seorang editor, jadi memapar nama pembuka borang di sini menipu: ia nampak
                    macam pengesahan siapa menulis kandungan tu. Blok lama (sebelum cap nama
                    wujud) papar "—", bukan nama diandaikan. */}
                <ReadOnlyField label="Penulis" value={current.penulis || EDITOR_PLACEHOLDER} />

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
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <ReadOnlyField label="a. Topik" value={String(hadTopik)} />
                    <ReadOnlyField label="d. Huraian panjang" value={ceiling.maxBrief > 0 ? String(ceiling.maxBriefLong) : 'Tiada'} />
                  </div>
                  {/* Slider bajet Tajuk/Huraian ringkas (2026-08-07, pepijat kritikal Izzat) —
                      GANTIKAN dua had solo (b/c) yang sebelum ni dipapar bersebelahan seolah-olah
                      boleh dicapai PENUH serentak (mustahil, kongsi satu bajet — lihat nota
                      buildAiPrompt di atas fail ni). Laraskan Tajuk, Huraian ringkas bergerak
                      automatik ikut nisbah — pasangan yang dihantar ke AI SENTIASA sah. */}
                  <div className="mt-3">
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <span className={labelCls}>b+c. Tajuk / Huraian ringkas <span className="font-sans normal-case tracking-normal text-stone-400">— satu bajet kongsi</span></span>
                    </div>
                    <input
                      type="range" min={0} max={ceiling.maxTitle} value={titleTarget}
                      onChange={(e) => setAiTitleTarget(Number(e.target.value))}
                      className="w-full cursor-pointer accent-[#802334]"
                    />
                    <div className="flex items-center justify-between font-mono text-[10px] tabular-nums text-stone-500">
                      <span>Tajuk maksimum <strong className="text-stone-800">{titleTarget}</strong></span>
                      <span>Huraian ringkas maksimum <strong className="text-stone-800">{briefTarget}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className={labelCls}>Arahan am (Sistem/Global) <span className="font-sans normal-case tracking-normal text-stone-400">· auto</span></span>
                  <div className="font-serif text-[13px] leading-relaxed text-stone-500 bg-stone-50 rounded p-3">
                    {formConfig.masterPrompt || <span className="text-stone-400">Tiada arahan ditetapkan</span>}
                  </div>
                  <span className="font-sans text-[9px] text-stone-400">Ditetapkan oleh Ketua Editor di Editorium · auto</span>
                </div>

                <Field
                  label="Arahan khas (slot ini)" rows={3}
                  value={formConfig.promptText || ''}
                  placeholder="Cth. Fokus kepada pandangan pakar tempatan, elak sumber pendapat semata-mata…"
                  onChange={(v) => setFormConfig((prev: any) => ({ ...prev, promptText: v }))}
                  hint="disimpan bersama slot ini"
                />

                <div className="grid grid-cols-2 gap-5">
                  <SelectField label="Had usia sumber" value={formConfig.aiPromptRecency || ''} options={HAD_USIA_SUMBER_PILIHAN} onChange={(v) => setFormConfig((prev: any) => ({ ...prev, aiPromptRecency: v }))} />
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

            {/* d. SEJARAH VERSI — Fasa 6 (2026-08-02). Sejarah sebenar (baris editorial_revisions
                berkekalan), bukan andaian daripada teks draf tempatan — cuma wujud untuk kandungan
                yang sudah punya rekod sebenar (bukan draf). */}
            {tab === 'sejarah' && (
              <>
                {!isPublished && (
                  <span className="font-sans text-[12px] text-stone-500">
                    Kandungan ini belum diterbitkan — tiada sejarah versi lagi.
                  </span>
                )}
                {isPublished && revisionsLoading && (
                  <span className="font-sans text-[12px] text-stone-500">Memuatkan sejarah versi…</span>
                )}
                {isPublished && !revisionsLoading && revisionsError && (
                  <span className="font-sans text-[12px] text-[#a8241f]">{revisionsError}</span>
                )}
                {isPublished && !revisionsLoading && !revisionsError && revisions && revisions.length === 0 && (
                  <span className="font-sans text-[12px] text-stone-500">Tiada sejarah versi direkodkan.</span>
                )}
                {isPublished && !revisionsLoading && revisions && revisions.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    {revisions.map((r, i) => {
                      const isTerkini = i === 0;
                      return (
                        <div key={r.id} className="flex items-start justify-between gap-4 border border-stone-200 rounded p-3">
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="flex items-center gap-2">
                              <span className={labelCls}>Versi {r.version}</span>
                              {isTerkini && (
                                <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-emerald-700">· Semasa</span>
                              )}
                              <span className="font-sans text-[10px] text-stone-400">{new Date(r.updatedAt || r.createdAt).toLocaleString('ms-MY')}</span>
                            </span>
                            <span className="font-serif text-[13px] text-stone-800 truncate">{r.title || <span className="text-stone-400">(tiada tajuk)</span>}</span>
                            <span className="font-sans text-[11px] text-stone-500 truncate">{r.summary || ''}</span>
                            <span className="font-mono text-[9px] text-stone-400">{r.createdBy || '—'} · {r.status}</span>
                          </div>
                          {!isTerkini && (
                            <button
                              type="button" onClick={() => restoreVersion(r.id)} disabled={restoringId !== null}
                              className="shrink-0 px-3 py-1.5 border border-stone-300 rounded text-[11px] font-sans font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-wait cursor-pointer transition-colors"
                            >
                              {restoringId === r.id ? 'Memulihkan…' : 'Pulih versi ini'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
