// Modul kongsi ciri Petikan (2026-08-19) — SATU sumber kebenaran untuk kategori, penjana Arahan
// AI, penghurai tampalan, dan algoritma kolam harian. Diimport oleh KEDUA-DUA pelayan
// (core/routes/petikanRoutes.js) dan klien (src/components/editorium/PetikanConsole.tsx) melalui
// laluan relatif berakhir `.js` — corak SAMA seperti ManualBlockFormat.js/GeometryConfig.js.
//
// Sebab ia dikongsi, bukan disalin: projek ni ada sejarah pepijat sebenar akibat penghurai/nombor
// disalin dua kali lalu terpesong sesama sendiri (lihat CLAUDE.md — 5 salinan had aksara, dua
// daripadanya pepijat). Kategori dan peraturan penghuraian MESTI identik di kedua-dua hujung.

// ---------------------------------------------------------------------------------------------
// KATEGORI — senarai TERTUTUP, sengaja.
//
// Ini BUKAN taksonomi "Bidang" Adjung dan tidak berkaitan dengannya. Ia tidak dipaparkan kepada
// pembaca, tidak membuka Focus View, dan tidak menapis kandungan. Fungsinya SATU sahaja: memberi
// algoritma kolam harian sesuatu untuk mempelbagaikan susunan supaya dua petikan bidang sama
// tidak berjiran.
//
// Tertutup (bukan teks bebas) kerana teks bebas akan segera menghasilkan "Sejarah", "sejarah",
// "Sejarah Islam", "Histori" — dan anti-ulang terus rosak tanpa sesiapa perasan.
export const KATEGORI_PETIKAN = [
  'Agama', 'Falsafah', 'Sejarah', 'Sastera', 'Sains', 'Masyarakat',
  'Pendidikan', 'Ekonomi', 'Psikologi', 'Kehidupan', 'Lain-lain',
];

// ---------------------------------------------------------------------------------------------
// BAHASA — dua teks, satu rekod (2026-08-19, keputusan Izzat)
//
// Frontpage Adjung Brief memaparkan Bahasa Melayu SAHAJA. Tetapi petikan daripada kitab Arab atau
// buku Inggeris TIDAK dibuang: teks asal disimpan dan dipaparkan DALAM SISTEM untuk semakan Ketua
// Editor, manakala pembaca melihat terjemahan sahaja, berlabel.
//
// `teksPaparan` DITERBITKAN daripada bahasa asal, bukan disimpan sebagai keputusan berasingan —
// supaya kes Melayu dan kes terjemahan tidak menjadi dua laluan kod yang boleh menyimpang:
//
//   bahasaAsal Melayu      -> teksPaparan = teksAsal,  terjemahan tidak diperlukan
//   bahasaAsal bukan Melayu -> teksPaparan = teksMelayu, terjemahan perlu disahkan berasingan

/** Nama bahasa yang dikenali, dipetakan ke bentuk paparan Melayu. Senarai ni BUKAN tertutup —
 *  bahasa di luar senarai diterima dan dipaparkan sebagaimana ditulis; peta ni cuma mengemaskan
 *  bentuk yang paling kerap muncul supaya label tidak berbunyi janggal. */
const NAMA_BAHASA = {
  'ms': 'Melayu', 'melayu': 'Melayu', 'bahasa melayu': 'Melayu', 'malay': 'Melayu',
  'ar': 'Arab', 'arab': 'Arab', 'bahasa arab': 'Arab', 'arabic': 'Arab',
  'en': 'Inggeris', 'inggeris': 'Inggeris', 'bahasa inggeris': 'Inggeris', 'english': 'Inggeris',
  'id': 'Indonesia', 'indonesia': 'Indonesia',
};

/** Bentuk kemas nama bahasa untuk paparan. Kosong -> '' (pemanggil yang putuskan maknanya). */
export function namaBahasa(mentah) {
  const t = String(mentah || '').trim();
  if (!t) return '';
  return NAMA_BAHASA[t.toLowerCase()] || t;
}

export const adalahBahasaMelayu = (mentah) => namaBahasa(mentah) === 'Melayu';

/** Label metadata sekunder di bawah petikan.
 *
 * "Diterjemah daripada X" (bentuk pendek asal) DIBUANG — Izzat tegur terus (2026-08-19):
 * "salah ni, janggal sangat". Puncanya imbuhan tak lengkap: "diterjemah" tanpa akhiran "-kan"
 * bukan bentuk pasif sah Bahasa Melayu. Bentuk BETUL yang Izzat berikan sendiri: "Diterjemahkan
 * dari Bahasa X". Lebih panjang daripada percubaan pendek asal, tetapi tatabahasa BETUL
 * mengatasi kepadatan ruang — margin 180-220px masih boleh tampung dua baris kalau perlu; teks
 * editorial yang janggal tidak boleh dibiarkan demi jimat piksel.
 * Pembetulan kedua (2026-08-19, Izzat): "dari" -> "daripada" (kata sendi asal-usul yang betul
 * dalam konteks ni), dan "Bahasa X" -> "bahasa x" huruf kecil (nama bahasa ialah kata am dalam
 * ayat ni, bukan sebahagian nama khas "Bahasa Melayu"/"Bahasa Inggeris" sebagai istilah rasmi).
 *
 * Pulangkan '' untuk sumber Melayu: label pada petikan yang tidak pernah diterjemahkan adalah
 * salah, bukan sekadar janggal. */
export function labelTerjemahan(bahasaAsal) {
  const nama = namaBahasa(bahasaAsal);
  if (!nama || nama === 'Melayu') return '';
  return `Diterjemahkan daripada bahasa ${nama}`;
}

// Label medan yang penghurai kenali. Apa-apa di luar senarai ni bukan label — ia teks biasa.
const LABEL_SAH = [
  'Teks Asal', 'Bahasa Asal', 'Teks Melayu',
  'Pengarang', 'Karya', 'Rujukan', 'Kategori', 'Pautan Buku',
];

/** Alias -> label kanonik. AI kerap memendekkan nama medan walaupun arahan menetapkan bentuk
 *  penuh; menerima bentuk pendek jauh lebih murah daripada menolak rekod yang sempurna kerana
 *  satu perkataan hilang. */
const ALIAS_LABEL = {
  'teks': 'Teks Asal',
  'teks sumber': 'Teks Asal',
  'bahasa': 'Bahasa Asal',
  'terjemahan': 'Teks Melayu',
  'terjemahan melayu': 'Teks Melayu',
  'teks terjemahan': 'Teks Melayu',
};

/** Medan yang BOLEH mengandungi berbilang baris (termasuk baris kosong di tengah). Semua medan
 *  lain ialah satu baris. */
const MEDAN_BERBILANG_BARIS = new Set(['Teks Asal', 'Teks Melayu']);

/** Label yang menandakan permulaan rekod baharu. Lihat nota penghurai di bawah tentang sebab
 *  sempadan rekod TIDAK lagi bergantung pada pemisah "____". */
const LABEL_SAUH = 'Teks Asal';

// Sentinel penanda format dalam Arahan AI. Kemunculan mana-mana daripadanya dalam output bermakna
// AI menyalin templat dan bukan mengisi data sebenar -> blok DITOLAK.
//
// Ini pertahanan TERUS terhadap pepijat sebenar yang pernah sampai ke laman awam: teks contoh
// "(nama sebenar sumber anda)" dan "YYYY-MM-DD" daripada prompt modul Tulis Kandungan tersalin
// verbatim masuk ke pangkalan data lalu tersiar kepada pembaca (2026-08-19, ditangkap Izzat).
// Sentinel bentuk [[...]] dipilih sebab ia MUSTAHIL wujud dalam petikan karya sebenar — berbeza
// daripada meneka perkataan biasa seperti "petikan" yang akan menolak teks sah.
export const SENTINEL_PETIKAN = [
  '[[TEKS_ASAL]]', '[[TEKS_MELAYU]]', '[[BAHASA_ASAL]]', '[[NAMA_PENGARANG]]',
  '[[TAJUK_KARYA]]', '[[RUJUKAN_SUMBER]]', '[[KATEGORI]]', '[[PAUTAN_BUKU]]',
  // Sentinel versi pertama ciri ni — dikekalkan supaya output daripada sesi AI lama yang masih
  // terbuka pada skrin editor tetap ditolak dengan sebab yang betul, bukan diserap separuh.
  '[[TEKS_PETIKAN]]', '[[BAHASA]]',
];

// Placeholder LITERAL yang pernah/berpotensi muncul. Sengaja senarai TEPAT, bukan padanan kabur —
// menolak apa-apa yang mengandungi perkataan "petikan" akan menolak petikan sah tentang petikan.
const PLACEHOLDER_LITERAL = [
  '(nama pengarang)', '(tajuk karya)', '(petikan sebenar)', '(nama sebenar sumber anda)',
  'tampal petikan', 'lorem ipsum', 'yyyy-mm-dd',
];

export const HAD_TEKS_PETIKAN = 400;

// Jarak seragam di sekeliling em dash (2026-08-24, dapatan Izzat — tangkapan skrin petikan
// "harian—bukan" tanpa jarak). Gaya Adjung Brief mahu em dash SENTIASA berjarak daripada
// perkataan di kiri/kanan ("harian — bukan"), bukan gaya rapat konvensyen Inggeris yang kerap
// terbawa terus daripada buku/laman sumber Inggeris yang ditampal editor. Dipanggil di SATU
// tempat sahaja (bentukTeksPaparan(), petikanRoutes.js) merentasi ketiga-tiga laluan simpan
// (cipta manual, sunting, import AI pukal) — bukan disalin ke setiap laluan, sama corak seperti
// modul kongsi lain di fail ni. Hanya `teksPaparan` (apa pembaca lihat) dibersihkan; `teksAsal`
// KEKAL tidak disentuh — ia rekod SEMAKAN literal terhadap sumber, bukan kandungan siaran.
export function normalisasiEmDash(teks) {
  if (typeof teks !== 'string' || teks === '') return teks;
  return teks
    .replace(/\s*—\s*/g, ' — ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

// Jaring keselamatan terhadap arahan Rumi (di atas) — kepatuhan AI terhadap arahan prompt tidak
// pernah 100% terjamin (disahkan berulang kali dalam projek ni, cth pemisah "____" yang sepatutnya
// dipatuhi tapi tidak). Pengarang/Karya yang masih dalam skrip Arab/Cina/Cyrillic/Ibrani/Thai/
// Devanagari/Hangul selepas AI sepatutnya transliterasi ke Rumi ditandakan amaran (BUKAN ditolak —
// petikannya mungkin sempurna, cuma metadata belum ditransliterasi, editor boleh betulkan terus
// dalam kad sebelum simpan).
const AKSARA_BUKAN_RUMI = /[؀-ۿݐ-ݿ一-鿿぀-ヿ가-힯Ѐ-ӿ֐-׿฀-๿ऀ-ॿ]/;

// ---------------------------------------------------------------------------------------------
// ARAHAN AI — teks yang editor salin ke chatbot luar bersama PDF/buku.
//
// Nada sengaja TEGAS dan berulang pada perkara yang paling kerap dilanggar. Pengalaman sebenar
// projek ni: arahan lembut diabaikan, dan "jangan guna Markdown" sahaja tidak menghalang AI
// membungkus URL dalam Markdown. Jadi setiap larangan penting dinyatakan sebagai baris sendiri.
export function binaArahanAiPetikan({ maksimum = 20, pautanBuku = '' } = {}) {
  // Pautan Buku — AI TIDAK PERNAH tahu URL buku sendiri; ia hanya boleh mereka atau tinggalkan
  // kosong (peraturan 13 di bawah sengaja larang mereka URL). Editor SATU-SATUNYA pihak yang
  // tahu URL sebenar (contoh pautan pembelian/perpustakaan digital). Kalau editor mengisinya
  // di konsol SEBELUM menyalin arahan, URL itu ditanam sebagai nilai LITERAL yang sama untuk
  // SETIAP rekod dalam sesi ni — sengaja begitu kerana satu sesi tampal ialah satu buku (lihat
  // nota "SATU sumber = SATU sesi" di PetikanConsole.tsx), bukan medan yang AI kena "isi".
  const arahanPautan = pautanBuku
    ? [
        `Pautan Buku bagi SEMUA rekod dalam sesi ini ialah: ${pautanBuku}`,
        'Salin nilai ini TEPAT SAMA untuk setiap rekod — JANGAN ubah, JANGAN pendekkan, JANGAN tambah teks lain.',
      ]
    : ['Jika pautan buku tidak diketahui, tulis: Pautan Buku: -'];

  return [
    '[PERANAN]',
    '',
    'Anda bertindak sebagai penyunting petikan untuk Adjung Brief.',
    '',
    'Saya akan memberikan sebuah buku, kitab, dokumen atau teks sumber. Tugas anda ialah membaca SUMBER YANG DIBERIKAN dan mengenal pasti petikan sebenar yang menarik serta sesuai dipaparkan kepada pembaca.',
    '',
    'TUGAS INI IALAH PENGEKSTRAKAN PETIKAN, BUKAN PENULISAN SEMULA.',
    '',
    '[PERATURAN MUTLAK]',
    '',
    '1. Gunakan SUMBER YANG DIBERIKAN sahaja.',
    '2. Medan "Teks Asal" MESTI mengandungi kata-kata yang benar-benar terdapat dalam sumber secara VERBATIM, dalam bahasa asal sumber.',
    '3. JANGAN parafrasa petikan.',
    '4. JANGAN memperkemas bahasa petikan.',
    '5. JANGAN membetulkan tatabahasa atau ejaan pengarang.',
    '6. JANGAN meringkaskan petikan.',
    '7. JANGAN menggabungkan ayat daripada lokasi berlainan untuk membentuk satu petikan baharu.',
    '8. JANGAN mencipta petikan berdasarkan idea atau maksud pengarang.',
    '8b. JANGAN memilih ayat al-Quran, hadis Nabi SAW, kata-kata sahabat, ulama, tokoh atau petikan',
    '    daripada karya/sumber lain sebagai petikan pengarang sumber ini. Jika pengarang sumber ini',
    '    hanya menukil atau memetik sumber lain, jangan masukkan petikan tersebut walaupun ia',
    '    terdapat dalam teks sumber yang diberikan.',
    '8c. Pastikan setiap petikan yang dipilih benar-benar merupakan kata-kata atau tulisan pengarang',
    '    karya yang diberikan, bukan kata-kata sumber yang sedang dipetik, dinukil atau dirujuk oleh',
    '    pengarang. Jika asal-usul sesuatu petikan tidak dapat dipastikan, JANGAN pilih petikan',
    '    tersebut. (Kes sukar: pengarang mengulas hadis/ayat dengan satu ayat sendiri, kemudian',
    '    hadis/ayat itu muncul dalam perenggan yang sama — pisahkan suara pengarang daripada bahan',
    '    yang dipetik pengarang; hanya suara pengarang layak dipilih.)',
    '9. JANGAN menggunakan petikan daripada ingatan anda jika ia tidak dapat dikenal pasti dalam sumber yang diberikan.',
    '9b. JANGAN menentukan pengarang sesuatu petikan berdasarkan pengetahuan atau ingatan anda sahaja.',
    '    Gunakan konteks dalam sumber yang diberikan untuk menentukan atribusi. Jika teks menunjukkan',
    '    petikan itu berasal daripada sumber lain (bukan tulisan asal pengarang sumber ini), gugurkan',
    '    petikan tersebut sepenuhnya daripada output.',
    '10. JANGAN mereka metadata. Nama pengarang, judul karya dan rujukan MESTI berdasarkan sumber.',
    '10b. Nama pengarang dan judul karya MESTI ditulis dalam TRANSLITERASI RUMI (huruf Latin standard), WALAUPUN sumber berskrip Arab/Cina/Cyrillic/lain. Contoh: "علاء الدين العطار" ditulis "Ala\' al-Din al-\'Attar", BUKAN skrip Arab asal. Ini BERBEZA daripada "Teks Asal" (peraturan 2), yang MESTI kekal dalam skrip/bahasa asal sumber tanpa transliterasi.',
    '11. Jika rujukan tepat (halaman/bab) tidak dapat dikenal pasti, tulis: Rujukan: -',
    `12. ${arahanPautan[0]}`,
    ...(arahanPautan[1] ? [`   ${arahanPautan[1]}`] : []),
    '13. JANGAN mereka URL. JANGAN menambah URL daripada pengetahuan anda sendiri, walaupun untuk mengisi medan yang kosong.',
    '14. Pilih petikan yang masih membawa maksud munasabah apabila dibaca secara tersendiri.',
    '15. Elakkan petikan yang memerlukan konteks panjang sehingga mudah disalahertikan.',
    '16. Utamakan kekuatan idea, bukan kata-kata motivasi generik.',
    `17. Panjang setiap petikan MESTI tidak melebihi ${HAD_TEKS_PETIKAN} aksara.`,
    `18. JANGAN memotong petikan semata-mata untuk memenuhi had ${HAD_TEKS_PETIKAN} aksara. Jika petikan bermakna tidak dapat dikekalkan secara verbatim dalam had itu, jangan pilih petikan tersebut.`,
    `19. Pilih maksimum ${maksimum} petikan terbaik daripada sumber.`,
    '20. Jangan hasilkan petikan yang sama lebih daripada sekali.',
    '21. Dalam medan "Teks Melayu" SAHAJA: istilah asing yang belum mantap atau tiada padanan',
    '    Bahasa Melayu yang tepat MESTI ditandakan dengan tanda condong menggunakan asterisk,',
    '    contohnya *framework*. Jangan condongkan singkatan teknikal antarabangsa (API, URL, PDF, AI)',
    '    atau istilah pinjaman yang sudah lazim dalam Bahasa Melayu (status, draf, slot, modul).',
    '    Contoh: "Sistem ini memerlukan *framework* yang sesuai." Peraturan ini TIDAK terpakai',
    '    pada "Teks Asal" — teks asal kekal tepat seperti sumber, tanpa sebarang tanda tambahan.',
    '',
    '[DUA KERJA BERASINGAN — JANGAN CAMPURKAN]',
    '',
    'Setiap rekod memerlukan DUA perkara yang dihasilkan melalui dua kerja yang BERBEZA.',
    '',
    'KERJA PERTAMA — PENGEKSTRAKAN (medan "Teks Asal")',
    'Salin kata-kata daripada sumber secara verbatim, dalam bahasa asalnya.',
    'JANGAN terjemah di sini.',
    'JANGAN perbetulkan.',
    'JANGAN pendekkan.',
    'Selesaikan kerja ini SEPENUHNYA sebelum memulakan kerja kedua.',
    '',
    'KERJA KEDUA — PENTERJEMAHAN (medan "Teks Melayu")',
    'Terjemahkan teks asal yang telah anda ekstrak tadi ke dalam Bahasa Melayu.',
    'Terjemahan MESTI setia kepada maksud teks asal.',
    'JANGAN mencantikkan, memoden atau menguatkan ayat melebihi apa yang sumber katakan.',
    'JANGAN menambah penjelasan yang tiada dalam teks asal.',
    'Gunakan Bahasa Melayu penerbitan yang natural, bukan terjemahan harfiah yang janggal.',
    '',
    'AMARAN PALING PENTING: JANGAN mengubah "Teks Asal" untuk memudahkan penterjemahan.',
    'Jika teks asal sukar diterjemah, teks asal TETAP KEKAL seperti dalam sumber.',
    '',
    'JIKA SUMBER MEMANG BERBAHASA MELAYU:',
    'Tulis: Bahasa Asal: Melayu',
    'Tulis: Teks Melayu: -',
    'Jangan menterjemah apa-apa. Jangan menulis semula petikan itu.',
    '',
    '[KATEGORI]',
    '',
    'Setiap petikan MESTI diberikan SATU kategori sahaja daripada senarai tertutup berikut:',
    '',
    KATEGORI_PETIKAN.join('\n'),
    '',
    'JANGAN mencipta kategori baharu. JANGAN mengubah ejaan. JANGAN menggabungkan dua kategori.',
    'Jika tiada yang benar-benar sesuai, gunakan: Kategori: Lain-lain',
    '',
    '[FORMAT OUTPUT — WAJIB]',
    '',
    'Gunakan susunan medan berikut dengan TEPAT untuk SETIAP petikan:',
    '',
    'Teks Asal:',
    '[[TEKS_ASAL]]',
    '',
    'Bahasa Asal: [[BAHASA_ASAL]]',
    '',
    'Teks Melayu:',
    '[[TEKS_MELAYU]]',
    '',
    'Pengarang: [[NAMA_PENGARANG]]',
    'Karya: [[TAJUK_KARYA]]',
    'Rujukan: [[RUJUKAN_SUMBER]]',
    'Kategori: [[KATEGORI]]',
    `Pautan Buku: ${pautanBuku || '[[PAUTAN_BUKU]]'}`,
    '',
    '____',
    '',
    '[PENTING — PENANDA FORMAT]',
    '',
    'Teks di antara [[...]] di atas hanyalah PENANDA FORMAT, bukan jawapan.',
    'JANGAN SALIN mana-mana penanda berikut ke dalam jawapan sebenar:',
    '',
    SENTINEL_PETIKAN.join('\n'),
    '',
    'Gantikan semuanya dengan data sebenar daripada sumber.',
    pautanBuku
      ? 'Gunakan tanda "-" HANYA untuk Rujukan, dan Teks Melayu (apabila sumber memang berbahasa Melayu). Pautan Buku SUDAH diberikan di atas — salin nilai itu, JANGAN tulis "-" untuknya.'
      : 'Gunakan tanda "-" HANYA untuk Rujukan, Pautan Buku, dan Teks Melayu (apabila sumber memang berbahasa Melayu).',
    'JANGAN gunakan "-" untuk Teks Asal, Bahasa Asal, Pengarang, Karya atau Kategori.',
    '',
    '[LARANGAN FORMAT]',
    '',
    'Medan Teks Asal dan Teks Melayu boleh mengandungi lebih daripada satu baris.',
    'JANGAN tambah nombor pada nama medan. SALAH: "Pengarang 1:". BETUL: "Pengarang:".',
    'JANGAN gunakan Markdown.',
    'JANGAN gunakan bullet atau senarai bernombor.',
    'JANGAN gunakan code fence (```).',
    'JANGAN gunakan tajuk atau subtajuk.',
    'JANGAN tambah penerangan, ulasan, skor atau sebab pemilihan.',
    'JANGAN tulis apa-apa sebelum petikan pertama atau selepas petikan terakhir.',
    'Mulakan SETIAP rekod dengan baris "Teks Asal:".',
    'Anda boleh memisahkan rekod dengan satu baris "____", tetapi itu tidak wajib.',
    '',
    '[SEMAKAN SENDIRI — sebelum memberikan jawapan akhir]',
    '',
    'Sahkan bahawa: setiap Teks Asal verbatim daripada sumber dan TIDAK diubah semasa menterjemah;',
    'setiap Teks Melayu setia kepada teks asalnya; tiada metadata direka; setiap Teks Melayu tidak',
    `melebihi ${HAD_TEKS_PETIKAN} aksara; setiap Kategori daripada senarai tertutup; tiada penanda`,
    '[[...]] tertinggal; semua medan wajib wujud; setiap rekod bermula dengan "Teks Asal:";',
    'setiap Pengarang dan Karya ditulis dalam RUMI (huruf Latin), BUKAN skrip asal sumber.',
    '',
    '[SUMBER]',
    '',
    'Gunakan HANYA fail, buku, kitab, PDF atau teks yang saya berikan bersama arahan ini.',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// PENGHURAI TAMPALAN
//
// Peraturan sempadan medan Teks (paling kritikal): selepas "Teks:", SEMUA baris berikutnya —
// TERMASUK baris kosong — ialah sebahagian Teks, sehingga penghurai menemui label sah pada
// PERMULAAN baris, atau pemisah ____.
//
// Baris kosong SENGAJA tidak dianggap pemisah apa-apa. Pengalaman sebenar: AI meletakkan baris
// kosong antara setiap medan apabila teks disalin daripada antara muka chat — kalau baris kosong
// dilayan sebagai pemisah, setiap rekod pecah berkecai.

const normalkanLabel = (baris) => {
  // Terima "PENGARANG :", "Pengarang:", "Pautan buku:" dan variasi ruang/huruf besar-kecil.
  // Nombor selepas label ("Pengarang 1:") dibuang HANYA jika bahagian asasnya sepadan TEPAT
  // dengan label sah — bukan padanan kabur yang boleh tersalah anggap teks biasa sebagai label.
  const m = baris.match(/^\s*([A-Za-zÀ-ɏ ]+?)\s*(\d+)?\s*:\s*(.*)$/);
  if (!m) return null;
  const asas = m[1].trim().toLowerCase().replace(/\s+/g, ' ');
  const padanan = LABEL_SAH.find((l) => l.toLowerCase() === asas) || ALIAS_LABEL[asas] || null;
  if (!padanan) return null;
  return { label: padanan, nilaiSebaris: (m[3] || '').trim() };
};

const buangCodeFence = (teks) => {
  const baris = (teks || '').split('\n');
  // Buang HANYA jika fence membungkus keseluruhan input — bukan setiap backtick di mana-mana,
  // kerana petikan karya sebenar boleh mengandungi backtick.
  if (baris.length >= 2 && /^\s*```/.test(baris[0]) && /^\s*```\s*$/.test(baris[baris.length - 1])) {
    return baris.slice(1, -1).join('\n');
  }
  return teks;
};

const nyahBungkusPautan = (nilai) => {
  const t = (nilai || '').trim();
  const md = t.match(/^\[[^\]]*\]\(([^)]+)\)$/);
  if (md) return md[1].trim();
  const sudut = t.match(/^<(.+)>$/);
  if (sudut) return sudut[1].trim();
  return t;
};

const adaSentinel = (nilai) =>
  SENTINEL_PETIKAN.some((s) => (nilai || '').includes(s));

const adaPlaceholder = (nilai) => {
  const t = (nilai || '').trim().toLowerCase();
  if (!t) return false;
  if (PLACEHOLDER_LITERAL.includes(t)) return true;
  // Nilai SATU-BARIS yang dibungkus SEPENUHNYA dalam kurungan — corak placeholder arahan.
  // Dihadkan kepada nilai tanpa baris baharu supaya petikan sebenar berbilang baris yang
  // kebetulan bermula '(' tidak tersalah tolak.
  if (!t.includes('\n') && /^\(.+\)$/.test(t)) return true;
  return false;
};

// Kunci dedup — normalisasi supaya beza ruang/huruf besar-kecil tidak lolos sebagai rekod berbeza.
export const kunciDedupPetikan = (r) =>
  [(r.teksAsal || ''), (r.pengarang || ''), (r.karya || '')]
    .map((s) => s.toLowerCase().replace(/\s+/g, ' ').trim())
    .join('|');

/**
 * Pecahkan teks tampalan kepada blok rekod.
 *
 * SEMPADAN REKOD TIDAK LAGI BERGANTUNG PADA PEMISAH "____" (2026-08-19, selepas simulasi sebenar
 * dengan ChatGPT). Sebabnya boleh dihasilkan semula: antara muka chatbot merender "____" sebagai
 * garis mendatar Markdown. Diperiksa pada DOM ChatGPT — 4 elemen <hr>, SIFAR aksara garis bawah.
 * Jadi editor yang menyalin dengan tetikus (cara paling biasa) kehilangan pemisah sepenuhnya, dan
 * lima petikan bercantum menjadi satu blok yang gagal dengan sebab yang mengelirukan.
 *
 * Sauh sebenar ialah label "Teks Asal:" — kemunculan KEDUA bermakna rekod baharu bermula. Pemisah
 * "____" masih diterima apabila ia terselamat, kerana ia isyarat yang bersih; ia cuma bukan lagi
 * SATU-SATUNYA isyarat.
 *
 * AMARAN: ini menukar pemisah rapuh dengan STRUKTUR yang juga rapuh — AI masih boleh menukar nama
 * label, mengulanginya, atau memasukkan "Teks Asal:" ke dalam kandungan petikan. Penghurai ni
 * MESTI dianggap penghurai input tidak dipercayai, bukan kontrak data. Jaring keselamatan sebenar
 * ialah kad boleh sunting yang editor lihat sebelum apa-apa disimpan.
 */
function pecahBlok(bersih) {
  const blokKasar = bersih.split(/^\s*_{4,}\s*$/m);
  const hasil = [];

  for (const kasar of blokKasar) {
    let semasa = [];
    let nampakSauh = false;

    for (const brs of kasar.split('\n')) {
      const lbl = normalkanLabel(brs);
      if (lbl && lbl.label === LABEL_SAUH) {
        // Sauh kedua dalam blok yang sama -> rekod sebelumnya tamat di sini.
        if (nampakSauh && semasa.some((x) => x.trim())) {
          hasil.push(semasa.join('\n'));
          semasa = [];
        }
        nampakSauh = true;
      }
      semasa.push(brs);
    }
    if (semasa.some((x) => x.trim())) hasil.push(semasa.join('\n'));
  }

  return hasil;
}

// Label metadata PENDEK yang selamat dikesan walau muncul di TENGAH baris — nilainya sentiasa
// satu potongan pendek (nama, tajuk, nombor halaman), tidak pernah teks bebas panjang.
// "Teks Asal"/"Teks Melayu" SENGAJA tidak disertakan di sini — nilainya teks bebas yang boleh
// mengandungi apa-apa, memisahkannya secara automatik akan mengubah kandungan petikan sebenar.
const LABEL_PENDEK_BOLEH_PISAH = /\b(Pengarang|Karya|Rujukan|Kategori|Pautan\s+Buku|Bahasa(?:\s+Asal)?)\s*:/gi;

/**
 * Pisahkan SATU baris yang menggabungkan berbilang medan metadata pendek menjadi beberapa baris.
 *
 * PUNCA (2026-08-19, laporan Izzat, 20/20 blok gagal): sesetengah chatbot (bukan hanya ChatGPT)
 * tidak patuh arahan "setiap medan pada baris berasingan" untuk metadata ringkas — ia hasilkan
 * "Pengarang: X Karya: Y Rujukan: Z Kategori: W Pautan Buku: -" SATU baris, dipisah ruang.
 * Penghurai sedia ada hanya kenal label pada PERMULAAN baris, jadi seluruh baris tertelan
 * sebagai nilai "Pengarang" sahaja — Karya/Rujukan/Kategori/Pautan Buku tidak pernah ditemui,
 * rekod ditolak "Karya kosong" walaupun datanya sebenarnya ADA, cuma di tempat yang salah.
 *
 * Hanya baris yang BERMULA dengan label metadata PENDEK (bukan Teks Asal/Teks Melayu) diproses —
 * baris sambungan Teks Asal/Teks Melayu (teks bebas panjang) tidak disentuh langsung, supaya
 * kandungan petikan sebenar tidak pernah dipisah/diubah secara automatik.
 */
function pisahkanBarisLabelBergabung(baris) {
  const label0 = normalkanLabel(baris);
  if (!label0 || label0.label === 'Teks Asal' || label0.label === 'Teks Melayu') return [baris];

  const kedudukan = [];
  let m;
  LABEL_PENDEK_BOLEH_PISAH.lastIndex = 0;
  while ((m = LABEL_PENDEK_BOLEH_PISAH.exec(baris))) kedudukan.push(m.index);
  if (kedudukan.length <= 1) return [baris];

  const bahagian = [];
  for (let i = 0; i < kedudukan.length; i++) {
    const mula = kedudukan[i];
    const tamat = i + 1 < kedudukan.length ? kedudukan[i + 1] : baris.length;
    const potongan = baris.slice(mula, tamat).trim();
    if (potongan) bahagian.push(potongan);
  }
  return bahagian.length ? bahagian : [baris];
}

/**
 * Hurai teks tampalan daripada chatbot menjadi rekod petikan.
 * Pulangkan { rekod, gagal } — kegagalan SEPARA dibenarkan (17 sah + 3 rosak = serap 17,
 * laporkan 3). Tiada blok "dibaiki" secara automatik: membetulkan teks petikan secara automatik
 * bermakna kita mengubah kata-kata pengarang, iaitu perkara yang seluruh ciri ni cuba elakkan.
 */
export function huraiPetikanTampal(teksMentah) {
  const bersihAsal = buangCodeFence((teksMentah || '').replace(/\r\n/g, '\n'));
  // Pisahkan baris metadata bergabung SEBELUM apa-apa lagi — lihat pisahkanBarisLabelBergabung().
  const bersih = bersihAsal.split('\n').flatMap(pisahkanBarisLabelBergabung).join('\n');
  const blok = pecahBlok(bersih);

  const rekod = [];
  const gagal = [];
  const dilihat = new Set();

  blok.forEach((b, idx) => {
    if (!b.trim()) return;
    const nomborBlok = idx + 1;
    const baris = b.split('\n');

    const medan = {};
    const pendua = [];
    let semasa = null;
    let labelPertama = null;

    for (const brs of baris) {
      const lbl = normalkanLabel(brs);
      if (lbl) {
        if (!labelPertama) labelPertama = lbl.label;
        if (Object.prototype.hasOwnProperty.call(medan, lbl.label)) {
          pendua.push(lbl.label);
        }
        medan[lbl.label] = lbl.nilaiSebaris;
        semasa = lbl.label;
      } else if (semasa) {
        // Baris sambungan — termasuk baris KOSONG bila medan semasa boleh berbilang baris.
        if (MEDAN_BERBILANG_BARIS.has(semasa)) {
          medan[semasa] = medan[semasa] ? `${medan[semasa]}\n${brs}` : brs;
        } else if (brs.trim()) {
          // Medan satu-baris: sambungan hanya diterima kalau nilai sebaris tadi kosong
          // (corak "Pengarang:" pada satu baris, nilainya pada baris seterusnya).
          medan[semasa] = medan[semasa] ? `${medan[semasa]} ${brs.trim()}` : brs.trim();
        }
      }
    }

    const tolak = (sebab) => gagal.push({ blok: nomborBlok, sebab, cuplikan: (medan['Teks Asal'] || b).trim().slice(0, 80) });

    if (pendua.length) return tolak(`Label berulang dalam blok: ${[...new Set(pendua)].join(', ')}.`);

    // Sauh MESTI medan pertama — ini yang menjadikan peraturan sempadan teks berbilang baris tidak
    // taksa. (Susunan medan LAIN sengaja tidak dipaksa: sebaik sauh di hadapan, susunan baki tidak
    // menjejaskan penghuraian, dan memaksanya cuma menambah kegagalan tanpa faedah keselamatan.)
    if (labelPertama !== LABEL_SAUH) return tolak(`Medan "${LABEL_SAUH}:" mesti medan PERTAMA dalam setiap blok.`);

    const teksAsal = (medan['Teks Asal'] || '').replace(/^\n+|\n+$/g, '').trim();
    const teksMelayuMentah = (medan['Teks Melayu'] || '').replace(/^\n+|\n+$/g, '').trim();
    const pengarang = (medan.Pengarang || '').trim();
    const karya = (medan.Karya || '').trim();
    const bahasaMentah = (medan['Bahasa Asal'] || '').trim();
    const rujukanMentah = (medan.Rujukan || '').trim();
    const kategoriMentah = (medan.Kategori || '').trim();
    const pautanMentah = nyahBungkusPautan(medan['Pautan Buku'] || '');

    const semuaNilai = [teksAsal, teksMelayuMentah, pengarang, karya, bahasaMentah, rujukanMentah, kategoriMentah, pautanMentah];
    if (semuaNilai.some(adaSentinel)) {
      return tolak('Penanda format [[...]] daripada Arahan AI tertinggal — AI menyalin templat, bukan mengisi data sebenar.');
    }
    if ([teksAsal, teksMelayuMentah, pengarang, karya].some(adaPlaceholder)) {
      return tolak('Nilai kelihatan seperti placeholder arahan, bukan data sebenar.');
    }

    if (!teksAsal) return tolak('Teks asal kosong.');
    if (!pengarang) return tolak('Pengarang kosong.');
    if (!karya) return tolak('Karya kosong.');
    if (!bahasaMentah) return tolak('Bahasa asal kosong.');

    // Teks paparan DITERBITKAN, bukan dipilih. Satu laluan kod untuk kedua-dua kes.
    const sumberMelayu = adalahBahasaMelayu(bahasaMentah);
    const teksMelayu = (teksMelayuMentah === '-' ? '' : teksMelayuMentah);
    if (!sumberMelayu && !teksMelayu) {
      return tolak(`Sumber berbahasa ${namaBahasa(bahasaMentah)} tetapi tiada "Teks Melayu:". Frontpage memaparkan Bahasa Melayu sahaja, jadi terjemahan wajib.`);
    }
    const teksPaparan = sumberMelayu ? teksAsal : teksMelayu;

    // Had aksara dikenakan pada TEKS PAPARAN — itu yang perlu muat dalam margin. Teks asal
    // sengaja TIDAK dihadkan: ia tidak pernah dipaparkan kepada pembaca, cuma disemak editor,
    // dan memangkasnya bermakna memangkas kata-kata pengarang.
    if (teksPaparan.length > HAD_TEKS_PETIKAN) {
      return tolak(`Teks paparan ${teksPaparan.length} aksara, melebihi had ${HAD_TEKS_PETIKAN}. Tidak dipotong automatik — pilih petikan lebih pendek.`);
    }

    // Kategori tidak sah TIDAK menggagalkan rekod (keputusan reka bentuk): petikannya mungkin
    // sempurna, cuma labelnya salah. Simpan NULL + amaran; ia tidak layak masuk kolam harian
    // sehingga editor membetulkannya, jadi tiada risiko ia tersiar dengan kategori salah.
    const kategori = KATEGORI_PETIKAN.find((k) => k.toLowerCase() === kategoriMentah.toLowerCase()) || null;

    // Setiap amaran bawa AKIBAT sendiri — kategori kosong betul-betul MENYEKAT penerbitan
    // (gerbang SQL awam menuntut kategori bukan NULL), tetapi skrip bukan Rumi TIDAK menyekat
    // apa-apa secara automatik. Jangan kongsi satu ayat akibat untuk kedua-duanya — itu akan
    // membuat amaran kosmetik kelihatan seolah-olah gerbang keras, atau sebaliknya.
    const amaranBahagian = [];
    if (!kategori) {
      amaranBahagian.push(kategoriMentah
        ? `Kategori "${kategoriMentah}" bukan nilai sah — perlu dibetulkan sebelum petikan boleh disiarkan.`
        : 'Kategori tiada — perlu diisi sebelum petikan boleh disiarkan.');
    }
    const medanBukanRumi = [];
    if (AKSARA_BUKAN_RUMI.test(pengarang)) medanBukanRumi.push('Pengarang');
    if (AKSARA_BUKAN_RUMI.test(karya)) medanBukanRumi.push('Karya');
    if (medanBukanRumi.length) {
      amaranBahagian.push(`${medanBukanRumi.join(' & ')} nampak masih dalam skrip asal, bukan Rumi — sahkan/transliterasikan sebelum simpan.`);
    }

    const calon = {
      teksAsal,
      bahasaAsal: namaBahasa(bahasaMentah),
      teksPaparan,
      pengarang, karya,
      rujukan: rujukanMentah === '-' ? '' : rujukanMentah,
      kategori,
      pautanBuku: pautanMentah === '-' ? '' : pautanMentah,
      amaran: amaranBahagian.length ? amaranBahagian.join(' ') : null,
    };

    const kunci = kunciDedupPetikan(calon);
    if (dilihat.has(kunci)) return tolak('Petikan berulang dalam tampalan ini.');
    dilihat.add(kunci);

    rekod.push(calon);
  });

  return { rekod, gagal };
}

// ---------------------------------------------------------------------------------------------
// KOLAM HARIAN

// Saiz berkadar dengan koleksi (2026-08-19) — kolam tetap pada `maksimum` walaupun koleksi kecil
// bermakna hampir seluruh pustaka terdedah setiap hari dan "kolam harian" hilang maknanya.
//
// `maksimum` kini BOLEH DILARAS Ketua Editor (2026-08-19, susulan arahan Izzat: "kuantiti
// petikan sehari boleh dilaraskan di tetapan... semua yg boleh dilaraskan letak di tetapan") —
// nilai DATA di `slot_am_settings.petikanKuantitiHarianMaksimum` (petikanRoutes.js), bukan
// pemalar kod. Lalai 12 KEKAL kalau tetapan belum wujud/tidak sah (pemanggil sentiasa hantar
// nombor sah — lalai di sini cuma pertahanan kedua).
export function saizKolamHarian(jumlahLayak, maksimum = 12) {
  const n = Math.max(0, Number(jumlahLayak) || 0);
  const m = Math.max(1, Number(maksimum) || 12);
  if (n === 0) return 0;
  if (n < 4) return Math.min(n, m);
  return Math.min(m, Math.max(Math.min(4, m), Math.ceil(n / 3)));
}

const benihDaripadaTarikh = (tarikhIso) => {
  let h = 2166136261;
  for (let i = 0; i < tarikhIso.length; i++) {
    h ^= tarikhIso.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const rawakBerbenih = (benih) => {
  let a = benih;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const kocokBerbenih = (senarai, rnd) => {
  const a = [...senarai];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Pilih DAN susun kolam harian secara deterministik.
 *
 * Dua peringkat:
 *   1. PILIH — pusingan kategori (round-robin) supaya kolam sendiri sudah pelbagai, bukan cuma
 *      susunannya. Memilih 8 rawak lalu menyusun membuang peluang terbaik memenuhi objektif.
 *   2. SUSUN — elak kategori berjiran.
 *
 * Hierarki kekangan (penting):
 *   KERAS       — petikan sama tidak berulang dalam satu pusingan.
 *   USAHA TERBAIK — kategori sama tidak berturut-turut.
 * Kalau komposisi kolam menjadikan kekangan kategori mustahil (cth koleksi berat sebelah, 6/8
 * kategori sama), kategori berjiran DIBENARKAN. Jangan sesekali mengulang petikan atau
 * menggugurkan rekod semata-mata untuk memalsukan kepelbagaian.
 *
 * kategori NULL = "belum diklasifikasi", BUKAN kategori bernama. Ia tidak pernah dikira sama
 * dengan NULL yang lain (dua NULL boleh berjiran), dan rekod berkategori diutamakan semasa
 * pemilihan supaya hutang data tidak tersembunyi.
 */
export function pilihDanSusunKolam(layak, tarikhIso, kuantitiMaksimum = 12) {
  const senarai = Array.isArray(layak) ? layak : [];
  const saiz = saizKolamHarian(senarai.length, kuantitiMaksimum);
  if (saiz === 0) return [];

  const rnd = rawakBerbenih(benihDaripadaTarikh(tarikhIso));

  const berkategori = kocokBerbenih(senarai.filter((p) => p.kategori), rnd);
  const tanpaKategori = kocokBerbenih(senarai.filter((p) => !p.kategori), rnd);

  // --- Peringkat 1: pilih, utamakan kepelbagaian kategori ---
  const ikutKategori = new Map();
  for (const p of berkategori) {
    if (!ikutKategori.has(p.kategori)) ikutKategori.set(p.kategori, []);
    ikutKategori.get(p.kategori).push(p);
  }
  const kunciKategoriTersusun = [...ikutKategori.keys()].sort();

  // Putarkan titik mula round-robin ikut tarikh — kalau tidak, kategori awal abjad
  // (cth Agama, Ekonomi) sentiasa dapat "slot bonus" round-robin setiap hari, manakala
  // kategori lewat abjad (cth Sains, Sejarah) sentiasa tercicir. Guna benih sedia ada
  // (benihDaripadaTarikh) supaya konsisten dgn corak "seeded ikut tarikh" fungsi lain
  // dalam fail ni — bukan cipta sistem tarikh berasingan. Deterministik: tarikh sama
  // sentiasa hasilkan susunan sama; tarikh lain berputar offset berbeza.
  const offsetPutaran = kunciKategoriTersusun.length
    ? benihDaripadaTarikh(tarikhIso) % kunciKategoriTersusun.length
    : 0;
  const kunciKategori = [
    ...kunciKategoriTersusun.slice(offsetPutaran),
    ...kunciKategoriTersusun.slice(0, offsetPutaran),
  ];

  const dipilih = [];
  let adaLagi = true;
  while (dipilih.length < saiz && adaLagi) {
    adaLagi = false;
    for (const k of kunciKategori) {
      const baldi = ikutKategori.get(k);
      if (baldi && baldi.length) {
        dipilih.push(baldi.shift());
        adaLagi = true;
        if (dipilih.length >= saiz) break;
      }
    }
  }
  // Isi baki dengan rekod tanpa kategori (fallback, bukan keutamaan).
  for (const p of tanpaKategori) {
    if (dipilih.length >= saiz) break;
    dipilih.push(p);
  }

  // --- Peringkat 2: susun, elak kategori berjiran (usaha terbaik) ---
  const baki = [...dipilih];
  const tersusun = [];
  while (baki.length) {
    if (!tersusun.length) {
      tersusun.push(baki.shift());
      continue;
    }
    const kategoriSebelum = tersusun[tersusun.length - 1].kategori;
    // NULL sentiasa layak — ia bukan kategori bernama, jadi tidak pernah "sama".
    let idx = baki.findIndex((p) => !p.kategori || p.kategori !== kategoriSebelum);
    if (idx === -1) idx = 0; // kekangan mustahil dipenuhi — benarkan berjiran, jangan ulang/gugur
    tersusun.push(baki.splice(idx, 1)[0]);
  }

  return tersusun;
}
