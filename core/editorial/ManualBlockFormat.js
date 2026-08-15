// Single source of truth for the "manual paste" text template used by Manual-mode bento slots:
// splitting a slotsConfig.manualSummary blob into per-item blocks, extracting each block's
// Label: value fields, and serializing structured items back into that same text format.
// Imported by both server.js (syncManualObjectsForSlot/resolveSlotContent, the read/write path
// for ALL bento tiers including BAR) and the client Urus Slot editor (SlotManagerModal.tsx, bento
// tiers other than BAR). Ticker (slotIndex -1) uses its own separate format (parseTickerText in
// core/routes/contentRoutes.js) and does not go through this module.

// Splits a manualSummary blob into per-item blocks. Tolerates several separator conventions the
// UI has used over time (____, ----, ====, or a blank-line boundary right before a new UUID:/
// Tajuk:/Event: line) so old and new content keep parsing the same way.
//
// Lookbehind (2026-08-16, pepijat simulasi "Tampal" Izzat -- ujian sebenar ChatGPT) -- "Topik:"
// SENTIASA baris terus sebelum "Tajuk:" dalam templat semasa (lihat buildAiPrompt di
// SlotManagerModal.tsx), dan AI luaran (ChatGPT/Gemini/dll) sentiasa letak baris kosong antara
// SETIAP medan bila teks disalin dari antara muka chat -- corak tu (blank line selepas "Topik:
// ...") sepadan TEPAT dengan lookahead \n{2,}(?=Tajuk:) di bawah, jadi SETIAP kandungan AI TUNGGAL
// terbelah dua secara silap: blok 1 nyaris kosong (cuma Topik), blok 2 segala-galanya lain (TANPA
// Topik). Bukan kes jarang -- berlaku SETIAP kali editor tampal output AI ikut templat semasa.
// Lookbehind (?<!Topik:[^\n]*) sekat split kalau baris SEBELUM baris kosong tu ialah "Topik:" --
// kes legasi (UUID:/Tajuk:/Event: selepas teks LAIN, bukan Topik:) kekal pecah macam biasa.
export const MANUAL_BLOCK_SPLIT_REGEX = /(?<!Topik:[^\n]*)(?:\r?\n){2,}(?=UUID:|Tajuk:|Event:)|____+|----+|====+|___+/i;

// Canonical separator used when serializing a fresh block list back into one text blob.
export const MANUAL_BLOCK_SEPARATOR = '\n\n________________________________________\n\n';

// Editors see inline "(had N aksara)" hints baked into template placeholders as a budget
// reminder while typing directly into the raw textarea. This strips them wherever they land in
// the line (editors type on both sides of the hint, not just after it).
export const stripLimitHint = (s) =>
  (s || '')
    .replace(/\(\s*had\s*\d+\s*aksara\s*\)/gi, '')
    .replace(/^\([^)]+\)\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

// Extracts every recognized Label: value line from one block into a flat fields object. Mirrors
// the field set syncManualObjectsForSlot() persists to editorial_attribute_values, plus UUID
// (identity) and isEventBlock (BAR's Event: header sets a different default desk).
//
// Huraian ada DUA medan berasingan — "Huraian ringkas" (brief, dipapar pada kad) dan "Huraian
// panjang" (briefLong, hanya untuk mod spotlight akan datang, tidak dipapar pada kad). "Huraian:"
// tanpa kelayakan ringkas/panjang masih dikenali sebagai alias LEGASI untuk "Huraian ringkas:"
// supaya templat lama terus dihurai.
//
// "Tarikh sumber:" ialah label KANONIKAL untuk tarikh bahan asal (originalDate) — "Tarikh:" masih
// dikenali sebagai alias legasi.
// Medan yang BOLEH menyimpan berbilang baris/perenggan (2026-08-12, pepijat kehilangan data
// ditemui simulasi UX #21). Sempadan ni sepadan TEPAT dgn jenis input UI: medan yang dirender
// sebagai <textarea> dlm SlotManagerModal/BarSlotManagerModal (Huraian ringkas rows=4, Huraian
// panjang rows=5, Nota rows=2, Penerangan bagi Bar) boleh mengandungi perenggan; medan lain
// ialah <input> satu-baris (Tajuk, Topik, Sumber, URL, tarikh, dll) dan MESTI kekal satu baris —
// baris berikutnya selepasnya bukan sambungan, ia baris sesat yang patut terus diabaikan.
const MEDAN_BERBILANG_BARIS = new Set(['brief', 'briefLong', 'note', 'penerangan']);

// SEMUA label yang dikenali parser di bawah — satu senarai, dipakai utk menentukan sama ada satu
// baris ialah permulaan medan BAHARU (tamatkan medan berbilang-baris semasa) atau cuma baris
// sambungan. Senarai ni MESTI kekal segerak dgn rantaian else-if dalam parseManualBlockFields;
// kalau label baharu ditambah di sana tapi terlupa di sini, baris label itu akan tersalah anggap
// sebagai teks sambungan dan tenggelam ke dalam medan sebelumnya.
const LABEL_DIKENALI = [
  'UUID:', 'Status:', 'Tajuk:', 'Event:', 'Huraian panjang:', 'Huraian ringkas:', 'Huraian:',
  'Bidang:', 'Kategori:', 'Topik:', 'Jenis sumber:', 'Tarikh mula:', 'Tarikh tamat:',
  'Tarikh sumber:', 'Tarikh:', 'Penulis:', 'Nota:', 'Imej:', 'Penganjur:', 'Lokasi:', 'Akses:',
  'Penerangan:', 'Sumber:', 'URL:',
];
const ADA_LABEL_DIKENALI = (trimmed) =>
  LABEL_DIKENALI.some((label) => trimmed.toLowerCase().startsWith(label.toLowerCase()));

// Nyahbungkus pautan gaya Markdown "[teks](url)" (2026-08-16, pepijat kandungan sebenar pertama
// Izzat) — prompt buildAiPrompt() eksplisit larang Markdown ("JANGAN gunakan Markdown"), tapi AI
// luaran kadangkala tetap bungkus URL ikut tabiat (terutama bila URL panjang berulang sebagai
// "teks paparan" dan "sasaran pautan" sekali, cth "[https://x.com/...](https://x.com/...)").
// Tanpa ni, keseluruhan "[https://...](https://...)" tersimpan sebagai URL, gagal validateSourceUrl
// (ContentBudget.js, minta skema http(s):// di AWAL rentetan) — editor sangka pautan salah walhal
// URL sebenar (dalam kurungan) memang sah. Guna bahagian DALAM KURUNGAN (href sebenar Markdown),
// bukan teks label — kedua-dua bahagian selalunya sama untuk kes ni, tapi kalau berbeza, kurungan
// mewakili sasaran pautan sebenar mengikut spesifikasi Markdown.
const nyahBungkusMarkdownLink = (raw) => {
  const t = (raw || '').trim();
  const m = t.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
  return m ? m[2].trim() : t;
};

export function parseManualBlockFields(block) {
  const lines = (block || '').split('\n');
  const fields = {
    uuid: '', title: '', brief: '', briefLong: '', desk: '', topik: '',
    // dateEnd (2026-08-07, permintaan Izzat) — Slot BAR sahaja (acara boleh julat hari). Alias
    // legasi "Tarikh sumber:"/"Tarikh:" (satu tarikh, blok lama) tetapkan date DAN dateEnd sama.
    date: '', dateEnd: '', source: '', url: '', sourceType: '',
    // Sumber berbilang (2026-08-05, permintaan Izzat) — SETIAP baris "Sumber:" tolak entri
    // baharu ke `sources` (dipasangkan dengan "URL:" berikutnya, jika ada, ikut turutan
    // ditaip — editor sentiasa taip Sumber lalu URL bersebelahan dalam templat). `source`/`url`
    // tunggal di atas KEKAL = entri PERTAMA sahaja (keserasian ke belakang untuk pengguna
    // sedia ada yang cuma baca satu sumber, cth kad bento sebelum ciri ni wujud). Setiap entri
    // sources[] kini bawa `date` sendiri (2026-08-15, permintaan Izzat -- sumber berbeza boleh
    // ada tarikh terbitan berbeza, satu medan `date` kongsi di peringkat blok mengelirukan/
    // kehilangan maklumat). `date`/`dateEnd` tunggal di bawah KEKAL sebagai medan legasi
    // (BAR julat tarikh acara, dan cermin sumber PERTAMA untuk kandungan lama pra-ciri ni).
    sources: [],
    organizer: '', location: '', access: '', penerangan: '',
    note: '', image: '', isEventBlock: false,
    // Penulis (2026-08-01, permintaan pemilik projek — modul "Draf Saya"): nama pena editor yang
    // MENCIPTA blok ni. Dicap sekali sahaja semasa blok baharu dibuat, tak berubah bila orang lain
    // menyuntingnya kemudian. Berasingan daripada attribute 'editorName' (dicap semasa TERBIT,
    // menjawab siapa menerbitkan) — draf tak pernah sampai ke editorial_objects, jadi ia perlukan
    // capnya sendiri di dalam blok teks ni. Blok lama tiada baris ni; "Draf Saya" jatuh balik pada
    // penugasan slot (jadual slot_editors) untuk blok tanpa nama, bukan menekanya kepada sesiapa.
    penulis: '',
    // Alur kerja Draf/Terbit (2026-07-29) — 'draft' (kerja belum siap, tak sesekali live),
    // 'pending' (dah "Terbit" tapi tersekat, cth had slot penuh — sistem had belum wujud lagi,
    // ni ruang untuknya nanti), 'approved' (live). LALAI 'approved' (BUKAN 'draft') bila medan
    // Status: tiada langsung — kritikal: setiap blok lama yang disimpan SEBELUM ciri ni wujud
    // memang live (status 'approved' dikunci keras dalam kod lama), tiada satu pun ada baris
    // "Status:". Lalai 'draft' di sini akan nyahterbitkan SEMUA kandungan sedia ada secara senyap
    // pada simpan seterusnya — 'draft' cuma jadi lalai eksplisit untuk item BAHARU (blankItem()
    // di SlotManagerModal.tsx), bukan tafsiran blok lama yang tiada label ni.
    status: 'approved',
  };

  // Medan berbilang-baris yang sedang dikumpul (null = tiada). Ditetapkan bila label medan
  // berbilang-baris dijumpai, DIKOSONGKAN semula oleh SETIAP label lain yang dikenali — supaya
  // label seterusnya sentiasa menamatkan medan semasa, tak kira medan apa.
  let medanSemasa = null;
  // Tarikh per-sumber (2026-08-15) — "Tarikh sumber:" yang muncul SEJURUS SELEPAS baris "URL:"
  // diikat kepada sumber tu (bukan medan tunggal legasi). "Tarikh sumber:" yang muncul di
  // tempat lain (cth. hujung blok, corak SEMUA kandungan sebelum ciri ni) jatuh ke cabang
  // legasi seperti biasa — serasi mundur penuh, tiada kandungan sedia ada terjejas.
  let sumberDateArmed = false;
  for (const line of lines) {
    // Label bernombor (2026-08-16, pepijat simulasi tambahan Izzat — "betul2 tiada ralat
    // langsung?") — prompt SISTEM sendiri (buildAiPrompt) guna label bernombor "URL sumber 1:"/
    // "URL sumber 2:" utk SENARAI sumber diberi kpd AI (bukan arahan format output — output rasmi
    // sentiasa minta label polos "Sumber:"/"URL:"), tapi AI luaran boleh tiru corak input tu bila
    // menjana output sendiri (belum diperhatikan di ChatGPT dlm ujian sebenar, tapi projek ni ada
    // sejarah "diuji sebenar terhadap 4 AI, KESEMUA langgar sekurang-kurangnya SATU had" -- model
    // lain (Gemini/DeepSeek/Grok) berkemungkinan tak sama). "Sumber 1:"/"URL 2:" TANPA normalize
    // ni gagal padan ADA_LABEL_DIKENALI terus -> baris hilang senyap/tersasar jadi teks sambungan.
    // Normalize di sini (SEBELUM apa-apa logik lain) supaya "Sumber 1:"/"URL 2:"/"Tarikh sumber 3:"
    // dilayan SAMA macam label polos, tanpa ubah tingkah laku label yang sedia betul.
    const trimmed = line.trim().replace(/^(Sumber|URL|Tarikh sumber)\s+\d+\s*:/i, '$1:');
    // Baris sambungan (2026-08-12, pembetulan pepijat #21) — baris yang BUKAN label dikenali.
    // Sebelum ni ia jatuh melalui semua else-if TANPA else dan HILANG SENYAP: editor taip/tampal
    // Huraian panjang berbilang perenggan, simpan, buka semula -> perenggan 2 ke atas lenyap tanpa
    // amaran (disahkan 0 drpd 40 kandungan produksi ada pemisah perenggan, walhal FocusView.tsx
    // memang pecah `\n{2,}` jadi <p> berasingan — kod render tu praktikalnya mati). Baris kosong
    // turut dikekalkan supaya sempadan perenggan (`\n\n`) sampai ke renderer.
    if (medanSemasa && !ADA_LABEL_DIKENALI(trimmed)) {
      fields[medanSemasa] += '\n' + trimmed;
      continue;
    }
    // Baris kosong DI ANTARA label (2026-08-16, pepijat simulasi "Tampal" Izzat) — AI luaran
    // sentiasa letak baris kosong antara SETIAP medan (termasuk antara "URL:" dan "Tarikh
    // sumber:") bila teks disalin dari antara muka chat. Tanpa baris ni, blank line tu jatuh ke
    // cabang di bawah dan reset `sumberDateArmed` SEBELUM baris "Tarikh sumber:" sempat diproses
    // — tarikh per-sumber hilang senyap, jatuh balik ke medan legasi kongsi (tepat masalah yang
    // ciri tarikh-per-sumber cuba elak). Baris kosong di sini cuma no-op, tak reset apa-apa state.
    if (trimmed === '') continue;
    // Label dikenali dijumpai -> medan berbilang-baris sebelumnya (jika ada) TAMAT di sini.
    // Cabang medan berbilang-baris di bawah menetapkan semula `medanSemasa` selepas ni.
    medanSemasa = null;
    if (trimmed.startsWith('Tarikh sumber:') && sumberDateArmed && fields.sources.length > 0) {
      const tarikhSumber = trimmed.replace(/^Tarikh sumber:\s*/i, '').trim();
      fields.sources[fields.sources.length - 1].date = tarikhSumber;
      if (fields.sources.length === 1) { fields.date = tarikhSumber; fields.dateEnd = tarikhSumber; }
      sumberDateArmed = false;
      continue;
    }
    sumberDateArmed = false;
    if (trimmed.startsWith('UUID:')) {
      fields.uuid = trimmed.replace(/^UUID:\s*/i, '').trim();
    } else if (trimmed.startsWith('Status:')) {
      const raw = trimmed.replace(/^Status:\s*/i, '').trim().toLowerCase();
      if (raw === 'draf' || raw === 'draft') fields.status = 'draft';
      else if (raw === 'pending' || raw === 'menunggu') fields.status = 'pending';
      else fields.status = 'approved';
    } else if (trimmed.startsWith('Tajuk:')) {
      fields.title = stripLimitHint(trimmed.replace(/^Tajuk:\s*/i, ''));
    } else if (trimmed.startsWith('Event:')) {
      fields.title = trimmed.replace(/^Event:\s*/i, '').trim();
      fields.desk = 'ACARA';
      fields.isEventBlock = true;
    } else if (trimmed.startsWith('Huraian panjang:')) {
      fields.briefLong = stripLimitHint(trimmed.replace(/^Huraian panjang:\s*/i, ''));
      medanSemasa = 'briefLong';
      continue;
    } else if (trimmed.startsWith('Huraian ringkas:')) {
      fields.brief = stripLimitHint(trimmed.replace(/^Huraian ringkas:\s*/i, ''));
      medanSemasa = 'brief';
      continue;
    } else if (trimmed.startsWith('Huraian:')) {
      fields.brief = stripLimitHint(trimmed.replace(/^Huraian:\s*/i, ''));
      medanSemasa = 'brief';
      continue;
    } else if (trimmed.startsWith('Bidang:')) {
      fields.desk = trimmed.replace(/^Bidang:\s*/i, '').trim();
    } else if (trimmed.startsWith('Kategori:')) {
      fields.desk = trimmed.replace(/^Kategori:\s*/i, '').trim();
    } else if (trimmed.startsWith('Topik:')) {
      fields.topik = stripLimitHint(trimmed.replace(/^Topik:\s*/i, ''));
    } else if (trimmed.startsWith('Jenis sumber:')) {
      fields.sourceType = trimmed.replace(/^Jenis sumber:\s*/i, '').trim();
    } else if (trimmed.startsWith('Tarikh mula:')) {
      fields.date = trimmed.replace(/^Tarikh mula:\s*/i, '').trim();
    } else if (trimmed.startsWith('Tarikh tamat:')) {
      fields.dateEnd = trimmed.replace(/^Tarikh tamat:\s*/i, '').trim();
    } else if (trimmed.startsWith('Tarikh sumber:')) {
      fields.date = trimmed.replace(/^Tarikh sumber:\s*/i, '').trim();
      fields.dateEnd = fields.date;
    } else if (trimmed.startsWith('Tarikh:')) {
      fields.date = trimmed.replace(/^Tarikh:\s*/i, '').trim();
      fields.dateEnd = fields.date;
    } else if (trimmed.startsWith('Penulis:')) {
      fields.penulis = trimmed.replace(/^Penulis:\s*/i, '').trim();
    } else if (trimmed.startsWith('Nota:')) {
      fields.note = trimmed.replace(/^Nota:\s*/i, '').trim();
      medanSemasa = 'note';
      continue;
    } else if (trimmed.startsWith('Imej:')) {
      fields.image = trimmed.replace(/^Imej:\s*/i, '').trim();
    } else if (trimmed.startsWith('Penganjur:')) {
      fields.organizer = trimmed.replace(/^Penganjur:\s*/i, '').trim();
    } else if (trimmed.startsWith('Lokasi:')) {
      fields.location = trimmed.replace(/^Lokasi:\s*/i, '').trim();
    } else if (trimmed.startsWith('Akses:')) {
      fields.access = trimmed.replace(/^Akses:\s*/i, '').trim();
    } else if (trimmed.startsWith('Penerangan:')) {
      fields.penerangan = trimmed.replace(/^Penerangan:\s*/i, '').trim();
      medanSemasa = 'penerangan';
      continue;
    } else if (trimmed.startsWith('Sumber:')) {
      const nama = trimmed.replace(/^Sumber:\s*/i, '').trim();
      if (fields.sources.length === 0) fields.source = nama; // entri pertama = medan tunggal legasi.
      fields.sources.push({ name: nama, url: '', date: '' });
    } else if (trimmed.startsWith('URL:')) {
      const url = nyahBungkusMarkdownLink(trimmed.replace(/^URL:\s*/i, ''));
      if (fields.sources.length === 0) {
        // Baris "URL:" muncul sebelum "Sumber:" (jarang, tapi templat tak kuatkuasa turutan) —
        // cipta entri sumber kosong supaya URL ni tak hilang.
        fields.sources.push({ name: '', url, date: '' });
      } else {
        fields.sources[fields.sources.length - 1].url = url;
      }
      if (fields.sources.length === 1) fields.url = url; // entri pertama = medan tunggal legasi.
      sumberDateArmed = true; // "Tarikh sumber:" sejurus selepas ni (jika ada) diikat ke sumber ni.
    }
  }

  // Kemas hujung medan berbilang-baris — baris kosong sebelum label seterusnya (cth "Huraian
  // panjang: ...\n\nSumber: X") tinggalkan '\n' berlebihan di hujung nilai. Sempadan perenggan
  // DALAM teks kekal utuh; cuma ekor yang dipangkas.
  for (const medan of MEDAN_BERBILANG_BARIS) {
    if (typeof fields[medan] === 'string') fields[medan] = fields[medan].replace(/\s+$/, '');
  }

  return fields;
}

// Splits + parses a full manualSummary blob into an ordered list of block field-sets, for the
// CLIENT's live queue editor (SlotManagerModal) — unlike server.js's parseManualSummaryTemplate
// (which drops title-less blocks since it's building the PUBLISHED carousel), this keeps every
// block including blank drafts. A freshly "+ Tambah kandungan"-ed item has no title yet; dropping
// it here would make it vanish from the editor the instant it's added (silently discarding
// anything typed into it, since patch() targets an index that no longer exists after re-derive).
// The "must have a title to publish" rule still applies server-side at actual save time.
export function parseManualSummaryBlocks(summaryText) {
  if (!summaryText || (!summaryText.includes('Tajuk:') && !summaryText.includes('Event:'))) return [];
  return (summaryText || '')
    .split(MANUAL_BLOCK_SPLIT_REGEX)
    // MANUAL_BLOCK_SPLIT_REGEX's alternatives overlap on the standard "\n\n____...____\n\n"
    // separator: the underscore run matches `___+` AND the blank line immediately before the
    // next block's "UUID:" independently matches the lookahead alternative, so split() finds TWO
    // adjacent delimiters back-to-back and emits a genuinely empty string as the "content" between
    // them. That empty fragment is not a block — it never contained a UUID:/Tajuk: line at all —
    // so it must be dropped here, distinct from a legitimate blank DRAFT item (which still has
    // real "UUID: ...\nTajuk: \n..." lines, just empty values, and must be kept — see below).
    .filter((block) => block.trim().length > 0)
    .map(parseManualBlockFields);
}

// Serializes one bento (non-BAR) item back into the Label: value block format, including a UUID:
// header line so re-parsing recovers the same identity. Uses the CANONICAL labels (Huraian
// ringkas/panjang, Tarikh sumber) — parseManualBlockFields still accepts the legacy aliases on
// the way IN, but everything written back out uses the unambiguous form.
export function serializeManualBentoItem(item) {
  const uuid = item.uuid || '';
  const status = item.status === 'draft' ? 'draf' : item.status === 'pending' ? 'pending' : 'terbit';

  // Sumber berbilang (2026-08-05, permintaan Izzat) — tulis SATU pasangan Sumber:/URL: per
  // entri `item.sources` (bukan cuma medan tunggal item.source/item.url) supaya parseManualBlockFields
  // baca balik SEMUA entri, bukan cuma yang pertama. Jatuh balik ke medan tunggal kalau
  // `item.sources` tiada/kosong (item lama sebelum ciri ni wujud, atau editor cuma isi medan
  // tunggal — UI SlotManagerModal.tsx sentiasa isi `sources`, ni jaring keselamatan sahaja).
  // Tarikh per-sumber (2026-08-15, permintaan Izzat) — ditulis SEJURUS SELEPAS URL: sumber
  // masing-masing (bukan satu baris "Tarikh sumber:" tunggal di hujung blok macam sebelum ni),
  // supaya parseManualBlockFields ikat balik tarikh yang betul kepada sumber yang betul.
  const sumberBaris = [];
  const sourcesList = Array.isArray(item.sources) && item.sources.length > 0
    ? item.sources
    : [{ name: item.source || '', url: item.url || '', date: item.date || '' }];
  for (const s of sourcesList) {
    sumberBaris.push(`Sumber: ${s.name || ''}`);
    sumberBaris.push(`URL: ${s.url || ''}`);
    sumberBaris.push(`Tarikh sumber: ${s.date || ''}`);
  }

  return [
    `UUID: ${uuid}`,
    `Status: ${status}`,
    `Tajuk: ${item.title || ''}`,
    `Topik: ${item.topik || item.topic || ''}`,
    `Huraian ringkas: ${item.brief || ''}`,
    `Huraian panjang: ${item.briefLong || ''}`,
    ...sumberBaris,
    // Jenis sumber (Fasa 8b, 2026-08-05) — SEBELUM NI TIADA DI SINI walaupun
    // parseManualBlockFields() (atas fail ni) SUDAH baca baris ni sejak sekian lama: nilai yang
    // editor pilih hilang senyap pada bulatan simpan seterusnya (baca → simpan → baca semula =
    // kosong), sebab serialize tak pernah tulis baris ni balik ke teks. Ditemui semasa sambung
    // dropdown UI (SlotManagerModal.tsx) — pepijat sedia ada, bukan diperkenalkan ciri baharu ni.
    `Jenis sumber: ${item.sourceType || ''}`,
    `Imej: ${item.image || ''}`,
    `Nota: ${item.note || ''}`,
    `Penulis: ${item.penulis || ''}`,
  ].join('\n');
}

export function serializeManualBentoQueue(items) {
  return (items || []).map(serializeManualBentoItem).join(MANUAL_BLOCK_SEPARATOR);
}

// Serializes one BAR (Slot Bar / acara) item back into the Label: value block format. Distinct
// field set from serializeManualBentoItem above — Bar has no Tajuk/Huraian/Bidang/Topik, uses
// "Event:" as its title header (sets isEventBlock/desk='ACARA' on re-parse, see
// parseManualBlockFields) plus Penganjur/Lokasi/Akses/Penerangan, the fields actually displayed
// by BarCard.tsx/BarCardExpandedPanel.tsx. Kept a separate function (not a branch inside
// serializeManualBentoItem) so the two field sets can never silently bleed into each other.
export function serializeManualBarItem(item) {
  const uuid = item.uuid || '';
  const status = item.status === 'draft' ? 'draf' : item.status === 'pending' ? 'pending' : 'terbit';
  return [
    `UUID: ${uuid}`,
    `Status: ${status}`,
    `Event: ${item.title || ''}`,
    `Penganjur: ${item.organizer || ''}`,
    `Lokasi: ${item.location || ''}`,
    `Akses: ${item.access || ''}`,
    `Penerangan: ${item.penerangan || ''}`,
    // Tarikh mula/tamat (2026-08-07, permintaan Izzat — kalendar popup, boleh julat hari acara).
    // Gantikan "Tarikh sumber:" tunggal sebelum ini. Alias lama "Tarikh sumber:"/"Tarikh:" masih
    // DIHURAI oleh parseManualBlockFields (tetapkan kedua-dua medan sama), jadi blok Bar sedia ada
    // dalam DB kekal terbaca — cuma tulisan BAHARU guna label julat ni.
    `Tarikh mula: ${item.date || ''}`,
    `Tarikh tamat: ${item.dateEnd || item.date || ''}`,
    `Sumber: ${item.source || ''}`,
    `URL: ${item.url || ''}`,
    `Imej: ${item.image || ''}`,
    `Nota: ${item.note || ''}`,
    `Penulis: ${item.penulis || ''}`,
  ].join('\n');
}

export function serializeManualBarQueue(items) {
  return (items || []).map(serializeManualBarItem).join(MANUAL_BLOCK_SEPARATOR);
}
