import React, { useRef, useState } from 'react';
import { X, Trash2, Upload } from 'lucide-react';
import { ceilingForSlot, MAX_PENERANGAN_CHARS } from '../../../core/editorial/GeometryConfig.js';
import { parseManualSummaryBlocks, serializeManualBarQueue } from '../../../core/editorial/ManualBlockFormat.js';

// Borang native Editorium untuk slot Bar (Fasa 7, 2026-08-02) — dibina selepas laluan LAMA
// (klik kad Bar di FrontpageView semasa isEditMode) jadi tak boleh dicapai langsung: pencetus
// TERAKHIR untuk isEditMode (sambungan URL "?openTicker=1") dibuang sesi ni juga, jadi borang lama
// (masih wujud di FrontpageView.tsx ~baris 4232, KEKAL, lihat nota di situ) tiada langsung titik
// masuk UI lagi. Bukan salinan SlotManagerModal.tsx — set medan Bar (Event/Penganjur/Lokasi/
// Akses/Penerangan) berbeza SEPENUHNYA daripada kad bento biasa (Tajuk/Huraian/Bidang/Topik), dan
// server.js (syncManualObjectsForSlot) layan giliran Bar sebagai SATU hantaran keseluruhan setiap
// Simpan (kemas kini di tempat ikut UUID, bukan draf/Terbit berasingan macam tier lain) — lihat
// nota "isBarLikeRemoval"/"isBarUpdate" di situ. Borang ni ikut model server tu: SATU butang
// Simpan menghantar seluruh giliran, tiada Draf/Terbit berasingan.

interface BarSlotManagerModalProps {
  editingSlotIndex: number;
  formConfig: any;
  isSavingSlot: boolean;
  saveError?: string;
  onClose: () => void;
  onSave: (e: React.FormEvent, manualSummaryOverride?: string) => Promise<boolean | void> | void;
  slotOptions?: { index: number; label: string }[];
  onSwitchSlot?: (idx: number) => void;
}

const labelCls = 'font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500';

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
          <span className={`font-mono text-[9px] tabular-nums ${over ? 'text-[var(--color-error)]' : 'text-stone-400'}`}>{value.length}/{maxLen}</span>
        )}
      </span>
      {rows ? (
        <textarea
          rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="w-full resize-none border-0 border-b border-stone-300 focus:border-[var(--color-Adjung-maroon)] outline-none bg-white font-serif text-sm leading-relaxed text-stone-800 py-1.5 transition-colors"
        />
      ) : (
        <input
          type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="w-full border-0 border-b border-stone-300 focus:border-[var(--color-Adjung-maroon)] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
        />
      )}
    </label>
  );
}

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
          className="w-0 flex-1 border-0 border-b border-stone-300 focus:border-[var(--color-Adjung-maroon)] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
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

export const BarSlotManagerModal: React.FC<BarSlotManagerModalProps> = ({
  editingSlotIndex, formConfig, isSavingSlot, saveError, onClose, onSave, slotOptions, onSwitchSlot,
}) => {
  const ceiling = ceilingForSlot(editingSlotIndex);

  const blankItem = () => ({
    uuid: `object-manual-slot${editingSlotIndex}-${Date.now()}`,
    // access lalai 'Terbuka' (bukan '') — dropdown Akses di bawah PAPAR 'Terbuka' sebagai lalai
    // visual (value={current.access || 'Terbuka'}) tanpa editor sentuh langsung, tapi kalau state
    // sebenar kekal '' ia tersimpan kosong senyap (ditemui semasa ujian Fasa 7: BarCard.tsx pun
    // ada fallback 'Terbuka' sendiri di paparan, tapi lebih baik nilai SEBENAR tersimpan betul
    // daripada bergantung pada fallback berganda).
    title: '', organizer: '', location: '', access: 'Terbuka', penerangan: '',
    date: '', source: '', url: '', image: '', note: '', penulis: '',
  });

  const [items, setItems] = useState<any[]>(() => {
    const parsed = parseManualSummaryBlocks(formConfig.manualSummary || '');
    // Normalisasi Akses kosong (blok lama tiada baris "Akses:", atau parseManualBlockFields lalai
    // '') kepada 'Terbuka' SEBENAR dalam state — dropdown di bawah papar 'Terbuka' secara visual
    // (value={current.access || 'Terbuka'}) walaupun state kekal '', jadi tanpa normalisasi ni
    // simpan tanpa sentuh dropdown langsung tersimpan Akses kosong secara senyap.
    const normalized = parsed.map((it: any) => ({ ...it, access: it.access || 'Terbuka' }));
    return normalized.length > 0 ? normalized : [blankItem()];
  });
  const [active, setActive] = useState(0);
  const activeIndex = Math.max(0, Math.min(active, items.length - 1));
  const current = items[activeIndex] || blankItem();
  const hasUnsavedWork = items.some((it) => (it.title || '').trim());

  const commit = (mutator: (prev: any[]) => any[]) => setItems((prev) => mutator(prev));
  const patch = (i: number, key: string, value: string) => commit((prev) => (
    prev.length > 0 ? prev.map((it, n) => (n === i ? { ...it, [key]: value } : it)) : [{ ...blankItem(), [key]: value }]
  ));
  const insert = () => { commit((prev) => [...prev, blankItem()]); setActive(items.length); };
  const remove = (i: number) => {
    if (!window.confirm('Padam acara ini daripada giliran? Tindakan ini tidak boleh dibuat asal selepas disimpan.')) return;
    commit((prev) => prev.filter((_, n) => n !== i));
    setActive((a) => Math.max(0, Math.min(a, items.length - 2)));
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    commit((prev) => { const next = prev.slice(); [next[i], next[j]] = [next[j], next[i]]; return next; });
    setActive(j);
  };

  const [imageNote, setImageNote] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const uploadImage = async (i: number, file: File) => {
    if (!file.type.startsWith('image/')) { setImageNote('Fail mesti imej'); setTimeout(() => setImageNote(''), 2400); return; }
    if (file.size > MAX_IMAGE_BYTES) { setImageNote('Fail terlalu besar (had 5MB)'); setTimeout(() => setImageNote(''), 2400); return; }
    setUploadingImage(true);
    try {
      const fileData: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Gagal baca fail'));
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/media/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const handleSave = async () => {
    setSaving(true);
    setLocalError('');
    const manualSummary = serializeManualBarQueue(items);
    const ok = await onSave({ preventDefault: () => {} } as React.FormEvent, manualSummary);
    setSaving(false);
    if (ok !== false) {
      setSavedNote('Giliran Bar disimpan.');
      setTimeout(() => setSavedNote(''), 2400);
    } else {
      setLocalError(saveError || 'Gagal menyimpan slot Bar.');
      setTimeout(() => setLocalError(''), 5000);
    }
  };

  const handleSwitchSlot = (idx: number) => {
    if (idx === editingSlotIndex) return;
    if (hasUnsavedWork && !window.confirm('Tukar slot akan buang perubahan belum disimpan dalam slot ni. Teruskan?')) return;
    onSwitchSlot?.(idx);
  };

  const handleClose = () => {
    if (hasUnsavedWork && !window.confirm('Tutup borang ni akan buang perubahan belum disimpan dalam slot ni. Teruskan?')) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-white rounded-lg border border-stone-200 shadow-[0_4px_16px_rgba(0,0,0,.08)] w-full max-w-[1080px] h-[min(88vh,720px)] max-h-full flex flex-col overflow-hidden animate-fade-in">

        <header className="flex-none px-6 md:px-8 pt-5 pb-3.5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="font-serif text-xl md:text-2xl font-medium tracking-tight text-stone-900">
                Urus Slot Bar <span className="font-mono text-lg text-[var(--color-Adjung-maroon)]">{editingSlotIndex + 1}</span>
              </h2>
              <p className="mt-1.5 flex items-center gap-2.5 flex-wrap">
                <span className="font-sans text-[10px] uppercase tracking-[0.15em] font-extrabold text-[var(--color-Adjung-maroon)]">ACARA</span>
                <span className="text-stone-300">·</span>
                <span className="font-sans text-[11px] text-stone-500">Event / Penganjur / Lokasi / Akses / Penerangan — bukan kad Tajuk/Huraian biasa</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              {slotOptions && slotOptions.length > 0 && (
                <select
                  value={editingSlotIndex}
                  onChange={(e) => handleSwitchSlot(parseInt(e.target.value, 10))}
                  className="border border-stone-300 rounded px-2.5 py-1.5 font-sans text-xs font-semibold text-stone-600 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--color-Adjung-maroon)]"
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
        </header>
        <hr className="border-stone-150" />

        <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: 'minmax(240px, 32%) 1fr' }}>

          <section className="min-h-0 flex flex-col border-r border-stone-150">
            <div className="flex-none flex items-baseline justify-between px-3 pt-3 pb-2">
              <span className={labelCls}>Giliran acara</span>
              <span className="font-mono text-[10px] text-stone-400">{items.length}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto border-t border-stone-150">
              <ol className="list-none m-0 p-0">
                {items.map((it, i) => (
                  <li
                    key={it.uuid || i}
                    onClick={() => setActive(i)}
                    className={`group grid items-center gap-2.5 px-3 py-2.5 cursor-pointer border-b border-stone-150 last:border-b-0 transition-colors ${i === activeIndex ? 'bg-[var(--color-Adjung-maroon)]/[0.04] shadow-[inset_2px_0_0_var(--color-Adjung-maroon)]' : 'hover:bg-stone-50'}`}
                    style={{ gridTemplateColumns: '26px 1fr auto' }}
                  >
                    <span className={`font-mono text-[11px] font-bold tabular-nums ${i === activeIndex ? 'text-[var(--color-Adjung-maroon)]' : 'text-stone-400'}`}>{String(i + 1).padStart(2, '0')}</span>
                    <span className={`font-serif text-[13px] leading-snug truncate ${i === activeIndex ? 'text-stone-900 font-medium' : 'text-stone-600'}`}>
                      {it.title || <span className="text-stone-400 italic">Tiada nama acara</span>}
                    </span>
                    <span className="hidden group-hover:flex items-center gap-1.5">
                      <button type="button" aria-label="Naik" onClick={(e) => { e.stopPropagation(); move(i, -1); }} className="text-stone-500 hover:text-[var(--color-Adjung-maroon)] px-0.5">↑</button>
                      <button type="button" aria-label="Turun" onClick={(e) => { e.stopPropagation(); move(i, 1); }} className="text-stone-500 hover:text-[var(--color-Adjung-maroon)] px-0.5">↓</button>
                      <button type="button" aria-label="Buang" onClick={(e) => { e.stopPropagation(); remove(i); }} className="text-[var(--color-error)] px-0.5"><Trash2 size={12} /></button>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex-none border-t border-stone-150 p-2">
              <button type="button" onClick={insert} className="w-full text-center py-1.5 rounded font-sans text-[11px] font-semibold text-stone-600 hover:text-[var(--color-Adjung-maroon)] hover:bg-[var(--color-Adjung-maroon)]/[0.08] transition-colors cursor-pointer">
                + Tambah Acara Baharu
              </button>
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto px-6 md:px-8 py-5 flex flex-col gap-5">
            <span className={labelCls}>Acara <span className="font-mono">{String(activeIndex + 1).padStart(2, '0')}</span></span>

            <Field label="Event" value={current.title || ''} maxLen={ceiling.maxTitle} placeholder="Nama acara…" onChange={(v) => patch(activeIndex, 'title', v)} />
            <div className="grid grid-cols-2 gap-5">
              <Field label="Penganjur" value={current.organizer || ''} placeholder="Cth: PPAS / DBP / PNM / KPM" onChange={(v) => patch(activeIndex, 'organizer', v)} />
              <Field label="Lokasi" value={current.location || ''} placeholder="Lokasi acara…" onChange={(v) => patch(activeIndex, 'location', v)} />
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Akses</span>
                <select
                  value={current.access || 'Terbuka'}
                  onChange={(e) => patch(activeIndex, 'access', e.target.value)}
                  className="w-full border-0 border-b border-stone-300 focus:border-[var(--color-Adjung-maroon)] outline-none bg-white font-serif text-sm text-stone-800 py-1.5"
                >
                  <option value="Terbuka">Terbuka</option>
                  <option value="Tertutup">Tertutup</option>
                </select>
              </label>
              <Field label="Tarikh" value={current.date || ''} placeholder="Cth: 21 Ogos 2026" onChange={(v) => patch(activeIndex, 'date', v)} />
            </div>
            <Field label="Penerangan" rows={4} value={current.penerangan || ''} maxLen={MAX_PENERANGAN_CHARS} placeholder="Huraian tambahan acara — dipapar di panel akordion, bukan pada muka kad…" onChange={(v) => patch(activeIndex, 'penerangan', v)} />

            <hr className="border-stone-150" />
            <div className="grid grid-cols-2 gap-5">
              <Field label="Sumber" value={current.source || ''} maxLen={60} onChange={(v) => patch(activeIndex, 'source', v)} />
              <Field label="URL" value={current.url || ''} placeholder="https://…" onChange={(v) => patch(activeIndex, 'url', v)} />
              {/* Imej DIMATIKAN sengaja (2026-08-02) — medan ni disimpan tapi BarCard.tsx/
                  BarCardExpandedPanel.tsx tak pernah papar imej langsung, jadi muat naik di
                  sini tak buat apa-apa kesan kelihatan. Disahkan Izzat: matikan dulu (bukan
                  buang terus) sehingga keputusan sama ada nak bina paparan imej Bar. */}
              <label className="flex flex-col gap-1 opacity-50">
                <span className={labelCls}>Imej</span>
                <span className="px-3 py-2 border border-dashed border-stone-300 rounded bg-stone-50 font-sans text-[11px] text-stone-400">
                  Dimatikan buat masa ini — kad Bar tak papar imej lagi
                </span>
              </label>
            </div>
            <Field label="Nota" rows={2} value={current.note || ''} maxLen={280} placeholder="Nota editor (pilihan)…" onChange={(v) => patch(activeIndex, 'note', v)} />

            <hr className="border-stone-150" />
            <div className="flex items-center justify-between gap-4">
              <span className="flex flex-col gap-0.5">
                {(localError || savedNote) && (
                  <span className={`font-sans text-[10px] ${localError ? 'text-[var(--color-error)]' : 'text-stone-500'}`}>{localError || savedNote}</span>
                )}
              </span>
              <button
                type="button" onClick={handleSave} disabled={saving || isSavingSlot}
                className="px-4 py-1.5 bg-[var(--color-Adjung-maroon)] hover:bg-[var(--color-Adjung-maroon-dark)] disabled:opacity-50 disabled:cursor-wait text-white rounded text-[11px] font-sans font-semibold cursor-pointer transition-colors"
              >
                {saving || isSavingSlot ? 'Menyimpan…' : 'Simpan giliran Bar'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
