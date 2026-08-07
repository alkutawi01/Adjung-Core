# Simulasi Tetapan Animasi Per-Slot — Kelemahan UX & Cadangan

**Tarikh:** 2026-08-07 · **Kaedah:** ditetapkan terus melalui DB (sandaran dibuat dahulu, data ujian dipulihkan selepas), diperhati di browser sebenar dengan pengukuran computed style, bukan agakan.

## Persediaan ujian

4 slot dengan carousel sebenar (≥2 kandungan lulus), merentas tier berbeza, diberi gabungan tetapan melampau dengan sengaja:

| Slot | Tier | Jenis animasi | Arah | Warna panel | Kelajuan | Logo |
|---|---|---|---|---|---|---|
| 1 | MENEGAK | Gerak Susun | **Bawah** | `#1D4ED8` biru | 2× | Tiada |
| 3 | SEGI_EMPAT_SMALL | Sapuan Lajur | Kiri | `#15803D` hijau | 0.5× | Penaja |
| 6 | STANDARD | Colophon | Atas | `#EAB308` **kuning** | 1× | Adjung |
| 13 | SEGI_EMPAT_MEDIUM | Gerak Susun | Kanan | `#802334` maroon | **4×** | Ikut am |

(Slot 6/13/26/32 asalnya tiada kandungan lulus — 2 rekod diarkibkan-semula sementara khas untuk ujian ini pada slot 6 dan 13, dipulihkan ke status asal selepas selesai.)

## Penemuan

### 1. TINGGI — Tiada semakan kontras pada warna panel pilihan bebas
Slot 6 (kuning `#EAB308`) diukur: nisbah kontras teks putih wordmark Adjung ialah **1.89** — jauh di bawah ambang WCAG AA malah untuk teks besar (perlu ≥3). Bandingkan: maroon lalai `#802334` = 9.35, biru ujian = 6.59, hijau ujian = 4.93.

Sebab: `warnaPanelOverride` (dan `warnaPanelTransisi` global) menerima **sebarang** hex sah tanpa had — pemilih warna dalam modal tetapan slot ialah `<input type="color">` bebas, tiada semakan terhadap warna teks/logo yang bakal diletakkan di atasnya. Wordmark Adjung dan sebarang logo penaja SENTIASA putih/cream (`#FDFDFD`) — jadi mana-mana warna cerah (kuning, oren muda, putih sendiri) menjadikan logo tak terbaca sepenuhnya semasa transisi.

**Cadangan:** kira nisbah kontras terus dalam modal tetapan slot (formula sama seperti yang saya guna di atas — WCAG relative luminance) semasa editor memilih warna, dan papar amaran visual ("Kontras rendah — logo mungkin sukar dibaca") bila nisbah < 3. Tak perlu SEKAT pemilihan (editor mungkin ada sebab), cukup beri isyarat sebelum simpan.

### 2. SEDERHANA — Arah "Atas"/"Bawah" boleh dipilih untuk Gerak Susun walaupun tak berkesan
Slot 1 ditetapkan arah **Bawah** dengan jenis Gerak Susun. Kod (`FrontpageView.tsx:807-808`) mengira `kanan = arahEfektif !== 'kiri'` — jadi SEBARANG nilai selain "Kiri" (termasuk "Atas", "Bawah") senyap jatuh ke kelakuan "Kanan". Disahkan: transisi sebenar bergerak ke kanan walaupun "Bawah" dipilih.

Fail sedia ada sudah ada nota kecil di bawah dropdown ("Gerak Susun cuma sokong arah Kanan/Kiri — Atas/Bawah jatuh balik ke Kanan") — tapi ini **teks kecil pasif**, bukan sekatan aktif. Editor yang tak baca nota tu akan tertanya-tanya kenapa pilihan "Bawah" dia "tak jadi".

**Cadangan:** dropdown Arah patut **dinamik ikut Jenis Animasi dipilih** — bila Gerak Susun dipilih, opsyen Atas/Bawah disorok/dilumpuhkan terus (bukan sekadar nota di bawah), supaya UI sendiri tak tawarkan pilihan yang tak bermakna. Corak yang sama patut disemak untuk kombinasi lain (adakah semua 4 arah sah untuk Colophon/Sapuan Lajur? — daripada bacaan kod, ya, kedua-dua jenis tu sokong semua 4 arah, jadi cuma Gerak Susun yang perlu dikhususkan).

### 3. RENDAH-SEDERHANA — Kelajuan disahkan berfungsi tepat, tapi 4× amat perlahan tanpa amaran
Slot 13 (kelajuan 4×) diukur: tempoh transisi sebenar = 3600ms (900ms × 4), tepat ikut formula. **Mekanisme kelajuan itu sendiri betul.** Tapi UX: 3.6 saat untuk SATU transisi carousel ialah amat perlahan berbanding 900ms lalai — editor yang set 4× tanpa pratonton langsung mungkin tak sedar betapa perlahan ia rasa pada pelawat sebenar sehingga dia lawat frontpage sendiri.

**Cadangan:** modal tetapan slot patut ada **pratonton mini** (animasi kecil dalam modal itu sendiri, guna tetapan semasa draf) supaya editor nampak kesan sebelum simpan — bukan perlu buka tab frontpage berasingan untuk sahkan. Ini juga membantu penemuan #1 (kontras) — pratonton akan mendedahkan terus logo tak terbaca.

### 4. SEDERHANA — Logo penaja sebenar tiada jaminan sepadan warna panel arbitrari
Ujian mod "Penaja" (slot 3, panel hijau) dengan satu penaja ujian (logo `adjung-symbol.svg`, segi empat maroon pekat) disahkan: laluan positif (bukan jatuh balik) berfungsi — logo penaja sebenar dipaparkan. Tapi secara reka bentuk: logo penaja ialah **imej diupload pihak luar** dengan warna sendiri yang pentadbir tak boleh kawal, diletakkan atas warna panel yang KINI boleh dipilih bebas per-slot. Kombinasi warna panel + logo penaja tak lagi terjamin serasi seperti dulu (bila warna panel satu sahaja, seragam, mudah disemak sekali untuk semua penaja).

**Cadangan:** di halaman urus Penaja (Editorium), papar pratonton logo tu atas 2-3 sampel warna panel yang lazim digunakan (maroon lalai + mana-mana warna custom yang sedang aktif di slot mana-mana), supaya Pentadbir nampak awal jika ada penaja dengan logo warna terang yang bakal hilang atas panel terang juga.

### 5. RENDAH — Jatuh balik "Penaja" ke Adjung disahkan selamat, tapi senyap
Bila tiada penaja layak (ujian awal, 0 penaja dalam DB), mod "Penaja" jatuh balik ke logo Adjung dengan betul — **tiada panel kosong**, sepadan spesifikasi. Tapi ini berlaku senyap sepenuhnya; editor yang set slot ke "Logo penaja sahaja" tak dapat tahu (dari frontpage sahaja) sama ada penaja sebenar sedang dipaparkan atau ia sedang jatuh balik kerana tiada penaja aktif bulan ini.

**Cadangan:** dalam modal tetapan slot, di sebelah pilihan "Logo penaja sahaja", papar status masa nyata kecil: "X penaja layak bulan ini" atau "Tiada penaja layak — akan jatuh balik ke logo Adjung" — supaya keputusan jatuh balik itu KELIHATAN pada editor semasa dia menetapkan, bukan hanya tersirat dalam gelagat runtime.

## Kesimpulan

Mekanisme teras (kelajuan, warna, jatuh balik logo) **berfungsi tepat** — semua nombor yang diukur sepadan formula yang dilaksanakan. Kelemahan yang ditemui semuanya di peringkat **maklum balas kepada editor semasa membuat pilihan**, bukan pepijat pengiraan:
- tiada amaran kontras (#1, TINGGI)
- pilihan UI tawarkan opsyen tak berkesan tanpa sekatan aktif (#2, SEDERHANA)
- tiada pratonton sebelum simpan (#3/#4, SEDERHANA)
- keputusan jatuh balik senyap (#5, RENDAH)

Cadangan #1 dan #2 boleh dilaksanakan segera (logik mudah, tiada keputusan reka bentuk besar). #3 (pratonton mini) ialah kerja lebih besar — perlu keputusan Izzat sama ada berbaloi berbanding kerja lain dalam senarai tunggu.
