import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, Search, Copy, Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import { MesejStatus } from '../common/MesejStatus';
import { tanganiKekunciItalic } from '../../utils.tsx';
import { bacaJsonSelamat } from '../../utils/bacaJson';

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
//
// PEMBETULAN (2026-09-01, dapatan Izzat — "Susunan: Paling Baharu -> Paling Lama" langsung tak
// beri kesan pada teks yang dipaparkan). Punca: fungsi ni dahulu SENTIASA susun semula ikut
// slotIndex/seriesIndex sendiri (tanpa mengira urutan `items` yang dihantar pemanggil), jadi
// pilihan "Susunan" di UI (sortedFilteredItems/pagedBulkItems, dikira betul di komponen induk)
// dibuang senyap sebaik tiba di sini — teks SENTIASA papar ikut kedudukan slot/siri asal, tak
// kira apa dipilih editor. Fungsi ni kini PERCAYA urutan `items` sepenuhnya (pemanggil, bukan
// fungsi ni, yang bertanggungjawab menyusun) — SATU sumber urutan, bukan dua yang bercanggah.
const buildBulkText = (items: ContentItem[]) => {
  return items
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

// Auto-baiki URL dibalut format pautan Markdown (2026-09-02, dapatan Izzat — "chatgpt asyik
// ulang kesilapan yg sama") — walaupun Arahan AI Perpustakaan Prompt Semakan minta URL MENTAH
// sahaja pada medan "URL:", model AI (ChatGPT dsb.) kerap tetap tulis `[url](url)` gaya pautan
// Markdown (tabiat model, bukan salah arahan — nampaknya sukar dielak sepenuhnya lewat prompting
// sahaja, disahkan berulang kali dgn output sebenar). Server (validateSourceUrl, ContentBudget.js)
// betul-betul TOLAK bentuk ni (`new URL()` gagal hurai kurungan+kurungan siku), Simpan Pukal
// gagal senyap seolah-olah URL tu "rosak" walhal URL sebenar DI DALAM teks tu sah. Dibetulkan di
// PARSER (bukan tunggu validation gagal) — kesan corak `[label](https://...)` dan ekstrak URL
// dalam kurungan sahaja, jadi kesilapan berulang model AI dibetulkan senyap tanpa perlu editor
// perasan/salin-tampal manual setiap kali.
const ekstrakUrlMentah = (v: string): string => {
  // PEMBETULAN SUSULAN (2026-09-02, Izzat tangkap kes lebih teruk masih gagal selepas pembetulan
  // pertama) — corak asal diikat ke HUJUNG teks (`\)\s*$`), cuma betulkan `[url](url)` BERSIH.
  // Tapi model AI kadang tambah serpihan lain SELEPAS pautan Markdown (cth pecahan slug/deskripsi
  // tertinggal daripada penyalinan tak kemas — "...(url) Tajuk, huraian... slug-fragmen/"),
  // corak lama gagal padan sebab bukan lagi di hujung. Regex kini cari corak pautan Markdown
  // DI MANA-MANA dalam teks (tak diikat ke hujung), ambil URL dalam kurungan bulat SAHAJA —
  // apa-apa sebelum/selepas tu (label pendua, serpihan tertinggal) diabaikan terus, sebab
  // ia bukan sebahagian URL sebenar.
  const md = v.match(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/i);
  return md ? md[1] : v;
};

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
      else if (trimmed.startsWith('URL:')) medan.url = ekstrakUrlMentah(trimmed.replace(/^URL:\s*/i, '').trim());
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

  // Pautan pantas "Edit kandungan ini" dari frontpage/Focus View (2026-08-17, Izzat) — pensel
  // kad hantar ?itemId=<UUID>, isi kotak carian sedia ada terus dengan UUID tu (bukan laluan
  // penapis baharu — carian teks bebas dah padan i.id, lihat filteredItems di bawah, jadi UUID
  // unik automatik mengasingkan SATU kandungan sahaja). `modeSatuItem` (itemId wujud di URL)
  // tukar label butang "Simpan Pukal" -> "Simpan" (Izzat: "yg semakan kandungan tu boleh je
  // semak satu item. cuma tukar 'simpan pukal' kepada 'simpan'") — tak kunci penapis lain,
  // editor tetap boleh padam/ubah carian bila-bila utk kembali ke paparan pukal biasa.
  const [searchParams] = useSearchParams();
  const itemIdDariUrl = searchParams.get('itemId');
  const modeSatuItem = !!itemIdDariUrl;
  useEffect(() => {
    if (itemIdDariUrl) setSearchQuery(itemIdDariUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIdDariUrl]);

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
      .catch(e => { console.error('Error fetching semakan prompts:', e); setRalatPrompt('Gagal memuatkan senarai Arahan AI.'); });
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
      // Baca ralat SEBENAR daripada pelayan sebelum lempar (2026-09-02, dapatan bug-hunt — corak
      // sama seperti simpanBulk() di fail ni: `throw new Error()` kosong sebelum ni buang mesej
      // sebab sebenar pelayan (cth nama pendua), editor cuma nampak "Prompt gagal disimpan"
      // generik tanpa cara tahu SEBAB — lihat peraturan am di CLAUDE.md ttg corak ni).
      if (!res.ok) {
        const data = await bacaJsonSelamat(res).catch(() => ({} as any));
        throw new Error(data?.error || 'Prompt gagal disimpan.');
      }
      setNamaPromptBaharu('');
      setTeksPromptBaharu('');
      muatPromptSemakan();
    } catch (e: any) {
      console.error('Gagal menyimpan prompt semakan:', e);
      setRalatPrompt(e?.message || 'Prompt gagal disimpan.');
    } finally {
      setMenyimpanPrompt(false);
    }
  };

  const padamPrompt = async (id: string) => {
    setRalatPrompt('');
    try {
      const res = await fetch(`/api/system/semakan-prompts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await bacaJsonSelamat(res).catch(() => ({} as any));
        throw new Error(data?.error || 'Prompt gagal dipadam.');
      }
      setPromptSemakan(prev => prev.filter(p => p.id !== id));
    } catch (e: any) {
      console.error('Gagal memadam prompt semakan:', e);
      setRalatPrompt(e?.message || 'Prompt gagal dipadam.');
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

  // Reset sourceFilter bila Slot ditukar KELUAR daripada Ticker (2026-08-16) — kotak sumber kini
  // hanya PAPAR bila Ticker dipilih (lihat JSX di bawah), tapi tanpa reset ni, tapisan sumber yang
  // ditetapkan semasa Ticker aktif kekal TERPAKAI SENYAP (filteredItems masih baca sourceFilter,
  // cuma kotaknya disorok) selepas ditukar ke slot lain — hasil tertapis tanpa kotak nampak
  // kenapa, mengelirukan.
  useEffect(() => {
    if (slotFilter !== -1 && sourceFilter) setSourceFilter('');
  }, [slotFilter]);

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
          i.source?.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q);
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

  // Sumber TICKER sahaja (2026-08-16, Izzat: "kotak sumber tu listkan dropdown sumber... ia
  // hanya muncul apabila slot ticker dipilih... sbb hanya ticker yg perlukannya sbb sumber dia
  // terhad"). Dahulu kotak teks bebas terpakai pada SEMUA slot (sumber kandungan bento
  // manual/AI hampir tak terhad — nama penerbit apa-apa editor taip), jadi dropdown tak
  // bermakna di situ. Ticker BERBEZA: sumbernya senarai RSS berdaftar TETAP/terhad (Bernama,
  // RTM, dll), jadi dropdown pilih-daripada-senarai lebih tepat drpd taip bebas. Dikira daripada
  // item TICKER SAHAJA (slotIndex -1), bukan `items` penuh — senarai kekal SAHIH sekecil sumber
  // yang benar-benar wujud dlm Ticker, bukan tersenarai sumber bento yang tak relevan sama sekali.
  const sourceOptionsCR = useMemo(
    () => Array.from(new Set(items.filter(i => i.slotIndex === -1).map(i => i.source).filter(Boolean))).sort(),
    [items]
  );
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

  // Had paparan BOLEH LARAS (2026-08-16, Izzat: "pagination semakan pukal tukar kepada ada
  // pilihan: 10, 20, dan 30 kandungan sahaja. sbb 50-100 terlalu banyak") — dahulu PEMALAR 100
  // tetap (2026-07-29), satu halaman boleh bawa 100 kandungan sekali gus dlm SATU kotak teks
  // besar (terus punca aduan "kenapa tak boleh scroll" sesi ni jugak — kotak jadi gergasi).
  // DIKETATKAN LAGI (2026-09-02, Izzat: "tukar bilangan kandungan... kepada 5, 10, dan 15. sbb
  // chatbot tak boleh proses input yg panjang") — kandungan pukal ditampal terus ke chatbox AI
  // luaran (Perpustakaan Prompt Semakan di atas), yang ada had panjang input praktikal; 20-30
  // kandungan sekali gus kadang terlebih untuk chatbot proses. Lalai 10 (nilai TENGAH).
  const [bulkPageSize, setBulkPageSize] = useState(10);
  const [bulkPage, setBulkPage] = useState(1);
  useEffect(() => { setBulkPage(1); }, [filteredItems, bulkPageSize]);

  // Susunan senarai BOLEH LARAS (2026-08-16, Izzat: "beri pilihan susunan 'paling baru-paling
  // lama' atau 'paling lama-paling baru', dan apa yg awak fikir editor perlukan"). Cadangan
  // tambahan saya: kekalkan "Ikut Slot" (susunan ASAL sedia ada, kumpul ikut kedudukan bento) —
  // sesetengah kerja (cth semak SATU Bidang slot demi slot secara sistematik) masih perlukan
  // susunan tu, bukan semua kerja mahukan susunan kronologi. Lalai "terbaru" (kandungan
  // diterbitkan PALING BAHARU dahulu) — susulan kerja semakan biasanya fokus kandungan terkini.
  // Tarikh diguna: createdAt (bila kandungan MULA diterbitkan), bukan updatedAt (bila terakhir
  // disunting) — Semakan Kandungan skop semakan KUALITI kandungan sedia ada secara am, bukan
  // "apa yg baru disunting", jadi tarikh penerbitan asal lebih bermakna sebagai isyarat "baharu".
  const [bulkSortOrder, setBulkSortOrder] = useState<'slot' | 'terbaru' | 'terlama'>('terbaru');

  const sortedFilteredItems = useMemo(() => {
    const arr = [...filteredItems];
    if (bulkSortOrder === 'terbaru') {
      arr.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else if (bulkSortOrder === 'terlama') {
      arr.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    } else {
      arr.sort((a, b) => a.slotIndex - b.slotIndex || a.seriesIndex - b.seriesIndex);
    }
    return arr;
  }, [filteredItems, bulkSortOrder]);
  const bulkTotalPages = Math.max(1, Math.ceil(sortedFilteredItems.length / bulkPageSize));
  const pagedBulkItems = useMemo(
    () => sortedFilteredItems.slice((bulkPage - 1) * bulkPageSize, bulkPage * bulkPageSize),
    [sortedFilteredItems, bulkPage, bulkPageSize]
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

  // Amaran "beforeunload" bila kotak teks pukal ada suntingan belum disimpan (2026-08-16,
  // soalan Izzat susulan pepijat "SISTEM BODOH" -- "kalau tak disimpan, adakah sistem akan bg
  // amaran kalau saya nak navigate ke modul lain?"). Jawapan jujur semasa ditanya: TIADA
  // langsung -- kotak teks pukal boleh hilang senyap kalau tab/pelayar ditutup atau di-refresh
  // sambil ada suntingan belum simpan (lebih genting SEKARANG selepas pembetulan di atas, sebab
  // suntingan yang gagal simpan KEKAL dalam kotak teks, bukan terpadam serentak macam dahulu).
  // `buildBulkText(pagedBulkItems)` ialah nilai "bersih" SEBENAR pada bila-bila masa (effect
  // resync di atas sentiasa tetapkan bulkText kepadanya bila items/halaman/tapisan berubah) --
  // banding terus dgn bulkText semasa, tiada state baseline berasingan diperlukan.
  //
  // Skop TERHAD kepada beforeunload (tutup pelayar/refresh/tutup tab) sahaja -- amaran bila
  // TUKAR TAB dalam Editorium sendiri (klik Draf Saya/Slot/dll di EditoriumLayout.tsx) perlukan
  // ubah kod navigasi DIKONGSI (kesan semua 12 tab, bukan cuma Semakan Kandungan ni), sengaja
  // TIDAK dibina sesi ni tanpa kelulusan eksplisit -- lihat CLAUDE.md "Bila teragak-agak".
  useEffect(() => {
    const kotor = bulkText !== buildBulkText(pagedBulkItems);
    if (!kotor) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [bulkText, pagedBulkItems]);

  // Garisan pemisah HALUS antara entri (2026-09-02, Izzat: "asingkan antara kandungan dlm
  // semakan kandungan dengan garisan halus, yg tak boleh dicopy paste") — kotak teks pukal ni
  // SATU <textarea> mentah (bukan berbilang elemen), jadi tak boleh sisip garisan SEBENAR ke
  // dalam nilai textarea (garisan tu akan tersalin sekali bila editor Select All + Copy ke
  // ChatGPT, mencemari prompt). Teknik: bekas overlay "cermin" (`bulkMirrorRef`) TERSEMBUNYI
  // (visibility:hidden, pointerEvents:none) dgn font/padding/lebar SAMA PERSIS textarea (corak
  // sama SenaraiSumberDesktop() di FocusView.tsx — ukur DOM sebenar, bukan agak), papar teks
  // SAMA dipecah pada setiap penanda "#Slot-Siri" (permulaan entri). offsetTop setiap penanda
  // selepas render SEBENAR jadi kedudukan garisan — garisan (elemen `<div>` KOSONG, bukan teks)
  // dilukis DI ATAS textarea (position:absolute), jadi ia kelihatan tapi TIADA nod teks utk
  // disalin sama sekali. Kekal SEGAR bila teks disunting (regex `#\d+-\d+` dikira semula setiap
  // `bulkText` berubah) atau lebar tetingkap berubah (ResizeObserver, wrap textarea boleh ubah).
  const bulkMirrorRef = useRef<HTMLDivElement>(null);
  const bulkPenandaRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [bulkGarisTop, setBulkGarisTop] = useState<number[]>([]);
  const [bulkScrollTop, setBulkScrollTop] = useState(0);
  const bulkSegmen = useMemo(() => {
    const penanda = [...bulkText.matchAll(/^#\d+-\d+/gm)];
    if (penanda.length <= 1) return [bulkText];
    const potongan: string[] = [];
    let mula = 0;
    for (const p of penanda.slice(1)) {
      potongan.push(bulkText.slice(mula, p.index));
      mula = p.index as number;
    }
    potongan.push(bulkText.slice(mula));
    return potongan;
  }, [bulkText]);
  useLayoutEffect(() => {
    const ukur = () => {
      const bekas = bulkMirrorRef.current;
      if (!bekas) return;
      const asas = bekas.getBoundingClientRect().top;
      setBulkGarisTop(
        bulkPenandaRefs.current
          .filter((el): el is HTMLSpanElement => !!el)
          .map((el) => el.getBoundingClientRect().top - asas)
      );
    };
    ukur();
    window.addEventListener('resize', ukur);
    return () => window.removeEventListener('resize', ukur);
  }, [bulkSegmen]);

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
    // Sebab kegagalan SEBENAR (2026-08-16, soalan Izzat: "kenapa tak boleh padam? ...dia kata
    // gagal simpan" — sebelum ni ralat pelayan SENYAP dibuang (`throw new Error()` kosong, catch
    // cuma kira `failed++`), jadi editor (dan Claude semasa siasat) tak nampak SEBAB sebenar
    // (contoh: had aksara minimum, Bidang tak sepadan slot, dsb) — cuma "gagal", kena teka. Kini
    // baca `error` sebenar daripada respons pelayan dan papar terus, ditanda dengan #Slot-Siri
    // blok yang gagal supaya editor tahu MANA satu, bukan cuma BERAPA banyak.
    const sebabGagal: string[] = [];
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
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          sebabGagal.push(`#${p.slotNumber}-${p.seriesNumber}: ${data.error || `HTTP ${res.status}`}`);
          throw new Error();
        }
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
        ? `Gagal: ${sebabGagal.join(' | ')}`
        : `Selesai: ${done} disimpan${failed > 0 ? `, ${failed} gagal (${sebabGagal.join(' | ')})` : ''}.`
    );
    // Jangan muat semula drpd pelayan bila ADA kegagalan (2026-08-16, kemarahan Izzat sah —
    // "SISTEM BODOH... saya kena tulis semula dan semula") — sebelum ni loadItems() dipanggil
    // TANPA SYARAT lepas setiap cubaan simpan, walau SEMUA gagal. loadItems() tukar rujukan
    // `items`/`pagedBulkItems`, tercetus effect resync di atas (setBulkText(buildBulkText(...))),
    // yang TULIS GANTI kotak teks dgn versi PELAYAN (tak berubah sebab simpan gagal) — suntingan
    // editor (termasuk bahagian yg GAGAL, yg dia baru cuba betulkan) HILANG SENYAP, kena taip
    // semula dari kosong. Kini cuma muat semula bila TIADA kegagalan langsung — kalau ada,
    // biarkan kotak teks kekal PERSIS macam yg editor taip (termasuk item yg berjaya, yg dah pun
    // padan pelayan sekarang), supaya dia boleh betulkan sebab kegagalan SAHAJA dan cuba lagi,
    // bukan tulis semula segala-galanya.
    if (failed === 0) {
      langkauResetStatusRef.current = true;
      loadItems();
    }
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
            {/* Dropdown, HANYA bila Ticker dipilih (2026-08-16, Izzat: "kotak sumber tu listkan
                dropdown sumber (bukan taip sendiri) dan ia hanya muncul apabila slot ticker
                dipilih... sbb hanya ticker yg perlukannya sbb sumber dia terhad"). Slot bento
                lain (manual/AI) sumbernya hampir tak terhad (editor taip nama penerbit apa-apa),
                jadi dropdown tak bermakna di situ — carian teks bebas di kotak carian utama di
                atas (dah padan sumber juga, lihat filteredItems) kekal cara cari sumber utk slot
                lain. Ganti kotak teks bebas LAMA sepenuhnya (bukan tambahan) — sourceOptionsCR
                kini genuine digunakan (dahulu dikira tapi buang tak dipakai selepas <datalist>
                dibuang 2026-07-29, lihat sejarah git). */}
            {slotFilter === -1 && (
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                className="bg-stone-50 border border-stone-300 rounded px-2.5 py-1.5 font-sans text-xs font-semibold"
              >
                <option value="">Semua Sumber Ticker</option>
                {sourceOptionsCR.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>
        </div>
      </header>

        <main className="max-w-5xl mx-auto px-4 md:px-8 py-6">
          <p className="text-[10px] text-stone-500 font-sans leading-normal mb-2">
            Setiap entri bermula dengan nombor <code className="font-mono bg-stone-100 px-1 rounded">#Slot-Siri</code> (cth <code className="font-mono bg-stone-100 px-1 rounded">#1-1</code> = Slot 1, siri 1).
            Sunting terus dalam kotak ini (termasuk markdown <code className="font-mono bg-stone-100 px-1 rounded">*italic*</code> jika perlu), kemudian klik "{modeSatuItem ? 'Simpan' : 'Simpan Pukal'}".
            Paparan ini untuk sunting kandungan sedia ada sahaja — tambah/padam item dibuat di tab "Slot".
            {` Menunjukkan ${pagedBulkItems.length} daripada ${sortedFilteredItems.length} kandungan lepas tapisan.`}
          </p>

          {/* Susunan + had paparan (2026-08-16, Izzat) — lihat nota lengkap di bulkPageSize/
              bulkSortOrder di atas fail ni utk sebab lalai/pilihan yang dibuat. */}
          <div className="flex flex-wrap items-center gap-2 mb-4 font-sans text-xs">
            <label className="flex items-center gap-1.5 text-stone-500">
              Susunan:
              <select
                value={bulkSortOrder}
                onChange={e => setBulkSortOrder(e.target.value as 'slot' | 'terbaru' | 'terlama')}
                className="bg-stone-50 border border-stone-300 rounded px-2 py-1 font-semibold"
              >
                <option value="terbaru">Paling Baharu → Paling Lama</option>
                <option value="terlama">Paling Lama → Paling Baharu</option>
                <option value="slot">Ikut Slot</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-stone-500">
              Setiap halaman:
              <select
                value={bulkPageSize}
                onChange={e => setBulkPageSize(Number(e.target.value))}
                className="bg-stone-50 border border-stone-300 rounded px-2 py-1 font-semibold"
              >
                <option value={5}>5 kandungan</option>
                <option value={10}>10 kandungan</option>
                <option value={15}>15 kandungan</option>
              </select>
            </label>
          </div>

          <div className="border border-stone-200 rounded mb-4 bg-stone-50">
            <button
              type="button"
              onClick={() => setPromptPanelTerbuka(v => !v)}
              aria-expanded={promptPanelTerbuka}
              aria-controls="panel-prompt-semakan"
              className="w-full flex items-center justify-between gap-2 px-3 py-2 font-sans text-xs font-semibold text-stone-700 cursor-pointer"
            >
              {/* Istilah rasmi "Arahan AI"/"sesi AI" (2026-08-16, audit bahasa 10 pusingan dgn
                  ChatGPT) -- "prompt"/"chatbox" ialah istilah teknikal dalaman sahaja, bukan
                  bahasa produk dipaparkan kpd editor. Nama produk AI tertentu turut dibuang
                  (keputusan sesi sebelum ni). */}
              <span>Arahan AI untuk Semakan (salin ke sesi AI pilihan)</span>
              {promptPanelTerbuka ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {promptPanelTerbuka && (
              <div id="panel-prompt-semakan" className="px-3 pb-3 space-y-3">
                <p className="text-[10px] text-stone-500 font-sans leading-normal">
                  Salin kandungan dalam kotak di bawah, tampalkan ke sesi AI pilihan anda bersama satu Arahan AI di bawah, kemudian tampal semula hasil yang telah dibetulkan.
                </p>
                {ralatPrompt && <MesejStatus tone="error" onCubaLagi={muatPromptSemakan}>{ralatPrompt}</MesejStatus>}
                {promptSemakan.length === 0 ? (
                  <p className="text-[11px] text-stone-500 font-sans italic">Tiada Arahan AI disimpan lagi.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {promptSemakan.map(p => (
                      <li key={p.id} className="flex items-center gap-2 bg-white border border-stone-200 rounded px-2.5 py-1.5">
                        {/* Penyeragaman tooltip 25/8 (arahan Izzat): title= pelayar asal ditukar
                            ke Tooltip kongsi — templat penuh Arahan AI kini terpapar dalam
                            gelembung gaya rasmi (balut ikut max-w-xs), bukan kotak sistem. */}
                        <Tooltip text={p.templateText}>
                          <span className="flex-1 min-w-0 font-sans text-xs font-semibold text-stone-800 truncate">
                            {p.name}
                          </span>
                        </Tooltip>
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
                          aria-label={`Padam Arahan AI ${p.name}`}
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
                    placeholder="Nama Arahan AI (cth: Betulkan ejaan Melayu baku)"
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded font-sans text-xs focus:outline-none focus:border-[var(--color-Adjung-maroon)]"
                  />
                  <textarea
                    value={teksPromptBaharu}
                    onChange={e => setTeksPromptBaharu(e.target.value)}
                    rows={2}
                    placeholder="Kandungan Arahan AI (cth: Sila betulkan semua ejaan mengikut ejaan bahasa Melayu baku)"
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
                      {menyimpanPrompt ? 'Menyimpan...' : 'Simpan Arahan AI'}
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
              <div className="relative">
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  onKeyDown={(e) => tanganiKekunciItalic(e, bulkText, setBulkText)}
                  onScroll={(e) => setBulkScrollTop(e.currentTarget.scrollTop)}
                  rows={30}
                  className="w-full px-3 py-3 border border-stone-300 rounded focus:outline-none focus:border-[var(--color-Adjung-maroon)] bg-white font-mono text-xs leading-relaxed"
                />
                {/* Garisan pemisah — lihat nota lengkap di bulkSegmen/bulkGarisTop di atas fail
                    ni. `overflow-hidden` + `inset-0` sepadan tepat kotak nampak textarea (elak
                    garisan terlebih bila kandungan lebih panjang drpd 30 baris kelihatan). */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                  {bulkGarisTop.map((top, i) => (
                    <div
                      key={i}
                      style={{ position: 'absolute', left: 12, right: 12, top: top - bulkScrollTop, height: 1, background: '#E7E5E4' }}
                    />
                  ))}
                </div>
                {/* Cermin TERSEMBUNYI — elemen KOSONG (bukan teks) di sini yang diukur, bukan
                    teks itu sendiri, jadi Select All + Copy pada textarea di atas TAK PERNAH
                    sertakan garisan ni. */}
                <div
                  ref={bulkMirrorRef}
                  aria-hidden="true"
                  className="w-full px-3 py-3 border border-stone-300 rounded bg-white font-mono text-xs leading-relaxed"
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, visibility: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word', pointerEvents: 'none' }}
                >
                  {bulkSegmen.map((seg, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <span ref={(el) => { bulkPenandaRefs.current[i - 1] = el; }} />}
                      {seg}
                    </React.Fragment>
                  ))}
                </div>
              </div>
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
              {/* Bar tindakan melekat DI BAWAH (2026-08-16, aduan Izzat — "kenapa page semakan
                  kandungan tak boleh scroll?"). Punca sebenar: kotak teks pukal ni SANGAT tinggi
                  (117 item termampat dlm satu textarea, scrollHeight boleh melebihi 10,000px),
                  dan bar ni (status + butang Simpan Pukal) sebelum ni duduk dlm aliran biasa
                  DI BAWAHNYA — pada skrin/zum lebih kecil drpd yang diuji, butang ni tertolak ke
                  luar pandangan, dan skrol tetikus semasa kursor di ATAS textarea (mana-mana
                  pelayar) skrol KANDUNGAN textarea dahulu (kelakuan asal, bukan pepijat), bukan
                  halaman — jadi capai butang tu "terasa" macam langsung tak boleh skrol walhal
                  halaman sendiri sebenarnya boleh (disahkan `scrollBy()`). Sama corak sedia ada
                  dgn header ATAS (`sticky top-0`, `<header>` fail ni) — bar bawah ni kini melekat
                  jugak, SENTIASA kelihatan tak kira berapa tinggi textarea, tiada skrol diperlukan
                  langsung utk capai butang Simpan. */}
              <div className="sticky bottom-0 bg-[var(--color-Adjung-cream)] border-t border-stone-200 flex justify-between items-center py-3 -mx-4 px-4 md:-mx-8 md:px-8">
                {/* Ketara secara visual (2026-08-16, audit ChatGPT — "tak ada notification ke
                    lepas tekan butang ni?") — SEBELUM ni 10px kelabu senyap, mudah terlepas
                    pandang walaupun tak dipadam awal (bug di atas). Warna ikut keputusan: hijau
                    (semua berjaya), merah (ada gagal/gagal semua), kelabu neutral (dlm proses). */}
                {/* flex-1 + mr-3 (2026-08-16) -- mesej ralat kini boleh bawa sebab SEBENAR
                    daripada pelayan (lihat saveBulk), boleh jadi lebih panjang drpd kiraan
                    ringkas lama -- mesti boleh balut ke baris seterusnya, bukan tersepit/
                    terpotong sebelah butang Simpan Pukal. */}
                <span className={`text-xs font-sans font-semibold flex-1 mr-3 ${
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
                  {bulkSaving ? 'Menyimpan...' : (modeSatuItem ? 'Simpan' : 'Simpan Pukal')}
                </Button>
              </div>
            </>
          )}
        </main>
    </div>
  );
}
