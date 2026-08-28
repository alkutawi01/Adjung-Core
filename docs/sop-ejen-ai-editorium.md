# SOP: Ejen AI Mengisi & Menerbitkan Kandungan di Editorium Adjung Brief

Disusun 28 Ogos 2026 selepas beberapa pembetulan kritikal semasa sesi kerja langsung
(kesilapan sebenar yang berlaku dan dibetulkan Izzat — lihat nota "Kenapa peraturan ni wujud"
pada setiap seksyen). SOP ni WAJIB dibaca sebelum ejen mengisi mana-mana medan Editorium.

---

## 0. Prinsip teras (baca dulu sebelum semua yang lain)

**Adjung Brief ialah PORTAL BERITA, bukan Wikipedia, bukan ensiklopedia, bukan majalah sejarah.**
Setiap kandungan mesti ada sebab pembaca patut tahu HARI INI — peristiwa, pengumuman,
laporan, dasar atau perkembangan sebenar yang BARU berlaku. Kalau satu-satunya "hook"
kandungan ialah "institusi X ditubuhkan tahun Y, jadi tahun ni genap Z tahun" TANPA apa-apa
perkembangan baharu menyertainya — itu bukan berita, JANGAN tulis.

> **Kenapa peraturan ni wujud:** sepanjang satu sesi, berpuluh kandungan format "X genap N
> tahun" diterbitkan tanpa disoal nilai beritanya, sehingga Izzat tegur terus: *"ni berita
> apa? ada nilai ke? ni bukan wikipedia atau majalah, tp portal berita."*

---

## 1. Cara ekstrak fakta daripada sumber TANPA reka-reka

1. **WAJIB baca/WebFetch artikel sumber SEBENAR** — jangan bergantung semata-mata pada
   snippet carian (WebSearch). Snippet boleh terpotong, salah petik atau ketinggalan konteks.
2. **Rujuk sumber RASMI, bukan Wikipedia.** Wikipedia boleh digunakan sebagai alat
   penyelidikan LATAR BELAKANG sahaja (untuk faham konteks, cari nama rasmi, dsb.) — tapi
   citation akhir (medan "Nama sumber" & "URL") mesti tunjuk kepada laman rasmi institusi,
   siaran akhbar, laporan rasmi, atau liputan media bertarikh — bukan Wikipedia.
   - *Kenapa:* Wikipedia bukan portal berita/organisasi berautoriti yang menerbitkan pada
     tarikh tertentu; ia halaman wiki yang sentiasa disunting, tiada "tarikh artikel" sebenar.
3. **Setiap fakta (nombor, tarikh, nama, jawatan, petikan) mesti boleh dikesan terus kepada
   ayat tertentu dalam sumber.** Kalau tak pasti, JANGAN tulis fakta itu — buang atau
   generalisasikan (cth: "beberapa" bukan angka tepat yang diteka).
4. **Kalau dua sumber berbeza fakta** (cth tarikh penubuhan, bilangan ahli), JANGAN pilih
   sewenang-wenangnya — sama ada (a) cari sumber PALING rasmi/authoritative dan guna itu, (b)
   guna framing kabur yang selamat merentasi kedua-dua ("awal 1920-an" bukan "1920" tepat),
   atau (c) laporkan percanggahan tu terus kepada Izzat sebelum terbit kalau ia fakta teras.
5. **Semak draf dengan ChatGPT (tab "seed") sebelum terbit** — ChatGPT sepanjang sesi ni
   berjaya kesan banyak kesilapan fakta sebenar (nombor negara Interpol salah, tarikh
   presiden NGS salah, kronologi USM tersasar, dll). Baca respons PENUH (innerText lengkap),
   tunggu dan check semula sebelum simpulkan "ChatGPT stuck" — jangan extract fragment sahaja.

---

## 2. Standard gaya penulisan Bahasa Melayu Adjung Brief

- **Neutral** — elak bahasa pujian/hiasan berlebihan ("hebat", "inovatif", "bersejarah")
  melainkan itu petikan langsung daripada sumber.
- **Padat** — satu ayat, satu idea. Elak ayat berbelit dengan banyak anak ayat.
- **Berasaskan fakta** — setiap dakwaan mesti disandarkan fakta daripada sumber, bukan
  tafsiran/spekulasi ejen.
- **Mudah dibaca** — bentuk penuh Bahasa Melayu (bukan "tak/ni/tu/drpd"), imbuhan betul
  (meN-, di- bercantum, -kan/-i tepat — rujuk CLAUDE.md "Panduan Bahasa Melayu Adjung" untuk
  senarai penuh kesilapan imbuhan biasa).
- **Elak nada "ulasan ensiklopedia"** — jangan tulis seolah-olah artikel Wikipedia
  diterjemah terus (cth elak "ditubuhkan pada [tahun] ... kini merupakan salah satu ...").
  Tulis macam berita: SIAPA buat APA, BILA, di MANA, kenapa ia penting.
- **Elak frasa spekulatif/belum pasti** — kalau sumber guna "meneroka", "mencadangkan",
  "berpotensi", KEKALKAN nada tentatif tu dalam Bahasa Melayu (jangan tukar jadi pasti/rasmi
  kalau sumber sendiri tak pasti).

---

## 3. Had dan sasaran setiap medan

> **PENTING:** had aksara SEBENAR untuk Tajuk, Huraian ringkas dan bajet kongsi
> **BERBEZA-BEZA ikut tier/slot** (KOMPAK boleh serendah Tajuk 11 aksara bila Huraian ringkas
> panjang; slot lain sampai 250). **JANGAN anggap had di bawah ni muktamad** — ia cuma
> ANGGARAN biasa. WAJIB scan label sebenar (`Topik0/25`, `TajukN/XXX`, dll.) dalam DOM borang
> SEBAIK modal dibuka, setiap kali, sebelum isi apa-apa. Had berubah ikut slot yang dipilih.

| Medan | Anggaran had | Nota |
|---|---|---|
| Topik | maks 25 aksara | Perkataan PENUH, bukan singkatan (cth "Antarabgs" DILARANG) |
| Tajuk | maks 130 aksara (berubah ikut tier) | Sentence case, tiada penilaian editorial ("pacu", "hebat") melainkan neutral |
| Huraian ringkas | maks ~400 aksara (berubah ikut tier) | Mesti cukup padat untuk penuhi sekurang-kurangnya 80% "BAJET KANDUNGAN" — lihat §5 |
| Huraian panjang | 1,200–1,800 aksara (tetap merentasi tier) | Struktur berperenggan — lihat §4 |
| Nama sumber | maks 25-50 aksara (berubah ikut Tetapan Am slot) | Guna nama ringkas rasmi (cth "Suruhanjaya Sekuriti Malaysia" → boleh singkat "SC" kalau nama penuh > had) |
| URL | — | URL PENUH terus ke artikel/siaran akhbar sumber, bukan halaman utama laman |
| Tarikh sumber | format ISO YYYY-MM-DD | **Tarikh YANG TERTERA PADA SUMBER itu sendiri** (dateline artikel/siaran akhbar) — lihat §6 |
| Nota editor | maks 280 aksara, PILIHAN | Konteks tambahan untuk editor lain, bukan bahagian kandungan awam |

**Bajet ruang kad (kongsi Tajuk + Huraian ringkas):**
Formula: `tajuk.length/maxTajukSendiri + huraianRingkas.length/maxHuraianSendiri <= 1`,
dipaparkan sebagai peratus "BAJET KANDUNGAN" secara langsung dalam borang.
- **Sasaran: 82%–95%.** ELAK tepat 80% (pepijat pelayan sebenar kadang tolak nilai tepat 80%
  sebagai "terlalu ringkas" walaupun UI nampak macam ambang minimum diterima).
- ELAK melebihi 95% (risiko overflow kad jika anggaran tak tepat) dan ELAK di bawah 82%
  (bazir ruang kad, tajuk/huraian nampak terlalu ringkas berbanding kad lain).
- Kalau peratus terlalu rendah/tinggi, LARAS PANJANG TEKS (bukan reka fakta baharu) sehingga
  jatuh dalam julat sasaran — laras Huraian ringkas biasanya lebih senang daripada Tajuk.

---

## 4. Struktur Huraian panjang yang sesuai untuk berita

Susun ikut piramid terbalik (fakta paling penting dahulu), BUKAN kronologi/naratif
ensiklopedia:

1. **Perenggan 1 — Apa & Bila & Siapa.** Nyatakan peristiwa/pengumuman teras dalam SATU/DUA
   ayat pertama: siapa buat apa, bila, di mana. Ini mesti boleh berdiri sendiri walau pembaca
   tak baca perenggan lain.
2. **Perenggan 2-3 — Butiran & konteks.** Nama, angka, petikan, latar belakang yang relevan
   TERUS kepada peristiwa tu (bukan sejarah penuh institusi melainkan relevan).
3. **Perenggan akhir — Kesan/kepentingan.** Kenapa ni penting, apa kesannya, atau apa
   langkah seterusnya (kalau ada dalam sumber).
4. **Pisah ikut PERUBAHAN IDEA** (guna `\n\n` antara perenggan), bukan bilangan tetap —
   jangan satu blok teks tanpa perenggan (AI cenderung buat ni bila tak diarah eksplisit).
5. **JANGAN tulis nota "keterbatasan pengetahuan AI"** ("maklumat lanjut tidak tersedia",
   dsb.) — kalau maklumat tak cukup, DIAM sahaja pasal fakta tu, jangan mengaku dalam teks.

---

## 5. Senarai semak SEBELUM tekan "Terbit sekarang"

- [ ] **Nilai berita disahkan** — ada peristiwa/pengumuman/perkembangan BAHARU, bukan sekadar
  fakta sejarah/tarikh penubuhan semata-mata (§0).
- [ ] Semak Kandungan->Indeks, tapis ikut Slot sasaran, PASTIKAN tiada topik pertindihan
  dengan kandungan sedia ada dalam slot sama.
- [ ] Semua fakta disahkan terus daripada sumber rasmi (WebFetch, bukan snippet) — §1.
- [ ] Draf disemak ChatGPT (atau AI lain jika ChatGPT stuck selepas re-check penuh) — §1.
- [ ] Label had aksara SETIAP medan disemak fresh dalam DOM borang (bukan anggap daripada
  sesi lalu) — Topik, Tajuk, Nama sumber semua ada had berbeza ikut slot.
- [ ] Bajet "BAJET KANDUNGAN" berada dalam 82%-95%.
- [ ] Huraian panjang 1200-1800 aksara, berperenggan (§4).
- [ ] **Sumber = laman rasmi institusi/siaran akhbar/liputan media bertarikh — BUKAN
  Wikipedia.**
- [ ] **Tarikh sumber = tarikh SEBENAR yang tertera pada sumber tu** (bukan tarikh saya
  akses, bukan tarikh peristiwa sejarah dalam kandungan, bukan hari ni) — §6. Kalau sumber
  rasmi tiada tarikh jelas, BIARKAN MEDAN KOSONG, jangan reka.
- [ ] Elak topik amalan/ibadah untuk slot Syariah & Al-Quran dan Sunnah.
- [ ] Elak topik pertandingan/gelaran kecantikan atau gelaran fizikal wanita (dasar Syariah
  editorial, terpakai MERENTASI SEMUA slot, bukan slot agama sahaja).
- [ ] Kalau kandungan bersifat sensitif-masa (cth keputusan dasar yang dijangka dikemas kini
  semula tak lama lagi — macam OPR BNM sebelum mesyuarat MPC seterusnya), SEMAK sama ada
  fakta tu masih SAH pada tarikh dijadualkan terbit, bukan hanya sah pada tarikh ditulis.
- [ ] Selepas klik Terbit, verify via `fetch('/api/system/content/all', {cache:'no-store'})`
  cari tajuk baharu — JANGAN percaya modal tertutup senyap = berjaya. Kalau item tak muncul,
  guna `read_network_requests` cari POST yang return 400/lain, baca mesej ralat SEBENAR
  (bukan senyap gagal tanpa sebab).

---

## 6. Cara kendali kes khas

**Fakta tidak lengkap** — jangan isi jurang dengan tekaan. Buang ayat/fakta tu, atau
generalisasikan tanpa angka tepat ("beberapa", "sejumlah") HANYA jika sumber sendiri tak beri
angka — jangan generalais untuk sembunyikan fakta yang sumber SEBENARNYA ada tapi ejen malas
cari.

**Konflik sumber** — lihat §1.4. Jangan pilih rawak; either cari sumber paling authoritative,
guna framing kabur yang selamat, atau tanya Izzat kalau fakta teras kandungan bergantung padanya.

**Angka** — salin terus daripada sumber (jangan bulatkan/anggar tanpa nyatakan "kira-kira").
Semak unit (RM vs USD vs mata wang lain, peratus vs mata peratusan).

**Tarikh** — WAJIB semak arithmetik sebelum tulis "genap N tahun": kira `tahun_semasa -
tahun_penubuhan`, DAN sahkan bulan/hari ulang tahun tu SUDAH lepas berbanding tarikh
kandungan dijadualkan terbit (bukan tarikh kandungan ditulis) — kalau belum lepas, guna
"menjelang ulang tahun ke-N pada [tarikh]" atau "sejak [tahun]" sebaliknya.

**Petikan** — petik terus (verbatim) daripada sumber, letak dalam tanda petikan kalau ejaan
langsung; jangan parafrasa lalu letak macam petikan langsung. Nyatakan siapa cakap & jawatan
penuh.

**Dakwaan (angka pencapaian, kedudukan, ranking, dsb.)** — sahkan tahun data konsisten
(jangan campur statistik dari tahun berbeza sebagai satu dakwaan tunggal — kesilapan sebenar
pernah berlaku bila draf campur data 2018 dengan 2020 sebagai satu dakwaan).

**Pautan (URL)** — mesti URL terus ke artikel/siaran akhbar SPESIFIK yang digunakan sebagai
sumber fakta, bukan URL halaman utama laman web yang generik.

**Tarikh sumber — PERBEZAAN PENTING (kesilapan kritikal yang pernah berlaku, JANGAN ulang):**
"Tarikh sumber" = tarikh yang **tertera PADA artikel/siaran akhbar/laporan itu sendiri**
(macam dateline "Diterbitkan pada 1 Ogos 2026" dalam artikel Berita Harian). **BUKAN:**
- ❌ Tarikh ejen mengakses/membaca sumber tu.
- ❌ Tarikh peristiwa sejarah yang DICERITAKAN dalam kandungan (cth Malaysia merdeka 1957 —
  1957 BUKAN "tarikh sumber" walau kandungan ni pasal kemerdekaan).
- ❌ Tarikh kandungan Adjung ditulis/diterbitkan (itu "Tarikh siaran", medan berasingan yang
  sistem sendiri jejak — ejen tak perlu isi).
Kalau sumber (cth laman "Tentang Kami" institusi tanpa tarikh) tiada tarikh jelas langsung,
**biarkan medan Tarikh sumber KOSONG** — jangan reka tarikh sebarangan (1 Januari tahun
penubuhan, tarikh hari ni, dll.) hanya kerana medan tu nampak wajib diisi.

---

## 7. Larangan mutlak

- **JANGAN** tokok tambah fakta, angka, tarikh, petikan, nama atau kesimpulan yang tiada
  dalam sumber — walau nampak "munasabah" atau "biasanya begitu".
- **JANGAN** guna Wikipedia sebagai citation "Nama sumber"/"URL" akhir.
- **JANGAN** reka tarikh untuk medan "Tarikh sumber" bila sumber sebenar tiada tarikh —
  biarkan kosong.
- **JANGAN** terbitkan kandungan "genap N tahun" semata-mata tanpa perkembangan/pengumuman
  baharu menyertainya.
- **JANGAN** anggap had aksara medan sama merentasi semua slot — scan label fresh setiap
  modal baharu dibuka.
- **JANGAN** anggap modal tertutup selepas klik "Terbit sekarang" bermakna berjaya — sentiasa
  verify via API/fetch.
- **JANGAN** tulis nota "keterbatasan pengetahuan AI" terus dalam kandungan awam.
- **JANGAN** simpulkan ChatGPT "stuck" tanpa baca innerText PENUH mesej terakhir dan
  re-check selepas tunggu tambahan.
