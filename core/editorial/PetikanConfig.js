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

// Label medan yang penghurai kenali. Apa-apa di luar senarai ni bukan label — ia teks biasa.
const LABEL_SAH = ['Teks', 'Pengarang', 'Karya', 'Rujukan', 'Bahasa', 'Kategori', 'Pautan Buku'];

// Sentinel penanda format dalam Arahan AI. Kemunculan mana-mana daripadanya dalam output bermakna
// AI menyalin templat dan bukan mengisi data sebenar -> blok DITOLAK.
//
// Ini pertahanan TERUS terhadap pepijat sebenar yang pernah sampai ke laman awam: teks contoh
// "(nama sebenar sumber anda)" dan "YYYY-MM-DD" daripada prompt modul Tulis Kandungan tersalin
// verbatim masuk ke pangkalan data lalu tersiar kepada pembaca (2026-08-19, ditangkap Izzat).
// Sentinel bentuk [[...]] dipilih sebab ia MUSTAHIL wujud dalam petikan karya sebenar — berbeza
// daripada meneka perkataan biasa seperti "petikan" yang akan menolak teks sah.
export const SENTINEL_PETIKAN = [
  '[[TEKS_PETIKAN]]', '[[NAMA_PENGARANG]]', '[[TAJUK_KARYA]]',
  '[[RUJUKAN_SUMBER]]', '[[BAHASA]]', '[[KATEGORI]]', '[[PAUTAN_BUKU]]',
];

// Placeholder LITERAL yang pernah/berpotensi muncul. Sengaja senarai TEPAT, bukan padanan kabur —
// menolak apa-apa yang mengandungi perkataan "petikan" akan menolak petikan sah tentang petikan.
const PLACEHOLDER_LITERAL = [
  '(nama pengarang)', '(tajuk karya)', '(petikan sebenar)', '(nama sebenar sumber anda)',
  'tampal petikan', 'lorem ipsum', 'yyyy-mm-dd',
];

export const HAD_TEKS_PETIKAN = 400;

// ---------------------------------------------------------------------------------------------
// ARAHAN AI — teks yang editor salin ke chatbot luar bersama PDF/buku.
//
// Nada sengaja TEGAS dan berulang pada perkara yang paling kerap dilanggar. Pengalaman sebenar
// projek ni: arahan lembut diabaikan, dan "jangan guna Markdown" sahaja tidak menghalang AI
// membungkus URL dalam Markdown. Jadi setiap larangan penting dinyatakan sebagai baris sendiri.
export function binaArahanAiPetikan({ maksimum = 20 } = {}) {
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
    '2. Medan "Teks" MESTI mengandungi kata-kata yang benar-benar terdapat dalam sumber secara VERBATIM.',
    '3. JANGAN parafrasa petikan.',
    '4. JANGAN memperkemas bahasa petikan.',
    '5. JANGAN membetulkan tatabahasa atau ejaan pengarang.',
    '6. JANGAN meringkaskan petikan.',
    '7. JANGAN menggabungkan ayat daripada lokasi berlainan untuk membentuk satu petikan baharu.',
    '8. JANGAN mencipta petikan berdasarkan idea atau maksud pengarang.',
    '9. JANGAN menggunakan petikan daripada ingatan anda jika ia tidak dapat dikenal pasti dalam sumber yang diberikan.',
    '10. JANGAN mereka metadata. Nama pengarang, judul karya dan rujukan MESTI berdasarkan sumber.',
    '11. Jika rujukan tepat (halaman/bab) tidak dapat dikenal pasti, tulis: Rujukan: -',
    '12. Jika pautan buku tidak diketahui, tulis: Pautan Buku: -',
    '13. JANGAN mereka URL. JANGAN menambah URL daripada pengetahuan anda sendiri.',
    '14. Pilih petikan yang masih membawa maksud munasabah apabila dibaca secara tersendiri.',
    '15. Elakkan petikan yang memerlukan konteks panjang sehingga mudah disalahertikan.',
    '16. Utamakan kekuatan idea, bukan kata-kata motivasi generik.',
    `17. Panjang setiap petikan MESTI tidak melebihi ${HAD_TEKS_PETIKAN} aksara.`,
    `18. JANGAN memotong petikan semata-mata untuk memenuhi had ${HAD_TEKS_PETIKAN} aksara. Jika petikan bermakna tidak dapat dikekalkan secara verbatim dalam had itu, jangan pilih petikan tersebut.`,
    `19. Pilih maksimum ${maksimum} petikan terbaik daripada sumber.`,
    '20. Jangan hasilkan petikan yang sama lebih daripada sekali.',
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
    'Teks:',
    '[[TEKS_PETIKAN]]',
    '',
    'Pengarang: [[NAMA_PENGARANG]]',
    'Karya: [[TAJUK_KARYA]]',
    'Rujukan: [[RUJUKAN_SUMBER]]',
    'Bahasa: [[BAHASA]]',
    'Kategori: [[KATEGORI]]',
    'Pautan Buku: [[PAUTAN_BUKU]]',
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
    'Gunakan tanda "-" HANYA untuk Rujukan dan Pautan Buku apabila maklumat tidak tersedia.',
    'JANGAN gunakan "-" untuk Teks, Pengarang, Karya, Bahasa atau Kategori.',
    '',
    '[LARANGAN FORMAT]',
    '',
    'Medan Teks boleh mengandungi lebih daripada satu baris jika teks asal memerlukannya.',
    'JANGAN tambah nombor pada nama medan. SALAH: "Pengarang 1:". BETUL: "Pengarang:".',
    'JANGAN gunakan Markdown.',
    'JANGAN gunakan bullet atau senarai bernombor.',
    'JANGAN gunakan code fence (```).',
    'JANGAN gunakan tajuk atau subtajuk.',
    'JANGAN tambah penerangan, ulasan, skor atau sebab pemilihan.',
    'JANGAN tulis apa-apa sebelum petikan pertama atau selepas petikan terakhir.',
    'Pisahkan SETIAP rekod dengan SATU baris yang hanya mengandungi: ____',
    '',
    '[SEMAKAN SENDIRI — sebelum memberikan jawapan akhir]',
    '',
    'Sahkan bahawa: setiap Teks verbatim daripada sumber; tiada metadata direka; setiap petikan',
    `tidak melebihi ${HAD_TEKS_PETIKAN} aksara; setiap Kategori daripada senarai tertutup; tiada`,
    'penanda [[...]] tertinggal; semua medan wajib wujud; setiap rekod dipisahkan dengan ____.',
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
  const padanan = LABEL_SAH.find((l) => l.toLowerCase() === asas);
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
  [(r.teks || ''), (r.pengarang || ''), (r.karya || '')]
    .map((s) => s.toLowerCase().replace(/\s+/g, ' ').trim())
    .join('|');

/**
 * Hurai teks tampalan daripada chatbot menjadi rekod petikan.
 * Pulangkan { rekod, gagal } — kegagalan SEPARA dibenarkan (17 sah + 3 rosak = serap 17,
 * laporkan 3). Tiada blok "dibaiki" secara automatik: membetulkan teks petikan secara automatik
 * bermakna kita mengubah kata-kata pengarang, iaitu perkara yang seluruh ciri ni cuba elakkan.
 */
export function huraiPetikanTampal(teksMentah) {
  const bersih = buangCodeFence((teksMentah || '').replace(/\r\n/g, '\n'));
  // Pemisah rekod TUNGGAL: baris yang selepas dipangkas ialah tepat empat garis bawah atau lebih.
  const blok = bersih.split(/^\s*_{4,}\s*$/m);

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
        // Baris sambungan — termasuk baris KOSONG bila medan semasa ialah Teks.
        if (semasa === 'Teks') {
          medan[semasa] = medan[semasa] ? `${medan[semasa]}\n${brs}` : brs;
        } else if (brs.trim()) {
          // Medan satu-baris: sambungan hanya diterima kalau nilai sebaris tadi kosong
          // (corak "Pengarang:" pada satu baris, nilainya pada baris seterusnya).
          medan[semasa] = medan[semasa] ? `${medan[semasa]} ${brs.trim()}` : brs.trim();
        }
      }
    }

    const tolak = (sebab) => gagal.push({ blok: nomborBlok, sebab, cuplikan: (medan.Teks || b).trim().slice(0, 80) });

    if (pendua.length) return tolak(`Label berulang dalam blok: ${[...new Set(pendua)].join(', ')}.`);

    // Teks MESTI medan pertama — ini yang menjadikan peraturan sempadan Teks tidak taksa.
    // (Susunan medan LAIN sengaja tidak dipaksa: sebaik Teks di hadapan, susunan baki tidak
    // menjejaskan penghuraian, dan memaksanya cuma menambah kegagalan tanpa faedah keselamatan.)
    if (labelPertama !== 'Teks') return tolak('Medan "Teks:" mesti medan PERTAMA dalam setiap blok.');

    const teks = (medan.Teks || '').replace(/^\n+|\n+$/g, '').trim();
    const pengarang = (medan.Pengarang || '').trim();
    const karya = (medan.Karya || '').trim();
    const bahasa = (medan.Bahasa || '').trim();
    const rujukanMentah = (medan.Rujukan || '').trim();
    const kategoriMentah = (medan.Kategori || '').trim();
    const pautanMentah = nyahBungkusPautan(medan['Pautan Buku'] || '');

    const semuaNilai = [teks, pengarang, karya, bahasa, rujukanMentah, kategoriMentah, pautanMentah];
    if (semuaNilai.some(adaSentinel)) {
      return tolak('Penanda format [[...]] daripada Arahan AI tertinggal — AI menyalin templat, bukan mengisi data sebenar.');
    }
    if ([teks, pengarang, karya].some(adaPlaceholder)) {
      return tolak('Nilai kelihatan seperti placeholder arahan, bukan data sebenar.');
    }

    if (!teks) return tolak('Teks petikan kosong.');
    if (!pengarang) return tolak('Pengarang kosong.');
    if (!karya) return tolak('Karya kosong.');
    if (!bahasa) return tolak('Bahasa kosong.');
    if (teks.length > HAD_TEKS_PETIKAN) {
      return tolak(`Teks petikan ${teks.length} aksara, melebihi had ${HAD_TEKS_PETIKAN}. Tidak dipotong automatik — pilih petikan lebih pendek.`);
    }

    // Kategori tidak sah TIDAK menggagalkan rekod (keputusan reka bentuk): petikannya mungkin
    // sempurna, cuma labelnya salah. Simpan NULL + amaran; ia tidak layak masuk kolam harian
    // sehingga editor membetulkannya, jadi tiada risiko ia tersiar dengan kategori salah.
    const kategori = KATEGORI_PETIKAN.find((k) => k.toLowerCase() === kategoriMentah.toLowerCase()) || null;

    const calon = {
      teks, pengarang, karya, bahasa,
      rujukan: rujukanMentah === '-' ? '' : rujukanMentah,
      kategori,
      pautanBuku: pautanMentah === '-' ? '' : pautanMentah,
      amaran: kategori ? null : (kategoriMentah ? `Kategori "${kategoriMentah}" bukan nilai sah — perlu dibetulkan sebelum petikan boleh disiarkan.` : 'Kategori tiada — perlu diisi sebelum petikan boleh disiarkan.'),
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

// Saiz berkadar dengan koleksi (2026-08-19) — kolam tetap 12 pada koleksi 15 bermakna hampir
// seluruh pustaka terdedah setiap hari dan "kolam harian" hilang maknanya.
export function saizKolamHarian(jumlahLayak) {
  const n = Math.max(0, Number(jumlahLayak) || 0);
  if (n === 0) return 0;
  if (n < 4) return n;
  return Math.min(12, Math.max(4, Math.ceil(n / 3)));
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
export function pilihDanSusunKolam(layak, tarikhIso) {
  const senarai = Array.isArray(layak) ? layak : [];
  const saiz = saizKolamHarian(senarai.length);
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
  const kunciKategori = [...ikutKategori.keys()].sort();

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
