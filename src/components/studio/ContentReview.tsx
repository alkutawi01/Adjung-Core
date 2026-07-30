import React, { useState, useEffect, useMemo } from 'react';
import { Save, Search } from 'lucide-react';

interface ContentItem {
  id: string;
  revisionId: number;
  slotIndex: number;
  seriesIndex: number;
  title: string;
  summary: string;
  desk: string;
  topik: string;
  source: string;
  url: string;
  imageUrl: string;
  slotCategory: string;
  createdAt: string;
  updatedAt: string;
  // status (2026-07-29, permintaan pemilik projek) — /api/system/content/all sentiasa pulangkan
  // medan ni (lihat IndeksConsole.tsx), sekadar tak pernah diisytihar di sini sebelum ni sebab
  // paparan ni tak pernah tapis ikut status. Nilai mentah lowercase (approved/pending/rejected/
  // archived) sama macam disimpan di editorial_revisions.
  status?: string;
  // summaryLong/note/originalDate (2026-07-29, permintaan pemilik projek) — /api/system/content/all
  // sentiasa pulangkan ketiga-tiga ni juga (lihat contentRoutes.js), tapi Paparan Teks Pukal
  // sebelum ni tak pernah papar/edit langsung — editor yang guna paparan pukal tak pernah nampak
  // Huraian Panjang/Nota/Tarikh Sumber wujud sama sekali, jadi medan tu senyap tak tersentuh.
  summaryLong?: string;
  note?: string;
  originalDate?: string;
}

// Serializes all items into the numbered "#slot-series" bulk-text format, editable in one textarea.
// Medan penuh (2026-07-29, permintaan pemilik projek) — sebelum ni cuma Tajuk/Huraian ringkas/
// Bidang/Topik/Sumber/URL, senyap buang Huraian Panjang/Nota/Tarikh Sumber terus daripada paparan
// ni (editor yang guna Paparan Teks Pukal tak pernah nampak medan tu wujud pun). UUID dipaparkan
// untuk konteks/audit sahaja — baris tu diabaikan semasa parse balik (identiti kandungan kekal
// ditentukan oleh nombor #Slot-Siri, bukan UUID, sama macam sebelum ni).
const buildBulkText = (items: ContentItem[]) => {
  const sorted = [...items].sort((a, b) => a.slotIndex - b.slotIndex || a.seriesIndex - b.seriesIndex);
  return sorted
    .map(item => {
      const num = `#${item.slotIndex + 1}-${item.seriesIndex}`;
      return [
        num,
        `UUID: ${item.id}`,
        `Tajuk: ${item.title}`,
        `Huraian: ${item.summary}`,
        `Huraian Panjang: ${item.summaryLong || ''}`,
        `Bidang: ${item.desk}`,
        `Topik: ${item.topik || ''}`,
        `Sumber: ${item.source}`,
        `URL: ${item.url}`,
        `Tarikh Sumber: ${item.originalDate || ''}`,
        `Nota: ${item.note || ''}`,
      ].join('\n');
    })
    .join('\n\n');
};

interface BulkParsedEntry {
  slotNumber: number;
  seriesNumber: number;
  title: string;
  summary: string;
  summaryLong: string;
  desk: string;
  topik: string;
  source: string;
  url: string;
  originalDate: string;
  note: string;
}

// Parses the bulk text back into per-entry fields, anchored on the "#slot-series" header line.
// "UUID:" sengaja TAK dihurai balik ke mana-mana — baris tu konteks/audit sahaja (lihat nota
// buildBulkText di atas), padanan semula ke item asal tetap guna nombor #Slot-Siri.
const parseBulkText = (text: string): BulkParsedEntry[] => {
  const blocks = text.split(/\n(?=#\d+-\d+\s*$)/m);
  const entries: BulkParsedEntry[] = [];
  for (const block of blocks) {
    const headerMatch = block.match(/^#(\d+)-(\d+)\s*$/m);
    if (!headerMatch) continue;
    const slotNumber = parseInt(headerMatch[1], 10);
    const seriesNumber = parseInt(headerMatch[2], 10);
    let title = '', summary = '', summaryLong = '', desk = '', topik = '', source = '', url = '', originalDate = '', note = '';
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Tajuk:')) title = trimmed.replace(/^Tajuk:\s*/i, '').trim();
      else if (trimmed.startsWith('Huraian Panjang:')) summaryLong = trimmed.replace(/^Huraian Panjang:\s*/i, '').trim();
      else if (trimmed.startsWith('Huraian:')) summary = trimmed.replace(/^Huraian:\s*/i, '').trim();
      else if (trimmed.startsWith('Bidang:')) desk = trimmed.replace(/^Bidang:\s*/i, '').trim();
      else if (trimmed.startsWith('Kategori:')) desk = trimmed.replace(/^Kategori:\s*/i, '').trim();
      else if (trimmed.startsWith('Topik:')) topik = trimmed.replace(/^Topik:\s*/i, '').trim();
      else if (trimmed.startsWith('Sumber:')) source = trimmed.replace(/^Sumber:\s*/i, '').trim();
      else if (trimmed.startsWith('URL:')) url = trimmed.replace(/^URL:\s*/i, '').trim();
      else if (trimmed.startsWith('Tarikh Sumber:')) originalDate = trimmed.replace(/^Tarikh Sumber:\s*/i, '').trim();
      else if (trimmed.startsWith('Nota:')) note = trimmed.replace(/^Nota:\s*/i, '').trim();
    }
    entries.push({ slotNumber, seriesNumber, title, summary, summaryLong, desk, topik, source, url, originalDate, note });
  }
  return entries;
};

// Dua paparan komponen ni kini duduk di DUA tempat berasingan dalam Editorium (2026-07-30,
// permintaan pemilik projek), bukan lagi dua butang togol dalam satu skrin:
//   - paparan="slot"  → tab "Slot" (senarai ikut slot: sunting/tambah/padam item)
//   - paparan="pukal" → sub-tab "Semakan Kandungan" (satu kotak teks besar, Ketua Editor sunting
//                        terus semua kandungan sekali gus)
export function ContentReview() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [bulkText, setBulkText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');

  // Penapis (2026-07-29, permintaan pemilik projek) — sama konsep macam Indeks (IndeksConsole.tsx):
  // Status, Bidang, Slot, Sumber. Terpakai pada KEDUA-DUA paparan (Senarai Slot & Teks Pukal), guna
  // SATU senarai `filteredItems` kongsi (lihat di bawah). Berbeza daripada Indeks: di sini tapisan
  // terus terpakai (tiada butang "Tapis" berasingan) — paparan ni dah kecil skopnya (tapisan >
  // pagination, bukan carian merentas beribu rekod), jadi lapisan Tapis-on-demand tak diperlukan.
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [deskFilter, setDeskFilter] = useState('Semua');
  const [slotFilter, setSlotFilter] = useState<number | 'Semua'>('Semua');
  const [sourceFilter, setSourceFilter] = useState('');
  // Bidang berdaftar (2026-07-29, permintaan pemilik projek) — dropdown BIDANG di sini mesti
  // sepadan peraturan sama macam IndeksConsole.tsx: HANYA bidang aktif berdaftar (activeBidangList,
  // terus daripada CategoryRegistry), bukan disenaraikan daripada kandungan sedia ada (yang boleh
  // bawa nama bidang lama/dimansuhkan). Kandungan lama guna bidang mansuh kekal boleh dijumpai
  // melalui kotak CARIAN teks bebas di atas (dah padan i.desk, lihat filteredItems) — sengaja
  // TIADA kumpulan "Mansuh" berasingan di sini (tak macam Indeks) sebab paparan ni skop
  // penyuntingan, bukan audit; carian sedia ada dah cukup untuk jumpa kandungan tu.
  const [activeBidangListCR, setActiveBidangListCR] = useState<string[]>([]);

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

  useEffect(() => {
    loadItems();
    fetch('/api/system/categories/active')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setActiveBidangListCR(data.map((c: any) => c.name).sort()); })
      .catch(e => console.error('Error fetching active Bidang:', e));
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          i.title?.toLowerCase().includes(q) ||
          i.summary?.toLowerCase().includes(q) ||
          i.desk?.toLowerCase().includes(q) ||
          i.source?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (statusFilter !== 'Semua' && i.status !== statusFilter) return false;
      if (deskFilter !== 'Semua' && (i.desk || '').toLowerCase() !== deskFilter.toLowerCase()) return false;
      if (slotFilter !== 'Semua' && i.slotIndex !== slotFilter) return false;
      if (sourceFilter.trim() && !(i.source || '').toLowerCase().includes(sourceFilter.trim().toLowerCase())) return false;
      return true;
    });
  }, [items, searchQuery, statusFilter, deskFilter, slotFilter, sourceFilter]);

  const sourceOptionsCR = useMemo(() => Array.from(new Set(items.map(i => i.source).filter(Boolean))).sort(), [items]);
  const slotOptionsCR = useMemo(() => {
    const uniqueSlots: number[] = Array.from(new Set(items.map(i => i.slotIndex)));
    return uniqueSlots.sort((a, b) => a - b);
  }, [items]);

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

  // Had paparan (2026-07-29, permintaan pemilik projek) — 100 setiap halaman, sama macam Indeks
  // (IndeksConsole.tsx PAGE_SIZE) — supaya kedua-dua paparan tak pernah proses/render kandungan
  // tapisan PENUH sekali gus tanpa mengira berapa banyak rekod. Senarai Slot dihadkan ikut
  // BILANGAN SLOT dipaparkan (unit semula jadi paparan tu — setiap slot dah kumpulan tersendiri);
  // Teks Pukal dihadkan ikut BILANGAN KANDUNGAN (unit paparan tu — satu senarai rata bernombor).
  const PAGE_SIZE = 100;
  const [bulkPage, setBulkPage] = useState(1);
  useEffect(() => { setBulkPage(1); }, [filteredItems]);

  const sortedFilteredItems = useMemo(
    () => [...filteredItems].sort((a, b) => a.slotIndex - b.slotIndex || a.seriesIndex - b.seriesIndex),
    [filteredItems]
  );
  const bulkTotalPages = Math.max(1, Math.ceil(sortedFilteredItems.length / PAGE_SIZE));
  const pagedBulkItems = useMemo(
    () => sortedFilteredItems.slice((bulkPage - 1) * PAGE_SIZE, bulkPage * PAGE_SIZE),
    [sortedFilteredItems, bulkPage]
  );

  // Re-sync the bulk textarea whenever we switch into bulk view (or the filtered/paged set
  // changes underneath it), so it never shows stale text from before a card-view edit/delete/add,
  // a filter change, or a page change. `pagedBulkItems` (bukan `items` penuh, 2026-07-29) — lihat
  // nota PAGE_SIZE di atas.
  useEffect(() => {
    setBulkText(buildBulkText(pagedBulkItems));
    setBulkStatus('');
  }, [pagedBulkItems]);

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
          p.summaryLong !== (original.summaryLong || '') ||
          p.desk !== original.desk ||
          p.topik !== (original.topik || '') ||
          p.source !== original.source ||
          p.url !== original.url ||
          p.originalDate !== (original.originalDate || '') ||
          p.note !== (original.note || '')
        )
      );

    if (changed.length === 0) {
      setBulkStatus('Tiada perubahan dikesan.');
      setBulkSaving(false);
      return;
    }

    let done = 0;
    let failed = 0;
    let lastErrorMsg = '';

    for (const { p, original } of changed) {
      setBulkStatus(`Menyimpan ${done + failed + 1}/${changed.length}...`);
      try {
        const res = await fetch(`/api/system/content/${original.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: p.title, summary: p.summary, briefLong: p.summaryLong, desk: p.desk, topik: p.topik,
            source: p.source, url: p.url, originalDate: p.originalDate, note: p.note,
          })
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `Ralat menyimpan entri #${p.slotNumber}-${p.seriesNumber}`);
        }
        done++;
      } catch (err: any) {
        failed++;
        lastErrorMsg = err.message || `Ralat pada entri #${p.slotNumber}-${p.seriesNumber}`;
      }
    }

    if (failed > 0) {
      setBulkStatus(`Penyimpanan selesai sebahagian: ${done} disimpan, ${failed} gagal. Ralat: ${lastErrorMsg}`);
    } else {
      setBulkStatus(`Selesai: ${done} kandungan berjaya dikemas kini.`);
    }
    loadItems();
    setBulkSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans">
      <header className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="font-serif text-lg font-bold text-[#802334]">
              Semakan Kandungan
            </h1>
            <p className="text-[10px] text-stone-500 font-sans uppercase tracking-wider font-bold mt-0.5">
              {filteredItems.length} daripada {items.length} item · {slotIndexes.length} slot lepas tapisan
            </p>
          </div>
        </div>
        {/* Penapis + carian (2026-07-29) — terpakai pada KEDUA-DUA paparan (dulu carian sahaja,
            hanya untuk Senarai Slot) — lihat nota filteredItems/statusFilter/dll. di atas. */}
        <div className="max-w-5xl mx-auto px-4 md:px-8 pb-4 space-y-3">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-sans text-xs font-semibold"
            >
              <option value="Semua">Semua Status</option>
              <option value="pending">Menunggu</option>
              <option value="approved">Aktif</option>
              <option value="archived">Arkib</option>
            </select>
            <select
              value={deskFilter}
              onChange={e => setDeskFilter(e.target.value)}
              className="bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-sans text-xs font-semibold"
            >
              <option value="Semua">Semua Bidang</option>
              {activeBidangListCR.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              value={slotFilter}
              onChange={e => setSlotFilter(e.target.value === 'Semua' ? 'Semua' : Number(e.target.value))}
              className="bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-sans text-xs font-semibold"
            >
              <option value="Semua">Semua Slot</option>
              {slotOptionsCR.map(s => <option key={s} value={s}>{s === -1 ? 'Ticker' : `Slot ${s + 1}`}</option>)}
            </select>
            {/* TIADA <datalist> di sini (2026-07-29, permintaan pemilik projek) — medan ni duduk
                dalam header `sticky` (lihat <header> di bawah); cadangan native <datalist> ada
                pepijat pelayar dikenali (Chromium) apabila induknya `position: sticky` dan halaman
                dah tatal — anak tetingkap cadangan terpaut pada kedudukan ASAL elemen (sebelum
                tatal), bukan kedudukan sebenar semasa "melekat". sourceOptionsCR (senarai
                cadangan) tak lagi digunakan di sini akibat ni — carian teks bebas (padanan
                separa, lihat filteredItems) kekal berfungsi, cuma tiada dropdown cadangan. Medan
                serupa di IndeksConsole.tsx (bukan dalam header sticky) kekal guna <datalist>. */}
            <input
              type="text"
              placeholder="Cari sumber…"
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-sans text-xs font-semibold"
            />
          </div>
        </div>
      </header>

        <main className="max-w-5xl mx-auto px-4 md:px-8 py-6">
          <p className="text-[10px] text-stone-500 font-sans leading-normal mb-2">
            Setiap entri bermula dengan nombor <code className="font-mono bg-stone-100 px-1 rounded">#Slot-Siri</code> (cth <code className="font-mono bg-stone-100 px-1 rounded">#1-1</code> = Slot 1, siri 1).
            Sunting terus dalam kotak ini (termasuk markdown <code className="font-mono bg-stone-100 px-1 rounded">*italic*</code> jika perlu), kemudian klik "Simpan Pukal".
            Paparan ini untuk sunting kandungan sedia ada sahaja — tambah/padam item dibuat di tab "Slot".
            {bulkTotalPages > 1 && ` Menunjukkan ${pagedBulkItems.length} daripada ${sortedFilteredItems.length} kandungan lepas tapisan (had ${PAGE_SIZE} setiap halaman).`}
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
              {bulkTotalPages > 1 && (
                <div className="flex items-center justify-between gap-3 pt-3 font-sans text-xs">
                  <button
                    type="button" onClick={() => setBulkPage(p => Math.max(1, p - 1))} disabled={bulkPage === 1}
                    className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    ← Sebelum
                  </button>
                  <span className="text-stone-500">Halaman <strong className="font-mono font-bold text-stone-800">{bulkPage}</strong> daripada <strong className="font-mono font-bold text-stone-800">{bulkTotalPages}</strong></span>
                  <button
                    type="button" onClick={() => setBulkPage(p => Math.min(bulkTotalPages, p + 1))} disabled={bulkPage === bulkTotalPages}
                    className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Seterusnya →
                  </button>
                </div>
              )}
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
    </div>
  );
}
