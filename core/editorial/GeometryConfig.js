// Single source of truth for card geometry tiers, ratios, and slot mappings across Adjung Core.
// Used by both backend (ContentBudget.js) and frontend (FrontpageView.tsx).

export const GEOMETRY_RATIOS = {
  HERO: { maxTitleAlone: 115, maxBriefAlone: 350, ratio: 3.043 },
  MENEGAK: { maxTitleAlone: 168, maxBriefAlone: 429, ratio: 2.554 },
  STANDARD: { maxTitleAlone: 110, maxBriefAlone: 280, ratio: 2.545 },
  SEGI_EMPAT_MEDIUM: { maxTitleAlone: 94, maxBriefAlone: 126, ratio: 1.340 },
  SEGI_EMPAT_SMALL: { maxTitleAlone: 62, maxBriefAlone: 78, ratio: 1.258 },
  KOMPAK: { maxTitleAlone: 80, maxBriefAlone: 41, ratio: 0.512 },
  BAR: { maxTitleAlone: 95, maxBriefAlone: 0, ratio: 0 }, // BAR has no brief field at all — 0/95 = 0, not the stale 0.850 this used to read.
  TICKER: { maxTitleAlone: 80, maxBriefAlone: 220, ratio: 2.750 },
};

// ---------------------------------------------------------------------------------------------
// PINDAAN HAD AKSARA TIER (2026-07-30, permintaan pemilik projek)
//
// GEOMETRY_RATIOS di atas kekal sebagai nilai LALAI — diukur daripada saiz fizikal kad. Ketua
// Editor boleh menindihnya per-tier melalui Editorium → Slot → Tier Kad (disimpan dalam jadual
// `tier_settings`; server memuatkannya semasa boot dan memanggil setTierOverrides()).
//
// Peraturan tak berubah: pindaan dibuat pada peringkat TIER, tidak pernah per-slot. Semua slot
// yang sebentuk sentiasa berkongsi had yang sama.
//
// Guna ratiosForTier(tier) — BUKAN GEOMETRY_RATIOS[tier] terus — di mana-mana kod yang
// mengesahkan atau memaparkan had, supaya pindaan Ketua Editor benar-benar berkuat kuasa.
const TIER_OVERRIDES = {};

export const setTierOverrides = (map) => {
  for (const key of Object.keys(TIER_OVERRIDES)) delete TIER_OVERRIDES[key];
  for (const [tier, nilai] of Object.entries(map || {})) {
    if (!GEOMETRY_RATIOS[tier] || !nilai) continue;
    const pindaan = {};
    if (Number.isFinite(nilai.maxTitleAlone)) pindaan.maxTitleAlone = nilai.maxTitleAlone;
    if (Number.isFinite(nilai.maxBriefAlone)) pindaan.maxBriefAlone = nilai.maxBriefAlone;
    if (Object.keys(pindaan).length) TIER_OVERRIDES[tier] = pindaan;
  }
};

export const getTierOverrides = () => ({ ...TIER_OVERRIDES });

export const ratiosForTier = (tier) => {
  const asas = GEOMETRY_RATIOS[tier];
  if (!asas) return null;
  return { ...asas, ...(TIER_OVERRIDES[tier] || {}) };
};

export const TIER_SLOTS = {
  HERO: [0],
  MENEGAK: [1, 12, 15, 26, 29, 37],
  STANDARD: [2, 6, 19, 20, 33, 34],
  SEGI_EMPAT_MEDIUM: [13, 14, 27, 28],
  SEGI_EMPAT_SMALL: [3, 11, 16, 25, 30, 35, 36],
  KOMPAK: [4, 5, 17, 18, 31, 32],
  BAR: [7, 8, 9, 10, 21, 22, 23, 24],
};

export const FALLBACK_CEILINGS = {
  HERO: { maxTitle: 115, maxBrief: 350 },
  STANDARD: { maxTitle: 110, maxBrief: 280 },
  BAR: { maxTitle: 95, maxBrief: 0 },
  TICKER: { maxTitle: 80, maxBrief: 220 },
  DEFAULT: { maxTitle: 70, maxBrief: 100 },
};

// Canonical Malay tier labels — single source of truth, imported by PerlembagaanConsole.tsx and
// IndeksConsole.tsx (no local copies). Derived from the Fasa 0 shape illustration (Full
// horizontal/Vertical/Horizontal/Square/Compact/Bar) translated to Malay per project owner's
// explicit instruction: "Horizontal" -> "Melintang", "Square" -> "Kiub", with Besar/Kecil added
// to split SEGI_EMPAT_MEDIUM/SMALL since the illustration only had one "Square" label for what is
// now two distinct tiers.
export const TIER_LABELS = {
  HERO: 'Melintang Penuh',
  MENEGAK: 'Menegak',
  STANDARD: 'Melintang',
  SEGI_EMPAT_MEDIUM: 'Kiub Besar',
  SEGI_EMPAT_SMALL: 'Kiub Kecil',
  KOMPAK: 'Kompak',
  BAR: 'Bar',
  TICKER: 'Ticker',
};

// Peraturan Perlembagaan: label mesti 100% Bahasa Melayu; Bahasa Inggeris hanya dibenarkan
// bertulis condong (italic) bila tiada padanan Melayu yang diluluskan lagi. "Bar" dan "Ticker"
// tiada terjemahan Melayu rasmi setakat ini — tandakan di sini supaya semua paparan (Perlembagaan,
// Indeks, dll.) condongkan kedua-dua label ini secara konsisten dari satu tempat.
export const TIER_LABEL_IS_ENGLISH = {
  BAR: true,
  TICKER: true,
};

export const tierForSlot = (slotIndex) => {
  if (slotIndex === -1) return 'TICKER';
  for (const key of Object.keys(TIER_SLOTS)) {
    if (TIER_SLOTS[key].includes(slotIndex)) return key;
  }
  return null;
};

// maxBriefLong: character budget for the "Huraian Panjang" field — extra content not shown on
// the card itself, only in a not-yet-built "spotlight" detail view. There's no geometry-derived
// ceiling for it (it isn't rendered on the card), so it stays a manually curated per-tier value.
// Promoted here from two previously-independent copies (server.js, FrontpageView.tsx) that had
// already happened to agree on these exact numbers — unifying them now so they can't drift apart.
export const MAX_BRIEF_LONG_BY_TIER = {
  HERO: 800,
  MENEGAK: 800,
  STANDARD: 600,
  SEGI_EMPAT_MEDIUM: 500,
  SEGI_EMPAT_SMALL: 400,
  KOMPAK: 400,
  BAR: 0,
  TICKER: 0,
  DEFAULT: 600,
};

// Had aksara label eyebrow kad — string "Bidang | Topik" yang dipapar di atas tajuk.
//
// KENAPA INI WUJUD: bajet tajuk+huraian (GEOMETRY_RATIOS) diukur dengan andaian eyebrow
// mengambil SATU baris. Eyebrow sendiri tak pernah termasuk dalam bajet tu, dan tiada
// truncate/line-clamp pada mana-mana 30 render eyebrow. Diukur hidup pada 2026-07-27:
// eyebrow yang membalut menolak tajuk+huraian ke bawah 1:1 (eyebrow +94px -> kandungan
// +94px) sementara kad TIDAK membesar. Jadi Topik panjang memakan ruang kad secara
// senyap — tiada ralat, cuma huraian terkeluar/terpotong pada kad yang kandungannya padat.
//
// CARA NOMBOR INI DIPEROLEH: eyebrow guna JetBrains Mono (monospace), jadi muatan satu
// baris = floor(lebar / lebar-aksara), diukur terus dari DOM setiap tier pada viewport
// 1024px, ambil MINIMUM setiap tier (slot tersempit menetapkan had seluruh tier), tolak
// ~10% margin untuk risiko font fallback kalau JetBrains Mono gagal dimuat dari Google Fonts.
//
// SKOP: bekas grid capped pada max-w-6xl (1152px), jadi >=1152px muatan tetap maksimum.
// Antara 768-1024px eyebrow boleh membalut ke 2 baris — diterima, sebab kad sempit ada
// 275-301px ruang menegak lebih (diukur) yang menyerapnya, dan susun atur skrin kecil
// memang belum direka (lihat "Open work" dalam sistem reka bentuk).
export const MAX_EYEBROW_CHARS_BY_TIER = {
  HERO: 95,
  MENEGAK: 36,
  STANDARD: 54,
  SEGI_EMPAT_MEDIUM: 59,
  SEGI_EMPAT_SMALL: 36,
  KOMPAK: 43,
  BAR: 36,     // tier ni tak papar Bidang/Topik, had konservatif kalau-kalau berubah
  TICKER: 36,  // sama
  DEFAULT: 36,
};

// Label eyebrow kad — SATU definisi, diimport oleh pengesahan simpan (ContentBudget.js)
// dan oleh render kad (FrontpageView.tsx). Kalau format ni bercabang dua, had aksara di
// atas akan mengesahkan string yang berbeza daripada yang benar-benar dipapar.
export const eyebrowLabel = (desk, topik) => {
  const d = (desk || '').trim();
  const t = (topik || '').trim();
  if (!d) return t;
  return t ? `${d} | ${t}` : d;
};

export const eyebrowCeilingForSlot = (slotIndex) => {
  const tier = tierForSlot(slotIndex) || 'DEFAULT';
  return MAX_EYEBROW_CHARS_BY_TIER[tier] ?? MAX_EYEBROW_CHARS_BY_TIER.DEFAULT;
};

// ---------------------------------------------------------------------------------------------
// HAD TOPIK SEDAR-IKON (2026-07-31, membetulkan bug diketahui sejak 2026-07-28)
//
// KENAPA INI WUJUD: eyebrow kad kini papar IKON Bidang + Topik (EYEBROW_GUNA_IKON di
// FrontpageView.tsx, EyebrowKad) — bukan lagi teks "Bidang | Topik". Tapi had di atas
// (MAX_EYEBROW_CHARS_BY_TIER) diukur untuk label GABUNGAN teks penuh, dan topikCeilingForSlot()
// dulu mengira baki Topik dengan menolak PANJANG NAMA BIDANG daripada had itu — nombor yang tak
// releven lagi sebab nama Bidang tak dipapar sebagai teks pada kad. Kesannya: Bidang bernama
// panjang ("Kesusasteraan Melayu") menyempitkan had Topik walaupun kad cuma papar ikon kecil
// untuknya. Slot MENEGAK yang patut punya ~34 aksara untuk Topik cuma dapat ~13.
//
// CARA NOMBOR INI DIPEROLEH (diukur hidup, bukan ditolak secara teori): pada setiap tier, ukur
// lebar sebenar bekas eyebrow (getBoundingClientRect) pada viewport 1024px dari kad SEBENAR;
// setiap slot dalam satu tier memberi lebar IDENTIK (disahkan hidup 2026-07-31, tiada keperluan
// ambil minimum merentasi slot). Ikon (variant="bare", saiz={11} — nilai LALAI EyebrowKad, tiada
// pemanggil override) sentiasa 11px x 11px tak kira tier; jarak antara ikon & Topik tetap 6px
// (inline style EyebrowKad) — jumlah overhead tetap 17px, ditolak daripada lebar bekas. Lebar
// aksara JetBrains Mono (uppercase, bold, tracking-widest) diukur terus dari DOM setiap saiz fon
// tier (bukan dikira daripada metrik fon teori) via elemen ujian span disisipkan sementara,
// kecerunan (60 aksara - 20 aksara)/40 supaya sebarang offset tetap fon dibatalkan. Baki dibulat
// ke bawah, tolak 10% margin sama seperti MAX_EYEBROW_CHARS_BY_TIER di atas (risiko fon fallback).
//
// BAR/TICKER/DEFAULT: eyebrow tak dipapar untuk tier ni (EyebrowKad tak dipanggil) — nilai
// konservatif "kalau-kalau berubah", sama falsafah seperti MAX_EYEBROW_CHARS_BY_TIER.
//
// Kandungan LAMA tanpa Topik (topik kosong, requireTopik=false) tidak guna had ni — kad jatuh
// balik kepada label teks "Bidang" sahaja (tiada ikon tanpa Topik, lihat EyebrowKad), disahkan
// terus terhadap MAX_EYEBROW_CHARS_BY_TIER/eyebrowCeilingForSlot() seperti biasa (lihat
// validateBidangTopik() di ContentBudget.js).
export const MAX_EYEBROW_TOPIK_CHARS_BY_TIER = {
  HERO: 90,
  MENEGAK: 34,
  STANDARD: 59,
  SEGI_EMPAT_MEDIUM: 57,
  SEGI_EMPAT_SMALL: 34,
  KOMPAK: 40,
  BAR: 34,
  TICKER: 34,
  DEFAULT: 34,
};

// Berapa aksara Topik yang muat pada slot ni bila laluan ikon aktif (lihat nota di atas). Ini
// nombor yang editor (dan prom AI) perlu nampak — had eyebrow mentah/label gabungan tak berguna
// kepada mereka sebab mereka tak menaip bahagian Bidang, dan Bidang tak lagi dipapar sebagai teks.
export const topikCeilingForSlot = (slotIndex) => {
  const tier = tierForSlot(slotIndex) || 'DEFAULT';
  return MAX_EYEBROW_TOPIK_CHARS_BY_TIER[tier] ?? MAX_EYEBROW_TOPIK_CHARS_BY_TIER.DEFAULT;
};

// ---------------------------------------------------------------------------------------------
// HAD EYEBROW FOCUS VIEW (2026-07-31)
//
// Focus View (FocusView.tsx, susun atur desktop) papar label PENUH "Bidang | Topik" — bukan ikon
// — dalam <span> `whiteSpace:'nowrap'` di lajur "helaian" (`width: min(64%, 900px)`, dipusatkan).
// Tiada had lebar/ellipsis pada span ni; kalau teks melebihi lajur, ia melimpah keluar bingkai
// helaian tanpa jaring (tak seperti kad — Focus View tak dapat manfaat daripada
// BentoInner.kad-limpah). Ini SATU had sejagat (bukan per-tier): sumber kandungan boleh datang
// daripada mana-mana tier, tapi helaian Focus View lebar SAMA tak kira tier asal.
//
// HAD DIKIRA PADA LEBAR HELAIAN PALING SEMPIT: `min(64vw, 900px)` bermakna semakin sempit
// viewport, semakin sempit helaian — sehingga usePhoneViewport() menukar ke Susun Atur Telefon
// pada PHONE_MAX_WIDTH_PX (767px; lihat PhoneGeometry.js), yang mana eyebrow TAK guna nowrap
// (selamat, boleh membalut). Jadi 768px (viewport desktop paling sempit) ialah kes TERBURUK
// sebenar, bukan 1024px — diukur hidup pada 768px: lajur helaian ~485px, fon Inter 10px/700/
// letter-spacing 1.5px (var(--font-sans)/var(--text-10)/var(--tracking-editorial), lihat `micro`
// di FocusView.tsx). Lebar aksara diukur sama kaedah kecerunan (80 aksara - 20 aksara)/60 macam
// MAX_EYEBROW_TOPIK_CHARS_BY_TIER; baki dibulat ke bawah, tolak 10% margin fon fallback.
//
// NOTA: bahkan had GABUNGAN lama (95 aksara HERO) sudah melebihi ruang sebenar (~49) pada
// viewport sempit — risiko ni WUJUD sebelum pembetulan had Topik sedar-ikon di atas, cuma tak
// disedari sebab tiada siapa sampai had penuh 95 aksara lagi. Pembetulan had Topik di atas
// membuka lagi risiko ni (Bidang kini tak dihadkan langsung oleh pengesahan eyebrow kad), jadi
// had sejagat ni WAJIB disemak serentak — lihat validateBidangTopik() di ContentBudget.js.
export const FOCUS_VIEW_EYEBROW_MAX_CHARS = 49;

// Character budget for BAR's "Penerangan" field — the accordion detail panel body text (see
// BarCardExpandedPanel.tsx). BAR-only field, not part of MAX_BRIEF_LONG_BY_TIER above (that's
// keyed by tier for a field every tier could theoretically have; Penerangan only exists for BAR).
// Measured empirically once the panel was actually built: at the panel's real rendered width
// (~293px, the BAR cluster's column), a 458-character sample rendered as a legible ~13-line
// paragraph at ~348px tall — comfortable for an accordion, not excessive. Enforced at save time
// by ContentBudget.js's validateBarPeneranganBudget(), same as every other tier's ceiling.
export const MAX_PENERANGAN_CHARS = 460;

// Single source of truth for "what's the hard ceiling for this slot's title/brief/briefLong" --
// used both to validate/clamp admin-saved slot config (server.js) and to pre-fill the admin slot
// settings form's defaults (FrontpageView.tsx). Previously each of those kept its own hand-typed
// copy of these numbers, which drifted out of sync for 4 of 8 tiers.
export const ceilingForSlot = (slotIndex) => {
  const tier = tierForSlot(slotIndex) || 'DEFAULT';
  // ratiosForTier, bukan GEOMETRY_RATIOS terus — supaya pindaan Tier Kad turut menular ke setiap
  // meter/paparan had yang memanggil fungsi ni.
  const ratioDef = ratiosForTier(tier);
  return {
    maxTitle: ratioDef ? ratioDef.maxTitleAlone : FALLBACK_CEILINGS.DEFAULT.maxTitle,
    maxBrief: ratioDef ? ratioDef.maxBriefAlone : FALLBACK_CEILINGS.DEFAULT.maxBrief,
    maxBriefLong: MAX_BRIEF_LONG_BY_TIER[tier] ?? MAX_BRIEF_LONG_BY_TIER.DEFAULT,
  };
};
