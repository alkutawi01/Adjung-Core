import React, { useState, useEffect } from 'react';

interface TickerReviewItem {
  id: number;
  title: string;
  brief: string;
  score: number;
  desk: string;
  source: string;
  publishedAt: string;
  rawCategory?: string;
  status: string;
}

export const ReviewQueueConsole: React.FC = () => {
  const [items, setItems] = useState<TickerReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const fetchPendingItems = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/system/ticker/items?status=pending');
      if (!res.ok) throw new Error('Gagal mengambil giliran semakan ticker');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load review queue:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingItems();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      setActionLoadingId(id);
      const res = await fetch(`/api/system/ticker/approve/${id}`, { method: 'POST' });
      if (res.ok) {
        setItems(prev => prev.filter(item => item.id !== id));
      }
    } catch (e) {
      console.error('Approve error:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: number) => {
    try {
      setActionLoadingId(id);
      const res = await fetch(`/api/system/ticker/reject/${id}`, { method: 'POST' });
      if (res.ok) {
        setItems(prev => prev.filter(item => item.id !== id));
      }
    } catch (e) {
      console.error('Reject error:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBlockTag = async (tag: string) => {
    if (!tag) return;
    try {
      // Fetch current settings, append blocked tag, and save
      const resSettings = await fetch('/api/system/ticker/settings');
      if (!resSettings.ok) return;
      const settings = await resSettings.json();
      const existing = (settings.blockedCategoryTags || '').split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
      if (!existing.includes(tag)) {
        existing.push(tag);
        const newBlocked = existing.join(',');
        await fetch('/api/system/ticker/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...settings, blockedCategoryTags: newBlocked })
        });
        fetchPendingItems();
      }
    } catch (e) {
      console.error('Block tag error:', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Header */}
      <div className="bg-white p-6 rounded border border-stone-250 shadow-2xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-widest text-amber-800 font-bold mb-1">
            ⏳ KONSOL SEMAKAN EDITOR (EDITORIAL REVIEW HOLD QUEUE LIVE)
          </h2>
          <p className="font-serif text-sm text-stone-600">
            Kandungan berita RSS yang mendapat skor keyakinan di bawah ambang lulus (&lt; 60%) atau memerlukan pengesahan manual staf editorial.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded font-bold">
            {items.length} BAHAN DITAHAN
          </span>
          <button
            type="button"
            onClick={fetchPendingItems}
            disabled={isLoading}
            className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-800 rounded border border-stone-300 font-mono text-xs font-bold transition flex items-center gap-1 cursor-pointer"
          >
            <span>{isLoading ? '⏳ Memuatkan...' : '🔄 Muat Semula'}</span>
          </button>
        </div>
      </div>

      {/* Review Queue Items List */}
      {isLoading && (
        <div className="bg-white p-12 text-center rounded border border-stone-200 text-stone-500 font-mono text-xs">
          ⏳ Memuatkan senarai giliran semakan berita live...
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="bg-white p-12 text-center rounded border border-stone-200 text-stone-600 font-serif">
          ✨ Tiada berita baharu dalam giliran semakan tahan. Kesemua berita masukan telah diluluskan atau disaring.
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="space-y-4">
          {items.map(item => (
            <div key={item.id} className="bg-white p-6 rounded border border-stone-250 shadow-2xs space-y-4 hover:border-[#802334] transition-colors">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-stone-150 pb-3">
                <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider flex-wrap">
                  <span className="bg-[#802334] text-white px-2 py-0.5 rounded font-bold">
                    ITEM #{item.id}
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="text-stone-700 font-bold">{item.source || 'RSS Feed'}</span>
                  <span className="text-stone-300">•</span>
                  <span className="text-stone-500">{item.publishedAt ? new Date(item.publishedAt).toLocaleString('ms-MY') : '-'}</span>
                  {item.rawCategory && (
                    <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold border border-amber-250">
                      TAG ASAL: {item.rawCategory}
                    </span>
                  )}
                </div>
                
                <span className="font-mono text-xs bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded font-bold">
                  SKOR: <span className="font-extrabold">{item.score || 0}</span> (AMBANG SEMAKAN)
                </span>
              </div>

              {/* Title & Brief */}
              <div className="space-y-2">
                <h3 className="font-serif text-lg md:text-xl font-medium text-stone-900 leading-snug">
                  {item.title}
                </h3>
                <p className="font-serif text-xs md:text-sm text-stone-600 leading-relaxed">
                  {item.brief}
                </p>
              </div>

              {/* Desk Suggestion & Actions */}
              <div className="flex flex-wrap justify-between items-center gap-4 pt-2 border-t border-stone-150">
                <div className="flex items-center gap-2 font-mono text-xs flex-wrap">
                  <span className="text-stone-500 font-bold text-[10px]">DESK CADANGAN:</span>
                  <span className="bg-stone-900 text-[#E9D8A6] px-2.5 py-0.5 rounded font-bold text-xs">
                    {item.desk || 'BERITA SEMASA'}
                  </span>

                  {item.rawCategory && (
                    <button
                      type="button"
                      onClick={() => handleBlockTag(item.rawCategory!)}
                      className="ml-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer"
                      title={`Sekat semua berita dengan tag '${item.rawCategory}'`}
                    >
                      🚫 Sekat Tag '{item.rawCategory}'
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => handleApprove(item.id)}
                    disabled={actionLoadingId === item.id}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded font-bold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    {actionLoadingId === item.id ? '⏳ Processing...' : '✓ LULUSKAN & SIARKAN'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(item.id)}
                    disabled={actionLoadingId === item.id}
                    className="bg-stone-200 hover:bg-stone-300 text-stone-800 px-3.5 py-1.5 rounded font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    ✕ GUGURKAN
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewQueueConsole;
