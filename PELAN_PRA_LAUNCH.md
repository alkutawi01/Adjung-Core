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
Fasa 6 (Tetapan) ────► Fasa 7 (Modul Khas & kawalan slot)
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

### [ ] Fasa 1 — Keselamatan & log masuk · `L` · ~6 hari · **PENGHALANG LAUNCH**
- [ ] Tutup: `GET /api/db-state` bocorkan lajur `password` kepada sesiapa
- [ ] Middleware auth + semakan peranan di SETIAP laluan API (kini SIFAR laluan dilindungi
      — semua kunci "Ketua Editor sahaja" hanyalah teater UI atas API terbuka)
- [ ] Token sesi sebenar di server + tempoh luput (kini blob localStorage boleh diubah
      sendiri jadi `KETUA_EDITOR`)
- [ ] `POST /api/auth/reset-password` — token melalui emel, bukan terbuka
- [ ] Buang lalai `password TEXT DEFAULT 'password'` + laluan kembali teks biasa
- [ ] Had kadar (rate limit) pada log masuk — kini brute force tanpa had
- [ ] `POST /api/media/upload` tanpa auth menulis fail ke folder awam — kunci
- [ ] Pengendali ralat global Express (kini stack trace HTML terus ke pelanggan)
- [ ] Ujian penjelakan peranan + XSS/CSRF
- [ ] Cipta akaun editor (kini: INSERT ke DB dengan tangan sahaja)
- [ ] Jemputan editor baharu + set semula kata laluan melalui emel
- [ ] Kuatkuasakan matriks RBAC dari Tetapan → Kawalan Akses di server (kini disimpan
      tetapi tidak dibaca oleh sesiapa)

### [ ] Fasa 2 — Pepijat kritikal sedia ada + hutang ujian · `M` · ~3 hari
Semua ditemui Fasa 0, semuanya menjejaskan data sebenar HARI INI:
- [ ] **Simpan slot BAR memadam terbitan secara kekal** — laluan lama `DELETE FROM
      editorial_objects` + CASCADE memusnahkan revisi (`server.js:2056-2079`). Peraturan
      "terbitan tak boleh padam" dipintas oleh butang simpan biasa
- [ ] **URL RSS tercantas** — pembersih boilerplate memakan hostname (`bernama.com`,
      `kosmo.com.my`) → `originalUrl` rosak dalam ticker sebenar. Ini punca ujian gagal
      #1; baiki KOD, bukan ujian (`SourceSanitizer.js:42`)
- [ ] Ujian gagal #2 = ujian lapuk (`REJECT` → `BLOCKED_KEYWORD`) — baiki UJIAN
- [ ] **Imej tak sampai** — modal tulis simpan atribut `image`, laluan lain baca
      `imageUrl`; imej yang dilampirkan editor tak pernah muncul di Indeks
- [ ] **Simpan pukal Semakan silap sasaran** — dikunci ikut ordinal siri, bukan UUID;
      perubahan serentak boleh tulis ke artikel yang salah secara senyap
- [ ] **Dua penulis satu ticker** — RSS direct dan pipeline AI tulis-ganti
      `inTheNewsText` sesama sendiri tanpa peraturan pemilikan
- [ ] Enjin tipografi berganda client/server dengan perbezaan tapisan sebenar
      (peraturan `enabled=0` masih terpakai di server) — satukan
- [ ] `PRAGMA` WAL + `busy_timeout` — kini simpanan serentak dua editor gagal senyap
- [ ] Skrip `clean` memadam `adjung.db` tanpa amaran — buang/betulkan
- [ ] Sahkan `npm test` hijau sepenuhnya selepas semua di atas

### [ ] Fasa 3 — Direktori hidup · `M` · ~3 hari
- [ ] `staffList` dari jadual `users` sebenar (kini array kosong; butang tambah = hiasan)
- [ ] Tindakan status (aktif/cuti/nyahaktif) simpan ke server (kini state lokal sahaja,
      hilang bila muat semula)
- [ ] "+ Tambah Anggota" berfungsi — bersambung Fasa 1
- [ ] Carta organisasi ringkas

### [ ] Fasa 4 — Log Sistem · `M` · ~3 hari
- [ ] Jadual audit: siapa terbit/edit/arkib/tolak apa, bila (kini SIFAR jejak — tiada
      log tindakan langsung, `logs: []` berkod keras)
- [ ] Paparan di Rujukan → Log Sistem
- [ ] Log ralat server + log kesihatan ambilan RSS (kini ralat feed ditelan senyap —
      feed mati tak dapat dibezakan dengan feed sunyi)

### [ ] Fasa 5 — Paparan Utama (dashboard) · `M` · ~3 hari
- [ ] Status kandungan · draf saya · makluman terbaru · slot kosong/bermasalah
- [ ] Status RSS & API cuaca (baca rekod kesihatan Fasa 4)
- [ ] Keaktifan editor (baca log audit Fasa 4)
- [ ] Destinasi lalai selepas log masuk

### [ ] Fasa 6 — Tetapan & aliran kerja teras · `L` · ~5 hari
- [ ] Editor label & tooltip (UI atas `src/config/istilah.ts`)
- [ ] Maklumat/halaman polisi (sumber untuk halaman awam Fasa 11)
- [ ] Hidupkan atau buang "Glos Selari" (kini dimatikan)
- [ ] **Auto-simpan / penjaga dirty pada modal tulis** — kini tutup modal = kerja hilang
      senyap; penjaga sedia ada cuma semak tajuk/huraian
- [ ] **Kawalan serentak** — dua editor buka slot sama: simpan kedua memadam simpanan
      pertama tanpa amaran. Perlu token versi / semakan `updatedAt`
- [ ] **Sejarah versi sebenar** — kini `editorial_revisions` SENTIASA 1 baris (edit =
      UPDATE atas tempat, versi berkekalan 1.0); jadikan revisi terkumpul + UI lihat/
      pulih versi
- [ ] Sebab penolakan — `Tolak` kini pulangkan draf TANPA sebarang catatan kepada penulis
- [ ] Notifikasi kepada editor bila kandungannya disiar/ditolak (kini kena pergi semak
      sendiri)

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

### [ ] Fasa 8 — Editorial dilengkapkan · `L` · ~6 hari (skop dikunci oleh Fasa 0)
- [ ] **Autocondong terpakai pada kad frontpage** — kini hanya tajuk ticker + sandbox;
      kad bento & Focus View langsung tak guna `TypographyRenderer` (keputusan reka
      bentuk: sahkan dengan Ketua Editor dulu)
- [ ] 4 sub-templat semakan (ejaan/tatabahasa/gaya bahasa/format) + sambung `reviewPrompt`
      tergantung ke butang semakan sebenar
- [ ] Suntik glosari/ejaan ke dalam prompt AI (kini AI langsung tak nampak gaya rumah)
- [ ] Limpahan teks: satu polisi seragam — kini 3 kelakuan berbeza (tolak dengan mesej /
      langkau senyap di ticker AI / cantas senyap `...` di RSS — yang terakhir melanggar
      perlembagaan)
- [ ] AI: semakan bajet SEBELUM panggil (kini bajet kos disimpan tapi tak disemak);
      baiki lalai `gemini-3.5-flash` (model tak wujud) & `max_tokens: 1000` Claude;
      "Semak Sambungan" jujur (kini kata "Connected" untuk kunci sampah)
- [ ] **Gate manusia untuk AI & RSS** — kini AI terus `approved` dan RSS ≥80 terus siar
      TANPA manusia. KEPUTUSAN KETUA EDITOR: kekalkan auto-siar atau paksa Menunggu?
- [ ] Medan "tempoh minimum paparan" sebenar + buang rujukan palsu dalam EditorialConsole
- [ ] Asingkan glosari daripada penyelarasan ejaan
- [ ] `validateMedanTambahan` pada laluan AI (kini laluan manual sahaja)

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
