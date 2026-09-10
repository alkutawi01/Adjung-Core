// Utility module for sanitizing and cleaning HTML/RSS source texts before passing them to AI pipelines.

export function sanitizeHtmlText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let clean = rawText
    // Remove HTML tags
    .replace(/<[^>]*>/g, ' ')
    // Decode decimal numeric HTML entities (e.g. &#039;, &#8211;, &#8217;)
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return code ? String.fromCharCode(code) : '';
    })
    // Decode hex numeric HTML entities (e.g. &#x27;)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return code ? String.fromCharCode(code) : '';
    })
    // Replace named HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&hellip;/g, '...')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    // Buang SEMULA sebarang tag yang baru terdedah selepas nyahkod entiti di atas (cth suapan
    // RSS jahat/rosak yang hantar "&lt;script&gt;...&lt;/script&gt;" — regex buang-tag PERTAMA
    // di atas tak jumpa apa-apa sebab tiada '<'/'>' literal lagi pada peringkat tu, nyahkod
    // entiti BARU mendedahkan tag sebenar. Tanpa pas kedua ni, teks RSS luaran yang disimpan ke
    // DB (title/description) boleh mengandungi tag HTML/script sebenar walaupun fungsi ni
    // sepatutnya "strip semua tag" — punca berpotensi stored-XSS kalau medan ni pernah
    // dipaparkan via dangerouslySetInnerHTML di mana-mana masa depan.
    .replace(/<[^>]*>/g, ' ')
    // Completely remove all copyright symbols (&copy;, ©, (c), (C))
    .replace(/&(?:copy);?/gi, '')
    .replace(/©/g, '')
    .replace(/\s+\([cC]\)\s*/g, ' ')
    // Replace weird Unicode control characters
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    // Remove copyright boilerplate, publisher names, and 'all rights reserved' at the end of text (BRIEF_FORMATTER_RULE_006)
    .replace(/(?:\s*[-–—|•]?\s*(?:\bcopyright\b|\bhakcipta\b|\bhak cipta\b|\ball rights reserved\b|new straits times(?: press)?(?: \(m\) bhd)?|bernama|media prima|astro awani|utusan malaysia|kosmo(?: digital)?|sinar harian|berita harian|rtm|the star)\b.*$)/gi, '')
    // Remove comma before dots/ellipsis (e.g. TH,... or TH, ...)
    .replace(/,\s*(?:\.{3,}|…)/g, '...')
    // Format 4 or more dots as ". ..."
    .replace(/\.{4,}/g, '. ...')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    .trim();

  return clean;
}

// 2026-08-02 (Fasa 2, pepijat kritikal) — dahulu URL/GUID RSS turut ditapis melalui
// sanitizeHtmlText(), yang termasuk regex membuang nama penerbit ("bernama", "kosmo(
// digital)?", dll) di HUJUNG teks prosa (BRIEF_FORMATTER_RULE_006). Regex tu tak sedar ia
// sedang memproses URL, bukan ayat — "https://www.bernama.com/bm/news.php?id=21001"
// mengandungi "bernama" sebagai SEBAHAGIAN HOSTNAME, jadi segala-galanya SELEPAS perkataan
// itu (kandungan laluan penuh URL) turut terpadam, tinggal "https://www." sahaja. Dua
// daripada empat sumber RSS disemai (bernama.com, kosmo.com.my) terjejas — setiap item
// ticker daripada sumber tu simpan originalUrl yang rosak/tak boleh diklik.
//
// Fungsi ni sengaja HANYA nyahkod entiti HTML + buang tag + potong ruang — URL/GUID tak
// pernah perlu pembersihan prosa (nama penerbit/hakcipta/dsb) sebab ia bukan teks bacaan.
export function sanitizeUrlText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return code ? String.fromCharCode(code) : '';
    })
    .trim();
}

// isSafeHttpUrl (2026-09-08, pepijat kritikal) — medan link/guid RSS akhirnya dipaparkan
// terus sebagai `<a href={...}>` di laman awam (FrontpageView.tsx, FocusView.tsx, dll),
// tapi sanitizeUrlText() di atas cuma buang tag HTML + nyahkod entiti — ia TAK PERNAH
// sahkan skema URL. Suapan RSS jahat boleh hantar `<link>javascript:alert(document.cookie)
// </link>` (atau format Atom `<link href="javascript:...">`, yang malah terus digunakan
// mentah TANPA sanitizeUrlText langsung — lihat RssDirectEngine.js) dan skrip tu akan
// jalan bila pembaca klik pautan sumber — stored-XSS melalui href, bukan melalui teks/HTML.
// Fungsi ni WAJIB dipanggil pada setiap medan link/guid RSS sebelum disimpan — hanya
// benarkan http:// / https:// (atau rentetan kosong), apa-apa skema lain (javascript:,
// data:, vbscript:, dll) ditolak jadi rentetan kosong supaya UI jatuh balik ke '#'.
export function isSafeHttpUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function truncateWords(text, maxWords = 100) {
  if (!text) return '';
  // Pembetulan (2026-09-11, bug-hunt): dahulu split(/\s+/) terus pada `text` mentah TANPA
  // trim() dahulu — teks berjeda di hadapan/belakang (biasa selepas HTML strip/RSS feed
  // mentah, cth " Berita utama...") menghasilkan token KOSONG palsu ("".split hasil ["",
  // "Berita", ...]) yang dikira sebagai SATU "perkataan" dalam had `maxWords`. Kesan: had
  // kata jadi off-by-one (satu perkataan SEBENAR kurang drpd sepatutnya dipotong), DAN
  // token kosong tu bocor ke output bercantum ("... " . join(' ') mengekalkan ruang hadapan
  // palsu). trim() dahulu memastikan setiap token dalam array ialah perkataan sebenar.
  const trimmed = text.trim();
  if (trimmed === '') return '';
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return trimmed;
  return words.slice(0, maxWords).join(' ') + '...';
}

export function stripLocationDateline(text) {
  if (!text || typeof text !== 'string') return '';
  // Pembetulan (2026-09-11, bug-hunt): regex asal guna flag 'i' (case-INsensitive) di atas
  // corak [A-Z\s]{2,30} yang tujuannya khusus untuk padan dateline lokasi HURUF BESAR SEMUA
  // (cth "PETALING JAYA –", "KUALA LUMPUR:"). Dengan flag 'i', [A-Z] turut padan huruf KECIL,
  // jadi corak tu sebenarnya jadi "mana-mana perkataan/ayat sepanjang 2-30 aksara diikuti
  // sempang/kolon" — ayat BIASA (bukan dateline) yang klausa pertamanya kebetulan diakhiri
  // '-'/':'/'–' turut kena potong, cth "Menurut kenyataan rasmi - beliau berkata begitu" jadi
  // "beliau berkata begitu" sahaja (klausa pertama LENYAP). Fungsi ni dipanggil terus ke atas
  // teks brief RSS sebenar (RssDirectEngine.js) dan medan editorial (EditorialTextNormalizer.js
  // ruleType strip_dateline), jadi kesannya kandungan artikel sebenar hilang ayat pembuka. Buang
  // flag 'i' — dateline lokasi sentiasa HURUF BESAR SEMUA secara konvensyen (itu sebab corak
  // tu [A-Z] pada mulanya), jadi tanpa 'i' ia hanya padan dateline sebenar, bukan ayat biasa.
  return text.replace(/^(?:[A-Z\s]{2,30}(?:[,\s]+\d{1,2}\s+[A-Za-z]+)?)\s*[\-–—:]+\s*/, '').trim();
}
