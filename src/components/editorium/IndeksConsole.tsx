import React, { useState, useEffect, useMemo } from 'react';
import { tierForSlot } from '../../../core/editorial/GeometryConfig.js';

interface BriefRecord {
  id: string;
  title: string;
  summary: string;
  desk: string;
  status: 'Pending' | 'Live' | 'Rejected' | 'Archive';
  creator: string;
  cardType: 'Hero Card' | 'Feature Card' | 'Ticker' | 'Brief Card' | 'Compact Card' | 'Bar Strip' | '-';
  slot: string;
  date: string;
}

interface IndeksConsoleProps {
  currentUserRole?: 'KETUA_EDITOR' | 'EDITOR';
  currentUserName?: string;
}

const formatTitleCase = (str: string) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Backend stores a lowercase status on editorial_revisions; the console displays the Malay/title
// case labels the rest of the UI already uses.
const STATUS_TO_LABEL: Record<string, BriefRecord['status']> = {
  approved: 'Live',
  pending: 'Pending',
  rejected: 'Rejected',
  archived: 'Archive',
};
const LABEL_TO_STATUS: Record<BriefRecord['status'], string> = {
  Live: 'approved',
  Pending: 'pending',
  Rejected: 'rejected',
  Archive: 'archived',
};

// createdBy on editorial_revisions is a machine token (which save path wrote it), not a human
// name -- there's no multi-editor sign-in system yet, so this labels *how* content was created
// rather than *who by*. Once real accounts exist, the pipeline/manual paths should start writing
// the actual authenticated username here instead.
const formatCreatedBy = (createdBy: string): string => {
  if (!createdBy) return 'Tidak diketahui';
  if (createdBy === 'ticker') return 'Ticker';
  if (createdBy.startsWith('pipeline-slot-')) return 'AI Pipeline';
  if (createdBy === 'manual-user' || createdBy === 'manual-slot-save') return 'Manual';
  if (createdBy === 'content-review') return 'Disunting (Indeks)';
  if (createdBy === 'migration-manual-blob') return 'Migrasi';
  return createdBy;
};

// Real geometry tier per slot (same source of truth the frontpage itself uses) instead of a
// random rotation -- see core/editorial/GeometryConfig.js.
const cardTypeForSlot = (slotIndex: number): BriefRecord['cardType'] => {
  if (slotIndex === -1) return 'Ticker';
  const tier = tierForSlot(slotIndex);
  switch (tier) {
    case 'HERO': return 'Hero Card';
    case 'MENEGAK':
    case 'STANDARD': return 'Feature Card';
    case 'SEGI_EMPAT_MEDIUM':
    case 'SEGI_EMPAT_SMALL': return 'Brief Card';
    case 'KOMPAK': return 'Compact Card';
    case 'BAR': return 'Bar Strip';
    default: return '-';
  }
};

export const IndeksConsole: React.FC<IndeksConsoleProps> = ({
  currentUserRole = 'KETUA_EDITOR',
  currentUserName = 'Izzat Anas'
}) => {
  const [items, setItems] = useState<BriefRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Smart Filter Bar States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('Semua');
  const [selectedCardType, setSelectedCardType] = useState<string>('Semua');
  const [selectedCreator, setSelectedCreator] = useState<string>('Semua');
  const [selectedDesk, setSelectedDesk] = useState<string>('Semua');
  const [selectedSlot, setSelectedSlot] = useState<string>('Semua');

  // Editor View Filter: Saya vs Semua (Read Only) -- only meaningful once real EDITOR accounts
  // exist; KETUA_EDITOR always sees and can act on everything.
  const [editorViewMode, setEditorViewMode] = useState<'mine' | 'all'>(currentUserRole === 'EDITOR' ? 'mine' : 'all');

  // Detail Modal State
  const [activeItemModal, setActiveItemModal] = useState<BriefRecord | null>(null);

  // Load Real Data from SQLite Endpoint
  useEffect(() => {
    setLoading(true);
    fetch('/api/system/content/all')
      .then(res => res.json())
      .then(data => {
        const rawItems = data.items || [];

        const normalized: BriefRecord[] = rawItems.map((item: any, idx: number) => {
          const isTicker = item.slotIndex === -1 || item.id?.startsWith('ticker-');
          const slot = isTicker ? 'Ticker' : `Slot ${item.slotIndex}`;

          return {
            id: item.id || `cnt_${idx}`,
            title: item.title || 'Kandungan Tanpa Tajuk',
            summary: item.summary || item.brief || '',
            desk: formatTitleCase(item.desk || 'Umum'),
            status: STATUS_TO_LABEL[item.status] || 'Live',
            creator: formatCreatedBy(item.createdBy || ''),
            cardType: cardTypeForSlot(item.slotIndex),
            slot,
            date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('ms-MY') : '-',
          };
        });

        setItems(normalized);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading index data:', err);
        setLoading(false);
      });
  }, [currentUserName]);

  // Status Counters
  const statusCounts = useMemo(() => {
    return {
      Pending: items.filter(i => i.status === 'Pending').length,
      Live: items.filter(i => i.status === 'Live').length,
      Rejected: items.filter(i => i.status === 'Rejected').length,
      Archive: items.filter(i => i.status === 'Archive').length,
      Total: items.length
    };
  }, [items]);

  // Filter option lists derived from real loaded data, not hardcoded guesses.
  const deskOptions = useMemo(() => Array.from(new Set(items.map(i => i.desk))).sort(), [items]);
  const creatorOptions = useMemo(() => Array.from(new Set(items.map(i => i.creator))).sort(), [items]);
  const slotOptions = useMemo(() => {
    const slots: string[] = Array.from(new Set(items.map(i => i.slot)));
    return slots.sort((a: string, b: string) => {
      if (a === 'Ticker') return -1;
      if (b === 'Ticker') return 1;
      return parseInt(a.replace('Slot ', ''), 10) - parseInt(b.replace('Slot ', ''), 10);
    });
  }, [items]);

  // Smart Filtering Logic
  const filteredRecords = useMemo(() => {
    return items.filter(item => {
      // Editor View Mode Filter
      if (currentUserRole === 'EDITOR' && editorViewMode === 'mine') {
        if (item.creator !== currentUserName) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.creator.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Filter: Status
      if (selectedStatus !== 'Semua' && item.status !== selectedStatus) return false;

      // Filter: Jenis Kad
      if (selectedCardType !== 'Semua' && item.cardType !== selectedCardType) return false;

      // Filter: Sumber/Pencipta
      if (selectedCreator !== 'Semua' && item.creator !== selectedCreator) return false;

      // Filter: Desk
      if (selectedDesk !== 'Semua' && item.desk.toLowerCase() !== selectedDesk.toLowerCase()) return false;

      // Filter: Slot
      if (selectedSlot !== 'Semua' && item.slot !== selectedSlot) return false;

      return true;
    });
  }, [items, currentUserRole, editorViewMode, currentUserName, searchQuery, selectedStatus, selectedCardType, selectedCreator, selectedDesk, selectedSlot]);

  const handleUpdateStatus = async (id: string, newStatus: BriefRecord['status']) => {
    setActionError(null);
    const previous = items;
    // Optimistic update, rolled back on failure.
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
    if (activeItemModal && activeItemModal.id === id) {
      setActiveItemModal({ ...activeItemModal, status: newStatus });
    }

    try {
      const res = await fetch(`/api/system/content/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: LABEL_TO_STATUS[newStatus] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Gagal kemas kini status (${res.status}).`);
      }
    } catch (err: any) {
      setItems(previous);
      if (activeItemModal && activeItemModal.id === id) {
        setActiveItemModal(previous.find(i => i.id === id) || null);
      }
      setActionError(err.message || 'Gagal kemas kini status.');
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStatus('Semua');
    setSelectedCardType('Semua');
    setSelectedCreator('Semua');
    setSelectedDesk('Semua');
    setSelectedSlot('Semua');
  };

  return (
    <div className="space-y-6">
      {/* MEJA KERJA EDITORIAL - SMART FILTER BAR */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="font-serif text-base uppercase tracking-wider text-[#802334] font-bold mb-1">
              Indeks Kandungan Adjung Brief (Meja Kerja Editorial)
            </h2>
            <p className="font-sans text-xs text-stone-600">
              Pusat pencarian dan penapisan pintar bagi kesemua {statusCounts.Total} kandungan Adjung Brief.
            </p>
          </div>

          {/* Quick Counter Badges */}
          <div className="flex items-center gap-2 font-sans text-[10px]">
            <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold">Pending: <span className="font-mono">{statusCounts.Pending}</span></span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold">Live: <span className="font-mono">{statusCounts.Live}</span></span>
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded font-bold">Rejected: <span className="font-mono">{statusCounts.Rejected}</span></span>
            <span className="bg-stone-200 text-stone-700 px-2 py-1 rounded font-bold">Archive: <span className="font-mono">{statusCounts.Archive}</span></span>
          </div>
        </div>

        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs font-sans px-3 py-2 rounded flex justify-between items-center">
            <span>⚠️ {actionError}</span>
            <button onClick={() => setActionError(null)} className="font-bold px-2">✕</button>
          </div>
        )}

        {/* Search Input */}
        <div className="w-full">
          <input
            type="text"
            placeholder="🔍 Cari tajuk, ID, atau kata kunci brief..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-stone-50 border border-stone-300 rounded px-4 py-2.5 font-sans text-xs shadow-xs"
          />
        </div>

        {/* 6 Dropdown Smart Filters */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 font-sans text-xs">
          {/* 1. Status Filter */}
          <div>
            <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">STATUS</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-semibold text-xs"
            >
              <option value="Semua">Semua Status</option>
              <option value="Pending">Pending</option>
              <option value="Live">Live</option>
              <option value="Rejected">Rejected</option>
              <option value="Archive">Archive</option>
            </select>
          </div>

          {/* 2. Jenis Kad Filter */}
          <div>
            <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">JENIS KAD</label>
            <select
              value={selectedCardType}
              onChange={e => setSelectedCardType(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-semibold text-xs"
            >
              <option value="Semua">Semua Kad</option>
              <option value="Hero Card">Hero Card</option>
              <option value="Feature Card">Feature Card</option>
              <option value="Ticker">Ticker</option>
              <option value="Brief Card">Brief Card</option>
              <option value="Compact Card">Compact Card</option>
              <option value="Bar Strip">Bar Strip</option>
            </select>
          </div>

          {/* 3. Sumber/Pencipta Filter */}
          <div>
            <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">SUMBER</label>
            <select
              value={selectedCreator}
              onChange={e => setSelectedCreator(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-semibold text-xs"
            >
              <option value="Semua">Semua Sumber</option>
              {creatorOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* 4. Desk Filter */}
          <div>
            <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">DESK DISIPLIN</label>
            <select
              value={selectedDesk}
              onChange={e => setSelectedDesk(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-semibold text-xs"
            >
              <option value="Semua">Semua Desk</option>
              {deskOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* 5. Slot Filter */}
          <div>
            <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">SLOT</label>
            <select
              value={selectedSlot}
              onChange={e => setSelectedSlot(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-semibold text-xs"
            >
              <option value="Semua">Semua Slot</option>
              {slotOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Reset Filters Button */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="w-full bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold px-3 py-1.5 rounded transition-colors text-[11px]"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      {/* Editor View Switcher (Kandungan Saya vs Semua Read Only) -- relevant once real EDITOR accounts exist */}
      {currentUserRole === 'EDITOR' && (
        <div className="flex bg-stone-100 p-1 rounded font-sans text-xs w-max border border-stone-200">
          <button
            onClick={() => setEditorViewMode('mine')}
            className={`px-4 py-1.5 rounded font-bold transition-all ${
              editorViewMode === 'mine' ? 'bg-[#802334] text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            📌 Kandungan Saya (Boleh Edit & Publish)
          </button>
          <button
            onClick={() => setEditorViewMode('all')}
            className={`px-4 py-1.5 rounded font-bold transition-all ${
              editorViewMode === 'all' ? 'bg-[#802334] text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            🔒 Semua Kandungan (Baca Sahaja)
          </button>
        </div>
      )}

      {/* Filtering Results Summary */}
      <div className="flex justify-between items-center font-sans text-xs text-stone-500 px-1">
        <div>
          Menampilkan <strong className="font-mono font-bold">{filteredRecords.length}</strong> daripada <span className="font-mono font-semibold">{items.length}</span> jumlah kandungan
        </div>
      </div>

      {/* Content List Table */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-lg border border-stone-200 font-sans text-xs text-stone-500">
          ⏳ Memuatkan meja kerja kandungan...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-lg border border-stone-200 font-serif text-stone-500 text-xs">
          Tiada kandungan yang sepadan dengan kriteria filter pilihan anda.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs min-w-[850px]">
            <thead>
              <tr className="bg-stone-100 border-b border-stone-200 font-sans text-xs uppercase text-stone-600 font-semibold">
                <th className="p-2.5 w-24">ID</th>
                <th className="p-2.5">Tajuk Brief</th>
                <th className="p-2.5 w-20">Status</th>
                <th className="p-2.5 w-24">Desk</th>
                <th className="p-2.5 w-28">Sumber</th>
                <th className="p-2.5 w-24">Jenis Kad</th>
                <th className="p-2.5 w-20">Slot</th>
                <th className="p-2.5 w-24">Tarikh</th>
                <th className="p-2.5 w-32 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-sans">
              {filteredRecords.map(rec => {
                const isReadOnly = currentUserRole === 'EDITOR' && editorViewMode === 'all' && rec.creator !== currentUserName;

                return (
                  <tr
                    key={rec.id}
                    onClick={() => setActiveItemModal(rec)}
                    className="hover:bg-stone-50 cursor-pointer transition-colors"
                  >
                    <td className="p-2.5 font-sans text-xs text-stone-500 font-semibold truncate max-w-[100px]" title={rec.id}>
                      {rec.id}
                    </td>
                    <td className="p-2.5">
                      <div className="font-serif font-medium text-stone-900 leading-snug line-clamp-1">
                        {rec.title}
                      </div>
                      <div className="font-serif text-[11px] text-stone-500 line-clamp-1">
                        {rec.summary}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        rec.status === 'Live' ? 'bg-emerald-100 text-emerald-800' :
                        rec.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                        rec.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-stone-200 text-stone-700'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="p-2.5 font-sans text-xs text-stone-700 font-semibold">{formatTitleCase(rec.desk)}</td>
                    <td className="p-2.5 font-serif text-stone-800 text-xs">{rec.creator}</td>
                    <td className="p-2.5 font-sans text-[10px]">
                      {rec.cardType === '-' ? (
                        <span className="text-stone-400 font-mono text-xs font-bold px-2">-</span>
                      ) : (
                        <span className="bg-stone-100 text-stone-800 px-2 py-0.5 rounded font-semibold border border-stone-200">
                          {rec.cardType}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 font-sans text-xs font-semibold text-stone-700">{rec.slot}</td>
                    <td className="p-2.5 font-sans text-stone-500 text-[10px] whitespace-nowrap">{rec.date}</td>
                    <td className="p-2.5 text-right font-sans text-xs whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {rec.slot !== 'Ticker' && !isReadOnly ? (
                        <select
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'Live' || val === 'Rejected' || val === 'Archive') {
                              handleUpdateStatus(rec.id, val as any);
                            }
                            e.target.value = '';
                          }}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 rounded px-2.5 py-1 font-sans text-xs font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#802334]"
                        >
                          <option value="" disabled hidden>Tindakan ▾</option>
                          {rec.status !== 'Live' && <option value="Live">🟢 Siar</option>}
                          {rec.status !== 'Rejected' && <option value="Rejected">🔴 Tolak</option>}
                          {rec.status !== 'Archive' && <option value="Archive">📦 Arkib</option>}
                        </select>
                      ) : (
                        <span className="text-stone-400 text-[11px] font-sans">{rec.slot === 'Ticker' ? 'Ticker (uruskan di Tetapan)' : 'Baca Sahaja'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* BRIEF DETAIL MODAL */}
      {activeItemModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-stone-300 max-w-2xl w-full p-6 space-y-5">
            <div className="flex justify-between items-start border-b border-stone-200 pb-3">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-stone-500 font-bold block mb-1">
                  DETUL KANDUNGAN BRIEF • {activeItemModal.id}
                </span>
                <h3 className="font-serif text-xl font-bold text-stone-900">
                  {activeItemModal.title}
                </h3>
              </div>
              <button onClick={() => setActiveItemModal(null)} className="text-stone-400 hover:text-stone-800 font-bold text-lg">
                ✕
              </button>
            </div>

            <div className="font-serif text-sm text-stone-700 leading-relaxed bg-stone-50 p-4 rounded border border-stone-200">
              {activeItemModal.summary}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs bg-stone-100 p-3 rounded border border-stone-200">
              <div><span className="text-stone-500 text-[9px] block">STATUS</span><strong className="text-stone-900">{activeItemModal.status}</strong></div>
              <div><span className="text-stone-500 text-[9px] block">DESK</span><strong className="text-stone-900">{formatTitleCase(activeItemModal.desk)}</strong></div>
              <div><span className="text-stone-500 text-[9px] block">JENIS KAD</span><strong className="text-stone-900">{activeItemModal.cardType}</strong></div>
              <div><span className="text-stone-500 text-[9px] block">SLOT</span><strong className="text-stone-900">{activeItemModal.slot}</strong></div>
            </div>

            <div className="flex justify-between items-center pt-2 font-mono text-xs">
              <span className="text-stone-500">Sumber: <strong>{activeItemModal.creator}</strong></span>
              {activeItemModal.slot !== 'Ticker' ? (
                <div className="flex gap-2">
                  {activeItemModal.status !== 'Live' && (
                    <button
                      onClick={() => handleUpdateStatus(activeItemModal.id, 'Live')}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-md font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Publish Brief
                    </button>
                  )}
                  {activeItemModal.status !== 'Rejected' && (
                    <button
                      onClick={() => handleUpdateStatus(activeItemModal.id, 'Rejected')}
                      className="bg-[#c00000] hover:bg-red-800 text-white px-4 py-2 rounded-md font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Reject Brief
                    </button>
                  )}
                  <button
                    onClick={() => setActiveItemModal(null)}
                    className="bg-stone-800 hover:bg-stone-900 text-white px-4 py-2 rounded-md font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveItemModal(null)}
                  className="bg-stone-800 hover:bg-stone-900 text-white px-4 py-2 rounded-md font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndeksConsole;
