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
// LANTAI DIRAPATKAN SUPAYA KAD TIDAK BERJURANG (SEJARAH — era kad tajuk sahaja, lihat
// "HURAIAN DIKEMBALIKAN" di bawah untuk nombor semasa. Nombor 224/173/179 dalam seksyen ni sudah
// digantikan; kekal di sini sebagai rekod sebab lantai era tajuk-sahaja dipilih macam itu.)
//
// Kad telefon dahulu kad tajuk sahaja, tetapi nombor rekaan (240/224/150) dan nisbah berpasangan
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
// ---------------------------------------------------------------------------------------------
// HURAIAN DIKEMBALIKAN (2026-07-31, permintaan pemilik projek)
//
// Nombor PHONE_CARD_MIN di bawah pada asalnya diukur untuk kad TAJUK SAHAJA — huraian
// disembunyikan (`display:none`) kerana bimbang tak muat. Pemilik projek kemudian minta huraian
// dikembalikan.
//
// PENTING — `min-height` ialah LANTAI selesa, BUKAN tinggi kes-terburuk dipaksa. `height: auto`
// (lihat phoneLayoutCss()) bermakna kad SENTIASA tumbuh mengikut kandungan sebenar — tiada siling,
// tiada potongan, jadi tiada keperluan "menjamin" ruang kes terburuk melalui min-height. Percubaan
// pertama (2026-07-31) tersilap guna nombor kes TERBURUK (335-385px) sebagai min-height — kesannya
// SETIAP kad, walau kandungan pendek/tiada huraian, dipaksa setinggi itu, meninggalkan ruang kosong
// besar tanpa sebab (disahkan hidup: slot 4 tanpa huraian tetap 170px tepat). Dibetulkan sama hari:
// lantai kini diukur daripada kandungan MINIMUM (tajuk pendek, tiada huraian) supaya kad pendek
// kekal pendek, kad panjang tumbuh bebas mengikut keperluan sebenarnya (diukur sehingga ~335-385px
// pada kes terburuk sebenar — nombor itu bukan lagi ditaip di sini, cuma pengesahan yang kad boleh
// tumbuh sebegitu tanpa limpahan, sebab tiada siling langsung).
export const PHONE_CARD_MIN = {
  '--card-min-melintang-penuh': '160px',      // HERO
  '--card-min-menegak': '170px',              // MENEGAK
  '--card-min-melintang': '135px',            // STANDARD
  '--card-min-bar': '84px',                   // BAR (BarCard sudah ada min-h-[84px]) — tiada huraian, tak berubah
  '--card-min-kiub-besar': '140px',           // KIUB BESAR
  '--card-min-kiub-kecil': '175px',           // KIUB KECIL
  '--card-min-kompak': '105px',               // KOMPAK
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

// Huraian ikut prinsip lebar-kolum yang sama seperti tajuk di atas — dua lebar, dua saiz. Satu
// tangga di bawah tajuknya (18→14, 14→12) supaya hierarki tajuk/huraian kekal jelas pada kedua-dua
// lebar. Diukur bersama lantai PHONE_CARD_MIN di atas — lihat nota "HURAIAN DIKEMBALIKAN".
export const PHONE_BRIEF = {
  penuh: '14px',
  pasangan: '12px',
  leading: '1.5',
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
    const saizTajuk = box.pasangan ? PHONE_TITLE.pasangan : PHONE_TITLE.penuh;
    const tajukSelector = slots.map((n) => `  #bento-news-grid [data-slot="${n}"] h3`).join(',\n');
    const tajukRule = `${tajukSelector} {\n    font-size: ${saizTajuk};\n    line-height: ${PHONE_TITLE.leading};\n  }`;
    // !important WAJIB di sini: getCardTheme().briefStyle (FrontpageView.tsx) menetapkan
    // fontSize:'14px' terus sebagai gaya INLINE pada setiap <p> huraian (untuk desktop) — gaya
    // inline sentiasa menewaskan mana-mana peraturan luar tanpa !important, tak kira spesifikasi.
    // Sama sebab seperti nota [data-carousel-stable] di bawah.
    const saizHuraian = box.pasangan ? PHONE_BRIEF.pasangan : PHONE_BRIEF.penuh;
    const huraianSelector = slots.map((n) => `  #bento-news-grid [data-slot="${n}"] p`).join(',\n');
    const huraianRule = `${huraianSelector} {\n    font-size: ${saizHuraian} !important;\n    line-height: ${PHONE_BRIEF.leading};\n  }`;
    return `  /* ${tier} — ${box.pasangan ? 'berpasangan dua kolum' : 'penuh lebar'}${nota} */\n${selector} {\n${decls}\n  }\n\n${tajukRule}\n\n${huraianRule}`;
  }).filter(Boolean).join('\n\n');

  return `@media (max-width: ${PHONE_MAX_WIDTH_PX}px) {
  #bento-news-grid {
${vars}
  }

  /* CarouselStableBlock mengunci min-height pada tinggi item TERTINGGI yang pernah diukur PADA
     LEBAR DESKTOP, dan nilai itu tidak pernah mengecil semula. Kalau halaman dibuka pada lebar
     desktop dahulu kemudian dikecilkan ke telefon, kunci desktop (diukur pada kad yang jauh lebih
     lebar, jadi teks melilit lebih sedikit) akan terbawa ke sini dan jadi TERLALU RENDAH untuk
     lilitan baris telefon yang lebih sempit — punca berbeza daripada lantai PHONE_CARD_MIN di
     atas (yang diukur khusus untuk lebar telefon), tapi kesan sama: kotak tier pecah. Ia gaya
     inline, jadi !important wajib di sini — sama sebab seperti peraturan huraian di atas. */
  #bento-news-grid [data-carousel-stable] {
    min-height: 0 !important;
  }

  /* BAR (2026-07-31, permintaan pemilik projek). Pada desktop, BAR ialah tier PALING KECIL —
     satu lajur sempit (1/3 lebar, md:col-span-2 drpd 6) ditindan menegak, hierarki paling rendah.
     Tanpa peraturan ni, BAR jatuh balik kepada lebar PENUH pada telefon (sama seperti kad lain) —
     bercanggah dengan identiti "paling kecil" tu. 2 lajur padan hierarki desktop dengan lebih
     dekat, dan BarCard sendiri sudah reka untuk teks terpotong/2-baris (truncate/line-clamp),
     bukan tumbuh bebas macam h3/p tier lain — jadi lajur sempit selamat di sini (tak sama risiko
     dengan cuba letak MENEGAK/HERO dalam lajur sempit). */
  #bento-news-grid [data-bar-cluster] {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

${tierRules}
}`;
};
