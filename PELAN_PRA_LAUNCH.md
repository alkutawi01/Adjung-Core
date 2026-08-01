# Pelan Pelaksanaan Pra-Launch — Adjung Brief

Ditetapkan 2026-08-01 (Izzat, Ketua Editor). Matlamat: semua fungsi asas/standard portal
siap dan boleh dikawal dalam Editorium SEBELUM launch — "tak nak kena ubah banyak benda
selepas launch nanti." Tanda `[x]` setiap fasa apabila siap (dibina, disahkan visual di
browser, diuji, dikomit).

> Nota: folder `specification/` menerangkan produk LAIN (Folio/Biography) — pelan ini
> sahaja rujukan pelaksanaan untuk Adjung Brief.

## Keputusan sedia dibuat

- **Paparan Utama (dashboard)**: item pertama sidebar, di atas kumpulan Penerbitan,
  destinasi lalai selepas log masuk. Kandungan: status kandungan (Menunggu/Aktif/Arkib),
  draf saya, makluman terbaru, slot bermasalah, pintasan, bilangan pengunjung, kandungan
  paling diminati, status RSS, status API, keaktifan editor.
- **Jejak pengunjung**: dibina sendiri dalam sistem — tiada pihak ketiga (bukan Google
  Analytics), tiada cookie, tiada data peribadi pengunjung; kiraan harian sahaja dalam
  `adjung.db`. Kiraan bermula 0 pada hari dipasang.
- Kumpulan sidebar ketiga bernama **"Rujukan"** (dulu "Sistem").

## Fasa

- [ ] **Fasa 1a — Dashboard, data sedia ada**
  Panel: status kandungan, draf saya, makluman terbaru, slot kosong/bermasalah, status
  RSS Ticker & status API cuaca (rekod ambilan terakhir + berjaya/gagal di server —
  kini tidak direkod). Jadikan destinasi lalai.

- [ ] **Fasa 1b — Jejak pengunjung & populariti**
  Beacon frontpage → server sendiri; jadual kiraan harian lawatan halaman +
  buka-kandungan (Focus View / klik kad). Papar di dashboard.

- [ ] **Fasa 2 — Log Sistem** *(dinaikkan awal daripada fasa hujung)*
  Jadual audit sebenar (siapa terbit/edit/arkib apa, bila) — backend + paparan di
  Rujukan → Log Sistem, DAN panel "keaktifan editor" dashboard baca log yang sama.

- [ ] **Fasa 3 — Direktori hidup**
  `staffList` daripada DB sebenar (kini array kosong berkod keras), "+ Tambah Anggota"
  berfungsi (Ketua Editor sahaja), carta organisasi ringkas.

- [ ] **Fasa 4 — Editorial dilengkapkan**
  4 sub-templat semakan (ejaan / tatabahasa / gaya bahasa / format — kini satu kotak);
  sambung `reviewPrompt` ke butang semakan sebenar; pengurusan limpahan teks; medan
  "tempoh minimum paparan" sebenar (rujukan sedia ada ke Tetapan Am adalah palsu —
  medan itu tidak wujud); **format sumber** (kerja besar — boleh dipisah jadi fasa
  sendiri jika membengkak).

- [ ] **Fasa 5 — Modul Khas disambungkan**
  Jam (status/animasi — pindahkan kawalan yang kini tersorok dalam Tetapan → Operasi),
  Ticker (kawalan DALAM Editorium, bukan pautan keluar ke frontpage), Slot Bar,
  Focus View (animasi, mod turutan, had aksara).

- [ ] **Fasa 6 — Tetapan dilengkapkan**
  Editor label & tooltip (UI atas `src/config/istilah.ts`), maklumat/halaman polisi,
  hidupkan atau buang "Glos Selari" yang kini dimatikan.

- [ ] **Fasa 7 — Halaman Penaja**
  Halaman awam penaja + konsol urus penaja dalam Editorium (logo, nama, pautan,
  susunan). Reka bentuk & penempatan pautan di frontpage = keputusan Ketua Editor —
  tanya dulu sebelum bina paparan awam; jangan sentuh grid bento.

- [ ] **Fasa 8 — Fungsi standard portal** (senarai kelengkapan pra-launch)
  - SEO: meta / Open Graph per kandungan, favicon, sitemap.xml, robots.txt
  - Suapan RSS KELUAR (Adjung Brief mensindiket kandungan sendiri)
  - Halaman 404 bergaya Adjung
  - Halaman awam Tentang / Hubungi / Polisi & Penafian (kandungan diurus dari Editorium)
  - Perkongsian sosial — keputusan UI, tanya dulu
  - Carian pengunjung di frontpage — belum pasti sesuai dengan konsep bento; tanya dulu
  - Backup automatik `adjung.db` berjadual (kini manual sahaja)
  - Log ralat server yang boleh dilihat (numpang Log Sistem Fasa 2)

- [ ] **Fasa 9 — Rujukan dilengkapkan**
  Panduan (kandungan langkah demi langkah sebenar), semak Dokumentasi terkini.

- [ ] **Fasa 10 — Ujian menyeluruh & deploy**
  Setiap modul di browser, dua peranan (KETUA_EDITOR + EDITOR), dua saiz skrin
  (desktop + telefon), `npm test` + `tsc` bersih, bersihkan SEMUA data ujian,
  backup `adjung.db`, deploy.

## Peraturan kerja sepanjang pelan

1. Setiap fasa: bina → sahkan visual di browser sebenar → uji → commit + push → tanda `[x]`.
2. Keputusan UI/estetika/label: perlu arahan/kelulusan Ketua Editor, bukan direka sendiri.
3. Operasi destruktif pada data: backup `adjung.db` dahulu, tiada pengecualian.
