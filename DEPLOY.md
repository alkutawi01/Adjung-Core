# Panduan Deploy — Adjung Brief

Disediakan 2026-08-02, dikemas kini selepas keputusan Izzat: **projek ni diasingkan
sepenuhnya daripada Google AI Studio** (langganan berbayar dihentikan; AI Studio kekal
sebagai sejarah asal projek sahaja — lihat CLAUDE.md — bukan lagi platform hosting/deploy).

Semua kerja persediaan (ujian, pembersihan, backup) sudah siap — dokumen ini SEKADAR
langkah-langkah; tiada satu pun dijalankan secara automatik. Tuan yang tekan setiap
butang deploy sebenar.

**Status semasa (dikemas kini 2026-08-31): produksi SUDAH live** di
`https://brief.adjung.com` di atas Droplet `adjung-brief-prod` (178.128.209.57) — Langkah
0-5 di bawah SUDAH selesai dijalankan, kekal sebagai rujukan sejarah/rebuild sahaja
(cth kalau Droplet baharu diperlukan kelak), bukan langkah yang perlu diulang setiap
deploy rutin. Untuk deploy rutin sedia ada (kod baharu ke server yang dah wujud), cuma:

```bash
git push origin main
ssh adjung-brief-prod "cd /var/www/adjung-brief && git pull && npm run build && pm2 restart adjung-brief"
```

(Backend sahaja, tiada perubahan `.tsx`/`.ts` frontend — boleh langkau `npm run build`,
cukup `git pull && pm2 restart`.)

**Claude ada kunci SSH khas** (`adjung-brief-claude`, ditambah ke `authorized_keys`
Droplet 31/8/2026 selepas kebenaran eksplisit Izzat via `.claude/settings.json`
`Bash(ssh:*)`/`Bash(git push:*)`) — boleh jalankan push+deploy penuh sendiri tanpa Izzat
taip manual, TERMASUK selepas insiden outage 31/8 (lihat memori
`feedback_never_commit_whole_file_mixed_changes`). Tetap **backup `adjung.db` dan minta
kelulusan Izzat dahulu** untuk apa-apa yang menyentuh data/skema, ikut prinsip CLAUDE.md.

---

## Platform sasaran: DigitalOcean Droplet (VPS)

Izzat sudah setuju — **DigitalOcean** ialah platform dipilih (2026-08-02). Cadangan:
Droplet asas 1GB RAM/1 vCPU (~USD 6/bulan), rantau **Singapore (sgp1)** — paling dekat
dengan pelawat Malaysia, latency terendah. Cakera berkekalan lalai pada Droplet biasa,
`adjung.db` (SATU-SATUNYA tempat semua kandungan editorial sebenar tersimpan) selamat
merentasi *restart* server, tiada langkah tambahan diperlukan. `server.js` sedia untuk
corak ni terus.

### Langkah 0 — Cipta Droplet
1. Daftar/log masuk [digitalocean.com](https://digitalocean.com) (Izzat buat sendiri —
   ini penciptaan akaun/langganan, Claude tak boleh buat bagi pihak tuan).
2. **Create → Droplets**.
3. Image: **Ubuntu 24.04 LTS**.
4. Plan: **Basic**, jenis **Regular SSD**, saiz **1GB RAM / 1 vCPU / 25GB SSD** (~$6/bulan)
   — cukup untuk portal skop semasa; boleh naik taraf kelak tanpa migrasi kalau trafik naik.
5. Rantau: **Singapore (sgp1)**.
6. Authentication: **SSH Key** (lebih selamat daripada kata laluan) — DigitalOcean beri
   panduan jana kunci kalau belum ada.
7. Hostname: apa-apa nama dikenali (cth `adjung-brief-prod`).
8. **Create Droplet** — tunggu ~1 minit, salin alamat IP yang diberikan.

### Langkah 0b — Persediaan awal server (sekali sahaja)
SSH masuk (`ssh root@<IP-droplet>`), kemudian:
```bash
apt update && apt upgrade -y
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
# pm2 - pengurus proses (auto-restart bila crash/reboot)
npm install -g pm2
# firewall asas
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

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

## Langkah 4 — Deploy ke Droplet DigitalOcean

```bash
# Di Droplet, sebagai root (atau user sudo)
git clone <url-repo-git-tuan> /var/www/adjung-brief
cd /var/www/adjung-brief
npm install                    # perlukan devDependencies untuk npm run build
nano .env                      # tampal SESSION_SECRET, NODE_ENV=production, PORT=5000 (Langkah 1)
npm run build                  # bina dist/ produksi sekali sahaja di sini
pm2 start server.js --name adjung-brief --interpreter ./node_modules/.bin/tsx
pm2 save                       # simpan senarai proses semasa
pm2 startup                    # ikut arahan yang dipaparkan - daftar pm2 mula semula bila server reboot
```

`server.js` sendiri ada pengendali `SIGTERM`/`SIGINT` yang tutup bersih — sesuai dengan
`pm2 restart`/`pm2 reload`.

**PENTING — kenapa `--interpreter tsx`, bukan `node` terus**: `server.js` import terus
`src/config/istilah.ts` (fail TypeScript). Node 20 tak boleh baca `.ts` terus (baru Node
22.6+/23+ ada sokongan native, dan itu pun perlu bendera/versi tertentu) — guna `tsx`
(dah jadi devDependency projek, cara sama macam `npm run dev` jalankan `server.js`)
elakkan ralat `ERR_UNKNOWN_FILE_EXTENSION`. Disahkan (2026-08-02) semasa deploy sebenar
ke Droplet Node 20 — ujian tempatan awal tersembunyi bug ni sebab komputer pembangunan
guna Node 24 yang sokong native TypeScript.

### Reverse proxy — nginx + HTTPS percuma (Let's Encrypt)
```bash
apt install -y nginx certbot python3-certbot-nginx
```
Cipta `/etc/nginx/sites-available/adjung-brief`:
```nginx
server {
    listen 80;
    server_name domain-tuan.com www.domain-tuan.com;
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
ln -s /etc/nginx/sites-available/adjung-brief /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d domain-tuan.com -d www.domain-tuan.com   # HTTPS automatik + auto-renew
```
(Domain tuan mesti sudah ada rekod DNS A menghala ke IP Droplet sebelum langkah `certbot`.)

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

- Langkah 0-5 (persediaan Droplet PERTAMA KALI) TIDAK dijalankan oleh Claude — rujukan
  sejarah/rebuild sahaja. Deploy RUTIN (push+pull+restart kod sedia ada) kini BOLEH
  dijalankan Claude sendiri (lihat "Status semasa" di atas) — tetap minta kelulusan
  eksplisit dahulu untuk apa-apa operasi yang tak boleh patah balik atau sentuh data.
- Rujuk `PELAN_PRA_LAUNCH.md` seksyen "KIV — tunggu Izzat" untuk senarai penuh keputusan
  lain yang masih tertunggak (Fasa 8b, 11, 12, animasi transisi Fasa 7).
