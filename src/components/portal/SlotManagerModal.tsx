import React, { useCallback, useState } from 'react';
import { X, ChevronUp, ChevronDown, Trash2, Lock } from 'lucide-react';
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
  isSavingSlot: boolean;
  onClose: () => void;
  // manualSummaryOverride: items (giliran kandungan) hidup sebagai state TEMPATAN modal ni (lihat
  // nota di useState items di bawah), bukan diterbitkan semula daripada formConfig.manualSummary
  // pada setiap keystroke. handleSubmit hantar serialize(items) TERUS sebagai argumen kedua di
  // sini — `onSave` ialah closure yang sudah tetap sejak render SEBELUM ia dipanggil, jadi ia
  // tetap membaca formConfig LAMA dari parent walau apa pun setFormConfig() buat pada render akan
  // datang. Hantar terus sebagai argumen elak kebergantungan pada timing React state sama sekali.
  onSave: (e: React.FormEvent, manualSummaryOverride?: string) => void;
}

const TAB_LABEL: Record<string, string> = { borang: 'Borang kandungan', maklumat: 'Maklumat slot', ai: 'Arahan AI' };
const GEN_MODE_LABEL: Record<string, string> = { bebas: 'Bebas', dengan_rujukan: 'Dengan rujukan' };

const labelCls = 'font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500';

// "Editor" (Maklumat slot dan Borang kandungan) belum ada sumber data sebenar — tiada sistem
// log masuk/pengguna berautentik lagi (KIV pra-MVP, lihat CLAUDE.md). Papar placeholder yang
// jujur ("—") dan bukan nama palsu, sehingga saluran data sebenar wujud.
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

function Field({ label, value, onChange, rows, placeholder, maxLen }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; maxLen?: number }) {
  const over = typeof maxLen === 'number' && value.length > maxLen;
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className={labelCls}>{label}</span>
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
        <span className={`group-hover:hidden font-mono text-[9px] ${check.isValid ? 'text-emerald-700' : 'text-[#a8241f]'}`} title={check.isValid ? undefined : check.reason}>
          {check.isValid ? '✓' : '✕'}
        </span>
      </span>
    </li>
  );
});

export const SlotManagerModal: React.FC<SlotManagerModalProps> = ({
  editingSlotIndex, formConfig, setFormConfig, activeBidangList, currentEditoriumRole, isSavingSlot, onClose, onSave,
}) => {
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<'borang' | 'maklumat' | 'ai'>('borang');
  const [pasteNote, setPasteNote] = useState('');
  const [aiNote, setAiNote] = useState('');

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
    if (!window.confirm('Padam kandungan ini daripada giliran? Tindakan ini tidak boleh dibuat asal selepas Simpan Slot.')) return;
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

  const passing = items.filter((it) => itemFits(editingSlotIndex, desk, it).isValid).length;

  // items (state tempatan) ialah sumber kebenaran semasa borang dibuka. Hantar serialize(items)
  // TERUS sebagai argumen kedua kepada onSave (lihat nota manualSummaryOverride di
  // SlotManagerModalProps untuk kenapa BUKAN sekadar setFormConfig()). setFormConfig() di bawah
  // kekal untuk pengguna formConfig.manualSummary LAIN yang mungkin baca nilai terkini.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const manualSummary = serializeManualBentoQueue(items);
    setFormConfig((prev: any) => ({ ...prev, manualSummary }));
    onSave(e, manualSummary);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-md">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-stone-200 shadow-2xl w-full max-w-[1080px] h-[min(88vh,720px)] max-h-full flex flex-col overflow-hidden animate-fade-in">

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
            <button type="button" aria-label="Tutup" onClick={onClose} className="text-stone-400 hover:text-stone-600 cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </header>
        <hr className="border-stone-150" />

        <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: 'minmax(240px, 32%) 1fr' }}>

          <section className="min-h-0 flex flex-col border-r border-stone-150">
            <div className="flex-none flex items-baseline justify-between px-3 pt-3 pb-2">
              <span className={labelCls}>Giliran carousel</span>
              <span className={`font-mono text-[10px] ${passing === items.length ? 'text-emerald-700' : 'text-amber-700'}`}>{passing}/{items.length} lulus</span>
            </div>
            <ol className="flex-1 min-h-0 overflow-y-auto list-none m-0 p-0 border-t border-stone-150">
              {items.map((it, i) => (
                <SidebarItem
                  key={it.uuid || i}
                  item={it} index={i} isActive={i === activeIndex}
                  slotIndex={editingSlotIndex} desk={desk}
                  onSelect={setActive} onMoveUp={moveUp} onMoveDown={moveDown} onRemove={remove}
                />
              ))}
            </ol>
            <div className="flex-none border-t border-stone-150 p-2">
              <button type="button" onClick={insert} className="w-full text-center py-1.5 rounded font-sans text-[11px] font-semibold text-stone-600 hover:text-[#802334] hover:bg-[#802334]/[0.08] transition-colors cursor-pointer">
                + Masukkan
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
                <ReadOnlyField label="Editor" value={EDITOR_PLACEHOLDER} />
                <ReadOnlyField label="Bilangan kandungan" value={String(items.length)} />
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
                    <button type="button" onClick={paste} className="px-2.5 py-1 border border-stone-300 rounded text-[11px] font-sans font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer">Tampal</button>
                    <button type="button" onClick={insert} className="px-2.5 py-1 rounded text-[11px] font-sans font-semibold text-stone-500 hover:text-[#802334] cursor-pointer">Masukkan</button>
                  </span>
                </div>

                <ReadOnlyField label="UUID" value={current.uuid || ''} />
                <Field label="Tajuk" value={current.title || ''} placeholder="Tajuk kandungan…" onChange={(v) => patch(activeIndex, 'title', v)} />
                <Field label="Topik" value={current.topik || ''} placeholder="Topik kandungan…" maxLen={hadTopik} onChange={(v) => patch(activeIndex, 'topik', v)} />
                {ceiling.maxBrief > 0 && (
                  <>
                    <Field label="Huraian ringkas" rows={4} value={current.brief || ''} placeholder="Huraian ringkas, dipapar pada kad…" onChange={(v) => patch(activeIndex, 'brief', v)} />
                    <BudgetMeter slotIndex={editingSlotIndex} ceiling={ceiling} title={current.title || ''} brief={current.brief || ''} />
                    <Field label="Huraian panjang" rows={5} value={current.briefLong || ''} placeholder="Huraian panjang, untuk paparan menatal penuh…" maxLen={ceiling.maxBriefLong} onChange={(v) => patch(activeIndex, 'briefLong', v)} />
                  </>
                )}

                <hr className="border-stone-150" />
                <div className="grid grid-cols-2 gap-5">
                  <Field label="Sumber" value={current.source || ''} placeholder="Adjung Editorial" onChange={(v) => patch(activeIndex, 'source', v)} />
                  <Field label="URL" value={current.url || ''} placeholder="https://…" onChange={(v) => patch(activeIndex, 'url', v)} />
                  <Field label="Tarikh sumber" value={current.date || ''} placeholder="21.07.26" onChange={(v) => patch(activeIndex, 'date', v)} />
                  <Field label="Imej" value={current.image || ''} placeholder="Nama fail imej…" onChange={(v) => patch(activeIndex, 'image', v)} />
                </div>
                <Field label="Nota" rows={2} value={current.note || ''} placeholder="Nota editor — dipaparkan di Focus View…" onChange={(v) => patch(activeIndex, 'note', v)} />
                <ReadOnlyField label="Editor" value={EDITOR_PLACEHOLDER} />
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

        <hr className="border-stone-150" />
        {/* Amaran kekal kelihatan di footer (bukan hanya di dalam borang yang boleh ditatal) bila
            ada kandungan tak lulus — sebelum ni butang Simpan Slot cuma jadi kelabu tanpa sebarang
            penjelasan berhampiran butang tu sendiri; editor yang sedang menyunting medan lain (Nota,
            Imej, dll., jauh di bawah borang) boleh klik berulang kali tanpa nampak KENAPA ia gagal. */}
        {items.length > 0 && passing !== items.length && (
          <div className="flex-none px-6 md:px-8 py-2 bg-[#a8241f]/[0.06] border-t border-[#a8241f]/20">
            <span className="font-sans text-[11px] text-[#a8241f] font-semibold">
              {items.length - passing} daripada {items.length} kandungan tidak lulus (bajet ruang kad atau Topik) — betulkan di senarai "Giliran carousel" sebelum boleh Simpan Slot.
            </span>
          </div>
        )}
        <footer className="flex-none flex items-center justify-between gap-5 px-6 md:px-8 py-3 bg-stone-50">
          <span className="font-sans text-[11px] text-stone-500">
            Berputar setiap <span className="font-mono text-stone-700">{formConfig.carouselInterval || 10}s</span> · <span className="font-mono">{items.length}</span> kandungan dalam giliran
          </span>
          <span className="flex gap-2.5">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-50 rounded text-xs font-semibold cursor-pointer">Batal</button>
            <button
              type="submit" disabled={isSavingSlot || (items.length > 0 && passing !== items.length)}
              className="px-5 py-2 bg-[#802334] hover:bg-[#601824] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-semibold cursor-pointer shadow-sm"
            >
              {isSavingSlot ? 'Menyimpan…' : 'Simpan Slot'}
            </button>
          </span>
        </footer>
      </form>
    </div>
  );
};
