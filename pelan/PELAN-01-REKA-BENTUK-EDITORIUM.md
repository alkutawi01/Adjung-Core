# PELAN 01 — Penyeragaman Reka Bentuk Editorium

**Tarikh:** 2026-08-07 · **Status:** DILULUSKAN Izzat, sedia dilaksana
**Untuk:** Mana-mana sesi Claude (Opus/Sonnet) yang melaksana — pelan ini berdikari, tidak perlu rujuk perbualan asal.

> **WAJIB baca dahulu:** `CLAUDE.md` di akar repo. Falsafah #2 (layan semua ahli kumpulan sama rata) dan #3 (sahkan dengan mata di browser, bukan teka) terpakai sepenuhnya pada kerja ini.

---

## 0. Latar & Objektif

Editorium (konsol pentadbiran, `src/components/editorium/`) tiada sistem reka bentuk yang dikuatkuasakan: 5 keluarga gaya tajuk, 6 varian butang maroon, 4 ejaan warna maroon, 3 merah berbeza untuk ralat, 4 varian bayang kad, 2 gaya kepala jadual, dan modul Indeks langsung tiada tajuk. Komponen kongsi yang dibina audit terdahulu (komit `15e71ba`) wujud tetapi hampir tidak dipakai — `Button` dipakai 1/16 modul, `StatusBadge` 8/16.

**Objektif:** SATU bahasa visual untuk seluruh Editorium, sepadan gaya frontpage Adjung: maroon `#802334`, serif untuk tajuk, mono huruf besar untuk label, neutral stone hangat. Semua peraturan hidup dalam komponen/token kongsi — modul tidak menulis gaya sendiri lagi.

### Keputusan reka bentuk yang SUDAH diluluskan Izzat (jangan tanya semula, jangan ubah)

1. **Gaya tajuk modul:** keluarga **serif-maroon** — `font-serif text-base uppercase tracking-wider text-Adjung-maroon font-bold` (seperti Log Sistem / Direktori sekarang). Terapkan pada KESEMUA modul.
2. **Paparan Utama (DashboardConsole): KEKALKAN gaya "lejar"** tersendiri (h1 serif besar, tanpa kad putih, tepi-ke-tepi). Hanya selaraskan warna/token (lihat §4, modul 1). Jangan paksa ia jadi kad putih.
3. **Sidebar kekal tinggi penuh** (atas sampai bawah) — jangan ubah kepada tinggi-ikut-menu.

### Kerja yang SUDAH siap sebelum pelan ini (jangan ulang)

- Had lebar kandungan 1400px berpusat di `EditoriumLayout.tsx` (`<main>` → `div.max-w-[1400px].mx-auto`)
- Pilihan "Sematkan sidebar" + penolakan kandungan/footer
- Footer dupliket DashboardConsole dibuang
- Pembetulan kelas pepijat "modal tertutup semasa drag-select" pada semua backdrop modal
- Token `--color-Adjung-paper: #F7F5F2` dan `--color-Adjung-line: #F0EDE9` sudah ditambah dalam `@theme` di `src/index.css`

---

## 1. Peraturan pelaksanaan (terpakai pada semua fasa)

1. **Satu komit per kumpulan modul** (lihat §5) dengan mesej `feat(editorium): seragamkan <kumpulan> — Pelan 01 §<n>`.
2. Selepas setiap kumpulan: `npx tsc --noEmit` MESTI bersih, dan **sahkan visual di browser sebenar** (bukan baca kod sahaja). Cara masuk tanpa akaun: suntik auth sementara di konsol browser —
   `localStorage.setItem('adjung-auth-user', JSON.stringify({id:'ukur',username:'ukur',penName:'Ukur',email:'u@l',role:'KETUA_EDITOR',roles:['ketua_editor','pentadbir'],termaDipersetujuiPada:'2026-01-01T00:00:00.000Z'}))` kemudian pergi `/editorium`. **Buang selepas siap** (`localStorage.removeItem('adjung-auth-user')`). Nota: data API sebenar perlukan sesi server — untuk semakan GAYA, keadaan ralat/kosong yang terpapar pun memadai; jangan cuba log masuk akaun sebenar.
3. **Jangan ubah teks kandungan/label Melayu sedia ada** — ini kerja gaya, bukan kerja istilah. Label hidup dalam `src/config/istilah.ts`; jangan sentuh.
4. **Jangan ubah tingkah laku/logik** — className dan struktur pembalut sahaja. Kecuali yang dinyatakan eksplisit dalam §4.
5. Nombor baris dalam pelan ini tepat pada 2026-08-07 tetapi **akan hanyut** — sentiasa `Grep` corak yang disebut, jangan percaya baris membuta.
6. Komen kod baharu dalam bahasa Melayu DBP (ialah/ialah, apabila bukan bila, tiada "di mana" penghubung).
7. Bahasa mesej UI: kekal 100% Melayu (kecuali istilah dikecualikan: *Bar*, *Ticker* — condong).

---

## 2. FASA A — Komponen & utiliti kongsi baharu

Semua diletak dalam `src/components/common/`. Yang sudah wujud: `Button.tsx`, `StatusBadge.tsx`, `Tooltip.tsx`, `BidangIcon.tsx`, `SlotMatrixCell.tsx`, `Toast.tsx`.

### A1. `ModulTajuk.tsx` (baharu)

Blok kepala modul piawai — kad putih dengan tajuk serif-maroon + huraian + slot tindakan kanan:

```tsx
interface ModulTajukProps {
  tajuk: string;
  huraian?: React.ReactNode;
  tindakan?: React.ReactNode;   // butang di hujung kanan (cth Muat Semula)
}
```

Rupa (ikut corak LogAuditConsole.tsx:93-109 sedia ada, yang menjadi rujukan):
- Pembalut: `bg-white p-6 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,.04)] border border-stone-200 flex flex-wrap justify-between items-center gap-4`
- `<h2>`: `font-serif text-base uppercase tracking-wider text-Adjung-maroon font-bold mb-1`
- Huraian `<p>`: `font-sans text-xs text-stone-600`

### A2. `PanelCard.tsx` (baharu)

Kad panel piawai: `bg-white rounded-lg border border-stone-200 shadow-[0_1px_2px_rgba(0,0,0,.04)]` + prop `padding?: 'p-0' | 'p-4' | 'p-6'` (lalai `p-6`; `p-0` untuk kad jadual yang perlukan `overflow-hidden` — sediakan juga prop `className`). Ini MENGGANTIKAN 4 varian bayang sekarang (tiada bayang / `shadow-sm` / hex literal) — satu bayang sahaja.

### A3. `SectionLabel.tsx` (naik taraf dari lokal)

Angkat definisi sedia ada di `PanduanConsole.tsx:10-14` ke `common/` TANPA mengubah rupanya:
`font-mono text-[10px] uppercase tracking-widest text-[var(--color-warning)] font-bold block mb-3`.
Kemudian padam definisi lokal di `PanduanConsole.tsx`, `PerlembagaanConsole.tsx`, `SistemRekaBentukConsole.tsx` dan import dari `common/`.

### A4. `MesejStatus.tsx` (baharu)

Kotak mesej ralat/kejayaan/neutral piawai:

```tsx
interface MesejStatusProps { tone: 'error' | 'success' | 'neutral'; children: React.ReactNode; className?: string; }
```

- error: `bg-red-50 border border-[var(--color-error)] text-[var(--color-error)] text-xs px-3 py-2 rounded`
- success: sama corak dengan `var(--color-success)` atas `bg-green-50`
- neutral: `bg-stone-50 border-stone-200 text-stone-700`

Ini menggantikan TIGA merah berbeza sekarang (`--color-error` vs `border-red-200 text-red-800` vs `text-red-700`).

### A5. `KeadaanKosong.tsx` (baharu)

Keadaan kosong ("Tiada …") piawai: teks terpusat `font-sans text-xs text-stone-400 text-center py-10` dengan prop `children` (+ `ikon?` pilihan). Gantikan tiga nada sedia ada.

### A6. `gayaKongsi.ts` (baharu) — pemalar kelas untuk corak yang tak sesuai jadi komponen

```ts
// Label medan borang (mono kecil huruf besar — bahasa label frontpage)
export const LABEL_BORANG = 'block font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500 mb-1';
// Input/textarea/select piawai + fokus maroon (satu-satunya gaya fokus dibenarkan)
export const INPUT_BORANG = 'w-full bg-stone-50 border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-Adjung-maroon focus:bg-white transition-colors';
// Kepala jadual (gaya mono DrafSaya/LogAudit — pemenang; latar kertas token baharu)
export const KEPALA_JADUAL = 'font-mono text-[10px] uppercase tracking-wider text-stone-400 bg-Adjung-paper';
// Garis pemisah baris jadual
export const GARIS_BARIS = 'border-t border-Adjung-line';
```

Nota: `bg-Adjung-paper` / `border-Adjung-line` ialah kelas terbitan token `@theme` yang SUDAH ditambah di `src/index.css` — sahkan ia berfungsi dengan semakan computed style di browser (ingat: utiliti Tailwind boleh kalah pada CSS tanpa lapisan dalam `index.css` — lihat memori projek; ukur, jangan percaya kelas).

---

## 3. FASA B — Satu ejaan maroon

**Ejaan piawai (satu-satunya dibenarkan): kelas Tailwind terbitan token** — `text-Adjung-maroon`, `bg-Adjung-maroon`, `border-Adjung-maroon`, dan `hover:bg-Adjung-maroon-dark` untuk keadaan hover. Dalam JSX `style=`/CSS mentah sahaja guna `var(--color-Adjung-maroon)`.

Gantikan dalam SEMUA fail `src/components/editorium/**` + `src/components/common/Button.tsx`:
- `#802334` literal (contoh disahkan: `SenaraiSlotConsole.tsx:463,533`, `EditoriumLayout.tsx:414,438`, `LengkapkanProfilModal.tsx:71`, `Button.tsx:23`, `LoginModal.tsx` beberapa tempat) → bentuk kelas/var
- `#601824`/`#6a1c2a`/`#9b2c41` hover tangan → `hover:bg-Adjung-maroon-dark` (`#601824` ialah nilai kanonikal token `--color-Adjung-maroon-dark`; dua lagi ialah hanyutan lama — SEMUA jadi token)
- `[var(--color-Adjung-maroon)]` dalam className → bentuk kelas pendek `*-Adjung-maroon`

**Kecualikan** `src/components/portal/**` (frontpage) daripada fasa ini — skop pelan ini Editorium sahaja; frontpage disentuh dalam kerja berasingan.

Ganti juga hex status DashboardConsole (`#3d6b4c`, `#b8934a`, `#a8241f` — huruf kecil, disahkan di `DashboardConsole.tsx:174-178, 201, 321` dan footer EditoriumLayout `#3d6b4c`) → `var(--color-success)` / `var(--color-warning)` / `var(--color-error)`.

---

## 4. FASA C — Penghijrahan modul demi modul

Inventori penuh & sasaran setiap modul. "Butang → Button" bermaksud: ganti butang kod tangan dengan `<Button variant size icon>`; padanan varian: butang maroon padat → `primary`; butang putih bersempadan → `secondary`; butang teks sahaja → `ghost`. Butang `bg-stone-100` neutral (cth "Muat Semula" LogAudit) → `secondary`. JANGAN reka varian baharu; jika ada keperluan luar tiga varian, tambah varian pada `Button.tsx` SEKALI dan guna di mana-mana.

Setiap modul turut menerima (senarai semak seragam — rujuk sebagai **[SERAGAM]**):
- Tajuk → `ModulTajuk` (tajuk sedia ada dikekalkan teksnya; modul tanpa huraian diberi huraian satu ayat pendek — tulis draf, Izzat semak selepas siap)
- Kad → `PanelCard`
- Ralat/kejayaan → `MesejStatus`
- "Tiada …" → `KeadaanKosong`
- Label/input borang → `LABEL_BORANG`/`INPUT_BORANG`
- Jadual → `KEPALA_JADUAL`/`GARIS_BARIS`
- Maroon → ejaan piawai (Fasa B serentak)

| # | Fail | Nota khusus tambahan |
|---|------|----------------------|
| 1 | `DashboardConsole.tsx` | **KECUALI [SERAGAM] tajuk/kad — kekalkan lejar** (keputusan Izzat). Hanya: hex status → token; `StatusBadge` untuk lencana status yang kini warna-sahaja; footer lokal sudah dibuang. |
| 2 | `IndeksConsole.tsx` | **Tiada tajuk langsung — beri `ModulTajuk`** ("Indeks Kandungan" + huraian). Kepala jadual sans (:822) → mono. Label borang tanpa mono (:598,614) → `LABEL_BORANG`. Ralat `border-red-200` (:571) → `MesejStatus`. Modal tajuk serif-xl stone-900 (:963) → kekal serif tetapi warna maroon (selaras A1). |
| 3 | `DrafSayaConsole.tsx` | Tajuk h3 sans (:122) → `ModulTajuk`. Jadual: hex sebaris `#F7F5F2`(:196)/`#F0EDE9`(:217) → token. |
| 4 | `NotaKetuaEditorConsole.tsx` | Tajuk (:189) → `ModulTajuk`. Pil skop tulisan tangan (:333-340) → `StatusBadge` (tone `neutral`/`success` ikut skop dalaman/awam). Ralat merah campuran (:269,308 `red-800`; :243,257 `red-700`) → `MesejStatus` + `text-[var(--color-error)]` untuk kaunter melebihi had. |
| 5 | `PenajaConsole.tsx` | Tajuk (:186) → `ModulTajuk`. Status penaja tulisan tangan → `StatusBadge`. |
| 6 | `SenaraiSlotConsole.tsx` | Tajuk (:276) → `ModulTajuk`. `#802334` (:463,533) → token. Tajuk modal → corak modal (lihat bawah jadual). |
| 7 | `TierKadConsole.tsx` | Tajuk (:111) → `ModulTajuk`. Butang `px-2.5 py-1 text-[10px]` (:203) → `Button size="sm"`. |
| 8 | `TetapanAmSlotConsole.tsx` | Tajuk (:264) → `ModulTajuk`. |
| 9 | `BidangConsole.tsx` | Tajuk (:520) → `ModulTajuk`. 8 butang tangan (sekitar :764) → `Button`. `text-Adjung-maroon` modal (:854) kekal (sudah ejaan betul). |
| 10 | `EditorialConsole.tsx` | 6 tajuk h3 → nilai: SATU `ModulTajuk` di atas + `SectionLabel` bagi subseksyen (ikut corak Perlembagaan), BUKAN 6 tajuk modul. Sudah guna `Button` — pastikan varian betul. |
| 11 | `TetapanConsole.tsx` | Tajuk campuran stone-800 (:400) / maroon (:865) → `ModulTajuk` seragam. 4 butang `px-4 py-2 shadow-xs` (:685,780,841,954) → `Button`. Corak fokus input di sini (satu-satunya yang ada) menjadi asas `INPUT_BORANG` — pastikan tiada regresi. |
| 12 | `LogAuditConsole.tsx` | Sudah keluarga betul — jadikan pengguna `ModulTajuk` pertama (rujukan asal). Butang Muat Semula (:103-108) → `Button variant="secondary" icon`. |
| 13 | `DirektoriConsole.tsx` | Tajuk (:170) sudah betul → `ModulTajuk`. **Butang mono `px-4 py-2 font-mono font-bold` (:193) → `Button` biasa (buang mono)**. Modal profil tajuk serif-xl stone-900 (:277) → maroon. |
| 14 | `PerlembagaanConsole.tsx` | Tajuk (:160) → `ModulTajuk`. `SectionLabel` → import dari common (A3). Seksyen bernombor 01-08 KEKAL. |
| 15 | `PanduanConsole.tsx` | Sama seperti #14 (tajuk :109, seksyen 01-07 kekal). `Card` lokal (:16-21) → `PanelCard` (perhati: lokal guna p-4 — pindah ke lalai p-6 KECUALI jika visual jadi terlalu longgar; uji mata). |
| 16 | `SistemRekaBentukConsole.tsx` | Sama (tajuk :83, seksyen 01-04 kekal). Selepas siap, KEMASKINI kandungannya — ia memaparkan sistem reka bentuk, jadi tambah seksyen mendokumen komponen kongsi baharu (ModulTajuk/PanelCard/MesejStatus/KeadaanKosong/pemalar gayaKongsi). |
| 17 | Modal-modal: `ProfilEditorModal.tsx` (:211 sans-xs maroon), `LengkapkanProfilModal.tsx` (:71 serif-lg #802334), modal Direktori/Indeks (serif-xl stone-900) | **Corak tajuk modal piawai:** `font-serif text-lg font-bold text-Adjung-maroon` + ikon kecil jika sedia ada. `LoginModal.tsx` (sans-xs uppercase maroon + Lock) turut diselaraskan. Input dalam modal → `INPUT_BORANG`. |
| 18 | `MaklumanDrawer.tsx` | [SERAGAM] sahaja (ia laci, bukan modul — tiada `ModulTajuk`; kekal tajuk laci sedia ada tetapi warna maroon serif). |

---

## 5. Urutan & kumpulan komit

1. **Komit 1:** Fasa A penuh (komponen baharu) + Fasa B pada `common/` sahaja. tsc + semak visual tiada regresi (komponen belum dipakai, risiko rendah).
2. **Komit 2:** Modul rujukan: LogAudit (#12), Direktori (#13), Indeks (#2) — kumpulan pertama sebab merangkumi semua corak (jadual, borang, modal, butang). **Selepas kumpulan ini, tunjuk screenshot kepada Izzat untuk pengesahan rupa sebelum meneruskan baki modul.**
3. **Komit 3:** Draf Saya (#3), Nota Ketua Editor (#4), Penaja (#5), Makluman (#18).
4. **Komit 4:** Slot: Senarai Slot (#6), Tier Kad (#7), Tetapan Am (#8), Bidang (#9).
5. **Komit 5:** Editorial (#10), Tetapan (#11), Dashboard (#1).
6. **Komit 6:** Rujukan: Perlembagaan (#14), Panduan (#15), Sistem Reka Bentuk (#16) + modal (#17).
7. **Komit 7:** Sapuan akhir — `Grep` seluruh `editorium/` untuk baki `#802334|#601824|#6a1c2a|#9b2c41|#F7F5F2|#F0EDE9|red-200|red-700|red-800|shadow-sm` dan bersihkan; kemas kini `SistemRekaBentukConsole`.

## 6. Kriteria siap (semak sebelum isytihar selesai)

- [ ] `grep -rn "#802334\|#F7F5F2\|#F0EDE9" src/components/editorium src/components/common` → 0 padanan (kecuali komen sejarah)
- [ ] `grep -rn "border-red-200\|text-red-700\|text-red-800" src/components/editorium` → 0 padanan
- [ ] Kesemua 16 modul + modal dilawati di browser dengan mata — tajuk seragam serif-maroon, satu bayang kad, satu gaya jadual/borang/ralat/kosong
- [ ] Dashboard kekal lejar; sidebar kekal tinggi penuh; had 1400px kekal berfungsi
- [ ] `npx tsc --noEmit` bersih; tiada regresi fungsi (borang masih hantar, jadual masih memuat)
- [ ] Screenshot setiap modul dikongsi kepada Izzat untuk kelulusan akhir
