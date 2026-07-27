// Susun atur telefon (≤767px) bagi grid bento — satu sumber tunggal, sama peranannya seperti
// GeometryConfig.js bagi had aksara.
//
// Rekaan asal: "Frontpage Telefon" (Claude Design). Kluster desktop dikekalkan blok demi blok
// dan ditindan di dalam blok — susunan DOM frontpage sudah pun sama dengan susunan telefon yang
// dikehendaki, jadi tiada kad disusun semula. Yang berubah cuma KOTAK setiap kad.
//
// Peraturan direkod di sini MENGIKUT TIER, bukan mengikut slot, dan senarai slot bagi setiap tier
// dibaca terus daripada TIER_SLOTS. Jadi kalau satu slot bertukar tier di GeometryConfig.js,
// kotak telefonnya ikut sama secara automatik — tiada slot boleh tertinggal (Falsafah teras #2).
//
// Had aksara (GEOMETRY_RATIOS), padding tier dan radius TIDAK diubah untuk telefon. Cuma
// --card-min-* ditetapkan semula, kerana lebar kolum telefon (≈150–179px berpasangan, ≈358px
// penuh) jauh lebih sempit daripada desktop.

import { TIER_SLOTS } from './GeometryConfig.js';

/** Lebar maksimum yang dikira "telefon". Sepadan dengan breakpoint `md` Tailwind (768px), jadi
 *  peraturan di sini bermula tepat di tempat semua kelas `md:*` dalam FrontpageView berhenti. */
export const PHONE_MAX_WIDTH_PX = 767;

// NISBAH IALAH LANTAI, BUKAN SILING.
//
// Fail rekaan menetapkan tier berpasangan guna `aspect-ratio` tetap (Kiub Besar 3:4, Kompak 1:1,
// Kiub Kecil 2:1), dengan dakwaan itulah "nisbah paling rapat yang masih memuatkan tajuk dan garis
// Sumber". Diukur pada kandungan sebenar, dakwaan itu tidak benar — tajuk contoh dalam fail rekaan
// jauh lebih pendek daripada siling aksara tier yang sebenar:
//
//   Kiub Besar (siling 94 aksara)  kotak 3:4 = 231px, tinggi sebenar 291–293px pada 46–59 aksara
//   Kiub Kecil (siling 62 aksara)  kotak 2:1 = 179px, tinggi sebenar sehingga 183px pada 69 aksara
//   Kompak     (siling 80 aksara)  kotak 1:1 = 173px, muat setakat ini, tetapi tiada baki di siling
//
// Puncanya: pada kolum telefon berpasangan (173px) dengan padding tier 24px, lebar teks yang
// tinggal hanya 125px. `aspect-ratio` tetap akan memotong tajuk — dan memotong teks editorial
// ialah perkara yang dilarang keras oleh Falsafah teras #1.
//
// Jadi nisbah rekaan disimpan sebagai TINGGI MINIMUM, bukan tinggi tetap: kad mengambil bentuk yang
// direka apabila tajuk pendek, dan memanjang apabila tajuk panjang memerlukannya. Tiada limpahan
// boleh berlaku, tiada teks dipotong, dan sepasang kad kekal sama tinggi kerana kedua-duanya item
// grid yang meregang. Ini juga selaras dengan cara rekaan itu sendiri menyatakan tier lain — HERO,
// MENEGAK dan STANDARD semuanya min-height px tetap, bukan nisbah.
//
// LANTAI DIRAPATKAN SUPAYA KAD TIDAK BERJURANG
//
// Kad telefon ialah kad tajuk sahaja, tetapi nombor rekaan (240/224/150) dan nisbah berpasangan
// dipilih untuk kad yang MEMBAWA huraian. Tanpa huraian, lantai itu jadi terlalu murah hati dan
// meninggalkan jalur kosong antara tajuk dan garis Sumber.
//
// Diukur pada 390px, tiga lantai sahaja yang benar-benar mengikat — kad dipaku tepat pada nilai
// lantai sementara jurang dalamannya berbeza-beza, tanda pasti kotak itu dipaksa:
//
//   MENEGAK     ke-6-enam kad tepat 224px, jurang 34–75px
//   KOMPAK      ke-6-enam kad tepat 173px, jurang 42–75px
//   KIUB KECIL  6 daripada 7 kad tepat 179px, jurang 29–51px
//
// Tiga lantai itu dirapatkan ke tinggi semula jadi kandungan (diukur dengan lantai dilucutkan).
// Tiga yang lain dibiarkan: lantainya memang tidak mengikat, tingginya sudah ditentukan kandungan,
// dan jurangnya sihat (HERO 24px, MELINTANG 16–41px, KIUB BESAR ditentukan tajuk 4–6 baris).
//
// MENEGAK turun ke nilai yang SAMA dengan MELINTANG dengan sengaja: pada telefon kedua-duanya kad
// penuh lebar bertajuk sahaja dengan peranan yang serupa sepenuhnya. "Menegak" ialah bentuk grid
// 6-kolum desktop — bentuk itu tidak wujud pada telefon, jadi tingginya tidak patut diwarisi.
const PENUH_LEBAR = '150px';

/** Tinggi minimum telefon bagi setiap tier, sebagai pemboleh ubah CSS pada akar grid. */
export const PHONE_CARD_MIN = {
  '--card-min-melintang-penuh': '240px',      // HERO — lantai hampir tidak mengikat (semula jadi 242)
  '--card-min-menegak': PENUH_LEBAR,          // MENEGAK — dahulu 224px
  '--card-min-melintang': PENUH_LEBAR,        // STANDARD — tidak berubah
  '--card-min-bar': '84px',                   // BAR (BarCard sudah ada min-h-[84px])
  '--card-min-kiub-besar': '231px',           // KIUB BESAR — bentuk 3:4; tidak mengikat (semula jadi 280–291)
  '--card-min-kiub-kecil': '145px',           // KIUB KECIL — dahulu 179px (2:1); semula jadi 139–183
  '--card-min-kompak': '135px',               // KOMPAK — dahulu 173px (1:1); semula jadi 130–142
};

// Kotak setiap tier pada telefon.
//
//   pasangan: true  → dua kad tier ini berkongsi satu baris dua kolum (≈158–173px sekolum)
//   pasangan: false → satu kad penuh lebar (≈358px)
//
// `nisbah` direkod untuk mendokumentasikan niat rekaan sahaja — yang benar-benar dipancarkan ke
// CSS ialah `minHeight`.
// SAIZ TAJUK IKUT LEBAR KOLUM, BUKAN TIER
//
// Pada desktop, tajuk turun mengikut tangga tier: 24 / 20 / 18 / 16 / 12px. Tangga itu masuk akal
// di sana kerana kad memang bersaiz fizikal berbeza dalam grid 6 kolum. Pada telefon perbezaan itu
// lenyap — keenam-enam tier cuma ada DUA lebar sebenar:
//
//     penuh lebar   358px kad, 308px teks   (HERO, MENEGAK, STANDARD, KIUB KECIL)
//     berpasangan   173px kad, 123–139px teks   (KOMPAK, KIUB BESAR)
//
// Jadi tangga lima saiz itu tidak lagi merujuk apa-apa yang fizikal; ia jadi hiasan. Saiz kini ikut
// lebar kolum, dan dua lebar bermakna dua saiz.
//
// Ini juga membetulkan dua kecacatan tipografi sebenar yang diukur pada 390px:
//
//   KIUB BESAR  tajuk 18px dalam kolum 123px = 14 aksara sebaris. Perkataan pecah setiap baris dan
//               tajuk jadi longgokan 4–6 baris. Itulah punca sebenar kad ini setinggi 291px —
//               bukan nisbah 3:4 rekaan. Pada 14px ia jadi 18 aksara sebaris dan kad jatuh tepat
//               ke 231px, iaitu nisbah 3:4 rekaan asal.
//   KOMPAK      tajuk 12px terlalu halus untuk dibaca pada telefon. Naik ke 14px.
//
// Berita utama (HERO) TIDAK dikecualikan: pemilik projek memilih supaya kesemua kad penuh lebar
// sama saiz. Ia dahulu 24px.
export const PHONE_TITLE = {
  penuh: '18px',
  pasangan: '14px',
  leading: '1.375',
};

// Nilai px ditulis TERUS ke dalam peraturan tier, bukan melalui `var(--card-min-*)`. Kedua-duanya
// berfungsi; nombor langsung dipilih kerana nilai itu memang sudah pemalar JS di atas, jadi
// melencongkannya melalui pemboleh ubah CSS cuma menambah satu lapisan yang boleh gagal senyap
// (var() yang tidak sepadan menjadikan min-height `auto`, iaitu 0px, tanpa sebarang amaran).
// Pemboleh ubah itu masih diisytiharkan pada akar grid supaya nilainya boleh dilihat dan dicuba
// ubah dalam devtools.
export const PHONE_TIER_BOX = {
  HERO: { pasangan: false, minHeight: PHONE_CARD_MIN['--card-min-melintang-penuh'] },
  MENEGAK: { pasangan: false, minHeight: PHONE_CARD_MIN['--card-min-menegak'] },
  STANDARD: { pasangan: false, minHeight: PHONE_CARD_MIN['--card-min-melintang'] },
  SEGI_EMPAT_SMALL: { pasangan: false, nisbah: '2 / 1', minHeight: PHONE_CARD_MIN['--card-min-kiub-kecil'] },
  SEGI_EMPAT_MEDIUM: { pasangan: true, nisbah: '3 / 4', minHeight: PHONE_CARD_MIN['--card-min-kiub-besar'] },
  KOMPAK: { pasangan: true, nisbah: '1 / 1', minHeight: PHONE_CARD_MIN['--card-min-kompak'] },
  // BAR tiada entri: BarCard sudah pun penuh lebar, bertindan, dengan min-h-[84px] yang sama
  // dengan --card-min-bar. Tiada apa-apa untuk ditindih.
};

/**
 * Bina blok CSS telefon bagi grid bento. Dipanggil sekali oleh FrontpageView dan disuntik dalam
 * satu elemen <style>; tiada nombor di sini ditaip semula di tempat lain.
 *
 * Pemilih guna `#bento-news-grid [data-slot="N"]`, jadi ia lebih khusus (1,1,0) daripada kelas
 * utiliti Tailwind (0,1,0) yang hendak ditindih (`min-h-[380px]`, `h-full`) — tanpa `!important`.
 */
export const phoneLayoutCss = () => {
  const vars = Object.entries(PHONE_CARD_MIN).map(([k, v]) => `    ${k}: ${v};`).join('\n');

  const tierRules = Object.entries(PHONE_TIER_BOX).map(([tier, box]) => {
    const slots = TIER_SLOTS[tier] || [];
    if (slots.length === 0) return '';
    const selector = slots.map((n) => `  #bento-news-grid [data-slot="${n}"]`).join(',\n');
    // `height: auto` melucutkan `h-full` desktop; min-height tier kemudian menjadi lantai sebenar.
    // Sengaja TIADA aspect-ratio dipancarkan — lihat nota "NISBAH IALAH LANTAI" di atas.
    const decls = [
      '    height: auto;',
      `    min-height: ${box.minHeight};`,
    ].join('\n');
    const nota = box.nisbah ? ` (bentuk direka ${box.nisbah}, sebagai lantai)` : '';
    // Saiz tajuk ikut lebar kolum, diperoleh terus daripada `pasangan` — jadi ia tidak boleh
    // tersasar daripada susun atur yang sebenarnya digunakan tier itu.
    const saiz = box.pasangan ? PHONE_TITLE.pasangan : PHONE_TITLE.penuh;
    const tajukSelector = slots.map((n) => `  #bento-news-grid [data-slot="${n}"] h3`).join(',\n');
    const tajukRule = `${tajukSelector} {\n    font-size: ${saiz};\n    line-height: ${PHONE_TITLE.leading};\n  }`;
    return `  /* ${tier} — ${box.pasangan ? 'berpasangan dua kolum' : 'penuh lebar'}${nota} */\n${selector} {\n${decls}\n  }\n\n${tajukRule}`;
  }).filter(Boolean).join('\n\n');

  return `@media (max-width: ${PHONE_MAX_WIDTH_PX}px) {
  #bento-news-grid {
${vars}
  }

  /* Kad telefon ialah kad TAJUK SAHAJA. Huraian disembunyikan, bukan dipotong — teks editorial
     sebenar kekal utuh dalam pangkalan data dan dipapar penuh dalam Focus View telefon.
     Satu-satunya <p> di dalam kad bento ialah huraian; Bidang ialah <div>, Sumber <a>,
     tarikh siaran <span>. */
  #bento-news-grid [data-slot] p {
    display: none;
  }

  /* CarouselStableBlock mengunci min-height pada tinggi item TERTINGGI yang pernah diukur, dan
     nilai itu tidak pernah mengecil semula. Kalau halaman dibuka pada lebar desktop dahulu
     kemudian dikecilkan ke telefon, kunci desktop (dengan huraian) akan terbawa ke sini dan
     memecahkan kotak tier. Pada telefon kandungan kad ialah tajuk sahaja, jadi kunci itu memang
     tidak diperlukan. Ia gaya inline, jadi ini satu-satunya tempat !important benar-benar perlu. */
  #bento-news-grid [data-carousel-stable] {
    min-height: 0 !important;
  }

${tierRules}
}`;
};
