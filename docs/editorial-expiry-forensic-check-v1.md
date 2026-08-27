# Semakan Forensik Expiry Editorial V1

**Tarikh:** 16 Ogos 2026  
**Kaedah:** read-only — carian seluruh worktree (kecuali artifak binaan/DB), semakan semua rujukan Git, pembacaan path runtime, dan pertanyaan SQLite `OPEN_READONLY`.  
**Tiada kod, skema, migrasi, ujian, atau data diubah.**

## Keputusan

Model `story_overrides` yang mengandungi `expires_at` dan `override_type='pin'` **tidak wujud dalam codebase atau pangkalan data tempatan yang diperiksa**. Ia bukan nama alternatif bagi `scheduledExpiresAt`.

`scheduledExpiresAt` ialah lifecycle kandungan editorial: apabila masanya tiba, penjadual mengarkibkan revisi yang sedang `approved`. Ia bukan pin, override, atau keputusan susun atur.

Oleh itu, tidak ada code path semasa yang boleh menghasilkan konsep jujur **“Pin akan tamat”**. Attention Evaluation Layer tidak boleh dibina atas signal itu tanpa model data dan path sebenar yang belum ada.

## Jawapan kepada soalan pengesahan

### 1. Adakah Pin benar-benar disimpan dalam `story_overrides`?

**Tidak, berdasarkan codebase dan DB yang diperiksa.**

- Carian seluruh sumber semasa menemukan sifar rujukan kepada `story_overrides`, `override_type`, `submitPinOverride`, `public_active_overrides`, atau `resolveStoryField`.
- Carian sejarah semua ref Git dengan `git log -S` untuk setiap pengecam tersebut juga tidak menemui commit yang memperkenalkannya.
- SQLite tempatan tidak mempunyai jadual yang namanya padan `override`, `story`, atau `pin`.

Pin yang memang wujud adalah pin nota Ketua Editor (`editor_notes.is_pinned`) dan pin sidebar Editorium (state UI). Kedua-duanya tiada tarikh luput.

### 2. Adakah Pin mempunyai `expires_at` 24 jam?

**Tidak dapat dibuktikan; bukti semasa menunjukkan tiada model tersebut dalam repositori ini.**

Carian `expires_at` tidak menemui penggunaan sumber. Tiada nilai 24 jam untuk pin atau override ditemui dalam schema, write path, reader, atau sejarah Git yang tersedia.

### 3. Adakah `expires_at` dibaca oleh reader untuk menentukan Pin masih aktif?

**Tidak.**

Tiada medan atau reader `expires_at` ditemui. Maka tidak ada penguatkuasaan read path untuk menapis pin yang telah tamat.

### 4. Adakah `scheduledExpiresAt` berkaitan dengan Pin atau lifecycle kandungan sahaja?

**Lifecycle kandungan sahaja.**

| Perkara | Bukti code path |
| --- | --- |
| Penyimpanan | `editorial_revisions.scheduledExpiresAt` ditambah oleh migrasi runtime dalam `server.js`. |
| Siapa boleh menetapkan | PATCH kandungan membaca `scheduledPublishAt` / `scheduledExpiresAt` dan menghadkan perubahan kepada peranan `manageEditorial`. |
| Kesan apabila tiba | `runSchedulingTick()` memilih revisi `approved` yang ada `scheduledExpiresAt`, kemudian menukar statusnya kepada `archived`. |
| Paparan | Indeks memaparkan label `Dijadualkan luput`; Senarai Slot menerangkan ia sebagai Jadual Terbit/Luput pilihan. |
| Bukan RSS/pin | Laluan ticker menolak kedua-dua medan jadual kerana item ticker disegarkan daripada RSS. |

Rujukan utama: `core/routes/contentRoutes.js` (gerbang sekitar baris 195–205 dan tik luput sekitar 305–341), `core/editorial/Scheduling.js`, `src/components/editorium/IndeksConsole.tsx` (baris 377–407 dan 1857–1858), dan `server.js` (baris 1890–1893).

### 5. Adakah mana-mana code path menghasilkan konsep “Pin akan tamat”?

**Tidak.**

Tiada model pin kandungan bertarikh, tiada penilai tempoh pin, tiada query reader aktif, dan tiada UI atau mesej yang memaparkan konsep tersebut. Yang hampir serupa hanya `scheduledExpiresAt`, yang memaksudkan kandungan akan diarkibkan.

### 6. Jika kedua-duanya wujud, bezakan kedua-dua lifecycle tersebut dengan jelas.

Dalam checkout ini, **hanya lifecycle jadual kandungan wujud**. Perbandingan di bawah menjelaskan model yang ditemui berbanding model override yang dicadangkan tetapi tidak ditemui:

| Dimensi | Jadual luput kandungan (wujud) | Override/pin tamat (tidak ditemui) |
| --- | --- | --- |
| Rekod | `editorial_revisions.scheduledExpiresAt` | Tiada `story_overrides` |
| Objek | Revisi kandungan | Tiada objek override |
| Kesan tamat | `approved` → `archived` | Tiada kesan ditakrifkan |
| Pembaca | Query kandungan hanya melihat status lifecycle yang terhasil | Tiada reader aktif |
| Tujuan | Kawal hayat kandungan diterbitkan | Akan menjadi keputusan editorial/paparan, jika dibina kelak |
| Bahasa UX | `Kandungan dijadualkan luput` | Jangan papar `Pin akan tamat` |

## Pemerhatian pangkalan data tempatan

Pangkalan data `adjung.db` dibuka secara read-only. Ia mengandungi jadual editorial asas, tetapi belum menunjukkan lajur `scheduledPublishAt` atau `scheduledExpiresAt` pada `editorial_revisions`. Ini konsisten dengan kod yang menjalankan `ALTER TABLE ... ADD COLUMN` semasa boot. Ia **tidak** menukar kesimpulan source-of-truth: kod runtime menyokong jadual luput, tetapi salinan DB tempatan mungkin belum pernah diboot dengan versi migrasi ini.

## Implikasi kepada UX contract dan Attention Layer

1. Jangan implement `pin_expiring`.
2. Jangan gunakan `scheduledExpiresAt` sebagai pengganti pin; ia akan mengubah maksud signal.
3. UX contract sedia ada perlu kekal berhenti pada pemerhatian ini sehingga pemilik produk mengesahkan sama ada sistem override/pin berada di repositori atau branch lain.
4. Hanya selepas sumber pin yang sebenar dikenal pasti, kontrak boleh membezakan `pin_expiring` (override editorial) daripada `scheduled_expiry_soon` (lifecycle kandungan).

## Kesimpulan

Pilihan selamat ialah menganggap andaian `story_overrides.expires_at` sebagai **tidak disahkan dan tidak hadir dalam checkout ini**. Tiada implementasi Attention Layer patut diteruskan berdasarkan andaian tersebut.
