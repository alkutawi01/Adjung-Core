# Pelan Pelaksanaan Pra-Launch — Adjung Brief

Ditetapkan 2026-08-01 (Izzat, Ketua Editor). Disemak semula selepas kritikan Antigravity
dan audit keselamatan. Matlamat: semua fungsi asas/standard portal siap dan boleh dikawal
dalam Editorium SEBELUM launch — "tak nak kena ubah banyak benda selepas launch nanti."

> Nota: folder `specification/` menerangkan produk LAIN (Folio/Biography) — pelan ini
> sahaja rujukan pelaksanaan untuk Adjung Brief.

---

## Keputusan sedia dibuat

- **Paparan Utama (dashboard)**: item pertama sidebar, di atas kumpulan Penerbitan,
  destinasi lalai selepas log masuk. Kandungan: status kandungan (Menunggu/Aktif/Arkib),
  draf saya, makluman terbaru, slot bermasalah, pintasan, bilangan pengunjung, kandungan
  paling diminati, status RSS, status API, keaktifan editor.
- **Jejak pengunjung**: dibina sendiri dalam sistem — tiada pihak ketiga (bukan Google
  Analytics), tiada cookie, tiada data peribadi pengunjung; kiraan harian sahaja dalam
  `adjung.db`.
- Kumpulan sidebar ketiga bernama **"Rujukan"** (dulu "Sistem").

## Cara membaca anggaran

Anggaran hari ialah **hari kerja penuh**, bukan tarikh kalendar. Ia anggaran kasar untuk
merancang jujukan, bukan janji. Saiz relatif lebih dipercayai daripada nombor:
`S` (kecil, ≤1 hari) · `M` (sederhana, 2–3 hari) · `L` (besar, 4–6 hari) · `XL` (perlu
dipecah lagi sebelum dimulakan).

**Jumlah kasar: ~48–62 hari kerja.** Fasa 0 akan menajamkan angka ini.

---

## Graf kebergantungan

```
Fasa 0 (audit)  ─────────────────────────────► mengesahkan/mengubah semua fasa di bawah
Fasa 1 (keselamatan) ─┬──────────────────────► PENGHALANG LAUNCH mutlak
                      └─► Fasa 3 (Direktori) perlukan akaun & peranan sebenar
Fasa 2 (hutang ujian) ───────────────────────► bebas, buat awal supaya ujian jadi isyarat benar
Fasa 3 (Direktori) ──► Fasa 4 (Log Sistem) perlu tahu siapa buat apa
Fasa 4 (Log Sistem) ──► Fasa 5 (Dashboard) panel keaktifan editor baca log yang sama
Fasa 6 (Tetapan) ────► Fasa 7 (Modul Khas) kawalan Jam/Ticker duduk atas tetapan operasi
Fasa 8 (Editorial) ── bebas, tetapi skopnya ditetapkan oleh Fasa 0
Fasa 9-12 ───────────► Fasa 13 (reka bentuk) sentuh SEMUA skrin, mesti selepas UI stabil
Fasa 13 ─────────────► Fasa 14 (prestasi) ukur produk siap, bukan separuh siap
Fasa 14 ─────────────► Fasa 15 (deploy)
```

Kerja selari yang selamat: Fasa 2 boleh berjalan serentak dengan mana-mana fasa lain.
Fasa 8 boleh berjalan serentak dengan Fasa 6–7.

---

## FASA

### [ ] Fasa 0 — Audit kelengkapan menyeluruh · `M` · ~2 hari
Sebelum bina apa-apa: senarai lengkap "apa yang portal berita sebenar perlukan" berbanding
apa yang ada, modul demi modul. Audit terdahulu cuma semak senarai pemilik projek
("ada/tiada"), bukan kedalaman. Yang sudah dikesan cetek setakat ini:
- [ ] Semakan Kandungan = editor teks pukal, bukan aliran semakan (tiada terima/tolak/komen)
- [ ] Draf Saya tiada auto-simpan — editor boleh hilang kerja
- [ ] Tiada UI sejarah versi (data `editorial_revisions` wujud, paparan tiada)
- [ ] Tiada jadual terbit (terbit kemudian pada masa ditetapkan)
- [ ] Nota Ketua Editor tiada bukti sudah dibaca siapa
- [ ] Semak baki modul dengan kaedah yang sama; kemas kini fasa di bawah dengan penemuan

**Hasil:** senarai jurang muktamad + skop Fasa 8 ditetapkan (lihat kritikan #8).

---

### [ ] Fasa 1 — Keselamatan & log masuk · `L` · ~5 hari · **PENGHALANG LAUNCH**
Audit 2026-08-01 menemui empat lubang. Portal awam TIDAK BOLEH naik sebelum ditutup:
- [ ] `GET /api/db-state` menghantar lajur `password` kepada pemanggil tanpa log masuk
- [ ] Tiada satu pun API dilindungi — sesiapa boleh terbit/padam/ubah tetapan
- [ ] Sesi hanya di browser (localStorage) — sesiapa boleh tukar `role` sendiri jadi
      `KETUA_EDITOR` dan dapat kuasa penuh
- [ ] `POST /api/auth/reset-password` terbuka — tahu emel = boleh tukar kata laluan sesiapa
- [ ] Lajur `password TEXT DEFAULT 'password'` + laluan kembali teks biasa masih hidup
- [ ] Token sesi sebenar di server (bukan blob localStorage), tempoh luput, log keluar sah
- [ ] Middleware auth + semakan peranan di SETIAP laluan API
- [ ] Ujian penjelakan peranan: Editor cuba capai laluan Ketua Editor, mesti ditolak server
- [ ] Ujian XSS/CSRF pada borang input
Kemudian barulah pengurusan akaun sebenar:
- [ ] Cipta akaun editor (kini tiada langsung — kena masuk DB dengan tangan)
- [ ] Jemputan editor baharu melalui emel + set kata laluan pertama
- [ ] Set semula kata laluan melalui emel bertoken (bukan laluan terbuka sedia ada)

---

### [ ] Fasa 2 — Hutang ujian sedia ada · `S` · ~1 hari
- [ ] Betulkan 2 ujian gagal dalam `tests/rssDirectScore.test.js` (`parseRssXml` URL
      terpotong; `EditorialScoreEngine` pulang `BLOCKED_KEYWORD` bukan `REJECT`)
- [ ] Sahkan `npm test` hijau sepenuhnya
**Sebab awal:** selagi 2 ujian gagal jadi "normal", ujian berhenti jadi isyarat berguna —
kegagalan baharu akan hilang dalam bunyi latar.

---

### [ ] Fasa 3 — Direktori hidup · `M` · ~3 hari
- [ ] `staffList` daripada DB sebenar (kini array kosong berkod keras)
- [ ] "+ Tambah Anggota" berfungsi (Ketua Editor sahaja) — bersambung dengan Fasa 1
- [ ] Peranan & kawalan akses boleh diurus
- [ ] Carta organisasi ringkas

---

### [ ] Fasa 4 — Log Sistem · `M` · ~3 hari
- [ ] Jadual audit sebenar: siapa terbit/edit/arkib apa, bila
- [ ] Paparan di Rujukan → Log Sistem (kini placeholder "Belum Dibina")
- [ ] Log ralat server boleh dilihat di sini juga
**Dinaikkan awal** kerana panel "keaktifan editor" dashboard (Fasa 5) membaca log yang sama.

---

### [ ] Fasa 5 — Paparan Utama (dashboard) · `M` · ~3 hari
- [ ] Status kandungan (Menunggu/Aktif/Arkib)
- [ ] Draf saya + makluman terbaru
- [ ] Slot kosong/bermasalah
- [ ] Status RSS Ticker & status API cuaca (rekod ambilan terakhir + berjaya/gagal di
      server — kini tidak direkod langsung)
- [ ] Keaktifan editor (baca log Fasa 4)
- [ ] Pintasan; jadikan destinasi lalai selepas log masuk

---

### [ ] Fasa 6 — Tetapan dilengkapkan · `M` · ~3 hari
- [ ] Editor label & tooltip (UI atas `src/config/istilah.ts`)
- [ ] Maklumat/halaman polisi (sumber kandungan untuk halaman awam Fasa 11)
- [ ] Hidupkan atau buang "Glos Selari" yang kini dimatikan
- [ ] Pindahkan kawalan Jam Dunia yang tersorok di sini ke Modul Khas (Fasa 7)

---

### [ ] Fasa 7 — Modul Khas disambungkan · `L` · ~5 hari
- [ ] Jam (RSS, animasi, status) — kini kad mati "Belum disambungkan"
- [ ] Ticker — kawalan DALAM Editorium, bukan pautan keluar ke frontpage
- [ ] Slot Bar (animasi, tetapan) — kini kad mati
- [ ] Focus View (animasi, mod turutan, had aksara) — kini tiada langsung dalam senarai

---

### [ ] Fasa 8 — Editorial dilengkapkan · `XL` · skop ditetapkan Fasa 0
Antigravity betul: fasa ini terlalu kabur untuk dimulakan. Skop setiap sub-item MESTI
ditetapkan dalam Fasa 0 sebelum kerja bermula.
- [ ] 4 sub-templat semakan (ejaan / tatabahasa / gaya bahasa / format) — kini satu kotak
- [ ] Sambung `reviewPrompt` yang tergantung ke butang semakan sebenar
- [ ] Pengurusan limpahan teks
- [ ] Medan "tempoh minimum paparan" sebenar — rujukan sedia ada ke Tetapan Am adalah
      PALSU, medan itu tidak wujud
- [ ] Asingkan glosari daripada penyelarasan ejaan (kini bergabung)
- [ ] **Format sumber** — dipisahkan jadi Fasa 8b, jangan campur dengan yang di atas

### [ ] Fasa 8b — Format sumber · `L` · ~5 hari
Kerja besar tersendiri (pernah di-KIV: "nak enjin lengkap dulu"). Boleh ditangguh ke
pasca-launch jika jadual ketat — tetapi keputusan itu milik pemilik projek.

---

### [ ] Fasa 9 — SEO & penemuan · `M` · ~2 hari
- [ ] Meta / Open Graph per kandungan
- [ ] Favicon
- [ ] `sitemap.xml`
- [ ] `robots.txt`

### [ ] Fasa 10 — Suapan RSS keluar · `S` · ~1 hari
- [ ] Adjung Brief mensindiket kandungan sendiri (berbeza daripada RSS masuk Ticker)

### [ ] Fasa 11 — Halaman awam · `M` · ~3 hari
- [ ] Halaman 404 bergaya Adjung
- [ ] Tentang / Hubungi / Polisi & Penafian (kandungan diurus dari Editorium, Fasa 6)
- [ ] Perkongsian sosial — **keputusan UI, tanya dahulu**
- [ ] Carian pengunjung di frontpage — belum pasti sesuai dengan konsep bento,
      **tanya dahulu**

### [ ] Fasa 12 — Halaman Penaja · `M` · ~3 hari
- [ ] Konsol urus penaja dalam Editorium (logo, nama, pautan, susunan)
- [ ] Halaman awam penaja
- [ ] Reka bentuk & penempatan pautan di frontpage — **keputusan Ketua Editor, tanya
      dahulu**; jangan sentuh grid bento
> Antigravity cadang tangguh ke pasca-launch. **Ditolak** — pemilik projek arah masukkan
> pra-launch secara eksplisit, dan matlamat keseluruhan ialah tidak mengubah banyak selepas
> launch. Tetapi ia diletak SELEPAS SEO/RSS/404 supaya keutamaan tetap betul.

---

### [ ] Fasa 13 — Penghalusan reka bentuk Editorium · `L` · ~5 hari
Banyak konsol dibina untuk berfungsi dahulu dan belum diselaraskan dengan bahasa visual
Adjung (maroon #802334, serif, label mono huruf besar, neutral batu suam).
- [ ] Audit setiap skrin Editorium berbanding bahasa visual frontpage
- [ ] Selaraskan konsol yang paling terkebelakang (Direktori, Tetapan, Modul Khas)
- [ ] Keadaan kosong, keadaan memuat, mesej ralat — konsisten seluruh Editorium
- [ ] Kelakuan telefon/tablet untuk setiap konsol
**Diletak lewat** kerana ia menyentuh SEMUA skrin — buat awal bermakna buat dua kali.

---

### [ ] Fasa 14 — Jejak pengunjung & populariti · `M` · ~3 hari
- [ ] Beacon frontpage → server sendiri
- [ ] Jadual kiraan harian: lawatan halaman + buka-kandungan (Focus View / klik kad)
- [ ] Sambung ke panel dashboard Fasa 5
**Dipindah dari awal ke sini** (Antigravity betul): tiada pengunjung untuk dijejak sebelum
launch, jadi membinanya awal tidak memberi apa-apa maklumat. Kiraan bermula 0 pada hari
dipasang, jadi ia perlu ada SEBELUM deploy — tetapi tidak lebih awal daripada itu.

---

### [ ] Fasa 15 — Prestasi · `M` · ~2 hari
- [ ] Masa muat Frontpage dengan 38 slot penuh
- [ ] Masa tindak balas API di bawah beban
- [ ] Saiz bundle JavaScript
- [ ] Backup automatik `adjung.db` berjadual (kini manual sahaja)

---

### [ ] Fasa 16 — Panduan & Dokumentasi · `S` · ~1 hari
- [ ] Panduan: kandungan langkah demi langkah sebenar (kini placeholder)
- [ ] Semak Dokumentasi terkini dengan keadaan sistem sebenar

---

### [ ] Fasa 17 — Ujian menyeluruh & deploy · `M` · ~3 hari
- [ ] Setiap modul di browser sebenar
- [ ] Dua peranan (KETUA_EDITOR + EDITOR)
- [ ] Dua saiz skrin (desktop + telefon)
- [ ] `npm test` + `tsc` bersih sepenuhnya
- [ ] Bersihkan SEMUA data ujian
- [ ] Backup `adjung.db`
- [ ] Deploy
- [ ] Sahkan selepas deploy: log masuk, terbit satu kandungan, semak log

---

## Peraturan kerja sepanjang pelan

1. Setiap fasa: bina → sahkan visual di browser sebenar → uji → commit + push → tanda `[x]`.
2. Keputusan UI/estetika/label: perlu arahan/kelulusan Ketua Editor, bukan direka sendiri.
3. Operasi destruktif pada data: backup `adjung.db` dahulu, tiada pengecualian.
4. **Mesej commit**: Bahasa Melayu, format `jenis(skop): penerangan` (contoh
   `fix(editorium): badge profil di kanan header`).
5. **Sebelum tanda `[x]`**: `npx tsc --noEmit` bersih DAN `npm test` tiada kegagalan baharu.
6. **Prosedur rollback**: setiap fasa dikomit berasingan supaya `git revert <commit>` boleh
   memulihkan satu fasa tanpa menyentuh fasa lain. Selepas deploy gagal: revert commit
   deploy, pulihkan backup `adjung.db` yang diambil di Fasa 17.
7. **Skop membengkak**: jika satu fasa jadi ≥2× anggaran, berhenti dan lapor — jangan
   teruskan diam-diam.

---

## Kritikan Antigravity — keputusan

Diterima (9): tiada anggaran masa (#1) · Fasa 8 terlalu besar (#2) · tiada fasa hutang
ujian (#3) · kebergantungan tidak dinyatakan (#4) · jejak pengunjung terlalu awal (#5) ·
tiada fasa keselamatan (#6) · Fasa Editorial terlalu kabur (#8) · petak semak bersarang
(#9) · tiada ujian prestasi (#11).

Ditolak (2):
- **#7 (tangguh Halaman Penaja ke pasca-launch)** — bercanggah dengan arahan eksplisit
  pemilik projek. Diletak lewat dalam jujukan, tetapi kekal pra-launch.
- **#10 sebahagian (proses semakan kod sebelum merge)** — tiada pasukan pemaju; semakan
  kod formal antara dua orang tidak memberi apa-apa di sini. Konvensyen commit dan
  prosedur rollback daripada kritikan yang sama diterima.
