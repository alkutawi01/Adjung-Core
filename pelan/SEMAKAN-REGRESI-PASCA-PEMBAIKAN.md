# Semakan Regresi Pasca-Pembaikan (Post-Remediation Smoke Check)

Senarai semak selepas siri audit #35–#50 dan Batch pembaikan A/C/D (Ogos 2026).

**Kenapa dokumen ni wujud:** risiko terbesar selepas banyak pembaikan bukan pepijat baharu,
tetapi **hilang pengetahuan kenapa sesuatu dibuat**. Setiap item di bawah menjaga satu
pembaikan yang pernah menjadi pepijat SEBENAR di produksi. Kalau mana-mana gagal, rujuk
punca asalnya sebelum "membetulkan" — beberapa daripadanya kelihatan seperti kelakuan biasa.

Jalankan selepas: perubahan besar pada laluan kandungan, kemas kini skema, atau sebelum
lonjakan keluaran. Bukan setiap commit.

---

## 1. Keterlihatan kitaran hayat kandungan
- [ ] Kandungan **diarkib** hilang daripada frontpage, carian, RSS dan sitemap.
- [ ] Kandungan diterbitkan → diedit lagi → diarkib: versi LAMA yang diluluskan **tidak**
      muncul semula kepada pembaca.

> Punca asal: CONTENT-LIFECYCLE-005. Query awam dulu memilih revisi berversi tertinggi
> *dalam kalangan yang diluluskan*, tanpa menyemak sama ada ada revisi lebih baharu yang
> menggantikannya. Corak betul: cari revisi TERKINI sebenar dahulu, baru semak ia diluluskan.

## 2. Kekekalan pautan awam
- [ ] Pautan kekal kandungan yang sudah diarkib/dipadam memberi **404**, bukan kandungan lain.
- [ ] Slot yang diisi semula dgn kandungan baharu **tidak** menyebabkan URL lama membuka
      kandungan baharu itu.

> Punca asal: PUBLIC-URL-001. Pautan dahulu diselesaikan ikut *slot*, bukan *objek*.

## 3. Pembersihan fail imej
- [ ] Padam kandungan kali pertama (Tong Sampah): fail imej **masih ada**.
- [ ] Padam kekal: fail imej **dibuang**.
- [ ] Imej yang **dikongsi** kandungan lain: **kekal** sehingga rujukan terakhir hilang.
- [ ] Nama fail muat naik mengandungi segmen rawak (bukan cap masa + nama asal sahaja).

> Punca asal: STORAGE-002. Nota: `core/utils/failMuatNaik.js` menyemak **enam** tapak
> rujukan. **Kalau jadual baharu menyimpan URL muat naik, ia MESTI ditambah ke
> `TAPAK_RUJUKAN`** — kalau tidak, fail yang masih dirujuk boleh dipadam.

## 4. Keatoman transaksi
- [ ] Cipta kandungan: objek + revisi + **semua** atribut wujud serentak.
- [ ] Kegagalan separuh jalan tidak meninggalkan rekod separa (tiada objek tanpa atribut).
- [ ] Nombor versi unik per objek, tiada duplikat.

> Punca asal: PIPELINE-TRANSACTION-001 + SCHEMA-CONSTRAINT-001. Kunci aplikasi
> (`denganKunciKandungan`) dan kekangan DB `UNIQUE(objectId, version)` ialah **dua lapisan
> berasingan** — kedua-duanya masih diperlukan, satu bukan pengganti satu lagi.

## 5. Susun atur editor mudah alih (375px)
- [ ] `window.innerWidth` **sama** dengan `window.visualViewport.width` pada setiap tab Tetapan.
- [ ] Borang Tempoh Cuti Sekolah: dua baris setiap tempoh, tiada limpahan mendatar.

> Punca asal: SETTINGS-MOBILE-001 (dan lebih awal, `<main>` tanpa `w-full`). **Isyarat
> paling boleh dipercayai bagi kelas pepijat ni ialah `innerWidth` ≠ `visualViewport.width`**
> — tangkapan skrin sahaja menipu, sebab pelayar mengecilkan semula paparan agar muat.
> Ingat juga: jangan timpa anak yang sudah bawa `w-full` dari luar — hadkan **bekasnya**.

## 6. Validasi tetapan
- [ ] Nilai berangka tak sah (huruf, pecahan, luar julat) → **400 dgn sebab jelas**, bukan
      diterima senyap.
- [ ] Nilai sah tersimpan dan kekal selepas muat semula.

> Punca asal: SETTINGS-VALIDATION-001. Prinsip: **tolak, jangan apit senyap** — mengapit
> menukar niat editor tanpa dia sedar.

## 7. Jejak audit metadata
- [ ] Tukar Bidang atau Topik → satu baris `kemas-kini-taksonomi` dgn aktor dan "dari → ke".
- [ ] Simpan semula nilai **sama** → **tiada** baris audit baharu.

> Punca asal: AUDIT-003. Skopnya **Bidang/Topik sahaja** — `source` dan metadata lain masih
> tidak berjejak. Jangan andaikan liputan lebih luas daripada itu.

## 8. Status selepas Simpan Jadual
- [ ] Set jadual pada kandungan **Aktif** → baris Indeks dan modal terus papar **Dijadualkan**
      tanpa muat semula.

> Punca asal: #33.2-A. Client dahulu **menyalin** peraturan peralihan status server dan
> salinan itu tak lengkap. Status kini datang daripada respons server — **jangan** kembalikan
> logik status ke client.

## 9. Amaran luput cuti sekolah
- [ ] Bila tarikh tamat terakhir ≤ 120 hari → amaran muncul di Tetapan 3.3.
- [ ] Bila sudah lepas → amaran lebih keras, menyatakan Jam Dunia berhenti memapar cuti sekolah.

> Punca asal: SCHOOL-HOLIDAY-SOURCE-001. **Cuti sekolah BUKAN daripada API** — API cuti yang
> disambungkan membekalkan cuti **umum** sahaja. Cuti sekolah datang daripada senarai berkod
> keras (`SCHOOL_HOLIDAYS_LALAI`) atau suntingan manual. Logik amaran diuji dalam
> `tests/kitaranCutiSekolah.test.js`.

## 10. Had kadar
- [ ] Carian awam mencetus 429 selepas had.
- [ ] `GET /api/system/layout/active` **tidak pernah** disekat walau dipanggil berulang kali.

> Punca asal: GENERAL-API-RATE-LIMIT. Had mutasi **melangkau GET dengan sengaja** — menyekat
> bacaan awam akan memecahkan portal tanpa menghalang penyalahgunaan sebenar.

---

## Yang senarai ni TIDAK boleh gantikan

Tiga kecacatan kegunaan sebenar (butang tiada maklum balas, baris kosong mengunci simpanan,
pengumpulan visual mengelirukan) **lepas** daripada semua ujian automatik dan hanya ditemui
apabila pemilik projek benar-benar menggunakan borang itu di telefon.

**Ukuran mengesahkan geometri, bukan kefahaman manusia.** Untuk skrin editor yang penting,
minta seseorang benar-benar mengendalikannya: buka kali pertama, tambah item, tersilap isi,
cuba simpan, dan lihat sama ada mesejnya difahami.
