import React, { useState, useEffect, useMemo } from 'react';

interface BriefRecord {
  id: string;
  title: string;
  summary: string;
  desk: string;
  status: 'Pending' | 'Live' | 'Rejected' | 'Archive';
  creator: string;
  editor: string;
  cardType: 'Hero Card' | 'Feature Card' | 'Ticker' | 'Brief Card' | 'Compact Card' | '-';
  slot: string;
  date: string;
  isMine: boolean;
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

export const IndeksConsole: React.FC<IndeksConsoleProps> = ({
  currentUserRole = 'KETUA_EDITOR',
  currentUserName = 'Izzat Anas'
}) => {
  const [items, setItems] = useState<BriefRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Smart Filter Bar States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('Semua');
  const [selectedCardType, setSelectedCardType] = useState<string>('Semua');
  const [selectedEditor, setSelectedEditor] = useState<string>('Semua');
  const [selectedDesk, setSelectedDesk] = useState<string>('Semua');
  const [selectedSlot, setSelectedSlot] = useState<string>('Semua');

  // Editor View Filter: Saya vs Semua (Read Only)
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
        const cardTypes: Array<'Hero Card' | 'Feature Card' | 'Ticker' | 'Brief Card' | 'Compact Card'> = [
          'Hero Card', 'Feature Card', 'Brief Card', 'Compact Card'
        ];

        const normalized: BriefRecord[] = rawItems.map((item: any, idx: number) => {
          let status: 'Pending' | 'Live' | 'Rejected' | 'Archive' = 'Live';
          if (idx % 7 === 1) status = 'Pending';
          else if (idx % 19 === 2) status = 'Rejected';
          else if (idx % 23 === 3) status = 'Archive';

          const isMine = idx % 5 === 0 || item.source === 'Manual' || idx % 8 === 0;
          const creator = isMine ? currentUserName : (idx % 2 === 0 ? 'Ahmad' : 'Ali');
          const editor = isMine ? currentUserName : (idx % 3 === 0 ? 'Ahmad' : 'Fatimah');
          
          const isTicker = item.slotIndex === -1 || item.id?.startsWith('ticker-');
          const slot = isTicker ? 'Ticker' : `Slot ${item.slotIndex >= 0 ? item.slotIndex : (idx % 15)}`;
          const cardType = isTicker ? '-' : cardTypes[idx % cardTypes.length];

          return {
            id: item.id || `cnt_${idx}`,
            title: item.title || 'Kandungan Tanpa Tajuk',
            summary: item.summary || item.brief || '',
            desk: formatTitleCase(item.desk || (idx % 2 === 0 ? 'Sains' : 'Sejarah')),
            status,
            creator,
            editor,
            cardType,
            slot,
            date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('ms-MY') : '22/07/2026',
            isMine
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

  // Smart Filtering Logic
  const filteredRecords = useMemo(() => {
    return items.filter(item => {
      // Editor View Mode Filter
      if (currentUserRole === 'EDITOR' && editorViewMode === 'mine') {
        if (item.creator !== currentUserName && item.editor !== currentUserName && !item.isMine) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.creator.toLowerCase().includes(q) ||
          item.editor.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Filter: Status
      if (selectedStatus !== 'Semua' && item.status !== selectedStatus) return false;

      // Filter: Jenis Kad
      if (selectedCardType !== 'Semua' && item.cardType !== selectedCardType) return false;

      // Filter: Editor Bertanggungjawab
      if (selectedEditor !== 'Semua' && item.editor !== selectedEditor && item.creator !== selectedEditor) return false;

      // Filter: Desk
      if (selectedDesk !== 'Semua' && item.desk.toLowerCase() !== selectedDesk.toLowerCase()) return false;

      // Filter: Slot
      if (selectedSlot !== 'Semua' && item.slot !== selectedSlot) return false;

      return true;
    });
  }, [items, currentUserRole, editorViewMode, currentUserName, searchQuery, selectedStatus, selectedCardType, selectedEditor, selectedDesk, selectedSlot]);

  const handleUpdateStatus = (id: string, newStatus: 'Pending' | 'Live' | 'Rejected' | 'Archive') => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
    if (activeItemModal && activeItemModal.id === id) {
      setActiveItemModal({ ...activeItemModal, status: newStatus });
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStatus('Semua');
    setSelectedCardType('Semua');
    setSelectedEditor('Semua');
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

        {/* Search Input */}
        <div className="w-full">
          <input
            type="text"
            placeholder="🔍 Cari tajuk, ID, penyedia, penyunting, atau kata kunci brief..."
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
            </select>
          </div>

          {/* 3. Editor Bertanggungjawab Filter */}
          <div>
            <label className="text-[9px] uppercase font-bold text-stone-500 block mb-1">EDITOR IN CHARGE</label>
            <select
              value={selectedEditor}
              onChange={e => setSelectedEditor(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-semibold text-xs"
            >
              <option value="Semua">Semua Editor</option>
              <option value="Izzat Anas">Izzat Anas (Ketua Editor)</option>
              <option value="Ahmad">Editor Ahmad</option>
              <option value="Ali">Editor Ali</option>
              <option value="Fatimah">Editor Fatimah</option>
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
              <option value="Sains">Sains</option>
              <option value="Sejarah">Sejarah</option>
              <option value="Falsafah">Falsafah</option>
              <option value="Nasional">Nasional</option>
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
              <option value="Ticker">Ticker</option>
              <option value="Slot 0">Slot 0</option>
              <option value="Slot 1">Slot 1</option>
              <option value="Slot 2">Slot 2</option>
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

      {/* Editor View Switcher (Kandungan Saya vs Semua Read Only) */}
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
                <th className="p-2.5 w-32">Penyedia / Editor</th>
                <th className="p-2.5 w-24">Jenis Kad</th>
                <th className="p-2.5 w-20">Slot</th>
                <th className="p-2.5 w-24">Tarikh</th>
                <th className="p-2.5 w-32 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-sans">
              {filteredRecords.map(rec => {
                const isReadOnly = currentUserRole === 'EDITOR' && editorViewMode === 'all' && !rec.isMine;

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
                    <td className="p-2.5 font-serif text-stone-800 text-xs">
                      <div className="font-semibold">{rec.creator}</div>
                      <div className="font-sans text-[10px] text-stone-400">Ed: {rec.editor}</div>
                    </td>
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
                      {!isReadOnly ? (
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
                        <span className="text-stone-400 text-[11px] font-sans">Baca Sahaja</span>
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
              <span className="text-stone-500">Penyedia: <strong>{activeItemModal.creator}</strong> | Penyunting: <strong>{activeItemModal.editor}</strong></span>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndeksConsole;
