import React, { useState, useEffect } from 'react';

interface SlotConfig {
  slotIndex: number;
  contentMode?: string;
  manualTitle?: string;
  manualSummary?: string;
  manualSource?: string;
  manualDesk?: string;
  sourceType?: string;
  providerId?: string;
  model?: string;
  refreshRate?: string;
  lastAttemptAt?: string;
  lastRunStatus?: string;
}

interface SlotManagerConsoleProps {
  onOpenSlotEdit?: (slotIndex: number) => void;
}

export const SlotManagerConsole: React.FC<SlotManagerConsoleProps> = ({ onOpenSlotEdit }) => {
  const [viewMode, setViewMode] = useState<'all_slots' | 'my_slots'>('all_slots');
  const [activeUser, setActiveUser] = useState({
    id: 'usr_editor_chief',
    name: 'Chief Editor Izzat',
    role: 'CHIEF_EDITOR'
  });
  const [slotsList, setSlotsList] = useState<SlotConfig[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLiveSlots = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/system/slots');
      if (!res.ok) throw new Error('Gagal mengambil data slot');
      const data = await res.json();
      setSlotsList(Array.isArray(data) ? data : []);
      setErrorMsg(null);
    } catch (err: any) {
      console.error('Fetch slots error:', err);
      setErrorMsg(err.message || 'Ralat komunikasi pelayan');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveSlots();
  }, []);

  const handleToggleContentMode = async (slot: SlotConfig) => {
    const nextMode = slot.contentMode === 'AI Generated' ? 'Manual' : 'AI Generated';
    try {
      const payload = {
        ...slot,
        contentMode: nextMode
      };
      const res = await fetch('/api/system/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchLiveSlots();
      }
    } catch (e) {
      console.error('Failed to toggle content mode:', e);
    }
  };

  const getSlotGeometryTier = (idx: number) => {
    if (idx === -1) return 'TICKER';
    if (idx === 0) return 'HERO';
    if ([2, 12, 18, 28].includes(idx)) return 'MENEGAK';
    if ([7, 8, 9, 10, 21, 22, 23, 24].includes(idx)) return 'BAR';
    if ([13, 14, 15, 16, 29, 30, 31, 32].includes(idx)) return 'HALF_HORIZONTAL';
    return 'KOMPAK';
  };

  const getSlotName = (idx: number) => {
    if (idx === -1) return 'Ticker Semasa (Live Newsroom Strip)';
    if (idx === 0) return 'Kad Utama Hero (Utama Frontpage)';
    return `Bento Slot #${idx}`;
  };

  const getSourceTypeBadge = (st?: string) => {
    switch (st) {
      case 'print': return <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono text-[9px] font-bold">📄 Bahan Bercetak</span>;
      case 'audio': return <span className="bg-purple-100 text-purple-900 px-2 py-0.5 rounded font-mono text-[9px] font-bold">🎙️ Audio</span>;
      case 'video': return <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded font-mono text-[9px] font-bold">🎬 Video</span>;
      default: return <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-mono text-[9px] font-bold">🌐 Laman Web</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white p-6 rounded border border-stone-250 shadow-2xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[#802334] font-bold">
              🗂️ SPATIAL SLOT MANAGER & TATA KELOLA MANDAT LIVE
            </h2>
            <span className="bg-emerald-100 text-emerald-900 font-mono text-[9px] px-2 py-0.5 rounded font-bold">
              LIVE DATABASE SYNC: 38 GEOMETRY SLOTS
            </span>
          </div>
          <p className="font-serif text-sm text-stone-600">
            Pengurusan geometri slot spatial Frontpage secara masa nyata. Ketua Editor mempunyai Kuasa Kawalan Global (*Global Oversight*) dan *Override* berkuasa tinggi ke atas setiap slot redaksi.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex bg-stone-100 p-1 rounded font-mono text-xs border border-stone-250">
          <button
            onClick={() => setViewMode('all_slots')}
            className={`px-3 py-1 rounded font-bold transition-all ${
              viewMode === 'all_slots' ? 'bg-[#802334] text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            🌐 KESELURUHAN (SLOTS LIVE)
          </button>
          <button
            onClick={() => setViewMode('my_slots')}
            className={`px-3 py-1 rounded font-bold transition-all ${
              viewMode === 'my_slots' ? 'bg-[#802334] text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            📌 MANDAT KETUA EDITOR
          </button>
        </div>
      </div>

      {/* Identity Switcher & Refresh Control */}
      <div className="bg-[#F9F8F6] p-4 rounded border border-stone-200 flex flex-wrap justify-between items-center gap-3 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="text-stone-600 font-bold">IDENTITI PETUGAS:</span>
          <span className="bg-stone-900 text-[#E9D8A6] px-2.5 py-1 rounded font-bold">
            👑 {activeUser.name} ({activeUser.role})
          </span>
        </div>
        <button
          type="button"
          onClick={fetchLiveSlots}
          disabled={isLoading}
          className="px-3 py-1 bg-white hover:bg-stone-100 text-stone-800 rounded border border-stone-300 font-bold transition flex items-center gap-1.5 cursor-pointer"
        >
          <span>{isLoading ? '⏳ Memuatkan...' : '🔄 Muat Semula Data Slot Live'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 font-mono text-xs rounded">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Slots List */}
      <div className="space-y-3">
        {slotsList.length === 0 && !isLoading && (
          <div className="p-8 text-center bg-white rounded border border-stone-200 font-serif text-stone-500 text-sm">
            Tiada data slot ditemui di pangkalan data pelayan.
          </div>
        )}

        {slotsList.map(slot => {
          const tier = getSlotGeometryTier(slot.slotIndex);
          const titleSnippet = slot.manualTitle || (slot.manualSummary ? slot.manualSummary.slice(0, 70) : 'Kandungan Belum Ditetapkan');

          return (
            <div key={slot.slotIndex} className="bg-white p-5 rounded border border-stone-250 shadow-2xs flex flex-wrap justify-between items-center gap-4 hover:border-[#802334] transition-colors">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-wider">
                  <span className="bg-[#802334] text-white px-2 py-0.5 rounded font-bold">
                    SLOT {slot.slotIndex === -1 ? 'TICKER' : `#${slot.slotIndex}`}
                  </span>
                  <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded font-bold border border-stone-250">
                    GEOMETRI: {tier}
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    slot.contentMode === 'AI Generated' ? 'bg-indigo-100 text-indigo-900' : 'bg-emerald-100 text-emerald-900'
                  }`}>
                    MOD: {slot.contentMode || 'Manual'}
                  </span>
                  <span className="text-stone-300">•</span>
                  {getSourceTypeBadge(slot.sourceType)}
                </div>
                
                <h3 className="font-serif text-base font-medium text-stone-900">
                  {getSlotName(slot.slotIndex)}
                </h3>
                
                <p className="font-serif text-xs text-stone-600 line-clamp-2">
                  Kandungan Aktif: <span className="font-bold text-stone-800">"{titleSnippet}"</span>
                </p>
                {slot.manualDesk && (
                  <span className="inline-block text-[9px] font-mono font-bold text-[#802334] bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                    DESK: {slot.manualDesk}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                {onOpenSlotEdit && (
                  <button
                    type="button"
                    onClick={() => onOpenSlotEdit(slot.slotIndex)}
                    className="bg-stone-900 hover:bg-stone-800 text-[#E9D8A6] px-3.5 py-2 rounded font-bold transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                  >
                    <span>🔗 SUNTING DI FRONTPAGE</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleContentMode(slot)}
                  className="bg-[#802334] hover:bg-[#601824] text-white px-3.5 py-2 rounded font-bold transition-colors cursor-pointer shadow-2xs"
                  title="Tukar Mod Live antara Manual dan AI Generated"
                >
                  ⚡ KETUA OVERRIDE ({slot.contentMode === 'AI Generated' ? 'PAUT MANUAL' : 'PAUT AI'})
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SlotManagerConsole;
