# Seni Bina Akhir: Glosari Berasaskan Bidang

Status: **DILAKSANAKAN — versi 3 (2026-08-16) diguna pakai sepenuhnya, digital ke produksi.**
Skema (`glosari_sense` + `glosari_sense_bidang`, unique index separa + `ON DELETE CASCADE`,
disahkan hidup terus melalui skrip SQL berasingan), API backend (`glosariRoutes.js`, invariant
dikuatkuasakan transaksi atomik), logik resolusi tulen (`core/editorial/GlosariResolusi.js`,
8 ujian regresi lulus), render client (`IstilahGlosari.tsx`, `FocusView.tsx`), dan UI admin
"Urus Sense" (`EditorialConsole.tsx`) semua siap, `tsc`/`npm test`/`npm run build` bersih.
Peraturan tooltip (Seksyen 3) disahkan **BETUL 100%** oleh Izzat sebelum pelaksanaan, tiada
perubahan lanjut. 4 pembetulan kecil terakhir (getSlug() disahkan+gotcha 'umum' dikendalikan,
padam Sense guna `ON DELETE CASCADE`, penerangan "Am"/"Khusus Bidang" dalam UI) semua digunakan
seperti dirancang. Baki kerja: pengesahan manual tooltip pada data sebenar di Focus View belum
dijalankan (ujian automatik + SQL sahaja setakat ni). Rujuk `docs/language-glossary.md` untuk
glosari BAHASA UI (fail berasingan, tiada kaitan ciri ni).

**Amaran struktur — DUA fitur berkongsi nama serupa, jangan keliru:**
1. **Glosari** (`glosari_istilah`, `glosariRoutes.js`, `IstilahGlosari.tsx`) — kamus
   istilah→makna, tooltip garis putus-putus pada kemunculan pertama. **Ni yang disentuh.**
2. **Glos Selari** (`[kata](gloss:makna)`, `glosSelariEnabled`) — anotasi interlinear,
   laluan data BERASINGAN sepenuhnya, dimatikan hardcode. **Di luar skop sepenuhnya.**

---

## 1. Architecture Final

### Semasa (tak berubah, rujukan)
```sql
CREATE TABLE glosari_istilah (
  id TEXT PRIMARY KEY, istilah TEXT NOT NULL, elakkan TEXT, maksud TEXT, createdAt TEXT
)
```
Rata, global, tiada lajur Bidang. `POST /glosari` kuatkuasa keunikan `istilah` case-insensitive
(`WHERE LOWER(istilah) = LOWER(?)`) — satu istilah = SATU `maksud` hari ini. Padanan teks:
regex sempadan-perkataan, case-insensitive lookup (paparan kekal huruf asal teks), panjang-ke-
pendek, **kemunculan pertama sahaja** per artikel (`Set` dikongsi merentasi tajuk+perenggan),
skop tajuk+huraian ringkas+huraian panjang. Tooltip guna komponen `Tooltip` kongsi sedia ada.

### Baharu (additive, dua jadual anak)
```sql
-- Sense: satu takrifan. amSense=1 (am) ATAU >=1 baris Bidang (khusus) — TAK BOLEH DUA-DUA/TIADA
CREATE TABLE glosari_sense (
  id TEXT PRIMARY KEY,
  istilahId TEXT NOT NULL REFERENCES glosari_istilah(id) ON DELETE CASCADE,
  definisi TEXT NOT NULL,
  amSense INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
-- DB-level: MAKSIMUM SATU Sense am setiap istilah (SQLite sokong unique index separa)
CREATE UNIQUE INDEX idx_glosari_sense_am_unik ON glosari_sense(istilahId) WHERE amSense = 1;

-- Perkaitan Sense <-> Bidang (banyak-ke-banyak). categoryId = CategoryRegistry.id
CREATE TABLE glosari_sense_bidang (
  senseId TEXT NOT NULL REFERENCES glosari_sense(id) ON DELETE CASCADE,
  categoryId TEXT NOT NULL REFERENCES CategoryRegistry(id),
  PRIMARY KEY (senseId, categoryId)
);
```
`glosari_istilah` skema **TAK diubah langsung** — sifar `ALTER TABLE`. `maksud` KEKAL sebagai
fallback paling akhir (bukan lagi fallback PERTAMA — lihat Seksyen 3).

**Mekanisme padam DISAHKAN (bukan dua pilihan) — pembetulan #3, Izzat**: `ON DELETE CASCADE`
dipilih, BUKAN padam eksplisit dalam transaksi. Disahkan terhadap kod sebenar, bukan andaian:
`PRAGMA foreign_keys = ON;` AKTIF (`server.js:317`), dan `ON DELETE CASCADE` ialah **corak
sedia ada yang konsisten** merentasi jadual induk-anak sebenar dalam repo ni — `users→(baris
lain)`, `editorial_objects→editorial_revisions`, `editorial_objects/editorial_attributes→
editorial_attribute_values`, `editorial_revisions→(baris lain)` (semua di `server.js`, jadual
skema sedia ada). Ikut peraturan Izzat sendiri ("pilih padam eksplisit KECUALI repository memang
ada pola CASCADE konsisten") — corak tu MEMANG wujud konsisten di sini, jadi CASCADE yang dipilih:
`glosari_sense.istilahId REFERENCES glosari_istilah(id) ON DELETE CASCADE` (padam istilah →
padam semua Sense-nya serentak) dan `glosari_sense_bidang.senseId REFERENCES glosari_sense(id)
ON DELETE CASCADE` (padam Sense → padam baris perkaitan Bidangnya serentak). **Kesan langsung**:
laluan `DELETE /glosari/:id` (padam istilah) sedia ada **TAK PERLU sebarang kod tambahan** untuk
bersihkan Sense/perkaitan Bidang — DB uruskan sendiri, konsisten dgn cara `DELETE` kandungan
sedia ada berfungsi hari ini (padam objek → revisi/atribut ikut serta automatik).

**Amaran ketat (pelajaran daripada insiden sebenar dlm kod ni)**: komen `server.js:2176-2182`
rekod kejadian SEBENAR — `PRAGMA foreign_keys=ON` sebabkan INSERT gagal SENYAP (`console.warn`
sahaja, tiada crash kelihatan) bila baris `REFERENCES` yang disasar tak wujud lagi semasa
`INSERT`. Untuk jadual baharu ni, `glosari_sense_bidang.categoryId REFERENCES CategoryRegistry(id)`
selamat (Bidang MESTI dipilih editor drpd senarai sedia ada sebelum Sense dicipta — baris
`CategoryRegistry` sentiasa wujud dahulu secara kronologi), tapi laluan API (Seksyen 5) WAJIB uji
tingkah laku INSERT gagal (bukan cuma andaikan FK akan "je" berfungsi) sebelum dianggap selamat.

---

## 2. Invariant / Data Rules

Peraturan MUKTAMAD (pembetulan Izzat, gantikan draf 1 sepenuhnya):

| Invariant | Penguatkuasaan |
|---|---|
| Sense **khusus** (`amSense=0`) MESTI ada ≥1 baris `glosari_sense_bidang` | Peringkat APLIKASI (transaksi POST/PATCH — tolak jika `amSense=0` DAN `bidangIds` kosong) |
| Sense **am** (`amSense=1`) MESTI **SIFAR** baris `glosari_sense_bidang` | Peringkat APLIKASI (tolak jika `amSense=1` DAN `bidangIds` bukan kosong — "peraturan #3, jangan campur konsep am dgn khusus") |
| Maksimum **SATU** Sense am setiap istilah | **Peringkat DB** — `CREATE UNIQUE INDEX ... WHERE amSense = 1` (SQLite sokong unique index separa/partial, tepat untuk kes ni) |
| Maksimum **SATU** Sense khusus setiap pasangan (istilah, Bidang) | Peringkat APLIKASI — semasa POST/PATCH Sense khusus, semak SEMUA Sense sedia ada bagi `istilahId` yang sama, tolak jika mana-mana `bidangIds` baharu bertindih dgn Bidang Sense LAIN bagi istilah sama |

Kesemua tolakan API mesti pulangkan mesej ralat JELAS (contoh: `"Bidang 'Sukan' sudah terikat
Sense lain bagi istilah 'intervensi'. Satu istilah cuma boleh ada SATU Sense khusus setiap
Bidang."`), bukan gagal senyap atau 500 generik.

**Kenapa bukan semua di peringkat DB**: dua invariant pertama silang jadual (`amSense` di
`glosari_sense` lawan kewujudan baris di `glosari_sense_bidang`) — SQLite boleh kuatkuasa ni
guna TRIGGER, tapi tu kerumitan tambahan untuk manfaat kecil memandangkan laluan tulis Sense
SATU tempat sahaja (API, bukan pelbagai laluan macam `CategoryRegistry`'s masalah — lihat
Seksyen 4). Semakan aplikasi + transaksi atomik memadai; trigger boleh ditambah kemudian sebagai
pengukuhan (bukan wajib peringkat pertama).

---

## 3. Context Resolution Flow

**PEMBETULAN MUKTAMAD** (membatalkan draf 1 sepenuhnya — draf 1 silap kata label `(Bidang)`
sentiasa dipaparkan; ITU SALAH, dibetulkan Izzat):

```
Istilah ditemui dalam teks
    ↓
Dapatkan Bidang konteks kandungan (desk attribute -> slug -> CategoryRegistry.id, lihat Seksyen 4)
    ↓
Cari Sense KHUSUS: istilahId = istilah DAN categoryId = Bidang konteks
    ↓
JUMPA? ──YA──→ "{Istilah}: ({NamaBidang}) {Definisi khusus}"   <- (Bidang) DIPAPARKAN
    │
    TIDAK
    ↓
Cari Sense AM (amSense=1) bagi istilah tu
    ↓
JUMPA? ──YA──→ "{Istilah}: {Definisi am}"                      <- TIADA (Bidang)
    │
    TIDAK
    ↓
Ada glosari_istilah.maksud (tak kosong)?
    ↓
YA ──→ "{Istilah}: {maksud lama}"                               <- TIADA (Bidang)
    │
    TIDAK
    ↓
Tiada tooltip untuk kemunculan ni
```

**Peraturan tunggal yang kekal**: label `(Bidang)` dipaparkan **HANYA** bila definisi yang
DIGUNAKAN datang daripada Sense khusus-Bidang. Sense am dan `maksud` lama KEDUA-DUANYA tiada
label — sebab kedua-duanya BUKAN makna khusus Bidang, memaparkan `(Bidang)` di situ mengelirukan
pembaca (buat definisi am nampak macam ia khusus untuk Bidang tu, sedangkan bukan).

### Sumber Bidang konteks (tak berubah drpd draf 1)
Bidang **terkunci per-slot** (`slots_config.manualDesk`), kandungan (termasuk tajuk/huraiannya)
WAJIB sepadan Bidang terkunci slot semasa simpan. "Bidang tajuk", "Bidang huraian", "Bidang
kad", "Bidang slot" **SATU nilai sahaja** — TIADA konsep berasingan dicipta untuk masing-masing
(ikut arahan Izzat #5, draf 1 pun sudah betul di sini, dikekalkan). Pengecualian: **Ticker**
satu-satunya jenis kandungan tanpa Bidang terkunci per-slot — layan sama seperti "tiada Bidang
konteks", terus ke fallback (Sense am/`maksud`), tiada label.

### Kes edge (semua dipertimbangkan)
| Kes | Keputusan |
|---|---|
| Sense khusus wujud tepat bagi Bidang konteks | Guna, papar `(Bidang)` |
| Tiada Sense khusus, ADA Sense am | Guna Sense am, TIADA `(Bidang)` |
| Tiada Sense khusus, TIADA Sense am, ADA `maksud` lama | Guna `maksud`, TIADA `(Bidang)` |
| Tiada sebarang definisi | Tiada tooltip, istilah kekal teks biasa |
| Kandungan tiada Bidang konteks (Ticker) | Terus ke rantai fallback (Sense am -> maksud -> tiada), TIADA `(Bidang)` — logik SAMA seperti "tiada Sense khusus", bukan kes berasingan |
| Nama Bidang kandungan tak resolve ke `CategoryRegistry` (drift/arkib) | Layan sama seperti "tiada Bidang konteks" (di atas) |
| Kandungan pelbagai Bidang serentak | **TAK WUJUD dalam seni bina sedia ada** (satu kandungan = SATU `desk` string, Topik bukan Bidang tambahan) — tiada logik "pilih antara banyak" diperlukan buat masa ini |

---

## 4. Resolusi `CategoryRegistry` — DISEMAK SEMULA (audit tambahan diminta Izzat)

### Pengesahan `getSlug()` — pembetulan #2, Izzat: "buktikan, jangan andaikan"

Disahkan LANGSUNG terhadap fail sebenar, bukan diandaikan wujud:

- **Lokasi**: `core/category/CategoryRegistry.js:70-75`, kaedah statik `static getSlug(name)`
  pada kelas `CategoryRegistry`.
- **Eksport**: `export default CategoryRegistry` (`CategoryRegistry.js:426`) — boleh diimport
  terus (`import CategoryRegistry from '.../CategoryRegistry.js'`, dipanggil
  `CategoryRegistry.getSlug(nama)`) daripada mana-mana fail, sama seperti laluan sedia ada
  (`registerCategory`/`renameCategory`/dll. semua panggil `this.getSlug(...)` dalam kelas sama).
- **Implementasi sebenar** (dipetik tepat):
  ```js
  static getSlug(name) {
    if (!name) return 'umum';
    return name.toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  ```
  Deterministik, tulen (tiada kesan sampingan/panggilan DB) — **sesuai** dipanggil client-side
  (Seksyen 5) tanpa overhed rangkaian.

- **⚠️ Gotcha SEBENAR ditemui semasa pengesahan** (bukti KENAPA "buktikan dulu" penting): bila
  `name` kosong/falsy, `getSlug()` **TIDAK** pulangkan rentetan kosong — ia pulangkan literal
  `'umum'`. Corak fallback `'umum'` ni turut wujud di dua fail lain sistem (`UrlSlug.js`,
  `PresentationComposer.js`) sebagai token "am/tiada kategori" bermakna, bukan sekadar nilai
  kosong. **Risiko**: kalau resolver Glosari terus panggil `getSlug(deskKandungan)` tanpa semak
  `deskKandungan` dahulu, kandungan TANPA Bidang (Ticker, atau desk kosong akibat pepijat lain)
  akan resolve ke slug `'umum'` — dan JIKA kebetulan ada Bidang aktif bernama "Umum" berdaftar
  dalam `CategoryRegistry`, resolver akan SILAP anggap kandungan tu memang Bidang "Umum" (padahal
  sepatutnya "tiada Bidang konteks", laluan fallback Seksyen 3), bukan ralat nyata tapi
  kelakuan salah senyap. **Pembetulan reka bentuk**: resolver Glosari WAJIB semak
  `deskKandungan` kosong/falsy TERLEBIH DAHULU (layan terus sebagai "tiada Bidang konteks",
  Seksyen 3) SEBELUM memanggil `getSlug()` langsung — jangan bergantung pada tingkah laku
  fallback dalaman `getSlug()` untuk kes ni.

**Kesimpulan**: `getSlug()` wujud, sesuai, dan selamat digunakan SEBAGAI dependency — dengan
SATU pembetulan reka bentuk (semak kosong dahulu) hasil daripada pengesahan ni.

### `CategoryRegistry.name` — status keunikan

**`CategoryRegistry.name` TIADA sebarang kekangan unik** — DB
mahupun aplikasi. Satu-satunya lajur benar-benar unik ialah **`slug`** (`UNIQUE NOT NULL`,
dikuatkuasakan SQLite). Bukti konkrit (kod sebenar):

- `registerCategory`/`activateCategory`/`renameCategory`/`mergeCategories` — **SEMUA** semak
  `WHERE slug = ?`, TIADA satu pun semak `WHERE name = ?`.
- `renameActiveCategory` (laluan Taksonomi rename-tunggal) langsung TIADA semakan pendua
  langsung — ia UPDATE terus by `id`; slug-nya sendiri dikira semula drpd nama baharu dalam
  UPDATE yang sama, jadi slug KEKAL selaras nama (invariant "slug unik ⇒ nama unik" masih
  terpelihara SETAKAT laluan ni sahaja).
- `activateCategory` (+ Tambah Bidang) — bila nama baharu ditaip menghasilkan slug SAMA dgn
  baris sedia ada, ia **TIMPA** nama baris lama secara senyap (keputusan kurasi Ketua Editor
  yang disengajakan, per komen kod sedia ada) — bukan ralat, bukan baris kedua dicipta.
- **Tiada satu pun laluan dalam kod hari ini melakukan carian nama→id** — resolver macam ni
  akan jadi PERTAMA dalam sistem.

**Kesimpulan keselamatan data**: carian terus `WHERE name = ?` (walau case-insensitive) **TAK
SELAMAT** — `name` tiada jaminan unik sendiri. **Kunci resolusi MESTI guna `slug`**, lajur SATU-
SATUNYA yang benar-benar dikuatkuasakan unik:

```
Bidang konteks kandungan (nama string, cth "Sukan", ATAU kosong/tiada -- Ticker)
    ↓
Nama kosong/falsy? --YA--> "tiada Bidang konteks" TERUS (fallback, tiada label — Seksyen 3)
    │                       (JANGAN panggil getSlug() untuk kes ni — lihat gotcha 'umum' di atas)
    TIDAK
    ↓
CategoryRegistry.getSlug(namaKandungan)   -- fungsi sedia ada, disahkan, deterministik
    ↓
SELECT id FROM CategoryRegistry WHERE slug = ? AND isActive = 1
    ↓
0 baris? -> "tiada Bidang konteks" (fallback, tiada label — Seksyen 3)
1 baris? -> guna id tu (DIJAMIN maksimum satu baris — slug UNIQUE secara global,
            bukan cuma dalam kalangan isActive=1, jadi >1 baris MUSTAHIL berlaku)
```

Penapis `isActive = 1` WAJIB — 93 baris `isActive=0` legasi (nama lama sebelum Bidang jadi
senarai tertutup terkurasi) masih dalam jadual, resolusi tanpa tapisan ni boleh terkena baris
arkib yang tak patut dipilih pembaca lagi.

**Ini bukan gap baharu dicipta oleh kerja Glosari** — ia gap sedia ada dalam `CategoryRegistry`
(nama boleh drift daripada rename yang tak cascade). Reka bentuk Glosari **TAK cuba baiki**
gap tu (arahan Izzat: "jangan ubah sistem CategoryRegistry"), cuma reka resolusi Glosari supaya
SELAMAT walau gap tu wujud — guna kunci yang benar-benar unik (`slug`), bukan yang tak (`name`).

---

## 5. API Contract

- **`GET /glosari`** — kekal bentuk balasan asas, TAMBAH `senses[]` bersarang setiap istilah:
  ```json
  { "id": "...", "istilah": "intervensi", "maksud": "...", "senses": [
    { "id": "...", "definisi": "...", "amSense": 0, "bidang": [{"id":"...", "name":"Sukan"}] }
  ]}
  ```
  **Elak N+1** — dua query pukal (bukan satu per istilah): (1) `SELECT * FROM glosari_sense`,
  (2) `SELECT * FROM glosari_sense_bidang JOIN CategoryRegistry ON ...`, gabung dalam memori
  ikut `istilahId`/`senseId`. Resolusi konteks (Bidang kandungan → id, Seksyen 3-4) berlaku di
  **client** (sama seperti draf 1 — `FocusView.tsx` kekal fetch peta PENUH sekali per mount,
  tiada parameter/cache-key baharu ditambah).
- **`POST /glosari/:istilahId/sense`** — `{ definisi, amSense, bidangIds? }`. Sahkan invariant
  Seksyen 2 (transaksi atomik — cipta Sense + baris `sense_bidang` dalam SATU transaksi, rollback
  jika mana-mana semakan gagal).
- **`PATCH /glosari/sense/:senseId`** — sunting definisi/amSense/bidangIds. Sahkan invariant
  SEMULA (Sense tukar dari khusus→am mesti buang semua Bidang serentak, dsb.). **Ni turut isi
  jurang sedia ada** — tiada laluan sunting takrifan pun buat istilah lama hari ini.
- **`DELETE /glosari/sense/:senseId`** — padam SATU Sense. Baris `glosari_sense_bidang` berkaitan
  padam **serentak automatik via `ON DELETE CASCADE`** (Seksyen 1, mekanisme DISAHKAN — bukan
  dua pilihan) — laluan API cuma perlu SATU statement `DELETE FROM glosari_sense WHERE id = ?`,
  tiada `DELETE` kedua manual diperlukan untuk `sense_bidang`.

---

## 6. Editorial Workflow

Kekal RINGAN — editor TAK PERNAH pilih Sense manual pada setiap kemunculan istilah (pemilihan
automatik sepenuhnya di pembaca). Lanjutan tab **Editorial → 2. Glosari** sedia ada:

1. Senarai istilah kekal macam sekarang (tambah/padam istilah, medan `maksud` label dikemas
   kepada "Makna am/fallback (dipapar tanpa label Bidang, bila tiada Sense khusus/am lain)").
2. Setiap baris istilah — butang baharu **"Urus Sense"** buka sub-panel.
3. Sub-panel: senarai Sense sedia ada (definisi + Bidang berkaitan ATAU penanda "Am"), + borang
   "+ Tambah Sense" dengan **togol jelas** "Khusus Bidang" vs "Am" (bukan checkbox tersembunyi)
   — bila "Khusus Bidang" dipilih, pemilih Bidang berbilang (komponen SEDIA ADA, sama macam
   dropdown Bidang di tempat lain) jadi WAJIB; bila "Am" dipilih, pemilih Bidang disembunyikan
   terus (mencerminkan invariant Seksyen 2 dalam UI, elak editor cuba buat kombinasi tak sah).
   **Penerangan pendek WAJIB di bawah setiap pilihan togol** (permintaan #4, Izzat — supaya
   editor faham KENAPA `(Bidang)` kadang muncul kadang tidak, bukan sekadar label kosong):
   - **Am** — "Digunakan apabila tiada makna khusus bagi Bidang semasa."
   - **Khusus Bidang** — "Digunakan hanya apabila istilah mempunyai makna tertentu dalam Bidang
     yang dipilih."
4. Ralat kekaburan (Bidang dah terikat Sense lain bagi istilah sama) dipaparkan terus dalam
   borang, bukan selepas hantar.

---

## 7. Tooltip Rendering Rules

Format MUKTAMAD (dua kes sahaja, bukan tiga macam draf 1):

**Bila Sense khusus digunakan**:
```
Intervensi: (Sukan) Program senaman atau aktiviti berstruktur yang dirancang khas
untuk meningkatkan tahap kecergasan fizikal atau mengawal berat badan.
```

**Bila Sense am ATAU `maksud` lama digunakan** (label DIBUANG SEPENUHNYA):
```
Intervensi: Tindakan campur tangan yang bertujuan menangani atau mempengaruhi sesuatu keadaan.
```

Data diperlukan bina teks akhir: (1) `entri.istilah` (huruf terkawal, bukan casing artikel),
(2) `sourceOfDefinition` (enum: `khusus` | `am` | `lama`, ditentukan Seksyen 3), (3) nama Bidang
KONTEKS **hanya bila `sourceOfDefinition === 'khusus'`**, (4) definisi hasil resolusi. Bila
`sourceOfDefinition !== 'khusus'`, elak terus bina rentetan `(Bidang)` — bukan sekadar
sembunyikan visual, JANGAN kira/ambil nama Bidang langsung bila tak diperlukan.

`entri.maksud` yang dihantar ke `Tooltip` sekarang teks PENUH terbina (`"{istilah}: [(...)] {definisi}"`),
bukan sekadar `maksud` mentah — perubahan pada `IstilahGlosariSpan`/`binaPetaGlosari`
(`IstilahGlosari.tsx`), rendering underlying (regex padanan, Set kemunculan pertama, komponen
`Tooltip` kongsi) **TAK disentuh**.

Tetap TIDAK papar semua Sense serentak — cuma SATU (hasil resolusi).

---

## 8. Implementation Plan

### Required
1. Migration additive: `glosari_sense` (+ unique index separa `amSense=1`), `glosari_sense_bidang`
   — sifar `ALTER TABLE` pada jadual sedia ada.
2. Fungsi resolusi `slug`→`categoryId` (Seksyen 4) — boleh diuji berasingan (unit test tulen,
   tiada pelayan/DB diperlukan selain mock).
3. Fungsi resolusi Sense (Seksyen 3) — tulen, diuji berasingan (matriks kes edge Seksyen 3).
4. API Sense CRUD + pengesahan invariant (Seksyen 2, 5) — transaksi atomik.
5. `IstilahGlosariSpan`/`binaPetaGlosari` dikemas untuk format baharu (Seksyen 7).
6. UI "Urus Sense" (Seksyen 6).

### Optional
- Penanda visual senarai istilah admin ("3 Sense" badge).
- Amaran halus istilah popular tanpa Sense khusus langsung.
- Fungsi "salin Sense" (definisi hampir sama, Bidang lain).

### KIV
- Sokongan Sense untuk medan lain (Nota Editor dsb.) — skop kekal tajuk+huraian sahaja.
- Paksa `glosari_istilah.maksud` kosong bila istilah dah ada ≥1 Sense — KEDUA-DUA boleh wujud
  serentak buat masa ini (maksud = fallback TERAKHIR selepas Sense am, bukan wajib kosong).
- Trigger DB peringkat pengukuhan tambahan bagi invariant silang-jadual (Seksyen 2) — aplikasi
  memadai peringkat pertama.

**Tiada migration data production diperlukan.** Jadual baharu kosong selepas `CREATE TABLE IF
NOT EXISTS`, tiada baris sedia ada disentuh.

---

## 9. Risiko yang Masih Tinggal

- **Drift nama Bidang** (`CategoryRegistry` gap sedia ada, Seksyen 4) — kandungan lama yang
  Bidangnya dinamakan semula via laluan tak-cascade (`renameActiveCategory`) akan resolve ke
  "tiada Bidang konteks" (fallback am/lama, tiada silap besar — cuma kehilangan label khusus
  yang sepatutnya betul). Bukan dicipta oleh kerja ni, tapi kesan sampingannya kini lebih
  ketara (sebelum ni tiada sistem baca `desk` untuk tujuan macam ni langsung).
- **Editor lupa tambah Sense am** — istilah yang ada Sense khusus untuk SATU Bidang sahaja
  (cth Sukan), tapi tiada Sense am, akan langsung tiada tooltip bila muncul dalam kandungan
  Bidang LAIN (Pendidikan, dsb.) — bukan pepijat (kelakuan betul ikut peraturan), tapi
  berkemungkinan mengejutkan editor pada mulanya; teks bantuan sub-panel "Urus Sense" patut
  jelaskan ni.
- **Ticker tiada Bidang terus** — istilah dalam Ticker SENTIASA jatuh ke Sense am/`maksud`,
  tak kira berapa banyak Sense khusus Bidang wujud untuk istilah tu. Ini betul ikut seni bina
  (Ticker memang tiada Bidang terkunci), tapi bermakna Sense khusus tak pernah "aktif" dalam
  konteks Ticker langsung.
- **`HAD_MAKSUD` 400 aksara** kekal terpakai — perlu disahkan skop terpakai pada setiap Sense
  individu (bukan gabungan), tak ditukar drpd draf 1.
