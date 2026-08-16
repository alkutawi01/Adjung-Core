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
   ada secara mekanikal. Body kandungan editorial (tajuk berita, huraian) ialah tulisan
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

5. **Bahasa Melayu ialah sebahagian daripada identiti penerbitan Adjung, bukan kosmetik.**
   Izzat sangat menitikberatkan bahasa (2026-08-16: "bahasa melayu awak pun sangat teruk...
   sila belajar dengan chatgpt"). Lihat "Panduan Bahasa Melayu Adjung" di bawah untuk
   peraturan penuh (imbuhan, lapisan istilah Inggeris, istilah rasmi produk) — SEBELUM
   tulis mana-mana teks Bahasa Melayu dipaparkan kepada pengguna (label UI, mesej ralat,
   Arahan AI, dokumentasi awam), semak peraturan tu dahulu. Jangan bawa gaya ringkas
   commit message/log teknikal Inggeris terus ke ayat Melayu (contoh: "Fix ini dah
   dibaiki" salah, "Pepijat ini telah dibaiki" betul).

## Panduan Bahasa Melayu Adjung

Disusun 2026-08-16 selepas audit 10 pusingan bersama ChatGPT (thread "Audit Adjung Brief"),
dicetuskan oleh teguran langsung Izzat tentang kualiti Bahasa Melayu Claude (imbuhan lemah,
struktur ayat janggal) dan bahasa UI sistem (istilah Inggeris tercampur tanpa kawalan —
"bahasa rojak", contoh sebenar: Log Audit papar "Tukar status: approved → archived" mentah
sebelum dibaiki). Rujukan penuh SEMUA istilah produk rasmi (Arahan AI, sesi AI, dll.) ada di
`docs/language-glossary.md` — bahagian ni fokus PERATURAN, bukan senarai istilah.

### Prinsip umum
Bahasa Melayu Adjung hendaklah: tepat dari segi tatabahasa; mudah difahami pembaca umum;
kemas seperti bahasa portal berita/majalah/penerbitan profesional; TIDAK berbunyi seperti
terjemahan langsung daripada Bahasa Inggeris; TIDAK berbunyi seperti log teknikal pembangun
("fix dah siap, deploy berjaya" — sesuai nota ringkas dalaman, TIDAK sesuai UI/dokumentasi).

Gaya **santai-profesional** untuk komunikasi kerja harian dengan Izzat: bentuk pendek ("tak",
"ni", "tu") boleh digunakan SECARA SEDERHANA dalam perbualan — bukan salah, tapi jangan setiap
ayat bergantung padanya (contoh gagal: "Yang ni saya dah betulkan. Yang tu pula belum. Benda
ni sebab yang tu punya logic lain." — terlalu banyak kata tunjuk buat ayat nampak malas). Untuk
UI, dokumentasi (CLAUDE.md, komen kod formal), Arahan AI dan teks awam, guna bentuk penuh
("tidak", "ini", "itu"). Elak dua ekstrem: terlalu formal macam surat rasmi, ATAU terlalu
percakapan macam sembang media sosial.

### Lapisan istilah Inggeris (bila condong/terjemah/kekal)
Bukan peraturan "semua perkataan Inggeris = condong/terjemah" — tiga lapisan:
1. **Istilah teknikal antarabangsa berbentuk singkatan** (API, IP, RSS, URL, PDF, AI, USB,
   HTML) — kekalkan, TANPA condong. Singkatan huruf besar bukan lagi "perkataan asing", ia
   istilah standard (cth: "API cuaca", BUKAN "*API* cuaca").
2. **Istilah pinjaman lazim dalam Bahasa Melayu** (status, draf, slot, animasi, modul) —
   kekalkan tanpa condong/terjemah paksa. "Slot" khususnya ialah konsep produk Adjung sendiri
   (cth "Slot 3: Syariah") — JANGAN paksa tukar ke "ruang".
3. **Istilah Inggeris belum mantap/konsep sementara** — terjemah ke Bahasa Melayu (workflow →
   aliran kerja, cookie → kuki, dashboard → papan pemuka jika bukan nama produk) ATAU condong
   kalau memang perlu dikekalkan sebagai istilah asing eksplisit.
Jangan campur istilah Inggeris+Melayu untuk SATU konsep kalau bentuk Melayu tepat dah ada
(punca "bahasa rojak" — kod status dalaman `approved`/`archived` MESTI dipetakan ke label
Melayu `Aktif`/`Arkib` sebelum dipaparkan, jangan sekali-kali bocor terus ke UI/Log Audit).

### 5 pola imbuhan paling kerap silap
1. **Awalan meN- untuk kata kerja aktif berpelaku.** "Sistem baca data" ❌ →
   "Sistem membaca data" ✅. Formula: Pelaku + meN- + kata kerja (membaca, menjana, menyemak,
   memaparkan, menghasilkan).
2. **Awalan di- MESTI dicantumkan** (bukan kata sendi berasingan). "perlu di semak" ❌ →
   "perlu disemak" ✅. Kekecualian: "di" sebagai kata sendi TEMPAT kekal berasingan ("di dalam
   sistem", "di atas halaman").
3. **-kan vs -i.** "-kan" = membawa sesuatu kepada objek/menyebabkan perubahan ("editor
   menambahkan sumber baharu"). "-i" = tindakan pada tempat/objek ("editor meneliti kandungan",
   BUKAN "menelitikan"). Jangan gandakan ("mengemaskinikan" ❌ → "mengemas kini" ✅).
4. **peN-...-an (proses) vs peN- (pelaku) — jangan keliru.** Pelaku: penerbit, penyunting,
   pengguna. Proses: penerbitan, penyuntingan, penggunaan. "Modul Pengurusan Penerbit" (kalau
   maksud PROSES penerbitan) ❌ → "Modul Pengurusan Penerbitan" ✅.
5. **Jangan gandakan imbuhan memper-...-kan.** "memperbaiki-kan" ❌ → "memperbaiki" atau
   "membaiki" ✅. "mempertingkatkan lagi penambahbaikan" (berlebihan) ❌ → "meningkatkan
   penambahbaikan" ✅.

Senarai semak pantas sebelum hantar ayat teknikal/UI: (1) Ada pelaku? Semak meN-. (2) Sesuatu
menerima tindakan? Semak di- dicantum. (3) Proses atau pelaku yang dimaksudkan? Semak
peN-...-an vs peN-. (4) Ayat tergantung tanpa objek? ("sistem telah menyediakan" — sediakan
APA?) — lengkapkan objeknya.

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
Formula: `title.length / maxTitleAlone + brief.length / maxBriefAlone <= 1`, iaitu
`maxTitleAlone`/`maxBriefAlone` ialah had setiap medan apabila medan satu lagi kosong
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
via `ResizeObserver`) supaya rotation tak buat kad tukar saiz. Ia **hanya** aktif apabila
`items.length > 1` — kad dengan SATU item sahaja tiada height-lock automatik, jadi
overflow validation (di atas) ialah satu-satunya perlindungan untuk kes itu.

Struktur JSX dalam `renderItem` sangat fragile — perubahan kecil (tambah flex-row,
ubah wrapper) boleh pecahkan height-lock (kandungan bertindih antara item carousel).
Uji dengan teliti (visual, bukan cuma tsc) selepas ubah struktur kad.

### Skema data kandungan
- `editorial_objects`: metadata (id, type, categoryId, slotIndex) — TIADA title/summary.
- `editorial_revisions`: title/summary sebenar (satu row per versi, `version` menaik).
- `editorial_attribute_values`: field tambahan (desk, source, url, briefLong,
  originalDate, topik) — attributeId MESTI didaftar dulu dalam `editorial_attributes`
  (FK constraint), jika tidak INSERT gagal senyap (`console.warn`, bukan crash).

### Log Audit — actorId ialah kontrak pembeza manusia vs sistem (2026-08-16)
Setiap panggilan `logAudit()` (`core/audit/AuditLog.js`) MESTI ikut konvensyen ni:
- **Tindakan editor sebenar** (terbit, sunting, urus akaun, urus Bidang, dll — apa-apa
  yang berlaku kerana seseorang klik sesuatu dalam Editorium): `actorId: req.session.user.id`.
- **Event automasi/sistem** (RSS Direct, Penjadual Sistem terbit/luput berjadual, amaran
  konfigurasi, dll): JANGAN sertakan `actorId` langsung (jatuh ke `NULL` — jangan reka ID
  "pengguna sistem" palsu spt `'system'`/`'rss-bot'`, itu akan pecahkan konvensyen ni).

`actorId IS NOT NULL` ialah SATU-SATUNYA cara sistem bezakan "tindakan manusia" drpd
"automasi" (bukan teks `action`/`actorName`, yang boleh berubah/bertambah bila laluan
baharu ditambah) — dipakai oleh panel "Aktiviti Editor" (`DashboardConsole.tsx`, tapis
`logs.filter(l => l.actorId != null)` sebelum papar, elak event RSS/Penjadual Sistem
tenggelamkan tindakan editor sebenar). Kalau tambah laluan `logAudit()` baharu, WAJIB ikut
konvensyen ni — kalau tidak, "Aktiviti Editor" akan silap papar/sorok item.

Bila ciri masa depan melibatkan AI bertindak ATAS ARAHAN editor (cth "editor klik Jana
Ringkasan, AI isi borang"), `actorId` KEKAL editor yang klik (bukan kosong/AI) — tambah
medan berasingan (cth `source: 'ai'`) kalau perlu bezakan cara tindakan tercetus, jangan
sesekali biar tindakan yang dicetus editor hilang daripada `actorId IS NOT NULL`.

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
seksyen "03 — Bidang & Topik" dalam Perlembagaan (Editorium) untuk butiran penuh.

### Dua laluan "edit selepas terbit" — JANGAN campur (2026-08-16)
Adjung Brief ada DUA laluan berasingan untuk ubah kandungan yang sudah AKTIF — kedua-duanya
sengaja, jangan cuba "seragamkan" tanpa faham beza tujuan (disahkan hujung-ke-hujung, Slot 3
simulasi, guna kandungan sebenar):

- **Semakan Kandungan / Simpan Pukal** (`ContentReview.tsx` -> `PATCH /content/:id` dgn
  `title`/`summary`, `contentRoutes.js` ~baris 888 `isContentEdit`) — **Revision Editing**.
  objectId KEKAL SAMA, `editorial_revisions.version` naik (1->2->3...), semua atribut lama
  dibawa ke revisi baharu. Ini laluan "editor jumpa typo/fakta berubah, betulkan cepat".
  `POST /content/:id/revisions/:revisionId/restore` (Pulih versi lama) berfungsi PENUH di
  sini — restore v1 CIPTA version baharu (bukan literal kembali ke v1), sejarah tak pernah
  padam. Tab "Sejarah Versi" (IndeksConsole.tsx) tepat & bermakna untuk laluan ni.
- **Tolak (arkib & pulangkan draf) -> edit draf -> Terbit semula** (`SlotManagerModal.tsx`,
  slot picker "Tulis Kandungan Baharu") — **Publication Redraft**. Objek lama jadi
  `status='archived'` (KEKAL dlm DB, bukan padam — sejarah selamat), draf pulang dgn UUID
  BAHARU, Terbit semula cipta objectId BAHARU sepenuhnya (version SENTIASA 1). Ini laluan
  untuk kandungan yang perlu SEMAKAN SEMULA (ditolak sbb dasar/fakta salah), bukan pembetulan
  pantas. Tab "Sejarah Versi" untuk objek yang lahir drpd laluan ni akan SENTIASA papar
  "Versi 1" sahaja walaupun kandungan tu kitaran ke-2/3 — BUKAN pepijat, cuma laluan ni
  memang tak guna version chain.

View count (`daily_view_counts`) TAK terjejas oleh mana-mana laluan — dikira ikut
`targetType='slot', targetId=slotIndex`, bukan objectId, jadi kekal berterusan tak kira
laluan edit yang dipakai.

**AMARAN WAJIB — mana-mana query `editorial_revisions WHERE status='approved'` yang
JOIN ke `editorial_objects` (bukan SELECT ke SATU baris `id` diketahui) MESTI sertakan
`AND version = (SELECT MAX(version) FROM editorial_revisions WHERE objectId = eo.id)`.**
Tanpa had ni, objek yang ada >1 revisi berstatus 'approved' (version chain via Semakan
Kandungan di atas) pulangkan objectId SAMA berulang kali — SATU baris bagi SETIAP versi
approved, bukan satu baris seobjek. Pepijat sebenar 2026-08-16: `resolveSlotContent()`
(server.js, mod AI Generated + Manual) terlepas had ni, kandungan yang diedit >1 kali
papar carousel PALSU (anak panah + titik) di frontpage walaupun cuma SATU kandungan
sebenar — CarouselStableBlock (FrontpageView.tsx) baca N baris objectId sama sbg N
kandungan berbeza. Pepijat ni SENYAP bertahun sebab version chain (>1 revisi approved
seobjek) jarang berlaku sebelum ciri tu disahkan berfungsi penuh (lihat bahagian atas).
`searchRoutes.js`/`sitemapRoutes.js` sudah betul (guna corak `MAX(version)` sama) —
disahkan bukan pepijat merata, terhad kepada `resolveSlotContent()` sahaja pada masa
penemuan.

Sambungan pepijat sama: laluan `POST /content/:id/revisions/:revisionId/restore`
(Pulih versi) turut ada pepijat BERASINGAN yang cuma nampak SELEPAS fix `MAX(version)`
di atas — ia tulis `createdBy` = nama pengguna sesi sebenar (cth `"izzat"`), bukan
token laluan pipeline (`manual-slot-save`/`migration-manual-blob`/`content-review`).
Sama pepijat kritikal 2026-08-07 yang dibaiki di `PATCH /content/:id`
(`rev.createdBy || 'content-review'`, WARIS token asal — lihat komen di situ), tapi
laluan pulih-versi terlepas fix asal tu. Kandungan yang dipulihkan tak lulus senarai
putih Mod Manual (`resolveSlotContent()`), terus TAK KELIHATAN pada frontpage awam
walau status kekal `'approved'` dan UI admin nampak biasa. Dibaiki (warisi
`oldRev.createdBy`). **Peraturan am**: mana-mana laluan yang INSERT baris
`editorial_revisions` baharu (edit, pulih, dsb.) MESTI warisi `createdBy` daripada
revisi ASAL yang dijadikan asas — JANGAN sekali-kali tulis nama pengguna sesi terus ke
medan ni, walau nampak "lebih tepat/jujur" — identiti penyunting sebenar sudah direkod
berasingan dalam attribute `editorName`, `createdBy` ialah token LALUAN (macam mana
dicipta), bukan SIAPA.

### Arahan AI — huraian panjang berperenggan + had Sumber realistik (2026-08-16)
Simulasi "Dengan rujukan" SEBENAR (sumber sebenar, AI sebenar via ChatGPT, bukan cuma baca kod)
dedah dua isu, kedua-dua dibaiki + disahkan hujung-ke-hujung (publish sebenar, DB, API awam,
kad frontpage/mobile):

- **Huraian panjang satu blok teks** — arahan `[Fungsi huraian panjang]` (`buildAiPrompt()`,
  `SlotManagerModal.tsx`) lama cuma larang subtajuk, tak pernah eksplisit minta perenggan. AI
  tafsir "mengalir lancar" = SATU blok tanpa `\n\n` langsung. Fix: eksplisit minta pecah ikut
  PERUBAHAN IDEA (bukan bilangan tetap), guna `\n\n` antara perenggan, kekal satu naratif
  bersambung (bukan nota gaya blog). **Nota**: arahan `[Semakan sendiri]` (AI kira semula aksara
  sendiri) TAK 100% dipatuhi dlm ujian sebenar (AI hasilkan 1962 aksara, langgar had 1800) —
  `validateContentBudget()` di server KEKAL gerbang sebenar, prompt cuma kurangkan kadar ralat.
  Jangan sekali-kali anggap arahan prompt sahaja cukup jamin had — sentiasa uji publish SEBENAR.
- **hadSumber (Tetapan Am Slot) 20 aksara terlalu ketat** — nama penerbit berita SEBENAR yang
  biasa (bukan reka/pelik) melebihi 20 aksara: "The Malaysian Reserve"=21, "South China Morning
  Post"=25, "New Straits Times"=17 dan "The Star Malaysia"=18 pun dah hampir had. Naikkan ke 50
  (nilai DATA di `slot_am_settings`, bukan kod — laras di Editorium → Slot → Tetapan Am, BUKAN
  edit terus DB supaya cache dalam-memori `ContentBudget.js` turut segar). Disahkan visual
  (desktop + mobile 375px): lajur nama sumber TIADA `overflow-hidden`/`truncate`/`nowrap` sengaja
  — teks lebih panjang WRAP secara semula jadi (kad tumbuh, bukan potong), sepadan falsafah "kad
  tak boleh overflow" CLAUDE.md. Kalau nama sumber masih tak muat 50 aksara di masa depan,
  singkatan biasa (NST, SCMP) ialah jalan keluar pertama sebelum naikkan had lagi.

### Mod "Dengan Artikel Jurnal" — peluasan ketiga Jana Kandungan AI (2026-08-16)
Arahan terus daripada Izzat: tambah cara sumber SATU LAGI (bukan platform/modul berasingan)
untuk `genMode` di `buildAiPrompt()`/`SlotManagerModal.tsx` — editor lampirkan PDF artikel
jurnal/akademik secara manual dalam sesi AI luaran (ChatGPT/Claude/Gemini) sendiri, tampal
hasil kembali ke Adjung Brief macam biasa. **Adjung Brief SENGAJA TIDAK bina upload PDF,
storan atau parser** — sistem cuma jana prompt berbeza ikut mod, tiada infrastruktur fail baharu.

- **Berbeza daripada "Dengan rujukan" (URL)** — jangan anggap URL jurnal = URL artikel berita.
  "Dengan rujukan" sesuai untuk berita/kenyataan rasmi/halaman web (AI boleh fetch URL).
  "Dengan Artikel Jurnal" sesuai untuk PDF akademik (AI TAK fetch apa-apa — kandungan sudah
  ditampal terus oleh editor dalam sesi AI luaran itu sendiri). Sebab tu medan "Nama jurnal"
  (`aiPromptSource`, plain text, BUKAN struktur `sources[]` nama+URL macam mod rujukan) bersifat
  PILIHAN sahaja — `copyPrompt()` TIDAK sekat mod ni walau kosong, tiada gerbang URL macam mod
  rujukan (yang sengaja sekat sepenuhnya kalau URL kosong — dua falsafah berbeza, jangan campur).
- **Gaya penulisan ialah teras ciri ni** — AI kerap tulis sumber jurnal sebagai "ulasan jurnal"
  ("Kajian ini mendapati...", "Artikel jurnal ini membincangkan..."), padahal Adjung Brief
  perlukan naratif editorial terus (macam AI sendiri faham & terangkan perkara tu, bukan
  melaporkan tentang kewujudan kajian). Prompt sekarang eksplisit larang frasa gaya akademik +
  beri contoh betul/salah (lihat seksyen `[Gaya penulisan]` dlm `sumberSection` mod ni).
- **Medan Sumber ringkas, bukan citation akademik** — "Journal of Islamic Studies" bukan
  "Ahmad, A. (2025). Tajuk. Jurnal X, Vol 10...".
- **Kongsi sifat "SATU sumber = SATU kandungan"** dgn mod rujukan — flag gabungan
  `isSingleSourceMode` (`isReferenceMode || isJournalMode`) kunci `Jumlah kandungan` = 1 dan
  langkau seksyen `[Had usia sumber]`/`[Negara/Wilayah sumber]` (tak relevan utk PDF akademik,
  yang selalunya jauh lebih lama drpd berita semasa dan tiada "negara asal" bermakna).
- **Ujian**: Izzat jalankan simulasi sebenar SENDIRI (persekitaran Claude Code tiada keupayaan
  upload PDF) — semak tajuk sentence case tak akademik, huraian panjang berperenggan tanpa
  frasa ulasan jurnal, medan Sumber nama jurnal ringkas, publish ikut laluan sama mod rujukan.

### Pengecualian Pemenggalan Suku Kata — modul editor "autocorrect" (2026-08-16)
Arahan terus Izzat: sistem pemenggalan automatik (`core/editorial/PemenggalSukuKata.js`, algoritma
(K)(K)V(K) fonetik) **tak salah**, cuma editor kadangkala perlu timpa hasilnya untuk perkataan
tertentu. Ciri baharu (bukan gantian algoritma):

- **Jadual baharu** `pemenggalan_pengecualian` (perkataan, corak bersempang cth "pen-tad-bir-an").
  Modul admin di Editorium → Editorial → 4. Pemenggalan Perkataan (`EditorialConsole.tsx`, corak
  identik Penyelarasan Ejaan — senarai+dialog tambah/sunting/buang). API di
  `core/routes/pemenggalanRoutes.js`, GET AWAM (dibaca `FrontpageView.tsx` sendiri, bukan cuma
  admin — lihat bawah), tulis digerbang `requirePermission('manageEditorial')`.
- **Pengesahan DUA lapisan, WAJIB** — corak (sempang dibuang) MESTI sepadan tepat perkataan asal
  (huruf kecil), kalau tidak DITOLAK: (1) `pemenggalanRoutes.js` tolak 400 semasa simpan, (2)
  `corakKepadaOffset()` (`PemenggalSukuKata.js`) tolak senyap (jatuh balik ke algoritma automatik)
  semasa paparan — pertahanan KEDUA sengaja, andai data lapuk/rosak entah bagaimana terlepas
  laluan simpan, teks editorial pembaca TIDAK SEKALI-KALI rosak akibatnya.
- **Engine simpan OFFSET aksara** (bukan corak bersempang mentah) dalam peta dalam-modul — supaya
  sisipan sempang guna huruf SEBENAR perkataan dipaparkan (cth "Pentadbiran" P besar kekal), bukan
  huruf kecil corak tersimpan. Kes huruf asal TAK SEKALI-KALI disentuh.
- **Wiring client SAMA corak** seperti Glos Selari/Autocondong (`setGlosSelariAktif`/
  `setTypographyRulesAktif`, `utils.tsx`) — `FrontpageView.tsx` muat senarai SEKALI (`useEffect`
  `[]`), selaraskan ke peta dalam-modul via `setPemenggalanPengecualian()` setiap kali senarai
  berubah. `FocusView.tsx` TAK perlu muat berasingan — ia sentiasa rendered SEBAGAI ANAK
  `FrontpageView.tsx` (bukan laluan/halaman berasingan), jadi effect induk sentiasa dah jalan dulu.
- **Ujian** (`tests/pemenggalSukuKata.test.js`): guna contoh SEBENAR Izzat (pentadbiran) — algoritma
  automatik hasilkan "pen-tad-bi-ran" (BUKAN salah, dia sendiri sahkan), override boleh timpa jadi
  "pen-tad-bir-an" bila editor rasa perlu. Turut kunci: perkataan lain tak terjejas, corak tak sah
  ditolak senyap+algoritma jalan seperti biasa, senarai kosong/null selamat.

### Dasar Aktif Editorial — tempoh kini DATA boleh laras, bukan pemalar kod (2026-08-16)
Dasar sedia ada sejak 2026-08-05 (editor wajib terbitkan kandungan dalam tempoh ditetapkan, kalau
tidak akaun digantung automatik — `runSemakanTakAktif()`, server.js) guna tempoh 7/14/21 hari
HARDCODE (`AMBANG_TAK_AKTIF` pemalar). Izzat tanya "macam mana nak check dan adjust tempoh tu?" —
jawapan sebelum ni ialah "kena minta Claude edit kod". Dipindah ke `core/routes/dasarAktifRoutes.js`:

- **Jadual `dasar_aktif_editorial`** (satu baris `id='main'`, corak IDENTIK `slot_am_settings`) —
  `amaranPertamaHari`/`amaranKeduaHari`/`notisPenamatanHari`, lalai 7/14/21.
- **`getDasarAktifAmbangMs()` dibaca LIVE** di dalam `runSemakanTakAktif()` SETIAP kali ia jalan
  (sekali sehari), BUKAN sekali semasa boot — perubahan Pentadbir buat hari ni terpakai pada
  semakan esok TANPA restart pelayan. Jangan sesekali cache `AMBANG_TAK_AKTIF` sebagai pemalar
  modul semula — itu punca asal soalan Izzat ("kena minta Claude" setiap kali nak ubah).
- **`PERANAN_TERPAKAI_DASAR_AKTIF`** (senarai peranan tertakluk dasar ni, Pentadbir DIKECUALIKAN
  — struktur RBAC dia `publish: false`, mengukurnya dengan neraca ni jamin gagal) kini **satu
  sumber kebenaran dikongsi** `dasarAktifRoutes.js` — diimport server.js (kuatkuasakan sebenar)
  DAN `userAdminRoutes.js` (paparan status Direktori). Jangan sekali-kali salin senarai ni ke
  tempat ketiga; kalau perlu di tempat lain, import daripada `dasarAktifRoutes.js`.
- **`GET /api/system/users`** kini sertakan `tertaklukDasarAktif`/`hariTakAktif`/`tahapAmaran` per
  anggota (basis pengiraan SAMA PERSIS `runSemakanTakAktif()` — `lastPublishedAt` jatuh balik
  `createdAt`) supaya Direktori boleh papar status SEBELUM gantungan berlaku, bukan cuma lepas
  fakta. Kalau tukar basis pengiraan di server.js, WAJIB tukar sama di userAdminRoutes.js juga
  (dua tempat, satu neraca — lihat komen kod di kedua-dua fail).
- **UI**: `DirektoriConsole.tsx`, panel accordion tertutup lalai (Pentadbir sahaja) di atas jadual
  anggota, + lajur "Tak Aktif" (hari + lencana tahap amaran) dalam jadual. Pengesahan: tempoh
  mesti menaik (amaran pertama < amaran kedua < gantung automatik), kalau tidak eskalasi tiga-
  tahap jadi tak bermakna.

### Simpan Pukal — sebab kegagalan SEBENAR kini dipaparkan (2026-08-16)
Izzat: "kenapa tak boleh padam?...dia kata gagal simpan" — cuba padam satu perenggan huraian
panjang (nota meta/epistemik yang dibaiki sesi lepas) dalam kotak teks pukal `ContentReview.tsx`,
klik "Simpan Pukal", dapat "Gagal: 1 kandungan tidak dapat disimpan. Sila cuba semula." — tiada
petunjuk SEBAB. Punca: `saveBulk()` (`ContentReview.tsx`) buang ralat pelayan SENYAP —
`if (!res.ok) throw new Error()` (KOSONG, tiada mesej), `catch { failed++; }` cuma kira bilangan.
Pelayan (`contentRoutes.js` PATCH `/content/:id`) SEBENARNYA hantar `{ error: '...' }` sebab
tepat (cth had minimum huraian panjang, Bidang tak sepadan slot, dsb — lihat rantaian semakan di
situ), tapi klien tak pernah baca/papar ia. **Dibaiki**: baca `data.error` daripada respons
sebenar, papar terus ditanda `#Slot-Siri` blok yang gagal (bukan cuma "1 kandungan gagal").
**Peraturan am**: mana-mana laluan yang panggil `fetch()` dan `throw new Error()` KOSONG bila
`!res.ok` MESTI baca `error` sebenar daripada `res.json()` dahulu — corak `throw new Error()`
tanpa mesej ialah bendera merah, cari dan baiki bila ternampak semasa kerja lain.

### Semakan Kandungan — tapisan lalai: Aktif, semua slot KECUALI Ticker (2026-08-16)
Izzat: "jadikan tapisan default: aktif, semua selain ticker" — `ContentReview.tsx` dahulu buka
dengan `statusFilter='Semua'`/`slotFilter='Semua'`, jadi paparan pertama borang "Semakan
Kandungan" bercampur draf/menunggu/arkib/Ticker sekali gus, tak sepadan tujuan sebenar (semak
kandungan AKTIF sedia ada; Ticker terlalu kerap berubah/banyak untuk semakan pukal macam ni).
Lalai kini `statusFilter='approved'` (Aktif), `slotFilter='SemuaBukanTicker'` (nilai sentinel
baharu, slotIndex -1 = Ticker dikecualikan). **"Semua Slot (termasuk Ticker)" KEKAL wujud** sebagai
pilihan eksplisit dalam dropdown — editor boleh tukar bila-bila kalau memang nak semak Ticker,
cuma bukan lagi paparan PERTAMA yang dilihat. `slotIndexes`/kiraan ringkasan atas ("N daripada M
item · K slot lepas tapisan") terbit daripada `filteredItems`, jadi ikut lalai baharu secara
automatik tanpa perlu ubah kod berasingan.

### "Bahasa Kandungan" → "Bahasa Sumber" + gerbang Had usia sumber terlepas mod jurnal (2026-08-16)
Izzat tangkap dua isu lagi pada UI Mod Janaan (screenshot): (1) "Had usia sumber" masih terpapar
dalam mod "Artikel Jurnal" — gerbang lama (`SlotManagerModal.tsx`) cuma semak
`genMode !== 'dengan_rujukan'`, TERLEPAS `'artikel_jurnal'` bila mod tu ditambah sesi lepas
(Negara asal sumber betul sejak awal, Had usia sumber tak diselaraskan sama). Dibaiki — gerbang
SAMA (`!== 'dengan_rujukan' && !== 'artikel_jurnal'`) untuk KEDUA-DUA medan.

(2) Soalan: "apa fungsi tulis 'bahasa kandungan' untuk 'bebas'? bukan ke bahasa kandungan dah
confirm2 dlm bahasa melayu?" — betul, `[Peranan AI]` SUDAH kunci output Bahasa Melayu hardcode,
medan `aiPromptLanguage` sebenarnya tak pernah kawal bahasa OUTPUT (vestigial). Dinamakan semula
**"Bahasa Sumber"** — sekarang genuine panduan bahasa AI patut CARI sumber (relevan HANYA mod
"Bebas", disembunyikan utk Dengan Rujukan/Artikel Jurnal — sumber dah tetap, soalan tu dah tak
bermakna, sama gerbang `isSingleSourceMode`). Lalai ditukar `'Bahasa Melayu'` → `'Bebas'` (tiada
had bahasa sumber, `useSlotEditor.ts`). Prompt output diperkukuh eksplisit: "Kandungan akhir MESTI
ditulis dalam Bahasa Melayu — ini tidak berubah tidak kira bahasa sumber/rujukan". **Jangan
sekali-kali biarkan medan UI kawal sesuatu yang SUDAH dikunci hardcode di tempat lain** —
mengelirukan editor (nampak macam boleh diubah, sebenarnya tidak).

### Gaya bahasa AI — Melayu penerbitan, bukan terjemahan manual perisian (2026-08-16)
Izzat: "bahasa melayu claude terlalu teruk... macam terjemahan dokumentasi perisian." Dua tempat
dibaiki (audit ChatGPT beri wording pengganti konkrit): (1) Teks bantuan UI mod "Dengan Artikel
Jurnal" (`SlotManagerModal.tsx`) ditulis semula — "lampirkan"→"muat naik", "bahan PDF"→"artikel
tersebut", "kandungan yang dijana"→"hasil tersebut", nada lebih dekat gaya penerbitan bukan manual
teknikal. (2) Arahan GLOBAL baharu ditambah `[Peranan AI]` (buildAiPrompt()) — "Gunakan Bahasa
Melayu penerbitan yang natural dan profesional. Elakkan terjemahan langsung daripada istilah
teknikal Bahasa Inggeris, gunakan ungkapan yang lazim digunakan dalam penulisan editorial, BUKAN
gaya manual perisian." — terpakai pada SEMUA kandungan dijana AI, bukan cuma halaman ni.

### Sumber rujukan AI mesti reset setiap kali borang dibuka — bukan dasar slot (2026-08-16)
Izzat tangkap DUA pepijat berkait dalam sesi yang sama, punca sama: `aiPromptSource` (medan
DB/formConfig LAMA) dikongsi antara sub-mod "Pautan" (JSON berstruktur, `serializeReferenceSources`)
DAN sub-mod "Artikel Jurnal" (teks mentah nama jurnal) yang saya tambah sesi ni — dua bentuk data
tak serasi berkongsi SATU medan. (1) Tukar sub-mod Pautan→Artikel Jurnal dalam SATU sesi borang:
JSON mentah `[{"name":"The Star","url":"..."}]` bocor terus ke medan "Nama Jurnal" teks. (2) Tutup
modal, buka semula (slot SAMA ATAU lain): sumber rujukan artikel LAMA (khusus untuk SATU draf,
bukan dasar slot) muncul semula sebab `useSlotEditor.ts` baca `config?.aiPromptSource` dari
slot config TERSIMPAN (server, `slotsConfigRoutes.js`) — corak SAMA macam `aiPromptRecency`/
`aiPromptRegion`/`aiPromptLanguage`, yang MEMANG patut berterusan sebagai dasar slot, tapi sumber
rujukan BUKAN dasar — ia input SATU-KALI untuk SATU artikel tertentu.

**Dibaiki**: (a) medan BERASINGAN sepenuhnya — `aiPromptSource` (Pautan, JSON) dan
`aiPromptJournalName` (Artikel Jurnal, teks) — tukar sub-mod TAK LAGI bertindih walau berapa kali
dalam sesi sama. (b) `useSlotEditor.ts` `openSlotEditor()` SENGAJA TAK baca kedua-dua medan ni
daripada `config` — sentiasa mula `''` kosong setiap kali borang dibuka, tak kira apa disimpan di
server sebelum ni. **Peraturan am**: medan `aiPrompt*` yang mewakili INPUT SATU-KALI (sumber/URL/
nama jurnal artikel tertentu) MESTI reset setiap buka borang; medan yang mewakili DASAR/KEUTAMAAN
berterusan (bahasa, wilayah, kebaruan, had aksara) BOLEH terus baca daripada config tersimpan.
Jangan letak dua jenis medan ni dalam kumpulan yang sama tanpa fikir mana patut berterusan.

### Arahan AI — larang nota meta/epistemik dalam kandungan (2026-08-16)
Izzat tangkap artikel AI sebenar terbit dengan ayat gaya "Walau bagaimanapun, maklumat sumber
yang tersedia tidak memperincikan hasil perbincangan, keputusan dasar atau teknologi tertentu
yang dibentangkan..." — bunyi macam nota audit/laporan kepada penyelia, BUKAN penulisan portal.
Audit ChatGPT kesan punca tepat: dua baris `buildAiPrompt()` (`SlotManagerModal.tsx`) SECARA TAK
SENGAJA mengarah AI tulis tentang HAD PENGETAHUAN DIRINYA SENDIRI terus ke dalam kandungan:
`[Peranan AI]` ("...nyatakan keterbatasan tersebut") dan `[Rujukan sumber wajib]` ("...nyatakan
keterbatasan itu dalam Huraian panjang"). Kedua-dua dibaiki — prinsip baharu (kata ChatGPT):
**"AI perlu berdiam diri tentang batas pengetahuannya dan hanya menulis apa yang sumber
menyokong"**, BUKAN "AI perlu memberitahu pembaca bahawa dia tidak tahu". Larangan eksplisit
ditambah `[Fungsi huraian panjang]` (contoh salah disenaraikan terus dalam prompt supaya AI ada
rujukan konkrit apa yang dielakkan). Arahan anti-hallucination ASAL (jangan reka fakta/andaian)
KEKAL tak berubah — cuma cara AI patut BERTINDAK bila maklumat tak cukup yang ditukar: DIAM
(jangan sebut fakta tu) bukan MENGAKU (tulis nota keterbatasan). Kesan pada SEMUA mod
"Dengan rujukan"/"Dengan Artikel Jurnal" (bukan hanya artikel yang ditangkap tu) — fix di
prompt, bukan edit artikel lepas fakta, sebab punca sama akan berulang pada kandungan seterusnya.

### Had aksara: kandungan sedia ada dikecualikan + kad carousel tak mengembang (2026-08-16, Izzat)
Tiga pepijat dilaporkan serentak selepas Izzat ketatkan had aksara.

- **Mesej "Kandungan tidak disiarkan" PALSU pada laluan sunting.** `ContentBudget.js` (modul
  pengesahan TULEN) dahulu menyatakan AKIBAT dalam `reason`, sedangkan ia dipanggil dari laluan
  yang akibatnya BERTENTANGAN: laluan Terbit (`server.js syncManualObjectsForSlot` — memang tak
  disiarkan) DAN laluan sunting kandungan yang SUDAH terbit (`PATCH /content/:id` — kandungan lama
  TETAP hidup di halaman awam, cuma suntingan ditolak). **Peraturan: modul pengesahan nyatakan
  FAKTA sahaja, PEMANGGIL tambah ayat akibat.** Jangan pulangkan ayat akibat ke dalam
  `ContentBudget.js`.
- **Kandungan sedia ada DIKECUALIKAN daripada had yang DIKETATKAN kemudian** (keputusan Izzat:
  "kandungan yg dah terbit ... tak perlu patuh had aksara baru; hanya kandungan baharu yg perlu
  patuh"). Sebelum ni kandungan terperangkap kekal — sebarang suntingan (walau betulkan SATU
  ejaan) ditolak selamanya. **Ujian pengecualian: adakah kandungan TERSIMPAN (sebelum suntingan)
  sudah pun gagal had SEMASA?** Ya → dikecualikan (diterbitkan bawah had lama, bukan salah
  editor). Tidak → kuat kuasa penuh (suntingan INI sendiri yang melimpahkan kad, patut disekat).
  Terpakai pada bajet kad, had minimum huraian panjang, dan had medan tambahan. Teruji
  `tests/hadDiketatkan.test.js`. **Gotcha**: `briefLong`/`source`/`topik`/`note` BUKAN lajur
  `editorial_revisions` — ia dalam `editorial_attribute_values`; `rev.briefLong` sentiasa
  `undefined` dan akan melumpuhkan pengecualian SECARA SENYAP tanpa sebarang ralat.
- **Kad carousel mengembang bila item lebih besar berputar masuk.** Puncanya BUKAN pada carousel —
  ia pada **lajur sumber di LUARnya**. Kunci tinggi `CarouselStableBlock` sah HANYA jika lebar
  lajur kandungan kekal sama sepanjang putaran (`minHeight` ialah LANTAI, tak pernah boleh halang
  kad MEMBESAR). Lajur sumber (`<a>` tepi kanan kad HERO/STANDARD) membaca `bentoNewsItems[n]`
  iaitu item AKTIF yang digabung, jadi nama sumbernya berubah setiap putaran; dengan
  `flex-shrink-0` + basis auto, lebarnya = lebar teks sumber aktif. Diukur pada laman SEBENAR:
  slot 2 = **245px** lawan **99px** pada slot STANDARD lain yang seni binanya serupa — putaran
  mencuri ~146px daripada lajur kandungan, teks membalut lebih tinggi, kad mengembang, dan
  `maxSeen` mengunci nilai besar tu selamanya. **Pembetulan: lajur sumber sisi berlebar TETAP
  (`md:w-28` STANDARD, `md:w-36` HERO) — ini SYARAT KETEPATAN kunci tinggi, bukan hiasan. JANGAN
  pulangkan kepada lebar-ikut-teks.** Disahkan hidup selepas deploy: tinggi kad slot 2 kekal
  205px merentasi SEMUA putaran (dahulu berubah-ubah).
- **Regresi `group` dipulihkan** — commit 343755a (penyeragaman BentoInner) tercicirkan kelas
  `group` daripada 8 slot (1, 2, 3, 6, 11, 12, 13, 14). Anak panah navigasi carousel di-portal ke
  kad dan guna `group-hover:opacity-100`, jadi anak panah mati pada kad tu. `group` kini ada pada
  KESEMUA 24 slot bento (sebelum regresi pun cuma 8/24 — jadi ni sekali gus menyeragamkan).

### Pratonton Kad — semua tier + betulan sempang keyboard Italic (2026-08-16, Izzat)
Pratonton Kad (modal Tulis Kandungan, `SlotManagerModal.tsx`) dahulu cuma tier KOMPAK ("bukti
konsep pertama", 2026-08-08). Izzat tanya "kenapa hanya sesetengah slot je ada preview?" —
disambung ke SEMUA tier bento (HERO, MENEGAK, STANDARD, SEGI_EMPAT_MEDIUM, SEGI_EMPAT_SMALL, BAR;
TICKER dikecualikan, diedit modal berasingan). Corak KOMPAK (komponen `XxxCardTeks.tsx` +
`XxxCardPreview.tsx` dicabut drpd `FrontpageView.tsx`, KONGSI sebenar bukan tiruan) diulang bagi
setiap tier — fail baharu di `src/components/portal/cards/`.

- **Boleh ditutup/dibuka** (togol `pratontonTerbuka`, `SlotManagerModal.tsx`) — permintaan Izzat
  eksplisit ("boleh ditutup dan dibuka sbb takut makan ruang"), lalai TERBUKA (kekal tingkah laku
  KOMPAK sedia ada).
- **Ketekalan tier dibetulkan serentak** (audit dedah semasa pengekstrakan, BUKAN kerja
  berasingan) — slot PERTAMA setiap tier (MENEGAK slot 1, STANDARD slot 2, SEGI_EMPAT_SMALL slot
  3) berbeza drpd slot lain dalam tier SAMA: guna `<BentoInner>` (jaring limpahan overflow +
  lencana AI automatik) + kadang warna hover berbeza, manakala slot lain guna `<div>` polos +
  tiru lencana AI manual (TANPA jaring limpahan — pepijat, bukan reka bentuk). SEGI_EMPAT_MEDIUM
  (4 slot) LANGSUNG tiada BentoInner pun sebelum ni. Diselaraskan: SEMUA slot setiap tier kini
  bungkus `<BentoInner>`; gaya teks (warna hover, saiz brief) ikut CORAK MAJORITI tier tu supaya
  rupa kandungan yg dah terbit paling minimum terjejas. **Pengecualian sengaja**: SEGI_EMPAT_SMALL
  slot 36 kekal skema warna kelabu berasingan (eyebrow `#D6D3D1`, hover `stone-300`) — nampak
  reka bentuk sengaja (semua sifat warna konsisten SESAMA sendiri), BUKAN pepijat separa macam
  outlier lain, jadi TIDAK diselaraskan; `SegiEmpatSmallCardTeks`/`Preview` terima `aksen`
  ('krem'/'kelabu') sebagai prop supaya kekal berasingan.
- **Warna aksen SEGI_EMPAT_MEDIUM/SEGI_EMPAT_SMALL bergantung kedudukan slot** (kiri/kanan
  pasangan) — dihantar sebagai STRING KELAS Tailwind literal (`hoverClassName`/`deskClassName`,
  bukan hex mentah digubah runtime) supaya imbasan JIT Tailwind tetap jumpa corak tu (imbasan
  regex teks fail, bukan sedar-JSX — hex mentah + `style` inline runtime TAKKAN pernah dijana
  dalam CSS terkompil, rosak senyap tanpa ralat build).
- **BAR** — `BarCard.tsx` sedia ada SUDAH satu komponen kongsi konsisten (tiada isu ketekalan),
  `BarCardPreview.tsx` cuma pembalut nipis; modal ni tiada medan Penganjur/Akses/Tarikh Tamat,
  pratonton guna fallback BarCard sendiri (Akses="Terbuka", label=nama Desk) sama seperti
  kandungan BAR sebenar yang belum lengkap.

**Ctrl/Cmd+I sekarang bungkus/nyahbungkus `*teks*`** (Izzat: "kenapa tak boleh italickan
perkataan dlm tajuk/huraian ... guna keyboard?") — medan Tajuk/Huraian ringkas/panjang
(`Field`, `SlotManagerModal.tsx`) ialah `<textarea>`/`<input>` HTML biasa, TIADA `onKeyDown`
langsung sebelum ni; format condong (`*teks*` -> `<em>`, `src/utils.tsx`) SUDAH wujud tapi
editor terpaksa taip asterisk sendiri, tiada petunjuk. Togol: sorot teks + Ctrl/Cmd+I bungkus;
sorot teks BERTANDA (dalam/merangkumi `*...*`) + Ctrl/Cmd+I nyahbungkus. Tiada sorotan = tiada
kesan (elak sisipan asterisk tunggal mengelirukan).

**Medan borang terima sebarang glif Unicode** (Izzat: transliterasi penuh perkataan Arab, cth.
"Ṣalāh", "ʿIlm") — disahkan medan input/textarea SUDAH terima sebarang glif secara asli (tiada
tapisan aksara di pelayan/client). Ditemui SATU bug berkaitan semasa siasatan: pemadanan istilah
Glosari dlm kandungan (`IstilahGlosari.tsx`) guna `\b` ASCII SAHAJA (`\w` = `[A-Za-z0-9_]`, tetap
ASCII walau bendera 'u' dihidupkan) — istilah bermula/berakhir huruf diakritik/pengubah LANGSUNG
tak dipadan (disahkan reproduce: sifar padanan). Digantikan lookaround Unicode
`(?<![\p{L}\p{N}\p{M}])(...)(?![\p{L}\p{N}\p{M}])` — disahkan padan betul selepas pembetulan.

### Glosari Berasaskan Bidang — Sense (2026-08-16, arahan Izzat, seni bina disahkan v3)
Glosari (`glosari_istilah`) dahulu SATU istilah = SATU `maksud` sejagat. Kini istilah boleh ada
BANYAK **Sense**: SATU Sense **am** (`amSense=1`, tiada Bidang) DAN/ATAU beberapa Sense
**khusus** (`amSense=0`, WAJIB >=1 Bidang setiap satu). Rujukan penuh: `docs/glossary-
architecture-proposal.md` (v3, disahkan Izzat selepas 2 pusingan pembetulan — BACA sebelum ubah
apa-apa bahagian ciri ni, seni bina sudah dikunci, jangan ubah keputusan tanpa arahan baharu).

- **Peraturan tooltip MUKTAMAD** (jangan sekali-kali ubah tanpa arahan eksplisit — ini dibetulkan
  DUA KALI oleh Izzat semasa reka bentuk): label `(Bidang)` HANYA dipaparkan bila Sense KHUSUS
  Bidang digunakan. Sense am DAN `maksud` fallback (lajur lama) KEDUA-DUANYA **TIADA** label —
  "Intervensi: (Sukan) ..." (khusus) lawan "Intervensi: ..." (am/lama, TIADA "(Bidang)").
  Resolusi: Sense khusus sepadan Bidang kandungan > Sense am > `maksud` lama > tiada tooltip.
- **Resolusi berlaku CLIENT-SIDE** (`core/editorial/GlosariResolusi.js`, fungsi TULEN, diimport
  `IstilahGlosari.tsx` — corak SAMA seperti `ContentBudget.js`/`GeometryConfig.js` diimport
  `SlotManagerModal.tsx`). Pelayan (`glosariRoutes.js`) cuma hantar peta PENUH sekali (`GET
  /glosari`, senses+Bidang bersarang, DUA query pukal — elak N+1), setiap artikel (`FocusView.tsx`,
  hantar `desk`) resolve sendiri ikut Bidangnya semasa render.
- **Kunci resolusi Bidang ialah `slug`, BUKAN `name`** — `CategoryRegistry.name` TIADA kekangan
  unik (disahkan audit kod sebenar), `slug` SATU-SATUNYA lajur benar-benar unik. `slugBidang()`
  (`GlosariResolusi.js`) cermin `CategoryRegistry.getSlug()` — **gotcha**: nama kosong → `'umum'`
  (bukan rentetan kosong), jadi semak kosong DAHULU sebelum panggil, jangan bergantung fallback
  dalaman fungsi tu untuk kes "tiada Bidang" (Ticker, dsb.) — teruji `tests/glosariResolusi.test.js`.
- **Invariant**: maksimum SATU Sense am setiap istilah dikuatkuasakan **PERINGKAT DB** (unique
  index separa SQLite, `WHERE amSense = 1` — disahkan hidup, INSERT kedua ditolak
  `SQLITE_CONSTRAINT`). Invariant lain (Sense am tiada Bidang, Sense khusus >=1 Bidang, satu
  Bidang tak boleh dua Sense khusus bagi istilah sama) di peringkat aplikasi (`glosariRoutes.js`,
  fungsi `sahkanInvariantSense`), transaksi atomik (BEGIN/COMMIT/ROLLBACK, corak sama
  `contentRoutes.js`).
- **`ON DELETE CASCADE`** (padam istilah/Sense → padam Sense/perkaitan Bidang berkaitan serentak)
  — corak SEDIA ADA konsisten dalam skema ni (`editorial_objects→editorial_revisions`, dll.),
  `PRAGMA foreign_keys = ON` aktif. Disahkan hidup (Sense dipadam, baris `glosari_sense_bidang`
  ikut serta automatik). `DELETE /glosari/:id` dan `DELETE /glosari/sense/:senseId` TAK perlu
  DELETE tambahan manual.
- **Additive sepenuhnya** — `glosari_istilah` TAK diubah skema (sifar `ALTER TABLE`), 93+ istilah
  sedia ada terus berfungsi (fallback `maksud`, laluan kod SAMA yang sudah berjalan).
- **UI editorial** (`EditorialConsole.tsx`, tab Glosari) — butang "Urus Sense" per istilah buka
  panel: senarai Sense + borang tambah/sunting dengan togol "Am"/"Khusus Bidang" (penerangan
  pendek WAJIB di bawah togol, permintaan Izzat eksplisit) + pemilih Bidang berbilang (`GET
  /categories/active` sedia ada, tiada endpoint baharu). Editor TAK PERNAH pilih Sense manual
  pada kemunculan istilah — automatik sepenuhnya di pembaca.

### Dasar Aktif Editorial — muat semula LIVE, bukan cache boot (2026-08-16, pembetulan susulan)
Selepas deploy ciri tempoh-boleh-laras (seksyen di atas), log pengeluaran sebenar dedah:
`loadDasarAktifSettings(dbGet)` semasa boot **berlumba kalah** lawan CREATE TABLE async (jadual
`dasar_aktif_editorial` BAHARU, tak macam `slot_am_settings` yang dah wujud lama pada fail DB
sebenar — jadi race yang SAMA corak tak pernah terdedah untuk jadual lama). Kesan: cache
dalam-memori jatuh balik ke lalai (7/14/21) SETIAP boot pelayan, walau Pentadbir dah simpan
tempoh custom — `getDasarAktifAmbangMs()` (dibaca `runSemakanTakAktif()`) baca cache STALE ni
terus tanpa muat semula, hanya "betul semula" secara tak sengaja bila seseorang buka panel
Direktori dan simpan (POST muat semula cache). **Dibaiki**: `runSemakanTakAktif()` kini panggil
`await loadDasarAktifSettings(dbGet)` SEGAR pada SETIAP jalanan (sekali sehari, kos boleh
diabaikan) sebelum baca ambang — jamin nombor SENTIASA terkini drpd DB sebenar tak kira apa
jadi semasa boot. **Peraturan am**: mana-mana job berjadual (`setInterval`) yang baca tetapan
boleh-laras MESTI muat semula segar pada setiap jalanan, JANGAN percaya cache dimuat sekali
semasa boot — boot-time preload cuma optimistik/best-effort, bukan jaminan.

### Text editorial mesti boleh disalin pembaca — `select-none` bekas akar (2026-08-16)
Izzat tanya "kenapa tak boleh copy, highlight teks di kad?" — `select-none` wujud pada BEKAS AKAR
seluruh `FrontpageView.tsx` (`<div className="...select-none animate-fade-in">`, bekas terluar
merangkumi SEMUA kad bento), menghalang seleksi/salin SEMUA teks kandungan editorial (tajuk,
huraian, huraian panjang) — bukan cuma kawalan hiasan. Disahkan `git log -S` — wujud sejak SATU
komit import pukal awal (v2.1/v2.2), TIADA komen/rasional didokumentasikan, tiada rujukan
CLAUDE.md — leftover boilerplate templat carousel/drag (elak seleksi tak sengaja semasa leret),
BUKAN keputusan editorial Izzat. Dibuang daripada bekas akar. Elemen HIASAN (badge tarikh siaran,
anak panah carousel, logo transisi, dsb.) semuanya SUDAH ada `select-none` masing-masing di setiap
tapak — buang `select-none` akar TIDAK menjejaskan elemen hiasan tu langsung. **Peraturan am**:
`select-none` kena letak pada elemen HIASAN spesifik, jangan sekali-kali pada bekas yang
merangkumi teks editorial sebenar.

### Peti Makluman — kontrak UX pusat makluman (2026-08-16)
Ditulis selepas Izzat melaporkan kekecewaan sebenar kat ChatGPT: buka Peti Makluman selepas
nampak lencana bell, tapi tab yang terbuka (Editorial, hardcoded) papar mesej LAMA — mesej
baharu sebenar duduk di tab Sistem, kena klik sendiri baru jumpa. "Lencana bell janji ada
sesuatu baharu, tapi tab default tak bawa terus ke situ" (audit ChatGPT). Peraturan yang
mesti dipegang bila ubah/tambah apa-apa pada `MaklumanDrawer.tsx` atau laluan notifikasi:

- **Lencana = janji.** Bila editor klik loceng, langkah SETERUSNYA (tab yang terbuka) MESTI
  bawa terus ke punca lencana tu — bukan tab lalai tetap. Kira tab awal ikut **kesegaran**
  (unread TERBAHARU, bandingkan `createdAt`), bukan kuantiti — satu notifikasi Sistem sejam
  lepas lebih penting drpd tiga notifikasi Editorial semalam.
- **Sistem vs Editorial ialah DUA kategori berbeza**, bukan satu senarai dipecah kosmetik —
  kegagalan infrastruktur (RSS/cuaca/pautan mati) tidak memerlukan tindakan editor peribadi,
  tindakan editorial (kandungan disiar/ditolak) memang perlu. Jangan gabung semula jadi satu
  tab tunggal.
- **Notifikasi BUKAN rekod tindakan sendiri** — actor yang buat sesuatu (terbit/tolak) tak
  perlu dinotify pasal tindakan dia sendiri (toast dah cukup); lihat suppression di
  `contentRoutes.js`. Notifikasi untuk memberitahu ORANG LAIN.
- Bila tambah `kumpul: true` (agregat kegagalan berulang, `Notify.js`), ingat SELECT-then-
  write TOCTOU-prone di bawah beban serentak — guna kunci per-kekunci (`denganKunciNotifikasi`)
  atau corak setara, jangan andaikan panggilan berurutan sahaja akan pernah berlaku.

## Bila teragak-agak

Kalau perubahan melibatkan kandungan editorial sebenar (bukan kod), UI/UX yang belum
jelas skopnya, atau operasi destructive pada data — tanya dulu, jangan teka dan jalankan
terus. Pemilik projek lebih suka proses lambat sikit tapi betul, berbanding pantas tapi
tersasar.
