import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronUp, ChevronDown, Trash2, Lock, Upload, AlertCircle } from 'lucide-react';
import { validateContentBudget, validateBidangTopik, validateGlossLength } from '../../../core/editorial/ContentBudget.js';
import { tierForSlot, ceilingForSlot, TIER_LABELS, TIER_GRID_SIZE, topikCeilingForSlot, effectiveMinBriefLong } from '../../../core/editorial/GeometryConfig.js';
import { parseManualSummaryBlocks, serializeManualBentoQueue } from '../../../core/editorial/ManualBlockFormat.js';
import { BidangIcon } from '../common/BidangIcon';
import { Tooltip } from '../common/Tooltip';
import { Button } from '../common/Button';
import { labelUi } from '../../config/istilah';
import { usePhoneViewport } from '../../hooks/usePhoneViewport';
import { useModalFokus } from '../../hooks/useModalFokus';
import { useAutoSimpanTempatan, bacaDrafTempatan, buangDrafTempatan, masaRelatifRingkas } from '../../hooks/useAutoSimpanTempatan';
import { KompakCardPreview } from './cards/KompakCardPreview';
import { HeroCardPreview } from './cards/HeroCardPreview';
import { MenegakCardPreview } from './cards/MenegakCardPreview';
import { StandardCardPreview } from './cards/StandardCardPreview';
import { SegiEmpatMediumCardPreview } from './cards/SegiEmpatMediumCardPreview';
import { SegiEmpatSmallCardPreview } from './cards/SegiEmpatSmallCardPreview';
import { BarCardPreview } from './cards/BarCardPreview';

// Normalkan tarikh AI-tampal ke ISO yyyy-mm-dd (2026-08-08, pepijat Izzat — "kalau tampal output
// AI, medan tarikh sumber tu kena isi sendiri jgk") — <input type="date"> HANYA papar nilai
// dalam format ISO tepat; AI luaran tak semestinya ikut arahan prompt (buildAiPrompt di bawah)
// walau dah dinyatakan, jadi kalau ia tulis "8 Ogos 2026" atau "08/08/2026", medan tarikh
// kelihatan KOSONG selepas tampal — data sebenarnya tersimpan (b.date), cuma tak boleh dipapar
// input date, jadi editor terpaksa isi semula secara manual. Cuba beberapa corak biasa; kalau
// tiada padanan, pulangkan teks asal tak disentuh (falsafah sedia ada: jangan hilangkan tarikh
// separa/tidak dikenali).
// Nama bulan Melayu DAN Inggeris (2026-08-16, permintaan Izzat -- "borang sepatutnya direka utk
// menerima pelbagai format secara fleksibel utk mengurangkan ralat") -- AI luaran (ChatGPT/Gemini/
// dll) tak selalu ikut arahan Bahasa Melayu sepenuhnya utk tarikh walaupun sisa kandungan betul,
// jadi terima kedua-dua bahasa di sini tak buat kerosakan (nama bulan unik, tiada perlanggaran).
const NAMA_BULAN_KE_NOMBOR: Record<string, string> = {
  januari: '01', january: '01', jan: '01',
  februari: '02', february: '02', feb: '02',
  mac: '03', march: '03', mar: '03',
  april: '04', apr: '04',
  mei: '05', may: '05',
  jun: '06', june: '06',
  julai: '07', july: '07', jul: '07',
  ogos: '08', august: '08', aug: '08',
  september: '09', sept: '09', sep: '09',
  oktober: '10', october: '10', oct: '10',
  november: '11', nov: '11',
  disember: '12', december: '12', dec: '12',
};
function normalkanTarikhISO(raw: string): string {
  const t = (raw || '').trim();
  if (!t) return t;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // yyyy/mm/dd atau yyyy.mm.dd (tahun dulu, bukan ISO tepat tapi corak biasa AI/lokal lain).
  const ymd = t.match(/^(\d{4})[.\/](\d{1,2})[.\/](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // d/m/yyyy, d.m.yyyy, ATAU d-m-yyyy (sengaja SELEPAS semakan ISO di atas supaya "2026-08-13"
  // tak pernah tersalah anggap sebagai d-m-y dgn tahun 2 digit).
  const dmy = t.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // "13 Ogos 2026" / "13 Ogos, 2026" / "August 13, 2026" / "13th Ogos 2026" — nama bulan boleh
  // sebelum atau selepas nombor hari, koma pilihan, sufiks ordinal (st/nd/rd/th) pilihan.
  const dNamaBulanY = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s+(\d{4})$/i);
  if (dNamaBulanY) {
    const [, d, bulanNama, y] = dNamaBulanY;
    const bulan = NAMA_BULAN_KE_NOMBOR[bulanNama.toLowerCase()];
    if (bulan) return `${y}-${bulan}-${d.padStart(2, '0')}`;
  }
  const namaBulanDY = t.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i);
  if (namaBulanDY) {
    const [, bulanNama, d, y] = namaBulanDY;
    const bulan = NAMA_BULAN_KE_NOMBOR[bulanNama.toLowerCase()];
    if (bulan) return `${y}-${bulan}-${d.padStart(2, '0')}`;
  }
  return t;
}

interface Bidang { name: string; color: string; icon: string | null; iconSvg: string | null }

interface SlotManagerModalProps {
  editingSlotIndex: number;
  formConfig: any;
  setFormConfig: (updater: any) => void;
  activeBidangList: Bidang[];
  currentEditoriumRole: string;
  // Nama sebenar editor yang log masuk (2026-07-29) — papar di medan "Editor" (Maklumat slot +
  // Borang kandungan), lihat-sahaja. Kosong = belum log masuk (papar EDITOR_PLACEHOLDER).
  currentEditoriumName?: string;
  isSavingSlot: boolean;
  // Mesej ralat simpan terkini daripada useSlotEditor (2026-08-02) — sebelum ni `onSave` cuma
  // pulangkan boolean `ok`, jadi sebab kegagalan sebenar (termasuk konflik serentak Fasa 6) tak
  // pernah sampai ke UI langsung. Dibaca oleh publishOne/saveDraft di bawah bila `ok` palsu.
  saveError?: string;
  onClose: () => void;
  // Tukar slot terus dalam modal ni (2026-07-29, permintaan pemilik projek) — sebelum ni satu-
  // satunya cara tukar slot ialah Batal + buka pemilih semula. Pilihan (semua slot KECUALI Bar,
  // sama senarai macam pemilih asal) + panggilan balik ke openSlotEditor(idx) di App/Editorium.
  slotOptions?: { index: number; label: string }[];
  onSwitchSlot?: (idx: number) => void;
  // Buka terus pada SATU kandungan dalam giliran slot (2026-08-01) — dihantar oleh "Draf Saya",
  // supaya klik pada draf mendarat betul-betul pada draf itu, bukan pada kandungan pertama slot.
  // Kosong/tak dijumpai = kelakuan asal (kandungan pertama).
  initialUuid?: string;
  // manualSummaryOverride: items (giliran kandungan) hidup sebagai state TEMPATAN modal ni (lihat
  // nota di useState items di bawah), bukan diterbitkan semula daripada formConfig.manualSummary
  // pada setiap keystroke. handleSubmit hantar serialize(items) TERUS sebagai argumen kedua di
  // sini — `onSave` ialah closure yang sudah tetap sejak render SEBELUM ia dipanggil, jadi ia
  // tetap membaca formConfig LAMA dari parent walau apa pun setFormConfig() buat pada render akan
  // datang. Hantar terus sebagai argumen elak kebergantungan pada timing React state sama sekali.
  // Pulangan (LIFE-01, audit ChatGPT 2026-08-08) — kejayaan kini array hasil publish SEBENAR
  // (status approved/pending setiap item), bukan `true` kosong. Array (walaupun []) sentiasa
  // truthy dlm JS, jadi semak `if (ok)` sedia ada kekal berfungsi; publishOne() di bawah baca
  // kandungan array ni terus utk papar mesej toast yang tepat.
  onSave: (e: React.FormEvent, manualSummaryOverride?: string, opts?: { closeOnSuccess?: boolean }) => Promise<{ objectId: string; title: string; status: string }[] | boolean | void> | void;
  // Toast kongsi Editorium (2026-08-08) — makluman SEBENAR selepas Terbit/Simpan draf, bukan
  // cuma mesej dalaman modal (draftNote/publishError) yang hilang dalam beberapa saat dan tak
  // kelihatan langsung kalau editor dah tutup modal.
  onToast?: (type: 'success' | 'error' | 'info', message: string, action?: { label: string; onClick: () => void }) => void;
  // Navigasi terarah ke Indeks yang sudah ditapis (WF-01, Pusingan 5, audit ChatGPT 2026-08-09)
  // — lepas Terbit, editor boleh terus lihat rekod baharu di Indeks tanpa tutup modal & cari
  // sendiri. Pilihan — modal tetap berfungsi penuh tanpanya (cth BarSlotManagerModal berkongsi
  // sebahagian pola sama tapi tiada konteks Indeks yang sama).
  onLihatIndeks?: (opts: { slot?: string; status?: string }) => void;
}

const TAB_LABEL: Record<string, string> = { borang: 'Borang kandungan', maklumat: 'Maklumat slot', ai: 'Arahan AI', sejarah: 'Sejarah versi' };
const GEN_MODE_LABEL: Record<string, string> = { bebas: 'Bebas', dengan_rujukan: 'Dengan rujukan', artikel_jurnal: 'Dengan Artikel Jurnal' };

const labelCls = 'font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500';

// Semakan format URL ringan di client (cermin validateSourceUrl, core/editorial/ContentBudget.js)
// -- utk medan "URL sumber" mod Dengan rujukan sahaja. Tak fetch/sahkan URL wujud sebenar (elak
// kerumitan/latensi, audit ChatGPT 2026-08-15) -- cuma tapis kesilapan taip jelas (http/https,
// bukan skema pelik cth javascript:) sebelum editor sempat salin prompt yg akan gagal.
const urlFormatSah = (url: string): boolean => {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch { return false; }
};

// Placeholder jujur untuk medan "Editor" bila `currentEditoriumName` tak dihantar (cth. sesi
// belum log masuk) — papar "—", bukan nama palsu.
const EDITOR_PLACEHOLDER = '—';

// Sumber rujukan berbilang (2026-08-15, simulasi Izzat pusingan 4 + audit ChatGPT --
// "berbilang URL boleh masuk v1, bukan sebagai senarai pautan bebas, tapi koleksi sumber
// dengan peraturan keserasian"). aiPromptSource (kolum DB sedia ada, TEXT bebas format,
// server tak validate/urus kandungannya) kini simpan JSON array [{name,url}] di sisi client
// -- BUKAN skema DB baharu, cuma tafsiran baharu bagi medan sedia ada. Serasi mundur: nilai
// lama (URL tunggal ditaip terus, bukan JSON) ditafsir sebagai satu entri {name:'',url}.
const parseReferenceSources = (raw: string | undefined | null): { name: string; url: string }[] => {
  const s = (raw || '').trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.filter((x) => x && typeof x.url === 'string').map((x) => ({ name: String(x.name || ''), url: String(x.url || '') }));
  } catch { /* nilai legasi bukan JSON -- URL tunggal ditaip terus sebelum ciri berbilang sumber wujud */ }
  return [{ name: '', url: s }];
};
const serializeReferenceSources = (list: { name: string; url: string }[]): string => JSON.stringify(list);

// Assembles a copy-pasteable prompt for an external AI chatbox — same source fields used
// elsewhere in this modal for the "Arahan AI" tab.
// titleTarget/briefTarget (2026-08-07, pepijat kritikal Izzat) — editor laraskan slider SATU
// pasangan nombor yang SUDAH sah ikut formula bajet kongsi (titleTarget/maxTitle +
// briefTarget/maxBrief <= 1, dikira di caller — lihat pengendali slider di JSX), bukan hantar
// dua had solo (maxTitle, maxBrief) berasingan macam sebelum ni ke AI luaran seolah-olah kedua
// boleh dicapai PENUH serentak — itu mustahil ikut formula sebenar, validateContentBudget tolak
// 100% terjamin bila AI ikut arahan literal. AI cuma perlu DUA nombor mudah, bukan penjelasan
// formula — pengiraan/keselarasan jadi tanggungjawab UI (slider), bukan tanggungjawab AI.
function buildAiPrompt(fc: any, ceiling: { maxBriefLong: number }, hadTopik: number, titleTarget: number, briefTarget: number) {
  const desk = fc.manualDesk || '';
  // Minimum tajuk/huraian ringkas (2026-08-08, pepijat Izzat) — sebelum ni prompt cuma nyatakan
  // "maksimum", tiada minimum langsung, jadi AI boleh (dan kerap) pulangkan teks jauh lebih
  // pendek daripada target dan masih "ikut arahan" secara literal. Selepas had minimum bajet
  // KESELURUHAN 80% (validateContentBudget) wujud, output pendek macam tu terus ditolak simpan.
  // Minimum dikira 80% drpd target (bukan agakan) — kalau tajuk DAN huraian sama-sama capai
  // sekurang-kurangnya 80% sasaran masing-masing, jumlah bajet pasti >=80% (titleTarget/maxTitle
  // + briefTarget/maxBrief sudah dikira ~1.0 di caller, lihat pengendali slider di JSX).
  const minTitleTarget = Math.max(1, Math.ceil(titleTarget * 0.8));
  const minBriefTarget = briefTarget > 0 ? Math.max(1, Math.ceil(briefTarget * 0.8)) : 0;
  // Kelemahan prompt (2026-08-15, simulasi "Arahan AI" Izzat + audit ChatGPT) — AI luaran (tiada
  // konteks Perlembagaan/kod Adjung langsung) sebelum ni terima prompt yang: (a) tak pernah
  // terangkan beza Bidang vs Topik walaupun kedua-dua medan wajib diisi, (b) tiada peraturan
  // langsung pasal URL/sumber (boleh reka URL palsu tanpa disekat prompt, walaupun
  // validateSourceUrl tolak URL tak sah semasa simpan — lebih baik cegah di sumber drpd
  // bergantung semata pada penolakan lewat). Sintaks gloss [label](gloss:makna) SENGAJA tidak
  // disebut langsung (bukan "elakkan", terus tiada) — ciri tu dimatikan sepenuhnya buat masa ini
  // (GLOSS_AUTHORING_ENABLED=false, ContentBudget.js), dan AI luaran tak akan tahu ciri ni wujud
  // pun kalau tak disebut — jadi tiada risiko ia cuba guna sintaks yang akan ditolak simpan.
  //
  // Prompt v3 (2026-08-15, simulasi Izzat pusingan 2 -- prompt v2 di atas diuji SEBENAR terhadap
  // 4 AI buta konteks (ChatGPT/Gemini/Grok/DeepSeek), keputusan: KESEMUA 4 langgar sekurang-
  // kurangnya SATU had aksara walaupun had dinyatakan eksplisit sebagai nombor -- corak
  // merentasi SEMUA model, bukan satu AI sahaja. Pengajaran (audit ChatGPT selepas keputusan
  // sebenar): AI BUKAN validator deterministik, prompt boleh KURANGKAN kadar ralat tapi tak
  // boleh jadi lapisan terakhir jamin had -- validateContentBudget (ContentBudget.js) KEKAL
  // sebagai gerbang sebenar, prompt ni cuma kurangkan kerja pembetulan manual editor. Teknik
  // yang diuji sebenar sebelum ni gagal sebab AI diberi HAD MAKSIMUM sebagai sasaran ("maksimum
  // 75") -- AI "berjalan atas tali", kerap terlajak sikit. Sasaran SELAMAT (di bawah had
  // maksimum, bukan tepat pada had) beri ruang untuk anggaran aksara AI yang tak tepat.
  const safeBuffer = (max: number) => Math.max(2, Math.round(max * 0.08));
  const titleSafeMax = Math.max(minTitleTarget, titleTarget - safeBuffer(titleTarget));
  const briefSafeMax = Math.max(minBriefTarget, briefTarget - safeBuffer(briefTarget));
  const topikSafeMax = Math.max(1, hadTopik - safeBuffer(hadTopik));
  const briefLongSafeMax = Math.max(effectiveMinBriefLong(), ceiling.maxBriefLong - safeBuffer(ceiling.maxBriefLong));
  // Mod "Dengan rujukan" (2026-08-15, simulasi Izzat pusingan 3 -- ciri "Dengan rujukan" DITEMUI
  // pincang: togol + label prompt wujud sejak dahulu, TAPI genMode cuma dibaca di 2 tempat dalam
  // fail ni (gaya togol, satu baris label "[Mod janaan]") -- TIADA medan URL, TIADA sambungan ke
  // aiPromptSource (medan sedia wujud dalam skema DB + useSlotEditor.ts/useTickerEditor.ts, tapi
  // yatim, tak pernah dipaparkan sebagai input). Punca sebenar URL palsu (2/4 AI ujian sebenar)
  // bukan wording sahaja -- AI diminta CARI sumber sendiri tanpa cara sistem beri sumber SEBENAR.
  // Reka bentuk (audit ChatGPT selepas keputusan ujian): DUA falsafah berasingan, jangan campur --
  // "Bebas" (AI pilih sumber sendiri, risiko URL palsu KEKAL, cuma dikurangkan) lawan "Dengan
  // rujukan" (editor tentukan SATU sumber wajib, AI cuma meringkaskan, provenance jelas+audit-
  // able). URL kosong pada mod "Dengan rujukan" TIDAK jatuh balik ke "AI cari sendiri" (itu cipta
  // mod ketiga tersembunyi yang mengelirukan) -- copyPrompt() sekat sepenuhnya sehingga URL diisi.
  const isReferenceMode = fc.genMode === 'dengan_rujukan';
  // Mod "Dengan Artikel Jurnal" (2026-08-16, arahan Izzat) -- peluasan KETIGA kepada
  // "Jana Kandungan AI", BUKAN mod URL. Editor lampirkan PDF jurnal secara manual terus dalam
  // sesi AI luaran (ChatGPT/Claude/Gemini) sendiri -- Adjung Brief TIDAK simpan/proses fail PDF
  // (tiada upload, storan atau parser dibina). Jadi tiada medan URL wajib macam "Dengan rujukan"
  // -- copyPrompt() tak patut sekat berdasarkan URL utk mod ni. Bahagian yang dikongsi bersama
  // "Dengan rujukan" (had usia sumber tak relevan, wilayah sumber tak relevan, kunci 1 kandungan
  // bagi 1 sumber) guna flag gabungan `isSingleSourceMode` di bawah -- tapi seksyen sumber &
  // gaya penulisan KEKAL berasingan sepenuhnya (jangan campur URL rujukan dgn PDF jurnal).
  const isJournalMode = fc.genMode === 'artikel_jurnal';
  const isSingleSourceMode = isReferenceMode || isJournalMode;
  // Medan BERASINGAN drpd aiPromptSource (2026-08-16, pepijat Izzat: JSON sumber "Pautan" bocor
  // terus ke medan "Nama Jurnal" sebab dua mod kongsi SATU medan formConfig lama — Pautan simpan
  // JSON berstruktur (serializeReferenceSources) di aiPromptSource, Artikel Jurnal papar medan
  // SAMA sebagai teks mentah. Kini dua medan formConfig berasingan sepenuhnya, tak boleh
  // bertindih walau editor bertukar sub-mod berulang kali dalam satu sesi borang yang sama.
  const journalName = (fc.aiPromptJournalName || '').trim();
  const referenceSources = parseReferenceSources(fc.aiPromptSource).filter((s) => s.url.trim());
  const isMultiSource = referenceSources.length > 1;
  const sumberSection = isJournalMode
    ? [
        '[Sumber — artikel jurnal/akademik dalam bentuk PDF]',
        journalName
          ? `Editor telah melampirkan artikel jurnal berikut secara manual dalam sesi ini: ${journalName}.`
          : 'Editor telah melampirkan satu artikel jurnal/dokumen akademik (PDF) secara manual dalam sesi ini.',
        'Gunakan HANYA kandungan artikel/dokumen yang dilampirkan sebagai sumber maklumat. Jangan gunakan pengetahuan sendiri, ingatan model, atau sumber lain di luar dokumen ini.',
        '',
        '[Gaya penulisan — WAJIB, ini bukan ulasan jurnal]',
        'Sumber anda ialah artikel jurnal/akademik, tetapi OUTPUT anda BUKAN ulasan jurnal atau ringkasan akademik. Adjung Brief ialah portal editorial, bukan jurnal akademik atau laman sorotan literatur. Tulis SEOLAH-OLAH anda sendiri telah memahami perkara yang dibincangkan dan menerangkannya terus kepada pembaca, bukan melaporkan tentang kewujudan kajian tersebut.',
        'JANGAN gunakan frasa gaya ulasan akademik seperti "Kajian ini mendapati...", "Artikel jurnal ini membincangkan...", "Menurut penyelidik...", "Penulis artikel menyatakan...", "Kajian tersebut mengkaji..." — kecuali benar-benar perlu untuk konteks (contoh: merujuk dapatan khusus yang mesti diatribusikan).',
        'Contoh BETUL (gaya editorial terus): "Pentadbiran fatwa di Malaysia mengalami perkembangan yang berkait rapat dengan perubahan struktur institusi agama dan keperluan penyelarasan di peringkat kebangsaan..."',
        'Contoh SALAH (gaya ulasan jurnal): "Artikel jurnal tersebut mengkaji perubahan pentadbiran fatwa..."',
        'Kekalkan fakta dan dapatan yang disokong oleh dokumen yang dilampirkan sahaja. Jangan menambah dakwaan, implikasi atau hubungan yang tidak disokong sumber.',
        '',
        '[Medan Sumber — gaya Adjung Brief, bukan citation akademik]',
        'Pada medan Sumber, tulis nama jurnal secara ringkas sahaja (contoh: "Journal of Islamic Studies" atau "Jurnal Syariah"). JANGAN tulis citation akademik penuh (contoh JANGAN "Ahmad, A. (2025). Tajuk artikel. Jurnal X, Vol 10...") kecuali editor sendiri nyatakan mahu memasukkannya. Medan URL boleh dikosongkan jika artikel PDF tiada pautan web berkaitan.',
      ]
    : isReferenceMode && referenceSources.length > 0
    ? [
        '[Rujukan sumber wajib]',
        isMultiSource ? `Gunakan HANYA sumber-sumber berikut untuk kandungan ini:` : `Gunakan HANYA sumber berikut untuk kandungan ini:`,
        ...referenceSources.map((s, i) => {
          const label = isMultiSource ? `URL sumber ${i + 1}` : 'URL sumber';
          return s.name.trim() ? `${label}: ${s.url.trim()} (${s.name.trim()})` : `${label}: ${s.url.trim()}`;
        }),
        'Peraturan:',
        '- Kandungan ini hendaklah berdasarkan maklumat yang terdapat dalam sumber di atas sahaja; jangan tambah fakta luar yang tidak terdapat dalam sumber-sumber tersebut.',
        '- Sumber di atas ialah satu-satunya sumber yang dibenarkan.',
        '- Jangan gunakan pengetahuan sendiri, ingatan model, atau sumber lain.',
        '- Jangan cipta URL baharu; medan Sumber dan URL dalam output MESTI menggunakan URL yang diberikan sahaja.',
        '- Jika maklumat dalam sumber tidak mencukupi untuk sesuatu fakta khusus, jangan masukkan fakta tersebut. Fokuskan huraian kepada maklumat yang disahkan sahaja. Jangan menyebut keterbatasan sumber, proses semakan atau kekurangan maklumat kepada pembaca kecuali perkara tersebut merupakan sebahagian daripada perkembangan yang dilaporkan.',
        '',
        '[Jika anda TIDAK boleh mengakses mana-mana URL di atas — audit ChatGPT AI-PROVENANCE-003]',
        'Sesetengah AI tiada keupayaan membuka pautan web secara langsung. Jika anda TIDAK dapat mengakses/fetch URL di atas:',
        '- Jangan teka kandungan sumber daripada domain, tajuk laman atau corak URL sahaja.',
        '- Jangan hasilkan kandungan pengganti berdasarkan andaian atau pengetahuan am tentang topik berkaitan.',
        '- Jangan teruskan ke format Topik/Tajuk/dsb di bawah.',
        '- Balas HANYA dengan format berikut, tiada tambahan lain (ini mengatasi arahan "Berikan output dalam format berikut sahaja" di bawah untuk kes ini):',
        'STATUS: Sumber tidak dapat disahkan',
        'SEBAB: (nyatakan sebab sebenar — contoh "Saya tiada keupayaan mengakses pautan web")',
        ...(isMultiSource ? [
          '',
          '[Keserasian sumber]',
          'Sebelum menghasilkan kandungan, semak hubungan antara semua sumber yang diberikan.',
          '',
          'Jika sumber-sumber tersebut membincangkan perkara yang TIDAK berkaitan atau berada di luar konteks yang sama, JANGAN menghasilkan kandungan. Contoh: satu sumber membincangkan ekonomi, satu lagi membincangkan sukan; atau sumber merujuk kepada peristiwa, tempat atau isu yang berbeza. Dalam keadaan ini, balas HANYA dengan:',
          'STATUS: Sumber tidak berkaitan',
          'SEBAB: (terangkan secara ringkas mengapa sumber tidak boleh digabungkan)',
          '',
          'Jika sumber-sumber tersebut membincangkan perkara yang SAMA tetapi mempunyai perbezaan fakta tertentu (contoh: bilangan mangsa berbeza), JANGAN tolak sumber tersebut. Sebaliknya:',
          '- Bandingkan maklumat yang diberikan. Jangan elak/kaburkan angka atau fakta khusus yang berbeza semata-mata kerana ia bercanggah — pembaca perlukan maklumat itu.',
          '- Nyatakan perbezaan dengan atribusi kepada sumber masing-masing jika perbezaan itu penting (contoh: "Bernama melaporkan bacaan 183, manakala NST melaporkan 190.").',
          '- Jika perbezaan kecil atau tidak perlu dihuraikan, gunakan bahasa berhati-hati yang tetap menyatakan angka sebenar, tidak memilih satu dakwaan secara mutlak (contoh: "Sumber melaporkan bacaan sekitar 183 hingga 190.").',
          '- Jangan hasilkan fakta baharu yang tidak terdapat dalam mana-mana sumber, dan jangan satukan angka berbeza menjadi satu angka baharu tanpa justifikasi (contoh: jangan pilih angka tertinggi sebagai "sekurang-kurangnya" semata-mata kerana ia tertinggi).',
          '',
          '[Penggunaan medan Sumber]',
          'Sentiasa gunakan nama SEBENAR sumber (contoh "Bernama", "NST") pada setiap baris Sumber:/URL: — JANGAN sekali-kali tulis "Editorial Adjung" sebagai nama sumber; itu label yang dipaparkan sistem Adjung SENDIRI secara automatik pada kad bila lebih daripada satu sumber digunakan, BUKAN nama untuk anda tulis. Kalau kandungan menggabungkan DUA atau lebih sumber, ulang KETIGA-TIGA baris Sumber:/URL:/Tarikh sumber: untuk SETIAP sumber (dengan nama, URL dan tarikh terbitan SEBENAR masing-masing — sumber berbeza selalunya diterbitkan pada tarikh berbeza, jangan kongsi satu tarikh untuk semua) — jangan gugurkan mana-mana.',
        ] : []),
      ]
    : [
        '[Peraturan sumber & URL]',
        'Mod pemilihan sumber oleh AI ialah bantuan penemuan kandungan, bukan penerbitan yang telah disahkan. Editor mesti mengesahkan URL sebelum menyimpan kandungan. Jangan gunakan pengetahuan sendiri, ingatan model, atau anggaran. Jangan menghasilkan URL baharu — hanya gunakan URL yang anda benar-benar tahu wujud daripada carian sebenar. Jika tidak pasti URL tepat sesuatu sumber, kosongkan URL dan nyatakan nama sumber sahaja tanpa pautan (tiada URL yang lebih baik daripada URL yang tidak dapat disahkan). URL mesti bermula dengan http:// atau https://. Jika terdapat lebih daripada satu sumber, senaraikan sumber utama sahaja pada baris Sumber/URL (satu sumber sahaja setiap blok, format ini tidak menyokong penggunaan berbilang URL secara serentak).',
      ];
  const lines = [
    '[Peranan AI]',
    // [Bahasa dan gaya penulisan] disusun semula (2026-08-16, audit bahasa 10 pusingan dgn
    // ChatGPT selepas teguran Izzat -- "bahasa melayu awak pun sangat teruk") -- versi lama
    // ayat pertama guna struktur terjemahan terus Inggeris ("ini tidak berubah tidak kira...")
    // yang sesuai jadi contoh KESILAPAN dalam audit tu sendiri. Susunan baharu: prinsip utama
    // -> keadaan pengecualian -> gaya bahasa -> larangan gaya, ikut cadangan ChatGPT.
    'Anda membantu Adjung Brief, sebuah portal penerbitan editorial berbahasa Melayu. Tugas anda ialah menyediakan SATU kandungan editorial dalam Bahasa Melayu formal, neutral dan tepat, berdasarkan spesifikasi berstruktur di bawah.'
      + ' Kandungan akhir MESTI ditulis dalam Bahasa Melayu, tanpa mengira bahasa sumber atau rujukan yang digunakan. Jika bahan rujukan tersedia dalam bahasa lain seperti Bahasa Inggeris atau Bahasa Arab, terjemahkan dan olah semula maklumat tersebut dalam Bahasa Melayu yang sesuai untuk pembaca Adjung Brief.'
      + ' Gunakan Bahasa Melayu penerbitan yang lancar, profesional dan mudah difahami. Gunakan istilah serta ungkapan yang lazim dalam penulisan editorial seperti portal berita dan majalah. Elakkan terjemahan langsung daripada struktur bahasa asing atau penggunaan istilah teknikal yang janggal jika terdapat ungkapan Bahasa Melayu yang lebih sesuai.'
      + ' Jangan hasilkan kandungan dalam gaya manual perisian, dokumentasi teknikal atau nota dalaman. Kandungan mesti dibaca sebagai tulisan editorial untuk pembaca umum.'
      + ' Ketepatan fakta lebih penting daripada melengkapkan semua medan — jika anda tidak mempunyai maklumat yang mencukupi untuk sesuatu fakta, JANGAN masukkan fakta tersebut dan JANGAN hasilkan kandungan berdasarkan andaian, tajuk, ingatan model atau anggaran. Tulis hanya apa yang disokong oleh maklumat yang anda ada — jangan sertakan sebarang nota, penafian atau penjelasan tentang keterbatasan maklumat/pengetahuan anda sendiri dalam kandungan; kandungan akhir mesti berdiri sebagai artikel editorial untuk pembaca, bukan laporan tentang proses anda menghasilkannya.', '',
    '[Bidang — subjek terkunci untuk slot ini, kandungan MESTI berkaitan]', desk || '(belum ditetapkan — hubungi Ketua Editor sebelum jana)', '',
    '[Bidang vs Topik — kedua-dua medan WAJIB diisi, jangan keliru]',
    'Bidang ialah kategori TETAP untuk slot ini (dinyatakan di atas, TIDAK boleh diubah atau dipilih semula). Topik pula label BEBAS yang anda tulis sendiri untuk kandungan ini, mesti spesifik dan masih dalam skop Bidang tersebut — bukan ulang semula nama Bidang. Contoh: Bidang "Ekonomi" kekal, Topik boleh "Kadar Faedah" atau "Perbankan Digital", bukan "Ekonomi" atau "Berita Ekonomi".', '',
    '[Peraturan am — sistem/global]', fc.masterPrompt || '-', '',
    '[Arahan khas — slot ini]', fc.promptText || 'Tiada arahan khas untuk slot ini. Ikut sepenuhnya Peraturan am di atas.', '',
    '[Fungsi huraian panjang]',
    // Pecah kepada perenggan (2026-08-16, permintaan Izzat + audit ChatGPT) — arahan LAMA
    // "Tulis sebagai huraian mengalir secara lancar — JANGAN gunakan subtajuk atau format
    // berasingan" ambigu: AI (disahkan sebenar, simulasi Slot 3 rujukan URL Malaysian Reserve)
    // tafsir "mengalir lancar" sebagai SATU blok teks tanpa noktah baris LANGSUNG (1502 aksara,
    // sifar \n\n), walaupun kandungan tu ada beberapa "beat" jelas berasingan. Arahan asal cuma
    // larang SUBTAJUK (Apa:/Kenapa:), tak pernah eksplisit MINTA perenggan pun — jurang ni
    // punca sebenar, bukan pepijat parser/renderer (\n{2,} -> <p> di FocusView.tsx sedia
    // berfungsi, cuma tak pernah dapat input berperenggan utk diuji). Fix (wording ChatGPT):
    // eksplisit minta pecah ikut PERUBAHAN IDEA (bukan bilangan perenggan tetap — panjang
    // kandungan berbeza-beza), kekalkan naratif bersambung (bukan nota berasingan gaya blog).
    'Huraian panjang mesti memberikan konteks yang mencukupi untuk pembaca memahami perkembangan yang dilaporkan. Selain menerangkan apa yang berlaku, huraian hendaklah menjelaskan mengapa perkembangan ini penting atau mempunyai implikasi kepada keadaan semasa, jika maklumat sumber menyokongnya. Jika perkembangan ini berkait dengan peristiwa atau keputusan terdahulu yang penting untuk difahami, masukkan konteks tersebut secara ringkas. Tulis sebagai naratif editorial yang mengalir dan mudah dibaca — JANGAN gunakan subtajuk, senarai bernombor, atau format berasingan (contoh "Apa:"/"Kenapa penting:"/"Konteks:"). Namun jangan hasilkan SATU blok teks yang terlalu panjang: pecahkan huraian kepada beberapa perenggan yang semula jadi berdasarkan perubahan idea atau perkembangan maklumat (bukan bilangan tetap — panjang berbeza ikut kandungan), dengan SATU baris kosong antara setiap perenggan. Setiap perenggan patut ada satu fokus utama (contoh: perenggan pembuka beri konteks/latar isu, perenggan seterusnya huraikan kenyataan/fakta utama, perenggan berikutnya jelaskan implikasi atau perkembangan berkaitan), tetapi kekal mengalir sebagai SATU naratif bersambung — bukan macam nota berasingan. Jangan reka-reka kepentingan, implikasi atau hubungan yang tidak disokong sumber. Jangan sekali-kali menulis nota penjelasan tentang sumber, tahap keyakinan, keterbatasan maklumat atau proses anda mendapatkan maklumat (contoh SALAH: "walau bagaimanapun, maklumat sumber tidak memperincikan..."/"berdasarkan maklumat yang disahkan..."/"setakat yang dapat dihuraikan berdasarkan sumber..."); huraian hendaklah berdiri sepenuhnya sebagai artikel editorial untuk pembaca, bukan laporan tentang proses atau had rujukan anda sendiri.'
      + (isJournalMode
        ? ' Jika bahan rujukan merupakan artikel jurnal atau dokumen akademik, olah maklumat tersebut menjadi huraian editorial yang mudah difahami pembaca umum. Jangan menghasilkan ringkasan akademik, sorotan literatur atau ulasan terhadap jurnal. Tulis seolah-olah penulis telah memahami kandungan sumber tersebut dan menerangkan perkembangan, dapatan atau implikasinya kepada pembaca.'
        : ''), '',
    ...sumberSection, '',
    '[Format teks]',
    'Gunakan teks biasa sahaja. JANGAN gunakan Markdown (tiada **tebal**, *condong*, atau simbol _ untuk penekanan) — medan borang Adjung paparkan teks mentah, simbol Markdown akan terpapar literal kepada pembaca, bukan diformat.', '',
    ...(isSingleSourceMode ? [] : [
      '[Had usia sumber — WAJIB, bukan pilihan]',
      `Sumber MESTI diterbitkan dalam tempoh ${fc.aiPromptRecency || '-'} sebelum hari ini. Kira tarikh dengan teliti sebelum pilih sumber — kalau sumber yang anda jumpa lebih lama daripada had ini, JANGAN gunakan, cari sumber lain yang lebih baharu.`, '',
    ]),
    '[Had aksara — sasaran SELAMAT, bukan had maksimum]',
    'Had di bawah ialah SEMPADAN KERAS (langgar = kandungan ditolak sistem). Namun, JANGAN sasarkan tepat pada angka maksimum — AI kerap silap anggaran sendiri beberapa aksara. Sasarkan ke arah angka "selamat" di bawah, supaya ada ruang lapang:',
    `Topik: sasarkan sekitar ${topikSafeMax} aksara (sempadan keras: maksimum ${hadTopik})`,
    `Tajuk: sasarkan antara ${minTitleTarget}–${titleSafeMax} aksara (sempadan keras: minimum ${minTitleTarget}, maksimum ${titleTarget})`,
    `Huraian ringkas: sasarkan antara ${minBriefTarget}–${briefSafeMax} aksara (sempadan keras: minimum ${minBriefTarget}, maksimum ${briefTarget})`,
    `Huraian panjang: sasarkan antara ${effectiveMinBriefLong()}–${briefLongSafeMax} aksara (sempadan keras: minimum ${effectiveMinBriefLong()}, maksimum ${ceiling.maxBriefLong})`, '',
    '[Semakan sendiri — lakukan sebelum menghasilkan output akhir, jangan paparkan kiraan dalam output]',
    'Sebelum berikan jawapan akhir, kira semula aksara setiap medan (Topik/Tajuk/Huraian ringkas/Huraian panjang) satu-persatu dan bandingkan dengan sasaran di atas. Jika mana-mana medan melebihi had maksimum atau kurang daripada minimum, hasilkan semula medan tersebut sahaja sehingga memenuhi julat ditetapkan. Kandungan output akhir mesti teks tulen sahaja (Topik/Tajuk/Huraian ringkas/Huraian panjang) — jangan sertakan kiraan aksara atau nota semakan dalam jawapan akhir.', '',
    // "Bahasa sumber" (2026-08-16, dinamakan semula drpd "Bahasa kandungan" — soalan Izzat:
    // "bukan ke bahasa kandungan dah confirm2 dlm bahasa melayu?"). Output SENTIASA Bahasa
    // Melayu (dikunci di [Peranan AI] di atas, TAK PERNAH dikawal medan ni) — medan ni panduan
    // bahasa SUMBER yang AI patut cari, relevan HANYA mod "Bebas" (mod Dengan Rujukan sumbernya
    // dah TETAP, soalan "bahasa sumber apa nak dicari" dah tak bermakna — sama gerbang
    // isSingleSourceMode macam Had usia sumber/Negara asal sumber di atas).
    ...(isSingleSourceMode ? [] : [`[Bahasa sumber — panduan carian sahaja, BUKAN bahasa output]: ${fc.aiPromptLanguage || 'Bebas'}. "Bebas" bermaksud sumber apa-apa bahasa dibenarkan. Output akhir KEKAL Bahasa Melayu tidak kira nilai ini.`]),
    ...(isSingleSourceMode ? [] : [`[Negara/Wilayah sumber]: ${fc.aiPromptRegion || '-'}`]),
    `[Jumlah kandungan]: ${isSingleSourceMode ? 1 : (fc.generationLimit || 1)}`,
    `[Mod janaan]: ${GEN_MODE_LABEL[fc.genMode] || fc.genMode || 'Bebas'}`, '',
    'Berikan output dalam format berikut sahaja, satu blok bagi setiap kandungan, dipisahkan dengan baris "____":',
    '(Tarikh sumber MESTI format YYYY-MM-DD, contoh 2026-08-08 — format lain tidak dikenali oleh borang)',
    'Topik:', 'Tajuk:', 'Huraian ringkas:', 'Huraian panjang:', 'Sumber:', 'URL:', 'Tarikh sumber:', '',
    '[Contoh format (rujukan struktur SAHAJA — jangan salin isi atau fakta di bawah, ganti dengan kandungan sebenar anda)]',
    'Topik: Dasar Data Awam',
    'Tajuk: Portal data terbuka kerajaan tambah 200 set data baharu bulan ini',
    'Huraian ringkas: Kerajaan memperluas portal data terbuka dengan 200 set data baharu merangkumi sektor kesihatan dan pengangkutan bagi galak penyelidikan awam.',
    'Huraian panjang: (contoh dipendekkan) ... huraian penuh mengalir tanpa subtajuk, jelaskan apa berlaku dan kenapa ia penting ...',
    'Sumber: (nama sebenar sumber anda)',
    'URL: (pautan sebenar yang anda sahkan wujud)',
    'Tarikh sumber: YYYY-MM-DD',
  ];
  return lines.join('\n');
}

// Tajuk dan huraian KONGSI satu bajet ruang kad, bukan dua had berasingan — tajuk pendek
// membebaskan ruang untuk huraian lebih panjang, dan sebaliknya. Peraturan ni KEKAL dikuatkuasakan
// di peringkat simpan (validateContentBudget, ContentBudget.js) — meter ni beri amaran awal
// sebelum editor cuba simpan dan ditolak server.
// Export (2026-08-07, Audit UI/UX §F1) — TickerManagementModal.tsx guna komponen SAMA ni untuk
// meter bajet langsung per-blok, bukan salinan berasingan. Kekalkan formula/tone identik supaya
// dua tempat tak boleh terpesong sesama sendiri.
export function BudgetMeter({ slotIndex, ceiling, title, brief }: { slotIndex: number; ceiling: { maxTitle: number; maxBrief: number }; title: string; brief: string }) {
  const check = validateContentBudget(slotIndex, title || '', brief || '');
  const usedTitle = ceiling.maxTitle ? title.length / ceiling.maxTitle : 0;
  const usedBrief = ceiling.maxBrief ? brief.length / ceiling.maxBrief : 0;
  const used = usedTitle + usedBrief;
  // Math.floor (BUKAN Math.round) — round-KE-ATAS boleh papar "baki N aksara" yang sebenarnya
  // SATU aksara lebih daripada had sebenar (ditemui semasa ujian 2026-08-07 pada slider serupa di
  // buildAiPrompt), editor taip sampai angka yang dipaparkan lalu ditolak validateContentBudget
  // walaupun ikut meter ni betul-betul. floor jamin baki yang dipapar SENTIASA selamat ditaip penuh.
  const remainingBrief = ceiling.maxTitle ? Math.max(0, Math.floor((1 - title.length / ceiling.maxTitle) * ceiling.maxBrief)) : ceiling.maxBrief;
  const remainingTitle = ceiling.maxBrief ? Math.max(0, Math.floor((1 - brief.length / ceiling.maxBrief) * ceiling.maxTitle)) : ceiling.maxTitle;
  const tone = !check.isValid ? 'text-[#a8241f]' : used > 0.9 ? 'text-amber-700' : 'text-emerald-700';
  const barTone = !check.isValid ? 'bg-[#a8241f]' : used > 0.9 ? 'bg-amber-600' : 'bg-emerald-600';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={labelCls}>Bajet kandungan (Tajuk + Huraian ringkas)</span>
        <span className={`font-mono text-[10px] font-bold tabular-nums ${tone}`}>{Math.round(used * 100)}%</span>
      </div>
      <div className="h-[3px] w-full rounded-full bg-stone-200 overflow-hidden">
        <div className={`h-full transition-all duration-200 ${barTone}`} style={{ width: `${Math.min(used, 1) * 100}%` }} />
      </div>
      <span className="font-sans text-[10px] text-stone-400">
        Tajuk <span className={`font-mono tabular-nums ${!check.isValid ? 'text-[#a8241f]' : ''}`}>{title.length}</span>/<span className="font-mono tabular-nums">{ceiling.maxBrief > 0 ? remainingTitle : ceiling.maxTitle}</span>
        {ceiling.maxBrief > 0 && (
          <> · Huraian ringkas <span className={`font-mono tabular-nums ${!check.isValid ? 'text-[#a8241f]' : ''}`}>{brief.length}</span>/<span className="font-mono tabular-nums">{remainingBrief}</span></>
        )}
        {/* Arah panduan bergantung jenis pelanggaran — "pendekkan" salah arah untuk kes huraian
            TERLALU PENDEK (2026-08-08, permintaan Izzat), yang perlu PANJANGKAN sebaliknya. */}
        {!check.isValid && (
          <span className="text-[#a8241f]"> · {check.reason && (check.reason.includes('terlalu pendek') || check.reason.includes('terlalu ringkas')) ? 'panjangkan tajuk/huraian' : 'pendekkan kandungan'}</span>
        )}
      </span>
    </div>
  );
}

// Ctrl/Cmd+I — bungkus/nyahbungkus teks disorot dengan `*...*` (2026-08-16, Izzat: "kenapa tak
// boleh italickan perkataan dlm tajuk/huraian ... guna keyboard?"). Medan-medan ni `<textarea>`/
// `<input>` HTML biasa — TIADA sokongan format terbina-dalam, dan sebelum ni TIADA `onKeyDown`
// langsung, jadi Ctrl+I tak buat apa-apa. Format condong sebenarnya SUDAH wujud (parser pembaca,
// src/utils.tsx baris ~521, tukar `*teks*` -> `<em>`), cuma editor terpaksa taip asterisk tu
// SENDIRI secara manual sebab tiada petunjuk/kekunci pintasan — sekarang Ctrl/Cmd+I bungkus
// terus teks yang disorot, atau nyahbungkus jika sudah bertanda `*...*` (togol, macam Word).
// Tiada apa-apa berlaku jika tiada teks disorot (elak sisipan asterisk tunggal mengelirukan).
function tanganiKekunciItalic(
  e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  value: string,
  onChange: (v: string) => void
) {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'i') return;
  e.preventDefault();
  const el = e.currentTarget;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  if (start === end) return; // tiada sorotan — tiada apa boleh ditogol
  const selected = value.slice(start, end);

  let baharu: string, mulaBaharu: number, akhirBaharu: number;
  if (selected.length >= 2 && selected.startsWith('*') && selected.endsWith('*')) {
    // Sorotan MERANGKUMI asterisk (cth. sorot "*Bidang*" penuh) — nyahbungkus.
    const dalam = selected.slice(1, -1);
    baharu = value.slice(0, start) + dalam + value.slice(end);
    mulaBaharu = start; akhirBaharu = start + dalam.length;
  } else if (start >= 1 && end <= value.length - 1 && value[start - 1] === '*' && value[end] === '*') {
    // Sorotan DALAM asterisk sedia ada (cth. sorot "Bidang" dlm "*Bidang*") — nyahbungkus.
    baharu = value.slice(0, start - 1) + selected + value.slice(end + 1);
    mulaBaharu = start - 1; akhirBaharu = end - 1;
  } else {
    baharu = value.slice(0, start) + '*' + selected + '*' + value.slice(end);
    mulaBaharu = start + 1; akhirBaharu = end + 1;
  }
  onChange(baharu);
  requestAnimationFrame(() => { el.setSelectionRange(mulaBaharu, akhirBaharu); el.focus(); });
}

function Field({ label, value, onChange, rows, placeholder, maxLen, minLen, hint, type }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; maxLen?: number; minLen?: number; hint?: string; type?: 'text' | 'date' }) {
  const over = typeof maxLen === 'number' && value.length > maxLen;
  const under = typeof minLen === 'number' && value.length > 0 && value.length < minLen;
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className={`${labelCls} flex items-baseline gap-1.5`}>
          {label}
          {hint && <span className="font-sans normal-case tracking-normal font-normal text-stone-400">{hint}</span>}
        </span>
        {typeof maxLen === 'number' && (
          <span className={`font-mono text-[9px] tabular-nums ${over || under ? 'text-[#a8241f]' : 'text-stone-400'}`}>
            {value.length}/{maxLen}{typeof minLen === 'number' && <> · min {minLen}</>}
          </span>
        )}
      </span>
      {under && <span className="font-sans text-[9px] text-[#a8241f] -mt-0.5">{minLen - value.length} aksara lagi diperlukan (minimum {minLen})</span>}
      {rows ? (
        <textarea
          rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => tanganiKekunciItalic(e, value, onChange)}
          className="w-full resize-none border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm leading-relaxed text-stone-800 py-1.5 transition-colors"
        />
      ) : (
        <input
          type={type || 'text'} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => tanganiKekunciItalic(e, value, onChange)}
          className="w-full border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
        />
      )}
    </label>
  );
}

// Jenis Sumber (Fasa 8b, 2026-08-05) — dropdown Teks/Audio/Video.
//
// DISEMBUNYIKAN drpd borang (2026-08-16, arahan Izzat) — audit langsung (rujuk kandungan ujian
// slot Angkasa, rujukan video YouTube) dedah medan ni SIA-SIA sepenuhnya: nilai disimpan ke DB
// pada setiap simpanan tapi TAK PERNAH dibaca semula di mana-mana (bukan pada kad awam, bukan
// Focus View, bukan buildAiPrompt() — disahkan grep MENYELURUH `sourceType` merentasi src/,
// SlotManagerModal.tsx SATU-SATUNYA fail yang sentuh medan ni). detectSourceType() (auto-kesan
// drpd URL) turut wujud tapi cuma disambung ke laluan RSS/templat lama, bukan borang ni.
// Keputusan Izzat: "hilangkan dahulu sehingga sistem benar2 boleh menyokong arahan AI utk jana
// kandungan drpd sumber audio dan video" — iaitu sehingga buildAiPrompt() betul-betul beri
// amaran/layanan khas bila sumber video/audio (lihat CLAUDE.md), BUKAN sekadar label kosmetik.
// Medan `sourceType`/lajur DB TAK disentuh (data sejarah kekal, PATCH masih hantar nilai lama
// tanpa berubah) — cuma kawalan UI ni yang dibuang, supaya senang disambung semula bila ciri
// video/audio sebenar dibina. JENIS_SUMBER_PILIHAN dikekalkan (tak digunakan buat masa ini) utk
// tak hilang senarai label bila disambung semula.
const JENIS_SUMBER_PILIHAN: { value: string; label: string }[] = [
  { value: 'web', label: 'Teks' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
];

// Pilihan tetap (2026-08-07, permintaan Izzat) — sebelum ini medan teks bebas, editor kena
// taip sendiri setiap kali walaupun cuma segelintir nilai munasabah wujud.
const HAD_USIA_SUMBER_PILIHAN: { value: string; label: string }[] = [
  { value: '24 jam', label: '24 jam' },
  { value: '1 minggu', label: '1 minggu' },
  { value: '1 bulan', label: '1 bulan' },
  { value: '1 tahun', label: '1 tahun' },
];
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <select
        value={value || options[0].value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}

// Medan boleh taip (URL/nama fail sedia ada) DAN muat naik terus — butang panggil
// /api/media/upload (base64 di badan JSON, lihat core/routes/mediaRoutes.js), tukar respons
// { url } jadi nilai medan. Tidak buang keupayaan taip terus, sebab kandungan sedia ada mungkin
// sudah rujuk fail/URL yang bukan hasil muat naik baharu.
function ImageField({ label, value, onChange, onUploadFile, uploading, note }: {
  label: string; value: string; onChange: (v: string) => void; onUploadFile: (file: File) => void; uploading?: boolean; note?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className={labelCls}>{label}</span>
        {note && <span className="font-sans text-[9px] text-stone-400">{note}</span>}
      </span>
      <span className="flex items-center gap-2">
        <input
          type="text" value={value} placeholder="Nama fail / URL imej" onChange={(e) => onChange(e.target.value)}
          className="w-0 flex-1 border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
        />
        <button
          type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2.5 py-1 border border-stone-300 rounded text-[11px] font-sans font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-wait"
        >
          <Upload className="w-3 h-3" />{uploading ? 'Memuat naik…' : 'Muat naik'}
        </button>
      </span>
      <input
        ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadFile(f); e.target.value = ''; }}
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={`${labelCls} flex items-center gap-1`}>{label} <Lock className="w-2.5 h-2.5 text-stone-300" /></span>
      <span className="font-serif text-sm text-stone-500 border-b border-stone-150 py-1.5">{value || '—'}</span>
    </div>
  );
}

// "Lulus" mesti gabung DUA pengesahan — bajet tajuk+huraian DAN had ruang eyebrow "Bidang | Topik"
// (validateBidangTopik) — bukan bajet sahaja. Dua-dua pengesahan ini KEKAL menyekat Simpan Slot di
// server.js (syncManualObjectsForSlot), jadi meter/lulus di sini mesti guna formula SAMA supaya
// tiada kandungan nampak "lulus" di modal tapi ditolak server semasa simpan.
function itemFits(slotIndex: number, desk: string, item: { title?: string; brief?: string; briefLong?: string; topik?: string }) {
  const budget = validateContentBudget(slotIndex, item.title || '', item.brief || '');
  if (!budget.isValid) return budget;
  // Had gloss (2026-08-12, keputusan Izzat) — semak SEBELUM Terbit, SAMA fungsi live spt
  // budget/Topik di atas (itemFits dipanggil setiap render sidebar + setiap klik Terbit), supaya
  // editor nampak mesej sebelum cuba hantar ke server, bukan cuma selepas 400 pulang.
  const gloss = validateGlossLength({ Tajuk: item.title, 'Huraian ringkas': item.brief, 'Huraian panjang': item.briefLong });
  if (!gloss.isValid) return gloss;
  return validateBidangTopik({ slotBidang: desk, itemBidang: desk, topik: item.topik || '', requireTopik: true, slotIndex });
}

// React.memo supaya baris sidebar yang TIDAK terjejas oleh keystroke semasa (biasanya 9
// daripada 10 kandungan) langkau render sepenuhnya, bukan sekadar cepat — mengelakkan React
// mendiffkan seluruh <ol> pada SETIAP aksara ditaip di kandungan aktif. Perbandingan shallow
// React.memo ni hanya berkesan kalau `item` kekal SAMA rujukan objek untuk kandungan yang tidak
// diedit (patch() hanya cipta objek baharu untuk index yang diedit) DAN onSelect/onMoveUp/
// onMoveDown/onRemove kekal STABIL merentasi render (useCallback([items.length]) di bawah).
const SidebarItem = React.memo(function SidebarItem({
  item, index, isActive, slotIndex, desk, onSelect, onMoveUp, onMoveDown, onRemove, confirmingBuang, onMintaBuang, onBatalBuang,
}: {
  item: any; index: number; isActive: boolean; slotIndex: number; desk: string;
  onSelect: (i: number) => void; onMoveUp: (i: number) => void; onMoveDown: (i: number) => void; onRemove: (i: number) => void;
  // DLG-03 (2B, audit ChatGPT 2026-08-09) — window.confirm() bersarang dalam modal custom
  // (useModalFokus focus-trap) ditukar ke pengesahan sebaris DALAM baris ni sendiri, sama
  // corak macam konfirmTutup/konfirmTukarKe di komponen induk (bukan window.confirm).
  confirmingBuang: boolean; onMintaBuang: (i: number) => void; onBatalBuang: () => void;
}) {
  // Senarai ni HANYA draf (2026-07-29, permintaan pemilik projek) — ✓/✕ di sini sekadar
  // pratonton sama ada kandungan SUDAH sedia untuk ditekan Terbit (bajet+Topik lulus), bukan
  // status sebenar (tiada lagi "Tunggu"/"Live" — kesemuanya draf sehingga Terbit ditekan).
  const check = itemFits(slotIndex, desk, item);
  if (confirmingBuang) {
    return (
      <li
        className="grid items-center gap-2.5 px-3 py-2.5 border-b border-stone-150 last:border-b-0 bg-[#802334]/5"
        style={{ gridTemplateColumns: '26px 1fr auto' }}
      >
        <span className="font-mono text-[11px] font-bold tabular-nums text-stone-400">{String(index + 1).padStart(2, '0')}</span>
        <span className="font-sans text-[11px] text-stone-700 leading-snug">Padam kandungan ini? Tak boleh dibuat asal selepas disimpan.</span>
        <span className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={onBatalBuang} className="font-sans text-[11px] font-semibold text-stone-500 hover:text-stone-700 cursor-pointer">Batal</button>
          <button type="button" onClick={() => onRemove(index)} className="font-sans text-[11px] font-semibold text-white bg-[#802334] hover:bg-[#6b1d2b] rounded px-2 py-1 cursor-pointer">Padam</button>
        </span>
      </li>
    );
  }
  return (
    <li
      onClick={() => onSelect(index)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(index); } }}
      className={`group grid items-center gap-2.5 px-3 py-2.5 cursor-pointer border-b border-stone-150 last:border-b-0 transition-colors ${isActive ? 'bg-[#802334]/[0.04] shadow-[inset_2px_0_0_#802334]' : 'hover:bg-stone-50'}`}
      style={{ gridTemplateColumns: '26px 1fr auto' }}
    >
      <span className={`font-mono text-[11px] font-bold tabular-nums ${isActive ? 'text-[#802334]' : 'text-stone-400'}`}>{String(index + 1).padStart(2, '0')}</span>
      <span className={`font-serif text-[13px] leading-snug truncate ${isActive ? 'text-stone-900 font-medium' : 'text-stone-600'}`}>
        {item.title || <span className="text-stone-400 italic">Tiada tajuk</span>}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="hidden group-hover:flex group-focus-within:flex items-center gap-1.5">
          <button type="button" aria-label="Naik" onClick={(e) => { e.stopPropagation(); onMoveUp(index); }} className="text-stone-500 hover:text-[#802334] px-0.5"><ChevronUp size={13} /></button>
          <button type="button" aria-label="Turun" onClick={(e) => { e.stopPropagation(); onMoveDown(index); }} className="text-stone-500 hover:text-[#802334] px-0.5"><ChevronDown size={13} /></button>
          <button type="button" aria-label="Buang" onClick={(e) => { e.stopPropagation(); onMintaBuang(index); }} className="text-[#a8241f] px-0.5"><Trash2 size={12} /></button>
        </span>
        <Tooltip text={check.isValid ? 'Sedia untuk Terbit' : check.reason}>
          <span className={`group-hover:hidden group-focus-within:hidden font-mono text-[9px] ${check.isValid ? 'text-emerald-700' : 'text-[#a8241f]'}`}>
            {check.isValid ? '✓' : '✕'}
          </span>
        </Tooltip>
      </span>
    </li>
  );
});

export const SlotManagerModal: React.FC<SlotManagerModalProps> = ({
  editingSlotIndex, formConfig, setFormConfig, activeBidangList, currentEditoriumRole, currentEditoriumName, onClose, onSave,
  slotOptions, onSwitchSlot, initialUuid, saveError, onToast, onLihatIndeks,
}) => {
  // Kandungan mana yang terbuka dahulu. Lalai yang pertama; bila dibuka daripada "Draf Saya"
  // (initialUuid), terus mendarat pada draf yang diklik. Sengaja dikira dalam initializer useState
  // (dijalankan SEKALI semasa mount, sama macam `items` di bawah) dan bukan useEffect selepas
  // render — kalau tidak, kandungan pertama sempat terpapar sekelip mata sebelum bertukar.
  const [active, setActive] = useState(() => {
    if (!initialUuid) return 0;
    // Indeks mesti dikira daripada senarai DITAPIS sama macam `items` di bawah (2026-08-08,
    // Fasa 3) — kalau tidak, indeks daripada senarai PENUH (termasuk blok orang lain yang
    // tersembunyi) tak sepadan kedudukan sebenar dalam `items`, mendaratkan editor pada draf
    // yang salah.
    const i = parseManualSummaryBlocks(formConfig.manualSummary || '')
      .filter((b: any) => !b.penulis || b.penulis === currentEditoriumName)
      .findIndex((b: any) => b.uuid === initialUuid);
    return i >= 0 ? i : 0;
  });
  const [tab, setTab] = useState<'borang' | 'maklumat' | 'ai' | 'sejarah'>('borang');
  const [pasteNote, setPasteNote] = useState('');
  const [aiNote, setAiNote] = useState('');
  const [referenceUrlNote, setReferenceUrlNote] = useState('');
  const [imageNote, setImageNote] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Editor(s) DITUGASKAN kepada slot ni (2026-08-01, permintaan pemilik projek) — maklumat
  // PERINGKAT SLOT (ditetapkan di Senarai Slot), berasingan daripada `editorName`/Penulis blok
  // (siapa MENULIS satu kandungan). Satu slot boleh ada lebih seorang editor, jadi ini senarai,
  // bukan satu nama. Dimuatkan sekali sahaja bila slot dibuka (key={editingSlotIndex} di
  // EditoriumView memaksa remount setiap tukar slot, sama corak macam `items` di atas).
  const [editorSlot, setEditorSlot] = useState<{ nama: string }[] | null>(null);
  // Bendera kegagalan (SLOT-02, audit ChatGPT 2026-08-08) — dahulu kegagalan fetch senyap jatuh
  // balik ke [] sama macam "memang tiada editor ditugaskan", tak boleh dibezakan editor tengok.
  const [gagalMuatEditorSlot, setGagalMuatEditorSlot] = useState(false);
  useEffect(() => {
    let batal = false;
    setGagalMuatEditorSlot(false);
    fetch('/api/system/slot-editors')
      .then((res) => res.json())
      .then((rows) => {
        if (batal || !Array.isArray(rows)) return;
        setEditorSlot(rows.filter((r: any) => r.slotIndex === editingSlotIndex));
      })
      .catch(() => {
        if (batal) return;
        setEditorSlot([]);
        setGagalMuatEditorSlot(true);
        // SLOT-3 (2A, audit ChatGPT 2026-08-09) — dahulu HANYA teks statik dlm medan, tak
        // guna onToast walaupun modal ni dah terima+guna prop tu di tempat lain (Terbit/Simpan).
        onToast?.('error', 'Gagal memuatkan senarai editor slot ini.');
      });
    return () => { batal = true; };
  }, [editingSlotIndex]);

  // Susun atur telefon (2026-08-05, permintaan Izzat — "modal urus slot utk versi telefon
  // bermasalah sangat") — grid tetap `minmax(240px, 32%) 1fr` di bawah paksa jalur Draf
  // sekurang-kurangnya 240px lebar walaupun modal sendiri cuma ~360-420px di telefon, tinggalkan
  // borang utama dikelar sangat sempit (~120-180px) — punca skrin tangkap Izzat tunjuk (borang
  // terpotong, perlu tatal mendatar). Struktur DUA-LAJUR SEBELAH-MENYEBELAH (Draf | Borang)
  // ditukar jadi SATU LAJUR bertindan (Draf jalur nipis atas, Borang penuh bawah) di telefon.
  const isPhone = usePhoneViewport();
  // Senarai Draf di telefon lalai TERTUTUP (2026-08-04, permintaan pemilik projek) — dengan
  // banyak draf (cth 100+) jalur senarai terbuka automatik akan makan ruang skrin telefon
  // yang terhad; dibuka bila diklik sahaja.
  const [drafTerbukaPhone, setDrafTerbukaPhone] = useState(false);
  // Pratonton Kad boleh ditutup/dibuka (2026-08-16, permintaan Izzat: "boleh ditutup dan dibuka
  // sbb takut makan ruang") — kini merentasi SEMUA tier (dahulu cuma KOMPAK terpampang tetap,
  // tiada togol). Lalai TERBUKA supaya tingkah laku sedia ada (KOMPAK) tak berubah tanpa sebab;
  // editor tutup sendiri bila perlukan ruang lajur borang.
  const [pratontonTerbuka, setPratontonTerbuka] = useState(true);
  const tier = tierForSlot(editingSlotIndex) || 'STANDARD';
  // Saiz grid dilekat pada nama tier (2026-08-08, permintaan Izzat) — supaya bentuk fizikal kad
  // kelihatan terus, bukan cuma nama. TIER_GRID_SIZE tiada kunci TICKER (bukan kad bento).
  const tierLabelDenganSaiz = `${TIER_LABELS[tier] || tier}${TIER_GRID_SIZE[tier] ? ` (${TIER_GRID_SIZE[tier]})` : ''}`;
  const ceiling = ceilingForSlot(editingSlotIndex);
  const desk = formConfig.manualDesk || '';
  const bidang = activeBidangList.find((b) => b.name.toLowerCase() === desk.toLowerCase());
  const accent = bidang?.color || '#802334';
  const hadTopik = topikCeilingForSlot(editingSlotIndex);

  // Slider bajet Tajuk/Huraian ringkas untuk prompt AI (2026-08-07, pepijat kritikal Izzat) —
  // editor laraskan SATU nilai (Tajuk), Huraian ringkas dikira automatik ikut formula bajet kongsi
  // sedia ada (sama formula BudgetMeter di atas: brief = (1 - title/maxTitle) * maxBrief), supaya
  // pasangan yang dihantar ke AI SENTIASA sah, tak pernah minta dua had solo yang mustahil dicapai
  // serentak. Sengaja state SESI modal ini sahaja (tak disimpan ke slots_config) — nilai selamat
  // lalai (separuh-separuh) setiap kali modal dibuka semula.
  const [aiTitleTarget, setAiTitleTarget] = useState<number | null>(null);
  const titleTarget = Math.min(ceiling.maxTitle, aiTitleTarget ?? Math.floor(ceiling.maxTitle / 2));
  // Math.floor (BUKAN Math.round) — dibuktikan perlu semasa ujian sebenar 2026-08-07: slider
  // pernah tunjuk 43/61 (Tajuk/Huraian) untuk HERO (maxTitle 52, maxBrief 350) sebagai "sentiasa
  // sah", tapi round-KE-ATAS 60.58 jadi 61 menolak titik sut sebenar (43/52 + 61/350 = 1.0012 >
  // 1) — validateContentBudget tolak PATCH ujian sebenar walaupun ikut slider betul-betul. floor
  // sentiasa bulat ke BAWAH, jamin jumlah nisbah <= 1 tanpa pengecualian.
  const briefTarget = ceiling.maxBrief > 0 ? Math.max(0, Math.floor((1 - titleTarget / ceiling.maxTitle) * ceiling.maxBrief)) : 0;

  // Giliran kandungan (items) hidup sebagai STATE TEMPATAN modal ni, BUKAN diterbitkan semula
  // daripada formConfig.manualSummary (rentetan teks) pada setiap keystroke. Menghurai SELURUH
  // blok teks (semua kandungan dalam giliran) + serialize semula pada SETIAP aksara ditaip di
  // MANA-MANA medan — untuk slot dengan banyak kandungan — cukup berat untuk keystroke tercicir
  // (bar ruang khususnya nampak paling terjejas). formConfig.manualSummary kini hanya di-SYNC
  // pada saat Simpan (handleSubmit di bawah, hantar serialize(items) TERUS sebagai argumen kepada
  // onSave — lihat nota manualSummaryOverride di SlotManagerModalProps) — bukan setiap keystroke.
  // useState() punya initializer hanya jalan SEKALI semasa mount; supaya ia betul-betul re-init
  // bila tukar slot (bukan bawa items lama), FrontpageView.tsx render komponen ni dengan
  // key={editingSlotIndex} — tukar slot = remount penuh, bukan sekadar prop baharu.
  const blankItem = (suffix: string | number = '') => ({
    uuid: `object-manual-slot${editingSlotIndex}-${Date.now()}${suffix}`,
    title: '', brief: '', briefLong: '', topik: '', source: '', url: '', sources: [], sourceType: '', date: '', note: '', image: '',
    // Alur kerja Draf/Terbit (2026-07-29, permintaan pemilik projek) — lalai DRAF untuk
    // kandungan BAHARU: tak sesekali live sehingga editor sedar-sedar tekan "Terbit". Kandungan
    // sedia ada yang dihurai daripada manualSummary (lihat parseManualSummaryBlocks) bawa status
    // sebenar tersimpan (lalai 'approved' kalau tiada baris Status: — blok lama sebelum ciri ni
    // wujud, memang live).
    status: 'draft',
    // Penulis (2026-08-01, permintaan pemilik projek — modul "Draf Saya"): dicap SEKALI semasa
    // blok dicipta, bukan pada setiap simpan — draf kekal milik orang yang memulakannya walaupun
    // editor lain dalam slot yang sama menyuntingnya kemudian. Kosong bila tiada sesi log masuk
    // (JANGAN cap EDITOR_PLACEHOLDER "—" di sini; itu simbol paparan, bukan nama orang).
    penulis: currentEditoriumName || '',
  });

  // Bekalkan SEKURANG-KURANGNYA satu blok kosong bila slot benar-benar kosong (bukan senarai
  // kosong) — sebelum ni borang PAPAR medan yang nampak boleh disunting walhal items=[] bermakna
  // patch() memetakan array KOSONG (tiada kesan, taipan hilang senyap) sehingga "+ Masukkan"
  // ditekan dulu. Reprodusi hidup: isi borang bila giliran kosong, tiada apa tersimpan.
  // Draf peribadi (2026-08-08, Fasa 3 pemilikan kandungan, keputusan Izzat — "ketua editor tak
  // boleh edit kandungan dlm modal urus slot tu jika ia ditulis oleh org lain. ni namanya
  // pencerobohan"). Blok milik editor LAIN dibuang terus daripada giliran — bukan dipapar baca-
  // sahaja, TAK KELIHATAN LANGSUNG. Ini termasuk Ketua Editor/Penolong; tiada pengecualian peranan
  // di sini, cuma "siapa mula menaip". Blok tanpa `penulis` (belum dicap, sepatutnya tak berlaku
  // sejak blankItem() cap serta-merta, tapi jaring keselamatan untuk keadaan pelik) dianggap
  // "belum dituntut" — kelihatan kepada semua sehingga seseorang menyuntingnya.
  //
  // KRITIKAL: penapisan ni bermakna array `items` di sini TAK PERNAH memegang blok orang lain —
  // simpanan (serializeManualBentoQueue(items)) yang dihantar ke server juga tak membawanya. Kalau
  // server tulis-ganti manualSummary DENGAN blob ni SAHAJA, draf semua editor lain dalam slot yang
  // sama akan PADAM. Server (slotsConfigRoutes.js) WAJIB gabung semula blok orang lain daripada
  // versi tersimpan sebelum menulis — lihat kekalkanDrafOrangLain() di situ. Jangan alih keluar
  // penapisan ni tanpa mengalih keluar gabungan server jugak, dan sebaliknya.
  const [items, setItems] = useState<any[]>(() => {
    const parsed = parseManualSummaryBlocks(formConfig.manualSummary || '')
      .filter((it) => !it.penulis || it.penulis === currentEditoriumName);
    return parsed.length > 0 ? parsed : [blankItem()];
  });
  const activeIndex = Math.max(0, Math.min(active, items.length - 1));
  const current = items[activeIndex] || blankItem();
  // Penjaga dirty (2026-08-02, Fasa 6) — sebelum ni tutup modal (X) buang draf ditaip tanpa
  // sebarang amaran; hanya laluan "tukar slot" (handleSwitchSlot di bawah) yang disemak. Definisi
  // sama macam di sana: ada tajuk/huraian sebenar ditaip (bukan cuma baris kosong "+ Masukkan"
  // belum disentuh) di MANA-MANA kandungan dalam giliran.
  //
  // Skop diperluas (2026-08-07, Audit UI/UX §B5) — sebelum ni HANYA title/brief disemak, jadi
  // menyunting briefLong/topik/source/url/imej langsung TIDAK mencetuskan amaran tutup langsung
  // (kerja hilang senyap). Semak SEMUA medan boleh sunting dalam `blankItem()` di atas, bukan dua
  // sahaja.
  const itemHasContent = (it: any) => (
    (it.title || '').trim() || (it.brief || '').trim() || (it.briefLong || '').trim() ||
    (it.topik || '').trim() || (it.source || '').trim() || (it.url || '').trim() ||
    (it.image || '').trim() ||
    (Array.isArray(it.sources) && it.sources.some((s: any) => (s?.name || '').trim() || (s?.url || '').trim()))
  );
  const hasUnsavedWork = items.some(itemHasContent);

  // Auto-simpan draf SENYAP (2026-08-08) — localStorage SAHAJA, tak pernah sentuh pelayan (lihat
  // src/hooks/useAutoSimpanTempatan.ts untuk sebab). Kunci ikut slot+editor supaya draf tempatan
  // seorang editor tak pernah tersilap dipulihkan untuk editor lain kongsi slot sama.
  const kunciDrafTempatan = `adjung-draf-tempatan-slot-${editingSlotIndex}-${currentEditoriumName || 'tanpa-nama'}`;
  const { disimpanPada } = useAutoSimpanTempatan(kunciDrafTempatan, items, hasUnsavedWork);
  // Tawaran pulih SEKALI sahaja semasa mount — snapshot tempatan drpd sesi/tab lalu yang crash
  // sebelum sempat "Simpan Draf"/"Terbit" (bukan drpd Draf Saya, yang datang terus daripada
  // pelayan). Cuma tawar kalau snapshot BERBEZA drpd apa yang baru dimuat dari pelayan.
  const [tawaranPulih, setTawaranPulih] = useState<{ items: any[]; pada: number } | null>(() => {
    const snapshot = bacaDrafTempatan<any[]>(kunciDrafTempatan);
    if (!snapshot) return null;
    const sama = JSON.stringify(snapshot.nilai) === JSON.stringify(items);
    return sama ? null : { items: snapshot.nilai, pada: snapshot.pada };
  });
  const pulihkanDrafTempatan = () => {
    if (!tawaranPulih) return;
    commit(() => tawaranPulih.items);
    setTawaranPulih(null);
  };
  const buangTawaranPulih = () => {
    buangDrafTempatan(kunciDrafTempatan);
    setTawaranPulih(null);
  };

  // Pengesahan dalam-aplikasi untuk Tutup/Tukar Slot (bukan `window.confirm`) — sama falsafah
  // audit UI/UX §E1/§B4 yang dah dipakai di NotaKetuaEditorConsole. window.confirm() blocking
  // native boleh disenyapkan pelayar selepas beberapa kali dicetuskan berturut-turut ("Prevent
  // this page from creating additional dialogs"), lepas tu butang X nampak "tak boleh ditekan"
  // langsung tanpa sebarang respons — ditemui 2026-08-08 semasa ujian sebenar Izzat.
  const [konfirmTutup, setKonfirmTutup] = useState(false);
  const [konfirmTukarKe, setKonfirmTukarKe] = useState<number | null>(null);
  // DLG-03 (2B, audit ChatGPT 2026-08-09) — remove() guna window.confirm() bersarang DALAM
  // modal custom ni yang dah pakai useModalFokus (focus-trap). Dialog native pelayar berada
  // di luar kawalan focus-management aplikasi — boleh berlanggar dgn trap, dan sama isu
  // "disenyapkan pelayar" macam konfirmTutup/konfirmTukarKe atas. Sama corak.
  const [konfirmBuangIndex, setKonfirmBuangIndex] = useState<number | null>(null);

  const commit = (mutator: (prevItems: any[]) => any[]) => setItems((prev) => mutator(prev));
  const patch = (i: number, key: string, value: string) => commit((prevItems) => (
    // Sama pertahanan macam initializer di atas — kalau entah bagaimana items jadi kosong (cth.
    // remove() buang kandungan terakhir), patch() masih WAJIB ada sesuatu untuk disunting, bukan
    // no-op senyap.
    prevItems.length > 0
      ? prevItems.map((it, n) => (n === i ? { ...it, [key]: value } : it))
      : [{ ...blankItem(), [key]: value }]
  ));

  // Sumber berbilang (2026-08-05, permintaan Izzat) — `it.sources` senarai {name,url,date}[].
  // `source`/`url`/`date` tunggal legasi diselaraskan SEKALI di sini (entri pertama) supaya kad/
  // pautan lama yang masih baca medan tunggal terus betul tanpa perlu ubah kod lain — satu tempat
  // sahaja. Medan `date` per-sumber (2026-08-15, permintaan Izzat — sumber berbeza boleh ada
  // tarikh terbitan berbeza, satu tarikh dikongsi mengelirukan/kehilangan maklumat).
  const selarasSumberLegasi = (it: any) => ({
    ...it,
    source: (it.sources && it.sources[0]?.name) || '',
    url: (it.sources && it.sources[0]?.url) || '',
    date: (it.sources && it.sources[0]?.date) || it.date || '',
  });
  const patchSumber = (i: number, sIdx: number, field: 'name' | 'url' | 'date', value: string) => commit((prevItems) => (
    prevItems.map((it, n) => {
      if (n !== i) return it;
      const sources = (it.sources && it.sources.length > 0) ? [...it.sources] : [{ name: it.source || '', url: it.url || '', date: it.date || '' }];
      sources[sIdx] = { ...sources[sIdx], [field]: value };
      return selarasSumberLegasi({ ...it, sources });
    })
  ));
  const tambahSumber = (i: number) => commit((prevItems) => (
    prevItems.map((it, n) => {
      if (n !== i) return it;
      const sources = (it.sources && it.sources.length > 0) ? [...it.sources] : [{ name: it.source || '', url: it.url || '', date: it.date || '' }];
      sources.push({ name: '', url: '', date: '' });
      return selarasSumberLegasi({ ...it, sources });
    })
  ));
  const buangSumber = (i: number, sIdx: number) => commit((prevItems) => (
    prevItems.map((it, n) => {
      if (n !== i) return it;
      const sources = (it.sources && it.sources.length > 0) ? [...it.sources] : [{ name: it.source || '', url: it.url || '', date: it.date || '' }];
      const next = sources.filter((_: any, idx: number) => idx !== sIdx);
      return selarasSumberLegasi({ ...it, sources: next.length > 0 ? next : [{ name: '', url: '', date: '' }] });
    })
  ));
  // useCallback([items.length]): identiti KEKAL STABIL sepanjang menaip biasa (panjang giliran tak
  // berubah bila sekadar mengedit medan), hanya berubah identiti bila kandungan ditambah/dibuang/
  // disusun semula. SidebarItem (React.memo) bergantung pada kestabilan ni untuk boleh melangkau
  // render baris sidebar yang tidak terjejas setiap keystroke.
  const move = useCallback((i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    commit((prevItems) => {
      const next = prevItems.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setActive(j);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);
  // Amaran sebelum padam (DLG-03, audit ChatGPT 2026-08-09) — dahulu window.confirm() (lihat
  // nota konfirmBuangIndex atas kenapa ditukar). mintaBuang() buka pengesahan SEBARIS dalam
  // SidebarItem sendiri; remove() (dipanggil selepas "Padam" ditekan) yang benar-benar buang —
  // kekal stabil merentasi keystroke, lihat nota useCallback asal, sengaja tak bergantung pada
  // `items` penuh untuk baca tajuk.
  const mintaBuang = useCallback((i: number) => setKonfirmBuangIndex(i), []);
  const batalBuang = useCallback(() => setKonfirmBuangIndex(null), []);
  const remove = useCallback((i: number) => {
    commit((prevItems) => prevItems.filter((_, n) => n !== i));
    setActive((a) => Math.max(0, Math.min(a, items.length - 2)));
    setKonfirmBuangIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);
  const moveUp = useCallback((i: number) => move(i, -1), [move]);
  const moveDown = useCallback((i: number) => move(i, 1), [move]);
  const insert = () => {
    commit((prevItems) => [...prevItems, blankItem()]);
    setActive(items.length);
  };

  // AI luaran boleh pulangkan SATU kandungan (tampal ke medan aktif) atau BERBILANG kandungan
  // dipisah "____"/"----"/"====" (ikut [Jumlah kandungan] dalam prompt Arahan AI) — kes kedua
  // mesti dipisah dulu sebelum dihurai, atau setiap label ("Tajuk:", dll) yang berulang akan
  // saling timpa dan cuma blok TERAKHIR selamat.
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsedBlocks = parseManualSummaryBlocks(text);
      if (parsedBlocks.length === 0) {
        setPasteNote('Format tidak dikenali');
      } else {
        const replacement = parsedBlocks.map((b, i) => ({
          uuid: b.uuid || `object-manual-slot${editingSlotIndex}-${Date.now()}-${i}`,
          // Modal ni ruang draf sahaja (2026-07-29, permintaan pemilik projek) — apa jua ditampal
          // masuk sebagai draf, editor tekan Terbit sendiri bila sedia (tiada lagi status
          // "pending" separa-terbit tersembunyi sebelum Terbit ditekan).
          status: 'draft',
          title: b.title, topik: b.topik, brief: b.brief, briefLong: b.briefLong,
          // sources[].date (2026-08-16, pepijat simulasi "Tampal" Izzat) — normalkanTarikhISO()
          // sebelum ni cuma diguna pada medan `date` legasi TUNGGAL (di bawah), tapi kandungan
          // berbilang sumber (mod "Dengan rujukan" >1 URL) bawa tarikh SEBENAR dalam sources[].date
          // setiap entri, bukan `date` (yang kekal kosong bila sources.length > 1, lihat
          // ManualBlockFormat.js). Tanpa normalize di sini, tarikh AI-tulis (cth "13 Ogos 2026")
          // tersalin mentah ke sources[i].date, <input type="date"> native papar KOSONG sebab
          // format tak sepadan ISO tepat — editor sangka tarikh hilang, bukan cuma tak dipaparkan.
          source: b.source, url: b.url,
          sources: (b.sources || []).map((s: any) => ({ ...s, date: normalkanTarikhISO(s.date) })),
          sourceType: b.sourceType, date: normalkanTarikhISO(b.date), note: b.note, image: b.image,
          // Blok yang ditampal biasanya datang daripada AI luaran (tiada baris Penulis:) — yang
          // menampal itulah penulisnya. Kalau teks yang ditampal MEMANG sudah membawa nama
          // (cth. draf disalin daripada slot lain), nama asal itu dikekalkan.
          penulis: b.penulis || currentEditoriumName || '',
        }));
        commit((prevItems) => {
          const next = prevItems.slice();
          next.splice(activeIndex, 1, ...replacement);
          return next;
        });
        setActive(activeIndex);
        setPasteNote(parsedBlocks.length > 1 ? `${parsedBlocks.length} kandungan ditampal` : 'Ditampal ke medan berkaitan');
      }
    } catch (e) { setPasteNote('Akses papan klip ditolak'); }
    setTimeout(() => setPasteNote(''), 2400);
  };

  // Urus sources[] mod "Dengan rujukan" (formConfig.aiPromptSource, JSON-encoded) -- selari
  // dgn tambahSumber/patchSumber/buangSumber sedia ada utk borang kandungan (items), tapi
  // target formConfig bukan items sebab ni tetapan slot, bukan draf kandungan.
  const tambahSumberRujukan = () => setFormConfig((prev: any) => {
    const list = parseReferenceSources(prev.aiPromptSource);
    return { ...prev, aiPromptSource: serializeReferenceSources([...list, { name: '', url: '' }]) };
  });
  const patchSumberRujukan = (sIdx: number, field: 'name' | 'url', value: string) => setFormConfig((prev: any) => {
    const list = parseReferenceSources(prev.aiPromptSource);
    if (list.length === 0) list.push({ name: '', url: '' });
    const next = list.map((s, i) => (i === sIdx ? { ...s, [field]: value } : s));
    return { ...prev, aiPromptSource: serializeReferenceSources(next) };
  });
  const buangSumberRujukan = (sIdx: number) => setFormConfig((prev: any) => {
    const list = parseReferenceSources(prev.aiPromptSource);
    return { ...prev, aiPromptSource: serializeReferenceSources(list.filter((_, i) => i !== sIdx)) };
  });

  const copyPrompt = async () => {
    // Mod "Dengan rujukan" WAJIB ada URL sah -- kosong TIDAK jatuh balik senyap ke "AI cari
    // sendiri" (audit ChatGPT 2026-08-15: itu cipta mod ketiga tersembunyi yang mengelirukan,
    // dan bagi editor ilusi kawalan yang sebenarnya tiada -- severity Tinggi kalau tak dikuatkuasakan).
    if (formConfig.genMode === 'dengan_rujukan') {
      const sources = parseReferenceSources(formConfig.aiPromptSource);
      const urls = sources.map((s) => s.url.trim()).filter(Boolean);
      if (urls.length === 0) {
        setReferenceUrlNote('Sekurang-kurangnya satu URL sumber diperlukan untuk mod "Dengan rujukan".');
        setTimeout(() => setReferenceUrlNote(''), 3200);
        return;
      }
      const takSah = urls.find((u) => !urlFormatSah(u));
      if (takSah) {
        setReferenceUrlNote(`URL tidak sah (${takSah}) — mesti bermula dengan http:// atau https://.`);
        setTimeout(() => setReferenceUrlNote(''), 3200);
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(buildAiPrompt(formConfig, ceiling, hadTopik, titleTarget, briefTarget));
      setAiNote('Disalin');
    } catch (e) { setAiNote('Akses papan klip ditolak'); }
    setTimeout(() => setAiNote(''), 2400);
  };

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  const uploadImage = async (i: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      setImageNote('Fail mesti imej');
      setTimeout(() => setImageNote(''), 2400);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageNote('Fail terlalu besar (had 5MB)');
      setTimeout(() => setImageNote(''), 2400);
      return;
    }
    setUploadingImage(true);
    try {
      const fileData: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Gagal baca fail'));
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, fileData }),
      });
      if (!res.ok) throw new Error('Muat naik gagal');
      const data = await res.json();
      patch(i, 'image', data.url);
      setImageNote('Dimuat naik');
    } catch (e) {
      setImageNote('Muat naik gagal, cuba lagi');
    } finally {
      setUploadingImage(false);
      setTimeout(() => setImageNote(''), 2400);
    }
  };

  // Butang "Terbit" (2026-07-29, permintaan pemilik projek) — AKSI SEGERA, bukan togol status.
  // Klik Terbit hantar SATU kandungan terus ke server (status='pending' utk permintaan ni
  // sahaja, tak diubah pada state tempatan), server cipta rekod Indeks rasmi & pulangkan
  // manualSummary draf-sahaja. Bila berjaya, kandungan tu terus BUANG daripada senarai draf
  // tempatan — modal ni kekal terbuka, ruang draf peribadi sahaja (tiada lagi kumpulan "Akan
  // Diterbitkan" — kandungan sama ada Draf DI SINI, atau sudah Pending DI Indeks, tiada keadaan
  // pertengahan yang kelihatan).
  const [publishingIndex, setPublishingIndex] = useState<number | null>(null);
  const [publishError, setPublishError] = useState('');

  // WF-03 (Pusingan 5, audit ChatGPT 2026-08-09; skop+wording disahkan Izzat) — "Terbit Semua"
  // dalam giliran slot SEMASA sahaja. Endpoint POST /api/system/slots ialah SATU transaksi
  // semua-atau-tiada (server.js, BEGIN TRANSACTION tanpa try/catch per-item) — jadi "kegagalan
  // separa" TIDAK bermaksud sesetengah item ditolak pelayan walau dihantar bersama; ia bermaksud
  // item yang TAK LULUS itemFits() langsung TAK dihantar (kekal draf), manakala yang lulus
  // dihantar SEKALI dan sama ada semua berjaya atau semua gagal (ralat rangkaian/kebenaran/
  // konflik). Ini konsisten dgn seni bina sebenar, bukan reka andaian baharu.
  const [terbitSemuaBerjalan, setTerbitSemuaBerjalan] = useState(false);
  const [confirmTerbitSemua, setConfirmTerbitSemua] = useState(false);
  const [ringkasanTerbitSemua, setRingkasanTerbitSemua] = useState<{ berjaya: number; pending: number; gagal: { title: string; reason: string }[] } | null>(null);
  const itemsLulus = items.filter((it) => itemFits(editingSlotIndex, desk, it).isValid);
  const itemsGagal = items
    .map((it) => ({ it, check: itemFits(editingSlotIndex, desk, it) }))
    .filter(({ check }) => !check.isValid)
    .map(({ it, check }) => ({ title: it.title || '(tiada tajuk)', reason: check.reason || 'Tidak lulus bajet ruang kad atau Topik.' }));
  const terbitSemua = async () => {
    setConfirmTerbitSemua(false);
    if (itemsLulus.length === 0) return;
    setTerbitSemuaBerjalan(true);
    const lulusSet = new Set(itemsLulus);
    const outgoing = items.map((it) => (lulusSet.has(it) ? { ...it, status: 'pending' } : it));
    const remainingDrafts = items.filter((it) => !lulusSet.has(it));
    const ok = await onSave({ preventDefault: () => {} } as React.FormEvent, serializeManualBentoQueue(outgoing), { closeOnSuccess: false });
    setTerbitSemuaBerjalan(false);
    if (ok) {
      const hasil = Array.isArray(ok) ? ok : [];
      const berjaya = hasil.filter((h: any) => h?.status !== 'pending').length;
      const pending = hasil.filter((h: any) => h?.status === 'pending').length;
      commit(() => remainingDrafts);
      setActive((a) => Math.max(0, Math.min(a, remainingDrafts.length - 1)));
      setFormConfig((prev: any) => ({ ...prev, manualSummary: serializeManualBentoQueue(remainingDrafts) }));
      buangDrafTempatan(kunciDrafTempatan);
      setRingkasanTerbitSemua({ berjaya, pending, gagal: itemsGagal });
      onLihatIndeks && onToast?.(
        'success',
        `${hasil.length} kandungan diterbitkan.`,
        { label: 'Lihat di Indeks →', onClick: () => onLihatIndeks({ slot: `Slot ${editingSlotIndex + 1}` }) }
      );
      if (!onLihatIndeks) onToast?.('success', `${hasil.length} kandungan diterbitkan.`);
    } else {
      const mesej = saveError || labelUi('toast.gagal_terbit');
      setPublishError(mesej);
      setTimeout(() => setPublishError(''), 5000);
      onToast?.('error', mesej);
    }
  };

  const publishOne = async (i: number) => {
    const item = items[i];
    const check = itemFits(editingSlotIndex, desk, item);
    if (!check.isValid) {
      setPublishError(check.reason || 'Kandungan ini tidak lulus bajet ruang kad atau Topik.');
      setTimeout(() => setPublishError(''), 8000);
      return;
    }
    setPublishingIndex(i);
    const outgoing = items.map((it, n) => (n === i ? { ...it, status: 'pending' } : it));
    const remainingDrafts = items.filter((_, n) => n !== i);
    const ok = await onSave({ preventDefault: () => {} } as React.FormEvent, serializeManualBentoQueue(outgoing), { closeOnSuccess: false });
    setPublishingIndex(null);
    if (ok) {
      commit(() => remainingDrafts);
      setActive((a) => Math.max(0, Math.min(a, remainingDrafts.length - 1)));
      setFormConfig((prev: any) => ({ ...prev, manualSummary: serializeManualBentoQueue(remainingDrafts) }));
      buangDrafTempatan(kunciDrafTempatan);
      // Mesej tepat ikut status SEBENAR (LIFE-01, audit ChatGPT 2026-08-08) — dahulu sentiasa
      // papar "diterbitkan" walaupun kandungan mendarat 'pending' (Terbit Sendiri tak dibenarkan,
      // jadi masuk giliran Menunggu Semakan Ketua Editor/Penolong). `outgoing` di atas tandakan
      // SATU-SATUNYA item bukan-draf dlm penghantaran ni, jadi `ok` (array publishOutcomes)
      // sentiasa ada tepat SATU hasil di sini.
      const hasil = Array.isArray(ok) ? ok[0] : undefined;
      const statusSebenar = hasil?.status === 'pending' ? 'Pending' : 'Live';
      // WF-01 (Pusingan 5, audit ChatGPT 2026-08-09) — "Lihat di Indeks ->" bawa editor terus
      // ke rekod baharu, ditapis ikut STATUS SEBENAR respons pelayan (bukan andaian tetap),
      // sepadan pelajaran LIFE-01: pelayan ialah sumber kebenaran, bukan satu mesej hardcode.
      onToast?.(
        'success',
        hasil?.status === 'pending'
          ? 'Kandungan dihantar dan kini Menunggu Semakan.'
          : 'Kandungan diterbitkan.',
        onLihatIndeks ? { label: 'Lihat di Indeks →', onClick: () => onLihatIndeks({ slot: `Slot ${editingSlotIndex + 1}`, status: statusSebenar }) } : undefined
      );
    } else {
      const mesej = saveError || labelUi('toast.gagal_terbit');
      setPublishError(mesej);
      setTimeout(() => setPublishError(''), 5000);
      onToast?.('error', mesej);
    }
  };

  // "Simpan sebagai draf" (2026-07-29, permintaan pemilik projek) — butang Batal/Simpan
  // keseluruhan modal di footer DIBUANG terus (tiada fungsi lagi selepas Terbit jadi aksai
  // segera per-kandungan). Ganti dengan aksi eksplisit di bawah borang, sama tempat macam
  // Terbit: hantar SELURUH giliran draf semasa ke server (persist), modal KEKAL terbuka.
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftNote, setDraftNote] = useState('');
  const saveDraft = async () => {
    setSavingDraft(true);
    const manualSummary = serializeManualBentoQueue(items);
    const ok = await onSave({ preventDefault: () => {} } as React.FormEvent, manualSummary, { closeOnSuccess: false });
    setSavingDraft(false);
    if (ok) {
      setFormConfig((prev: any) => ({ ...prev, manualSummary }));
      buangDrafTempatan(kunciDrafTempatan);
      setDraftNote(labelUi('toast.draf_disimpan'));
      setTimeout(() => setDraftNote(''), 2400);
      onToast?.('success', 'Draf disimpan.');
    } else {
      const mesej = saveError || labelUi('toast.gagal_simpan_draf');
      setPublishError(mesej);
      setTimeout(() => setPublishError(''), 5000);
      onToast?.('error', mesej);
    }
  };

  // Sejarah versi sebenar (Fasa 6, 2026-08-02) — item DRAF (status 'draft', belum tekan Terbit)
  // tiada baris editorial_objects langsung, jadi tiada sejarah untuk dipapar. Item yang sudah
  // punya rekod sebenar (bukan draf — 'pending'/'approved'/'rejected'/'archived') pasti wujud di
  // editorial_objects dengan id = current.uuid (Bar tier kekal dalam giliran ni selepas Terbit;
  // tier lain hilang daripada `items` selepas publishOne, jadi status draf ialah isyarat betul,
  // bukan sekadar ada/tiada uuid — SETIAP item, draf atau tidak, sudah ada uuid tempatan).
  const [revisions, setRevisions] = useState<any[] | null>(null);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState('');
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const isPublished = current.status && current.status !== 'draft';
  const fetchRevisions = useCallback(() => {
    if (!isPublished || !current.uuid) { setRevisions(null); return; }
    setRevisionsLoading(true);
    setRevisionsError('');
    fetch(`/api/system/content/${encodeURIComponent(current.uuid)}/revisions`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) { setRevisionsError(data?.error || labelUi('toast.gagal_muat_sejarah')); setRevisions([]); return; }
        setRevisions(Array.isArray(data) ? data : []);
      })
      .catch(() => setRevisionsError(labelUi('toast.gagal_muat_sejarah')))
      .finally(() => setRevisionsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.uuid, isPublished]);
  useEffect(() => {
    if (tab === 'sejarah') fetchRevisions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, current.uuid]);
  const restoreVersion = async (revisionId: number) => {
    if (!current.uuid) return;
    setRestoringId(revisionId);
    setRevisionsError('');
    try {
      const res = await fetch(`/api/system/content/${encodeURIComponent(current.uuid)}/revisions/${revisionId}/restore`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setRevisionsError(data?.error || 'Gagal memulihkan versi.');
        return;
      }
      // Kandungan sebenar (server-side) sudah berubah — cerminkan segera pada borang tempatan
      // (tajuk/huraian) supaya editor nampak kesan pulihan tanpa perlu tutup-buka modal, walaupun
      // simpanan penuh giliran (Terbit/Simpan draf) masih perlu dilakukan berasingan kalau nak
      // ubah suai lanjut selepas pulih.
      const restored = (revisions || []).find((r) => r.id === revisionId);
      if (restored) {
        commit((prevItems) => prevItems.map((it, n) => (
          n === activeIndex ? { ...it, title: restored.title, brief: restored.summary } : it
        )));
      }
      fetchRevisions();
    } catch {
      setRevisionsError('Gagal memulihkan versi.');
    } finally {
      setRestoringId(null);
    }
  };

  // Tukar slot terus dari sini (2026-07-29) — modal ni REMOUNT penuh bila editingSlotIndex ibu
  // bapa berubah (key={editingSlotIndex} di pemanggil), jadi `items` tempatan hilang tak
  // disimpan. Amaran dulu kalau ada apa-apa benar-benar ditaip (bukan cuma baris kosong "+
  // Masukkan" belum disentuh), sama falsafah macam amaran padam kandungan di atas.
  const handleSwitchSlot = (idx: number) => {
    if (idx === editingSlotIndex) return;
    if (hasUnsavedWork) { setKonfirmTukarKe(idx); return; }
    onSwitchSlot?.(idx);
  };

  // Amaran tutup modal (2026-08-02, Fasa 6, "Auto-simpan / penjaga dirty") — sama falsafah macam
  // handleSwitchSlot di atas, tapi untuk butang X (satu-satunya laluan tutup modal ni). Auto-
  // simpan sebenar (draf tersimpan tanpa tindakan editor) DIBUANG daripada skop: kandungan
  // editorial ialah tulisan sebenar (lihat CLAUDE.md), draf separuh siap yang tersimpan senyap
  // ke DB tanpa editor sedar lebih berbahaya daripada amaran ringkas ni.
  const handleClose = () => {
    if (hasUnsavedWork) { setKonfirmTutup(true); return; }
    onClose();
  };

  // Amaran tutup TAB/muat semula pelayar (2026-08-02) — hasUnsavedWork tak boleh dibaca terus
  // dalam handler beforeunload (closure lapuk), jadi bergantung pada ref yang sentiasa disegarkan.
  const hasUnsavedWorkRef = useRef(hasUnsavedWork);
  hasUnsavedWorkRef.current = hasUnsavedWork;
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedWorkRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Perangkap fokus + Escape + pulangkan fokus (2026-08-07) — modal ni TERBESAR dalam aplikasi
  // tetapi satu-satunya yang terlepas semasa cangkuk `useModalFokus` diperkenalkan (Audit UI/UX
  // §G1/G2 melengkapkan 15 tapak panggilan lain). Kesannya nyata: Tab boleh keluar terus ke
  // frontpage di belakang, jadi pengguna papan kekunci menaip ke medan yang tidak kelihatan.
  // Sengaja TIDAK dimigrasikan ke <EditorDialog> — modal ni ada susun atur tersendiri (tinggi
  // tetap `h-[min(88vh,720px)]`, kepala/kaki flex-none dengan badan menatal, lebar 1080px yang
  // lebih besar daripada mana-mana saiz EditorDialog). Memaksanya masuk akan menjadi reka
  // bentuk semula, bukan penyatuan.
  const refModal = useRef<HTMLDivElement>(null);
  useModalFokus(refModal, onClose);

  // Gerbang klik-backdrop-untuk-tutup (2026-08-07, sama pepijat/pembetulan macam LoginModal.tsx)
  // — tanpa gerbang mousedown+click ni, menyeret untuk memilih teks dalam modal dan melepaskan
  // tetikus di luar (di atas backdrop) akan tersalah tutup modal, buang draf belum disimpan.
  // Modal ni sebelum ni TIADA klik-backdrop langsung (tak boleh ditutup klik luar pun) — tambah
  // sekali dengan gerbang supaya konsisten dengan corak modal lain, bukan tanpa gerbang.
  const mousedownPadaBackdrop = React.useRef(false);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-md"
      onMouseDown={(e) => { mousedownPadaBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && mousedownPadaBackdrop.current) handleClose(); }}
    >
      <div
        ref={refModal}
        role="dialog"
        aria-modal="true"
        aria-label={`Tulis Kandungan, Slot ${editingSlotIndex + 1}`}
        className="bg-white rounded-lg border border-stone-200 shadow-2xl w-full max-w-[1080px] h-[min(88vh,720px)] max-h-full flex flex-col overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >

        <header className="flex-none px-4 md:px-8 pt-5 pb-3.5">
          {/* Telefon: tindan menegak (tajuk atas, kawalan slot+tutup bawah), bukan sebelah-
              menyebelah `justify-between` desktop, yang paksa tajuk mengecut ke lajur
              sempit (~100px) bila dropdown slot (teks panjang cth "Slot 3 — Teknologi Digital")
              ambil baki ruang, punca tajuk patah 3 baris dalam skrin tangkap Izzat. */}
          {isPhone ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-serif text-xl font-medium tracking-tight text-stone-900">
                  Tulis Kandungan <span className="font-sans text-sm text-stone-400">Slot</span> <span className="font-mono text-lg" style={{ color: accent }}>{editingSlotIndex + 1}</span>
                </h2>
                <button type="button" aria-label="Batal" onClick={handleClose} className="text-stone-400 hover:text-stone-600 cursor-pointer shrink-0 mt-1">
                  <X size={20} />
                </button>
              </div>
              <p className="flex items-center gap-2.5 flex-wrap">
                {bidang && <BidangIcon iconName={bidang.icon} iconSvg={bidang.iconSvg} color={accent} variant="bare" size={13} title={desk} />}
                <span className="font-sans text-[10px] uppercase tracking-[0.15em] font-extrabold" style={{ color: accent }}>{desk || '— Belum ditetapkan —'}</span>
                <span className="text-stone-300">·</span>
                <span className="font-sans text-[11px] text-stone-500">{tierLabelDenganSaiz}</span>
              </p>
              {/* Tukar slot — lebar penuh di telefon (bukan sebelah butang Tutup, ruang tak cukup
                  untuk teks pilihan panjang cth "Slot 3 — Teknologi Digital"). */}
              {slotOptions && slotOptions.length > 0 && (
                <select
                  value={editingSlotIndex}
                  onChange={(e) => handleSwitchSlot(parseInt(e.target.value, 10))}
                  className="w-full border border-stone-300 rounded px-2.5 py-2 font-sans text-xs font-semibold text-stone-600 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#802334]"
                >
                  {slotOptions.map((opt) => (
                    <option key={opt.index} value={opt.index}>{opt.label}</option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="font-serif text-xl md:text-2xl font-medium tracking-tight text-stone-900">
                  Tulis Kandungan <span className="font-sans text-sm text-stone-400">Slot</span> <span className="font-mono text-lg" style={{ color: accent }}>{editingSlotIndex + 1}</span>
                </h2>
                <p className="mt-1.5 flex items-center gap-2.5 flex-wrap">
                  {bidang && <BidangIcon iconName={bidang.icon} iconSvg={bidang.iconSvg} color={accent} variant="bare" size={13} title={desk} />}
                  <span className="font-sans text-[10px] uppercase tracking-[0.15em] font-extrabold" style={{ color: accent }}>{desk || '— Belum ditetapkan —'}</span>
                  <span className="text-stone-300">·</span>
                  <span className="font-sans text-[11px] text-stone-500">{tierLabelDenganSaiz}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Tukar slot (2026-07-29) — dropdown terus di sini gantikan kena Batal + buka
                    pemilih semula setiap kali nak tukar slot lain. */}
                {slotOptions && slotOptions.length > 0 && (
                  <select
                    value={editingSlotIndex}
                    onChange={(e) => handleSwitchSlot(parseInt(e.target.value, 10))}
                    className="border border-stone-300 rounded px-2.5 py-1.5 font-sans text-xs font-semibold text-stone-600 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#802334]"
                  >
                    {slotOptions.map((opt) => (
                      <option key={opt.index} value={opt.index}>{opt.label}</option>
                    ))}
                  </select>
                )}
                <button type="button" aria-label="Batal" onClick={handleClose} className="text-stone-400 hover:text-stone-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>
            </div>
          )}
          {/* Tawaran pulih draf tempatan (2026-08-08) — snapshot localStorage drpd sesi/tab lalu
              yang tak sempat "Simpan Draf"/"Terbit" (cth crash pelayar/bekalan elektrik). Tak
              pernah datang drpd pelayan — cuma peranti editor sendiri, jadi tak wujud kalau
              editor buka slot ni di peranti/pelayar lain. */}
          {tawaranPulih && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
              <span className="font-sans text-xs text-stone-700">
                Draf tempatan daripada sesi lalu dijumpai (disimpan {masaRelatifRingkas(tawaranPulih.pada)}, tak sempat disimpan ke pelayan).
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={buangTawaranPulih} className="font-sans text-xs font-semibold text-stone-500 hover:text-stone-700 px-2 py-1 cursor-pointer">
                  Buang
                </button>
                <button type="button" onClick={pulihkanDrafTempatan} className="font-sans text-xs font-semibold text-white bg-[#802334] hover:bg-[#6b1d2b] rounded px-3 py-1 cursor-pointer">
                  Pulihkan
                </button>
              </div>
            </div>
          )}
          {/* Indikator auto-simpan tempatan — HANYA petunjuk "kerja anda selamat di peranti ni",
              bukan pengesahan tersimpan ke pelayan (itu tetap "Simpan Draf"/"Terbit" eksplisit). */}
          {!tawaranPulih && disimpanPada && hasUnsavedWork && (
            <p className="mt-2 font-sans text-[10px] text-emerald-700">
              Disimpan pada peranti ni {masaRelatifRingkas(disimpanPada)}.
            </p>
          )}
          {(konfirmTutup || konfirmTukarKe !== null) && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-[#802334]/30 bg-[#802334]/5 px-3 py-2">
              <span className="font-sans text-xs text-stone-700">
                {konfirmTutup
                  ? 'Tutup borang ni akan buang draf belum diterbitkan/disimpan dalam slot ni. Teruskan?'
                  : 'Tukar slot akan buang draf belum diterbitkan/disimpan dalam slot ni. Teruskan?'}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { setKonfirmTutup(false); setKonfirmTukarKe(null); }}
                  className="font-sans text-xs font-semibold text-stone-500 hover:text-stone-700 px-2 py-1 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Editor sedar & sengaja buang kerja ni — buang draf tempatan sekali gus,
                    // supaya ia tak terbit semula sebagai "tawaran pulih" kali lain slot ni dibuka.
                    buangDrafTempatan(kunciDrafTempatan);
                    if (konfirmTutup) { setKonfirmTutup(false); onClose(); }
                    else if (konfirmTukarKe !== null) { const idx = konfirmTukarKe; setKonfirmTukarKe(null); onSwitchSlot?.(idx); }
                  }}
                  className="font-sans text-xs font-semibold text-white bg-[#802334] hover:bg-[#6b1d2b] rounded px-3 py-1 cursor-pointer"
                >
                  Ya, teruskan
                </button>
              </div>
            </div>
          )}
          {/* UUID + bajet kandungan (2026-07-29, permintaan pemilik projek) — dipindah dari
              tengah borang ke header supaya editor sedar bajet sepanjang masa menaip, tanpa
              tatal. Hanya relevan untuk tab "Borang kandungan" (kandungan aktif semasa), tapi
              kekal kelihatan tanpa mengira tab supaya tak hilang bila beralih ke tab lain. */}
          {ceiling.maxBrief > 0 && (
            <div className="mt-3 flex items-end justify-between gap-6">
              <span className="font-mono text-[10px] text-stone-400">UUID <span className="text-stone-500">{current.uuid || '—'}</span></span>
              <div className="w-full max-w-[360px]">
                <BudgetMeter slotIndex={editingSlotIndex} ceiling={ceiling} title={current.title || ''} brief={current.brief || ''} />
              </div>
            </div>
          )}
        </header>
        <hr className="border-stone-150" />

        {/* Amaran kandungan demo (2026-07-29) — slot ni kosong sebenar, borang di bawah disintesis
            daripada kandungan demo "Tentang Adjung" (bukan simpanan sebenar). Insiden sebenar:
            tanpa amaran ni, teks demo tak dapat dibezakan langsung daripada kandungan tersimpan —
            hampir tersiar sebagai kandungan sebenar semasa audit UI/UX 2026-07-29. */}
        {formConfig.isDemoContent && (
          <div className="flex-none bg-amber-50 border-b border-amber-200 px-6 md:px-8 py-2 flex items-center gap-2 text-amber-900 font-sans text-[11px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span><strong>Kandungan contoh.</strong> Slot ni belum ada kandungan tersimpan. Medan di bawah diisi teks demo "Tentang Adjung" sebagai templat sahaja; gantikan sebelum Simpan.</span>
          </div>
        )}

        {/* Draf | Borang: DUA LAJUR sebelah-menyebelah di desktop (grid `minmax(240px, 32%) 1fr`),
            tapi lantai 240px tu paksa jalur Draf ambil LEBIH SEPARUH lebar modal telefon (~360-
            420px total), tinggalkan Borang dikelar ~120-180px — punca sebenar skrin tangkap Izzat
            (borang terpotong, kena tatal mendatar). Telefon: SATU LAJUR bertindan (Draf jalur
            nipis mendatar atas, tinggi terhad+boleh tatal, Borang penuh lebar bawah). */}
        <div className={isPhone ? 'flex-1 min-h-0 flex flex-col' : 'flex-1 min-h-0 grid'} style={isPhone ? undefined : { gridTemplateColumns: 'minmax(240px, 32%) 1fr' }}>

          <section className={isPhone ? 'flex-none flex flex-col border-b border-stone-150' + (drafTerbukaPhone ? ' max-h-[30vh]' : '') : 'min-h-0 flex flex-col border-r border-stone-150'}>
            {isPhone ? (
              <button
                type="button"
                onClick={() => setDrafTerbukaPhone((v) => !v)}
                className="flex-none flex items-baseline justify-between px-3 pt-3 pb-2 w-full cursor-pointer"
              >
                <span className={labelCls}>Draf</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-stone-400">{items.length}</span>
                  <span className="font-mono text-[10px] text-stone-400">{drafTerbukaPhone ? '▲' : '▼'}</span>
                </span>
              </button>
            ) : (
              <div className="flex-none flex items-baseline justify-between px-3 pt-3 pb-2">
                <span className={labelCls}>Draf</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-stone-400">{items.length}</span>
                  {itemsLulus.length > 0 && (
                    <Button type="button" variant="secondary" size="sm" disabled={terbitSemuaBerjalan} onClick={() => setConfirmTerbitSemua(true)}>
                      Terbit Semua
                    </Button>
                  )}
                </span>
              </div>
            )}
            {/* WF-03 (Pusingan 5, audit ChatGPT 2026-08-09) — pengesahan sebaris (bukan native
                dialog), papar jumlah SEBENAR sebelum tindakan, dan sengaja TIDAK sembunyikan item
                yang tak lulus — pengguna nampak skop penuh sebelum terbit pukal. */}
            {confirmTerbitSemua && (
              <div className="mx-3 mb-2 flex flex-col gap-1.5 rounded-md border border-Adjung-maroon/30 bg-Adjung-maroon/5 px-3 py-2">
                <span className="font-sans text-[11px] text-stone-700">
                  Terbit {itemsLulus.length} kandungan yang lulus?
                  {itemsGagal.length > 0 && ` ${itemsGagal.length} kandungan tidak memenuhi syarat dan tidak akan disentuh.`}
                </span>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmTerbitSemua(false)}>Batal</Button>
                  <Button type="button" variant="primary" size="sm" onClick={terbitSemua}>Terbit Semua</Button>
                </div>
              </div>
            )}
            {ringkasanTerbitSemua && (
              <div className="mx-3 mb-2 flex flex-col gap-1.5 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-sans text-[11px] text-stone-700">
                    {ringkasanTerbitSemua.berjaya > 0 && `${ringkasanTerbitSemua.berjaya} kandungan diterbitkan. `}
                    {ringkasanTerbitSemua.pending > 0 && `${ringkasanTerbitSemua.pending} kandungan dihantar untuk Menunggu Semakan. `}
                    {ringkasanTerbitSemua.gagal.length > 0 && `${ringkasanTerbitSemua.gagal.length} kandungan tidak diterbitkan.`}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRingkasanTerbitSemua(null)}>Tutup</Button>
                </div>
                {ringkasanTerbitSemua.gagal.length > 0 && (
                  <ul className="list-none m-0 p-0 space-y-1">
                    {ringkasanTerbitSemua.gagal.map((g, idx) => (
                      <li key={idx} className="font-mono text-[10px] text-stone-500">
                        <span className="text-stone-700 font-semibold">{g.title}</span> — {g.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {/* Modal ni RUANG DRAF PERIBADI SAHAJA (2026-07-29, permintaan pemilik projek) —
                senarai FLAT, satu kumpulan "Draf" sahaja. Tiada lagi kumpulan "Akan Diterbitkan":
                Terbit (butang publishOne di atas) ialah AKSI SEGERA, bukan status yang ditogol —
                sebaik sahaja ditekan & berjaya, kandungan terus KELUAR daripada senarai ni (jadi
                rekod Indeks rasmi berstatus Pending), tiada keadaan pertengahan kelihatan di sini. */}
            {(!isPhone || drafTerbukaPhone) && (
              <div className={isPhone ? 'min-h-0 overflow-y-auto border-t border-stone-150' : 'flex-1 min-h-0 overflow-y-auto border-t border-stone-150'}>
                <ol className="list-none m-0 p-0">
                  {items.map((it, i) => (
                    <SidebarItem
                      key={it.uuid || i}
                      item={it} index={i} isActive={i === activeIndex}
                      slotIndex={editingSlotIndex} desk={desk}
                      onSelect={setActive} onMoveUp={moveUp} onMoveDown={moveDown} onRemove={remove}
                      confirmingBuang={konfirmBuangIndex === i} onMintaBuang={mintaBuang} onBatalBuang={batalBuang}
                    />
                  ))}
                </ol>
              </div>
            )}
            <div className="flex-none border-t border-stone-150 p-2">
              <button type="button" onClick={insert} className="w-full text-center py-1.5 rounded font-sans text-[11px] font-semibold text-stone-600 hover:text-[#802334] hover:bg-[#802334]/[0.08] transition-colors cursor-pointer">
                + Tambah Kandungan Baharu
              </button>
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto px-6 md:px-8 py-5 flex flex-col gap-5">
            <div className="flex gap-4.5">
              {(Object.keys(TAB_LABEL) as Array<keyof typeof TAB_LABEL>).map((t) => (
                <button
                  key={t} type="button" onClick={() => setTab(t as any)}
                  className={`relative pb-2.5 font-sans text-xs font-semibold cursor-pointer ${tab === t ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  {TAB_LABEL[t]}
                  {tab === t && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#802334]" />}
                </button>
              ))}
            </div>

            {/* a. MAKLUMAT SLOT — semua medan lihat sahaja (*), diisi automatik oleh sistem. */}
            {tab === 'maklumat' && (
              <div className="grid grid-cols-2 gap-5">
                <ReadOnlyField label="Nombor" value={String(editingSlotIndex + 1)} />
                <ReadOnlyField label="Jenis" value={tierLabelDenganSaiz} />
                <ReadOnlyField label="Bidang" value={desk} />
                {/* Editor DITUGASKAN kepada slot (2026-08-01) — bukan lagi orang yang sedang log
                    masuk. Ditetapkan di Editorium → Slot → Senarai Slot, bukan di sini (lihat nota
                    warna di bawah). Kosong = belum ditugaskan sesiapa. */}
                <ReadOnlyField
                  label="Editor"
                  value={
                    editorSlot === null
                      ? 'Memuatkan…'
                      : gagalMuatEditorSlot
                        ? 'Gagal dimuatkan'
                        : editorSlot.length > 0
                          ? editorSlot.map((e) => e.nama).join(', ')
                          : 'Belum ditugaskan'
                  }
                />
                <ReadOnlyField label="Bilangan kandungan" value={String(items.length)} />
                {/* Kadar putaran carousel (2026-07-29) — dipindah dari footer ke sini: tetapan
                    berkaitan SLOT (ditetapkan Ketua Editor), bukan urusan editor menulis kandungan. */}
                <ReadOnlyField label="Kadar putaran carousel" value={`${formConfig.carouselInterval || 10}s`} />
                <span className="col-span-2 font-sans text-[10px] text-stone-400 -mt-2">
                  Bidang ditetapkan di Tetapan Slot (bukan di sini). Tetapan warna slot hanya boleh dibuat oleh Ketua Editor.
                </span>
              </div>
            )}

            {/* b. BORANG KANDUNGAN */}
            {/* Papar mesej ruang kosong bila senarai Draf kosong (2026-08-05, jumpa semasa
                simulasi editor) — sebelum ni borang "Kandungan 01" kosong tetap kekal papar
                lepas draf terakhir berjaya Terbit (DRAF jadi 0), buat editor keliru ingatkan
                masih ada kerja belum simpan padahal tiada. `current` guna blankItem() sebagai
                fallback (lihat atas), jadi tanpa semakan ni borang nampak "aktif" walhal palsu. */}
            {tab === 'borang' && items.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="font-sans text-sm text-stone-500">Tiada draf lagi dalam slot ini.</span>
                <button type="button" onClick={insert} className="font-sans text-[11px] font-semibold text-[#802334] hover:underline cursor-pointer">+ Tambah Kandungan Baharu</button>
              </div>
            )}
            {tab === 'borang' && items.length > 0 && (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <span className={labelCls}>Kandungan <span className="font-mono">{String(activeIndex + 1).padStart(2, '0')}</span></span>
                  <span className="flex items-center gap-2.5">
                    {pasteNote && <span className="font-sans text-[10px] text-stone-400">{pasteNote}</span>}
                    {/* Butang "Masukkan" berlebihan dibuang (2026-07-29) — sama fungsi persis
                        dengan "+ Masukkan" di bawah senarai Giliran carousel (kedua-duanya
                        panggil insert()); dua tempat untuk satu kelakuan cuma mengelirukan. */}
                    <button type="button" onClick={paste} className="px-2.5 py-1 border border-stone-300 rounded text-[11px] font-sans font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer">Tampal</button>
                  </span>
                </div>

                {/* Pratonton kad SEBENAR (2026-08-08, "saya nak nampak persis rupa kad sebelum
                    terbit" — Pelan Pratonton Kad). Guna komponen KONGSI SEBENAR (dicabut drpd
                    FrontpageView.tsx, satu per tier) — bukan tiruan. Diletak DALAM lajur borang
                    (tatal bersama medan, bukan header tetap) — Izzat: "kalau slot tu tinggi, letak
                    di bawah perlu scroll lebih elok" — header tetap akan membengkak ikut tinggi
                    tier (Hero/Menegak boleh sampai 380px) dan sentiasa ambil ruang menegak tak
                    kira tab mana dibuka.
                    Disambung ke SEMUA tier (2026-08-16, dahulu cuma KOMPAK bukti konsep — Izzat:
                    "sepatutnya semua tier lain ada preview") — boleh ditutup/dibuka (togol
                    `pratontonTerbuka`) sebab "takut makan ruang" bila slot tinggi (Hero/Menegak).
                    Warna aksen SEGI_EMPAT_MEDIUM/SEGI_EMPAT_SMALL bergantung KEDUDUKAN slot
                    (`editingSlotIndex`, padan eyebrow SEBENAR di FrontpageView.tsx, bukan agak). */}
                {tier !== 'TICKER' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setPratontonTerbuka((v) => !v)}
                      className="flex items-center gap-1.5 cursor-pointer group"
                    >
                      <span className={labelCls}>Pratonton Kad</span>
                      {pratontonTerbuka ? <ChevronUp className="w-3 h-3 text-stone-400 group-hover:text-stone-600" /> : <ChevronDown className="w-3 h-3 text-stone-400 group-hover:text-stone-600" />}
                    </button>
                    {pratontonTerbuka && (
                      <div className="mt-1.5">
                        {tier === 'KOMPAK' && (
                          <KompakCardPreview
                            item={{
                              title: current.title, brief: current.brief, desk, topik: current.topik,
                              source: current.source, originalDate: current.date, imageUrl: current.image,
                            }}
                            bidang={bidang}
                          />
                        )}
                        {tier === 'HERO' && (
                          <HeroCardPreview
                            item={{
                              title: current.title, brief: current.brief, desk, topik: current.topik,
                              source: current.source, originalDate: current.date, imageUrl: current.image,
                            }}
                            bidang={bidang}
                          />
                        )}
                        {tier === 'MENEGAK' && (
                          <MenegakCardPreview
                            item={{
                              title: current.title, brief: current.brief, desk, topik: current.topik,
                              source: current.source, originalDate: current.date, imageUrl: current.image,
                            }}
                            bidang={bidang}
                          />
                        )}
                        {tier === 'STANDARD' && (
                          <StandardCardPreview
                            item={{
                              title: current.title, brief: current.brief, desk, topik: current.topik,
                              source: current.source, originalDate: current.date, imageUrl: current.image,
                            }}
                            bidang={bidang}
                          />
                        )}
                        {tier === 'SEGI_EMPAT_MEDIUM' && (
                          <SegiEmpatMediumCardPreview
                            item={{
                              title: current.title, brief: current.brief, desk, topik: current.topik,
                              source: current.source, originalDate: current.date, imageUrl: current.image,
                            }}
                            bidang={bidang}
                            aksen={[13, 27].includes(editingSlotIndex) ? 'kiri' : 'kanan'}
                          />
                        )}
                        {tier === 'SEGI_EMPAT_SMALL' && (
                          <SegiEmpatSmallCardPreview
                            item={{
                              title: current.title, brief: current.brief, desk, topik: current.topik,
                              source: current.source, originalDate: current.date, imageUrl: current.image,
                            }}
                            bidang={bidang}
                            aksen={editingSlotIndex === 36 ? 'kelabu' : 'krem'}
                          />
                        )}
                        {tier === 'BAR' && (
                          /* Tiada medan Penganjur/Akses/Tarikh Tamat dlm modal ni (BAR tak
                             pernah ada Field khusus utk itu, disahkan audit 2026-08-16) — pratonton
                             guna sama fallback macam kandungan BAR sebenar yg belum lengkap
                             (BarCard.tsx: tiada organizer -> lencana Akses "TERBUKA", tiada
                             tarikh acara -> label Desk). */
                          <BarCardPreview
                            item={{ title: current.title, desk, originalDate: current.date }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                <Field label="Topik" value={current.topik || ''} maxLen={hadTopik} onChange={(v) => patch(activeIndex, 'topik', v)} />
                <Field label="Tajuk" value={current.title || ''} maxLen={ceiling.maxTitle} onChange={(v) => patch(activeIndex, 'title', v)} />
                {ceiling.maxBrief > 0 && (
                  <>
                    <Field label="Huraian ringkas" rows={4} value={current.brief || ''} onChange={(v) => patch(activeIndex, 'brief', v)} />
                    <Field label="Huraian panjang" rows={5} value={current.briefLong || ''} placeholder="Huraian panjang, untuk paparan menatal penuh, hanya di Focus View" maxLen={ceiling.maxBriefLong} minLen={effectiveMinBriefLong()} onChange={(v) => patch(activeIndex, 'briefLong', v)} />
                  </>
                )}

                <hr className="border-stone-150" />
                {/* Sumber berbilang (2026-08-05, permintaan Izzat) — editor boleh tambah lebih
                    daripada satu sumber untuk SATU kandungan (cth digubah drpd pelbagai bahan).
                    Kad terhad ruang: label kad papar "Editorial Adjung" secara automatik bila
                    >1 sumber (lihat FrontpageView.tsx), bukan senarai penuh. Focus View (ruang
                    lebih) senaraikan SEMUA. Tarikh kini PER-SUMBER (2026-08-15, permintaan Izzat
                    — "setiap sumber ada: nama sumber, URL, dan tarikh, mana boleh kongsi/
                    permudahkan" -- sumber berbeza boleh diterbitkan pada tarikh berbeza, satu
                    medan tarikh dikongsi kehilangan maklumat). Medan "Tarikh sumber" tunggal
                    yang dulu berasingan di bawah dibuang -- sekarang sebahagian setiap baris
                    sumber, current.date terus diselaraskan drpd sources[0].date (selarasSumberLegasi). */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between">
                    <span className={labelCls}>Sumber {(current.sources && current.sources.length > 1) && <span className="font-sans normal-case tracking-normal font-normal text-stone-400">(kad papar "Editorial Adjung" bila &gt;1 sumber)</span>}</span>
                    <button type="button" onClick={() => tambahSumber(activeIndex)} className="text-[11px] font-sans font-semibold text-[#802334] hover:underline cursor-pointer">+ Tambah sumber</button>
                  </div>
                  {((current.sources && current.sources.length > 0) ? current.sources : [{ name: current.source || '', url: current.url || '', date: current.date || '' }]).map((s: any, sIdx: number) => (
                    <div key={sIdx} className="grid grid-cols-[1.2fr_1.6fr_1fr_auto] gap-3 items-end">
                      <label className="flex flex-col gap-1">
                        {sIdx === 0 && <span className={labelCls}>Nama sumber</span>}
                        <input
                          type="text" value={s.name || ''} placeholder="Adjung Editorial" maxLength={60}
                          onChange={(e) => patchSumber(activeIndex, sIdx, 'name', e.target.value)}
                          className="w-full border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        {sIdx === 0 && <span className={labelCls}>URL</span>}
                        <input
                          type="text" value={s.url || ''} placeholder="https://"
                          onChange={(e) => patchSumber(activeIndex, sIdx, 'url', e.target.value)}
                          className="w-full border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        {sIdx === 0 && <span className={labelCls}>Tarikh sumber</span>}
                        <input
                          type="date" value={s.date || ''}
                          onChange={(e) => patchSumber(activeIndex, sIdx, 'date', e.target.value)}
                          className="w-full border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
                        />
                      </label>
                      {(current.sources && current.sources.length > 1) ? (
                        <button type="button" onClick={() => buangSumber(activeIndex, sIdx)} aria-label="Buang sumber ini" className="text-stone-400 hover:text-[#a8241f] cursor-pointer pb-1.5">
                          <Trash2 size={14} />
                        </button>
                      ) : <span />}
                    </div>
                  ))}
                </div>
                {/* "Jenis sumber" dibuang drpd sini (2026-08-16) — lihat nota JENIS_SUMBER_PILIHAN
                    di atas fail ni. Imej kekal bersendirian (dahulu berkongsi grid-cols-2 dgn
                    Jenis sumber) — lebar biasa (bukan grid) supaya tak nampak janggal separuh
                    lebar sekarang. */}
                <ImageField label="Imej" value={current.image || ''} note={imageNote} uploading={uploadingImage} onChange={(v) => patch(activeIndex, 'image', v)} onUploadFile={(f) => uploadImage(activeIndex, f)} />
                <Field label="Nota" rows={2} value={current.note || ''} placeholder="Nota editor (pilihan), hanya di Focus View" maxLen={280} onChange={(v) => patch(activeIndex, 'note', v)} />
                {/* Penulis KANDUNGAN INI (2026-08-01, permintaan pemilik projek) — bukan lagi
                    sesiapa yang kebetulan sedang log masuk. Satu slot boleh dikendalikan lebih
                    seorang editor, jadi memapar nama pembuka borang di sini menipu: ia nampak
                    macam pengesahan siapa menulis kandungan tu. Blok lama (sebelum cap nama
                    wujud) papar "—", bukan nama diandaikan. */}
                <ReadOnlyField label="Penulis" value={current.penulis || EDITOR_PLACEHOLDER} />

                <hr className="border-stone-150" />
                {/* Butang Terbit (2026-07-29, permintaan pemilik projek) — AKSI SEGERA, bukan
                    togol status. Kandungan dalam modal ni SENTIASA draf sehingga butang ni
                    ditekan; klik terus hantar SATU kandungan ni ke Indeks dan buang daripada
                    senarai draf — jelas berasingan daripada butang Simpan keseluruhan modal di
                    footer (Simpan cuma simpan baki draf, tak terbitkan apa-apa). Status akhir
                    (Aktif terus atau Menunggu) ditentukan SERVER ikut kebenaran penekan butang
                    (server.js syncManualObjectsForSlot) — bukan dikodkan keras di sini. */}
                <div className="flex items-center justify-between gap-4">
                  <span className="flex flex-col gap-0.5">
                    <span className={labelCls}>Kandungan ini masih draf</span>
                    {(publishError || draftNote) && (
                      <span className={`font-sans text-[10px] ${publishError ? 'text-[#a8241f]' : 'text-stone-500'}`}>{publishError || draftNote}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button" onClick={saveDraft} disabled={savingDraft || publishingIndex !== null}
                      className="px-4 py-1.5 border border-stone-300 text-stone-600 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-wait rounded text-[11px] font-sans font-semibold cursor-pointer transition-colors"
                    >
                      {savingDraft ? 'Menyimpan…' : 'Simpan sebagai draf'}
                    </button>
                    <button
                      type="button" onClick={() => publishOne(activeIndex)} disabled={publishingIndex !== null || savingDraft}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-wait text-white rounded text-[11px] font-sans font-semibold cursor-pointer transition-colors"
                    >
                      {publishingIndex === activeIndex ? 'Menerbitkan…' : 'Terbit sekarang'}
                    </button>
                  </span>
                </div>
              </>
            )}

            {/* c. ARAHAN AI */}
            {tab === 'ai' && (
              <>
                <div>
                  <span className={labelCls}>Had aksara</span>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <ReadOnlyField label="a. Topik" value={String(hadTopik)} />
                    <ReadOnlyField label="d. Huraian panjang" value={ceiling.maxBrief > 0 ? String(ceiling.maxBriefLong) : 'Tiada'} />
                  </div>
                  {/* Slider bajet Tajuk/Huraian ringkas (2026-08-07, pepijat kritikal Izzat) —
                      GANTIKAN dua had solo (b/c) yang sebelum ni dipapar bersebelahan seolah-olah
                      boleh dicapai PENUH serentak (mustahil, kongsi satu bajet — lihat nota
                      buildAiPrompt di atas fail ni). Laraskan Tajuk, Huraian ringkas bergerak
                      automatik ikut nisbah — pasangan yang dihantar ke AI SENTIASA sah. */}
                  <div className="mt-3">
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <span className={labelCls}>b+c. Tajuk / Huraian ringkas <span className="font-sans normal-case tracking-normal text-stone-400">(satu bajet kongsi)</span></span>
                    </div>
                    <input
                      type="range" min={0} max={ceiling.maxTitle} value={titleTarget}
                      onChange={(e) => setAiTitleTarget(Number(e.target.value))}
                      className="w-full cursor-pointer accent-[#802334]"
                    />
                    <div className="flex items-center justify-between font-mono text-[10px] tabular-nums text-stone-500">
                      <span>Tajuk maksimum <strong className="text-stone-800">{titleTarget}</strong></span>
                      <span>Huraian ringkas maksimum <strong className="text-stone-800">{briefTarget}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className={labelCls}>Arahan am (Sistem/Global) <span className="font-sans normal-case tracking-normal text-stone-400">· auto</span></span>
                  <div className="font-serif text-[13px] leading-relaxed text-stone-500 bg-stone-50 rounded p-3">
                    {formConfig.masterPrompt || <span className="text-stone-400">Tiada arahan ditetapkan</span>}
                  </div>
                  <span className="font-sans text-[9px] text-stone-400">Ditetapkan oleh Ketua Editor di Editorium · auto</span>
                </div>

                <Field
                  label="Arahan khas (slot ini)" rows={3}
                  value={formConfig.promptText || ''}
                  placeholder="Cth. Fokus kepada pandangan pakar tempatan, elak sumber pendapat semata-mata"
                  onChange={(v) => setFormConfig((prev: any) => ({ ...prev, promptText: v }))}
                  hint="disimpan bersama slot ini"
                />

                {/* Had usia sumber/Negara asal sumber disembunyikan dalam mod "Dengan rujukan"
                    (audit ChatGPT AI-PROVENANCE-002, 2026-08-15) -- kedua medan ni kriteria
                    PEMILIHAN sumber (untuk mod "Bebas" bila AI sendiri cari & tapis sumber),
                    bukan sifat kandungan. Bila editor dah tetapkan URL terus, medan ni jadi
                    bukan cuma tak relevan tapi BERCANGGAH dgn arahan "guna URL ini sahaja"
                    (lihat buildAiPrompt di atas). "Jumlah kandungan" pula dikunci ke 1 (bukan
                    disembunyi) -- editor patut nampak SEBAB, bukan tertanya-tanya ke mana medan
                    tu hilang; mod rujukan reka bentuk untuk SATU URL -> SATU kandungan sahaja. */}
                <div className="grid grid-cols-2 gap-5">
                  {/* Had usia sumber (2026-08-16, pepijat Izzat: medan ni masih terpapar dalam mod
                      "Artikel Jurnal" walau sepatutnya sembunyi sama macam "Dengan rujukan" —
                      gerbang lama cuma semak 'dengan_rujukan', terlepas 'artikel_jurnal' bila mod
                      tu ditambah. PDF akademik pun tak relevan diukur "kebaruan hari" macam
                      URL berita — sepatutnya ikut gerbang SAMA seperti Negara asal sumber di
                      bawah, bukan gerbang berasingan yang boleh terpesong. */}
                  {formConfig.genMode !== 'dengan_rujukan' && formConfig.genMode !== 'artikel_jurnal' && (
                    <SelectField label="Had usia sumber" value={formConfig.aiPromptRecency || ''} options={HAD_USIA_SUMBER_PILIHAN} onChange={(v) => setFormConfig((prev: any) => ({ ...prev, aiPromptRecency: v }))} />
                  )}
                  {/* "Bahasa sumber" (2026-08-16, dinamakan semula drpd "Bahasa kandungan" —
                      soalan Izzat: "bukan ke bahasa kandungan dah confirm2 dlm bahasa melayu?").
                      Output SENTIASA Bahasa Melayu (dikunci hardcode di [Peranan AI], TAK PERNAH
                      dikawal medan ni) -- medan ni kini panduan bahasa SUMBER yang AI patut cari,
                      relevan HANYA utk mod "Bebas" (AI cari sumber sendiri). Mod "Dengan Rujukan"
                      (Pautan/Artikel Jurnal) sumbernya dah TETAP ditentukan editor -- soalan
                      "bahasa sumber apa nak dicari" dah tak bermakna, sama sebab macam Negara
                      asal sumber/Had usia sumber disembunyikan utk kedua-dua sub-mod tu. */}
                  {formConfig.genMode !== 'dengan_rujukan' && formConfig.genMode !== 'artikel_jurnal' && (
                    <Field label="Bahasa sumber" value={formConfig.aiPromptLanguage || ''} onChange={(v) => setFormConfig((prev: any) => ({ ...prev, aiPromptLanguage: v }))} />
                  )}
                  {formConfig.genMode !== 'dengan_rujukan' && formConfig.genMode !== 'artikel_jurnal' && (
                    <Field label="Negara asal sumber" value={formConfig.aiPromptRegion || ''} onChange={(v) => setFormConfig((prev: any) => ({ ...prev, aiPromptRegion: v }))} />
                  )}
                  <label className="flex flex-col gap-1">
                    <span className={`${labelCls} flex items-center gap-1`}>
                      Jumlah kandungan
                      {(formConfig.genMode === 'dengan_rujukan' || formConfig.genMode === 'artikel_jurnal') && <Lock className="w-3 h-3 text-stone-400" />}
                    </span>
                    <input
                      type="number" min={1}
                      value={(formConfig.genMode === 'dengan_rujukan' || formConfig.genMode === 'artikel_jurnal') ? 1 : (formConfig.generationLimit || 1)}
                      disabled={formConfig.genMode === 'dengan_rujukan' || formConfig.genMode === 'artikel_jurnal'}
                      title={(formConfig.genMode === 'dengan_rujukan' || formConfig.genMode === 'artikel_jurnal') ? 'Mod ini hasilkan SATU kandungan bagi SATU sumber.' : undefined}
                      onChange={(e) => setFormConfig((prev: any) => ({ ...prev, generationLimit: Number(e.target.value) }))}
                      className="w-full border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-mono text-sm text-stone-800 py-1.5 disabled:bg-stone-50 disabled:text-stone-400"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className={labelCls}>Mod janaan</span>
                  {/* Togol DUA PERINGKAT (2026-08-16, arahan Izzat — "kurang profesional" dgn tiga
                      butang sejajar rata; togol asal mendedahkan "Dengan Rujukan" dan "Dengan
                      Artikel Jurnal" sebagai dua pilihan SETARA, walhal kedua-duanya sebenarnya DUA
                      CARA sumber di bawah SATU falsafah "Dengan Rujukan" (SATU sumber wajib
                      ditentukan editor, bukan AI cari sendiri) — cuma bezanya jenis sumber (pautan
                      web vs PDF jurnal). Peringkat luar: Bebas / Dengan Rujukan. Peringkat dalam
                      (muncul cuma bila "Dengan Rujukan" dipilih): Pautan / Artikel Jurnal — masing2
                      terus memetakan genMode SEDIA ADA ('dengan_rujukan'/'artikel_jurnal', TIADA
                      nilai baharu dicipta, buildAiPrompt()/copyPrompt() tak berubah langsung). */}
                  <div className="inline-flex border border-stone-300 rounded overflow-hidden w-fit">
                    {(['bebas', 'rujukan'] as const).map((v, i) => {
                      const aktif = v === 'bebas' ? (formConfig.genMode || 'bebas') === 'bebas' : (formConfig.genMode || 'bebas') !== 'bebas';
                      return (
                        <button
                          key={v} type="button"
                          onClick={() => setFormConfig((prev: any) => ({
                            ...prev,
                            genMode: v === 'bebas' ? 'bebas' : ((prev.genMode || 'bebas') === 'bebas' ? 'dengan_rujukan' : prev.genMode),
                          }))}
                          className={`px-3.5 py-1.5 font-sans text-[11px] font-semibold cursor-pointer transition-colors ${i ? 'border-l border-stone-300' : ''} ${aktif ? 'bg-[#802334] text-white' : 'bg-transparent text-stone-600'}`}
                        >
                          {v === 'bebas' ? 'Bebas' : 'Dengan Rujukan'}
                        </button>
                      );
                    })}
                  </div>
                  {(formConfig.genMode || 'bebas') !== 'bebas' && (
                    <div className="inline-flex border border-stone-200 rounded overflow-hidden w-fit mt-0.5">
                      {(['dengan_rujukan', 'artikel_jurnal'] as const).map((v, i) => (
                        <button
                          key={v} type="button" onClick={() => setFormConfig((prev: any) => ({ ...prev, genMode: v }))}
                          className={`px-3 py-1 font-sans text-[10px] font-semibold cursor-pointer transition-colors ${i ? 'border-l border-stone-200' : ''} ${formConfig.genMode === v ? 'bg-stone-700 text-white' : 'bg-stone-50 text-stone-500'}`}
                        >
                          {v === 'dengan_rujukan' ? 'Pautan' : 'Artikel Jurnal'}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Sumber rujukan berbilang (2026-08-15, simulasi Izzat pusingan 4 + audit ChatGPT)
                      -- HANYA muncul bila "Dengan rujukan" dipilih. Guna SEMULA corak "+ Tambah
                      sumber" sedia ada (nama+URL, lihat sources[] borang kandungan di atas) --
                      BUKAN reka bentuk "Jenis: Utama/Sokongan/Data" baharu (ChatGPT tarik balik
                      cadangan tu selepas semak kod: infra sources[]/parser/label "Editorial Adjung"
                      dah wujud penuh, tambah peranan sumber cuma cipta keputusan editorial yang
                      belum diperlukan). Sekurang-kurangnya SATU URL wajib -- kosong tak jatuh balik
                      senyap ke "AI cari sendiri", copyPrompt() sekat terus (lihat di atas). */}
                  {formConfig.genMode === 'dengan_rujukan' && (
                    <div className="mt-1 flex flex-col gap-3">
                      <div className="flex items-baseline justify-between">
                        <span className={labelCls}>Sumber rujukan (wajib untuk mod ini)</span>
                        <button type="button" onClick={tambahSumberRujukan} className="text-[11px] font-sans font-semibold text-[#802334] hover:underline cursor-pointer">+ Tambah sumber</button>
                      </div>
                      {(() => {
                        const sources = parseReferenceSources(formConfig.aiPromptSource);
                        const list = sources.length > 0 ? sources : [{ name: '', url: '' }];
                        return list.map((s, sIdx) => (
                          <div key={sIdx} className="grid grid-cols-2 gap-3 items-end">
                            <label className="flex flex-col gap-1">
                              {sIdx === 0 && <span className={labelCls}>Nama sumber (pilihan)</span>}
                              <input
                                type="text" value={s.name} placeholder="cth. Bernama" maxLength={60}
                                onChange={(e) => patchSumberRujukan(sIdx, 'name', e.target.value)}
                                className="w-full border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
                              />
                            </label>
                            <span className="flex items-end gap-2">
                              <label className="flex-1 flex flex-col gap-1">
                                {sIdx === 0 && <span className={labelCls}>URL</span>}
                                <input
                                  type="text" value={s.url} placeholder="https://..."
                                  onChange={(e) => patchSumberRujukan(sIdx, 'url', e.target.value)}
                                  className="w-full border-0 border-b border-stone-300 focus:border-[#802334] outline-none bg-white font-serif text-sm text-stone-800 py-1.5 transition-colors"
                                />
                              </label>
                              {list.length > 1 && (
                                <button type="button" onClick={() => buangSumberRujukan(sIdx)} aria-label="Buang sumber ini" className="text-stone-400 hover:text-[#a8241f] cursor-pointer pb-1.5">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </span>
                          </div>
                        ));
                      })()}
                      <span className="font-sans text-[9px] text-stone-400">AI akan menggunakan sumber di atas sahaja, tanpa mencari sumber lain. Lebih daripada satu sumber: AI banding & attribute/hedge kandungan yang bertindih, kad papar "Editorial Adjung" bila &gt;1 sumber digunakan.</span>
                      {referenceUrlNote && <span className="font-sans text-[9px] text-[#a8241f]">{referenceUrlNote}</span>}
                    </div>
                  )}
                  {/* "Dengan Artikel Jurnal" (2026-08-16, arahan Izzat) -- TIADA upload PDF/URL wajib
                      di sini secara sengaja: editor lampirkan PDF terus dalam sesi AI luaran sendiri
                      (ChatGPT/Claude/Gemini), Adjung Brief tak simpan/proses fail. Medan "Nama jurnal"
                      di bawah ni PILIHAN sahaja (bantu AI rujuk nama jurnal dlm prompt), copyPrompt()
                      TIDAK sekat mod ni walau kosong -- lihat nota di fungsi tu. */}
                  {formConfig.genMode === 'artikel_jurnal' && (
                    <div className="mt-1 flex flex-col gap-2">
                      <Field label="Nama jurnal (pilihan)" value={formConfig.aiPromptJournalName || ''} onChange={(v) => setFormConfig((prev: any) => ({ ...prev, aiPromptJournalName: v }))} />
                      {/* Wording diperhalusi (2026-08-16, audit ChatGPT selepas Izzat tegur bahasa
                          Melayu asal "macam terjemahan dokumentasi perisian") — gaya editorial
                          penerbitan, bukan manual perisian teknikal: "lampirkan"→"muat naik",
                          "bahan PDF"→"artikel tersebut", "kandungan yang dijana"→"hasil tersebut". */}
                      <span className="font-sans text-[9px] text-stone-400">Muat naik artikel tersebut dalam sesi AI pilihan anda bersama arahan di bawah. Selepas kandungan dijana, salin hasil tersebut ke Borang Kandungan untuk semakan dan penerbitan. Adjung Brief tidak menyimpan fail PDF — fail tersebut kekal dalam sesi AI yang digunakan.</span>
                    </div>
                  )}
                </div>

                <hr className="border-stone-150" />
                <div className="flex items-center justify-between gap-4">
                  {/* Istilah rasmi "Arahan AI"/"sesi AI" (2026-08-16, audit bahasa 10 pusingan
                      dgn ChatGPT selepas teguran Izzat) -- "prompt"/"chatbox" ialah istilah
                      teknikal, bukan bahasa produk. Nama fungsi/pemboleh ubah kod (copyPrompt)
                      KEKAL -- kod ada konvensyen sendiri, cuma teks yg dipaparkan ditukar. */}
                  <span className="font-sans text-[11px] text-stone-500">Salin Arahan AI ini dan tampalkan ke sesi AI pilihan anda. Selepas kandungan dijana, salin hasilnya semula ke "Borang Kandungan" melalui butang "Tampal".</span>
                  <button type="button" onClick={copyPrompt} className="px-2.5 py-1 border border-stone-300 rounded text-[11px] font-sans font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer shrink-0">{aiNote || 'Salin Arahan AI'}</button>
                </div>
              </>
            )}

            {/* d. SEJARAH VERSI — Fasa 6 (2026-08-02). Sejarah sebenar (baris editorial_revisions
                berkekalan), bukan andaian daripada teks draf tempatan — cuma wujud untuk kandungan
                yang sudah punya rekod sebenar (bukan draf). */}
            {tab === 'sejarah' && (
              <>
                {!isPublished && (
                  <span className="font-sans text-[12px] text-stone-500">
                    Kandungan ini belum diterbitkan — tiada sejarah versi lagi.
                  </span>
                )}
                {isPublished && revisionsLoading && (
                  <span className="font-sans text-[12px] text-stone-500">Memuatkan sejarah versi…</span>
                )}
                {isPublished && !revisionsLoading && revisionsError && (
                  <span className="font-sans text-[12px] text-[#a8241f]">{revisionsError}</span>
                )}
                {isPublished && !revisionsLoading && !revisionsError && revisions && revisions.length === 0 && (
                  <span className="font-sans text-[12px] text-stone-500">Tiada sejarah versi direkodkan.</span>
                )}
                {isPublished && !revisionsLoading && revisions && revisions.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    {revisions.map((r, i) => {
                      const isTerkini = i === 0;
                      return (
                        <div key={r.id} className="flex items-start justify-between gap-4 border border-stone-200 rounded p-3">
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="flex items-center gap-2">
                              <span className={labelCls}>Versi {r.version}</span>
                              {isTerkini && (
                                <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-emerald-700">· Semasa</span>
                              )}
                              <span className="font-sans text-[10px] text-stone-400">{new Date(r.updatedAt || r.createdAt).toLocaleString('ms-MY')}</span>
                            </span>
                            <span className="font-serif text-[13px] text-stone-800 truncate">{r.title || <span className="text-stone-400">(tiada tajuk)</span>}</span>
                            <span className="font-sans text-[11px] text-stone-500 truncate">{r.summary || ''}</span>
                            <span className="font-mono text-[9px] text-stone-400">{r.createdBy || '—'} · {r.status}</span>
                          </div>
                          {!isTerkini && (
                            <button
                              type="button" onClick={() => restoreVersion(r.id)} disabled={restoringId !== null}
                              className="shrink-0 px-3 py-1.5 border border-stone-300 rounded text-[11px] font-sans font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-wait cursor-pointer transition-colors"
                            >
                              {restoringId === r.id ? 'Memulihkan…' : 'Pulih versi ini'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
