# Glosari Bahasa Adjung Brief

Rujukan istilah rasmi produk Adjung Brief dalam Bahasa Melayu — untuk sesiapa yang menulis
teks dipaparkan kepada pengguna (label UI, mesej sistem, Arahan AI, dokumentasi awam).

Disusun 2026-08-16 selepas audit bahasa 10 pusingan bersama ChatGPT (thread "Audit Adjung
Brief"), dicetuskan teguran Izzat tentang bahasa UI yang bercampur Inggeris-Melayu tanpa
kawalan ("bahasa rojak"). Untuk peraturan tatabahasa/imbuhan dan prinsip nada, lihat
"Panduan Bahasa Melayu Adjung" dalam `CLAUDE.md` — fail ini fokus SENARAI ISTILAH sahaja.

**Skop**: istilah dalam fail ini terpakai pada teks yang PEMBACA/EDITOR nampak (UI, mesej
ralat, Arahan AI, halaman awam). Nama fungsi/pemboleh ubah/laluan API/lajur pangkalan data
dalam kod KEKAL guna konvensyen kod sedia ada (biasanya Bahasa Inggeris) — jangan tukar
nama kod semata-mata sebab bahasa; itu isu berasingan daripada bahasa yang dipaparkan.

## Istilah AI

| Konsep | Istilah rasmi (UI) | JANGAN guna (UI) | Kekal boleh guna (kod/dokumentasi dalaman) |
|---|---|---|---|
| Teks arahan yang disalin editor untuk ditampal ke AI luaran | **Arahan AI** | prompt | `prompt` (nama pemboleh ubah/fungsi, cth `copyPrompt()`) |
| Ruang perbualan dalam ChatGPT/Claude/Gemini | **sesi AI** (atau "sesi AI pilihan anda") | chatbox, chatbox AI, ruang chat | — |
| Templat Arahan AI untuk Semakan Kandungan | **Arahan AI untuk Semakan** | Prompt Semakan | `promptSemakan` (nama pemboleh ubah) |

## Identiti & akaun

| Konsep | Istilah rasmi (UI) | JANGAN guna (UI) |
|---|---|---|
| Nama log masuk akaun | **nama pengguna** | username |
| Alamat surat elektronik | **e-mel** (bersempang, ejaan baku DBP — macam e-dagang, e-pembelajaran) | emel, email |

## Alamat web

| Konsep | Bila guna | Contoh |
|---|---|---|
| Alamat web, konteks MEDAN/BORANG/DATA teknikal | **URL** | "URL sumber", "URL artikel", "URL imej" |
| Alamat web, konteks AYAT PENERANGAN/ARAHAN am | **pautan** | "Klik pautan ini", "Kongsi pautan artikel" |

Jangan gantikan semua "URL" dengan "pautan" atau sebaliknya — kedua-dua istilah kekal, dipilih
ikut konteks (medan teknikal vs ayat huraian), sama macam pembezaan "slot" vs "ruang".

## Status kandungan (kod dalaman → label dipaparkan)

Kod status mentah (`approved`/`pending`/dll., lihat `CONTENT_STATUSES` di `contentRoutes.js`)
TIDAK PERNAH patut sampai ke paparan mentah — sentiasa petakan ke label berikut dahulu
(lihat `STATUS_KANDUNGAN_LABEL`, `LogAuditConsole.tsx`, sumber kebenaran tunggal):

| Kod dalaman | Label dipaparkan |
|---|---|
| `approved` | Aktif |
| `pending` | Menunggu |
| `rejected` | Ditolak |
| `archived` | Arkib |
| `scheduled` | Berjadual |
| `dipadam` | Dipadam |

## Istilah pinjaman lazim (kekal, tanpa condong/terjemah paksa)

Istilah berikut dianggap sebahagian daripada bahasa produk Adjung — JANGAN paksa tukar ke
Bahasa Melayu "murni" atau condongkan:

- **slot** — konsep produk Adjung sendiri (cth "Slot 3: Syariah"), bukan "ruang"
- **status**, **draf**, **animasi**, **modul** — sudah diterima luas dalam Bahasa Melayu teknikal

## Istilah teknikal antarabangsa (kekal, tanpa condong)

API, IP, RSS, URL, PDF, AI, USB, HTML — singkatan huruf besar bukan "perkataan asing", ia
istilah standard. Contoh: "API cuaca" (betul), bukan "*API* cuaca" (condong, tak perlu).

## Contoh pembetulan sebenar (audit 2026-08-16)

Kekal sebagai rujukan corak kesilapan biasa — bukan senarai lengkap, tapi contoh sebenar yang
pernah wujud dalam kod Adjung Brief sebelum dibaiki:

| Fail/lokasi | Asal | Dibetulkan kepada |
|---|---|---|
| `SlotManagerModal.tsx`, butang salin Arahan AI | "Salin prompt" | "Salin Arahan AI" |
| `SlotManagerModal.tsx`, teks bantuan | "...ditampal ke chatbox AI..." | "...ditampal ke sesi AI pilihan anda..." |
| `ContentReview.tsx`, panel Arahan AI Semakan | "Prompt Semakan (salin ke chatbox AI luaran)" | "Arahan AI untuk Semakan (salin ke sesi AI pilihan)" |
| `ContentReview.tsx`, keadaan kosong | "Tiada prompt disimpan lagi." | "Tiada Arahan AI disimpan lagi." |
| `DirektoriConsole.tsx`, placeholder carian | "Cari anggota, username, atau emel…" | "Cari anggota, nama pengguna atau e-mel…" |
| `LogAuditConsole.tsx`/Dashboard Aktiviti Editor | "Tukar status: approved → archived" | "Tukar status: Aktif → Arkib" |
| `DashboardConsole.tsx`, nota privasi statistik | "Anonim, tiada cookie, tiada IP direkod." | "Anonim, tiada kuki dan tiada alamat IP direkodkan." |
| `LoginModal.tsx`, borang lupa kata laluan (×3) | "emel"/"Emel" | "e-mel"/"E-mel" |
| `ProfilEditorModal.tsx`, Kelayakan Akaun (×~10) | "Username"/"username", "Emel"/"emel" | "Nama Pengguna"/"nama pengguna", "E-mel"/"e-mel" |

## Audit Zon 1: Editorium, Tetapan, Modal, Dashboard — selesai 2026-08-16

Ekstrak menyeluruh teks Bahasa Melayu daripada 18 fail (`EditoriumView.tsx`, `EditoriumLayout.tsx`,
`DashboardConsole.tsx`, `TetapanConsole.tsx`, `TetapanAmSlotConsole.tsx`, `LoginModal.tsx`,
`LengkapkanProfilModal.tsx`, `ProfilEditorModal.tsx`, `MaklumanDrawer.tsx`, `PanduanConsole.tsx`,
+ komponen kongsi `common/` — `AmaranBelumSimpan`/`KeadaanKosong`/`KeadaanMemuat`/`MesejStatus`/
`Toast`/`LoadingScreen`/`ErrorBoundary`/`SkrinDegradasiDB`). Majoriti teks SUDAH kualiti baik
(banyak fail, terutama `PanduanConsole.tsx`, sudah melalui beberapa pusingan penghalusan bahasa
sebelum audit ni) — 5 pembetulan konkrit disenaraikan di atas (baris `DashboardConsole.tsx`/
`LoginModal.tsx`/`ProfilEditorModal.tsx`) ialah SEMUA isu sebenar yang ditemui zon ni, bukan
senarai separa.

## Kerja belum selesai (dilaporkan kepada Izzat, belum dijadualkan)

ChatGPT mencadangkan audit bahasa penuh merentasi seluruh repo, dibahagikan ikut zon supaya
tidak terlepas konteks istilah (bukan "lint bahasa" rawak):

1. ~~Editorium, Tetapan, Modal, Papan Pemuka (Dashboard)~~ — **selesai 2026-08-16**, lihat di atas
2. Editor Kandungan, Slot
3. Log Masuk/Auth, Onboarding, mesej ralat
4. Halaman awam (frontpage, Focus View, halaman statik)

Zon 2-4 masih belum dijadualkan — tugas berasingan bila Izzat bersedia.
