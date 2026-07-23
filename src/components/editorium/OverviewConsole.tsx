import React, { useState, useEffect } from 'react';

interface ContentItem {
  id: string;
  desk?: string;
}

export const OverviewConsole: React.FC = () => {
  const [totalContentCount, setTotalContentCount] = useState<number>(0);
  const [pendingReviewCount, setPendingReviewCount] = useState<number>(0);
  const [configuredSlotsCount, setConfiguredSlotsCount] = useState<number>(0);
  const [deskDistribution, setDeskDistribution] = useState<{ desk: string; color: string; count: number; percentage: number }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const DESK_COLORS: Record<string, string> = {
    'NASIONAL': '#802334',
    'EKONOMI': '#059669',
    'SAINS & TEKNOLOGI': '#2563EB',
    'KESUSASTERAAN MELAYU': '#D97706',
    'TEKNOLOGI': '#4338CA',
    'PSIKOLINGUISTIK': '#7C3AED',
    'SUKAN': '#DC2626',
    'SEMASA': '#475569'
  };

  const fetchOverviewMetrics = async () => {
    try {
      setIsLoading(true);
      
      // 1. Fetch content items
      const resContent = await fetch('/api/system/content/all');
      if (resContent.ok) {
        const dataContent = await resContent.json();
        const items: ContentItem[] = Array.isArray(dataContent) ? dataContent : (dataContent.items || []);
        setTotalContentCount(items.length);

        // Compute desk breakdown
        const deskCounts: Record<string, number> = {};
        items.forEach(item => {
          const d = (item.desk || 'SEMASA').toUpperCase().trim();
          deskCounts[d] = (deskCounts[d] || 0) + 1;
        });

        const total = items.length || 1;
        const dist = Object.keys(deskCounts).map((desk, idx) => {
          const count = deskCounts[desk];
          const pct = Math.round((count / total) * 100);
          const color = DESK_COLORS[desk] || `hsl(${(idx * 137.5) % 360}, 65%, 45%)`;
          return { desk, color, count, percentage: pct };
        });

        setDeskDistribution(dist);
      }

      // 2. Fetch pending ticker review queue count
      const resPending = await fetch('/api/system/ticker/items?status=pending');
      if (resPending.ok) {
        const dataPending = await resPending.json();
        setPendingReviewCount(Array.isArray(dataPending) ? dataPending.length : 0);
      }

      // 3. Fetch slots summary
      const resSlots = await fetch('/api/system/slots/summary');
      if (resSlots.ok) {
        const dataSlots = await resSlots.json();
        setConfiguredSlotsCount(dataSlots.configuredCount || 38);
      }
    } catch (e) {
      console.error('Error loading overview metrics:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewMetrics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner Overview */}
      <div className="bg-white p-6 rounded border border-stone-250 shadow-2xs flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#802334] font-bold mb-1">
            📊 KONSOL RINGKASAN BILIK BERITA & KESIHATAN DESK LIVE
          </h2>
          <p className="font-serif text-sm text-stone-600">
            Pemantauan real-time Content Budget, status penahanan semakan, dan kesihatan peruntukan spatial Adjung Brief.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchOverviewMetrics}
          disabled={isLoading}
          className="px-3 py-1.5 bg-[#F9F8F6] hover:bg-stone-200 text-stone-800 rounded border border-stone-300 font-mono text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
        >
          <span>{isLoading ? '⏳ Memuatkan...' : '🔄 Muat Semula Metrik'}</span>
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded border border-stone-250 shadow-2xs flex flex-col justify-between">
          <span className="font-mono text-[9px] uppercase tracking-widest text-stone-500 font-bold">JUMLAH KANDUNGAN CORE (LIVE)</span>
          <div className="text-3xl font-serif font-bold text-stone-900 my-2">
            {isLoading ? '...' : totalContentCount}
          </div>
          <span className="font-mono text-[9px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded w-max font-bold border border-emerald-200">
            🟢 Disimpan di Database
          </span>
        </div>

        <div className="bg-white p-5 rounded border border-stone-250 shadow-2xs flex flex-col justify-between">
          <span className="font-mono text-[9px] uppercase tracking-widest text-stone-500 font-bold">SEMAKAN TAHAN (REVIEW HOLD)</span>
          <div className="text-3xl font-serif font-bold text-amber-700 my-2">
            {isLoading ? '...' : pendingReviewCount}
          </div>
          <span className="font-mono text-[9px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded w-max font-bold border border-amber-200">
            ⏳ Skor Ambang Lulus &lt; 60%
          </span>
        </div>

        <div className="bg-white p-5 rounded border border-stone-250 shadow-2xs flex flex-col justify-between">
          <span className="font-mono text-[9px] uppercase tracking-widest text-stone-500 font-bold">PERUNTUKAN SLOT SPATIAL</span>
          <div className="text-3xl font-serif font-bold text-stone-900 my-2">
            {isLoading ? '...' : `${configuredSlotsCount} / 38`}
          </div>
          <span className="font-mono text-[9px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded w-max font-bold border border-stone-250">
            📌 Bento Tier 1 hingga Tier 4
          </span>
        </div>
      </div>

      {/* Desk Content Budget Distribution */}
      <div className="bg-white p-6 rounded border border-stone-250 shadow-2xs space-y-4">
        <h3 className="font-mono text-xs uppercase tracking-widest text-stone-700 font-bold">
          STATUS CONTENT BUDGET MENGIKUT SEKTOR DESK (LIVE REAL-TIME)
        </h3>

        {/* Visual Progress Bar */}
        <div className="h-4 w-full bg-stone-100 rounded overflow-hidden flex border border-stone-250">
          {deskDistribution.map(item => (
            <div
              key={item.desk}
              style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
              className="h-full transition-all duration-300"
              title={`${item.desk}: ${item.count} Artikel (${item.percentage}%)`}
            />
          ))}
        </div>

        {/* Desk Legend List */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {deskDistribution.map(item => (
            <div key={item.desk} className="flex items-center gap-2 font-mono text-xs bg-[#F9F8F6] p-2 rounded border border-stone-200">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <div className="flex flex-col overflow-hidden">
                <span className="text-[9px] text-stone-500 uppercase font-bold truncate">{item.desk}</span>
                <span className="font-bold text-stone-800">{item.count} Artikel ({item.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OverviewConsole;
