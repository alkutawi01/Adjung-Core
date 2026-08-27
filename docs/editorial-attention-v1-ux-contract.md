# Kontrak UX: Perhatian Editorial V1

**Status:** Diluluskan untuk implementasi kecil

Dokumen ini mengunci bahasa dan sempadan paparan untuk Perhatian Editorial V1.
Ia ialah kontrak pengalaman manusia, bukan reka bentuk enjin, skema pangkalan data, atau
spesifikasi notifikasi.

## Prinsip

`AttentionItem` ialah hasil kiraan daripada keadaan sedia ada:

```
keadaan editorial dan operasi sedia ada
                ↓
      penilaian perhatian (derived)
                ↓
          paparan Editorium
```

Ia bukan rekod editorial. Oleh itu V1 tidak mewujudkan jadual `attention_items`, lifecycle,
audit baharu, status selesai, atau tindakan manusia ke atas AttentionItem itu sendiri.
Tindakan, jika ada, sentiasa berlaku pada objek asal seperti berita di Semakan atau konfigurasi
sumber RSS.

## Jenis perhatian

Setiap item mesti mempunyai satu jenis sahaja. Warna atau ikon tidak boleh menjadi satu-satunya
cara membezakan jenis tersebut.

| Jenis | Maksud kepada admin | Bahasa yang digunakan | Destinasi tindakan |
| --- | --- | --- | --- |
| **Perlu tindakan** | Editor mungkin perlu menyemak dan membuat keputusan editorial. | `Perlu tindakan` | Semakan Kandungan / giliran semakan yang berkaitan |
| **Perlu makluman** | Tiada kesilapan; maklumat membantu editor merancang kerja. | `Perlu makluman` | Objek asal, jika tindakan lanjutan diperlukan |
| **Status sistem** | Keadaan operasi perlu diketahui oleh pihak yang mengurus sumber/sistem. | `Status sistem` | Status atau tetapan sumber yang berkaitan |

## Signal V1

### 1. Keyakinan klasifikasi rendah

- **Kunci dalaman:** `low_confidence_classification`
- **Jenis:** Perlu tindakan
- **Nama paparan:** `Berita ini belum pasti bidangnya`
- **Maksud:** Sistem tidak cukup yakin dengan pengelasan bidang bagi berita tersebut.
- **Tindakan yang dicadangkan:** `Buka Semakan`
- **Larangan bahasa:** Jangan mendakwa berita itu salah, bercanggah, atau gagal diproses.

Signal ini hanya wujud untuk item yang benar-benar mempunyai hasil klasifikasi berkunci
keyakinan rendah. Ketiadaan hasil klasifikasi bukan bukti keyakinan rendah.

### 2. Ambilan sumber RSS gagal

- **Kunci dalaman:** `rss_fetch_failed`
- **Jenis:** Status sistem
- **Nama paparan:** `Terdapat sumber berita yang gagal diproses hari ini`
- **Maksud:** Sekurang-kurangnya satu percubaan ambilan RSS hari ini merekodkan ralat.
- **Tindakan yang dicadangkan:** `Semak status sumber`
- **Larangan bahasa:** Jangan menamakan sumber tertentu, menyatakan semua sumber gagal, atau
  menganggap tiada berita diterima. V1 hanya mempunyai signal agregat yang selamat untuk dipapar.

### 3. Perkara yang akan tamat

- **Kunci dalaman dicadangkan:** `scheduled_expiry_soon`
- **Jenis:** Perlu makluman
- **Nama paparan:** `Kandungan dijadualkan luput esok`
- **Maksud:** Kandungan yang sengaja dijadualkan untuk luput akan berakhir dalam tempoh perhatian.
- **Tindakan yang dicadangkan:** `Semak kandungan`
- **Larangan bahasa:** Jangan panggil ini `masalah`, `ralat`, atau `pin akan tamat`.

### Kejelasan istilah: pin bukan jadual luput

Codebase semasa tidak mempunyai model **pin kandungan dengan tarikh tamat**. Ia mempunyai:

- pin untuk nota Ketua Editor dan sidebar, tanpa tarikh tamat; dan
- `scheduledExpiresAt` untuk kandungan editorial.

Oleh itu, V1 tidak boleh memaparkan `Pin anda tamat esok` tanpa membina state baharu yang
bercanggah dengan prinsip derived-only. Jika produk kelak memperkenalkan pin kandungan yang
bertarikh tamat, ia perlu kontrak UX dan sumber data sendiri. Sehingga itu, signal ketiga yang
jujur ialah jadual luput kandungan di atas.

## Keadaan kosong

Apabila tiada signal V1, paparan mesti menggunakan salinan ini:

> Tiada perkara yang memerlukan perhatian anda.  
> Sistem berjalan seperti biasa.

Jangan paparkan `0 attention items`, `Tiada alert`, atau bahasa teknikal dalaman kepada admin.

## Keadaan data tidak tersedia

Jika penilaian gagal dimuatkan, jangan tunjuk keadaan kosong dan jangan tukar kegagalan kepada
angka sifar. Gunakan:

> Perhatian editorial tidak dapat dimuatkan. Cuba muat semula.

## Di luar skop V1

- conflict classification;
- pipeline anomaly detection;
- per-source health atau nama sumber gagal;
- jadual atau lifecycle `attention_items`;
- auto-pin, cadangan pin, digest, atau notifikasi baharu.

## Kriteria penerimaan UX

1. Admin boleh melihat sama ada satu item ialah tindakan, makluman, atau status sistem tanpa
   menafsir warna sahaja.
2. Setiap mesej menerangkan maksudnya dalam bahasa editorial, bukan kunci teknikal.
3. Signal sumber gagal kekal agregat sehingga data kesihatan per-sumber diwujudkan.
4. Ketiadaan signal memberi kepastian positif, bukan metrik dalaman kosong.
5. Tiada paparan mendakwa adanya pin kandungan atau tamat pin yang tidak wujud dalam data.
