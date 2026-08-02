# Panduan Deploy — Adjung Brief

Disediakan 2026-08-02, dikemas kini selepas keputusan Izzat: **projek ni diasingkan
sepenuhnya daripada Google AI Studio** (langganan berbayar dihentikan; AI Studio kekal
sebagai sejarah asal projek sahaja — lihat CLAUDE.md — bukan lagi platform hosting/deploy).

Semua kerja persediaan (ujian, pembersihan, backup) sudah siap — dokumen ini SEKADAR
langkah-langkah; tiada satu pun dijalankan secara automatik. Tuan yang tekan setiap
butang deploy sebenar.

---

## Platform sasaran: VPS/VM biasa (bukan Cloud Run/serverless)

Memandangkan diasingkan daripada AI Studio, deploy sasaran ialah **VPS/VM biasa**
(DigitalOcean, Linode, EC2, atau serupa) — cakera berkekalan lalai, `adjung.db` (SATU-
SATUNYA tempat semua kandungan editorial sebenar tersimpan) selamat merentasi *restart*
server, tiada langkah tambahan diperlukan. `server.js` sedia untuk corak ni terus.

**Elakkan platform "serverless"/container tanpa volume berkekalan** (Cloud Run tanpa
volume, Render/Railway free tier tanpa volume, dll.) — platform sebegini guna cakera
SEMENTARA, bermakna `adjung.db` boleh hilang setiap kali bekas dimulakan semula (cold
start, deploy baharu, crash). Kalau tuan kelak pertimbangkan platform sebegitu atas
sebab lain, maklumkan dulu — perlu kerja tambahan (volume berkekalan, atau migrasi ke DB
terurus) sebelum ia selamat untuk Adjung Brief.

---

## Langkah 1 — Sediakan pembolehubah persekitaran (`.env`)

Fail `.env` sendiri GITIGNORED (betul, jangan commit). Cipta terus di server sasaran:

```bash
# Jana rahsia sesi SEBENAR — WAJIB, satu kali sahaja, simpan selamat
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Tetapkan di server produksi:
- `SESSION_SECRET` — nilai dijana di atas. **Tanpa ini, setiap kali server dimulakan
  semula, SEMUA sesi log masuk terputus** (server jana rahsia rawak sementara, amaran
  dipaparkan di log — lihat `.env.example`).
- `NODE_ENV=production` — mengaktifkan kuki sesi `secure: true` (cuma dihantar atas HTTPS).
- `PORT` — pilih sendiri (cth 5000; `server.js` sudah baca `process.env.PORT` dengan betul).
- `GEMINI_API_KEY` — HANYA jika/bila ciri chatbox AI manual dibina semula kelak (pipeline
  automatik dimatikan sengaja, Fasa 8). Tak wajib untuk deploy skop semasa, boleh
  dilangkau terus.

---

## Langkah 2 — Uji binaan produksi TEMPATAN dulu

Jangan deploy terus tanpa uji `npm start` di komputer sendiri dahulu:

```bash
npm run build
NODE_ENV=production SESSION_SECRET=<nilai-ujian> npm start
```

Sahkan:
- Log server tunjuk `Menghidang binaan produksi dari .../dist` (bukan amaran "Tiada dist/").
- Buka `http://localhost:5000` (atau `PORT` yang ditetapkan) — frontpage sepatutnya
  papar SAMA seperti mod dev, tanpa proksi Vite.
- Navigasi terus ke laluan dalaman (cth `http://localhost:5000/editorium`) — kena papar
  skrin Editorium (fallback SPA), BUKAN 404 Express.
- `curl http://localhost:5000/sitemap.xml` dan `/rss.xml` — kedua mesti pulangkan XML sah.
- Log masuk sebenar, sahkan sesi kekal selepas segar semula (`Ctrl+R`).

Hentikan proses ini (`Ctrl+C`) selepas sah — jangan biar ia berjalan di latar sepanjang
langkah seterusnya.

---

## Langkah 3 — Backup terakhir sebelum deploy

```bash
cp adjung.db "adjung.db.backup-$(date +%Y%m%d-%H%M%S)-pra-deploy-pertama"
```

Simpan salinan ni DI LUAR repo/server (muat turun ke komputer tempatan, atau muat naik ke
storan awan berasingan) — kalau ada apa-apa tersasar semasa deploy pertama, ini
satu-satunya cara pulih kandungan sebenar.

---

## Langkah 4 — Deploy ke VPS/VM

1. Salin/klon repo ke server (`git clone` atau muat naik terus).
2. `npm install` (perlukan `devDependencies` untuk `npm run build`).
3. Tetapkan `.env` (Langkah 1).
4. `npm start` — ini jalankan `npm run build` diikuti `node server.js` produksi.
5. Sediakan pengurus proses supaya server mula semula automatik jika crash/reboot server
   (`pm2`, `systemd` unit, atau serupa — tiada satu pun ditetapkan dalam kod ni lagi,
   `server.js` sendiri ada pengendali `SIGTERM`/`SIGINT` yang tutup bersih, jadi mana-mana
   pengurus proses standard sesuai).
6. Konfigurasi reverse proxy (nginx/Caddy) untuk HTTPS + domain sebenar, hala ke port
   `server.js` (langkau kalau panel VPS sediakan TLS terus).

---

## Langkah 5 — Sahkan pasca-deploy

Selepas server produksi hidup di URL sebenar:
- [ ] Frontpage awam papar betul (kad, Ticker, jam dunia) — pengunjung tanpa log masuk
- [ ] Log masuk Ketua Editor sebenar berfungsi, sesi kekal selepas segar semula
- [ ] `sitemap.xml`, `robots.txt`, `rss.xml` boleh dicapai terus di URL produksi sebenar
- [ ] Simpan/sunting kandungan ujian kecil (bukan kandungan sebenar) — sahkan berjaya,
  padam ujian selepas itu
- [ ] Log Sistem (Editorium) papar tindakan sebenar, bukan kosong
- [ ] Backup automatik Fasa 15 mula berjalan (semak log server selepas 24 jam pertama —
  fail `adjung.db.backup-auto-*` patut muncul di direktori server)
- [ ] **PENTING**: mulakan semula server produksi SEKALI (restart terkawal) dan sahkan
  `adjung.db` KEKAL utuh selepas itu — pengesahan akhir cakera berkekalan berfungsi betul

---

## Nota

- Semua langkah ATAS TIDAK dijalankan oleh Claude — dokumen ni rujukan sahaja. Setiap
  arahan mesti tuan jalankan sendiri (atau minta saya jalankan satu-satu dengan kelulusan
  eksplisit setiap satu, memandangkan sifatnya tak boleh patah balik).
- Rujuk `PELAN_PRA_LAUNCH.md` seksyen "KIV — tunggu Izzat" untuk senarai penuh keputusan
  lain yang masih tertunggak (Fasa 8b, 11, 12, animasi transisi Fasa 7).
