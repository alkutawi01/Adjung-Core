# Panduan Deploy — Adjung Brief

Disediakan 2026-08-02. Semua kerja persediaan (ujian, pembersihan, backup) sudah siap —
dokumen ini SEKADAR langkah-langkah; tiada satu pun dijalankan secara automatik. Tuan
yang tekan setiap butang deploy sebenar.

---

## ⚠️ Keputusan WAJIB dibuat dulu — storan `adjung.db`

**Ini paling penting dalam seluruh dokumen ni. Jangan langkau.**

Projek ni asalnya dibina di Google AI Studio, dan `.env.example` sedia ada rujuk "Cloud Run
service URL" — bermakna platform deploy yang paling mungkin ialah **Google Cloud Run**.

Cloud Run (dan kebanyakan platform "serverless"/container moden lain — Render free tier,
Railway tanpa volume, dsb.) guna **cakera SEMENTARA (ephemeral)**: apa-apa fail ditulis ke
cakera tempatan (termasuk `adjung.db` SENDIRI, dan backup automatik Fasa 15 yang tulis ke
cakera yang sama) **HILANG** setiap kali bekas dimulakan semula — cold start, deploy baharu,
auto-scale ke sifar, atau crash. Adjung Brief simpan SEMUA kandungan editorial dalam SATU
fail SQLite tempatan (`adjung.db`) — kalau deploy terus ke Cloud Run tanpa langkah tambahan,
**kandungan sebenar boleh hilang bila-bila masa server dimulakan semula, tanpa amaran.**

Pilih SATU sebelum teruskan:

| Pilihan | Penerangan | Kerja tambahan |
|---|---|---|
| **A. VPS/VM biasa** (DigitalOcean, Linode, EC2, dll.) | Cakera berkekalan lalai, `adjung.db` selamat merentasi *restart* | Tiada — server.js sedia untuk ni terus |
| **B. Cloud Run + Cloud Storage FUSE / Persistent Disk** | Lekapkan volume berkekalan ke bekas Cloud Run | Konfigurasi tambahan platform, belum disediakan dalam kod ni |
| **C. Migrasi ke DB terurus** (Cloud SQL, Postgres, dll.) | Selesaikan isu storan selama-lamanya | Perubahan seni bina besar, BUKAN skop sesi ni |

**Cadangan**: Pilihan A (VPS/VM biasa) — paling ringkas, tiada perubahan kod diperlukan,
sepadan corak `adjung.db` sedia ada. Kalau tuan dah komited kepada Cloud Run (sebab asal
AI Studio), maklumkan — kita boleh bina Pilihan B/C sebagai kerja berasingan sebelum deploy.

---

## Langkah 1 — Sediakan pembolehubah persekitaran (`.env`)

Fail `.env` sendiri GITIGNORED (betul, jangan commit). Cipta terus di server sasaran
(atau panel "Secrets"/"Environment Variables" platform hosting):

```bash
# Jana rahsia sesi SEBENAR — WAJIB, satu kali sahaja, simpan selamat
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Tetapkan di server produksi:
- `SESSION_SECRET` — nilai dijana di atas. **Tanpa ini, setiap kali server dimulakan
  semula, SEMUA sesi log masuk terputus** (server jana rahsia rawak sementara, amaran
  dipaparkan di log — lihat `.env.example`).
- `NODE_ENV=production` — mengaktifkan kuki sesi `secure: true` (cuma dihantar atas HTTPS).
- `PORT` — platform hosting biasanya set ini sendiri (Cloud Run: 8080; VPS: pilih sendiri,
  cth 5000). `server.js` sudah baca `process.env.PORT` dengan betul.
- `GEMINI_API_KEY` — jika ciri AI (kini dimatikan sengaja, Fasa 8) diaktifkan semula
  kelak. Tak wajib untuk deploy skop semasa.

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
storan awan berasingan) — kalau deploy pertama silap konfigurasi storan (lihat amaran di
atas), ini satu-satunya cara pulih kandungan sebenar.

---

## Langkah 4 — Deploy ikut platform pilihan

### Jika Pilihan A (VPS/VM biasa)
1. Salin/klon repo ke server (`git clone` atau muat naik terus).
2. `npm install --production` (atau `npm install` penuh jika `devDependencies` diperlukan
   untuk `npm run build`).
3. Tetapkan `.env` (Langkah 1).
4. `npm start` — ini jalankan `npm run build` diikuti `node server.js` produksi.
5. Sediakan pengurus proses supaya server mula semula automatik jika crash/reboot server
   (`pm2`, `systemd` unit, atau serupa — tiada satu pun ditetapkan dalam kod ni lagi,
   `server.js` sendiri ada pengendali `SIGTERM`/`SIGINT` yang tutup bersih, jadi mana-mana
   pengurus proses standard sesuai).
6. Konfigurasi reverse proxy (nginx/Caddy) untuk HTTPS + domain sebenar, hala ke port
   `server.js` (langkau kalau platform hosting sediakan TLS terus, cth banyak VPS panel).

### Jika Pilihan B (Cloud Run + volume berkekalan)
KIV — perlu kerja konfigurasi tambahan (Dockerfile, lekapan volume) sebelum langkah ni
relevan. Beritahu saya bila sedia untuk bina bahagian ni.

---

## Langkah 5 — Sahkan pasca-deploy

Selepas server produksi hidup di URL sebenar:
- [ ] Frontpage awam papar betul (kad, Ticker, jam dunia) — pengunjung tanpa log masuk
- [ ] Log masuk Ketua Editor sebenar berfungsi, sesi kekal selepas segar semula
- [ ] `sitemap.xml`, `robots.txt`, `rss.xml` boleh dicapai terus di URL produksi sebenar
- [ ] Simpan/sunting kandungan ujian kecil (bukan kandungan sebenar) — sahkan berjaya,
  padam ujian selepas itu
- [ ] Log Sistem (Editorium) papar tindakan sebenar, bukan kosong
- [ ] Backup automatik Fasa 15 mula berjalan (semak log server selepas 24 jam pertama,
  atau segera jika Pilihan A dan cakera berkekalan — fail `adjung.db.backup-auto-*`
  patut muncul)
- [ ] **PENTING**: mulakan semula server produksi SEKALI (restart terkawal) dan sahkan
  `adjung.db` KEKAL utuh selepas itu — ini ujian sebenar bagi amaran storan di atas

---

## Nota

- Semua langkah ATAS TIDAK dijalankan oleh Claude — dokumen ni rujukan sahaja. Setiap
  arahan mesti tuan jalankan sendiri (atau minta saya jalankan satu-satu dengan kelulusan
  eksplisit setiap satu, memandangkan sifatnya tak boleh patah balik).
- Rujuk `PELAN_PRA_LAUNCH.md` seksyen "KIV — tunggu Izzat" untuk senarai penuh keputusan
  lain yang masih tertunggak (Fasa 8b, 11, 12, animasi transisi Fasa 7).
