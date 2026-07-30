import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Trash2, Edit3, AlertCircle, RefreshCw, Layers, CheckCircle2, Search, Send, ShieldCheck, ShieldAlert, UserCheck, Users, HelpCircle, AlignLeft, Check } from 'lucide-react';
import { TIER_LABELS, tierForSlot } from '../../../core/editorial/GeometryConfig.js';
import { validateContentBudget } from '../../../core/editorial/ContentBudget.js';

// Adjung Brief Design System Aligned — Pure Cream Surface (#FDFDFD), Hairline Sectioning (1px stone-200), Serif Titles, Inter Labels, Mono for Data Only.

interface DraftItem {
  slotIndex: number;
  tier: string;
  tierLabel: string;
  desk: string;
  draftIndex: number;
  title: string;
  summary: string;
  briefLong: string;
  source: string;
  topik: string;
  editorName: string;
  rawBlock: string;
  budgetCheck: { isValid: boolean; reason?: string };
  hasTopik: boolean;
  hasBriefLong: boolean;
}

interface ConfirmModalState {
  isOpen: boolean;
  type: 'publish' | 'delete' | null;
  draft: DraftItem | null;
}

interface DrafSayaConsoleProps {
  onOpenSlotEditor?: (slotIndex: number) => void;
  currentEditorName?: string;
}

export const DrafSayaConsole: React.FC<DrafSayaConsoleProps> = ({ onOpenSlotEditor, currentEditorName }) => {
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDesk, setSelectedDesk] = useState('Semua');
  const [filterOnlyMine, setFilterOnlyMine] = useState(false);

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    type: null,
    draft: null,
  });

  const fetchDrafts = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/system/slots');
      if (!res.ok) throw new Error('Gagal memuatkan tetapan slot pelayan.');
      const slots = await res.json();
      if (!Array.isArray(slots)) {
        setDrafts([]);
        return;
      }

      const extractedDrafts: DraftItem[] = [];

      slots.forEach((slot: any) => {
        const manualSummary = slot.manualSummary || '';
        if (!manualSummary.trim()) return;

        const blocks = manualSummary.split(/\n\n_{40,}\n\n/);
        blocks.forEach((block: string, idx: number) => {
          if (!block.trim()) return;

          const lines = block.split('\n');
          let title = '';
          let summary = '';
          let briefLong = '';
          let source = '';
          let topik = '';
          let editorName = '';
          let status = 'draft';

          lines.forEach((line: string) => {
            if (line.startsWith('Tajuk:')) title = line.replace('Tajuk:', '').trim();
            else if (line.startsWith('Huraian ringkas:')) summary = line.replace('Huraian ringkas:', '').trim();
            else if (line.startsWith('Huraian panjang:')) briefLong = line.replace('Huraian panjang:', '').trim();
            else if (line.startsWith('Sumber:')) source = line.replace('Sumber:', '').trim();
            else if (line.startsWith('Topik:')) topik = line.replace('Topik:', '').trim();
            else if (line.startsWith('Editor:')) editorName = line.replace('Editor:', '').trim();
            else if (line.startsWith('Status:')) status = line.replace('Status:', '').trim().toLowerCase();
          });

          const hasRealTitle = !!(title && title.trim() && title !== '(Tanpa Tajuk Draf)');
          const hasRealSummary = !!(summary && summary.trim() && summary !== '(Tiada huraian ringkas)');

          if ((status === 'draft' || status === '') && (hasRealTitle || hasRealSummary)) {
            const tierKey = tierForSlot(slot.slotIndex) || 'STANDARD';
            const check = validateContentBudget(slot.slotIndex, title, summary);
            const hasTopik = !!(topik && topik.trim() && topik !== '-');
            const hasBriefLong = !!(briefLong && briefLong.trim());

            const canonicalTierLabel = TIER_LABELS[tierKey] || tierKey;

            extractedDrafts.push({
              slotIndex: slot.slotIndex,
              tier: tierKey,
              tierLabel: canonicalTierLabel,
              desk: slot.manualDesk || 'UMUM',
              draftIndex: idx + 1,
              title: title || '(Tanpa Tajuk Draf)',
              summary: summary || '',
              briefLong: briefLong || '',
              source: source || 'ADJUNG EDITORIAL',
              topik: hasTopik ? topik : '',
              editorName: editorName || slot.editorName || '',
              rawBlock: block,
              budgetCheck: check,
              hasTopik,
              hasBriefLong
            });
          }
        });
      });

      setDrafts(extractedDrafts);
    } catch (err: any) {
      setError(err.message || 'Ralat memuatkan draf.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const executePublish = async (draft: DraftItem) => {
    const pubKey = `${draft.slotIndex}-${draft.draftIndex}`;
    setIsPublishing(pubKey);
    setError('');
    setSuccessMsg('');

    try {
      const resSlots = await fetch('/api/system/slots');
      const slots = await resSlots.json();
      const targetSlot = slots.find((s: any) => s.slotIndex === draft.slotIndex);
      if (!targetSlot) throw new Error('Slot tidak ditemui.');

      const finalTopik = draft.hasTopik ? draft.topik : 'Semasa';

      const publishedBlock = [
        `Tajuk: ${draft.title}`,
        `Huraian ringkas: ${draft.summary}`,
        `Huraian panjang: ${draft.briefLong}`,
        `Sumber: ${draft.source}`,
        `Topik: ${finalTopik}`,
        `Status: approved`,
      ].join('\n');

      const updatedFormConfig = {
        ...targetSlot,
        manualTitle: draft.title,
        manualSummary: publishedBlock,
        editorName: currentEditorName || draft.editorName || 'Editor Log Masuk'
      };

      const saveRes = await fetch('/api/system/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFormConfig),
      });

      const saveJson = await saveRes.json();
      if (saveJson.success) {
        setSuccessMsg(`Draf "${draft.title.slice(0, 30)}..." telah berjaya diterbitkan ke Indeks!`);
        fetchDrafts();
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        setError(saveJson.error || 'Gagal menerbitkan draf.');
      }
    } catch (err: any) {
      setError('Ralat menerbitkan draf: ' + (err.message || ''));
    } finally {
      setIsPublishing(null);
      setConfirmModal({ isOpen: false, type: null, draft: null });
    }
  };

  const executeDelete = async (draft: DraftItem) => {
    try {
      const res = await fetch('/api/system/slots');
      const slots = await res.json();
      const targetSlot = slots.find((s: any) => s.slotIndex === draft.slotIndex);
      if (!targetSlot) return;

      const updatedSlot = {
        ...targetSlot,
        manualSummary: '',
      };

      const saveRes = await fetch('/api/system/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSlot),
      });

      const saveJson = await saveRes.json();
      if (saveJson.success) {
        setSuccessMsg(`Draf bagi Slot ${draft.slotIndex === -1 ? 'Ticker' : draft.slotIndex + 1} telah berjaya dibuang.`);
        fetchDrafts();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setError(saveJson.error || 'Gagal memadam draf.');
      }
    } catch (err: any) {
      setError('Ralat memadam draf: ' + err.message);
    } finally {
      setConfirmModal({ isOpen: false, type: null, draft: null });
    }
  };

  const deskList = useMemo(() => {
    const list = Array.from(new Set(drafts.map(d => d.desk)));
    return ['Semua', ...list];
  }, [drafts]);

  const filteredDrafts = useMemo(() => {
    return drafts.filter(d => {
      const matchesDesk = selectedDesk === 'Semua' || d.desk === selectedDesk;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || 
        d.title.toLowerCase().includes(q) || 
        d.summary.toLowerCase().includes(q) ||
        d.topik.toLowerCase().includes(q) ||
        d.source.toLowerCase().includes(q);
      
      const matchesMine = !filterOnlyMine || (
        currentEditorName && d.editorName && d.editorName.toLowerCase().includes(currentEditorName.toLowerCase())
      );

      return matchesDesk && matchesSearch && matchesMine;
    });
  }, [drafts, selectedDesk, searchQuery, filterOnlyMine, currentEditorName]);

  const totalSlotsWithDrafts = new Set(drafts.map(d => d.slotIndex)).size;

  return (
    <div className="space-y-6 font-sans bg-[#FDFDFD] text-[#1F1F1F]">
      {/* Editorial Header — Hairline border, no heavy card box */}
      <div className="pb-4 border-b border-stone-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-900">
            Konsol Draf Peribadi Editor
          </h2>
          <p className="text-xs text-stone-500 font-sans mt-0.5">
            Pengurusan draf berpusat. Draf penulisan tersimpan sementara secara peribadi tanpa muncul di portal awam.
          </p>
        </div>

        <button
          onClick={fetchDrafts}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer font-sans"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Segar semula
        </button>
      </div>

      {/* Metrics Row — Flat cream surface, 1px rules */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-stone-200">
        <div className="py-2">
          <span className="text-[10px] font-sans uppercase tracking-widest text-stone-400 font-bold block">Jumlah draf aktif</span>
          <span className="text-2xl font-serif font-bold text-stone-900">{drafts.length}</span>
        </div>

        <div className="py-2">
          <span className="text-[10px] font-sans uppercase tracking-widest text-stone-400 font-bold block">Slot ada draf</span>
          <span className="text-2xl font-serif font-bold text-stone-900">{totalSlotsWithDrafts} / 38</span>
        </div>

        <div className="py-2">
          <span className="text-[10px] font-sans uppercase tracking-widest text-stone-400 font-bold block">Penyunting log masuk</span>
          <span className="text-sm font-sans font-semibold text-stone-800 block truncate mt-1">{currentEditorName || 'Editor Log Masuk'}</span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-rose-50 border-l-4 border-rose-600 text-rose-800 p-3 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-600 text-emerald-800 p-3 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Bar — Sentence case for buttons and select labels */}
      <div className="py-3 border-b border-stone-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Cari tajuk, huraian, topik atau sumber draf…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded text-xs font-sans focus:outline-none focus:border-[#802334]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-stone-100 p-0.5 rounded border border-stone-200 text-xs">
            <button
              onClick={() => setFilterOnlyMine(false)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                !filterOnlyMine ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Users className="w-3 h-3" /> Semua draf
            </button>
            <button
              onClick={() => setFilterOnlyMine(true)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                filterOnlyMine ? 'bg-[#802334] text-white shadow-xs' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <UserCheck className="w-3 h-3" /> Draf saya sahaja
            </button>
          </div>

          <span className="text-[10px] font-sans uppercase tracking-widest text-stone-400 font-bold shrink-0">Bidang:</span>
          <select
            value={selectedDesk}
            onChange={(e) => setSelectedDesk(e.target.value)}
            className="px-3 py-1.5 border border-stone-200 rounded text-xs font-semibold text-stone-800 bg-white focus:outline-none focus:border-[#802334]"
          >
            {deskList.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Drafts Table — Flat cream layout with hairline rule separators */}
      <div className="w-full">
        <div className="pb-2 flex items-center justify-between">
          <span className="font-sans text-xs font-bold text-stone-800">Senarai Draf Sebenar</span>
          <span className="font-mono text-[10px] text-stone-400">Memaparkan {filteredDrafts.length} / {drafts.length} draf</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-stone-500">Memuatkan draf tersimpan...</div>
        ) : filteredDrafts.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <FileText className="w-8 h-8 text-stone-300 mx-auto" />
            <p className="text-xs font-semibold text-stone-600">Tiada Draf Aktif Ditemui</p>
            <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
              Semua slot bersih tanpa sebarang draf yang tertunggak.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <table className="w-full text-left border-collapse text-xs table-fixed">
              <thead>
                <tr className="border-b border-stone-300 text-[10px] font-sans uppercase tracking-widest text-stone-400 font-bold">
                  <th className="py-2.5 px-3 w-28">Slot & Tier</th>
                  <th className="py-2.5 px-3 w-28">Bidang</th>
                  <th className="py-2.5 px-3">Tajuk & Huraian Draf</th>
                  <th className="py-2.5 px-3 w-28">Kelengkapan</th>
                  <th className="py-2.5 px-3 w-24">Bajet Ruang</th>
                  <th className="py-2.5 px-3 text-right w-32">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/80">
                {filteredDrafts.map((draft, idx) => {
                  const pubKey = `${draft.slotIndex}-${draft.draftIndex}`;
                  const pubRunning = isPublishing === pubKey;

                  return (
                    <tr key={`${draft.slotIndex}-${idx}`} className="hover:bg-stone-100/50 transition-colors">
                      {/* Slot Label (Mono for Slot Number Only) */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="font-mono bg-stone-900 text-white rounded px-1.5 py-0.5 text-[10px] font-bold">
                            {draft.slotIndex === -1 ? 'Ticker' : `Slot ${draft.slotIndex + 1}`}
                          </span>
                          <span className="font-sans text-[9px] text-stone-500 font-semibold uppercase tracking-wider truncate max-w-full">
                            {draft.tierLabel}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-sans text-[10px] uppercase font-bold text-[#802334]">
                          {draft.desk}
                        </span>
                      </td>

                      {/* Title: Source Serif 4 */}
                      <td className="py-3 px-3">
                        <div
                          className="font-serif font-bold text-stone-900 text-sm truncate max-w-[240px] lg:max-w-[320px] cursor-help"
                          title={`Tajuk Penuh:\n${draft.title}`}
                        >
                          {draft.title}
                        </div>
                        {draft.summary ? (
                          <div className="font-sans text-stone-600 text-[11px] truncate mt-0.5 max-w-[240px] lg:max-w-[320px]" title={draft.summary}>
                            {draft.summary}
                          </div>
                        ) : null}
                      </td>

                      {/* Kelengkapan */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5 font-sans">
                          {draft.hasTopik ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-stone-700 truncate max-w-[100px]" title={`Topik: ${draft.topik}`}>
                              <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" /> {draft.topik}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] text-stone-400">
                              Topik: -
                            </span>
                          )}

                          {draft.hasBriefLong ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-800">
                              <AlignLeft className="w-2.5 h-2.5 text-emerald-600 shrink-0" /> +Huraian
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] text-stone-400">
                              Ringkas sahaja
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Semakan Aksara */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {draft.budgetCheck.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-sans font-bold text-emerald-800">
                            <ShieldCheck className="w-3 h-3 text-emerald-700" /> LULUS
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-sans font-bold text-rose-800 cursor-help"
                            title={draft.budgetCheck.reason}
                          >
                            <ShieldAlert className="w-3 h-3 text-rose-700" /> LEBIH HAD
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setConfirmModal({ isOpen: true, type: 'publish', draft })}
                            disabled={!draft.budgetCheck.isValid || pubRunning}
                            className="flex items-center gap-1 px-2.5 py-1 bg-[#802334] hover:bg-[#601824] disabled:bg-stone-200 disabled:text-stone-400 text-white rounded text-[11px] font-semibold transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed"
                            title={draft.budgetCheck.isValid ? 'Terbit Terus Ke Indeks' : (draft.budgetCheck.reason || 'Draf melebihi had aksara kad')}
                          >
                            <Send className={`w-3 h-3 ${pubRunning ? 'animate-bounce' : ''}`} />
                            {pubRunning ? '...' : 'Terbit'}
                          </button>

                          {onOpenSlotEditor && (
                            <button
                              onClick={() => onOpenSlotEditor(draft.slotIndex)}
                              className="flex items-center gap-1 p-1 text-stone-600 hover:text-[#802334] rounded text-[11px] font-semibold transition-colors"
                              title="Buka Borang Penyuntingan Full"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => setConfirmModal({ isOpen: true, type: 'delete', draft })}
                            className="flex items-center gap-1 p-1 text-stone-400 hover:text-rose-700 rounded text-[11px] font-semibold transition-colors"
                            title="Padam Draf"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.draft && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FDFDFD] rounded-xl border border-stone-300 shadow-2xl max-w-md w-full overflow-hidden font-sans">
            <div className="bg-[#802334] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-300" />
                <h3 className="font-serif text-sm font-bold">
                  {confirmModal.type === 'publish' ? 'Pengesahan Terbit Kandungan' : 'Pengesahan Pemadaman Draf'}
                </h3>
              </div>
              <button
                onClick={() => setConfirmModal({ isOpen: false, type: null, draft: null })}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-stone-700 leading-relaxed">
                {confirmModal.type === 'publish' ? (
                  <>
                    Adakah anda pasti ingin menerbitkan draf <strong className="font-serif font-bold text-stone-900">"{confirmModal.draft.title}"</strong> terus ke Indeks rasmi?
                  </>
                ) : (
                  <>
                    Adakah anda pasti ingin membuang draf bagi <strong className="font-sans font-bold text-stone-900">{confirmModal.draft.slotIndex === -1 ? 'Ticker' : `Slot ${confirmModal.draft.slotIndex + 1}`} ({confirmModal.draft.desk})</strong>? Tindakan ini tidak boleh diundur.
                  </>
                )}
              </p>

              <div className="bg-stone-100/60 border border-stone-200 p-3 rounded text-[11px] font-mono space-y-1">
                <div><span className="text-stone-400 uppercase">Slot:</span> {confirmModal.draft.slotIndex === -1 ? 'Ticker' : `Slot ${confirmModal.draft.slotIndex + 1}`} ({confirmModal.draft.tierLabel})</div>
                <div><span className="text-stone-400 uppercase">Bidang:</span> {confirmModal.draft.desk}</div>
                <div><span className="text-stone-400 uppercase">Topik:</span> {confirmModal.draft.topik || 'Semasa (Auto)'}</div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: false, type: null, draft: null })}
                  className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-xs font-semibold border border-stone-200 transition-colors"
                >
                  Batal
                </button>
                {confirmModal.type === 'publish' ? (
                  <button
                    type="button"
                    onClick={() => executePublish(confirmModal.draft!)}
                    className="px-4 py-1.5 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-semibold transition-colors shadow-xs"
                  >
                    Terbitkan Sekarang
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => executeDelete(confirmModal.draft!)}
                    className="px-4 py-1.5 bg-rose-800 hover:bg-rose-700 text-white rounded text-xs font-semibold transition-colors shadow-xs"
                  >
                    Padam Draf
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
