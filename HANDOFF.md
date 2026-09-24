# Handoff — sesi simulasi & pembaikan "Arahan AI" / mod "Dengan rujukan"

**Tarikh**: 2026-08-14. Sesi lama (Claude Code), dipindah ke desktop lain atas permintaan Izzat.
Semua kerja di bawah **sudah commit + push + deploy** ke production (brief.adjung.com). Tiada
perubahan belum simpan dalam working tree — `git status` bersih.

**Commit terkini**: `59edc39` (main, sepadan `origin/main`, sudah live di production).

## Apa yang berlaku sesi ni (ringkasan)

Izzat minta simulasi sebenar ciri "Arahan AI" (mod "Dengan rujukan" dalam modal Tulis Kandungan,
`src/components/portal/SlotManagerModal.tsx`, fungsi `buildAiPrompt()`) — uji betul-betul guna AI
luar (ChatGPT/Gemini), bukan cuma baca kod. Proses: bina hipotesis → **rujuk ChatGPT dulu**
(corak tetap sesi ni) → uji sebenar dgn artikel Bernama/NST sebenar → temui pepijat sebenar →
baiki → ulang.

Rentetan commit (paling lama → terkini), semua di `git log`:
1. `d50d325`/`d2c4ea1` — prompt v2/v3: bajet aksara "sasaran selamat", semakan sendiri, larang Markdown
2. `d6a06cc` — mod "Dengan rujukan" v1: medan URL sumber wajib (sebelum ni togol wujud tapi buta huruf)
3. `bcc79bf` — audit ChatGPT: baiki daftar bahasa (guna->gunakan, cth->contoh, dll — Izzat kata "tidak profesional")
4. `6f7c50b` — asing medan ikut mod (Had usia sumber/Negara disembunyi dlm mod rujukan, Jumlah kandungan dikunci 1) — **AI-PROVENANCE-002/003**: simulasi Gemini Flash (tiada browsing) DIAM-DIAM REKA artikel lain walaupun ada URL sebenar dilekatkan (provenance palsu) — dibaiki dgn mukadimah [Peranan AI] + format kegagalan rasmi STATUS:/SEBAB:
5. `431fe8e` — sokong BERBILANG URL dalam mod rujukan (Izzat minta lepas simulasi tunjuk 1 URL tak cukup utk penerbitan sebenar) — blok [Keserasian sumber] (tolak jika tak berkaitan, banding/attribute jika fakta beza)
6. `59edc39` (**terkini**) — Izzat tangkap 2 bug kritikal semasa semak: (a) saya arahkan AI tulis literal "Sumber: Editorial Adjung" — SALAH, itu label yg sistem KIRA sendiri (FrontpageView.tsx, `sources.length > 1`), bukan utk AI tulis; (b) sistem cuma ada SATU tarikh dikongsi utk seluruh kandungan walhal sumber berbeza patut ada tarikh sendiri — lanjutan skema `sources[]`: `{name,url}` → `{name,url,date}` merentasi SEMUA laluan (parser client `ManualBlockFormat.js`, salinan pendua dlm `server.js`, borang manual UI, prompt AI, Focus View, label kad)

## ISU BELUM SELESAI — sambung di sini

**Kritikal, belum disahkan**: Izzat hantar 2 screenshot skrin SEBENAR (bukan simulasi) menunjukkan
frontpage production (brief.adjung.com) macam "pudar"/tak siap muat — logo "Adjung BRIEF", jam
dunia semua nampak pudar/lut sinar, "BERITA SEMASA" ada tapi TIADA kad kandungan di bawahnya.
Ni **BUKAN** berkaitan terus dgn ciri "Dengan rujukan" (yang cuma jejas modal Tulis Kandungan
Editorium, bukan frontpage awam) — tapi memandangkan ia muncul SEJURUS SELEPAS deploy terkini,
wajar disiasat sebelum yakin "tiada regresi".

Siasatan saya (guna `javascript_tool`, BUKAN screenshot — alat screenshot browser saya sendiri
GAGAL sepanjang sesi ni, "Browser pane is not displayed", walaupun Izzat sahkan pane KELIHATAN di
skrin dia):
- `document.readyState` = `complete`, `body` opacity = 1
- Logo "Adjung": opacity 1, color `rgb(128, 35, 52)` (ni **BETUL** — sepadan `--Adjung-maroon`
  #802334 rasmi projek), visibility visible, saiz munasabah (205×98px)
- "BERITA SEMASA": opacity 1, color sama maroon betul, visible
- **BELUM SEMPAT semak** kenapa kad kandungan (cth "Ujian Simulasi Sumber Berbilang...", disahkan
  WUJUD dlm DOM via `get_page_text` awal tadi) tak kelihatan/pudar dlm screenshot Izzat walhal
  computed style nampak betul di elemen atas. Command JS terakhir yg saya jalankan (cari
  `testCard` guna padanan teks "Ujian Simulasi Sumber Berbilang") **tak jumpa** elemen tu
  (`"found": false`) — mungkin viewport 898×702 terlalu kecil (kad tu di bawah fold, `berita.rect.top`
  = 332px, kandungan sepatutnya lagi bawah), ATAU render sebenar rosak. **Belum sempat scroll +
  semak kad sebenar sebelum sesi terputus.**

**Cadangan langkah seterusnya (sesi baharu)**:
1. Minta akses screenshot/visual sebenar berfungsi (browser tool session baharu patut normal).
2. Navigate ke `https://brief.adjung.com`, scroll turun, screenshot kawasan kad bento (bukan cuma
   viewport atas — bukti DOM tunjuk kandungan WUJUD, cuma mungkin di bawah fold atau ada isu
   layout/opacity KHUSUS pada kad, bukan seluruh laman).
3. Kalau sahkan ada regresi sebenar (bukan cuma fold/viewport), `git log --oneline -5` dan semak
   SATU-SATU 3 commit terkini (`6f7c50b`, `431fe8e`, `59edc39`) — paling berkemungkinan
   `59edc39` (ubah `FrontpageView.tsx` — `itemToPush.originalDate = ''` bila `sources.length > 1`,
   lihat baris berkaitan carian `Editorial Adjung`) sebab itu SATU-SATUNYA perubahan sesi ni yang
   sentuh laluan render frontpage AWAM (semua yg lain cuma modal Editorium).
4. Kalau tiada regresi (screenshot Izzat cuma tangkap loading-state/fold biasa), maklumkan Izzat
   dan tutup isu ni.

## Kerja yg BELUM disahkan visual (perlu mata Izzat, bukan sekadar kod betul)

Selain isu kritikal di atas:
- Susun atur baris sumber 3-lajur (Nama/URL/Tarikh) dlm borang manual "Tulis Kandungan" (Urus Slot
  → Editorium, perlu log masuk yg saya TAK ADA akses).
- Paparan tarikh per-sumber di Focus View (buka mana-mana kandungan >1 sumber, cth kandungan ujian
  "Sumber Berbilang" yg disebut di atas).
- Simulasi AI terkini (mod "Dengan rujukan" + berbilang sumber + Editorial Adjung fix) — SAYA
  SENDIRI dah mula uji ulang guna ChatGPT (tab "seed" dlm Browser pane, prompt Bernama+NST API
  183 vs 190) tapi **belum sempat lihat balasan** sebelum sesi terputus utk isu screenshot di atas.

## Fail utama yg disentuh sesi ni (utk rujukan cepat)
- `src/components/portal/SlotManagerModal.tsx` — `buildAiPrompt()`, UI mod "Dengan rujukan"
- `core/editorial/ManualBlockFormat.js` — parser/serializer bersama (client)
- `server.js` — salinan pendua parser (SENGAJA tak disatukan, lihat komen dlm kod) + `serializeDraftBlock`
- `src/components/portal/FrontpageView.tsx` — label "Editorial Adjung" + fallback tarikh kad
- `src/components/portal/FocusView.tsx` — paparan sumber+tarikh penuh

## Nota proses (penting utk diteruskan dgn cara sama)
- Izzat **sentiasa** nak dirujuk dlm Bahasa Melayu formal dalam chat (bukan cuma kod/UI) —
  memory `feedback_guna_bahasa_melayu_dalam_chat.md`.
- **Corak kerja ciri AI-prompt ni**: bina hipotesis → tanya ChatGPT (project "Adjung Brief" dlm
  ChatGPT, thread "Semak repositori atau PR") dulu SEBELUM ubah kod besar → uji SIMULASI SEBENAR
  guna Gemini/ChatGPT (bukan cuma baca kod) → Izzat semak → ulang. Jangan langkau langkah "tanya
  ChatGPT dulu" utk keputusan reka bentuk (bukan cuma bahasa/typo).
- tsc + `npm test` (151 ujian) WAJIB bersih sebelum commit; log setiap perubahan UI/UX guna
  `node scripts/log-ui-change.mjs "<ringkasan>" "<fail>"` DALAM commit yang sama.
- Deploy: `ssh -i ~/.ssh/adjung_deploy root@brief.adjung.com "cd /var/www/adjung-brief && git pull && npm run build && pm2 restart adjung-brief"`.
