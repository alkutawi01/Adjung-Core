# Pelan Pelaksanaan Pra-Launch — Adjung Brief

Ditetapkan 2026-08-01 (Izzat, Ketua Editor). Disemak selepas kritikan Antigravity, audit
keselamatan, dan **audit menyeluruh Fasa 0 (empat audit selari, siap 2026-08-01)**.
Matlamat: semua fungsi asas/standard portal siap dan boleh dikawal dalam Editorium
SEBELUM launch — "tak nak kena ubah banyak benda selepas launch nanti."

> Nota: folder `specification/` menerangkan produk LAIN (Folio/Biography) — pelan ini
> sahaja rujukan pelaksanaan untuk Adjung Brief.

---

## KIV — tunggu Izzat (2026-08-02, sesi autonomi)

Izzat arah teruskan semua fasa tanpa henti; item di bawah **KIV** (bukan dilangkau
selama-lamanya) sebab perlukan keputusan/kelulusan yang cuma Izzat boleh buat:
- **Fasa 8b** (Format sumber) — Izzat sendiri dah tanda "boleh tangguh pasca-launch"
- **Fasa 11**: Perkongsian sosial, Carian pengunjung — pelan asal kata "tanya dahulu"
- **Fasa 12** (Halaman Penaja) — reka bentuk & penempatan perlukan keputusan Ketua Editor
- **Fasa 17**: langkah **deploy sebenar** & pengesahan pasca-deploy — tindakan tak boleh
  patah balik, kesan sistem produksi sebenar; SEMUA kerja persediaan (ujian, pembersihan,
  backup, semakan) akan disiapkan, cuma butang "deploy" sendiri ditahan
- Sebarang keputusan UI/UX/label baharu yang tak dapat diselesaikan dengan terus
  menggunapakai bahasa visual frontpage sedia ada

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

### [x] Fasa 1 — Keselamatan & log masuk · `L` · ~6 hari · **PENGHALANG LAUNCH** · SIAP 2026-08-03
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
- [x] Buang lalai `password TEXT DEFAULT 'password'` + laluan kembali teks biasa — disahkan
      SEMUA akaun sedia ada dah scrypt-hash, kedua-dua laluan cipta akaun (seed + POST
      /api/system/users) dah hash tanpa syarat, jadi laluan teks biasa mati kod dibuang
- [x] Jemputan editor baharu + token emel sebenar untuk set semula kata laluan — SIAP
      2026-08-03. Dua aliran dibina, kedua kongsi halaman awam
      `/tetapkan-kata-laluan?token=...` dan laluan `POST /api/auth/aktifkan-akaun`:
      (1) jemputan editor baharu — Pentadbir tak lagi menaip kata laluan awal terus
      (`POST /api/system/users` kini hantar emel token 48 jam); (2) lupa-kata-laluan
      swadaya — `POST /api/auth/lupa-kata-laluan` (token 2 jam, respons generik sama ada
      emel wujud atau tidak, had kadar 10/15 minit). `POST /api/auth/reset-password`
      (KETUA_EDITOR set terus untuk editor terkunci) KEKAL berasingan, tak dibuang.
      Token disahkan oleh `core/auth/TokenLaluan.js` (diuji `tests/tokenLaluan.test.js`:
      sah/tamat tempoh/sudah digunakan).
      **Infrastruktur emel — 3 pepijat sebenar ditemui & dibetulkan semasa uji hidup di
      produksi (bukan cuma ujian tempatan)**: (a) percubaan pertama guna SMTP Hostinger
      terus (`nodemailer`) — DigitalOcean SEKAT semua port SMTP keluar (465 DAN 587)
      secara lalai untuk Droplet baharu (dasar anti-spam), disahkan sambungan TCP mentah
      gagal terus kedua-dua port; ditukar sepenuhnya kepada **Resend** (API HTTPS, port
      443, elak sekatan SMTP terus) — domain `mail.adjung.com` sudah disahkan (verified)
      di Resend sedia ada; (b) selepas nginx reverse proxy diaktifkan, `express-rate-
      limit` tolak SEMUA permintaan (`ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`) — perlukan
      `app.set('trust proxy', 1)` supaya Express percaya header `X-Forwarded-For` nginx;
      (c) pautan dalam emel tertulis `http:///tetapkan-kata-laluan?...` (laluan RELATIF
      dihantar terus sebagai href, tiada origin untuk emel "sambung" kepadanya) —
      dibetulkan guna `${req.protocol}://${req.get('host')}` (corak sama
      `sitemapRoutes.js`). Disahkan hidup PENUH hujung-ke-hujung di produksi sebenar
      selepas ketiga-tiga pembetulan: emel sampai, pautan betul, set kata laluan
      berjaya, log masuk dengan kata laluan baharu berjaya
- [x] Cipta akaun editor daripada UI — nota ni jugak LAPUK: `DirektoriConsole.tsx` "Cipta
      Akaun" dah wujud, panggil `POST /api/system/users` (hash password, semak keunikan
      username/emel, wajib ≥satu peranan)
- [x] Ujian penjelakan peranan automatik (skrip ujian kekal) + ujian XSS/CSRF berstruktur —
      `tests/security.test.js` (Fasa 17, 2026-08-02): akaun EDITOR ujian sekali pakai cuba
      laluan `manageAccounts`-sahaja terhadap tika pelayan hidup sebenar (throwaway, bukan
      andaian kod) → 401 tanpa sesi, 403 dengan sesi EDITOR tanpa kebenaran; sahkan seni
      bina render kandungan (JSX/`safeParseInline`, bukan `dangerouslySetInnerHTML`)
      menghalang XSS; sahkan konfigurasi kuki sesi (httpOnly, sameSite=lax, secure ikut
      NODE_ENV) sepadan dokumentasi di atas. Bukan token CSRF baharu (skop tugasan)
- [x] Kuatkuasakan matriks RBAC dari Tetapan → Kawalan Akses di server — nota ni LAPUK,
      disahkan 2026-08-02: `requirePermission()` (`core/middleware/auth.js`) dah baca
      matriks SEBENAR daripada `system_settings.rolePermissions` (cache dalam-memori,
      disegar semula lepas simpan), dipakai di 9 fail router; tiada gerbang HARDCODE
      role tinggal
- [x] `SESSION_SECRET` tetap dalam `.env` sebelum deploy sebenar — SIAP 2026-08-02, `.env`
      produksi di Droplet ada nilai tetap dijana (`crypto.randomBytes(32)`), disahkan sesi
      kekal selepas beberapa kali `pm2 restart`

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
- [x] Bilangan pengunjung & kandungan paling diminati — data sebenar sejak Fasa 14 siap

### [x] Fasa 6 — Tetapan & aliran kerja teras · `L` · ~5 hari
- [x] Editor label & tooltip (UI atas `src/config/istilah.ts`) — skop akhir: kamus label
      boleh sunting (bukan tooltip, tak pernah disahkan dalam skop), jadual `ui_labels`
      baharu (`core/routes/uiLabelRoutes.js`), panel "5. Label Sistem" di
      `TetapanConsole.tsx` merangkumi Mod Kandungan/Status/Mesej Sistem terkurasi (8 mesej
      toast simpan/terbit/gagal), gantian dimuat ke browser via `src/config/labelOverrides.ts`
- [x] Maklumat/halaman polisi (sumber untuk halaman awam Fasa 11) — ruang edit "Halaman
      Awam" di Tetapan (Tentang/Hubungi/Polisi & Penafian), guna `static_pages`+`/api/pages/:key`
      sedia ada
- [x] Hidupkan atau buang "Glos Selari" — disahkan ciri sebenar (interlinear gloss legasi
      Adjung Platform), disambung ke togol sebenar di Tetapan (`glosSelariEnabled`)
- [x] **Auto-simpan / penjaga dirty pada modal tulis** — amaran (bukan auto-simpan senyap,
      lihat nota komit) kini merangkumi tutup modal (X) dan tutup/muat-semula tab pelayar,
      bukan cuma tukar slot sahaja
- [x] **Kawalan serentak** — dua editor buka slot sama: simpan kedua memadam simpanan
      pertama tanpa amaran. Token `updatedAt` di `slots_config`, disemak sebelum tulis
      (409 + mesej Malay bila konflik); turut baiki `saveError` yang sebelum ni tak pernah
      terpapar langsung di modal
- [x] **Sejarah versi sebenar** — edit (isBarUpdate slot Bar di `server.js`, PATCH
      `/api/system/content` di `contentRoutes.js`) kini INSERT baris revisi baharu
      (versi = max+1) bukan UPDATE di tempat; baris/atribut lama kekal sebagai sejarah.
      Laluan API baharu `GET .../revisions` (senarai versi) + `POST
      .../revisions/:id/restore` (pulih versi lama sebagai versi terkini baharu, lepasi
      semula budget/Bidang-Topik). Tab "Sejarah versi" baharu di `SlotManagerModal.tsx`
- [x] Sebab penolakan — `Tolak` kini minta sebab (pilihan) via prompt, disuntik ke `Nota:`
      draf

### [x] Fasa 6b — Profil editor lengkap & sistem notifikasi sebenar · `M` · ~5 hari · SIAP 2026-08-02
Ditambah 2026-08-02 selepas semakan Izzat mendapati dua jurang: profil editor tak lengkap,
dan Peti Makluman cuma Nota Ketua Editor — bukan sistem notifikasi. Kedua-dua bahagian siap
sama hari (commit `feat(profil-editor)`, `feat(notifikasi)`), diuji hidup di server dev sebenar
(akaun ujian sekali pakai, dibersihkan selepas), `npx tsc --noEmit` bersih, `npm test` 98/98
(tiada regresi).

**Profil Editor** — DIPERMUDAH 2026-08-02 (commit `75c41d4`) sebelum kerja bermula: Izzat
"ni bukan medsos, hanya utk rujukan dalaman, kalau ada pun di kad/focus view, nama pena."
Avatar/tandatangan/bio **DIBUANG** (bukan skop, bukan sekadar belum dibina — disahkan
tak pernah terpapar di byline Focus View pun, itu guna atribut `editorName` kandungan,
bukan medan profil). Profil kini Nama Pena sahaja + baki di bawah:
- [x] Tukar kata laluan sendiri — laluan backend `POST /api/auth/change-password` SUDAH
      wujud (Fasa 1) tapi TIADA UI langsung; borang ditambah dalam `ProfilEditorModal.tsx`
- [x] Tukar username sendiri — laluan baharu `POST /api/auth/change-username` (`requireAuth`,
      pengesahan kata laluan semasa, semak keunikan case-insensitive `LOWER(username) = ?`
      sama corak log masuk) + borang dalam `ProfilEditorModal.tsx`
- [x] Tukar emel sendiri — `POST /api/auth/change-email`, sama corak seperti username

**Peti Makluman → sistem notifikasi sebenar (kini: satu sumber sahaja, `editor_notes`):**
Keputusan Izzat: skop Kandungan + Sistem (bukan kandungan sahaja).
- [x] Jadual `notifications` baharu — per-editor, status baca/belum baca (ganti kiraan
      global sedia ada yang kira SEMUA nota tanpa mengira siapa dah baca — lihat
      Lampiran A, "kiraan global bukan per-editor, tiada resit baca"). Helper kongsi
      `core/notifications/Notify.js` (sejawat `AuditLog.js`)
- [x] Jenis Kandungan: kandungan disiar (`PATCH /content/:id` status->approved), kandungan
      ditolak + sebab (reuse sebab penolakan Fasa 6, `reject-to-draft`), penugasan slot
      baharu (`POST /slot-editors`, cuma editor BAHARU ditambah)
- [x] Jenis Sistem: ambilan RSS gagal (`slotRoutes.js`, sejawat log audit `ralat-ambilan-rss`
      sedia ada), API cuaca gagal (`systemRoutes.js`, dedup sejam elak banjir notis daripada
      poll klien), kata laluan sendiri ditukar (`authRoutes.js`), akaun digantung/diaktifkan
      semula (`userAdminRoutes.js` — pemilik akaun terima notis akaun-sendiri, Pentadbir/
      Ketua Editor lain terima notis akaun-lain)
- [x] UI: lencana kiraan belum-baca per-editor (`GET /notifications/unread-count`, bukan
      jumlah semua nota macam dulu), tanda-dibaca bila drawer dibuka atau item diklik
      (`POST /notifications/mark-read`)
- [x] Nota Ketua Editor (`editor_notes`) kekal sebagai SATU jenis dalam senarai gabungan
      di `MaklumanDrawer.tsx`, bukan digantikan — cuma bukan lagi satu-satunya sumber

### [ ] Fasa 7 — Modul Khas & kawalan slot · `L` · ~6 hari
Penemuan besar Fasa 0: satu-satunya jalan ubah Bidang/warna/selang carousel slot ialah
kebocoran mod edit dari pautan lama `?openTicker=1` di frontpage — bukan dari Editorium.
- [x] Pintu masuk sah dalam Editorium untuk tetapan per-slot (Bidang, warna kad, selang/
      lengah carousel) — panel "Tetapan Kad" baharu di Senarai Slot (Ketua Editor sahaja),
      borang lama FrontpageView.tsx SENGAJA tidak dibuka semula (turut ada medan sunting
      kandungan yang patut lalui SlotManagerModal Editorium sahaja)
- [x] Betulkan lajur "Animasi Transisi" Senarai Slot (kini papar selang carousel,
      bukan animasi — label mengelirukan) — ditukar ke "Carousel"
- [ ] **Jenis animasi transisi — bina sistem sebenar, BUKAN sekadar buang/sambung** (nota
      Izzat 2026-08-02, betulkan salah anggap sebelum ni): "Pudar" sekarang cuma SATU
      pilihan sebab itu sahaja wujud, bukan sebab reka bentuk akhir — Izzat nak lebih
      daripada satu JENIS animasi transisi kad (bukan sekadar carousel), dan setiap jenis
      mungkin ada tetapan sendiri (masa transisi, warna semasa transisi, saiz, dll) — bukan
      satu dropdown global datar. Perlu reka bentuk skema tetapan per-jenis dahulu (rujuk
      Izzat) sebelum bina
- [x] Ticker: UI kelajuan pusingan — medan "Kelajuan Pusingan Ticker" ditambah ke modal
      Urus Ticker sedia ada (guna formConfig/handleSaveSlot yang sama, tiada laluan baharu)
- [x] Ticker: bawa kawalan PENUH ke Editorium (2026-08-02) — `TickerManagementModal.tsx`
      kini render TERUS di Editorium (Modul Khas → Urus Ticker), logik simpan/muat
      dipindah ke `src/hooks/useTickerEditor.ts` (corak sama `useSlotEditor.ts`).
      Sambungan URL `?openTicker=1` lama DIBUANG terus (bukan dikekal sebagai fallback) —
      laluan native disahkan setara penuh (RSS Direct: sumber/status/review queue/tetapan
      editorial/kategori tersekat semua berfungsi; Manual: textarea kandungan sama; kelajuan
      pusingan sama) sebelum dibuang. Kesan sampingan disahkan: ini laluan TERAKHIR yang
      set `isEditMode=true` di FrontpageView.tsx — sistem suntingan inline lama (~114
      rujukan) kini sepenuhnya tak boleh dicapai daripada UI; pembersihan kod matinya
      sengaja digugurkan daripada skop ni (tugasan berasingan dicadangkan)
- [x] Jam Dunia: satukan kawalan sedia ada — kad Modul Khas kini pautan terus ke Tetapan
      → Operasi (dulu kata "belum disambungkan", mengelirukan); tarikh cuti sekolah
      (dulu berkod keras 2026/27, akan basi senyap) kini boleh sunting terus di panel
      Jam Dunia, disimpan `system_settings.schoolHolidaysJson`
- [x] Slot Bar: borang kandungan BAR dalam Editorium (2026-08-02) — `BarSlotManagerModal.tsx`
      baharu (medan Event/Penganjur/Lokasi/Akses/Penerangan/Tarikh/Sumber/URL/Imej/Nota,
      instance kedua `useSlotEditor.ts` sedia ada, tiada hook baharu diperlukan) render native
      di Editorium (Modul Khas → Urus Slot Bar, pemilih merentasi kesemua 8 slot Bar). Disahkan
      hidup (akaun ujian sekali-pakai): simpan kandungan sebenar → kemas kini editorial_objects
      DI TEMPAT (sepadan pembetulan Fasa 2 "terbitan tak boleh padam"), padam giliran → DB pulih
      tepat kepada bilangan editorial_objects asal. Mendesak sebab laluan LAMA (klik kad Bar di
      FrontpageView semasa isEditMode) hilang titik masuk UI sepenuhnya apabila sambungan
      `?openTicker=1` dibuang (lihat item Ticker di atas) — borang lama KEKAL sebagai kod mati
      (tak dibuang, risiko lebih rendah drpd buang sebelum laluan baharu "dibuktikan"). Turut
      ditemui semasa ujian (dilaporkan berasingan, bukan dibaiki sesi ni): pepijat sedia ada
      `server.js` `parseManualSummaryTemplate` — hantaran bukan-kosong yang parse kepada sifar
      blok berjudul tersilap guna manualSummary mentah sebagai "huraian" phantom
- [x] Focus View: tetapan had aksara (Nota Editor) — sebelum ni berkod keras
      (`NOTA_MAX = 180`, FocusView.tsx), kini `system_settings.focusViewNotaMaxAksara`,
      panel di Tetapan → Operasi, lalai 180 (tiada perubahan kelakuan sehingga disunting).
      **Animasi** dan **mod turutan** disiasat, SENGAJA tidak dibina — bukan diabaikan:
      Focus View sendiri sifar animasi buka/tutup/navigasi (mount terus, tiada transition),
      satu-satunya animasi berkod keras sistem ialah opacity 1s carousel kad bento — itu
      SUDAH item KIV berasingan "Jenis animasi transisi" di atas, bukan sesuatu khusus
      Focus View. Navigasi Sebelum/Seterusnya cuma SATU mod (RAWAK merentasi laman +
      sejarah dilawati) — tiada mod alternatif sedia ada dalam kod untuk dijadikan pilihan;
      reka mod baharu (kronologi/ikut Bidang/dll) perlukan input reka bentuk Izzat dahulu,
      sama seperti KIV animasi transisi di atas
- [x] Kawalan manual carousel (klik anak panah + swipe) — auto-putar kekal berjalan,
      permintaan Izzat 2026-08-02

### [x] Fasa 8 — Editorial dilengkapkan · `M` · ~4 hari (skop disemak semula 2026-08-02)
**Perubahan strategi 2026-08-02 (arahan Ketua Editor):** saluran isian kandungan sah kini
HANYA tiga — Manual, API luar bukan-AI, RSS. Pipeline penjanaan AI automatik (EditorialPipeline.js)
DIMATIKAN (scheduler, commit `61be972`) — kod kekal wujud tapi tak dipanggil automatik lagi.
AI hanya dibenarkan sebagai alat bantu MANUAL dalam chatbox editor (belum dibina, bukan
skop pelan ni buat masa ini). Kesan: semua kerja mengukuhkan pipeline AI automatik
(pengesahan bajet kos sebelum panggil, model lalai, dsb) **digugurkan daripada fasa ni** —
tak berbaloi diperkukuh sesuatu yang sengaja tak dipanggil. Yang tinggal di bawah relevan
tanpa mengira AI:
- [x] **Autocondong terpakai pada kad frontpage** — KEPUTUSAN Izzat 2026-08-02: ya,
      perluas. `safeParseInline` (dipindah ke `utils.tsx`) kini tokenkan autocondong
      dahulu, gloss/pemenggalan sedia ada terpakai dalam setiap segmen — kad bento DAN
      Focus View (title + setiap perenggan body) kedua-duanya guna fungsi SAMA
- [x] Limpahan teks — KEPUTUSAN Izzat 2026-08-02: pemotongan 220 aksara KEKAL (Ticker
      satu baris, pipeline automatik 3 jam sekali tanpa manusia hadir — tolak macam
      Manual tak sesuai), tapi kini DICATAT ke Log Audit + boleh nampak di Log Sistem
      Editorium setiap kali berlaku pada item auto-siar — bukan hilang senyap lagi
- [x] **Gate manusia untuk RSS** — KEPUTUSAN Izzat 2026-08-02: kekalkan auto-siar (skor
      ≥80 terus `AUTO_LIVE`), tiada perubahan kod diperlukan
- [x] **Asingkan glosari daripada penyelarasan ejaan** — KEPUTUSAN 2026-08-02: disahkan
      jadual `glosari_istilah` sedia ada bergabung dua tujuan berbeza (definisi istilah +
      pasangan ejaan betul/dielakkan) dalam satu baris/borang. Dipisahkan kepada jadual
      `ejaan_piawai` baharu (`core/routes/ejaanRoutes.js`) dengan tab "3. Penyelarasan
      Ejaan" berasingan dalam Editorial Console, ikut corak CRUD sedia ada. Jadual lama
      kosong (0 baris) semasa split — tiada data hilang; migrasi idempoten disediakan untuk
      masa depan. Kedua-dua jadual kekal rujukan pasif sahaja, tiada penulisan-ganti
      automatik ditambah (selaras peraturan projek)
- [x] **Medan "tempoh minimum paparan" — rujukan palsu dibetulkan** — KEPUTUSAN 2026-08-02:
      disahkan medan tu memang tak wujud di Tetapan Am Slot (`TetapanAmSlotConsole.tsx`).
      Ciri sebenar (selang masa putaran carousel) SUDAH wujud sebagai `carouselInterval`
      per-slot di borang Urus Slot (frontpage) — bukan "tak wujud langsung", cuma
      salah lokasi dalam teks rujukan. Teks di `EditorialConsole.tsx` dibetulkan untuk
      rujuk lokasi sebenar, bukan dibina semula sebagai ciri baharu (tiada keperluan
      medan kedua untuk nilai yang sama)
- [x] **Jadual Terbit & Jadual Luput** (2026-08-02, permintaan langsung Izzat, di luar skop
      pelan 17-fasa asal — sama corak seperti tambahan navigasi carousel hari ni). Lajur
      baharu `scheduledPublishAt`/`scheduledExpiresAt` (ISO 8601, waktu Malaysia +08:00)
      pada `editorial_revisions`; status baharu `scheduled` (dikecualikan drpd setiap query
      awam). Scheduler `setInterval` 90 saat dlm `server.js` (corak sama RSS Auto
      Scheduler) semak & terbit/arkib automatik, catat Log Audit + notifikasi. Dua
      KEPUTUSAN Izzat disahkan semasa klarifikasi:
      1. Tarikh luput TAK BOLEH ditetapkan pada satu-satunya kandungan hidup dalam slot —
         mesti ada gantian (approved/pending/scheduled) sedia dlm giliran dulu, disemak
         semasa SIMPAN (bukan semak-semula retroaktif semasa luput sebenar berlaku).
      2. Hanya kebenaran `manageEditorial` sedia ada (Ketua Editor/Penolong) boleh tetapkan
         jadual — Editor biasa ditolak 403 di server walaupun dia boleh terbit sendiri
         secara normal; UI (modal Detail Kandungan, IndeksConsole.tsx) sekadar sembunyi/
         nyahaktifkan medan untuk Editor, bukan gerbang sebenar.
      Diuji hidup dgn akaun uji sekali guna + slot sedia ada (kes TOLAK/BENARKAN gerbang
      gantian, 403 Editor, terbit & arkib automatik lulus tik penjadual sebenar) — semua
      data/akaun uji dipadam & slot disahkan kembali sepadan snapshot asal selepas ujian.
      114/114 ujian automatik lulus (103 asal + 11 baharu di `tests/scheduling.test.js`).

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
- [x] `lang="ms"` (index.html, dulu "en") + meta description sebenar + OG (type/title/
      description/image/url/site_name/locale)/Twitter Card seluruh laman + JSON-LD
      NewsArticle disuntik client-side bila Focus View dibuka (src/utils/seoMeta.ts)
- [x] Tajuk/meta dinamik per kandungan (FocusView.tsx, useEffect terap/buang semula,
      disahkan hidup di pelayar) · favicon disemak — ikon marun #802334 jenama Adjung
      sebenar, bukan default · `sitemap.xml` (core/routes/sitemapRoutes.js, dicache 15
      minit, disahkan 200 langsung) · `robots.txt` (public/robots.txt, tunjuk ke
      /sitemap.xml). **Nota:** sitemap HANYA senaraikan halaman depan — Focus View buka
      kandungan sebagai overlay state client (`focusLoc`), bukan laluan URL sebenar;
      `generateCanonicalUrl()` sedia ada (src/utils.tsx) jana URL subdomain rekaan yang
      tidak disambungkan kepada penghalaan. Skema URL per-kandungan sebenar perlukan
      keputusan penghalaan Ketua Editor — belum diputuskan, sengaja ditinggalkan.
- [ ] Prarender/SSR ringan untuk crawler — **diperiksa, belum dilaksana**: perlukan
      keputusan infrastruktur (Vite SSR/prerender plugin, atau proksi headless-browser-
      untuk-bot) di luar skop suntikan meta client-side pas ni; ia juga bergantung pada
      skema URL per-kandungan (baris di atas) belum wujud. KIV, siasat berasingan.

### [x] Fasa 10 — Suapan RSS keluar · `S` · ~1 hari
- [x] `GET /rss.xml` — suapan RSS 2.0 standard (core/routes/rssFeedRoutes.js), kandungan
      berstatus 'approved' sahaja (definisi sama seperti laluan awam layout/active),
      escape XML betul, `Content-Type: application/rss+xml`, cache dalam-memori 12 minit.
      **Nota:** sama had macam sitemap.xml (Fasa 9) — belum wujud skema URL kanonik
      per-kandungan, jadi pautan `<item><link>` guna muka depan + parameter slot/item,
      bukan laluan artikel sebenar. Naik taraf bila skema penghalaan per-kandungan wujud.

### [ ] Fasa 11 — Halaman awam · `M` · ~3 hari
- [x] 404 bergaya Adjung — laluan `*` didaftar di App.tsx, papar `TidakDijumpai.tsx`
      (maroon, wordmark, pautan balik ke `/`)
- [x] Tentang / Hubungi / Polisi & Penafian — komponen `HalamanStatik.tsx` papar
      kandungan dari `GET /api/pages/:key` (Fasa 6) di laluan `/tentang`, `/hubungi`,
      `/polisi-penafian`; keadaan kosong jujur bila belum diisi; pautan ditambah pada
      lajur footer baharu "Am"
- [ ] Perkongsian sosial — **tanya dahulu** (KIV, tunggu Izzat) · Carian pengunjung —
      **tanya dahulu** (KIV, tunggu Izzat)

### [ ] Fasa 12 — Halaman Penaja · `M` · ~3 hari
Konsol urus + halaman awam. Reka bentuk & penempatan — **keputusan Ketua Editor**;
jangan sentuh grid bento.

### [x] Fasa 13 — Penghalusan reka bentuk Editorium · SIAP 2026-08-02 (commit `05a62b7`)
Audit visual semua ~21 skrin Editorium (`src/components/editorium/*.tsx`) vs bahasa
frontpage (maroon `#802334`, serif tajuk, label mono-uppercase, neutral stone) —
keadaan kosong/memuat/ralat, dan lebar telefon (375px)/tablet (768px).
- [x] Warna: semak semua penggunaan warna bukan-maroon (emerald/red) di setiap skrin —
      kesemuanya status semantik (Aktif/ONLINE/berjaya = emerald, ralat = red), guna
      secara konsisten merentas skrin, bukan penyelewengan daripada bahasa jenama.
- [x] Label/tajuk/keadaan kosong-memuat-ralat: disemak merentas `TierKadConsole`,
      `TetapanAmSlotConsole`, `EditorialConsole`, `NotaKetuaEditorConsole`,
      `PanduanConsole`, `DrafSayaConsole`, `IndeksConsole`, `TetapanConsole`,
      `PerlembagaanConsole`, `SistemRekaBentukConsole`, `EditoriumLayout` — corak
      mono-uppercase label, "Memuatkan…", banner ralat merah sudah konsisten sedia
      ada; `PanduanConsole` tiada state memuat/ralat sebab kandungan statik (bukan
      pepijat).
- [x] **Dibetulkan** — `BidangConsole.tsx`, `DirektoriConsole.tsx`, `LogAuditConsole.tsx`:
      jadual tiada pembalut `overflow-x-auto` (tidak sepadan corak sedia ada di
      `SenaraiSlotConsole`/`TetapanConsole`), berisiko overflow di telefon. Ditambah
      pembalut sepadan corak sedia ada. Disahkan langsung di pelayar pada 375px
      (Bidang & Log Sistem — tiada overflow mendatar dokumen selepas pembetulan;
      Direktori sepadan struktur sama tetapi tidak dapat diuji langsung kerana akses
      Pentadbir sahaja).
- [x] `SistemRekaBentukConsole.tsx` ada satu `<table>` kecil (kad jenama) tanpa
      pembalut — dibiarkan; jadual lebar tetap dalam kad bersaiz tetap, bukan jadual
      data yang boleh overflow.

### [x] Fasa 14 — Jejak pengunjung & populariti · SIAP 2026-08-02 (commit `8008e28`)
- [x] Jadual `daily_view_counts` (server.js) — kiraan HARIAN anonim sahaja, tiada pihak
      ketiga, tiada cookie, tiada IP/user-agent (ikut "Keputusan sedia dibuat" di atas)
- [x] `core/routes/viewStatsRoutes.js` — `POST /api/system/track-view` (naikkan kiraan),
      `GET /api/system/view-stats` (ringkasan tren + kandungan paling diminati)
- [x] `src/utils/trackView.ts` — panggilan terlepas-pandang (fire-and-forget, `keepalive`),
      gagal senyap, tak pernah sekat/pecahkan paparan pembaca
- [x] Instrumentasi: satu kiraan setiap muatan frontpage + satu kiraan setiap pembukaan
      Focus View ikut slot (`FrontpageView.tsx`)
- [x] Panel Paparan Utama (dashboard) gantikan placeholder jujur — tren 7 hari + kandungan
      paling diminati ikut slot, guna `CartaBar` sedia ada (`DashboardConsole.tsx`)

### [x] Fasa 15 — Prestasi & kesediaan produksi · `M` · ~3 hari · SIAP 2026-08-02 (commit `4ab7091`)
- [x] **Laluan serve produksi** — `PORT` dari `process.env` disahkan sudah wujud sejak Fasa 1
      (bukan baharu). Ditambah: `express.static` hidang `dist/` (binaan Vite) dan
      `public/uploads`, fallback SPA (`app.get(/^(?!\/api\/).*/, ...)` pulangkan `index.html`
      untuk navigasi terus cth `/editorium`), skrip `npm start` baharu (`vite build` diikuti
      `node server.js` mod produksi, berasingan drpd `dev`). Tiada dependency PM2/pengurus
      proses baharu ditambah — `package.json` tak ada satu pun sedia ada, dan `node server.js`
      dengan penutupan bersih SIGTERM/SIGINT (sedia ada, Fasa 1) memadai buat masa ini
- [x] `db-state` god-endpoint: cache dalam-memori TTL 5 minit ditambah untuk 3 ambilan Google
      Doc luaran sahaja (`core/routes/dbStateRoutes.js`), corak sama seperti
      `sitemapRoutes.js`/`rssFeedRoutes.js`; baki endpoint (baca SQLite tempatan) tak disentuh
      sebab dah pantas
- [x] Diukur: binaan produksi (`npm run build`) — bundle utama frontpage 807 KB (gzip 220 KB)
      selepas code-split, `db-state` ~50ms sekali panggil (SQLite tempatan sahaja dlm dev DB
      tanpa URL Google Doc ditetapkan, jadi ambilan luaran tak tercetus dlm ujian ni — cache
      disahkan betul secara semakan kod, corak sama dgn sitemap/rss). Bundle asal 1085 KB (gzip
      280 KB) dipetik amaran Vite "chunk > 500kB" — dibaiki rendah-risiko dgn `React.lazy` +
      `Suspense` untuk `EditoriumView`/`ContentReview` (laluan admin, route-based, bukan
      refactor bento/kad) — turun ke 807 KB (gzip 220 KB), Editorium (270 KB) jadi chunk
      berasingan dimuat hanya bila dilawati
- [x] Backup automatik `adjung.db` — `setInterval` 24 jam dlm `server.js`, cuba/tangkap penuh
      (gagal backup tak rebahkan server), dasar pengekalan 7 salinan automatik terkini (awalan
      `adjung.db.backup-auto-`, tak sentuh backup manual sedia ada). **Bendera untuk Izzat:**
      ~19 fail backup manual (~56 MB jumlah, corak `adjung.db.backup-<pelbagai>`) masih di
      pokok kerja — SEMUA disahkan gitignored (`*.db.backup-*` dlm `.gitignore`) dan TIADA
      satu pun pernah dicommit ke git (disahkan `git log --all --full-history`), jadi tiada
      isu bengkak repo git. Tapi ia salinan pemulihan sebenar (bukan ujian) — sengaja TAK
      dipadam automatik di sini, Izzat perlu semak & padam sendiri ikut budi bicara bila selesa
- [x] Namakan semula pakej `react-example` → `adjung-brief` (`package.json`, ikut nama sebenar
      di `src/config/brand.ts`)

### [x] Fasa 16 — Panduan & Dokumentasi · `S` · ~1 hari
Panduan (Editorium → Rujukan → Panduan) hidup — panduan operasi harian sebenar
(Tulis/Draf/Terbit, bajet ruang kad, Bidang & Topik, urus slot, peranan RBAC,
Log Sistem), gantikan placeholder "Panduan Belum Dibina". Dokumentasi sudah
hidup sedia ada (Peraturan Am + Reka Bentuk) — tak disentuh.

### [ ] Fasa 17 — Ujian menyeluruh & deploy · `M` · ~3 hari
Setiap modul · dua peranan · dua saiz skrin · ujian & tsc bersih · bersih data ujian ·
backup · deploy · sahkan pasca-deploy. **Sesi autonomi 2026-08-02** siapkan SEMUA
persediaan (setiap item bawah KECUALI deploy sebenar — lihat "KIV — tunggu Izzat" di atas).
- [x] **Setiap modul** — laluan admin utama diuji integrasi lepas gelombang perubahan hari
      ni: log masuk, Paparan Utama (dashboard hidup, 127 kandungan/2 menunggu/24 aktif/101
      arkib betul), Kandungan (Indeks + Semakan Kandungan), Peti Makluman, Slot, Modul
      Khas, Editorial, Nota Ketua Editor, Direktori/Tetapan (gerbang RBAC disahkan),
      Panduan/Dokumentasi/Log Sistem, portal awam (frontpage + Focus View). Tiada regresi
      silang-fasa ditemui (cth notifikasi Fasa 6b dan jejak pengunjung Fasa 14 kedua-duanya
      hidup betul bersama laluan produksi Fasa 15)
- [x] **Dua peranan** — akaun ujian sekali pakai KETUA_EDITOR & EDITOR log masuk sebenar di
      pelayar; sahkan sidebar sekat butang ikut kebenaran (Direktori/Tetapan/Editorial/Nota
      Ketua Editor bergembok utk EDITOR) DAN penguatkuasaan server (403 sebenar, bukan
      sekadar UI tersorok — lihat `tests/security.test.js`)
- [x] **Dua saiz skrin** — spot-check akhir desktop + telefon (375px) di frontpage dan
      Paparan Utama Editorium lepas perubahan hari ni; tiada overflow baharu ditemui
      (menyokong audit penuh Fasa 13 sedia ada)
- [x] **Ujian & tsc bersih** — `npx tsc --noEmit` bersih, `npm test` 103/103 (98 asal + 5
      ujian keselamatan baharu), tiada kegagalan
- [x] **Bersih data ujian** — audit `adjung.db` penuh: ditemui 14 baris `user_roles` anak
      yatim (rujuk akaun ujian fasa-fasa terdahulu — Fasa 3/4/5/6/6b/13/lang/halaman — yang
      baris `users` induknya sudah dipadam tapi `user_roles` tak ikut terpadam sebab
      `PRAGMA foreign_keys` tak berkuat kuasa semasa padaman tu berlaku). Dibersihkan;
      `users`/`user_roles` kini cuma ada akaun sebenar Izzat (`user-chief-editor`). Tiada
      kandungan editorial bertanda ujian ditemui pada peringkat `editorial_objects`
- [x] **Backup** — `adjung.db.backup-20260802-154916-fasa17-final-verified` (lepas
      pembersihan & pengesahan penuh di atas), disahkan `git check-ignore` (gitignored)
- [x] **Deploy sebenar & sahkan pasca-deploy** — SIAP 2026-08-02, dijalankan Izzat sendiri
      (setiap arahan ditekan Izzat di Web Console DigitalOcean, saya cuma bimbing/sediakan)
      selepas keputusan platform (VPS/VM DigitalOcean, lihat `DEPLOY.md`):
      - Droplet `adjung-brief-prod` (Ubuntu 24.04, 1GB/1vCPU, rantau Singapore)
      - Node 20 LTS + pm2 (auto-mula bila reboot via `pm2 startup`) + firewall `ufw` (22/80/443)
      - **Pepijat SEBENAR ditemui & dibetulkan semasa deploy** (bukan diketahui sebelum ni):
        `server.js` import terus `.ts` (`src/config/istilah.ts`) — jalan lancar di komputer
        pembangunan (Node 24, sokongan native TypeScript) tapi GAGAL (`ERR_UNKNOWN_FILE_EXTENSION`)
        di Node 20 (LTS server produksi). Dibetulkan: `npm start` & panduan pm2 kini guna `tsx`
        (dah devDependency projek, cara sama macam `npm run dev`) — lihat commit `3f03b05`.
        Nota: ujian binaan tempatan tak dapat kesan bug ni sebab versi Node berbeza — pelajaran
        untuk deploy akan datang, sentiasa uji betul-betul di persekitaran/versi Node produksi.
      - `npm audit fix` (bukan `--force`) dijalankan semasa persediaan — 15→9 kelemahan
        (body-parser/postcss/protobufjs/react-router dibetulkan; baki rantaian sqlite3/tar
        sengaja tak disentuh, perlukan breaking change, risiko native binding sqlite3)
      - nginx reverse proxy + domain **`brief.adjung.com`** (subdomain — domain induk
        `adjung.com` kekal untuk laman Adjung Platform berasingan di Vercel, rekod DNS `A`
        subdomain ditambah tanpa ganggu wildcard `*.adjung.com` sedia ada)
      - HTTPS percuma via Certbot/Let's Encrypt, auto-renew berjadual, http→https redirect
        automatik (disahkan `301`)
      - Disahkan pasca-deploy: restart pm2 terkawal → `adjung.db` utuh, server pulih normal
        (200 OK selepas restart) — pengesahan cakera berkekalan sebenar

**Semakan semula 2026-08-02 (lepas pemindahan Ticker/Bar + buang kod mati)**: gelombang besar
kerja mendarat SELEPAS pengesahan asal di atas — Ticker & Slot Bar berpindah penuh ke Editorium
native (`useTickerEditor.ts`, `BarSlotManagerModal.tsx`), dua pepijat kehilangan data sebenar
ditemui & dibetulkan di laluan simpan Ticker/RSS (`slotsConfigRoutes.js`, `EditorialPipeline.js`)
serta satu pepijat fallback phantom di `server.js` (`parseManualSummaryTemplate`), pembersihan
kod mati besar di `FrontpageView.tsx` (~6889 → ~3114 baris), tetapan saiz overlay Ticker,
had aksara Nota Focus View, dan kawalan carousel manual (klik/leret) pada 30 kad. Semakan
fokus ni disahkan semula:
- `npx tsc --noEmit` bersih + `npm test` 103/103 (baseline sebelum & selepas ujian sendiri,
  tiada regresi)
- Ticker: `system_settings.inTheNewsText` di-snapshot SEBELUM apa-apa ujian (panjang 10762,
  sha256 `76bb0080...`) dan disahkan BYTE-IDENTIK selepas (panjang & hash sama tepat) — tiada
  padaman senyap berlaku semasa sesi ni. Overlay skrin-penuh Ticker disahkan papar kandungan
  sebenar, navigasi anak panah/titik berfungsi (diuji klik terus di pelayar), rotasi automatik
  kekal berjalan
- Tiga pepijat kehilangan data (commit `1173233`, `53160ca`, `e7e9902`) disemak semula secara
  kod — setiap satu tukar kelakuan "tulis-ganti tanpa syarat" kepada "hanya tulis-ganti bila
  kandungan baharu benar-benar wujud", corak yang betul dan konsisten merentasi ketiga-tiga
  laluan
- Slot Bar: laluan simpan (`POST /api/system/slots`) disahkan kekal corak INSERT
  versi-menaik (tiada `DELETE FROM editorial_revisions/editorial_objects` pada laluan simpan) —
  jaminan Fasa 2 "kemas kini di tempat, versi naik, tiada padam" kekal terpakai. Kad Bar di
  frontpage disahkan buka/tutup (expand/collapse) betul di pelayar sebenar
- Gerbang kebenaran laluan native (`requireAuth` di `POST /api/system/slots`) disahkan sedia
  ada SEBELUM gelombang perubahan ni (bukan baharu, jadi diliputi RBAC asal) — permintaan
  tanpa sesi disahkan pulangkan 401 sebenar
- Frontpage disahkan semula selepas buang kod mati + perubahan lanjutan: kad biasa, kad Bar
  (buka/tutup), Ticker marquee + overlay skrin-penuh, Focus View (Nota Editor papar betul),
  carousel manual (rotasi automatik disahkan sambung semula lepas kandungan bertukar), skrin
  375px (tiada overflow, susun atur kekal kemas) — semua disahkan dengan screenshot pelayar
  sebenar, bukan hanya baca kod
- Audit data ujian: tiada akaun `test-*` atau baris `user_roles` anak yatim baharu ditemui.
  **Pembetulan nota semakan awal ni sendiri**: nota tu silap kata "dasar keselamatan projek
  melarang cipta akaun baharu walaupun untuk ujian sekali pakai" — akaun ujian buang-selepas
  dicipta terus dalam DB tempatan (BUKAN laluan pendaftaran/kredential pihak ketiga) SUDAH
  digunakan berpuluh kali sepanjang sesi ni tanpa isu, corak sah & selamat. Susulan segera
  buat klik-terus SEBENAR di pelayar (bukan sekadar semakan kod): log masuk sebagai
  `test-f17-clickthrough`, buka "Urus Ticker" native — DITEMUI **pepijat data sisa sebenar**:
  `slots_config.contentMode` slot Ticker (-1) tersangkut pada `'Manual'` dengan kandungan ujian
  palsu ("Tajuk: Ujian sah...") daripada ujian awal agen pemindahan Ticker (bandingan backup
  sejarah sahkan ia rosak antara backup `pre-ticker-migration` dan `pre-focusview-settings`;
  `inTheNewsText` sebenar TAK terjejas, cuma medan `contentMode`/`manualSummary` slot yang
  tersasar). Ini landmine sebenar: kalau seseorang buka skrin Ticker dan simpan tanpa ubah
  apa-apa, pembetulan pepijat awal sesi ni (elak tulis-ganti bila KOSONG) tak menghalang
  overwrite ni sebab kandungan tu BUKAN kosong, cuma SALAH. Dipulih terus ke nilai asal
  (`contentMode: 'RSS Direct'`, `manualSummary` timestamp asal) daripada backup sejarah.
  Selepas pulih: ujian simpan SEBENAR (klik borang → tukar Kelajuan Pusingan 10→15 → Simpan)
  disahkan berjaya, `contentMode` KEKAL 'RSS Direct' (tak tersentuh), `inTheNewsText` KEKAL
  10762 aksara/hash sama. Nilai ujian dipulih ke 10 selepas sah.
- Tiada pepijat kod baharu (selain data sisa di atas, yang dibetulkan terus tanpa perlu
  ubah kod); backup segar `adjung.db.backup-20260802-182505-fasa17-verified-final` dicipta,
  disahkan gitignored, backup ujian perantaraan sepanjang hari dibersihkan

---

### [ ] Fasa 18 — Penghalusan bahasa & micro-interaction · ditambah 2026-08-03
Permintaan Izzat — dua kerja "polishing" berasingan daripada 17 fasa asal, bukan penghalang
launch, boleh dibuat bila-bila selepas fasa teras siap.

- [ ] **Audit bahasa Melayu menyeluruh** — semak SEMUA label/teks UI di Editorium DAN
      frontpage (bukan cuma satu bahagian), betulkan grammar/istilah yang tak ikut DBP
      (isu berulang dalam projek ni — adalah/ialah, bila/apabila, di mana, di dalam, dsb,
      lihat memori sesi `feedback_malay_language_quality`). Semak juga konsistensi dengan
      istilah yang dah diluluskan di `src/config/istilah.ts` sebelum tulis baharu. Skop:
      audit dulu (senaraikan semua ditemui, jangan terus ubah), bentang kepada Izzat untuk
      makluman/kelulusan sebelum betulkan secara pukal — label ialah keputusan UI/UX,
      bukan pembetulan kod semata (lihat memori `feedback_ui_ux_needs_approval`).
- [ ] **Micro-interaction** — animasi/interaksi halus skala kecil (cth hover butang, transisi
      buka/tutup modal, keadaan loading) — **BUKAN** sama dengan item "Jenis animasi
      transisi" Fasa 7 (yang tu khusus animasi carousel kad bento/carousel, masih KIV
      berasingan menunggu reka bentuk skema tetapan per-jenis daripada Izzat). Skop tepat
      (yang mana elemen, gaya animasi macam mana) belum diputuskan — perlu bincang dengan
      Izzat dulu sebelum bina, bukan reka sendiri (prinsip sama macam KIV Fasa 7).

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
