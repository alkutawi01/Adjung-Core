import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Save, Search, Copy, Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../common/Button';
import { MesejStatus } from '../common/MesejStatus';

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
// ni (editor yang guna Paparan Teks Pukal tak pernah nampak medan tu wujud pun). Nombor #Slot-Siri
// kekal sebagai LABEL paparan (mudah diimbas manusia); UUID (2026-08-02, Fasa 2) kini kunci
// PADANAN sebenar semasa simpan — lihat nota di parseBulkText/saveBulk.
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
  uuid: string;
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
// 2026-08-02 (Fasa 2, pepijat kritikal) — "UUID:" DAHULU sengaja tak dihurai balik, padanan
// semula ke item asal guna nombor #Slot-Siri (kedudukan ordinal) SAHAJA. Kalau kandungan lain
// dalam slot yang sama diarkib/ditambah oleh SESIAPA SAHAJA antara masa teks ni dimuat dan
// disimpan, nombor siri bergeser — dan simpan pukal akan menampal perubahan pada ARTIKEL YANG
// SALAH tanpa amaran. UUID (dah pun dipaparkan, cuma tak digunakan) ialah identiti STABIL yang
// betul-betul patut jadi kunci padanan; nombor #Slot-Siri kekal sebagai label paparan sahaja.
// Label dikenali (2026-08-16, pepijat kritikal Izzat — "cuba betulkan pemerengganan huraian
// panjang... lepas tekan simpan pukal ia reset kepada yg asal semula") — dipakai SEBELUM parser
// utama untuk kesan baris SAMBUNGAN medan berbilang-baris (Huraian/Huraian Panjang/Nota).
const LABEL_BULK_DIKENALI = [
  'UUID:', 'Tajuk:', 'Huraian Panjang:', 'Huraian:', 'Bidang:', 'Kategori:', 'Topik:',
  'Sumber:', 'URL:', 'Tarikh Sumber:', 'Nota:',
];
const adaLabelBulkDikenali = (t: string) => LABEL_BULK_DIKENALI.some((l) => t.toLowerCase().startsWith(l.toLowerCase()));
const MEDAN_BULK_BERBILANG_BARIS = new Set(['summary', 'summaryLong', 'note']);

const parseBulkText = (text: string): BulkParsedEntry[] => {
  const blocks = text.split(/\n(?=#\d+-\d+\s*$)/m);
  const entries: BulkParsedEntry[] = [];
  for (const block of blocks) {
    const headerMatch = block.match(/^#(\d+)-(\d+)\s*$/m);
    if (!headerMatch) continue;
    const slotNumber = parseInt(headerMatch[1], 10);
    const seriesNumber = parseInt(headerMatch[2], 10);
    const medan: Record<string, string> = { uuid: '', title: '', summary: '', summaryLong: '', desk: '', topik: '', source: '', url: '', originalDate: '', note: '' };
    // medanSemasa (2026-08-16) — SEBELUM ni parser ni TIADA konsep medan berbilang-baris
    // langsung: "Huraian Panjang:" cuma tangkap SATU baris (baris label itu sendiri), setiap
    // baris SAMBUNGAN (perenggan kedua, ketiga) jatuh melalui SEMUA else-if tanpa padan mana-mana
    // label lalu HILANG SENYAP — bukan cuma paparan reset, "Simpan Pukal" hantar versi
    // TERPANGKAS (perenggan pertama sahaja) ke server, kehilangan data sebenar kalau save
    // berjaya. Corak sama macam pembetulan pepijat #21 ManualBlockFormat.js (fail berasingan,
    // format berbeza, tapi punca serupa: label dikesan, sambungan tak dikendali).
    let medanSemasa: string | null = null;
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (medanSemasa && MEDAN_BULK_BERBILANG_BARIS.has(medanSemasa) && !adaLabelBulkDikenali(trimmed)) {
        medan[medanSemasa] += '\n' + trimmed;
        continue;
      }
      medanSemasa = null;
      if (trimmed.startsWith('UUID:')) medan.uuid = trimmed.replace(/^UUID:\s*/i, '').trim();
      else if (trimmed.startsWith('Tajuk:')) medan.title = trimmed.replace(/^Tajuk:\s*/i, '').trim();
      else if (trimmed.startsWith('Huraian Panjang:')) { medan.summaryLong = trimmed.replace(/^Huraian Panjang:\s*/i, '').trim(); medanSemasa = 'summaryLong'; }
      else if (trimmed.startsWith('Huraian:')) { medan.summary = trimmed.replace(/^Huraian:\s*/i, '').trim(); medanSemasa = 'summary'; }
      else if (trimmed.startsWith('Bidang:')) medan.desk = trimmed.replace(/^Bidang:\s*/i, '').trim();
      else if (trimmed.startsWith('Kategori:')) medan.desk = trimmed.replace(/^Kategori:\s*/i, '').trim();
      else if (trimmed.startsWith('Topik:')) medan.topik = trimmed.replace(/^Topik:\s*/i, '').trim();
      else if (trimmed.startsWith('Sumber:')) medan.source = trimmed.replace(/^Sumber:\s*/i, '').trim();
      else if (trimmed.startsWith('URL:')) medan.url = trimmed.replace(/^URL:\s*/i, '').trim();
      else if (trimmed.startsWith('Tarikh Sumber:')) medan.originalDate = trimmed.replace(/^Tarikh Sumber:\s*/i, '').trim();
      else if (trimmed.startsWith('Nota:')) { medan.note = trimmed.replace(/^Nota:\s*/i, '').trim(); medanSemasa = 'note'; }
    }
    // Kemas ekor baris kosong tertinggal (cth "Huraian Panjang: ...\n\nBidang: X" tinggalkan '\n'
    // berlebihan di hujung) — sempadan perenggan DALAM teks kekal utuh, cuma ekor dipangkas.
    for (const m of MEDAN_BULK_BERBILANG_BARIS) medan[m] = medan[m].replace(/\s+$/, '');
    entries.push({
      slotNumber, seriesNumber, uuid: medan.uuid, title: medan.title, summary: medan.summary,
      summaryLong: medan.summaryLong, desk: medan.desk, topik: medan.topik, source: medan.source,
      url: medan.url, originalDate: medan.originalDate, note: medan.note,
    });
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
  // Elak mesej "Selesai: N disimpan" terpadam serta-merta (2026-08-16, permintaan Izzat + audit
  // ChatGPT — "tak ada notification ke lepas tekan butang ni?") — punca SEBENAR bukan mesej tak
  // wujud, tapi ia dipadam sistem SENDIRI: saveBulk() panggil loadItems() (bukan await) selepas
  // set mesej selesai; bila fetch tu sampai, `items` berubah, `pagedBulkItems` terbitan berubah,
  // useEffect di bawah (reset bulkText+bulkStatus bila set kandungan berubah) tercetus dan
  // KOSONGKAN bulkStatus dalam masa singkat (satu round-trip rangkaian) — editor tak sempat nampak
  // mesej sebelum ia hilang. Bendera ni langkau SATU kali reset tu (selepas save), bukan
  // lumpuhkan reset untuk kes lain (tukar penapis/halaman, yang MEMANG patut kosongkan status).
  const langkauResetStatusRef = useRef(false);

  // Perpustakaan Prompt Semakan (REVIEW-01, ChatGPT + spesifikasi Izzat 2026-08-08) — Ketua
  // Editor tampal kandungan pukal di atas ke chatbox AI LUARAN (ChatGPT/Gemini/dll.) utk
  // dibetulkan, bukan disunting terus dalam sistem. Perpustakaan ni sekadar arahan/prompt
  // bernama yang boleh diklik salin ke papan klip — bukan pipeline AI (lihat
  // core/routes/contentRoutes.js POST /semakan-prompts utk sebab guna jadual berasingan
  // drpd masterPrompt/reviewPrompt).
  const [promptSemakan, setPromptSemakan] = useState<{ id: string; name: string; templateText: string }[]>([]);
  const [promptPanelTerbuka, setPromptPanelTerbuka] = useState(false);
  const [promptDisalin, setPromptDisalin] = useState<string | null>(null);
  const [namaPromptBaharu, setNamaPromptBaharu] = useState('');
  const [teksPromptBaharu, setTeksPromptBaharu] = useState('');
  const [menyimpanPrompt, setMenyimpanPrompt] = useState(false);
  // Ralat kelihatan (PROMPT-01, audit ChatGPT 2026-08-08) — dahulu SEMUA kegagalan (muat/simpan/
  // padam/salin) senyap ke console.error sahaja, tiada mesej nampak kepada pengguna.
  const [ralatPrompt, setRalatPrompt] = useState('');

  const muatPromptSemakan = () => {
    fetch('/api/system/semakan-prompts')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setPromptSemakan(data); })
      .catch(e => { console.error('Error fetching semakan prompts:', e); setRalatPrompt('Gagal memuatkan senarai prompt.'); });
  };

  const salinPrompt = async (p: { id: string; templateText: string }) => {
    setRalatPrompt('');
    try {
      await navigator.clipboard.writeText(p.templateText);
      setPromptDisalin(p.id);
      setTimeout(() => setPromptDisalin(cur => (cur === p.id ? null : cur)), 2000);
    } catch (e) {
      console.error('Gagal menyalin prompt ke papan klip:', e);
      setRalatPrompt('Gagal menyalin ke papan klip. Sunting/salin terus dari kandungan prompt di bawah.');
    }
  };

  const simpanPromptBaharu = async () => {
    if (!namaPromptBaharu.trim() || !teksPromptBaharu.trim()) return;
    setMenyimpanPrompt(true);
    setRalatPrompt('');
    try {
      const res = await fetch('/api/system/semakan-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: namaPromptBaharu.trim(), templateText: teksPromptBaharu.trim() }),
      });
      if (!res.ok) throw new Error();
      setNamaPromptBaharu('');
      setTeksPromptBaharu('');
      muatPromptSemakan();
    } catch (e) {
      console.error('Gagal menyimpan prompt semakan:', e);
      setRalatPrompt('Prompt gagal disimpan.');
    } finally {
      setMenyimpanPrompt(false);
    }
  };

  const padamPrompt = async (id: string) => {
    setRalatPrompt('');
    try {
      const res = await fetch(`/api/system/semakan-prompts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setPromptSemakan(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      console.error('Gagal memadam prompt semakan:', e);
      setRalatPrompt('Prompt gagal dipadam.');
    }
  };

  // Penapis (2026-07-29, permintaan pemilik projek) — sama konsep macam Indeks (IndeksConsole.tsx):
  // Status, Bidang, Slot, Sumber. Terpakai pada KEDUA-DUA paparan (Senarai Slot & Teks Pukal), guna
  // SATU senarai `filteredItems` kongsi (lihat di bawah). Berbeza daripada Indeks: di sini tapisan
  // terus terpakai (tiada butang "Tapis" berasingan) — paparan ni dah kecil skopnya (tapisan >
  // pagination, bukan carian merentas beribu rekod), jadi lapisan Tapis-on-demand tak diperlukan.
  // Tapisan LALAI (2026-08-16, permintaan Izzat: "jadikan tapisan default: aktif, semua selain
  // ticker") — dahulu "Semua Status"/"Semua Slot" (termasuk Ticker), jadi paparan pertama borang
  // ni bercampur draf/arkib/Ticker sekali gus, tak sepadan tujuan sebenar "Semakan Kandungan"
  // (semak kandungan AKTIF sedia ada, bukan Ticker — item Ticker terlalu banyak/kerap berubah
  // untuk semakan pukal macam ni). "Semua Slot" (termasuk Ticker) KEKAL sebagai pilihan eksplisit
  // dalam dropdown, editor boleh tukar bila-bila kalau memang nak semak Ticker.
  const [statusFilter, setStatusFilter] = useState('approved');
  const [deskFilter, setDeskFilter] = useState('Semua');
  const [slotFilter, setSlotFilter] = useState<number | 'Semua' | 'SemuaBukanTicker'>('SemuaBukanTicker');
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
    muatPromptSemakan();
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
      if (slotFilter === 'SemuaBukanTicker') {
        if (i.slotIndex === -1) return false;
      } else if (slotFilter !== 'Semua' && i.slotIndex !== slotFilter) return false;
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
    if (langkauResetStatusRef.current) {
      langkauResetStatusRef.current = false;
    } else {
      setBulkStatus('');
    }
  }, [pagedBulkItems]);

  // Bulk save: edit-only. Matches each block back to its original item VIA UUID (identiti stabil
  // — lihat nota di parseBulkText), bukan lagi nombor #Slot-Siri ordinal. Blok yang UUID-nya tak
  // sepadan mana-mana item semasa (baris UUID dipadam tanpa sengaja, atau item tu dah diarkib oleh
  // orang lain) diabaikan senyap — lebih selamat daripada meneka guna kedudukan dan menyimpan ke
  // artikel yang salah.
  const saveBulk = async () => {
    setBulkSaving(true);
    setBulkStatus('Menghurai teks...');
    const parsed = parseBulkText(bulkText);
    const byId: Record<string, ContentItem> = {};
    items.forEach(i => { byId[i.id] = i; });

    const changed = parsed
      .map(p => ({ p, original: byId[p.uuid] }))
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
    for (const { p, original } of changed) {
      setBulkStatus(`Menyimpan ${done + failed + 1}/${changed.length}...`);
      try {
        const res = await fetch(`/api/system/content/${original.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Nama medan API ialah 'briefLong' (attributeId sebenar, lihat contentRoutes.js) —
            // p.summaryLong ialah nama medan client-side sahaja.
            title: p.title, summary: p.summary, briefLong: p.summaryLong, desk: p.desk, topik: p.topik,
            source: p.source, url: p.url, originalDate: p.originalDate, note: p.note,
          })
        });
        if (!res.ok) throw new Error();
        done++;
      } catch {
        failed++;
      }
    }

    // "Gagal" bukan "Selesai" bila SIFAR berjaya (2026-08-16, audit ChatGPT — "jangan laporkan
    // berjaya jika backend gagal") — "Selesai: 0 disimpan, 3 gagal" berbunyi macam kejayaan
    // separa walhal tiada satu pun berjaya.
    setBulkStatus(
      done === 0 && failed > 0
        ? `Gagal: ${failed} kandungan tidak dapat disimpan. Sila cuba semula.`
        : `Selesai: ${done} disimpan${failed > 0 ? `, ${failed} gagal` : ''}.`
    );
    langkauResetStatusRef.current = true;
    loadItems();
    setBulkSaving(false);
  };

  return (
    <div className="min-h-screen bg-[var(--color-Adjung-cream)] font-sans">
      <header className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="font-serif text-lg font-bold text-[var(--color-Adjung-maroon)]">
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
              placeholder="Cari ikut tajuk, huraian, kategori, atau sumber…"
              className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[var(--color-Adjung-maroon)] bg-white text-xs"
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
              onChange={e => setSlotFilter(
                e.target.value === 'Semua' || e.target.value === 'SemuaBukanTicker'
                  ? e.target.value
                  : Number(e.target.value)
              )}
              className="bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-sans text-xs font-semibold"
            >
              <option value="SemuaBukanTicker">Semua Slot (kecuali Ticker)</option>
              <option value="Semua">Semua Slot (termasuk Ticker)</option>
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

          <div className="border border-stone-200 rounded mb-4 bg-stone-50">
            <button
              type="button"
              onClick={() => setPromptPanelTerbuka(v => !v)}
              aria-expanded={promptPanelTerbuka}
              aria-controls="panel-prompt-semakan"
              className="w-full flex items-center justify-between gap-2 px-3 py-2 font-sans text-xs font-semibold text-stone-700 cursor-pointer"
            >
              <span>Prompt Semakan (salin ke chatbox AI luaran)</span>
              {promptPanelTerbuka ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {promptPanelTerbuka && (
              <div id="panel-prompt-semakan" className="px-3 pb-3 space-y-3">
                <p className="text-[10px] text-stone-500 font-sans leading-normal">
                  Salin kandungan dalam kotak di bawah, tampal di chatbox AI (ChatGPT/Gemini/dll.) bersama satu prompt di bawah, kemudian tampal semula hasil yang dibetulkan.
                </p>
                {ralatPrompt && <MesejStatus tone="error" onCubaLagi={muatPromptSemakan}>{ralatPrompt}</MesejStatus>}
                {promptSemakan.length === 0 ? (
                  <p className="text-[11px] text-stone-500 font-sans italic">Tiada prompt disimpan lagi.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {promptSemakan.map(p => (
                      <li key={p.id} className="flex items-center gap-2 bg-white border border-stone-200 rounded px-2.5 py-1.5">
                        <span className="flex-1 min-w-0 font-sans text-xs font-semibold text-stone-800 truncate" title={p.templateText}>
                          {p.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => salinPrompt(p)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-stone-300 font-sans text-[10px] font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                        >
                          {promptDisalin === p.id ? <><Check size={11} /> Disalin</> : <><Copy size={11} /> Salin</>}
                        </button>
                        <button
                          type="button"
                          onClick={() => padamPrompt(p.id)}
                          aria-label={`Padam prompt ${p.name}`}
                          className="text-stone-400 hover:text-[#a8241f] cursor-pointer p-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t border-stone-200 pt-3 space-y-2">
                  <input
                    type="text"
                    value={namaPromptBaharu}
                    onChange={e => setNamaPromptBaharu(e.target.value)}
                    placeholder="Nama prompt (cth: Betulkan ejaan Melayu baku)"
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded font-sans text-xs focus:outline-none focus:border-[var(--color-Adjung-maroon)]"
                  />
                  <textarea
                    value={teksPromptBaharu}
                    onChange={e => setTeksPromptBaharu(e.target.value)}
                    rows={2}
                    placeholder="Kandungan prompt (cth: Sila betulkan semua ejaan mengikut ejaan bahasa Melayu baku)"
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded font-sans text-xs focus:outline-none focus:border-[var(--color-Adjung-maroon)]"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={simpanPromptBaharu}
                      disabled={menyimpanPrompt || !namaPromptBaharu.trim() || !teksPromptBaharu.trim()}
                    >
                      {menyimpanPrompt ? 'Menyimpan...' : 'Simpan Prompt'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <p className="text-xs text-stone-500 text-center py-12">Memuatkan…</p>
          ) : (
            <>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={30}
                className="w-full px-3 py-3 border border-stone-300 rounded focus:outline-none focus:border-[var(--color-Adjung-maroon)] bg-white font-mono text-xs leading-relaxed"
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
                {/* Ketara secara visual (2026-08-16, audit ChatGPT — "tak ada notification ke
                    lepas tekan butang ni?") — SEBELUM ni 10px kelabu senyap, mudah terlepas
                    pandang walaupun tak dipadam awal (bug di atas). Warna ikut keputusan: hijau
                    (semua berjaya), merah (ada gagal/gagal semua), kelabu neutral (dlm proses). */}
                <span className={`text-xs font-sans font-semibold ${
                  bulkStatus.startsWith('Gagal') || bulkStatus.includes(', ') && bulkStatus.includes('gagal')
                    ? 'text-[#a8241f]'
                    : bulkStatus.startsWith('Selesai')
                    ? 'text-emerald-700'
                    : 'text-stone-500'
                }`}>{bulkStatus}</span>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={saveBulk}
                  disabled={bulkSaving}
                  icon={<Save size={13} />}
                >
                  {bulkSaving ? 'Menyimpan...' : 'Simpan Pukal'}
                </Button>
              </div>
            </>
          )}
        </main>
    </div>
  );
}
