import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Save, Plus, Search, ChevronDown, ChevronUp, LayoutGrid, FileText } from 'lucide-react';
import { Tooltip } from '../common/Tooltip';

interface ContentItem {
  id: string;
  revisionId: number;
  slotIndex: number;
  seriesIndex: number;
  title: string;
  summary: string;
  desk: string;
  source: string;
  url: string;
  imageUrl: string;
  maxTitle: number | null;
  maxBrief: number | null;
  slotCategory: string;
  createdAt: string;
  updatedAt: string;
}

const LimitBadge = ({ length, limit }: { length: number; limit: number | null }) => {
  if (!limit) return null;
  const over = length > limit;
  return (
    <span className={`text-[9px] font-mono font-bold ${over ? 'text-red-600' : 'text-green-600'}`}>
      {length}/{limit}{over ? ` (lebih ${length - limit})` : ' ✓'}
    </span>
  );
};

// Serializes all items into the numbered "#slot-series" bulk-text format, editable in one textarea.
const buildBulkText = (items: ContentItem[]) => {
  const sorted = [...items].sort((a, b) => a.slotIndex - b.slotIndex || a.seriesIndex - b.seriesIndex);
  return sorted
    .map(item => {
      const num = `#${item.slotIndex + 1}-${item.seriesIndex}`;
      return `${num}\nTajuk: ${item.title}\nHuraian: ${item.summary}\nKategori: ${item.desk}\nSumber: ${item.source}\nURL: ${item.url}`;
    })
    .join('\n\n');
};

interface BulkParsedEntry {
  slotNumber: number;
  seriesNumber: number;
  title: string;
  summary: string;
  desk: string;
  source: string;
  url: string;
}

// Parses the bulk text back into per-entry fields, anchored on the "#slot-series" header line.
const parseBulkText = (text: string): BulkParsedEntry[] => {
  const blocks = text.split(/\n(?=#\d+-\d+\s*$)/m);
  const entries: BulkParsedEntry[] = [];
  for (const block of blocks) {
    const headerMatch = block.match(/^#(\d+)-(\d+)\s*$/m);
    if (!headerMatch) continue;
    const slotNumber = parseInt(headerMatch[1], 10);
    const seriesNumber = parseInt(headerMatch[2], 10);
    let title = '', summary = '', desk = '', source = '', url = '';
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Tajuk:')) title = trimmed.replace(/^Tajuk:\s*/i, '').trim();
      else if (trimmed.startsWith('Huraian:')) summary = trimmed.replace(/^Huraian:\s*/i, '').trim();
      else if (trimmed.startsWith('Kategori:')) desk = trimmed.replace(/^Kategori:\s*/i, '').trim();
      else if (trimmed.startsWith('Sumber:')) source = trimmed.replace(/^Sumber:\s*/i, '').trim();
      else if (trimmed.startsWith('URL:')) url = trimmed.replace(/^URL:\s*/i, '').trim();
    }
    entries.push({ slotNumber, seriesNumber, title, summary, desk, source, url });
  }
  return entries;
};

export function ContentReview() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSlots, setExpandedSlots] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<ContentItem>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addingToSlot, setAddingToSlot] = useState<number | null>(null);
  const [newItemDraft, setNewItemDraft] = useState({ title: '', summary: '', desk: '', source: '', url: '' });

  const [viewMode, setViewMode] = useState<'card' | 'bulk'>('card');
  const [bulkText, setBulkText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');

  const loadItems = () => {
    setLoading(true);
    fetch('/api/system/content/all')
      .then(res => res.json())
      .then(data => {
        setItems(data.items || []);
        setLoading(false);
      })
      .catch(err => { console.error(err); setLoading(false); });
  };

  useEffect(() => { loadItems(); }, []);

  // Re-sync the bulk textarea from freshly loaded items whenever we switch into bulk view,
  // so it never shows stale text from before a card-view edit/delete/add.
  useEffect(() => {
    if (viewMode === 'bulk') {
      setBulkText(buildBulkText(items));
      setBulkStatus('');
    }
  }, [viewMode, items]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i =>
      i.title?.toLowerCase().includes(q) ||
      i.summary?.toLowerCase().includes(q) ||
      i.desk?.toLowerCase().includes(q) ||
      i.source?.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const groupedBySlot = useMemo(() => {
    const groups: Record<number, ContentItem[]> = {};
    filteredItems.forEach(item => {
      if (!groups[item.slotIndex]) groups[item.slotIndex] = [];
      groups[item.slotIndex].push(item);
    });
    return groups;
  }, [filteredItems]);

  const slotIndexes = useMemo(
    () => Object.keys(groupedBySlot).map(Number).sort((a, b) => a - b),
    [groupedBySlot]
  );

  const toggleSlot = (slotIndex: number) => {
    setExpandedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slotIndex)) next.delete(slotIndex); else next.add(slotIndex);
      return next;
    });
  };

  const startEdit = (item: ContentItem) => {
    setEditingId(item.id);
    setEditDraft({ title: item.title, summary: item.summary, desk: item.desk, source: item.source, url: item.url });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
  };

  const saveEdit = async (id: string) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/system/content/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft)
      });
      if (!res.ok) throw new Error('Gagal menyimpan.');
      setItems(prev => prev.map(i => (i.id === id ? { ...i, ...editDraft } as ContentItem : i)));
      setEditingId(null);
      setEditDraft({});
    } catch (err: any) {
      alert('Ralat menyimpan: ' + (err.message || ''));
    } finally {
      setSavingId(null);
    }
  };

  const deleteItem = async (id: string, title: string) => {
    if (!window.confirm(`Padam item "${title}"? Tindakan ini tidak boleh dibuat asal.`)) return;
    try {
      const res = await fetch(`/api/system/content/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal memadam.');
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      alert('Ralat memadam: ' + (err.message || ''));
    }
  };

  const submitNewItem = async (slotIndex: number) => {
    if (!newItemDraft.title.trim()) {
      alert('Tajuk diperlukan.');
      return;
    }
    try {
      const res = await fetch('/api/system/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotIndex, ...newItemDraft })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah item.');
      setAddingToSlot(null);
      setNewItemDraft({ title: '', summary: '', desk: '', source: '', url: '' });
      loadItems();
    } catch (err: any) {
      alert('Ralat menambah: ' + (err.message || ''));
    }
  };

  // Bulk save: edit-only. Matches each "#slot-series" block back to its original item, and PATCHes
  // only the ones whose fields actually changed. Numbers with no matching original item are ignored
  // (adding/removing items is intentionally left to the card view, where slot targeting is explicit).
  const saveBulk = async () => {
    setBulkSaving(true);
    setBulkStatus('Menghurai teks...');
    const parsed = parseBulkText(bulkText);
    const byKey: Record<string, ContentItem> = {};
    items.forEach(i => { byKey[`${i.slotIndex + 1}-${i.seriesIndex}`] = i; });

    const changed = parsed
      .map(p => ({ p, original: byKey[`${p.slotNumber}-${p.seriesNumber}`] }))
      .filter(({ p, original }) =>
        original && (
          p.title !== original.title ||
          p.summary !== original.summary ||
          p.desk !== original.desk ||
          p.source !== original.source ||
          p.url !== original.url
        )
      );

    if (changed.length === 0) {
      setBulkStatus('Tiada perubahan dikesan.');
      setBulkSaving(false);
      return;
    }

    let done = 0;
    let failed = 0;
    for (const { p, original } of changed) {
      setBulkStatus(`Menyimpan ${done + failed + 1}/${changed.length}...`);
      try {
        const res = await fetch(`/api/system/content/${original.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: p.title, summary: p.summary, desk: p.desk, source: p.source, url: p.url })
        });
        if (!res.ok) throw new Error();
        done++;
      } catch {
        failed++;
      }
    }

    setBulkStatus(`Selesai: ${done} disimpan${failed > 0 ? `, ${failed} gagal` : ''}.`);
    loadItems();
    setBulkSaving(false);
  };

  const slotLabel = (slotIndex: number) => {
    if (slotIndex === -1) return 'Ticker: Terkini di Malaysia';
    const category = groupedBySlot[slotIndex]?.[0]?.slotCategory;
    return category ? `Slot ${slotIndex + 1}: ${category}` : `Slot ${slotIndex + 1}`;
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans">
      <header className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="font-serif text-lg font-bold text-[#802334]">Semakan Kandungan</h1>
            <p className="text-[10px] text-stone-500 font-sans uppercase tracking-wider font-bold mt-0.5">
              {items.length} item merentasi {slotIndexes.length} slot
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex border border-stone-300 rounded overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  viewMode === 'card' ? 'bg-[#802334] text-white' : 'bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <LayoutGrid size={11} /> Paparan Kad
              </button>
              <button
                type="button"
                onClick={() => setViewMode('bulk')}
                className={`px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors border-l border-stone-300 ${
                  viewMode === 'bulk' ? 'bg-[#802334] text-white' : 'bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <FileText size={11} /> Paparan Teks Pukal
              </button>
            </div>
            <a href="/" className="text-xs font-bold text-stone-600 hover:text-[#802334] transition-colors">
              &larr; Kembali ke Frontpage
            </a>
          </div>
        </div>
        {viewMode === 'card' && (
          <div className="max-w-5xl mx-auto px-4 md:px-8 pb-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari ikut tajuk, huraian, kategori, atau sumber..."
                className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white text-xs"
              />
            </div>
          </div>
        )}
      </header>

      {viewMode === 'bulk' ? (
        <main className="max-w-5xl mx-auto px-4 md:px-8 py-6">
          <p className="text-[10px] text-stone-500 font-sans leading-normal mb-2">
            Setiap entri bermula dengan nombor <code className="font-mono bg-stone-100 px-1 rounded">#Slot-Siri</code> (cth <code className="font-mono bg-stone-100 px-1 rounded">#1-1</code> = Slot 1, siri 1).
            Sunting terus dalam kotak ini (termasuk markdown <code className="font-mono bg-stone-100 px-1 rounded">*italic*</code> jika perlu), kemudian klik "Simpan Pukal".
            Paparan ini untuk sunting kandungan sedia ada sahaja — tambah/padam item kekal di Paparan Kad.
          </p>
          {loading ? (
            <p className="text-xs text-stone-500 text-center py-12">Memuatkan...</p>
          ) : (
            <>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={30}
                className="w-full px-3 py-3 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs leading-relaxed"
              />
              <div className="flex justify-between items-center pt-3">
                <span className="text-[10px] text-stone-500 font-sans">{bulkStatus}</span>
                <button
                  type="button"
                  onClick={saveBulk}
                  disabled={bulkSaving}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#802334] rounded hover:bg-[#601824] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save size={13} /> {bulkSaving ? 'Menyimpan...' : 'Simpan Pukal'}
                </button>
              </div>
            </>
          )}
        </main>
      ) : (
        <main className="max-w-5xl mx-auto px-4 md:px-8 py-6">
          {loading && <p className="text-xs text-stone-500 text-center py-12">Memuatkan...</p>}
          {!loading && slotIndexes.length === 0 && (
            <p className="text-xs text-stone-500 text-center py-12">
              Tiada kandungan dijumpai{searchQuery ? ' untuk carian ini.' : '.'}
            </p>
          )}
          <div className="flex flex-col gap-3">
            {slotIndexes.map(slotIndex => {
              const slotItems = groupedBySlot[slotIndex];
              const isExpanded = expandedSlots.has(slotIndex) || !!searchQuery;
              return (
                <div key={slotIndex} className="border border-stone-200 rounded bg-white">
                  <button
                    type="button"
                    onClick={() => toggleSlot(slotIndex)}
                    className="w-full flex justify-between items-center px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#802334]">
                      {slotLabel(slotIndex)} <span className="text-stone-400 font-normal">({slotItems.length} item)</span>
                    </span>
                    {isExpanded ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-stone-150 divide-y divide-stone-100">
                      {slotItems.map(item => (
                        <div key={item.id} className="px-4 py-3">
                          {editingId === item.id ? (
                            <div className="flex flex-col gap-2">
                              <input
                                type="text"
                                value={editDraft.title || ''}
                                onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                                placeholder="Tajuk"
                                className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs font-semibold focus:outline-none focus:border-[#802334]"
                              />
                              <textarea
                                value={editDraft.summary || ''}
                                onChange={(e) => setEditDraft({ ...editDraft, summary: e.target.value })}
                                placeholder="Huraian"
                                rows={2}
                                className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs focus:outline-none focus:border-[#802334]"
                              />
                              <div className="grid grid-cols-3 gap-2">
                                <input
                                  type="text"
                                  value={editDraft.desk || ''}
                                  onChange={(e) => setEditDraft({ ...editDraft, desk: e.target.value })}
                                  placeholder="Kategori"
                                  className="px-2 py-1.5 border border-stone-300 rounded text-xs focus:outline-none focus:border-[#802334]"
                                />
                                <input
                                  type="text"
                                  value={editDraft.source || ''}
                                  onChange={(e) => setEditDraft({ ...editDraft, source: e.target.value })}
                                  placeholder="Sumber"
                                  className="px-2 py-1.5 border border-stone-300 rounded text-xs focus:outline-none focus:border-[#802334]"
                                />
                                <input
                                  type="text"
                                  value={editDraft.url || ''}
                                  onChange={(e) => setEditDraft({ ...editDraft, url: e.target.value })}
                                  placeholder="URL"
                                  className="px-2 py-1.5 border border-stone-300 rounded text-xs font-mono focus:outline-none focus:border-[#802334]"
                                />
                              </div>
                              <div className="flex gap-2 justify-end pt-1">
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="px-3 py-1.5 text-[10px] font-bold text-stone-600 bg-white border border-stone-300 rounded hover:bg-stone-50 cursor-pointer"
                                >
                                  Batal
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEdit(item.id)}
                                  disabled={savingId === item.id}
                                  className="px-3 py-1.5 text-[10px] font-bold text-white bg-[#802334] rounded hover:bg-[#601824] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                >
                                  <Save size={11} /> {savingId === item.id ? 'Menyimpan...' : 'Simpan'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-stone-400 font-bold">
                                    #{item.slotIndex + 1}-{item.seriesIndex}
                                  </span>
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-[#802334] font-bold">
                                    {item.desk || 'UMUM'}
                                  </span>
                                  {item.source && <span className="text-[9px] text-stone-400">· {item.source}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-[#1F1F1F] leading-snug">{item.title}</p>
                                  <LimitBadge length={item.title?.length || 0} limit={item.maxTitle} />
                                </div>
                                {item.summary && (
                                  <div className="flex items-start gap-2 mt-1">
                                    <p className="text-xs text-stone-500 leading-relaxed">{item.summary}</p>
                                    <LimitBadge length={item.summary?.length || 0} limit={item.maxBrief} />
                                  </div>
                                )}
                                {item.url && item.url !== '#' && (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-stone-400 hover:text-[#802334] underline break-all mt-1 inline-block"
                                  >
                                    {item.url}
                                  </a>
                                )}
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => startEdit(item)}
                                  className="px-2 py-1 text-[9px] font-bold text-[#802334] bg-white border border-[#802334] rounded hover:bg-stone-50 transition-colors cursor-pointer"
                                >
                                  Sunting
                                </button>
                                <Tooltip text="Padam">
                                  <button
                                    type="button"
                                    onClick={() => deleteItem(item.id, item.title)}
                                    className="p-1.5 text-stone-400 hover:text-red-600 transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </Tooltip>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="px-4 py-3">
                        {addingToSlot === slotIndex ? (
                          <div className="flex flex-col gap-2 bg-stone-50 p-3 rounded border border-stone-200">
                            <input
                              type="text"
                              value={newItemDraft.title}
                              onChange={(e) => setNewItemDraft({ ...newItemDraft, title: e.target.value })}
                              placeholder="Tajuk item baharu"
                              className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs font-semibold focus:outline-none focus:border-[#802334]"
                            />
                            <textarea
                              value={newItemDraft.summary}
                              onChange={(e) => setNewItemDraft({ ...newItemDraft, summary: e.target.value })}
                              placeholder="Huraian"
                              rows={2}
                              className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs focus:outline-none focus:border-[#802334]"
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                type="text"
                                value={newItemDraft.desk}
                                onChange={(e) => setNewItemDraft({ ...newItemDraft, desk: e.target.value })}
                                placeholder="Kategori"
                                className="px-2 py-1.5 border border-stone-300 rounded text-xs focus:outline-none focus:border-[#802334]"
                              />
                              <input
                                type="text"
                                value={newItemDraft.source}
                                onChange={(e) => setNewItemDraft({ ...newItemDraft, source: e.target.value })}
                                placeholder="Sumber"
                                className="px-2 py-1.5 border border-stone-300 rounded text-xs focus:outline-none focus:border-[#802334]"
                              />
                              <input
                                type="text"
                                value={newItemDraft.url}
                                onChange={(e) => setNewItemDraft({ ...newItemDraft, url: e.target.value })}
                                placeholder="URL"
                                className="px-2 py-1.5 border border-stone-300 rounded text-xs font-mono focus:outline-none focus:border-[#802334]"
                              />
                            </div>
                            <div className="flex gap-2 justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingToSlot(null);
                                  setNewItemDraft({ title: '', summary: '', desk: '', source: '', url: '' });
                                }}
                                className="px-3 py-1.5 text-[10px] font-bold text-stone-600 bg-white border border-stone-300 rounded hover:bg-stone-50 cursor-pointer"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={() => submitNewItem(slotIndex)}
                                className="px-3 py-1.5 text-[10px] font-bold text-white bg-[#802334] rounded hover:bg-[#601824] transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Plus size={11} /> Tambah
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAddingToSlot(slotIndex)}
                            className="text-[10px] font-bold text-[#802334] flex items-center gap-1 cursor-pointer hover:underline"
                          >
                            <Plus size={11} /> Tambah item baharu
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      )}
    </div>
  );
}
