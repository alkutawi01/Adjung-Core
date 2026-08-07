# PELAN 02 — Pembaikan Pepijat Pra-Pelancaran

**Tarikh:** 2026-08-07 · **Status:** Hasil audit disahkan dengan pembacaan kod; sedia dilaksana
**Untuk:** Mana-mana sesi Claude (Opus/Sonnet) — pelan ini berdikari, tidak perlu rujuk perbualan asal.

> **WAJIB baca dahulu:** `CLAUDE.md`. Falsafah #4 terpakai: `adjung.db` mengandungi data sebenar tanpa sandaran — sebelum sebarang ujian yang menulis data, `cp adjung.db adjung.db.backup-<ts>` dahulu. Nombor baris tepat pada 2026-08-07 tetapi akan hanyut — sentiasa `Grep` corak, jangan percaya baris membuta.

**Peraturan pelaksanaan:**
- Satu komit per pepijat (atau per pasangan berkait rapat), mesej `fix(<skop>): <ringkasan> — Pelan 02 #<n>`.
- Setiap pembaikan disahkan: tulis semula senario kegagalan sebagai ujian manual (curl/fetch) atau ujian `tests/*.test.js`, buktikan gagal-sebelum/lulus-selepas di mana praktikal.
- Perubahan gerbang kebenaran MESTI diuji dua arah: peranan tanpa kebenaran DITOLAK (403), peranan dengan kebenaran LULUS.
- Jangan ubah tingkah laku UI tanpa keperluan — ini kerja backend/logik. Keputusan produk yang belum jelas: tanya Izzat (senarai soalan di §S).

---

## KRITIKAL — buat dahulu

### #1 Tampal pukal memintas seluruh alur kelulusan
`core/routes/pipelineRoutes.js:13, 141-144` — `POST /api/system/pipeline/batch_paste` hanya `requireAuth`; setiap item ditulis `status: 'approved'` terus ke frontpage, tanpa `pending`, tanpa kelulusan, dan tanpa semakan `hadKandunganSlot` yang dikuatkuasakan di laluan `POST /content`.
**Baikan:** (a) tulis dengan `status: 'pending'` selaras `syncManualObjectsForSlot`, ATAU gerbang `requirePermission('publish')` jika tampal pukal memang saluran Ketua Editor; (b) kuatkuasakan `hadKandunganSlot`. *Pilihan (a) vs (b) → soalan S1.*

### #2 Perlanggaran kunci utama dalam tampal pukal
`core/routes/pipelineRoutes.js:121` — `objectId = \`object-manual-slot${slotIdx}-${Date.now()}\`` tanpa akhiran indeks; dua item ke slot sama dalam satu batch berkongsi milisaat → INSERT kedua gagal UNIQUE → seluruh transaksi digulung dengan ralat mengelirukan. (Bandingkan `server.js:2694` yang betul: `baseTs + i`.)
**Baikan:** tambah akhiran `-${i}` (atau corak `baseTs + i` sama seperti `server.js`).

## TINGGI

### #3 Pulih versi: tiada gerbang kebenaran & tiada transaksi
`core/routes/contentRoutes.js:843, 915-934` — `POST /content/:id/revisions/:revisionId/restore` hanya `requireAuth` (PATCH pada kandungan sama ada semakan `editAll`/pemilikan). Tambahan: INSERT revisi + salin atribut + UPDATE objek tanpa `BEGIN TRANSACTION` — kegagalan separuh jalan tinggalkan revisi tanpa atribut (Bidang/URL/sumber hilang senyap).
**Baikan:** pasang gerbang sama seperti PATCH `/content/:id`; bungkus keseluruhan dalam transaksi.

### #4 Tetapan Tier boleh diubah mana-mana editor
`core/routes/tierSettingsRoutes.js:66, 117` — `POST /tier-settings` & `/tier-settings/reset` hanya `requireAuth`, sedangkan ia mengawal had aksara SEMUA slot setier (tunjang Falsafah #1).
**Baikan:** `requirePermission('manageEditorial')`.

### #5 Tetapan Am Slot terbuka kepada semua editor
`core/routes/slotAmRoutes.js:144` — `POST /slot-am-settings` hanya `requireAuth`; mengawal had medan (`hadHuraianPanjang`, `hadTopik`), animasi, logo penaja, warna panel transisi.
**Baikan:** `requirePermission('manageEditorial')` (selaras #4; ia kawalan editorial, bukan tetapan sistem).

### #6 Konfigurasi terjemahan tanpa kunci kebenaran
`core/routes/translationRoutes.js:37, 61` (mount di `server.js:3054`) — POST/DELETE hanya `requireAuthForWrites`; laluan kembar `/api/ai` bergerbang per-endpoint.
**Baikan:** `requirePermission('manageSettings')` pada kedua-dua laluan tulis.

### #7 Draf Saya percaya identiti daripada query klien
`core/routes/draftRoutes.js:32-42` — `GET /drafts?penulis=X&editorId=Y` ambil identiti dari query string; mana-mana akaun log masuk boleh baca draf peribadi orang lain dengan menghantar nama pena/id mereka.
**Baikan:** terbitkan `penulis` (nama pena) dan `editorId` daripada `req.session.user`; abaikan query. Semak juga pemanggil klien (`DrafSayaConsole.tsx`) supaya berhenti menghantar parameter itu.

## SEDERHANA

### #8 Kemas kini ticker hilang kerana kunci tak konsisten
`core/routes/contentRoutes.js:1094-1103, 1160-1170` vs `:445` — hanya PATCH dibungkus `denganKunciKandungan`; cabang ticker dalam POST dan DELETE buat baca-ubah-tulis `system_settings.inTheNewsText` tanpa kunci → dua permintaan serentak menimpa satu sama lain, item ticker hilang senyap.
**Baikan:** bungkus semua laluan tulis ticker dengan `denganKunciKandungan`.

### #9 Bulan penaja ikut UTC, bukan waktu Malaysia
`core/routes/sponsorRoutes.js:13` — `bulanSemasa()` guna `toISOString()` (UTC); 12:00 pagi–8:00 pagi MYT pada 1 haribulan, footer awam masih papar penaja bulan lepas.
**Baikan:** guna corak `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', ... })` sedia ada di `viewStatsRoutes.js:13-21` — kongsikan sebagai util, jangan salin.

### #10 Log masuk mendedahkan kewujudan akaun
`core/routes/authRoutes.js:52-61` — 404 "Pengguna tidak dijumpai" vs 401 "Kata laluan salah" membolehkan enumerasi akaun (portal bakal awam; rate limiter memperlahankan tetapi tidak menghalang).
**Baikan:** satu mesej generik + satu kod status (401) untuk kedua-dua kes. (Selaras falsafah anti-enumeration sedia ada di `lupa-kata-laluan`.)

### #11 Tukar kata laluan tidak membatalkan sesi sedia ada
`core/routes/authRoutes.js:342-346` — `POST /aktifkan-akaun` (dan semak juga `/reset-password`, `/change-password` jika wujud) menukar kata laluan tanpa memusnahkan sesi aktif akaun itu dalam `sessions.db` — penceroboh kekal log masuk sehingga 12 jam.
**Baikan:** selepas tukar kata laluan, padam semua baris sesi pengguna berkenaan dari `sessions.db` (jadual `sessions`, cari `sess` JSON mengandungi `user.id`), kecuali sesi semasa pengguna itu sendiri.

## RENDAH

### #12 Pipeline AI masih boleh dipicu semua editor
`core/routes/pipelineRoutes.js:182, 212` — `POST /pipeline/run` & `/slots/run-now` hanya `requireAuth`, walhal saluran AI rasminya dimatikan (keputusan 2026-08-02).
**Baikan:** gerbang `requirePermission('manageEditorial')` ATAU tolak 403 dengan mesej "Saluran AI dimatikan" sehingga diaktifkan semula. *Soalan S2.*

### #13 Item luar julat digugurkan senyap dalam tampal pukal
`core/routes/pipelineRoutes.js:88, 119` — `slotIndex` luar 0-37 di-`continue` senyap; pengguna dapat `success: true` tanpa tahu item mana hilang.
**Baikan:** kembalikan 400 menamakan item luar julat, konsisten dengan penolakan bajet.

### #14 Hanyutan kecil dua penghurai blok
`core/editorial/ManualBlockFormat.js:222` — `serializeManualBarItem` masih tulis label legasi `Tarikh:`; bento dan `serializeDraftBlock` (`server.js:2487`) sudah `Tarikh sumber:`. Alias masih dihurai, belum patah.
**Baikan:** selaraskan ke `Tarikh sumber:` (pastikan penghurai kekal menerima alias lama untuk data sedia ada).

---

## §S — Soalan untuk Izzat sebelum/semasa pelaksanaan

- **S1 (#1):** Tampal pukal patut (a) masuk sebagai *Menunggu* dan ikut alur kelulusan biasa, atau (b) kekal terus-terbit tetapi terhad kepada pemegang kunci `publish` (Ketua Editor/Penolong)? — cadangan: (b), sebab tampal pukal memang alat Ketua Editor mengisi banyak slot pantas.
- **S2 (#12):** Laluan pipeline AI dilumpuhkan terus (403 sentiasa) atau digerbang `manageEditorial` sahaja? — cadangan: dilumpuhkan terus, selaras keputusan saluran 2026-08-02.

## Urutan pelaksanaan dicadangkan

1. #2 (satu baris, tiada keputusan) → 2. #4, #5, #6 (gerbang mudah, corak sama) → 3. #3 (gerbang + transaksi) → 4. #7 (server + klien) → 5. #1 (selepas jawapan S1) → 6. #8, #9, #10, #11 → 7. #12 (selepas S2), #13, #14.

## Kriteria siap

- [ ] Setiap endpoint tulis dalam `core/routes/*.js` + `server.js` mempunyai gerbang yang betul — jalankan semakan menyeluruh akhir: senarai semua `router.(post|patch|delete|put)` dan padankan gerbangnya
- [ ] Ujian dua arah gerbang (403 tanpa kebenaran / lulus dengan kebenaran) untuk #1, #3-#7, #12
- [ ] `npm test` bersih; `npx tsc --noEmit` bersih
- [ ] Senario #2 diuji: batch 2+ item ke slot sama berjaya
- [ ] `adjung.db` disandarkan sebelum sebarang ujian tulis
