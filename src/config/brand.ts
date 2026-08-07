export const BRAND = {
  name: "Adjung Brief",
  shortName: "Adjung",
  logoText: "Adjung",
  subLabel: "BRIEF",
  tagline: "Membina Semula Peradaban",
  description: "A long-term knowledge publishing ecosystem centered on intellectual quality, editorial integrity, and long-term preservation.",
  logo: "Adjung",
  version: "1.1.0",
  // Copyright is held by the parent company, not this product — Adjung Brief is one product
  // under Adjung Press, distinct from the portal/product name above.
  copyright: "© 2026 Adjung Press"
};

// Skala saiz wordmark "Adjung" (2026-08-07, permintaan Izzat — "takde sistem ke yg tentukan
// bagaimana saiz logo ditetapkan?"). Sebelum ni TIADA — setiap skrin taip kelas Tailwind sendiri
// (2xl/3xl/4xl/5xl/6xl/7xl bercampur ikut fail), jadi skrin pagar Editorium (mesej "log masuk
// diperlukan") tersasar terlalu kecil (2xl) berbanding skrin sejenis lain (404, tetapkan kata
// laluan, ralat) yang guna 3xl/4xl — bukan pilihan sengaja, cuma tak ada rujukan kongsi. EMPAT
// peringkat ikut PERANAN skrin (bukan pilihan bebas setiap fail):
//   hero   — reveal jenama paling besar: skrin splash/loading & Hero muka hadapan, sentiasa
//            berpasangan dengan baris sub-label "BRIEF" + tagline (lockup 3-baris penuh).
//   gate   — skrin bersendirian sepenuh-skrin (404, ralat, tetapkan kata laluan, pagar log masuk
//            Editorium) — wordmark ialah elemen paling menonjol, mesej/tajuk pendek di bawah sahaja.
//   header — bar kepala halaman ringkas (pautan balik ke laman utama), wordmark bersebelahan
//            kandungan lain dalam susun atur, bukan fokus tunggal skrin.
//   mini   — konteks ruang terhad (overlay/panel dalaman) — muat dalam bar kecil, bukan tumpuan.
// Panel transisi carousel (LogoTransisiAdjung, FrontpageView.tsx) SENGAJA dikecualikan skala ni —
// ia versi mini lockup 3-baris yang skalanya diikat rapat pada saiz fizikal panel carousel
// (CarouselStableBlock, struktur JSX sangat fragile, lihat CLAUDE.md), bukan konteks umum.
export const LOGO_SIZE = {
  hero: 'text-6xl md:text-7xl',
  gate: 'text-3xl md:text-4xl',
  header: 'text-2xl',
  mini: 'text-lg',
} as const;
