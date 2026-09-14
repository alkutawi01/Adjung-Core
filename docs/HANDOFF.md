# Handoff — Adjung Core / Adjung Brief

Ditulis: 2026-09-14, oleh sesi Claude sebelum ini (mesin lain, sinkron via GitHub — bukan
konteks perbualan, lihat memori "Adjung cross-machine workflow"). Baca fail ini PENUH sebelum
buat apa-apa; ia snapshot titik-masa, bukan dokumen kekal — kemas kini/padam bila dah lapuk.

## 0. Baca CLAUDE.md dahulu

Fail `CLAUDE.md` di root repo ini ialah rujukan seni bina + konvensyen projek yang WAJIB dibaca
sebelum ubah apa-apa kod — bajet ruang kad, skema data, RBAC, Bahasa Melayu, dsb. Fail ini
(HANDOFF.md) cuma tambahan "apa sedang berlaku sekarang", bukan gantian CLAUDE.md.

## 1. Perubahan BELUM commit — tindakan pertama awak

```
git status --short
```
akan tunjuk:
```
 M src/components/portal/FrontpageView.tsx
```

Ini pautan **"Adjung Quick"** yang baru ditambah dalam footer awam (kolum baharu "Produk Adjung",
grid footer dinaikkan drpd 3 → 4 lajur di desktop, `col-span-2` di mobile supaya kolum baharu
ambil satu baris penuh sendiri). Latar belakang: Izzat minta promosi Adjung Quick (produk lain
dlm keluarga Adjung Press) DALAM Adjung Brief — bukan letak dlm kolum "Maklumat" sedia ada
(percubaan pertama, DITOLAK Izzat sebab "Maklumat" khusus halaman polisi/hubungi pasal Brief
sendiri, bukan produk lain — kategori konsep berbeza).

**Status pengesahan**: `npx tsc --noEmit` bersih, `npm test` 249/249 lulus, disahkan VISUAL di
localhost (`preview_start` nama `adjung-core-dev`, port 3001) desktop DAN mobile (375px) —
kedua-dua kemas, grid tak pecah. **BELUM di-commit, BELUM push** — Izzat minta uji di localhost
dulu sebelum push (dia risau saya silap), dan sesi terputus sebelum sempat dapat kelulusan akhir
untuk push. **Tindakan pertama awak**: tunjuk Izzat screenshot/localhost sekali lagi kalau perlu,
dapatkan pengesahan eksplisit, baru `git add src/components/portal/FrontpageView.tsx` (fail ni
SAHAJA, jangan `-A`) → commit → `git pull origin main --no-rebase` → `git push origin main`.

## 2. Gelung buru-pepijat standing (mandat berterusan)

Izzat (Ketua Editor, bukan pemaju) ada arahan tetap: bila dia hantar frasa TEPAT
**"cari 1 bug. cari semua tempat. try uji segala2nya. jumpa, baiki, uji, lapor."** — ini
bermaksud lancarkan SATU pusingan Agent (subagent) untuk cari SATU pepijat sebenar, baiki,
sahkan (ujian HTTP/DB sebenar atau tsc+static-render utk frontend), commit dlm Bahasa Melayu,
push ke `origin/main`, lapor kepada Izzat dlm Bahasa Melayu ringkas, pastu jadualkan wakeup
30 minit (`ScheduleWakeup delaySeconds:1800`) utk pusingan seterusnya. Setiap kali dia hantar
frasa tu semula (sama ada manual atau via wakeup terjadual), ulang corak yang sama.

**Jumlah kekal setakat penghujung sesi lepas: 289 bug sebenar**, merentasi 335+ pusingan,
>3 hari audit berterusan. **PENTING**: kalau Izzat minta "berhenti dulu" atau sesuatu serupa,
panggil `ScheduleWakeup({stop:true})` SERTA-MERTA dan JANGAN sambung gelung secara automatik
lepas tu walau dia hantar frasa trigger semula tanpa penjelasan — tanya dulu kalau teragak-agak
(pernah berlaku kekeliruan sesi lepas: sambung semula tanpa tanya, Izzat tegur).

Setiap pusingan agent diberi konteks "vena" (bug class) yang baru ditemui dlm pusingan
sebelumnya + arahan eksplisit "buat kerja ni SENDIRI SECARA LANGSUNG, JANGAN spawn/delegate ke
sub-agent lain" (pernah ada satu pusingan awal tersekat sebab agent cuba spawn sub-agent sendiri
dan tak siap). Corak yang amat produktif sepanjang sesi lepas (kalau perlu sambung vena serupa):
- Pintasan status berbilang-langkah (tukar status sementara + ubah medan terlindung, tukar
  balik) — cari corak "semak status SASARAN sahaja, bukan status SEMASA" di seluruh laluan PATCH.
- Ketaksamaan pengesahan POST vs PUT/PATCH untuk sumber sama.
- Fungsi notifikasi/log dgn BERBILANG titik pencetus, tapi satu titik terlepas fix lepas.
- Gerbang SSRF (`core/utils/urlSafety.js`) — 3 jurang IP peribadi/CGNAT/NAT64 ditemui berturutan,
  mungkin ada lagi kalau nak sambung teknik sama (semak Julat Alamat Khas IANA penuh).
- Kelemahan validasi tarikh kalendar bentuk-sahaja (`!isNaN(new Date(v))` yg senyap gulung
  tarikh tak sah, cth 30 Feb) — 3 fail ditemui, mungkin dah tuntas.

Kalau Izzat hantar frasa trigger tu lagi, teruskan corak di atas terus tanpa tanya — dia dah
sahkan arahan ni berkali-kali sepanjang sesi lepas.

## 3. Tugasan tertangguh — artikel Tahir Browser (BELUM selesai, jangan lupa)

Izzat pernah minta (awal sesi lepas): "https://tahirbrowser.com/ — tambah satu artikel ttg ni,
jangan lupa semak dgn ChatGPT" untuk platform Adjung Brief. Draf pernah disiapkan dan disemak
ChatGPT (thread "Semak fakta dan bahasa Melayu", projek "Adjung Brief" di chatgpt.com), TAPI
penerbitan tersekat sebab pada masa tu tiada sesi Editorium disahkan — kemudian Izzat log masuk
sendiri, tapi fokus sesi beralih ke gelung buru-pepijat + tugasan kandungan lain sebelum artikel
Tahir Browser ni sempat diterbitkan. **Status tak pasti** — semak Kandungan → Indeks di Editorium
untuk draf/kandungan berkaitan "Tahir Browser" sebelum tanya Izzat, jangan andaikan dah hilang
atau dah terbit tanpa semak dulu.

## 4. Kandungan editorial baru diterbitkan sesi lepas (rujukan, bukan tindakan)

3 kandungan (Angkasa: penemuan decagon Saturn/Hubble; Perubatan: regenerasi sel jantung
manusia; Teknologi: cip Apple A20 Pro 2nm) diterbitkan sesi lepas, kesemuanya lalui ChatGPT
fact-check (URL sumber + petikan langsung disertakan, beberapa overclaim dibetulkan sebelum
terbit — cth tajuk cip A20 Pro asalnya silap dakwa "pertama DUNIA", ChatGPT betulkan jadi
"pertama APPLE sahaja"). Tiada tindakan susulan diperlukan, sekadar konteks kalau Izzat rujuk
balik kandungan ni.

## 5. Akaun log masuk yang digunakan

Sesi Editorium yang aktif (kalau sesi browser lama masih hidup) log masuk sebagai akaun
"Claude Antrophic" (`alkutawi_01@yahoo.com.my`, peranan editor + penolong ketua editor). Ini
akaun SAH yang Izzat sendiri sediakan untuk kegunaan Claude terbitkan kandungan — BUKAN akaun
diteka/curi. Kalau sesi browser dah tamat tempoh, JANGAN teka kata laluan atau log masuk sendiri
tanpa arahan — minta Izzat log masuk semula atau beri arahan lanjut (peraturan keselamatan
standard: tak boleh masukkan kata laluan bagi pihak pengguna).

## 6. Nota gaya kerja Izzat (ringkas, penuh di memori)

- Terus terang tapi tak formal — "awak" (bukan "kau"), Bahasa Melayu + English bercampur santai.
- Elak em dash (—) dlm teks awam/UI — dia anggap ciri tulisan AI, guna koma/noktah bertitik.
- Tanya dulu sebelum perubahan UI/UX besar — jangan terus laksana anggapan sendiri (rujuk kes
  footer di atas: dia tolak percubaan pertama, minta kajian dulu).
- Setiap kandungan editorial (AI atau manual) WAJIB lalui ChatGPT fact-check dgn URL sumber +
  petikan langsung disertakan — tiada pengecualian, insiden fabrikasi BookChef punca dasar ni.
- Wikipedia haram sepenuhnya sbg sumber (baca/rujuk/semak silang).
