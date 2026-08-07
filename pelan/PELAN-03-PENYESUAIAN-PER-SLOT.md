# PELAN 03 — Penyesuaian Per-Slot (Animasi, Logo, Warna)

**Tarikh:** 2026-08-07 · **Status:** Arahan eksplisit Izzat — "pastikan saya boleh memilih animasi, logo, warna, dan segala yang berkaitan dengannya yang berbeza-beza untuk setiap slot/kad… sebab saya nak frontpage tidak membosankan."
**Untuk:** Mana-mana sesi Claude (Opus/Sonnet) — pelan berdikari.

> **WAJIB baca dahulu:** `CLAUDE.md`. Nota falsafah: Falsafah #2 (layan tier sama rata) terpakai pada PERATURAN & VALIDASI (had aksara, overflow) — ia TIDAK menghalang pilihan ESTETIK berbeza per-slot; kepelbagaian estetik per-slot ialah kehendak eksplisit pemilik projek. Jangan keliru dua perkara ini.

---

## 1. Keadaan semasa (disahkan dalam kod, 2026-08-07)

**Sudah per-slot** (jadual `slots_config`, disunting melalui modal "tetapan slot" di `SenaraiSlotConsole.tsx:119`, laluan `core/routes/slotsConfigRoutes.js`):
- `bgColor`, `borderColor` — warna latar/sempadan kad
- `carouselInterval`, `carouselDelay` — masa carousel
- `jenisAnimasiOverride` — jenis animasi ('' = ikut tetapan am; pudar/colophon/sapuan_lajur/gerak_susun)
- `arahOverride` — arah animasi

**Masih GLOBAL sahaja** (jadual `slot_am_settings`, `core/routes/slotAmRoutes.js` — `AM_DEFAULTS`):
- `warnaPanelTransisi` — SATU warna panel untuk semua slot (lalai maroon)
- `kelajuanAnimasi` — SATU pendarab kelajuan untuk semua slot
- `nisbahPenajaTransisi` — SATU nisbah logo Adjung:penaja untuk semua slot
- `animasiAktif` — togol induk (kekal global, sengaja)

**Corak penyelesaian sedia ada yang WAJIB diikut:** nilai override kosong `''` bermakna "ikut tetapan am" — lihat `jenisAnimasiUntukSlot()` (dirujuk di `server.js:1806-1811`) dan pengesahan nilai di `slotsConfigRoutes.js:184`. Jangan reka corak kedua.

## 2. Skop — medan per-slot BAHARU

Tambah pada `slots_config` (migrasi `ALTER TABLE ... ADD COLUMN ... DEFAULT ''` dalam blok migrasi `server.js` sedia ada, corak sama seperti `jenisAnimasiOverride` di `server.js:1811`):

| Medan baharu | Jenis | Makna |
|---|---|---|
| `warnaPanelOverride` | TEXT `''` | Warna panel transisi slot ini ('' = ikut `warnaPanelTransisi` am). Nilai hex disahkan server-side (`/^#[0-9a-fA-F]{6}$/`). |
| `kelajuanOverride` | TEXT `''` | Pendarab kelajuan animasi slot ini ('' = ikut am; julat sah 0.25–4, disahkan server). |
| `logoTransisiMode` | TEXT `''` | Logo dalam panel transisi slot ini: `''` = ikut giliran am (nisbah Adjung:penaja), `adjung` = logo Adjung sahaja, `penaja` = penaja sahaja (jatuh balik Adjung jika tiada penaja layak — panel TIDAK boleh kosong), `tiada` = tanpa logo. |

**"Segala yang berkaitan":** semua tetapan estetik transisi/kad lain yang kini global HANYA kekal global jika ada sebab kukuh (contoh `animasiAktif` — suis kecemasan induk; `focusViewTitleScale` — bukan harta kad). Jika ragu, jadikan per-slot dengan lalai ikut-am. Imej latar kad per-slot: KIV berasingan sedia ada (lihat memori projek Focus View) — JANGAN masuk skop ini tanpa arahan baharu.

## 3. Pelaksanaan

### 3a. Server
1. Migrasi 3 lajur baharu (corak `server.js:1811`).
2. `slotsConfigRoutes.js` — terima+sahkan 3 medan baharu dalam POST (ikut corak `jenisAnimasiOverrideSah` baris 184: nilai tak sah → jatuh ke `''`, bukan ralat 500).
3. Fungsi penyelesai kongsi per-medan (corak `jenisAnimasiUntukSlot()`): `warnaPanelUntukSlot(slotIndex)`, `kelajuanUntukSlot(slotIndex)`, `logoModeUntukSlot(slotIndex)` — SATU tempat, diguna semula frontend/backend mana yang perlu.
4. `logAudit` pada setiap perubahan (corak sedia ada di laluan slot).
5. **Gerbang:** laluan tulis `slots_config` mesti `requirePermission('manageEditorial')` — selaras pembaikan Pelan 02 #4/#5 (jika Pelan 02 belum siap, tetap gerbangkan laluan BARU ini dari mula).

### 3b. Frontend — Editorium (UI pilihan)
Rumah tetapan: modal "tetapan slot" sedia ada di `SenaraiSlotConsole.tsx` (tempat `jenisAnimasiOverride`/`arahOverride` kini). Tambah 3 kawalan:
- Warna panel: pemilih warna + pratonton kecil + butang "Ikut Tetapan Am" (set balik `''`)
- Kelajuan: pilihan diskret (0.5× / 1× / 1.5× / 2× / Ikut Am) — bukan input bebas, elak nilai tak masuk akal
- Logo: dropdown 4 pilihan §2
- Setiap kawalan menunjukkan nilai am semasa dalam label ("Ikut Am — kini: maroon #802334") supaya Ketua Editor faham apa yang diwarisi
- Patuh gaya borang Pelan 01 (`LABEL_BORANG`/`INPUT_BORANG`) — jika Pelan 01 sudah berjalan, guna komponennya

### 3c. Frontend — FrontpageView (penggunaan)
`CarouselStableBlock` di `FrontpageView.tsx` kini membaca tetapan am untuk warna panel/kelajuan/giliran logo — tukar kepada penyelesai per-slot (§3a.3).
**AMARAN KERAS (dari CLAUDE.md):** struktur JSX `renderItem` sangat fragile — jangan ubah struktur pembalut; hantar nilai warna/kelajuan/logo sebagai prop/pembolehubah sahaja. Uji visual bersungguh selepas sentuh.

### 3d. Ticker & tier BAR
Kekal DILUAR skop — kedua-duanya tiada carousel/panel transisi sama (rumah sendiri di Modul Khas). Nyatakan dalam UI jika slot BAR dibuka tetapannya (sorok kawalan tak relevan, jangan papar kawalan mati).

## 4. Pengesahan (wajib, mata bukan teka)

- [ ] Slot ujian A dan B diberi warna panel + kelajuan + logo BERBEZA; rakam/screenshot kedua-dua transisi di browser sebenar dan sahkan setiap satu ikut tetapannya sendiri
- [ ] Slot dengan `''` disahkan masih ikut tetapan am, dan berubah serta-merta apabila tetapan am diubah
- [ ] `logoTransisiMode: 'penaja'` tanpa penaja layak → jatuh balik logo Adjung (panel tidak kosong)
- [ ] Nilai tak sah melalui API terus (hex rosak, kelajuan 99) → ditolak/dinormalkan, bukan disimpan
- [ ] `animasiAktif = 0` global masih mematikan SEMUA slot tak kira override (suis induk menang)
- [ ] Kandungan carousel tidak bertindih/berubah saiz (height-lock `CarouselStableBlock` kekal berfungsi) pada slot yang diubah
- [ ] `npx tsc --noEmit` + `npm test` bersih; `adjung.db` disandarkan sebelum ujian tulis

## 5. Komit

1. `feat(slot): migrasi + laluan server penyesuaian per-slot — Pelan 03 §3a`
2. `feat(editorium): kawalan per-slot warna/kelajuan/logo dalam tetapan slot — Pelan 03 §3b`
3. `feat(frontpage): transisi guna penyelesai per-slot — Pelan 03 §3c` (+ bukti visual kepada Izzat)
