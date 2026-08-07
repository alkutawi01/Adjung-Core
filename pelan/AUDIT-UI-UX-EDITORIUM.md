# AUDIT UI/UX EDITORIUM — Kelemahan & Cadangan Penyelesaian

**Tarikh:** 2026-08-07 · **Kaedah:** audit kod tiga dimensi (kebolehcapaian, borang, navigasi) + ujian langsung dalam browser sebenar
**Status:** LAPORAN SAHAJA — tiada apa dilaksanakan. Semua keputusan UI/UX menunggu kelulusan Izzat.

> Penemuan bertanda **[DISAHKAN MATA]** telah diuji sendiri dalam browser, bukan sekadar dibaca daripada kod.

**Jumlah: 47 kelemahan.** Disusun ikut kesan pada kerja editorial harian, bukan ikut modul.

---

## A. PEPIJAT SEBENAR (bukan soal citarasa — ini rosak)

### A1. Sidebar menyerlahkan destinasi yang SALAH — TINGGI **[DISAHKAN MATA]**
`EditoriumLayout.tsx:99` menyimpan `currentTab` sebagai state sendiri daripada prop `activeTab`, dibaca **sekali** semasa lekapan, tanpa `useEffect` menyegerakkannya. Tetapi kandungan boleh menukar destinasi sendiri: pintasan Paparan Utama (`EditoriumView.tsx:373`), "Urus Jam Dunia" (`:464`), "Urus Penaja" (`:501`).

Ujian saya: dari Modul Khas → klik "Urus Penaja" → kandungan memapar **Penaja**, sidebar masih menyerlahkan **Modul Khas**. Lebih teruk: klik "Penaja" di sidebar selepas itu tidak berkesan langsung, kerana `currentTab` menyangka ia sudah di sana.

**Penyelesaian:** buang state pendua; jadikan `activeTab` prop terkawal sepenuhnya. **Usaha: kecil.**

### A2. Butang "Kembali" browser mencampak keluar Editorium — TINGGI **[DISAHKAN MATA]**
Ujian saya: lawat Direktori → Log Sistem → Panduan, tekan Kembali **sekali** → terus keluar ke frontpage (`/`). Tiada entri sejarah pernah dicipta untuk pertukaran modul.

**Penyelesaian:** sebahagian daripada C1 di bawah. **Usaha: sederhana.**

---

## B. KEHILANGAN KERJA (paling merosakkan bagi editor yang menaip teks sebenar)

### B1. Modal Ticker langsung tiada perlindungan draf — TINGGI
`TickerManagementModal.tsx:324` (X) dan `:897` (Tutup) memanggil `onClose` terus. Tiada semakan draf, tiada `beforeunload`. **Ticker satu-satunya slot yang membawa kandungan SEBENAR** (selebihnya data ujian) — jadi ini satu-satunya tempat kehilangan kerja benar-benar mahal hari ini.
**Penyelesaian:** salin corak `tryClose()` yang SUDAH wujud di `SlotManagerModal.tsx:637` + `beforeunload` (`:641-651`). **Usaha: kecil.**

### B2. Klik latar menutup borang yang sedang ditaip — TINGGI
`SenaraiSlotConsole.tsx:480`, `:542`; `DirektoriConsole.tsx:466` (nama/e-mel/peranan); `ProfilEditorModal.tsx:204`. Hanya dilindungi `!menyimpan`, bukan keadaan kotor.
**Penyelesaian:** satu cangkuk kongsi `useAmaranBelumSimpan(kotor)` yang memulangkan `cubaTutup()`, disalurkan melalui SEMUA laluan tutup (X, latar, Escape, Batal). Satu fail baharu + enam laluan panggilan. **Usaha: kecil-sederhana.**

### B3. Menukar modul semasa borang berisi — SEDERHANA
Konsol dilepaskan (unmount) apabila tab bertukar; `NotaKetuaEditorConsole` (`:130-156`) dan `EditorialConsole` (`:183-226`) memegang teks dalam state tempatan sahaja. Klik nav = teks hilang, senyap.

### B4. Butang "Sunting" nota menimpa kerja separuh siap — SEDERHANA
`NotaKetuaEditorConsole.tsx:121` menulis ganti `tajuk`/`kandungan` tanpa amaran. Sedang menaip nota baharu, terklik pensel pada nota lain → perenggan hilang.

### B5. Semakan kerja-belum-simpan tidak lengkap — RENDAH
`SlotManagerModal.tsx:352` hanya mengambil kira `title` dan `brief`. Mengubah `briefLong`, `topik`, `source`, `url` atau imej **tidak** mencetuskan amaran tutup.

---

## C. ORIENTASI & NAVIGASI

### C1. Seluruh Editorium hanya SATU URL — TINGGI **[DISAHKAN MATA]**
`App.tsx:365` — satu `Route path="/editorium"`; kedudukan hidup dalam `useState`. Ujian saya: berada di Direktori → tekan F5 → **dicampak balik ke Paparan Utama**.
Kesan penuh: tidak boleh tanda buku; tidak boleh kongsi pautan ("klik sidebar, Slot, tab ketiga"); muat semula membuang kedudukan; Kembali mengeluarkan terus (A2); Kembali semasa modal terbuka meninggalkan laman tanpa amaran.
**Penyelesaian:** `/editorium/:modul/:subModul?`. Peta id→segmen sudah wujud di `EditoriumLayout.tsx:56-85`. Ini SATU kerja yang menyelesaikan A2, C1, C2 dan C7 serentak. **Usaha: sederhana.**

### C2. Sub-tab tidak kelihatan dan hilang pada muat semula — TINGGI
`kandunganSubTab`/`slotSubTab`/`rujukanSubTab` (`EditoriumView.tsx:144`, `:146`, `:149`). Sidebar cuma tunjuk "Slot", bukan "Slot › Tier Kad".
Bonus pepijat: `tetapanTujuSubTab` (`:127`) **tidak pernah ditetapkan semula** selepas digunakan — sekali klik pintasan "Jam Dunia", setiap lawatan Tetapan selepas itu melompat ke Operasi sepanjang sesi.

### C3. Rel ikon 72px: destinasi sukar ditemui — SEDERHANA-TINGGI
Lalai terlipat (`EditoriumLayout.tsx:122`); label hanya wujud apabila terbuka (`:235`). **Dua klik** setiap tukar modul (klik pertama cuma membuka), dan sidebar tidak menutup sendiri selepas memilih — jadi klik ketiga diperlukan untuk mendapatkan semula ruang. Disemat: satu klik.
Tooltip guna atribut `title=` asli (`:218-222`), bukan komponen `Tooltip` projek — **tidak muncul pada fokus papan kekunci**, jadi pengguna papan kekunci mendapat sebelas ikon tanpa nama.
Butang semat hanya kelihatan apabila sidebar sudah terbuka (`:407`) — editor baharu perlu menemuinya secara tak sengaja.
**Penyelesaian:** ganti `title=` dengan `<Tooltip>` (sudah menyokong `onFocus`, `Tooltip.tsx:76-77`); pertimbangkan semat sebagai lalai log masuk pertama.

### C4. Tiada penunjuk arah selain sidebar — SEDERHANA
`document.title` tidak pernah berubah — kekal "Adjung Brief" pada kesemua 15 modul. Beberapa tab browser terbuka menjadi tidak dapat dibezakan. Tiada remah roti.
**Penyelesaian:** `document.title = "<Modul> — Editorium · Adjung Brief"` seiring C1. **Usaha: kecil.**

---

## D. MAKLUM BALAS SISTEM

### D1. Sesi tamat: tiada jalan pulih, dan paparan tidak konsisten — TINGGI **[DISAHKAN MATA]**
Tiada pemintas 401 di klien langsung (carian `401` merentas `src/` — sifar). Setiap konsol mengendalikannya sendiri.
Ujian saya: Draf Saya dan Nota Ketua Editor memaparkan "Sesi anda telah tamat"; Direktori, Log Sistem dan Kandungan **tidak** — sebahagiannya mereput senyap. Satu punca, tiga pengalaman berbeza.
Pada masa sama `authUser` masih dalam localStorage, jadi header tetap memaparkan nama editor dengan **titik hijau "aktif"** dan borang log masuk tidak pernah terbuka.
**Penyelesaian:** satu pembungkus `fetch` kongsi; pada 401 → kosongkan sesi, buka `LoginModal`, kekalkan modul semasa supaya editor kembali ke skrin yang sama. **Usaha: sederhana.**

### D2. Mesej berjaya hilang terlalu pantas — SEDERHANA
2000-2500 ms di `TetapanConsole.tsx:1030`, `:1191`; `ProfilEditorModal.tsx:91`, `:193`; `NotaKetuaEditorConsole.tsx:148`; `PenajaConsole.tsx:163`; `EditorialConsole.tsx:220`. Dua saat tidak cukup bagi seseorang yang mengalih pandangan — lalu dia menekan Simpan sekali lagi.
**Penyelesaian:** naikkan ke ~6000 ms, atau kekalkan sehingga medan diubah semula.

### D3. Pengesahan simpan jauh daripada mata — SEDERHANA
`TetapanConsole.tsx` beratus baris dengan butang simpan di `:692`, `:783`, `:841`, `:947`; mesej di hujung seksyen. **Penyelesaian:** guna `Toast` sedia ada.

### D4. Keadaan memuat ada EMPAT rupa berbeza — SEDERHANA
Rangka berdenyut (Paparan Utama, Indeks) · ikon jam pasir dalam baris jadual (Direktori, Log Sistem) · ayat kosong tenang (sembilan modul) · `<p>Memuatkan...</p>` mentah (`TetapanConsole.tsx:1088`, `:1248`).
Lebih buruk: modul yang memakai `KeadaanKosong` untuk memuat menjadikan **"sedang memuat" dan "memang kosong" kelihatan serupa** — editor tidak dapat membezakan sistem sedang bekerja atau datanya memang tiada.
**Penyelesaian:** komponen `KeadaanMemuat` berasingan (rangka), dipakai semua modul.

### D5. Keadaan kosong tidak boleh ditindaki — SEDERHANA
`KeadaanKosong.tsx:13-18` tiada prop tindakan. Setiap salinan ialah ayat mati: "Senarai masih kosong." (`EditorialConsole.tsx:299`) tanpa butang tambah; "Tiada kandungan yang sepadan…" (`IndeksConsole.tsx:825`) tanpa butang "Kosongkan penapis" walaupun penapis boleh berlapis.
**Penyelesaian:** tambah prop `tindakan?: ReactNode`. Menulis salinannya perlu kelulusan Izzat (teks menghadap manusia).

### D6. Pemulihan ralat tidak sekata — SEDERHANA
Tiada jalan pulih langsung di 13 tempat (`SenaraiSlotConsole.tsx:524`, `TetapanConsole.tsx:1128`, `TierKadConsole.tsx:133`, `BidangConsole.tsx:1101`, `PenajaConsole.tsx:321`, dll.) — editor mesti memuat semula seluruh laman. `DirektoriConsole` malah SUDAH ada fungsi `muatSemula` (`:75`) yang tidak pernah dipaparkan sebagai butang.
**Penyelesaian:** prop `onCubaLagi` pada `MesejStatus` — butang di dalam kotak ralat itu sendiri. **Usaha: kecil.**

### D7. Ralat penandaan makluman ditelan senyap — RENDAH
`.catch(() => {})` di `EditoriumView.tsx:250`, `:278`, `:288`. Jika gagal, lencana **nampak** kosong sedangkan server masih mengira belum baca — ia muncul semula pada muat semula tanpa penjelasan.

---

## E. TINDAKAN MEMUSNAH

### E1. "Padam nota selamanya" satu klik — TINGGI
`NotaKetuaEditorConsole.tsx:391` memanggil `padam()` terus. Ikon tong sampah **bersebelahan** ikon Pulihkan (`:383`) — dua sasaran kecil bersebelahan, satu boleh balik, satu muktamad.

### E2. Padam glosari/ejaan/istilah tanpa pengesahan — SEDERHANA
`EditorialConsole.tsx:309`, `:392`, `:487`. Senarai terkumpul sepanjang bulan; satu klik tersasar memadamnya tanpa jejak.
**Penyelesaian E1+E2:** guna corak pengesahan dalam aplikasi yang **sudah wujud** di `BidangConsole.tsx:800-820` (panel menyenaraikan kesan sebenar sebelum meneruskan) — bukan `window.confirm`.

### E3. Arkib/Siar di Indeks satu klik — SEDERHANA
`IndeksConsole.tsx:903-918` menukar status kandungan **terbitan** tanpa pengesahan. (Boleh dipulihkan, jadi bukan TINGGI.) "Tolak" pula bertanya, tetapi melalui `window.prompt` yang tidak bergaya.

### E4. Padam sumber RSS tanpa pengesahan — RENDAH
`TickerManagementModal.tsx:547`.

### E5. `alert()` mentah untuk ralat — SEDERHANA
`DirektoriConsole.tsx:103`, `:117`, `:147`, `:156`. Kotak pelayar tidak bergaya, memutuskan aliran, langsung tidak sepadan bahasa visual Adjung.

> **Contoh terbaik dalam projek:** `DirektoriConsole.tsx:109-148` (tamatkan akaun) menyemak draf/menunggu milik pengguna dahulu dan memaparkan panel pilihan. Corak ini patut ditiru untuk E1-E4.

---

## F. BAJET AKSARA (peraturan teras projek)

### F1. Meter bajet TIADA di Ticker — TINGGI
`SlotManagerModal.tsx:80-107` (`BudgetMeter`) betul-betul menjawab peraturan keras projek: peratus langsung sambil menaip, zon kuning pada 90%, baki aksara dinamik. **Tetapi Ticker tidak mendapatnya.**
`TickerManagementModal.tsx:137-160` hanya mengira lulus/gagal per blok **selepas** menaip, tanpa meter, tanpa amaran menghampiri had. Lebih teruk: pengiraan bergantung pada padanan regex `Tajuk:`/`Huraian ringkas:` (`:141-142`) — kalau editor tersilap format label, blok dikira "sah" secara **palsu**, lalu ditolak pelayan kemudian.
**Penyelesaian:** papar `BudgetMeter` yang sama bagi setiap blok; tandakan blok berlabel tidak dikenali sebagai amaran, bukan lulus.

### F2. Ralat bajet tidak menyatakan cara membetulkan — RENDAH
`SlotManagerModal.tsx:103` hanya "pendekatkan kandungan". Lebih berguna: "buang lebih kurang N aksara daripada huraian" — nilai itu **sudah dikira** di `:85-86`.

### F3. Konflik penyuntingan serentak: kerja perlu disalin manual — SEDERHANA
`slotsConfigRoutes.js:107-109` — mesejnya sudah berbahasa manusia dan guna nombor slot 1-asas (bagus), dan kerja tidak hilang (`useSlotEditor.ts:166` mengekalkan modal terbuka). Tetapi "muat semula slot ini dahulu" bermakna editor mesti menyalin keluar teksnya secara manual.
**Penyelesaian:** pada 409, tawarkan butang "Salin draf saya ke papan klip".

---

## G. KEBOLEHCAPAIAN

### G1. Tiada satu pun modal menguruskan fokus — TINGGI
Diperiksa 13 modal. **Tiada satu pun** memindahkan fokus masuk, memerangkap Tab, atau memulangkan fokus kepada pencetus. Hanya `LoginModal` ada `autoFocus`.
Pengalaman sebenar: modal Profil dibuka → kursor papan kekunci masih di halaman belakang → Tab menjelajah menu sisi **di bawah** lapisan gelap → pengguna menaip ke medan yang tidak kelihatan. Tutup → fokus hilang ke `<body>`, Tab bermula semula dari atas.
**Penyelesaian:** satu cangkuk `useModalFokus(ref, onTutup)` — simpan pencetus, fokus elemen pertama, perangkap Tab, pulangkan fokus. Dipakai 13 modal. **Usaha: sederhana (satu fail).**

### G2. Escape berfungsi secara rawak — SEDERHANA-TINGGI
Hanya `LoginModal.tsx:34-40` dan `MaklumanDrawer.tsx:104-108` menyokongnya. Sepuluh modal lain tidak. (`LengkapkanProfilModal` **sengaja** tiada — gerbang terma, itu betul.)
Ketidakkonsistenan lebih memenatkan daripada ketiadaan menyeluruh: tabiat "Escape untuk batal" berjaya di Log Masuk, gagal di Profil.
**Penyelesaian:** cangkuk yang sama seperti G1 mengendalikannya sekali gus.

### G3. Baris jadual boleh diklik tetapi tidak boleh dicapai Tab — TINGGI
`IndeksConsole.tsx:858-867` (`<tr onClick>` membuka perincian kandungan — laluan kerja harian utama) dan `DrafSayaConsole.tsx:214-217` (membuka draf). Pengguna papan kekunci **langsung tidak boleh** membuka mana-mana rekod.

### G4. Butang X tanpa nama langsung — TINGGI
12 tempat tanpa `aria-label` mahupun `title` (`ProfilEditorModal.tsx:213`, `DirektoriConsole.tsx:275`, `:471`, `BidangConsole.tsx:853`, `:1037`, `:1072`, `IndeksConsole.tsx:583`, `:979`, dll.). Pembaca skrin menyebutnya "butang" sahaja.

### G5. Kegagalan simpan tidak pernah diumumkan — TINGGI
`aria-live` **sifar** dalam seluruh repo. **Penyelesaian sekali edit:** tambah `role={tone === 'error' ? 'alert' : 'status'}` dalam `MesejStatus.tsx:22` — ia titik tunggal yang dilalui semua ralat simpan. **Usaha: 1 baris.**

### G6. Tiada `role="dialog"`/`aria-modal`/`aria-labelledby` — TINGGI
Sifar padanan dalam repo. Pembaca skrin tidak tahu satu dialog dibuka.

### G7. Label borang bukan `<label>` sebenar — SEDERHANA
`LABEL_BORANG` dipakai 73 kali; sebahagian betul, tetapi banyak `<span className={LABEL_BORANG}>` tanpa `<label>` induk (`EditorialConsole.tsx:341`, `:350`, `:425`, `:433`, `:443`, `:521`; `SenaraiSlotConsole.tsx:574`, `:597`). Klik pada label tidak memfokus medan.

### G8. Jadual tanpa `scope`/`<caption>` — SEDERHANA
108 elemen jadual merentas 11 konsol, **sifar** `scope=`.

### G9. Butang lumpuh tanpa sebab — SEDERHANA
`ProfilEditorModal.tsx:256`, `LengkapkanProfilModal.tsx:126`, `PenajaConsole.tsx:298`, `NotaKetuaEditorConsole.tsx:286`, `IndeksConsole.tsx:1129` — hanya `opacity-50`. Editor mengisi borang panjang, Simpan kekal kelabu, tiada apa memberitahu medan mana belum lengkap.
> Contoh betul yang patut ditiru: `EditoriumLayout.tsx:216-222` — item terkunci ada `disabled` + `aria-disabled` + ikon kunci + `title` yang menerangkan sebabnya.

### G10. `prefers-reduced-motion` diabaikan sepenuhnya di Editorium — SEDERHANA
Dihormati di frontpage sahaja. `Toast.tsx:43-47` (komponen paling kerap muncul) dan `EditoriumLayout.tsx:324` `animate-ping` **berterusan tanpa henti** sepanjang sesi.

---

## H. KONTRAS & SAIZ TEKS **[DISAHKAN MATA — diukur]**

### H1. Kepala jadual GAGAL WCAG AA — SEDERHANA (kesan harian tinggi)
Saya ukur: `stone-400` atas kertas `#F7F5F2` = **nisbah 2.32** (ambang AA teks kecil ialah **4.5**). Ini `KEPALA_JADUAL` (`gayaKongsi.ts:19`) — kepala **setiap** jadual Editorium.
Untuk perbandingan: `stone-500` atas putih = 4.80 (lulus tipis), `stone-600` atas kertas = **7.01** (lulus selesa).
**Penyelesaian:** `text-[11px] text-stone-600` — satu baris dalam `gayaKongsi.ts`, membaiki semua 14 konsol serentak.

### H2. Saiz teks 9-10px di 186 tempat — SEDERHANA
Merentas 21 fail. `LABEL_BORANG` ialah `text-[9px]` ≈ 6.75pt — terlalu kecil untuk label yang dibaca sepanjang hari.

### H3. Label kumpulan menu gagal kedua-dua — RENDAH
`EditoriumLayout.tsx:200` — `text-[9px] text-stone-400`.

---

## I. JADUAL & SENARAI PANJANG

### I1. Kepala jadual tidak melekat — SEDERHANA **[DISAHKAN MATA]**
Saya ukur: `position: static`. Carian `sticky` merentas `src/components/editorium/` — **sifar padanan**. Kesemua 8 jadual menatal keluar pandangan.
**Penyelesaian:** `sticky top-0 z-10 bg-white` pada setiap `<thead>`. **Usaha: kecil.**

### I2. Log Sistem: entri ke-151 mustahil dicapai — SEDERHANA
`LogAuditConsole.tsx:89` — `limit=150` keras, **tiada** pembahagian halaman, isihan mahupun penapis. Jejak audit menjadi separa buta.

### I3. Direktori tiada isihan lajur — RENDAH
`DirektoriConsole.tsx:85-89` — carian teks sahaja.

### I4. Senarai Slot: 38 baris tanpa penapis/isihan — RENDAH
Jadual paling kerap ditatal, kepala hilang selepas ~10 baris.

---

## J. ERGONOMI BORANG

### J1. Tambah entri boleh berganda — SEDERHANA
`EditorialConsole.tsx:287-288`, `:361`, `:454` — butang hanya lumpuh apabila medan kosong, **bukan** semasa permintaan berjalan. Dua klik pantas = dua baris serupa.

### J2. Enter tidak menghantar borang Tetapan — RENDAH
`TetapanConsole.tsx:692`, `:783`, `:841`, `:947` guna `onClick` tanpa `<form onSubmit>`. `EditorialConsole.tsx:279` pula menyokongnya — jadi kelakuan tidak konsisten.

### J3. Medan wajib tidak ditanda — RENDAH
Borang Nota dan Penaja: butang sekadar kekal malap tanpa memberitahu medan mana belum cukup.

### J4. Bulan penaja ditaip bebas — RENDAH
`PenajaConsole.tsx:298` mengesahkan `/^\d{4}-\d{2}$/` pada teks bebas. Sepatutnya `<input type="month">`.

### J5. Pemilih warna tiada isyarat bukan-warna — SEDERHANA
`SenaraiSlotConsole.tsx:579-590`, `:602-613` — pilihan semasa ditanda hanya dengan bingkai + skala. Tambah ikon ✓ dan `aria-pressed`.

---

## K. KERJA BERULANG

### K1. Tetapan per-kad: 38 kali buka-simpan-tutup — SEDERHANA
`SenaraiSlotConsole.tsx:748-752` — satu slot pada satu masa; tiada "guna pada semua slot tier yang sama". Ini juga **berisiko melanggar Falsafah #2** (kad setier dilayan sama rata) kerana mudah tertinggal satu.
**Penyelesaian:** butang "Guna pada semua slot tier ini" — corak yang betul sudah wujud di `TetapanAmSlotConsole.tsx:185-210` (`agihLengahBertingkat`).

---

## Cadangan urutan pelaksanaan

**Pusingan 1 — kos rendah, kesan segera (semuanya kecil):**
1. A1 sidebar tak segerak (pepijat)
2. G5 `role="alert"` dalam `MesejStatus` (1 baris, membaiki pengumuman ralat seluruh Editorium)
3. I1 kepala jadual melekat
4. H1 kontras kepala jadual (1 baris) — *perlu kelulusan Izzat, perubahan visual*
5. G4 `aria-label` pada 12 butang X
6. D6 butang "Cuba Lagi" dalam `MesejStatus`

**Pusingan 2 — perlindungan kerja (paling merosakkan jika diabaikan):**
7. B1 Ticker `beforeunload` + `tryClose`
8. F1 `BudgetMeter` di Ticker
9. E1+E2 pengesahan sebelum padam
10. B2 cangkuk `useAmaranBelumSimpan`

**Pusingan 3 — satu kerja bersepadu:**
11. C1 + A2 + C2 + C4 (laluan URL) — menyelesaikan empat penemuan sekali gus
12. D1 pemintas 401

**Pusingan 4 — penyeragaman & kebolehcapaian:**
13. G1+G2 cangkuk `useModalFokus`
14. D4 komponen `KeadaanMemuat`
15. G3 baris jadual boleh dicapai papan kekunci
16. G10 `prefers-reduced-motion` global
17. D5 salinan keadaan kosong — *perlu kelulusan Izzat, teks menghadap manusia*

**Menunggu keputusan Izzat (bukan keputusan teknikal):** H1/H2 saiz & kontras teks, D5 salinan, C3 semat sebagai lalai, K1 reka bentuk tindakan pukal.
