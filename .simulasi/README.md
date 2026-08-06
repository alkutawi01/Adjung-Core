# Simulasi Adjung Brief

Suite simulasi yang menghidupkan **pelayan sebenar** terhadap **pangkalan data buangan**, kemudian
mengesahkan keadaan DB selepas setiap panggilan API. `adjung.db` sebenar tidak pernah disentuh.

## Kenapa ini wujud

Analisis statik (membaca kod) sudah kehabisan hasil selepas beberapa pusingan audit. Kelas pepijat
paling berbahaya dalam projek ni ialah **kegagalan senyap**: API membalas `{"success":true}`
sedangkan tiada apa tersimpan. Itu mustahil dilihat dengan membaca kod — ia hanya menampakkan diri
apabila sesuatu dijalankan dan DB diperiksa selepasnya.

Sembilan pepijat sebenar ditemui cara ni, termasuk dua yang **berselang-seli** (keadaan perlumbaan
yang lulus larian pertama dan hanya gagal pada larian kemudian).

## Cara jalankan

```bash
node .simulasi/jalankan-semua.mjs     # kesemua simulasi
node .simulasi/sim4-kitaran-kandungan.mjs   # satu simulasi
node .simulasi/liputan.mjs            # laporan liputan laluan tulis
```

Perlu `tsx` (sudah ada dalam devDependencies). Setiap simulasi guna port sendiri (5199–5212) dan
fail DB sendiri dalam direktori temp.

## Apa yang diliputi

| Simulasi | Apa yang diburu |
|---|---|
| `sim1-db-baharu` | Pemasangan BAHARU — medan kandungan hilang senyap pada DB kosong |
| `sim2-id-hantu` | Kejayaan palsu: UPDATE/DELETE pada id yang tak wujud |
| `sim3-tulisan-sah` | Tulisan sah benar-benar sampai ke DB (bukan sekadar lapor) |
| `sim4-kitaran-kandungan` | Draf→Terbit→Lulus→Beratur→Naik taraf→Tolak→Pulih; kandungan tak hilang |
| `sim5-kebenaran` | Penjelakan peranan; laluan sensitif terbuka; laluan awam tersekat |
| `sim6-pintas-peraturan` | Bajet ruang kad & Bidang/Topik dipintas melalui API terus |
| `sim7-integriti-skema` | Jadual dirujuk kod tapi tak dicipta pada pemasangan baharu |
| `sim8-portal-awam` | Kebocoran data dalaman & kerosakan pada permukaan pembaca |
| `sim9-input-jahat` | XSS, suntikan SQL, NUL, unicode, JSON rosak, muatan gergasi |
| `sim10-serentak` | Keadaan perlumbaan (had kapasiti dilanggar, kerja editor hilang) |
| `sim11-matriks-status` | Hanya 'approved' boleh dilihat pembaca, merentas KEDUA-DUA laluan render |
| `sim12-pautan-emel` | Password-reset poisoning melalui header Host palsu |
| `sim13-jurang-liputan` | Laluan destruktif & keselamatan akaun yang belum diliputi |

Liputan semasa: **91% laluan tulis**. Baki 8 dikecualikan dengan sebab — pipeline AI
(dinyahkeutamaan, tiada pemanggil UI), `logout`, tanda-baca notifikasi, pratonton baca-sahaja, dan
dua laluan yang bergantung rangkaian luar.

## Menambah simulasi baharu

Namakan `simN-nama.mjs` supaya pelari menemuinya. Guna `sim-lib.mjs` untuk boot pelayan, log masuk,
dan buka sambungan DB pengesahan (`bukaDb` — ia menetapkan `busy_timeout`, wajib kerana pelayan
memegang fail yang sama).

Corak: **panggil API → baca DB → sahkan perubahan yang DIJANGKA benar-benar berlaku.** Jangan
percaya kod status sahaja; itu tepat pepijat yang kita buru.
