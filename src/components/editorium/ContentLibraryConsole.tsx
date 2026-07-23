import React, { useState, useEffect } from 'react';

interface EditorialContentItem {
  id: string;
  type?: string;
  desk?: string;
  title: string;
  summary?: string;
  url?: string;
  source?: string;
  sourceType?: string;
  status?: string;
  createdAt?: string;
  slotIndex?: number;
}

export const ContentLibraryConsole: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('ALL');
  const [items, setItems] = useState<EditorialContentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLiveContent = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/system/content/all');
      if (!res.ok) throw new Error('Gagal mengambil perpustakaan kandungan');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load content library:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveContent();
  }, []);

  const filteredItems = items.filter(item => {
    const matchesSearch = (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.summary || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.desk || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.source || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSourceType = sourceTypeFilter === 'ALL' || (item.sourceType || 'web') === sourceTypeFilter;
    return matchesSearch && matchesSourceType;
  });

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
      {/* Banner Header */}
      <div className="bg-white p-6 rounded border border-stone-250 shadow-2xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#802334] font-bold mb-1">
            📚 PERPUSTAKAAN DALAMAN EDITORIAL (EDITORIAL CONTENT LIBRARY)
          </h2>
          <p className="font-serif text-sm text-stone-600">
            Carian, rujukan silang, dan capaian semula arkib Objek Redaksi Adjung Brief secara masa nyata dari pangkalan data.
          </p>
        </div>

        {/* Search Input */}
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="🔍 Cari tajuk, huraian, desk, sumber..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#F9F8F6] border border-stone-300 rounded px-3 py-2 font-mono text-xs focus:outline-none focus:border-[#802334]"
          />
        </div>
      </div>

      {/* Source Type Filter Pills */}
      <div className="bg-[#F9F8F6] p-3 rounded border border-stone-200 flex flex-wrap items-center justify-between gap-3 font-mono text-xs select-none">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-stone-600 uppercase text-[9px] tracking-wider">TAPIS JENIS SUMBER:</span>
          {[
            { id: 'ALL', label: 'SEMUA' },
            { id: 'web', label: '🌐 LAMAN WEB' },
            { id: 'print', label: '📄 BAHAN BERCETAK' },
            { id: 'audio', label: '🎙️ AUDIO' },
            { id: 'video', label: '🎬 VIDEO' }
          ].map(st => (
            <button
              key={st.id}
              type="button"
              onClick={() => setSourceTypeFilter(st.id)}
              className={`px-3 py-1 rounded font-bold transition cursor-pointer ${
                sourceTypeFilter === st.id
                  ? 'bg-[#802334] text-white shadow-2xs'
                  : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-300'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={fetchLiveContent}
          disabled={isLoading}
          className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-800 rounded border border-stone-300 font-bold transition flex items-center gap-1 cursor-pointer"
        >
          <span>{isLoading ? '⏳ Memuatkan...' : '🔄 Muat Semula'}</span>
        </button>
      </div>

      {/* Library Table List */}
      <div className="bg-white rounded border border-stone-250 shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <thead>
            <tr className="bg-stone-100 border-b border-stone-250 font-mono text-[9px] uppercase text-stone-600 tracking-wider">
              <th className="p-3">UUID KANONIKAL</th>
              <th className="p-3">TAJUK UTAMA REDAKSI</th>
              <th className="p-3">DESK / KATEGORI</th>
              <th className="p-3">JENIS SUMBER</th>
              <th className="p-3">SUMBER / URL</th>
              <th className="p-3">SLOT</th>
              <th className="p-3 text-right">TINDAKAN</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-150">
            {isLoading && (
              <tr>
                <td colSpan={7} className="p-8 text-center font-mono text-xs text-stone-500">
                  ⏳ Memuatkan data kandungan dari pangkalan data...
                </td>
              </tr>
            )}

            {!isLoading && filteredItems.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center font-serif text-stone-500 text-sm">
                  Tiada rekod kandungan ditemui mengikut kriteria carian.
                </td>
              </tr>
            )}

            {filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                <td className="p-3 font-mono text-[10px] text-stone-500 font-bold select-all">{item.id}</td>
                <td className="p-3 font-serif font-medium text-stone-900 max-w-xs truncate">{item.title}</td>
                <td className="p-3 font-mono text-[9px] uppercase font-bold text-[#802334] bg-stone-100 rounded px-2 py-0.5 w-max">
                  {item.desk || 'UMUM'}
                </td>
                <td className="p-3 font-mono">
                  {getSourceTypeBadge(item.sourceType)}
                </td>
                <td className="p-3 font-mono text-[10px] text-stone-600">
                  <div>{item.source || '-'}</div>
                  {item.url && item.url !== '#' && (
                    <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-[9px] truncate block max-w-[140px]">
                      {item.url}
                    </a>
                  )}
                </td>
                <td className="p-3 font-mono text-[10px] font-bold text-stone-700">
                  {item.slotIndex !== undefined ? `SLOT #${item.slotIndex}` : '-'}
                </td>
                <td className="p-3 text-right font-mono text-xs">
                  {item.url && item.url !== '#' ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-stone-900 hover:bg-stone-800 text-[#E9D8A6] px-2.5 py-1 rounded font-bold transition-colors inline-flex items-center gap-1"
                    >
                      <span>👁️ LIHAT SUMBER</span>
                    </a>
                  ) : (
                    <span className="text-stone-400 font-mono text-[10px]">TIADA URL</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContentLibraryConsole;
