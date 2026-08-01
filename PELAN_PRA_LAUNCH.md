# Pelan Pelaksanaan Pra-Launch — Adjung Brief

Ditetapkan 2026-08-01 (Izzat, Ketua Editor). Disemak selepas kritikan Antigravity, audit
keselamatan, dan **audit menyeluruh Fasa 0 (empat audit selari, siap 2026-08-01)**.
Matlamat: semua fungsi asas/standard portal siap dan boleh dikawal dalam Editorium
SEBELUM launch — "tak nak kena ubah banyak benda selepas launch nanti."

> Nota: folder `specification/` menerangkan produk LAIN (Folio/Biography) — pelan ini
> sahaja rujukan pelaksanaan untuk Adjung Brief.

---

## Keputusan sedia dibuat

- **Paparan Utama (dashboard)**: item pertama sidebar, di atas kumpulan Penerbitan,
  destinasi lalai selepas log masuk.
- **Jejak pengunjung**: dibina sendiri — tiada pihak ketiga, tiada cookie; kiraan harian
  sahaja dalam `adjung.db`.
- Kumpulan sidebar ketiga bernama **"Rujukan"** (dulu "Sistem").

## Cara membaca anggaran

Hari = hari kerja penuh, anggaran kasar. `S` ≤1 hari · `M` 2–3 hari · `L` 4–6 hari ·
`XL` perlu dipecah dahulu. **Jumlah kasar selepas Fasa 0: ~55–70 hari kerja.**

---

## Graf kebergantungan

```
Fasa 0 (audit) ✔ ────────────────────────────► selesai — skop semua fasa di bawah dikunci
Fasa 1 (keselamatan) ─┬──────────────────────► PENGHALANG LAUNCH mutlak
                      └─► Fasa 3 (Direktori) perlukan akaun & peranan sebenar
Fasa 2 (pepijat kritikal + hutang ujian) ────► awal, bebas — boleh selari dengan Fasa 1
Fasa 3 (Direktori) ──► Fasa 4 (Log Sistem) perlu tahu siapa buat apa
Fasa 4 (Log Sistem) ──► Fasa 5 (Dashboard) panel keaktifan editor baca log yang sama
Fasa 6 (Tetapan) ────► Fasa 6b (Profil & Notifikasi) ────► Fasa 7 (Modul Khas & kawalan slot)
Fasa 6b notifikasi Sistem (RSS/API gagal) bergantung rekod kesihatan Fasa 4 (Log Sistem)
Fasa 8 (Editorial) ── bebas; skop kini ditetapkan (lihat fasa)
Fasa 9–12 ───────────► Fasa 13 (reka bentuk) selepas UI stabil
Fasa 13 ─────────────► Fasa 14 (jejak pengunjung) ► Fasa 15 (prestasi) ► Fasa 16–17
```

---

## FASA

### [x] Fasa 0 — Audit kelengkapan menyeluruh · SIAP 2026-08-01
Empat audit selari dengan bukti `fail:baris`. Penemuan penuh dalam **Lampiran A** di
bawah. Kesimpulan satu ayat: *separuh penerbitan (validasi bajet, Bidang/Topik, arkib-
bukan-padam) dibina dengan teliti; separuh pengawasan (auth, sejarah, audit, penjadualan,
serentak) dan lapisan infrastruktur (deploy, ralat, backup) hampir tiada.*

---

### [~] Fasa 1 — Keselamatan & log masuk · `L` · ~6 hari · **PENGHALANG LAUNCH**
Bahagian teras siap 2026-08-02 (commit `d44796d`) — 13 senario diuji terus di server hidup
(bukan andaian): bocor password, akses tanpa sesi disekat, akses awam Frontpage kekal
terbuka, log masuk, sekatan peranan KETUA_EDITOR, logout, had jenis fail media. `npm test`
sama seperti garis dasar, tiada regresi.
- [x] Tutup: `GET /api/db-state` bocorkan lajur `password` — dibuang tanpa syarat
- [x] Middleware auth + semakan peranan di SETIAP laluan tulis API — gerbang diletak
      **per-laluan di dalam setiap fail router** (`router.post('/x', requireAuth, ...)`),
      BUKAN di `app.use()` mount — sebab sebenar: awalan `/api/system` dikongsi ~15 router
      berlainan, jadi gerbang di situ menyekat laluan LAIN yang berkongsi awalan sama,
      termasuk `/api/auth/login` sendiri (ditemui & dibetulkan semasa ujian langsung —
      lihat `core/middleware/auth.js` untuk nota penuh). GET/HEAD portal awam kekal terbuka
- [x] Token sesi sebenar di server (express-session, kuki httpOnly, `regenerate()` semasa
      log masuk untuk elak session fixation) + tempoh luput 12 jam
- [x] `POST /api/auth/reset-password` — kini KETUA_EDITOR sahaja (dahulu terbuka guna emel
      sahaja). **Belum token emel sebenar** — SMTP tiada infrastruktur; ini penyelesaian
      interim, token emel tinggal untuk kemudian (lihat item belum siap di bawah)
- [x] Had kadar log masuk — 10 percubaan/15 minit
- [x] `POST /api/media/upload` kini perlu sesi + had jenis fail (PNG/JPEG/WEBP/GIF/SVG
      ikut MIME sebenar, bukan nama fail pelanggan) + had 5MB
- [x] Pengendali ralat global Express + `uncaughtException`/`unhandledRejection` + penutupan
      bersih (`db.close()` semasa SIGTERM/SIGINT)
- [x] `PATCH /api/system/profile/:id` — hanya boleh sunting profil sendiri, kecuali
      KETUA_EDITOR (dahulu sesiapa boleh tulis profil MANA-MANA id)
- [x] Draf Saya (`GET /api/system/drafts`) kini perlu sesi sah untuk BACA, bukan sekadar
      tulis — draf belum terbit ialah kandungan dalaman
- [x] `PORT` kini boleh ikut `process.env.PORT` (persediaan Fasa 15)
- [ ] Buang lalai `password TEXT DEFAULT 'password'` + laluan kembali teks biasa (kolum
      DB masih ada lalai ni; tiada risiko baharu sebab tiada laluan INSERT manual selain
      seed, tapi masih patut dibersihkan)
- [ ] Jemputan editor baharu + token emel sebenar untuk set semula kata laluan — perlukan
      infrastruktur SMTP, belum ada
- [ ] Cipta akaun editor daripada UI (kini: INSERT ke DB dengan tangan sahaja — bersambung
      Fasa 3 Direktori)
- [ ] Ujian penjelakan peranan automatik (skrip ujian kekal, kini manual via curl) + ujian
      XSS/CSRF berstruktur
- [ ] Kuatkuasakan matriks RBAC dari Tetapan → Kawalan Akses di server (kini disimpan
      tetapi tidak dibaca — peraturan KETUA_EDITOR/EDITOR baharu di atas adalah HARDCODE
      per-laluan, BUKAN baca daripada matriks tersimpan itu; perlu keputusan reka bentuk
      sama ada matriks patut jadi sumber kebenaran sebenar atau dibuang)
- [ ] `SESSION_SECRET` tetap dalam `.env` sebelum deploy sebenar (kini rahsia rawak
      dijana setiap kali server bermula — semua sesi terputus setiap kali restart; amaran
      dipaparkan di log server sehingga ditetapkan)

### [x] Fasa 2 — Pepijat kritikal sedia ada + hutang ujian · SIAP 2026-08-02 (commit `9fabbf9`)
Semua ditemui Fasa 0, semuanya menjejaskan data sebenar. `npm test` 84/84 lulus (garis
dasar bersih pertama kali — dahulu 82/84).
- [x] **Simpan slot BAR memadam terbitan secara kekal** — dahulu `DELETE FROM
      editorial_objects` + CASCADE memusnahkan revisi setiap kali SATU item diedit. Kini
      item sedia ada di-UPDATE di tempat (id + sejarah kekal), item baharu sahaja dicipta
      segar. "Terbitan tak boleh padam" tak lagi dipintas oleh butang simpan biasa
- [x] **URL RSS tercantas** — pembersih boilerplate prosa (buang nama penerbit di hujung
      ayat) tersalah guna atas URL, memakan hostname `bernama.com`/`kosmo.com.my`. URL/GUID
      kini guna `sanitizeUrlText` baharu (nyahkod entiti sahaja), bukan `sanitizeHtmlText`
- [x] Ujian gagal #2 dibetulkan — nama decision `EditorialScoreEngine` bertukar ke
      `BLOCKED_KEYWORD`, ujian ketinggalan zaman (bukan pepijat kod)
- [x] **Dateline RSS tak terbuang** (ditemui semasa uji pembetulan URL) — `formatRssBrief`
      guna dua regex sendiri yang terlepas corak "LOKASI - " biasa; disatukan guna
      `stripLocationDateline` sedia ada
- [x] **Imej tak sampai ke Indeks/Semakan** — tambah fallback baca `attrs.image`
      (lampiran Focus View, atribut `imageUrl`/`image` ialah DUA konsep tulen berlainan,
      bukan salah eja — lihat nota FrontpageView.tsx)
- [x] **Simpan pukal Semakan silap sasaran** — dahulu dikunci ikut ordinal siri (`#Slot-
      Siri`), kini padan guna UUID (sudah dipaparkan dalam teks, cuma tak digunakan)
- [x] **Dua/tiga penulis satu ticker** — RSS Direct, AI Generated, Manual tulis-ganti
      `inTheNewsText` sesama sendiri. RSS Direct & AI Generated kini kekalkan blok mod
      satu sama lain (`gantiBlokModTicker`); Manual kekal tulis-ganti sengaja (override
      editorial eksplisit Ketua Editor — itu memang fungsi dia)
- [x] Enjin tipografi pelayan terima peraturan `enabled=0` sebagai masih aktif (AND
      patut OR dalam syarat tapisan) — disamakan dengan logik client yang betul
- [x] `PRAGMA journal_mode = WAL` + `busy_timeout = 5000` ditambah
- [x] Skrip `clean` package.json tak lagi padam `adjung.db`
- [ ] Enjin `stripLocationDateline` masih diduplikasi (SourceSanitizer.js DAN
      EditorialTextNormalizer.js, byte-for-byte sama) — bukan pepijat aktif, tapi risiko
      hanyut kalau salah satu diubah tanpa yang lain. Belum disatukan (skop lebih besar
      daripada Fasa 2, sentuh sistem peraturan editorial berasingan)

### [x] Fasa 3 — Direktori hidup + RBAC 4-peranan berbilang · SIAP 2026-08-02 (commit `ec86338`)
**Skop berkembang besar daripada rancangan asal** — Izzat maklumkan peranan sebenar ADA
EMPAT (Pentadbir, Ketua Editor, Penolong/Timbalan Ketua Editor, Editor), satu akaun boleh
pegang BERBILANG peranan serentak (Izzat sendiri = Pentadbir + Ketua Editor), dan kebenaran
setiap peranan mesti boleh diubah melalui klik (bukan hardcode). Jadi Fasa 3 jadi reka
bentuk semula RBAC penuh, bukan sekadar Direktori.
- [x] Jadual `user_roles` (berbilang peranan) + migrasi akaun sedia ada; lajur `users.status`
      (Aktif/Cuti/Tidak Aktif/Ditamatkan) baharu
- [x] Jadual "Kawalan Akses" di Tetapan (wujud sejak 2026-07-29, tak pernah disambung) kini
      **sumber kebenaran sebenar** — `requirePermission()` baca terus, segar semula serta-merta
      selepas simpan, tiada perlu mulakan semula server (disahkan hidup: tanda kotak → simpan
      → kebenaran berkuat kuasa serta-merta, diuji dengan curl semasa UI masih terbuka)
- [x] 3 kunci kebenaran baharu: `manageEditorial` (Bidang/Editorial/RSS/Jam Dunia — Ketua
      Editor + Timbalan), `manageAccounts` (Direktori — Pentadbir sahaja), `manageEditorNotes`
      (Nota Ketua Editor — Ketua Editor sahaja)
- [x] Semua ~40 gerbang `requireRole('KETUA_EDITOR')` Fasa 1 digantikan `requirePermission(kunci)`
- [x] `staffList` dari jadual `users` sebenar; "+ Tambah Anggota" berfungsi penuh (borang →
      akaun sebenar); tukar peranan (berbilang, checkbox); tukar status — semua tersimpan DB
- [x] Direktori & Tetapan Sistem kini domain **Pentadbir sahaja** (dahulu Direktori terbuka
      semua log masuk, Tetapan Ketua-Editor-sahaja); Editorial kini Ketua Editor + Timbalan
- [x] Medan Direktori tanpa sumber data sebenar (skop desk per-anggota, "slot mandat" bebas
      teks, sejarah pergerakan timeline) **dibuang**, bukan disorok — kiraan kandungan
      diterbitkan pakai anggaran sebenar daripada atribut `editorName`
- [x] Akaun sebenar Izzat diberi peranan `pentadbir` tambahan secara manual (migrasi automatik
      cuma baca `role` lama satu nilai, tak tahu bilangan peranan sepatutnya — jalan buntu
      dielakkan: tanpa ini tiada siapa boleh sampai Direktori untuk lantik Pentadbir pertama)
- [x] Pepijat sebenar ditemui & dibetulkan semasa ujian: matriks tersimpan LAMA (2 baris, 8
      kunci) gagal gabung KUNCI baharu dalam baris sedia ada (cuma isi baris yang hilang) —
      Ketua Editor tersekat `manageEditorial`/`manageEditorNotes` walaupun lalai patut `true`.
      Dibetulkan client (`TetapanConsole.tsx`) dan server (`auth.js`) serentak
- [ ] Carta organisasi ringkas — **belum dibina**, ditangguh (bukan keutamaan, struktur
      4-peranan baharu sahaja belum stabil digunakan)
- [ ] `SenaraiSlotConsole.tsx` masih papar label peranan binari lama (KETUA_EDITOR/EDITOR)
      untuk penugasan editor→slot — kosmetik sahaja, bukan gerbang keselamatan, tak
      dikemas kini (skop rendah, boleh buat bila-bila)

Diuji PENUH di browser sebelum commit: log masuk 4 kombinasi peranan ujian (Pentadbir sahaja,
Ketua Editor sahaja, Timbalan sahaja, Editor sahaja), sahkan sidebar/nav ikut peranan betul,
Direktori papar data sebenar, tambah anggota sebenar, tukar peranan berbilang + status. `npm
test` 84/84, `tsc` bersih. Semua data ujian dibersihkan selepas.

### [x] Fasa 4 — Log Sistem · SIAP 2026-08-02 (commit `ec67c38`)
- [x] Jadual `audit_log` sebenar + `core/audit/AuditLog.js` (helper `logAudit()` kongsi)
- [x] Dicatat: status kandungan (terbit/tolak/arkib/siar-semula), tolak-ke-draf, padam
      ticker, cipta akaun + tukar peranan + tukar status (Direktori), Bidang (daftar/
      namakan semula/gabung/aktif/arkib), Nota Ketua Editor (cipta/padam), ralat ambilan
      RSS per-sumber (dahulu ditelan senyap — "Gracefully skip") + ringkasan setiap
      larian, ralat pelayan tak ditangkap (pengendali ralat global Fasa 1)
- [x] Paparan di Rujukan → Log Sistem — jadual sebenar (Masa/Pelaku/Tindakan/Sasaran/
      Butiran), label Melayu untuk setiap kod tindakan
- [ ] **Bukan audit 100% menyeluruh** — fokus pada tindakan editorial/pentadbiran paling
      bermakna (status kandungan, akaun, Bidang, Nota, RSS, ralat pelayan). Mutasi lain
      (cth `POST /content` penuh, tetapan sistem am, tier/slot-am) TIDAK direkod — boleh
      ditambah kemudian kalau perlu, bukan halangan launch
- [ ] Log Sistem tiada gerbang peranan khusus (mana-mana editor log masuk boleh baca
      jejak SEMUA orang) — sama seperti Panduan/Dokumentasi (destinasi rujukan terbuka).
      Keputusan reka bentuk kalau nak dikhususkan Pentadbir/Ketua Editor sahaja kemudian

### [x] Fasa 5 — Paparan Utama (dashboard) · SIAP 2026-08-02 (commit `fec841c`)
- [x] Status kandungan · draf saya · makluman terbaru · slot kosong/bermasalah
- [x] Status RSS & API cuaca (baca `audit_log` Fasa 4)
- [x] Keaktifan editor (kiraan ringkas drpd 200 log terkini)
- [x] Destinasi lalai selepas log masuk (kumpulan sidebar "Utama" baharu, di atas Penerbitan)
- [ ] Bilangan pengunjung & kandungan paling diminati — placeholder jujur, tunggu Fasa 14

### [ ] Fasa 6 — Tetapan & aliran kerja teras · `L` · ~5 hari
- [ ] Editor label & tooltip (UI atas `src/config/istilah.ts`)
- [x] Maklumat/halaman polisi (sumber untuk halaman awam Fasa 11) — ruang edit "Halaman
      Awam" di Tetapan (Tentang/Hubungi/Polisi & Penafian), guna `static_pages`+`/api/pages/:key`
      sedia ada
- [x] Hidupkan atau buang "Glos Selari" — disahkan ciri sebenar (interlinear gloss legasi
      Adjung Platform), disambung ke togol sebenar di Tetapan (`glosSelariEnabled`)
- [ ] **Auto-simpan / penjaga dirty pada modal tulis** — kini tutup modal = kerja hilang
      senyap; penjaga sedia ada cuma semak tajuk/huraian
- [x] **Kawalan serentak** — dua editor buka slot sama: simpan kedua memadam simpanan
      pertama tanpa amaran. Token `updatedAt` di `slots_config`, disemak sebelum tulis
      (409 + mesej Malay bila konflik); turut baiki `saveError` yang sebelum ni tak pernah
      terpapar langsung di modal
- [ ] **Sejarah versi sebenar** — kini `editorial_revisions` SENTIASA 1 baris (edit =
      UPDATE atas tempat, versi berkekalan 1.0); jadikan revisi terkumpul + UI lihat/
      pulih versi
- [x] Sebab penolakan — `Tolak` kini minta sebab (pilihan) via prompt, disuntik ke `Nota:`
      draf

### [~] Fasa 6b — Profil editor lengkap & sistem notifikasi sebenar · `M` · ~5 hari
Ditambah 2026-08-02 selepas semakan Izzat mendapati dua jurang: profil editor tak lengkap,
dan Peti Makluman cuma Nota Ketua Editor — bukan sistem notifikasi.

**Profil Editor** — DIPERMUDAH 2026-08-02 (commit `75c41d4`) sebelum kerja bermula: Izzat
"ni bukan medsos, hanya utk rujukan dalaman, kalau ada pun di kad/focus view, nama pena."
Avatar/tandatangan/bio **DIBUANG** (bukan skop, bukan sekadar belum dibina — disahkan
tak pernah terpapar di byline Focus View pun, itu guna atribut `editorName` kandungan,
bukan medan profil). Profil kini Nama Pena sahaja + baki di bawah:
- [ ] Tukar kata laluan sendiri — laluan backend `POST /api/auth/change-password` SUDAH
      wujud (Fasa 1) tapi TIADA UI langsung; tambah borang dalam `ProfilEditorModal.tsx`
- [ ] Tukar username sendiri — TIADA laluan, TIADA UI. Keputusan Izzat: editor boleh
      tukar sendiri, perlu pengesahan (kata laluan semasa, sama corak `change-password`);
      wajib semak keunikan username sebelum simpan
- [ ] Tukar emel sendiri — sama, TIADA laluan/UI. Pengesahan sama seperti username

**Peti Makluman → sistem notifikasi sebenar (kini: satu sumber sahaja, `editor_notes`):**
Keputusan Izzat: skop Kandungan + Sistem (bukan kandungan sahaja).
- [ ] Jadual `notifications` baharu — per-editor, status baca/belum baca (ganti kiraan
      global sedia ada yang kira SEMUA nota tanpa mengira siapa dah baca — lihat
      Lampiran A, "kiraan global bukan per-editor, tiada resit baca")
- [ ] Jenis Kandungan: kandungan disiar, kandungan ditolak (sertakan sebab daripada item
      di atas), penugasan slot baharu
- [ ] Jenis Sistem: ambilan RSS gagal (sambung ke rekod kesihatan Fasa 4 Log Sistem),
      API cuaca gagal, kata laluan sendiri ditukar, akaun digantung/diaktifkan semula
      (Ketua Editor sahaja terima notis akaun-lain; setiap editor terima notis akaun-sendiri)
- [ ] UI: lencana kiraan belum-baca per-editor (bukan jumlah semua nota macam sekarang),
      tanda-dibaca bila drawer dibuka atau item diklik
- [ ] Nota Ketua Editor (`editor_notes`) kekal sebagai SATU jenis dalam senarai gabungan
      ni, bukan digantikan — cuma bukan lagi satu-satunya sumber

### [ ] Fasa 7 — Modul Khas & kawalan slot · `L` · ~6 hari
Penemuan besar Fasa 0: satu-satunya jalan ubah Bidang/warna/selang carousel slot ialah
kebocoran mod edit dari pautan lama `?openTicker=1` di frontpage — bukan dari Editorium.
- [ ] Pintu masuk sah dalam Editorium untuk tetapan per-slot (Bidang, warna kad, selang/
      lengah carousel) — kini medan wujud di DB & dibaca frontpage, tiada UI sah
- [ ] Betulkan lajur "Animasi Transisi" Senarai Slot (kini papar selang carousel,
      bukan animasi — label mengelirukan)
- [ ] Buang atau sambungkan tetapan mati "Jenis animasi transisi" (kini ditulis ke DB,
      tak pernah dibaca sesiapa)
- [ ] Ticker: bawa kawalan ke Editorium (kini ~90% dalam modal frontpage) + UI kelajuan
      pusingan ticker (kini TIADA UI langsung, hanya edit DB)
- [ ] Jam Dunia: satukan kawalan sedia ada (kini tersorok di Tetapan → Operasi, kad
      Modul Khas kata "belum disambungkan" — mengelirukan); tarikh cuti sekolah berkod
      keras 2026/27 akan basi senyap — jadikan boleh edit
- [ ] Slot Bar: borang kandungan BAR dalam Editorium (medan Acara/Penganjur/Akses/
      Penerangan) — kini dikecualikan dari semua permukaan Editorium
- [ ] Focus View: tetapan animasi/mod turutan/had aksara (kini sifar tetapan di
      mana-mana)

### [ ] Fasa 8 — Editorial dilengkapkan · `M` · ~4 hari (skop disemak semula 2026-08-02)
**Perubahan strategi 2026-08-02 (arahan Ketua Editor):** saluran isian kandungan sah kini
HANYA tiga — Manual, API luar bukan-AI, RSS. Pipeline penjanaan AI automatik (EditorialPipeline.js)
DIMATIKAN (scheduler, commit `61be972`) — kod kekal wujud tapi tak dipanggil automatik lagi.
AI hanya dibenarkan sebagai alat bantu MANUAL dalam chatbox editor (belum dibina, bukan
skop pelan ni buat masa ini). Kesan: semua kerja mengukuhkan pipeline AI automatik
(pengesahan bajet kos sebelum panggil, model lalai, dsb) **digugurkan daripada fasa ni** —
tak berbaloi diperkukuh sesuatu yang sengaja tak dipanggil. Yang tinggal di bawah relevan
tanpa mengira AI:
- [ ] **Autocondong terpakai pada kad frontpage** — kini hanya tajuk ticker + sandbox;
      kad bento & Focus View langsung tak guna `TypographyRenderer` (keputusan reka
      bentuk: sahkan dengan Ketua Editor dulu)
- [ ] Limpahan teks: satu polisi seragam — RSS masih cantas senyap `...` pada 220 aksara
      (`formatRssBrief`) tanpa penolakan/amaran macam laluan Manual — ini melanggar
      perlembagaan (tiada pemotongan mekanikal senyap)
- [ ] **Gate manusia untuk RSS** — RSS berskor ≥80 terus siar (`AUTO_LIVE`) TANPA semakan
      manusia. KEPUTUSAN KETUA EDITOR: kekalkan auto-siar atau paksa semua ke Menunggu?
- [ ] Asingkan glosari daripada penyelarasan ejaan (kini satu jadual bergabung) — masih
      berguna sebagai rujukan pasif editor menulis manual, tanpa mengira AI
- [ ] Medan "tempoh minimum paparan" sebenar + buang rujukan palsu dalam `EditorialConsole.tsx`
      (kini kata ia wujud di Tetapan Am — medan tu tak wujud)

**Digugurkan/ditangguh (bukan lagi keutamaan pra-launch, memandangkan AI automatik
dimatikan):** 4 sub-templat semakan AI, suntik glosari ke prompt AI, semakan bajet kos AI
sebelum panggil, baiki model lalai AI (`gemini-3.5-flash`), "Semak Sambungan" AI jujur.
Semua ni kekal sebagai kerja masa depan KALAU/BILA ciri chatbox AI manual dibina — jangan
mula sebelum ciri tu sendiri diarahkan.

### [ ] Fasa 8b — Format sumber · `L` · ~5 hari
Enjin petikan berstruktur (penulis/penerbit/tarikh/jenis), validasi URL, semakan pautan
mati. Sedia ada: medan bebas + auto-kesan jenis sahaja. Boleh tangguh pasca-launch —
keputusan pemilik projek.

---

### [ ] Fasa 9 — SEO & penemuan · `M` · ~3 hari
Fasa 0 sahkan: portal ini **halimunan kepada enjin carian & pratonton sosial** (SPA tanpa
SSR, tiada meta description, tiada OG tags, `lang="en"` pada portal Melayu!).
- [ ] `lang="ms"` + meta description + OG/Twitter tags + JSON-LD NewsArticle
- [ ] Tajuk/meta dinamik per kandungan · favicon semak · `sitemap.xml` · `robots.txt`
- [ ] Prarender/SSR ringan untuk crawler — siasat pilihan paling ringkas

### [ ] Fasa 10 — Suapan RSS keluar · `S` · ~1 hari

### [ ] Fasa 11 — Halaman awam · `M` · ~3 hari
- [ ] 404 bergaya Adjung (kini URL salah = halaman kosong; laluan `*` tiada)
- [ ] Tentang / Hubungi / Polisi & Penafian (kandungan dari Fasa 6)
- [ ] Perkongsian sosial — **tanya dahulu** · Carian pengunjung — **tanya dahulu**

### [ ] Fasa 12 — Halaman Penaja · `M` · ~3 hari
Konsol urus + halaman awam. Reka bentuk & penempatan — **keputusan Ketua Editor**;
jangan sentuh grid bento.

### [ ] Fasa 13 — Penghalusan reka bentuk Editorium · `L` · ~5 hari
Audit visual setiap skrin vs bahasa frontpage; keadaan kosong/memuat/ralat konsisten;
telefon/tablet.

### [ ] Fasa 14 — Jejak pengunjung & populariti · `M` · ~3 hari

### [ ] Fasa 15 — Prestasi & kesediaan produksi · `M` · ~3 hari
- [ ] **Laluan serve produksi** — kini TIADA: tiada skrip `start`, Express tak hidangkan
      `dist/` mahupun `/uploads`, port berkod keras 5000. Perlu: `PORT` dari env,
      `express.static`, fallback SPA, skrip mula, pengurus proses
- [ ] `db-state` god-endpoint: kini menyekat sehingga 15s pada 3 ambilan Google Doc
      setiap panggilan — cache
- [ ] Masa muat frontpage 38 slot · masa API di bawah beban · saiz bundle
- [ ] Backup automatik `adjung.db` berjadual + keluarkan ~35 MB backup manual dari
      pokok kerja
- [ ] Namakan semula pakej `react-example` → nama sebenar

### [ ] Fasa 16 — Panduan & Dokumentasi · `S` · ~1 hari

### [ ] Fasa 17 — Ujian menyeluruh & deploy · `M` · ~3 hari
Setiap modul · dua peranan · dua saiz skrin · ujian & tsc bersih · bersih data ujian ·
backup · deploy · sahkan pasca-deploy.

---

## Peraturan kerja

1. Setiap fasa: bina → sahkan visual di browser sebenar → uji → commit + push → tanda `[x]`.
2. Keputusan UI/estetika/label: arahan/kelulusan Ketua Editor, bukan direka sendiri.
3. Operasi destruktif pada data: backup `adjung.db` dahulu.
4. Mesej commit: Bahasa Melayu, `jenis(skop): penerangan`.
5. Sebelum tanda `[x]`: `npx tsc --noEmit` bersih + `npm test` tiada kegagalan baharu.
6. Rollback: satu fasa satu commit; deploy gagal → revert + pulih backup.
7. Skop membengkak ≥2× anggaran: berhenti dan lapor.

---

## Lampiran A — Penemuan Audit Fasa 0 (2026-08-01, ringkasan)

**Kitaran hayat kandungan.** Tiada auto-simpan/penjaga dirty (tutup modal = kerja hilang).
Sejarah versi tak wujud dalam kelakuan — semua insert `version 1.0`, edit = UPDATE atas
tempat, teks lama musnah. "Semakan Kandungan" = editor teks pukal, bukan aliran semakan;
mesin status tak kawal transisi (arkib→siar pun diterima). Tolak tanpa sebab. Tiada
jadual terbit/embargo/auto-luput (`expiresAt` = lajur mati). BAR: simpan biasa memadam
terbitan+revisi secara kekal. Atribusi: `Penulis` hilang ketika terbit, `editorName`
dibekal pelanggan (boleh dipalsukan) dan per-sesi bukan per-item. Serentak: last-write-
wins senyap atas `manualSummary`. Imej: pecah nama atribut `image`/`imageUrl`, tiada
pustaka media/alt/kredit. Tiada notis pembetulan ("berita ini dikemas kini"). Tiada
pratonton kad sebelum terbit — ironi terbesar untuk CMS bento-geometri.

**Tadbir urus & infra.** Peti Makluman: kiraan global bukan per-editor, tiada resit baca.
Direktori: kosong berkod keras, modal RBAC & tindakan sensitif = hiasan (state lokal).
Matriks RBAC Tetapan disimpan tapi tak dikuatkuasakan. Log: SIFAR — tiada jadual, tiada
tulis, `logs: []` berkod keras. Server: tiada pengendali ralat/log permintaan/rate limit/
CORS/graceful shutdown; SQLite tanpa WAL (simpan serentak gagal senyap). Tiada backup
automatik. Deploy: tiada skrip start/Docker/PM2, Express tak hidangkan frontend, port
berkod keras. SEO: `lang="en"`, tiada meta/OG/sitemap/robots, SPA halimunan kepada
crawler. Tiada 404.

**Slot & Modul Khas.** Senarai Slot = laporan baca-sahaja + 1 sel boleh edit (Editor);
lajur "Animasi Transisi" mislabel (papar selang). Tetapan per-slot (Bidang/warna/selang)
hanya boleh capai melalui kebocoran `?openTicker=1`. "Jenis animasi transisi" = tetapan
tulis-sahaja (frontpage berkod keras `opacity 1s`). Ticker: ~90% kawalan dalam modal
frontpage; kelajuan pusingan tiada UI langsung. Jam Dunia: 2 kawalan wujud (tersorok di
Tetapan→Operasi) tapi kad kata "belum disambungkan"; 15 bandar/cuaca/warna status/cuti
sekolah 2026-27 semuanya berkod keras. Slot Bar & Focus View: sifar kehadiran Editorium.
Siling tak boleh edit: briefLong, eyebrow, topik, penerangan (hanya tajuk/huraian dalam
Tier Kad).

**Editorial & AI.** Autocondong hanya pada tajuk ticker + sandbox — BUKAN kad frontpage;
enjin berganda client/server dengan perbezaan sebenar. Glosari pasif — tak dikuatkuasa,
tak disuntik ke prompt AI. `reviewPrompt` tergantung (disahkan). "Semak Sambungan" AI
palsu (kunci sampah pun "Connected"); lalai `gemini-3.5-flash` tak wujud. **AI terus
`approved` & RSS ≥80 terus siar — tiada gate manusia.** Limpahan: 3 kelakuan tak seragam,
RSS mencantas senyap (melanggar perlembagaan). URL RSS tercantas oleh pembersih (pepijat
produksi — Bernama/Kosmo). `blockedPenalty` tetapan mati. Tiada semak ejaan Melayu.
Tiada semakan bajet kos AI sebelum panggil. Dua penulis bertindih atas `inTheNewsText`.
