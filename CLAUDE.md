# Adjung Core

## Apa projek ini

Adjung Core ialah portal berita/kandungan bahasa Melayu bergaya "scholarly magazine" —
bento-grid frontpage (38 slot kad bersaiz berbeza) yang memaparkan kandungan editorial
(berita, ilmu, kebudayaan) yang boleh diisi tiga cara: **Manual** (taip/tampal terus),
**AI Generated** (pipeline auto-jana via Gemini/Claude/dsb.), atau **Hybrid**.

Stack: Vite + React (frontend, `src/`) + Express (`server.js`) + SQLite (`adjung.db`).
Dibangunkan asalnya di Google AI Studio, kini disambung/dikembangkan di sini.

Pemilik projek: Izzat (Chief Editor, bukan pemaju). Non-dev — jangan andaikan dia faham
istilah teknikal; terangkan kesan visual/fungsian, bukan jargon kod.

## Falsafah teras

1. **Kad tak boleh overflow. Tiada pengecualian.** Setiap kad bento ada saiz fizikal
   tetap ikut tier geometrinya. Kandungan (tajuk + huraian) MESTI muat dalam saiz itu.
   Ini bukan cadangan — ia peraturan keras yang dikuatkuasakan di **peringkat simpan**
   (server-side validation menolak kandungan yang tak muat), bukan diselesaikan lepas
   fakta dengan CSS clipping (`overflow-hidden`/`line-clamp`) atau memotong teks sedia
   ada secara mekanikal. Body kandungan editorial (tajuk berita, huraian) adalah tulisan
   sebenar — jangan potong/tulis-ganti secara automatik tanpa kelulusan eksplisit
   pemilik projek; itu vandalisme editorial, bukan "fix".

2. **Kad sejenis (tier) MESTI dilayan sama rata.** Jangan sekali-kali baiki satu slot/kad
   dan biarkan slot lain yang sama tier tidak dibaiki. Sebarang peraturan/pembetulan
   mesti applied di peringkat TIER (semua slot dalam kumpulan tier yang sama), bukan
   per-slot ad hoc. Ini konsep paling kerap dilanggar dalam sejarah projek ini — sentiasa
   audit SEMUA occurrence sebelum anggap kerja selesai.

3. **Verify pakai mata, bukan teka atau kira sahaja.** Selepas ubah apa-apa yang
   memberi kesan visual, wajib sahkan di browser sebenar (screenshot, computed style,
   `scrollHeight` vs `clientHeight`) — bukan cuma percaya logik/matematik kod. Beberapa
   bug besar dalam sejarah projek ini (overflow, warna, font weight) hanya kelihatan
   selepas verifikasi visual sebenar, bukan dari membaca kod.

4. **Tiada backup DB yang boleh dipercayai.** `adjung.db` (gitignored, bukan dalam git)
   ada kandungan editorial sebenar yang tak boleh dijana semula. Sebelum sebarang
   operasi bulk/destructive pada data, backup dulu (`cp adjung.db adjung.db.backup-<ts>`)
   dan uji dengan sangat berhati-hati.

## Konsep teknikal utama

### Geometry tiers (saiz kad)
Setiap slot (index 0-37, + Ticker slotIndex -1) tergolong dalam satu tier geometri
tetap: `HERO` (slot 0), `MENEGAK`, `STANDARD`, `SEGI_EMPAT_MEDIUM`, `SEGI_EMPAT_SMALL`,
`KOMPAK`, `BAR`, `TICKER`. Pemetaan slot→tier dan semua had aksara kini disimpan di
**satu** modul kongsi tunggal, `core/editorial/GeometryConfig.js`
(`GEOMETRY_RATIOS`, `TIER_SLOTS`, `tierForSlot()`, `ceilingForSlot()`) — diimport
terus (bukan disalin semula) oleh `core/editorial/ContentBudget.js`,
`server.js`, `src/components/portal/FrontpageView.tsx`,
`core/editorial/EditorialPipeline.js`, dan
`src/components/editorium/PerlembagaanConsole.tsx` (rujukan live "Perlembagaan"
dalam Editorium). **Jangan taip semula nombor had aksara di tempat lain** —
import terus daripada fail ni. (Sejarah: pada 2026-07-25 5 salinan berasingan
nombor ni ditemui, 2 daripadanya bug sebenar yang mengurangkan ruang sebenar
editor boleh guna untuk 4 daripada 8 tier — lihat log git `core/editorial/`.)

### Bajet ruang kongsi (title + brief budget line)
Tajuk dan huraian SATU kad kongsi satu bajet ruang tetap — bukan dua had berasingan.
Formula: `title.length / maxTitleAlone + brief.length / maxBriefAlone <= 1`, di mana
`maxTitleAlone`/`maxBriefAlone` ialah had setiap medan bila medan satu lagi kosong
(diukur secara empirik dari saiz kad sebenar). Ini bermakna tajuk panjang + huraian
pendek boleh muat, dan sebaliknya — tapi kedua-duanya panjang serentak tak boleh.

Formula ni terpakai pada **kesemua 8 tier** (termasuk `BAR` — yang `maxBriefAlone`
sentiasa 0 sebab tiada medan huraian langsung — dan `TICKER`), dikuatkuasakan oleh
`validateContentBudget()` di setiap laluan simpan (manual paste, batch paste,
pipeline AI, PATCH/POST edit terus) tanpa pengecualian.

Validation ini WAJIB dipanggil di **setiap** laluan yang cipta/ubah kandungan
(`validateContentBudget(slotIndex, title, summary)` dari `core/editorial/ContentBudget.js`):
manual-paste (`syncManualObjectsForSlot`), batch-paste, AI pipeline
(`EditorialPipeline.js`), dan edit terus (`PATCH/POST /api/system/content`). Kalau
tambah laluan simpan kandungan baharu, WAJIB sambungkan validation ini juga.

### CarouselStableBlock (kunci tinggi carousel)
Sesetengah kad ada carousel berbilang item (rotate). `CarouselStableBlock` di
`FrontpageView.tsx` mengunci tinggi kad ikut item TERTINGGI dalam senarai (JS-measured
via `ResizeObserver`) supaya rotation tak buat kad tukar saiz. Ia **hanya** aktif bila
`items.length > 1` — kad dengan SATU item sahaja tiada height-lock automatik, jadi
overflow validation (di atas) adalah satu-satunya perlindungan untuk kes itu.

Struktur JSX di dalam `renderItem` sangat fragile — perubahan kecil (tambah flex-row,
ubah wrapper) boleh pecahkan height-lock (kandungan bertindih antara item carousel).
Uji dengan teliti (visual, bukan cuma tsc) selepas ubah struktur kad.

### Skema data kandungan
- `editorial_objects`: metadata (id, type, categoryId, slotIndex) — TIADA title/summary.
- `editorial_revisions`: title/summary sebenar (satu row per versi, `version` menaik).
- `editorial_attribute_values`: field tambahan (desk, source, url, briefLong,
  originalDate, topik) — attributeId MESTI didaftar dulu dalam `editorial_attributes`
  (FK constraint), jika tidak INSERT gagal senyap (`console.warn`, bukan crash).

### Bidang & Topik
Setiap slot (selain Ticker dan tier `BAR`) terkunci kepada SATU **Bidang** tetap
(konsep "Kategori"/`desk` sedia ada) — semua kandungan dalam slot tu, termasuk semua
item carousel, mesti dalam Bidang yang sama. **Topik** ialah medan bebas-had,
per-kandungan, boleh berbeza-beza dalam slot yang sama asalkan masih dalam Bidang
terkunci tu (cth: Bidang `Ekonomi` tetap, Topik `Kewangan`/`Perbankan`/dll). Warna
Topik mewarisi warna Bidang induknya. Label kad: `Bidang | Topik` — kandungan lama
tanpa Topik papar Bidang sahaja (tiada backfill). Topik wajib untuk kandungan
baharu/diedit (bukan status-sahaja), disahkan oleh
`validateBidangTopik()` di `core/editorial/ContentBudget.js`, dipanggil di setiap
laluan simpan yang sama seperti `validateContentBudget()` di atas. Pertukaran Bidang
slot tidak retroaktif — cuma mempengaruhi kandungan baharu selepas perubahan. Rujuk
seksyen "03 -- Bidang & Topik" dalam Perlembagaan (Editorium) untuk butiran penuh.

## Bila teragak-agak

Kalau perubahan melibatkan kandungan editorial sebenar (bukan kod), UI/UX yang belum
jelas skopnya, atau operasi destructive pada data — tanya dulu, jangan teka dan jalankan
terus. Pemilik projek lebih suka proses lambat sikit tapi betul, berbanding pantas tapi
tersasar.
